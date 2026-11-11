A pill-shaped choice of two or three, and the mode bar built on the same idea: the selected item is `ink`.

- Use Segmented for mutually exclusive settings that apply at once: stop by time or weight, favourite profiles, theme.
- Two or three items, each one word. More than three becomes a ListRow that opens a list.
- On a tile, the track is `surface-2`; inside a cell use `bm-seg--on-tile`.
- The mode bar carries the machine's five modes with icon and label. It is state, not navigation: pressing a mode changes what the machine is doing. While a process runs, lock every mode except Steam with `disabled`.

Mark the selected item with `aria-pressed="true"`.
