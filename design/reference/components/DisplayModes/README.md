Steam, Water and Grind share one layout: the target between minus and plus on the centre line, the live value above it, and a single ring.

- Steam and Water put temperature on the ring in `heat` with the target notch, and the live temperature above the target, in `heat-text` while heating.
- Steam has no pill, because steaming starts with the valve; a status line takes the pill's place. Water has START, then STOP.
- Grind puts progress on the ring in `ink`. With a scale, a TIME · WEIGHT row sits above the target.
- While Water or Grind runs, hide minus, plus, the row and the handle; show elapsed or remaining in their place. Do not grey them.
- Steam keeps the handle: leaving the mode is how steaming ends.

Provide: the mode, target and its unit, the live reading, progress for Grind, and whether a scale and a grinder are present.
