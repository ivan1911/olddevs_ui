"use client";

import type { EditorMarkerName } from "../../styles/palette.js";
import type { CssColor } from "./cssColor.js";

/*
  Which marker an Office background stands for. The kit does not guess a color for the author
  anywhere else (a `style` from foreign HTML is dropped, see `styleExtensions.ts`), so this is a
  deliberate, narrow exception: an Office highlight or fill means "this is marked", and the nearest
  marker keeps that meaning where `#F8CBAD` would be lost.

  THE HUES. They come from the kit's own marker tokens (`--od-marker-*` in `styles.css`), measured in
  HSL; the bright ones have one value in all themes, the older six have a dark and a light one:

    red      #6e3630 / #ffe2dd    5° and 8°
    brown    #603b2c / #eee0da   20° and 20°
    orange   #854c1d / #fadec9   28° and 27°
    yellow   #ffea80             51°
    green    #aaff80            100°
    blue     #28456c / #d3e5ef  213° and 201°
    purple   #492f64 / #e8deee  270° and 278°
    pink     #ff80bf            330°
    gray     #5a5a5a / #e3e2e0   no hue

  A source color gets the marker whose hue is nearest. The borders below are the midpoints between
  neighbouring marker hues, moved by hand in two places so that the pure primaries of Word's
  highlighter land where a person would put them: pure blue (240°) stays `blue`, and magenta (300°) goes
  to `pink` (the bright marker of the kit), not to `purple`.

  BROWN AND ORANGE share a hue (20° to 28°). The kit's tokens tell them apart by saturation: the
  brown ones are muted (HSL saturation 0.37), the orange ones are strong (0.64 and 0.83). The same
  rule is used here, so that each of the eighteen token values maps back to its own marker
  (the test checks it).

  GRAY is anything without a visible hue: the difference between the strongest and the weakest channel
  is under 6% of the range. A pale tint of Excel's palette (`#D9E2F3`, 10%) is still blue.

  WHITE, BLACK AND TRANSPARENT are no marker. "White" is every color lighter than 96%, which also
  catches the near-white end-of-paragraph backgrounds of Word Online and the `#ffffff` Docs writes
  on spans. "Black" is darker than 10%: dark text on it would not read.
*/

/** Where a hue band ends (degrees, exclusive) and the marker of the band. */
const HUE_BANDS: readonly (readonly [
  end: number,
  marker: EditorMarkerName | "warm" | "magenta",
])[] = [
  [15, "red"],
  // Brown or orange: told apart by saturation below.
  [39.5, "warm"],
  [75.5, "yellow"],
  [153.5, "green"],
  [241, "blue"],
  [298, "purple"],
  // Pink, except a dark magenta (Word's "violet" highlight is #800080), which is `purple`.
  [345, "magenta"],
  [360, "red"],
];

const NO_HUE_CHROMA = 0.06;
const NEAR_WHITE = 0.96;
const NEAR_BLACK = 0.1;
const WARM_STRONG = 0.5;
const DARK_MAGENTA = 0.3;
/** A color this transparent is not a fill. */
const FAINT_ALPHA = 0.1;

/** The marker nearest to a background color, or `null` when the color is white, black or transparent. */
export function markerForColor(color: CssColor): EditorMarkerName | null {
  if (color.alpha < FAINT_ALPHA) return null;
  const red = color.red / 255;
  const green = color.green / 255;
  const blue = color.blue / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const chroma = max - min;
  const lightness = (max + min) / 2;
  if (lightness >= NEAR_WHITE || lightness <= NEAR_BLACK) return null;
  if (chroma < NO_HUE_CHROMA) return "gray";

  let hue: number;
  if (max === red) hue = ((green - blue) / chroma + 6) % 6;
  else if (max === green) hue = (blue - red) / chroma + 2;
  else hue = (red - green) / chroma + 4;
  hue *= 60;
  const saturation = chroma / (1 - Math.abs(2 * lightness - 1));

  const band = HUE_BANDS.find(([end]) => hue < end)![1];
  if (band === "warm") return saturation >= WARM_STRONG ? "orange" : "brown";
  if (band === "magenta") return lightness < DARK_MAGENTA ? "purple" : "pink";
  return band;
}
