"use client";

import type { EditorMarkerName } from "../../styles/palette.js";
import type { PasteCleanupStep } from "./cleanPastedHtml.js";
import { colorInBackground, parseCssColor, type CssColor } from "./cssColor.js";
import { lastValue, parseDeclarations, rewriteStyle } from "./cssDeclarations.js";
import { markerForColor } from "./markerForColor.js";

/*
  Office writes a highlight, a character shading, a paragraph shading and a cell fill as a background,
  and the Schema has no place for any of them: `style` is dropped (`styleExtensions.ts`), so the mark
  of the source is lost. Here a background becomes the `highlight` Mark with the nearest palette
  marker (`markerForColor.ts`):

    <span style='background:yellow;mso-highlight:yellow'>text</span>
      -> <span><mark data-color="yellow">text</mark></span>

  A paragraph or a cell is marked through its content: a Mark lives on text, so the text of the
  block is wrapped, block by block, never a block itself. A fill that wraps an empty cell marks
  nothing, and the cell stays as it was.

  THE TEXT COLOR IS NOT TOUCHED. It is not mapped to the palette on any paste, by the decision recorded
  in ADR-0075 and in `styleExtensions.ts`.

  WITHOUT THE `highlight` TOOL the Schema has no rule for `<mark data-color>`, and the text comes
  through without the Mark.
*/

/**
 * Elements whose background is not text marking: the page, a table, a row, a list or a plain `div`
 * (Word's page wrapper, Docs' root) would turn a whole document into one strip.
 */
const NOT_MARKED = new Set([
  "HTML",
  "BODY",
  "DIV",
  "TABLE",
  "THEAD",
  "TBODY",
  "TFOOT",
  "TR",
  "COLGROUP",
  "COL",
  "UL",
  "OL",
  "MARK",
  "PRE",
  "IMG",
  "BR",
  "HR",
]);

/** Elements that hold blocks: a marker goes into them, not around them. */
const BLOCK = new Set([
  "P",
  "DIV",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "UL",
  "OL",
  "LI",
  "TABLE",
  "THEAD",
  "TBODY",
  "TFOOT",
  "TR",
  "TD",
  "TH",
  "BLOCKQUOTE",
  "PRE",
  "HR",
]);

/** The `mso-list:Ignore` span of a Word list item: the list step reads and removes it. */
const LIST_MARKER = /mso-list\s*:\s*ignore/i;

/** The marker a background stands for, read from an element's `style` (or `bgcolor`), or `null`. */
function markerOf(element: Element): EditorMarkerName | null {
  const declarations = parseDeclarations(element.getAttribute("style") ?? "");
  const background = lastValue(declarations, "background", "background-color");
  let color: CssColor | null = background === null ? null : colorInBackground(background);
  // Word's highlighter writes the same color twice, as `background` and `mso-highlight`. Where
  // only the second is left (no `background`), its name is the color.
  if (background === null) {
    const highlight = lastValue(declarations, "mso-highlight");
    if (highlight !== null) color = parseCssColor(highlight);
  }
  // The attribute of old HTML, still written on cells by some exports.
  if (color === null && background === null) {
    const bgcolor = element.getAttribute("bgcolor");
    if (bgcolor) color = parseCssColor(bgcolor.startsWith("#") ? bgcolor : `#${bgcolor}`);
  }
  return color ? markerForColor(color) : null;
}

function isListMarker(node: Node): boolean {
  return (
    node.nodeType === Node.ELEMENT_NODE &&
    LIST_MARKER.test((node as Element).getAttribute("style") ?? "")
  );
}

/**
 * Put a `mark` around the inline content of an element. Runs of inline nodes are wrapped one by one;
 * a block child is entered, not wrapped. Comments (Word's `[if !supportLists]`) and the list marker
 * span end a run and stay outside, so the list step still finds them where it expects.
 */
function markContent(element: Element, marker: EditorMarkerName): void {
  const document = element.ownerDocument;
  let run: ChildNode[] = [];
  const flush = () => {
    if (run.some((node) => /\S/.test(node.textContent ?? ""))) {
      const mark = document.createElement("mark");
      mark.setAttribute("data-color", marker);
      run[0]!.before(mark);
      mark.append(...run);
    }
    run = [];
  };
  for (const child of Array.from(element.childNodes)) {
    if (child.nodeType === Node.COMMENT_NODE || isListMarker(child)) flush();
    else if (child.nodeType === Node.ELEMENT_NODE && BLOCK.has((child as Element).tagName)) {
      flush();
      markContent(child as Element, marker);
    } else run.push(child);
  }
  flush();
}

/**
 * Backgrounds on text, cells and paragraphs of Word, Excel, Google Docs and Google Sheets (and the
 * Office web apps, which write the same kind of inline background). HTML from any other source is
 * not read: a code highlighter's background on a web page is not an author's marker.
 */
export const backgroundMarkers: PasteCleanupStep = {
  name: "backgroundMarkers",
  applies: (sources) =>
    sources.word ||
    sources.excel ||
    sources.googleDocs ||
    sources.googleSheets ||
    sources.sharePoint,
  run(document) {
    // Outside in: an inner background lands inside the outer mark and wins there, as in the source.
    for (const element of document.body.querySelectorAll("[style], [bgcolor]")) {
      if (NOT_MARKED.has(element.tagName)) continue;
      const marker = markerOf(element);
      if (marker === null) continue;
      /*
        The text color goes together with the background. The Schema keeps a `style` only in the
        strict form of the author's color (a lone `color:#rrggbb`): `color:#C00000;background:yellow`
        is rejected whole, and with the background taken out it would suddenly pass. The cleanup
        must not keep a text color the Schema would have dropped (ADR-0075: no text color mapping).
      */
      rewriteStyle(element, ["background", "background-color", "mso-highlight", "color"]);
      markContent(element, marker);
    }
  },
};
