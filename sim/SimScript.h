// Scripted input for the simulator, so a screen can be reached and captured without a person at the mouse:
//
//   program --script "wait 3000; tap 240 400; wait 500; shot brew.bmp; quit"
//
// Points are in the design's 480 px box on every panel: with SIM_PANEL_SIZE=466 the simulator moves them (and
// what `layout` reports) by the 7 px the stage overhangs, so one script serves both sizes.
//
//   wait <ms>                      let the firmware run
//   tap <x> <y>                    press and release at a point
//   hold <x> <y> <ms>              press, keep it down, release
//   press <x> <y> / release        the two halves of a hold, with other steps in between
//   swipe <x1> <y1> <x2> <y2> [ms] drag from one point to another (default 250 ms)
//   key <1|2> <down|up>            the controller board's brew / steam inputs
//   theme <n>                      set the display theme setting (0 dark, 1 light, 2 AMOLED)
//   clock <12|24> [tz]             set the clock setting; with a POSIX time zone ("SIM-5" is five hours ahead
//                                  of UTC) the simulator's local time moves there too, to reach an hour
//   controller <connected|disconnected> simulate controller link availability
//   protocol <version>             report a controller protocol version (the sim uses 3)
//   error <code>                   report a controller error (0 clears, 4 is temperature runaway)
//   autotune                       start a mocked autotune (finishes after 1.5 s)
//   update                         enter the OTA updating state
//   update-start <parts>           start an OTA update of 1 or 2 parts, as the web plugin does
//   update-phase <phase>           report an OTA phase: 1 display firmware, 3 controller firmware, 4 done, 5 failed
//   update-progress <percent>      report OTA progress of the part being installed, as the OTA plugin does
//   update-ready <version>         report that the update check found <version>
//   unanswered <0|1>               the controller does not answer START (the press goes nowhere)
//   pressure-sensor <0|1>          change the pressure capability (single/dual rings)
//   scale <0|1>                    stop/resume mock scale telemetry (health expires after 1.5 s)
//   weight <grams>                 set the mock scale reading
//   pumped <ml>                    report water pumped since the last tare, as a controller with a dimmed pump
//                                  does (the mock reports none by itself; a start or a stop tares it)
//   wifi <sta|ap|ap-open|disconnected> inject network UI state for QR checks
//   mode <standby|brew|steam|water|grind> change the machine's mode, as the web UI would
//   panel <amoled|lcd>             pretend the panel is an AMOLED (Standby rests after 30 s) or not
//   expect screen <name>           check the screen on the glass (standby, brew, shot, steam, water, grind, menu,
//                                  profiles, adjust, sheet, warnings, info, fault, updating, setup); fail fast
//   expect <mode|active> <n>       check MODE_* or process active (0/1)
//   expect <temperature|duration|target-weight> <n> check the selected profile (rounded)
//   expect setpoint <degrees>      check the current mode's temperature target
//   expect <grind-active|grind-duration|grind-weight> <n> check grinding, seconds, or tenths of a gram
//   expect <text|hidden> <label>    check whether an exact label or reading is visible on the real LVGL screen
//   shot <path>                    write a BMP of the current frame, in panel pixels
//   layout <path>                  write the screen, the ring and every visible object as JSON lines
//   redraw <path>                  write every repaint since the last redraw step (time, pixels) as JSON lines
//   quit                           leave the simulator
#pragma once

#include <string>
#include <utility>
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
    enum class Kind {
        Wait,
        Pointer,
        Key,
        Theme,
        Clock,
        Connection,
        Protocol,
        Error,
        Autotune,
        Update,
        PressureSensor,
        Scale,
        Weight,
        Pumped,
        Wifi,
        Panel,
        Unanswered,
        UpdateReady,
        UpdateStart,
        UpdatePhase,
        UpdateProgress,
        Mode,
        Expect,
        ExpectText,
        Shot,
        Layout,
        Redraw,
        Quit
    };
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
    std::pair<int, int> held{0, 0};
    size_t next = 0;
    unsigned long resumeAt = 0;
};
