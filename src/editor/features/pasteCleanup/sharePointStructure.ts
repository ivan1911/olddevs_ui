"use client";

import type { PasteCleanupStep } from "./cleanPastedHtml.js";
import { buildNestedLists, type FlatListItem } from "./nestedLists.js";

/*
  SharePoint and Word Online (Word in the browser) put real structure on the clipboard, but in a
  shape the Schema cannot read as it is. There is no public capture to copy from; the shape below is
  what MIT-licensed editors quote from real copies (see the sources in
  `tests/editor-paste-cleanup-sharepoint.test.tsx`):

    <div class="OutlineElement Ltr">
      <p class="Paragraph" role="heading" aria-level="2">
        <span class="TextRun"><span class="NormalTextRun">Goals</span></span>
        <span class="EOP" data-ccp-props="{…}">&nbsp;</span>
      </p>
    </div>

    <div class="ListContainerWrapper">
      <ol class="NumberListStyle2" role="list" start="3">
        <li data-listid="2" data-aria-level="2" data-aria-posinset="3" role="listitem">
          <p class="Paragraph">…</p>
        </li>
      </ol>
    </div>

  Three things get in the Schema's way:

  1. A heading is a `<p>` with `role="heading"`, not an `<h2>`. The Schema would keep a plain
     paragraph.
  2. A list is not nested. EVERY item sits in its own `<ul>` / `<ol>` inside its own wrapper, and
     the level is only in `data-aria-level`. The Schema would keep a flat run of one-item lists.
  3. Every paragraph ends with an `EOP` span holding a non-breaking space. It is not text, but the
     Schema would keep the space (Word shows it as the paragraph mark).

  The `OutlineElement` divs and the `TextRun` spans are left alone: the Schema reads a `div` without
  a rule and a `span` without a mark as their content, which is what is wanted.
*/

/** HTML has six heading levels; a deeper `aria-level` stays a paragraph. */
const MAX_HEADING_LEVEL = 6;

/** `id` is `data-listid`: Word's identity of the list, shared by all its levels. */
interface ListItem extends FlatListItem {
  li: HTMLLIElement;
  /** The element the item travels in: its wrapper div, else its `ul` / `ol`. */
  block: Element;
}

/** A class list holds the token (`class="EOP SCXW1 BCX0"`). */
function hasClass(element: Element, name: string): boolean {
  return element.classList.contains(name);
}

/** The end-of-paragraph marker is not text: remove it, whatever comes after it. */
function removeEndOfParagraph(document: Document): void {
  for (const span of Array.from(document.body.querySelectorAll("span.EOP"))) {
    // A marker that carries real text (it never does) is unwrapped, not lost.
    if (/\S/.test(span.textContent ?? "")) span.replaceWith(...span.childNodes);
    else span.remove();
  }
}

/**
 * `<p role="heading" aria-level="N">` becomes `<hN>`, and the Schema then applies its own heading
 * rules, as to an `<hN>` from any other paste: H5 and H6 become paragraphs, H1 needs `heading1`.
 */
function convertHeadings(document: Document): void {
  for (const paragraph of Array.from(
    document.body.querySelectorAll<HTMLElement>('p[role="heading"][aria-level]')
  )) {
    // A heading inside a list item is the item's text: the item stays a paragraph.
    if (paragraph.closest("li")) continue;
    const level = Number.parseInt(paragraph.getAttribute("aria-level") ?? "", 10);
    if (!Number.isInteger(level) || level < 1 || level > MAX_HEADING_LEVEL) continue;
    const heading = document.createElement(`h${level}`);
    heading.append(...paragraph.childNodes);
    paragraph.replaceWith(heading);
  }
}

function readItem(li: HTMLLIElement): ListItem | null {
  const list = li.parentElement;
  if (!list || (list.tagName !== "UL" && list.tagName !== "OL")) return null;
  const kind = list.tagName === "OL" ? "ol" : "ul";
  const wrapper = list.parentElement;
  const level = Number.parseInt(li.getAttribute("data-aria-level") ?? "", 10);
  const position = Number.parseInt(li.getAttribute("data-aria-posinset") ?? "", 10);
  const start = Number.parseInt(list.getAttribute("start") ?? "", 10);
  return {
    li,
    block: wrapper && hasClass(wrapper, "ListContainerWrapper") ? wrapper : list,
    id: li.getAttribute("data-listid"),
    level: level >= 1 ? level : 1,
    kind,
    // The position is the number Word shows; the `start` of a one-item list says the same.
    number: kind === "ol" ? (position >= 1 ? position : start >= 1 ? start : 1) : null,
  };
}

/** The content of an item: its paragraphs as they are, or its bare inline content in one. */
function itemContent(li: HTMLLIElement, document: Document): Node[] {
  if (li.querySelector(":scope > p")) return Array.from(li.childNodes);
  const paragraph = document.createElement("p");
  paragraph.append(...li.childNodes);
  return [paragraph];
}

function rebuildLists(document: Document): void {
  const items = Array.from(document.body.querySelectorAll<HTMLLIElement>("li[data-listid]"))
    .map(readItem)
    .filter((item): item is ListItem => item !== null);
  // Runs of items that follow each other: anything between two blocks ends a list.
  const runs: ListItem[][] = [];
  for (const item of items) {
    const run = runs.at(-1);
    const last = run?.at(-1);
    if (
      run &&
      last &&
      (last.block === item.block || last.block.nextElementSibling === item.block)
    ) {
      run.push(item);
    } else runs.push([item]);
  }
  for (const run of runs) {
    const blocks = [...new Set(run.map((item) => item.block))];
    blocks[0]!.replaceWith(
      buildNestedLists(run, (item) => itemContent(item.li, document), document)
    );
    for (const block of blocks.slice(1)) block.remove();
  }
}

export const sharePointStructure: PasteCleanupStep = {
  name: "sharePointStructure",
  applies: (sources) => sources.sharePoint,
  run(document) {
    removeContentControlBoundaries(document);
    removeEndOfParagraph(document);
    unwrapChunks(document);
    convertHeadings(document);
    rebuildLists(document);
  },
};

/** Word's own render classes (`SCXW124463699`, `BCX0`): they carry no meaning of the document. */
const RENDER_CLASS = /^(?:SCXW|BCX)\d+$/;

/**
 * A long copy from Word for the web is split into chunk `div`s of about twenty Blocks, which carry
 * only the render classes. A list that crosses a chunk boundary would look like two runs, and its
 * items after the boundary would start a new list at the top level. The chunks are unwrapped first.
 */
function unwrapChunks(document: Document): void {
  for (const div of Array.from(document.body.querySelectorAll("div"))) {
    const classes = Array.from(div.classList);
    if (classes.length > 0 && classes.every((name) => RENDER_CLASS.test(name))) {
      div.replaceWith(...div.childNodes);
    }
  }
}

/**
 * A content control (a table of contents, a form field) is copied as its boundaries only: spans of
 * class `ContentControlBoundarySink` holding a zero-width space, while the entries stay in Word. A
 * paragraph left with nothing but such boundaries goes; a boundary next to real text goes alone.
 */
function removeContentControlBoundaries(document: Document): void {
  const paragraphs = new Set<Element>();
  for (const sink of Array.from(document.body.querySelectorAll(".ContentControlBoundarySink"))) {
    const paragraph = sink.closest("p");
    if (paragraph) paragraphs.add(paragraph);
    sink.remove();
  }
  for (const paragraph of paragraphs) {
    const text = (paragraph.textContent ?? "").replace(/[\s\u200b]/g, "");
    if (text === "" && !paragraph.querySelector("img, br")) paragraph.remove();
  }
}
