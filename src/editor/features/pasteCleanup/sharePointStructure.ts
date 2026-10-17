"use client";

import type { PasteCleanupStep } from "./cleanPastedHtml.js";

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

/** Keep to the levels the Schema has (`h1`–`h4`; without the `heading1` Tool the Schema drops `h1`). */
const MAX_HEADING_LEVEL = 4;

interface ListItem {
  li: HTMLLIElement;
  /** The element the item travels in: its wrapper div, else its `ul` / `ol`. */
  block: Element;
  /** `data-listid`: Word's identity of the list, shared by all its levels. */
  id: string | null;
  level: number;
  kind: "ul" | "ol";
  /** The number the item shows, for a numbered list; `null` for a bullet. */
  number: number | null;
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

/** `<p role="heading" aria-level="N">` becomes `<hN>`; the Schema then applies its own heading rules. */
function convertHeadings(document: Document): void {
  for (const paragraph of Array.from(
    document.body.querySelectorAll<HTMLElement>('p[role="heading"][aria-level]')
  )) {
    // A heading inside a list item is the item's text: the item stays a paragraph.
    if (paragraph.closest("li")) continue;
    const level = Number.parseInt(paragraph.getAttribute("aria-level") ?? "", 10);
    if (!Number.isInteger(level) || level < 1) continue;
    const heading = document.createElement(`h${Math.min(level, MAX_HEADING_LEVEL)}`);
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

/**
 * Build the nested lists of one run of consecutive items. A deeper level goes into the last item of
 * the list above it; a different kind or a different Word list on the same level starts a new list.
 */
function buildLists(items: ListItem[], document: Document): DocumentFragment {
  const root = document.createDocumentFragment();
  const stack: { level: number; kind: "ul" | "ol"; id: string | null; list: HTMLElement }[] = [];
  for (const item of items) {
    while (stack.length > 0 && stack.at(-1)!.level > item.level) stack.pop();
    const top = stack.at(-1);
    if (top && top.level === item.level && (top.kind !== item.kind || top.id !== item.id)) {
      stack.pop();
    }
    if (stack.length === 0 || stack.at(-1)!.level < item.level) {
      const list = document.createElement(item.kind);
      if (item.number !== null && item.number > 1) list.setAttribute("start", String(item.number));
      (stack.at(-1)?.list.lastElementChild ?? root).appendChild(list);
      stack.push({ level: item.level, kind: item.kind, id: item.id, list });
    }
    const li = document.createElement("li");
    li.append(...itemContent(item.li, document));
    stack.at(-1)!.list.append(li);
  }
  return root;
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
    blocks[0]!.replaceWith(buildLists(run, document));
    for (const block of blocks.slice(1)) block.remove();
  }
}

export const sharePointStructure: PasteCleanupStep = {
  name: "sharePointStructure",
  applies: (sources) => sources.sharePoint,
  run(document) {
    removeEndOfParagraph(document);
    convertHeadings(document);
    rebuildLists(document);
  },
};
