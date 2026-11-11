/**
 * @file      LV_Helper.cpp
 * @author    Lewis He (lewishe@outlook.com)
 * @license   MIT
 * @copyright Copyright (c) 2024  Shenzhen Xin Yuan Electronic Technology Co.,
 * Ltd
 * @date      2024-01-22
 *
 */
#include "LV_Helper.h"

#include <algorithm>
#include <bitset>

#if LV_VERSION_CHECK(9, 0, 0)
#error "Currently not supported 9.x"
#endif

static lv_disp_draw_buf_t draw_buf;
static lv_disp_drv_t disp_drv;
static lv_indev_drv_t indev_drv;
static lv_color_t *buf = NULL;

// Changed rows this close together go to the panel as one band.
static constexpr lv_coord_t ROW_BAND_GAP = 16;

// Direct mode (the AMOLED panels): LVGL draws into one frame-sized buffer and calls flush once per repainted
// area, each time handing over the whole frame. Pushing the frame for every area costs a full QSPI frame each,
// and the BetterMate UI repaints many small areas a frame (one per ring tick). So this waits for the last area
// and then pushes only the rows that changed, as full-width bands straight out of the frame buffer. Rows go in
// pairs: these panels address even row pairs.
static void flush_changed_rows(lv_disp_drv_t *drv, lv_color_t *frame) {
    const lv_disp_t *disp = _lv_refr_get_disp_refreshing();
    auto *board = static_cast<Display *>(drv->user_data);
    const lv_coord_t width = drv->hor_res;
    const lv_coord_t height = std::min<lv_coord_t>(drv->ver_res, 512);
    std::bitset<512> changed;
    for (uint16_t i = 0; i < disp->inv_p; ++i) {
        if (disp->inv_area_joined[i])
            continue;
        const lv_area_t &area = disp->inv_areas[i];
        for (lv_coord_t y = std::max<lv_coord_t>(area.y1, 0); y <= area.y2 && y < height; ++y)
            changed.set(y);
    }
    for (lv_coord_t y = 0; y < height; ++y) {
        if (!changed.test(y))
            continue;
        const lv_coord_t first = y & ~1;
        lv_coord_t last = y;
        for (lv_coord_t probe = y + 1; probe < height && probe - last <= ROW_BAND_GAP; ++probe) {
            if (changed.test(probe))
                last = probe;
        }
        last = std::min<lv_coord_t>(last | 1, height - 1);
        board->pushColors(0, first, width, last - first + 1, reinterpret_cast<uint16_t *>(frame + first * width));
        y = last;
    }
}

/* Display flushing */
static void disp_flush(lv_disp_drv_t *disp_drv, const lv_area_t *area, lv_color_t *color_p) {
    if (disp_drv->direct_mode) {
        if (lv_disp_flush_is_last(disp_drv))
            flush_changed_rows(disp_drv, color_p);
    } else {
        // The RGB panels take the end column and row here, not a width and a height.
        static_cast<Display *>(disp_drv->user_data)->pushColors(area->x1, area->y1, area->x2 + 1, area->y2 + 1, (uint16_t *)color_p);
    }
    lv_disp_flush_ready(disp_drv);
}

/*Read the touchpad*/
static void touchpad_read(lv_indev_drv_t *indev_driver, lv_indev_data_t *data) {
    static int16_t x, y;
    uint8_t touched = static_cast<Display *>(indev_driver->user_data)->getPoint(&x, &y, 1);
    if (touched) {
        data->point.x = x;
        data->point.y = y;
        data->state = LV_INDEV_STATE_PR;
        return;
    }
    data->state = LV_INDEV_STATE_REL;
}

#if LV_USE_LOG
void lv_log_print_g_cb(const char *buf) {
    Serial.println(buf);
    Serial.flush();
}
#endif

String lvgl_helper_get_fs_filename(String filename) {
    static String path;
    path = String("A") + ":" + (filename);
    return path;
}

const char *lvgl_helper_get_fs_filename(const char *filename) {
    static String path;
    path = String("A") + ":" + String(filename);
    return path.c_str();
}

void beginLvglHelper(Display &board, bool debug) {

    lv_init();

#if LV_USE_LOG
    if (debug) {
        lv_log_register_print_cb(lv_log_print_g_cb);
    }
#endif

    // One frame-sized buffer. Every flush here finishes before it returns, so LVGL would never draw into a
    // second one while the first is on its way: it was 460 KB of PSRAM doing nothing.
    size_t lv_buffer_size = board.width() * board.height() * sizeof(lv_color_t);
    buf = (lv_color_t *)ps_malloc(lv_buffer_size);
    assert(buf);

    lv_disp_draw_buf_init(&draw_buf, buf, NULL, board.width() * board.height());

    /*Initialize the display*/
    lv_disp_drv_init(&disp_drv);
    /* display resolution */
    disp_drv.hor_res = board.width();
    disp_drv.ver_res = board.height();
    disp_drv.flush_cb = disp_flush;
    disp_drv.draw_buf = &draw_buf;
    disp_drv.full_refresh = 0;
    disp_drv.direct_mode = board.supportsDirectMode();
    disp_drv.user_data = &board;
    lv_disp_drv_register(&disp_drv);

    lv_indev_drv_init(&indev_drv);
    indev_drv.type = LV_INDEV_TYPE_POINTER;
    indev_drv.read_cb = touchpad_read;
    indev_drv.user_data = &board;
    lv_indev_drv_register(&indev_drv);
}
