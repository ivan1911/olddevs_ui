"use client";

import type { PasteCleanupStep } from "./cleanPastedHtml.js";

/*
  A horizontal rule is not an element in Word. It is a paragraph border: the author draws a line
  above or below a paragraph (often an empty one), and Word writes it as CSS. The three browsers
  put the same rule on the clipboard in three shapes (all in the fixtures):

    Chrome, Firefox:  <div style='mso-element:para-border-div;border:none;border-bottom:solid windowtext 1.0pt'>
                        <p style='border:none;mso-border-bottom-alt:solid windowtext .75pt'>...</p></div>
    Safari:           <div style="border-width: medium medium 1pt; border-style: none none solid">
                        <p style="border: medium">...</p></div>

  Word wraps the paragraphs that share a border in one `div`; the border sits on the `div`, and the
  `mso-border-*-alt` copy on the paragraph is only for Word itself. Google Docs, when the document
  came from a .docx, writes the border on the paragraph: `<p style="border-bottom:solid #000000 0.75pt">`.

  The Schema keeps no paragraph border, so the line is lost. This step turns the top or bottom
  border into `<hr>`, which the `horizontalRule` Tool reads (without the Tool the Schema drops it and
  keeps the text). A border on a side (a quote bar) or on all four sides (a box) is not a rule and is
  left alone.
*/

type Side = "top" | "right" | "bottom" | "left";
const SIDES: readonly Side[] = ["top", "right", "bottom", "left"];

/** The border style words that draw a line. `none` and `hidden` do not. */
const LINE_STYLE =
  /^(?:solid|dash|dot|double|groove|ridge|inset|outset|wave|triple|thin-|thick-|three-d)/i;
const WIDTH = /^(?:thin|medium|thick|[\d.]+[a-z]*)$/i;
const ZERO_WIDTH = /^0*\.?0+[a-z]*$/i;

interface BorderSide {
  style: string;
  width: string | null;
}

/** The border of a `border-top`-like value: the style word and the width, in any order. */
function parseBorder(value: string): BorderSide {
  // A color such as `rgb(0, 0, 0)` has spaces inside: cut it out before splitting.
  const tokens = value
    .replace(/\([^)]*\)/g, "")
    .trim()
    .split(/\s+/);
  return {
    style: tokens.find((token) => LINE_STYLE.test(token)) ?? "none",
    width: tokens.find((token) => WIDTH.test(token)) ?? null,
  };
}

/** `border-width: a b c` / `border-style: a b c d` in the order of the CSS shorthand: top, right, bottom, left. */
function expandSides(value: string): string[] {
  const tokens = value
    .replace(/\([^)]*\)/g, "")
    .trim()
    .split(/\s+/);
  const [top = "", right = top, bottom = top, left = right] = tokens;
  return [top, right, bottom, left];
}

interface Borders {
  top: boolean;
  bottom: boolean;
  /** A visible left or right border: the paragraph is in a box or has a bar, not a rule. */
  bars: boolean;
}

/**
 * Which sides of the element have a visible border, read from its `style` attribute. The attribute
 * is read as text, not through `element.style`: the DOM drops the `mso-border-*-alt` declarations,
 * and Safari writes the border as separate `border-width` / `border-style` shorthands, so the
 * declarations are applied in order, the way the cascade would.
 */
function readBorders(element: Element): Borders {
  const css: Record<Side, BorderSide> = {
    top: { style: "none", width: null },
    right: { style: "none", width: null },
    bottom: { style: "none", width: null },
    left: { style: "none", width: null },
  };
  // Word's own copy of the border (`mso-border-bottom-alt`): visible when it names a line.
  const alt: Record<Side, boolean> = { top: false, right: false, bottom: false, left: false };
  for (const declaration of (element.getAttribute("style") ?? "").split(";")) {
    const colon = declaration.indexOf(":");
    if (colon < 0) continue;
    const name = declaration.slice(0, colon).trim().toLowerCase();
    const value = declaration.slice(colon + 1).trim();
    if (name === "border") {
      for (const side of SIDES) css[side] = parseBorder(value);
    } else if (name === "border-style") {
      expandSides(value).forEach((style, i) => {
        css[SIDES[i]!].style = LINE_STYLE.test(style) ? style : "none";
      });
    } else if (name === "border-width") {
      expandSides(value).forEach((width, i) => {
        css[SIDES[i]!].width = width;
      });
    } else if (name === "mso-border-alt") {
      for (const side of SIDES) alt[side] ||= parseBorder(value).style !== "none";
    } else {
      const side = SIDES.find(
        (candidate) => name === `border-${candidate}` || name === `mso-border-${candidate}-alt`
      );
      if (!side) continue;
      if (name.startsWith("mso-")) alt[side] ||= parseBorder(value).style !== "none";
      else css[side] = parseBorder(value);
    }
  }
  const visible = (side: Side) =>
    alt[side] ||
    (css[side].style !== "none" && !(css[side].width !== null && ZERO_WIDTH.test(css[side].width)));
  return {
    top: visible("top"),
    bottom: visible("bottom"),
    bars: visible("left") || visible("right"),
  };
}

const PARAGRAPH = "p, h1, h2, h3, h4, h5, h6";
const PARAGRAPH_TAGS = new Set(["P", "H1", "H2", "H3", "H4", "H5", "H6"]);
/** Content that makes a paragraph more than a blank line, even without text. */
const EMBEDDED = "img, table, hr, svg, video, iframe, object, embed";

/** A paragraph with no text and nothing embedded: only whitespace (`\s` includes the `&nbsp;` of Word). */
function isBlank(element: Element): boolean {
  return (
    PARAGRAPH_TAGS.has(element.tagName) &&
    !element.querySelector(EMBEDDED) &&
    !/[^\s\u200b]/.test(element.textContent ?? "")
  );
}

/**
 * Whether the element is a `div` Word made for paragraphs that share a border. Chrome and Firefox
 * mark it with `mso-element:para-border-div`; Safari drops the marker, so a `div` that holds only
 * paragraphs and has a border of its own is taken for the same thing.
 */
function isBorderGroup(div: Element): boolean {
  if (/mso-element:\s*para-border-div/i.test(div.getAttribute("style") ?? "")) return true;
  return (
    div.children.length > 0 &&
    Array.from(div.children).every((child) => PARAGRAPH_TAGS.has(child.tagName)) &&
    !/\S/.test(
      Array.from(div.childNodes, (node) => (node.nodeType === 3 ? node.textContent : "")).join("")
    )
  );
}

export const horizontalRules: PasteCleanupStep = {
  name: "horizontalRules",
  applies: (sources) => sources.word || sources.googleDocs,
  run(document, { sources }) {
    const rule = () => document.createElement("hr");
    // Paragraphs already settled by their border group: their own copy of the border is not a second line.
    const settled = new WeakSet<Element>();
    // Collected first: the changes below move paragraphs out of their groups.
    const paragraphs = Array.from(document.body.querySelectorAll(PARAGRAPH));

    for (const group of Array.from(document.body.querySelectorAll("div"))) {
      if (!isBorderGroup(group)) continue;
      const borders = readBorders(group);
      const hasBorder = borders.top || borders.bottom || borders.bars;
      if (!hasBorder && !/mso-element/i.test(group.getAttribute("style") ?? "")) continue;
      for (const child of group.children) settled.add(child);
      if (!hasBorder || borders.bars) continue;
      if (Array.from(group.children).every(isBlank)) {
        group.replaceWith(rule());
        continue;
      }
      group.replaceWith(
        ...(borders.top ? [rule()] : []),
        ...Array.from(group.childNodes),
        ...(borders.bottom ? [rule()] : [])
      );
    }

    for (const paragraph of paragraphs) {
      if (settled.has(paragraph)) continue;
      const borders = readBorders(paragraph);
      if (borders.bars || !(borders.top || borders.bottom)) continue;
      if (isBlank(paragraph)) {
        paragraph.replaceWith(rule());
        continue;
      }
      if (borders.top) paragraph.before(rule());
      if (borders.bottom) paragraph.after(rule());
    }

    if (sources.googleDocs) unwrapDocsLines(document);
  },
};

/**
 * Google Docs puts its own line ("Insert → Horizontal line") inside a paragraph:
 * `<p dir="ltr" style="…"><hr /></p>`. A paragraph cannot hold an `<hr>`, so the parser closes it
 * before the line and opens a bare one for the stray `</p>`: two empty paragraphs the author never
 * made. They go; the line is already an `<hr>`. The bare one after the line is the parser's (no
 * attributes), which keeps an author's own empty paragraph next to a line in place.
 */
function unwrapDocsLines(document: Document): void {
  for (const line of Array.from(document.body.querySelectorAll("hr"))) {
    const before = line.previousElementSibling;
    const after = line.nextElementSibling;
    if (!before || !after || before.tagName !== "P" || after.tagName !== "P") continue;
    if (!isBlank(before) || !isBlank(after) || after.hasAttributes()) continue;
    before.remove();
    after.remove();
  }
}
