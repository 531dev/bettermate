# Design revision of 2026-11-16: lanes

The design system was revised on 2026-11-16 (after a review against Stacks) and re-imported into `design/` on
2026-11-17 (`b85b91aa`). `git diff aa609766 b85b91aa -- design/` shows exactly what changed in the design;
`tokens.json` `meta.changes` summarises the token side. Tokens, fonts and `tokens.css` are already regenerated
and committed. These lanes bring the code in line. Each lane commits to `ui/v2` as it lands (never push), keeps
its checks passing, and adds what it decided to `STATUS.md` section 3.

What the revision says, in the designer's words:

- Contrast: cobalt hover in Dark now steps darker (white on it 3.6:1 to 6.1:1); the ActionBanner's second line is
  no longer faded.
- Inputs: every field has a visible border; instructions moved out of placeholders into help text.
- Locked modes: readable at 4.1:1 instead of 1.9:1, and Steam stays available.
- Charts: lines differ by dash and weight, each is labelled at its end, the four colours step in lightness.
- Warnings: every warning chip carries a triangle glyph so it cannot be confused with heating.
- Touch and states: every control has a 44 px hit area and hover, pressed, focus and disabled states.
- Real content: favourites scroll instead of squeezing, pages work at 320 px, the display font spec covers
  accents like "Crème".
- Stylesheet: every font size and padding comes from the tokens.
- Added: Notice, Toast, EmptyState, Loader, Dialog, Menu, Tooltip, Select, NumberField, Chart, ModeBar, Nav,
  Tile, a States matrix in three themes, product states for web and display; sections Accessibility, Content and
  Product states.

## Decided by the user — do not follow the design here

1. **Standby has no WAKE pill** (`aa609766`): a tap anywhere wakes. The DisplayStandby card still draws WAKE.
2. **The Menu's exception glyph stays at 6 o'clock** (`61829b3b`). The design puts the slot at 12 o'clock;
   other screens keep 12 o'clock as they are.
3. **Steam stays locked on the web while a process runs.** A mode change mid-shot sets the steam target (and the
   web handler stops the process). Apply the new locked look (`surface-2`, `ink-faint`, focusable with
   `aria-disabled`, reason given) to every mode, Steam included.

## Lane D — display (`src/display/ui/bettermate/`, `scripts/verify_display_*.py`)

Read `design/reference/round-display.md`, `motion.md`, `product-states.md`, the `Display*` component READMEs,
then `docs/v2/DISPLAY.md`.

1. **Ellipsis.** The fonts now carry `…` (U+2026). Replace the three-dot cut with it everywhere (`Ui.cpp` `fit`,
   `ProfilesScreen`, `AdjustScreen`, `ShotScreen`) and update the checks that assert `...`.
2. **Characters outside the font.** Replace a character the face lacks with its base letter before drawing
   (`ł` to `l`, `ş` to `s`, and so on for Latin Extended-A); never draw an empty box.
3. **Content limits** (round-display.md, Content limits; the cards' Content sections): Brew's profile name 18
   beside its chevron; Profiles' name 12 (cut at 11); the phase line becomes "N phases" past 25 characters; at
   most three warnings a screen and "+1 more" (today it is two and a count); Standby's date `THU 12 NOV`,
   24-hour clock, and the line "Update 1.8.0 is ready" when an update waits (version if known).
4. **Command pending.** START pressed and not confirmed after the 2-frame press: the quiet pill (`surface-2`,
   STARTING in `ink-muted`), handle hidden. Confirmation cuts back; after 2 s with none START returns and the
   display raises a warning "The controller did not answer". No comet. Motion budget: 5%.
5. **Fault screen** for a fault that blocks brewing: no ring, ERROR chip, the fault's name in `screen-title`, up
   to two `screen-body` lines, RESTART or RETRY in `primary` only when pressing it can help;
   `triangle-alert` in `danger` in the slot. Replaces today's "TEMPERATURE ERROR" on Standby where that applies.
   Work out from `Controller`/`SystemState` which faults block brewing.
6. **Updating screen** while firmware installs: single ring with progress in `ink` (walks a tick per 1.3%),
   percentage in `screen-hero` with `%` under, UPDATING label, "Keep the machine on" and the version; no pill, no
   handle, cannot be left. Find where OTA progress is reported; if the display gets no progress, say so in
   `STATUS.md` and draw what it can.
7. **Wi-Fi setup screen** while the access point is up for setup: Information's QR layout headed JOIN THIS
   WI-FI with the machine's own network name, the address and SCAN TO SET UP below; no action.
8. Keep every `verify_display_*.py` passing (add cases for 4 to 7, with captures under `docs/display/v2/`), and
   the motion budgets. Run the checks in parallel with `SIM_PORT_BASE` set apart; never rebuild `display-sim`
   while one runs.

## Lane W1 — web fixes (`web/`, `scripts/verify_web_ui.mjs`)

Read `design/reference/web-ui.md`, `README.md` (Color, Shape and layout, States and accessibility),
`accessibility.md`, `content.md`, then `docs/v2/WEB.md`.

1. **Re-sync `web/src/design/bm.css` Part 1** with the new `design/reference/components/bundle.css` (its header
   says how). The new bundle takes font sizes and paddings from tokens and adds hover/pressed fills, the
   `button-lg` style, 44 px hit areas, disabled as `surface-2` + `ink-faint` (the `disabled` opacity token is
   deprecated: remove every use of it and of opacity for state).
2. **Contrast.** ActionBanner second line at full strength; hover fills from `primary-hover`, `ink-hover`,
   `control-hover`, `danger-soft-hover`, `state-hover`.
3. **Inputs.** Every input, select and textarea has a `line-strong` border; placeholders are never instructions:
   move them into help text linked with `aria-describedby`.
4. **Locked modes** in the mode bar: the readable locked look, focusable, with the reason (decision 3 above).
5. **Charts** (`components/Chart/README.md`): pressure solid 2.5 px, temperature solid 2 px, flow dashed 6 4,
   weight dotted 1 5 round caps; an end label with the last value and unit; legend only over 480 px wide and as
   line samples; never drawn on `surface-2`; `role="img"` with the label the README gives.
6. **Warning chips** always carry `triangle-alert`, danger chips `circle-alert`, at 14 px.
7. **Touch and states**: 44 px hit area on every control, hover/pressed/focus/disabled everywhere.
8. **Real content**: favourites scroll horizontally instead of squeezing; every page at 320 px with nothing
   clipped and no sideways scroll; times are 24-hour (`Today 14:41`).
9. Keep `scripts/verify_web_ui.mjs` and `npm run lint:check` passing; extend the check for the above.

## Lane W2 — web components and product states (after W1; it shares `bm.css`)

1. Build the new cards as shared components where the app needs them, with the class recipes from
   `bundle.css`: Notice, Toast (one region, 5 s / 8 s with action), EmptyState, Loader, Dialog, Menu, Tooltip,
   Select, NumberField, ModeBar, Nav, Tile. Replace the app's ad-hoc equivalents (`Popover`, confirm menus, the
   mode bar, the sidebar) where the design's version covers them. List them in `docs/v2/WEB.md`.
2. Product states (`design/reference/product-states.md`, the WebStates card): first reading (`—`, no skeleton),
   Connecting (Notice with Loader), Offline (danger Notice, OFFLINE chip, TRY AGAIN, modes locked, Save disabled
   with reason), command pending (STARTING/STOPPING with Loader, 2 s limit then Toast), blocking fault, update
   ready (Notice in Settings), updating, nothing to list, saving. The one `role="status"` region and the
   announcements in `accessibility.md`.
3. Keep `scripts/verify_web_ui.mjs` passing and extend it for these states.
