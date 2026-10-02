# Design reference

These files are unchanged copies of the design system artifact `NAmDJMSSupMJrSdiDDBS2H`, recovered from the
previous session's local export on 2026-10-02. Keep them as reference sources; change the implementation rather
than editing them. The previews' `/_blob/` URLs belong to the artifact; the actual fonts, icons and logos are
already under `design/`.

`design/tokens.json` is authoritative for font weights: display title 600, body 400. The round-display document's
500 weights were superseded by the user's choice of the tokens.

The user chose the stock gauge scales (0–160 °C and 0–16 bar) and target markers. Preserve the stock 300°
temperature ring when the controller has no pressure sensor. These behavior choices take precedence over the
static Brew preview.
