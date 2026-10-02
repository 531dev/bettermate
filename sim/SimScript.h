// Scripted input for the simulator, so a screen can be reached and captured without a person at the mouse:
//
//   program --script "wait 3000; tap 240 400; wait 500; shot brew.bmp; quit"
//
//   wait <ms>                      let the firmware run
//   tap <x> <y>                    press and release at a point
//   hold <x> <y> <ms>              press, keep it down, release
//   swipe <x1> <y1> <x2> <y2> [ms] drag from one point to another (default 250 ms)
//   key <1|2> <down|up>            the controller board's brew / steam inputs
//   theme <n>                      set the display theme setting (0 dark, 1 light)
//   shot <path>                    write a BMP of the current frame
//   quit                           leave the simulator
#pragma once

#include <string>
#include <vector>

class SdlDriver;

class SimScript {
  public:
    // Returns false and prints the offending command when the text does not parse.
    bool parse(const char *text);
    bool empty() const { return steps.empty(); }

    // Run every step that is due. Returns true once the script asked to quit.
    bool run(SdlDriver *driver);

  private:
    enum class Kind { Wait, Pointer, Key, Theme, Shot, Quit };
    struct Step {
        Kind kind;
        int a = 0;
        int b = 0;
        bool flag = false;
        std::string path;
    };

    void pointer(int x, int y, bool pressed) { steps.push_back({Kind::Pointer, x, y, pressed, {}}); }
    void wait(int ms) { steps.push_back({Kind::Wait, ms, 0, false, {}}); }

    std::vector<Step> steps;
    size_t next = 0;
    unsigned long resumeAt = 0;
};
