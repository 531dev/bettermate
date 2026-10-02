#ifndef DISPLAY_UI_H
#define DISPLAY_UI_H

// The class the Controller builds as the display UI. BETTERMATE_UI selects the BetterMate interface; without it
// the stock GaggiMate interface is built unchanged.
#ifdef BETTERMATE_UI
#include <display/ui/bettermate/BetterMateUI.h>
using DisplayUI = BetterMateUI;
#else
#include <display/ui/default/DefaultUI.h>
using DisplayUI = DefaultUI;
#endif

#endif // DISPLAY_UI_H
