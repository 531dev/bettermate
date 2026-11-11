The machine's round display inside a web tile: the same tick ring, with one reading in the middle.

- The centre holds an `eyebrow`, one `metric-xl` reading and one line of `body-sm`. Nothing else.
- Follow the table in Web UI for what each machine state shows.
- Width is 264 px on a phone and up to 300 px on desktop. The ring scales; the centre text does not.
- Ticks recolour in `duration-fast`. The reading snaps.

Markup: `.bm-dial` with `data-ring='{"left":[value,target,"heat"],"right":[value,target,"primary"]}'` and a `.bm-dial__center` child; `BetterMate.hydrate()` draws the ring.
