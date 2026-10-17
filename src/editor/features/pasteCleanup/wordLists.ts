"use client";

import type { PasteCleanupStep } from "./cleanPastedHtml.js";

/*
  Word does not put a list on the clipboard as a list. Every item is a paragraph, and the marker
  ("1.", "a.", "•") is literal text at its start:

    <p class=MsoListParagraph style='margin-left:1.0in;mso-list:l0 level2 lfo2'>
      <![if !supportLists]><span style='mso-list:Ignore'>a.<span>&nbsp;</span></span><![endif]>
      Sub-step a</p>

  `l0` is the list, `level2` the nesting level, and the kind of the list lives in the `<style>`
  block (`@list l0:level2 { mso-level-number-format: alpha-lower }`). Without this step the Schema
  keeps the paragraphs, and the frozen "a." stays in the text: reordering the items leaves the
  numbers wrong forever.

  Not every Word writes `mso-list`. Word 2007 on Windows, read through Firefox, keeps only the
  `MsoListParagraph*` class and the marker between `[if !supportLists]` comments; the level then
  comes from the paragraph's left margin. Both shapes are in the fixtures.
*/

/** `mso-list:l0 level2 lfo2`: the list id and the level. The `Ignore` value marks the marker span. */
const MSO_LIST = /mso-list:\s*(?:l(\d+)\s+)?level(\d+)/i;
const MSO_IGNORE = /mso-list:\s*ignore/i;
/** `MsoListParagraph`, `MsoListParagraphCxSpFirst`, older `MsoListBullet` and `MsoListNumber`. */
const LIST_CLASS = /\bMsoList/i;
/** A marker of a numbered item: `1.`, `a)`, `(iv)`. Anything else (`•`, `·`, `o`, `§`) is a bullet. */
const NUMBERED_MARKER = /^\(?([0-9]+|[a-z]{1,4})[.)]$/i;
const ROMAN = /^[ivxlcdm]+$/i;
/** Word indents each level by half an inch: 36pt. */
const LEVEL_INDENT_PT = 36;
const PT_PER_UNIT: Record<string, number> = {
  pt: 1,
  in: 72,
  cm: 72 / 2.54,
  mm: 72 / 25.4,
  px: 0.75,
};

interface ListItem {
  paragraph: HTMLParagraphElement;
  /** The Word list id (`l0`); `null` when Word wrote no `mso-list`. */
  id: string | null;
  level: number;
  kind: "ul" | "ol";
  /** The number of the item, from its marker or the list's start; `null` for a bullet. */
  number: number | null;
}

/** Remove the item's marker and return its text: `"1."`, `"•"`, or `null` when there is none. */
function takeMarker(paragraph: HTMLElement): string | null {
  const walker = paragraph.ownerDocument.createTreeWalker(paragraph, NodeFilter.SHOW_COMMENT);
  let start: Comment | null = null;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const data = (node as Comment).data.trim();
    if (!start && /^\[if !supportLists\]$/i.test(data)) start = node as Comment;
    else if (start && /^\[endif\]$/i.test(data)) {
      const range = paragraph.ownerDocument.createRange();
      range.setStartAfter(start);
      range.setEndBefore(node);
      const text = range.toString();
      range.deleteContents();
      start.remove();
      (node as Comment).remove();
      return normalizeMarker(text);
    }
  }
  const ignored = Array.from(paragraph.querySelectorAll<HTMLElement>("span[style]")).find((span) =>
    MSO_IGNORE.test(span.getAttribute("style") ?? "")
  );
  if (!ignored) return null;
  const text = ignored.textContent ?? "";
  ignored.remove();
  return normalizeMarker(text);
}

/** The marker without the non-breaking spaces and the tab Word puts after it. */
function normalizeMarker(text: string): string {
  return text.replace(/[\s\u00a0]+/g, " ").trim();
}

/** The `@list l<id>:level<level>` rule of the `<style>` block, or `null`. */
function listRule(styles: string, id: string | null, level: number): string | null {
  if (id === null) return null;
  const match = styles.match(new RegExp(`@list\\s+l${id}:level${level}\\s*\\{([^}]*)\\}`, "i"));
  return match ? match[1]! : null;
}

function marginLevel(style: string): number {
  const match = style.match(/margin-left:\s*(-?[\d.]+)(pt|in|cm|mm|px)/i);
  if (!match) return 1;
  const points = Number(match[1]) * PT_PER_UNIT[match[2]!.toLowerCase()]!;
  return Math.max(1, Math.round(points / LEVEL_INDENT_PT));
}

function letterValue(letters: string): number {
  return [...letters.toLowerCase()].reduce((sum, char) => sum * 26 + char.charCodeAt(0) - 96, 0);
}

function romanValue(roman: string): number {
  const values: Record<string, number> = { i: 1, v: 5, x: 10, l: 50, c: 100, d: 500, m: 1000 };
  const digits = [...roman.toLowerCase()].map((char) => values[char]!);
  return digits.reduce((sum, value, i) => sum + (value < (digits[i + 1] ?? 0) ? -value : value), 0);
}

/**
 * The number an item shows. The marker is the truth: Word continues a list after an interruption,
 * and only the marker says it is "3." and not "1.". The format from the rule tells `i` the roman one
 * from `i` the letter; without a rule a single letter is read as a letter.
 */
function itemNumber(marker: string | null, format: string | null, startAt: number): number {
  const label = marker?.match(NUMBERED_MARKER)?.[1];
  if (!label) return startAt;
  if (/^\d+$/.test(label)) return Number(label);
  const roman = format ? /roman/i.test(format) : label.length > 1 && ROMAN.test(label);
  return roman && ROMAN.test(label) ? romanValue(label) : letterValue(label);
}

function readItem(paragraph: HTMLParagraphElement, styles: string): ListItem | null {
  const style = paragraph.getAttribute("style") ?? "";
  if (MSO_IGNORE.test(style)) return null;
  const msoList = style.match(MSO_LIST);
  if (!msoList && !LIST_CLASS.test(paragraph.className)) return null;
  const marker = takeMarker(paragraph);
  // A "List Paragraph" without a marker is only an indented paragraph.
  if (!msoList && marker === null) return null;
  const id = msoList?.[1] ?? null;
  const level = msoList ? Number(msoList[2]) : marginLevel(style);
  const rule = listRule(styles, id, level);
  const format = rule?.match(/mso-level-number-format:\s*([\w-]+)/i)?.[1] ?? null;
  const kind =
    format !== null
      ? format.toLowerCase() === "bullet"
        ? "ul"
        : "ol"
      : rule !== null
        ? "ol" // A rule without a format is Word's default: decimal.
        : marker !== null && NUMBERED_MARKER.test(marker)
          ? "ol"
          : "ul";
  const startAt = Number(rule?.match(/mso-level-start-at:\s*(\d+)/i)?.[1] ?? 1) || 1;
  return {
    paragraph,
    id,
    level,
    kind,
    number: kind === "ol" ? itemNumber(marker, format, startAt) : null,
  };
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
      const parentItem = stack.at(-1)?.list.lastElementChild;
      (parentItem ?? root).appendChild(list);
      stack.push({ level: item.level, kind: item.kind, id: item.id, list });
    }
    const li = document.createElement("li");
    const content = document.createElement("p");
    content.append(...item.paragraph.childNodes);
    li.append(content);
    stack.at(-1)!.list.append(li);
  }
  return root;
}

export const wordLists: PasteCleanupStep = {
  name: "wordLists",
  applies: (sources) => sources.word,
  run(document, { styles }) {
    const items = Array.from(document.body.querySelectorAll("p"))
      .map((paragraph) => readItem(paragraph, styles))
      .filter((item): item is ListItem => item !== null);
    // Runs of items that follow each other: a heading or a plain paragraph between them ends a list.
    const runs: ListItem[][] = [];
    for (const item of items) {
      const run = runs.at(-1);
      if (run && item.paragraph.previousElementSibling === run.at(-1)!.paragraph) run.push(item);
      else runs.push([item]);
    }
    for (const run of runs) {
      run[0]!.paragraph.replaceWith(buildLists(run, document));
      for (const item of run.slice(1)) item.paragraph.remove();
    }
  },
};
