/**
 * Document headings for the table of contents (`RichTextToc`, ADR-0066).
 *
 * They are read from the target's DOM, not from the `html` string: one path serves the View,
 * the Editor, and the JSON envelope, and a jump needs a live node anyway.
 *
 * A module with no React and no engine: only DOM traversal.
 */

/** A heading in the table of contents. */
export interface TocHeading {
  /** The heading node in the Document: a jump leads to it. */
  element: HTMLElement;
  /** Item text: the heading's text without markup. */
  text: string;
  /** Level from the tag: 1 for `h1` … 4 for `h4`. */
  level: number;
  /**
   * Depth relative to the largest heading in the Document, which has depth 0. The item's
   * indent and the stroke length are computed from it, not from the level. Otherwise a
   * Document whose largest heading is an H2 would start with an empty step.
   */
  depth: number;
}

const HEADING = "h1, h2, h3, h4";

/**
 * A Wrapper is the only container whose headings go into the table of contents.
 *
 * Layout columns are not: two headings at the same height in adjacent columns would
 * confuse the highlight of the current section, and the reading order "left column,
 * then right column" means nothing to the reader. Islands and custom Blocks are not
 * included either: their content is part of the Block, not the Document's structure.
 */
const WRAPPER = 'div[data-block="wrapper"]';

/**
 * The Document's root inside the target. For the View, this is the container itself;
 * for the Editor, the Document sits deeper, inside the engine's node. The Toolbar and
 * the status line are outside it.
 */
export function documentRoot(target: HTMLElement): HTMLElement {
  return target.querySelector<HTMLElement>(".ProseMirror") ?? target;
}

/**
 * The heading's name for the list: its text without the numbers of footnote references (ADR-0076),
 * which belong to the text, not to the name. The element itself is left alone.
 */
function headingText(heading: Element): string {
  if (!heading.querySelector("sup[data-footnote-ref]")) return heading.textContent?.trim() ?? "";
  const copy = heading.cloneNode(true) as Element;
  for (const reference of Array.from(copy.querySelectorAll("sup[data-footnote-ref]"))) {
    reference.remove();
  }
  return copy.textContent?.trim() ?? "";
}

/** The heading is at the top level of the Document, or only inside Wrappers. */
function isStructural(heading: Element, root: HTMLElement): boolean {
  for (let node = heading.parentElement; node && node !== root; node = node.parentElement) {
    if (!node.matches(WRAPPER)) return false;
  }
  return true;
}

/**
 * The Document's headings in reading order. `only` sets which levels (1–4) are taken:
 * the others do not get into the list, and the depth (`depth`) is computed from the
 * largest of the remaining levels. Without it, all levels are taken.
 */
export function collectHeadings(target: HTMLElement, only?: readonly number[]): TocHeading[] {
  const root = documentRoot(target);
  // An empty heading (the author has only just started it in the Editor) is not an item:
  // a button without text would have no name, and the strip would get an extra stroke.
  const found = [...root.querySelectorAll<HTMLElement>(HEADING)].filter(
    (heading) =>
      isStructural(heading, root) &&
      headingText(heading) &&
      (!only || only.includes(Number(heading.tagName[1])))
  );
  const levels = found.map((heading) => Number(heading.tagName[1]));
  const top = Math.min(...levels);
  return found.map((element, index) => ({
    element,
    text: headingText(element),
    level: levels[index]!,
    depth: levels[index]! - top,
  }));
}
