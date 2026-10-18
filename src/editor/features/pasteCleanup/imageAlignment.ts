"use client";

import { ALIGNED_WIDTHS, type ImageAlign } from "../image/imageLayout.js";
import type { PasteCleanupStep } from "./cleanPastedHtml.js";
import { lastValue, parseDeclarations } from "./cssDeclarations.js";

/*
  Where a picture stood in the text (ADR-0081, decision 10). Word writes the side of a picture the
  text wraps as `align="left"` (with `hspace`) on the `<img>`; a web page writes it as `float` in the
  `style`, or as the same obsolete `align`. WordPress writes it as a class, `alignleft` or `alignright`,
  on the `<img>` (the classic editor) or on the `<figure>` (the block editor), and keeps the float in the
  theme's stylesheet, which the clipboard does not carry (OLDSUI-314). The Schema keeps no `style`, so
  the side is lost unless it is read here and written as the `data-align` the image node reads
  (`image.ts`).

  Unlike the other steps, this one is not for one office application: a float on a picture comes
  from a web page as often as from Word, and a page is not the source of the other steps' junk.
  So it has its own sign (`PasteSources.imageAlignment`): a picture, or a figure, that names a side
  or a wrap. A clipboard without one comes back as the same string, with no parse.

  The width the picture had in its source is kept only as far as the presets go. A share
  (`width: 40%`) goes to the nearest preset that leaves room for text; a size in pixels, points or
  anything else cannot be compared with a Document of unknown width, so the picture gets 50%, the
  same the commands give an image that is aligned without a width. 100% has no room to wrap, so
  it goes to 75%.
*/

/** What the style or the attributes of `element` say about the side: a side, `none` or silence. */
function sideOf(element: Element): ImageAlign | "none" | null {
  const style = parseDeclarations(element.getAttribute("style") ?? "");
  // Word's "wrap text: none" (in line with the text) is stronger than a side it left in the same tag.
  if (lastValue(style, "mso-wrap-style")?.toLowerCase() === "none") return "none";
  const float = lastValue(style, "float")?.toLowerCase();
  if (float === "left" || float === "right") return float;
  const align = element.getAttribute("align")?.trim().toLowerCase();
  if (align === "left" || align === "right") return align;
  // The class is the weakest: in the source the inline style and the attribute win over the stylesheet.
  // `aligncenter` and `alignnone` name no side, as `align="center"` does not.
  const classes = (element.getAttribute("class") ?? "").toLowerCase().split(/\s+/);
  if (classes.includes("alignleft")) return "left";
  return classes.includes("alignright") ? "right" : null;
}

/** The share of the container a source width names, in percent, or `null` for any other size. */
function percentOf(element: Element): number | null {
  const style = parseDeclarations(element.getAttribute("style") ?? "");
  const width = lastValue(style, "width") ?? element.getAttribute("width") ?? "";
  const match = /^\s*(\d+(?:\.\d+)?)\s*%\s*$/.exec(width);
  return match ? Number(match[1]) : null;
}

/** The preset closest to `percent` among those an aligned image can have. */
function nearestAligned(percent: number): string {
  return ALIGNED_WIDTHS.reduce((best, width) =>
    Math.abs(Number(width) - percent) < Math.abs(Number(best) - percent) ? width : best
  );
}

export const imageAlignment: PasteCleanupStep = {
  name: "imageAlignment",
  applies: (sources) => sources.imageAlignment,
  run(document) {
    for (const img of Array.from(document.body.querySelectorAll("img"))) {
      const figure = img.parentElement?.tagName === "FIGURE" ? img.parentElement : null;
      // The picture's own tag is closer to the picture than the figure around it.
      const sides = [img, figure].flatMap((element) => (element ? [sideOf(element)] : []));
      if (sides.includes("none")) continue;
      const side = sides.find((value): value is ImageAlign => value !== null);
      if (!side) continue;
      (figure ?? img).setAttribute("data-align", side);
      // A width the markup already carries as a preset (the Editor's own copy) is not a source width.
      if (img.hasAttribute("data-width")) continue;
      const percent = percentOf(img) ?? (figure ? percentOf(figure) : null);
      img.setAttribute("data-width", percent === null ? "50" : nearestAligned(percent));
    }
  },
};
