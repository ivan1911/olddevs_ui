"use client";

import {
  alignmentFromElement,
  DEFAULT_ALIGNMENT,
  EDITOR_ALIGNMENTS,
  type EditorAlignment,
} from "../../styles/palette.js";
import type { DOMOutputSpec } from "@tiptap/pm/model";
import { RICH_TEXT_SCHEMA } from "../../core/schema.js";
import { colgroupSpec, readStoredShares } from "./tableShares.js";

/*
  Table cell attributes (merging and column alignment) and the table's own `shares` attribute (`tables.ts` explains why
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

/**
 * The table's `shares` attribute (ADR-0080). It is not rendered as an attribute: `renderHTML` below
 * draws the `colgroup`, and `parseHTML` reads the widths from the one in the markup.
 */
export const tableShareAttributes = (
  read: (table: Element) => number[] | null | undefined = readStoredShares
) => ({
  shares: {
    default: null,
    rendered: false,
    parseHTML: (element: HTMLElement) => {
      const shares = read(element);
      // Shares for another number of columns would size every column wrongly: the table is
      // read without them, so no entry point (value, paste, JSON, Markdown) can create the mismatch.
      return shares && shares.length === gridWidth(element) ? shares : null;
    },
  },
});

/**
 * The number of columns of a table in HTML, the way the engine's table map counts them: cells in
 * reading order, each placed in the first column that no merged cell from above still covers, and the
 * widest row wins. Spans are read by the same rule as in a cell (`parseSpan`).
 */
export function gridWidth(table: Element): number {
  const rows = table.querySelectorAll(
    ":scope > tbody > tr, :scope > thead > tr, :scope > tfoot > tr, :scope > tr"
  );
  // How many more rows each column is covered by a cell from a row above.
  const covered: number[] = [];
  let width = 0;
  for (const row of rows) {
    let column = 0;
    for (const cell of row.children) {
      if (cell.nodeName !== "TD" && cell.nodeName !== "TH") continue;
      while ((covered[column] ?? 0) > 0) column++;
      const colspan = parseSpan(cell.getAttribute("colspan"), RICH_TEXT_SCHEMA.tableSpans.colspan);
      const rowspan = parseSpan(cell.getAttribute("rowspan"), RICH_TEXT_SCHEMA.tableSpans.rowspan);
      for (let i = 0; i < colspan; i++) covered[column + i] = rowspan;
      column += colspan;
      width = Math.max(width, column);
    }
    for (let i = 0; i < covered.length; i++) if (covered[i]) covered[i]!--;
  }
  return width;
}

/**
 * The table's DOM spec: the `colgroup` (only for a table with shares) before the body that holds the
 * rows. The Skeleton shape (`tableTool.ts`) renders the same.
 */
export function tableSpec(shares: unknown): DOMOutputSpec {
  const colgroup = colgroupSpec(shares);
  return colgroup
    ? ["table", {}, colgroup as DOMOutputSpec, ["tbody", 0]]
    : ["table", {}, ["tbody", 0]];
}
