#include "SdlDriver.h"

#include <SDL.h>
#include <cstdlib>
#include <cstring>
#include <display/main.h>
#include <execinfo.h>
#include <lvgl.h>
#include <vector>

SdlDriver *SdlDriver::instance = nullptr;

// The LilyGo T-RGB and Waveshare panels are 480 x 480. SIM_PANEL_SIZE=466 pretends to be one of the AMOLED
// panels, to see how the 480 px design sits on it.
static int DISP_W = 480;
static int DISP_H = 480;

static SDL_Window *s_window = nullptr;
static SDL_Renderer *s_renderer = nullptr;
static SDL_Texture *s_texture = nullptr;
static SDL_Texture *s_mask = nullptr; // opaque outside the 480px circle, transparent inside

// "Bezel" colour shown outside the round panel (corners of the square window).
static constexpr Uint8 BEZEL_R = 0x28, BEZEL_G = 0x28, BEZEL_B = 0x28;

static lv_disp_draw_buf_t s_draw_buf;
static lv_color_t *s_buf = nullptr;

static int s_mouseX = 0;
static int s_mouseY = 0;
static bool s_mousePressed = false;
static bool s_quit = false;

static void disp_flush(lv_disp_drv_t *drv, const lv_area_t *area, lv_color_t *color_p) {
    SDL_Rect r{area->x1, area->y1, area->x2 - area->x1 + 1, area->y2 - area->y1 + 1};
    // SIM_TRACE_FLUSH=1 lists every area LVGL repaints: the way to find out what a frame redrew.
    static const bool trace = getenv("SIM_TRACE_FLUSH") != nullptr;
    if (trace)
        fprintf(stderr, "[flush] %lu ms  %d,%d %dx%d\n", (unsigned long)SDL_GetTicks(), r.x, r.y, r.w, r.h);
    SDL_UpdateTexture(s_texture, &r, color_p, r.w * (int)sizeof(lv_color_t));
    lv_disp_flush_ready(drv);
}

// SIM_TRACE_INVALIDATE=1 lists every area as it is marked for repainting (LVGL asks the driver to round each
// one, which is the only place to see them before they are merged); =stack adds who asked. SIM_TRACE_FLUSH
// says what a frame redrew, this says why.
static void trace_invalidate(lv_disp_drv_t *, lv_area_t *area) {
    if (lv_disp_get_default()->rendering_in_progress)
        return; // the refresh asks too, while it splits an area into strips
    static const bool stack = strcmp(getenv("SIM_TRACE_INVALIDATE"), "stack") == 0;
    fprintf(stderr, "[invalidate] %lu ms  %d,%d %dx%d\n", (unsigned long)SDL_GetTicks(), area->x1, area->y1,
            area->x2 - area->x1 + 1, area->y2 - area->y1 + 1);
    if (stack) {
        void *frames[24];
        backtrace_symbols_fd(frames + 1, backtrace(frames, 24) - 1, 2);
    }
}

static void mouse_read(lv_indev_drv_t *drv, lv_indev_data_t *data) {
    (void)drv;
    data->point.x = s_mouseX;
    data->point.y = s_mouseY;
    data->state = s_mousePressed ? LV_INDEV_STATE_PR : LV_INDEV_STATE_REL;
}

void SdlDriver::init() {
    if (const char *size = getenv("SIM_PANEL_SIZE"); size != nullptr && atoi(size) >= 240 && atoi(size) <= 480)
        DISP_W = DISP_H = atoi(size);
    if (SDL_Init(SDL_INIT_VIDEO) != 0) {
        fprintf(stderr, "SDL_Init failed: %s\n", SDL_GetError());
        exit(1);
    }
    s_window =
        SDL_CreateWindow("BetterMate Simulator", SDL_WINDOWPOS_CENTERED, SDL_WINDOWPOS_CENTERED, DISP_W, DISP_H, SDL_WINDOW_SHOWN);
    s_renderer = SDL_CreateRenderer(s_window, -1, SDL_RENDERER_ACCELERATED | SDL_RENDERER_PRESENTVSYNC);
    // SDL's dummy video backend has no accelerated renderer. Keep scripted
    // input and real LVGL screenshots usable in headless verification.
    if (!s_renderer)
        s_renderer = SDL_CreateRenderer(s_window, -1, SDL_RENDERER_SOFTWARE);
    if (!s_renderer) {
        fprintf(stderr, "SDL_CreateRenderer failed: %s\n", SDL_GetError());
        exit(1);
    }
    s_texture = SDL_CreateTexture(s_renderer, SDL_PIXELFORMAT_RGB565, SDL_TEXTUREACCESS_STREAMING, DISP_W, DISP_H);

    // Build the round-display mask: the device panel is a 480px circle, so paint
    // everything outside that circle with the bezel colour and leave the inside
    // transparent. Overlaid on every frame so the square framebuffer reads as round.
    s_mask = SDL_CreateTexture(s_renderer, SDL_PIXELFORMAT_ARGB8888, SDL_TEXTUREACCESS_STATIC, DISP_W, DISP_H);
    SDL_SetTextureBlendMode(s_mask, SDL_BLENDMODE_BLEND);
    {
        std::vector<uint32_t> px(DISP_W * DISP_H);
        const double cx = DISP_W / 2.0, cy = DISP_H / 2.0, r = DISP_W / 2.0;
        const uint32_t bezel = 0xFF000000u | (BEZEL_R << 16) | (BEZEL_G << 8) | BEZEL_B;
        for (int y = 0; y < DISP_H; y++) {
            for (int x = 0; x < DISP_W; x++) {
                const double dx = x + 0.5 - cx, dy = y + 0.5 - cy;
                px[y * DISP_W + x] = (dx * dx + dy * dy <= r * r) ? 0x00000000u : bezel;
            }
        }
        SDL_UpdateTexture(s_mask, nullptr, px.data(), DISP_W * (int)sizeof(uint32_t));
    }

    lv_init();
    s_buf = (lv_color_t *)malloc(DISP_W * DISP_H * sizeof(lv_color_t));
    lv_disp_draw_buf_init(&s_draw_buf, s_buf, nullptr, DISP_W * DISP_H);

    static lv_disp_drv_t disp_drv;
    lv_disp_drv_init(&disp_drv);
    disp_drv.hor_res = DISP_W;
    disp_drv.ver_res = DISP_H;
    disp_drv.flush_cb = disp_flush;
    if (getenv("SIM_TRACE_INVALIDATE") != nullptr)
        disp_drv.rounder_cb = trace_invalidate;
    disp_drv.draw_buf = &s_draw_buf;
    lv_disp_drv_register(&disp_drv);

    static lv_indev_drv_t indev_drv;
    lv_indev_drv_init(&indev_drv);
    indev_drv.type = LV_INDEV_TYPE_POINTER;
    indev_drv.read_cb = mouse_read;
    lv_indev_drv_register(&indev_drv);
}

void SdlDriver::pumpAndRender() {
    SDL_Event e;
    while (SDL_PollEvent(&e)) {
        switch (e.type) {
        case SDL_QUIT:
            s_quit = true;
            break;
        case SDL_MOUSEMOTION:
            s_mouseX = e.motion.x;
            s_mouseY = e.motion.y;
            break;
        case SDL_MOUSEBUTTONDOWN:
            if (e.button.button == SDL_BUTTON_LEFT) {
                s_mousePressed = true;
                s_mouseX = e.button.x;
                s_mouseY = e.button.y;
            }
            break;
        case SDL_MOUSEBUTTONUP:
            if (e.button.button == SDL_BUTTON_LEFT)
                s_mousePressed = false;
            break;
        case SDL_KEYDOWN:
        case SDL_KEYUP: // keys 1/2 act as the brew/steam inputs of the controller board
            if (e.key.repeat == 0 && (e.key.keysym.sym == SDLK_1 || e.key.keysym.sym == SDLK_2))
                controller.getClientController()->simulateButton(e.key.keysym.sym == SDLK_1 ? 0 : 1, e.type == SDL_KEYDOWN);
            break;
        default:
            break;
        }
    }
    SDL_SetRenderDrawColor(s_renderer, BEZEL_R, BEZEL_G, BEZEL_B, 0xFF);
    SDL_RenderClear(s_renderer);
    SDL_RenderCopy(s_renderer, s_texture, nullptr, nullptr);
    SDL_RenderCopy(s_renderer, s_mask, nullptr, nullptr); // round off the corners
    SDL_RenderPresent(s_renderer);
}

bool SdlDriver::shouldQuit() const { return s_quit; }

void SdlDriver::injectPointer(int x, int y, bool pressed) {
    s_mouseX = x;
    s_mouseY = y;
    s_mousePressed = pressed;
}

void SdlDriver::screenshot(const char *path) {
    SDL_SetRenderDrawColor(s_renderer, BEZEL_R, BEZEL_G, BEZEL_B, 0xFF);
    SDL_RenderClear(s_renderer);
    SDL_RenderCopy(s_renderer, s_texture, nullptr, nullptr);
    SDL_RenderCopy(s_renderer, s_mask, nullptr, nullptr); // round off the corners
    SDL_Surface *surface = SDL_CreateRGBSurfaceWithFormat(0, DISP_W, DISP_H, 16, SDL_PIXELFORMAT_RGB565);
    if (surface) {
        SDL_RenderReadPixels(s_renderer, nullptr, SDL_PIXELFORMAT_RGB565, surface->pixels, surface->pitch);
        SDL_SaveBMP(surface, path);
        SDL_FreeSurface(surface);
    }
    SDL_RenderPresent(s_renderer);
}
