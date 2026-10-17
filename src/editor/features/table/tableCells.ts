"use client";

import {
  alignmentFromElement,
  DEFAULT_ALIGNMENT,
  EDITOR_ALIGNMENTS,
  type EditorAlignment,
} from "../../styles/palette.js";
import { RICH_TEXT_SCHEMA } from "../../core/schema.js";

/*
  Table cell attributes: merging and column alignment (`tables.ts` explains why
  these). They are kept apart from the table extensions: the table's shape in the
  Skeleton (`tableTool.ts`) parses cells with them too, and the table chunk with
  `prosemirror-tables` is not loaded before Readiness. One definition serves both
  parses, otherwise the Skeleton and the engine would disagree on which merges are
  valid.
*/

/**
 * The span read from an attribute: an integer from 1 to `max`, otherwise 1. Digits
 * only: browsers parse `"2px"`, `"1.5"` and `"-3"` in their own ways, and the
 * Schema never writes them. Surrounding whitespace is trimmed, as browsers and
 * DOMPurify do: the server-side sanitizer already returns `colspan=" 2"` as `"2"`,
 * and the Editor must read the same.
 */
export function parseSpan(raw: string | null, max: number): number {
  const trimmed = raw?.trim() ?? "";
  if (!/^\d{1,6}$/.test(trimmed)) return 1;
  const value = Number(trimmed);
  return value >= 1 && value <= max ? value : 1;
}

const knownAlignments: ReadonlySet<string> = new Set(EDITOR_ALIGNMENTS);

/** Cell alignment that is written: `center` or `right`; `left` and unknown values give `null`. */
export function cellAlignment(value: unknown): Exclude<EditorAlignment, "left"> | null {
  return typeof value === "string" && knownAlignments.has(value) && value !== DEFAULT_ALIGNMENT
    ? (value as Exclude<EditorAlignment, "left">)
    : null;
}

const spanAttribute = (name: "colspan" | "rowspan") => ({
  default: 1,
  parseHTML: (element: HTMLElement) =>
    parseSpan(element.getAttribute(name), RICH_TEXT_SCHEMA.tableSpans[name]),
  renderHTML: (attributes: Record<string, unknown>) => {
    const value = attributes[name];
    return typeof value === "number" && value > 1 ? { [name]: String(value) } : {};
  },
});

export const cellAttributes = () => ({
  colspan: spanAttribute("colspan"),
  rowspan: spanAttribute("rowspan"),
  colwidth: { default: null, rendered: false, parseHTML: () => null },
  align: {
    default: null,
    parseHTML: (element: HTMLElement) => alignmentFromElement(element),
    renderHTML: (attributes: Record<string, unknown>) => {
      const value = cellAlignment(attributes.align);
      return value ? { "data-align": value } : {};
    },
  },
});
