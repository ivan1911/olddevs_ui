"use client";

import { gridWidth } from "../table/tableCells.js";
import { snapShares } from "../table/tableShareMath.js";
import {
  columnElements,
  declaredWidth,
  weightsOf,
  type CssWidth,
} from "../table/tableShareForeign.js";
import type { PasteCleanupContext, PasteCleanupStep } from "./cleanPastedHtml.js";

/*
  Column widths of a pasted table (OLDSUI-310, ADR-0080). The Schema has no width of its own to keep,
  so a width is carried only in the form it reads: `<colgroup><col data-width>`, shares in 5% steps.
  This step turns what each source writes into that form BEFORE the Schema, with the same rounding the
  table node uses for any foreign `colgroup` (`tableShareForeign.ts`), so the two paths cannot disagree.

  Where each application keeps its widths:

    - EXCEL writes a `<col width=176 style='width:132pt'>` per column, outside a `colgroup` in Chrome
      and Firefox, inside one in Safari. The `style` is the exact value in points, the attribute is
      the same rounded to pixels; the style wins. A hidden column is `width:0`, which is no width: a
      range with one is left to the content;
    - GOOGLE SHEETS writes `<col width="100">` in pixels, one per column, and a `width:0px` on the
      table itself, which says nothing;
    - GOOGLE DOCS writes `<col width="156">` for a column the author resized, and an empty `<col />`
      for the rest: a table with any empty one has no usable widths, as for any source;
    - WORD writes no `col` at all. Each cell of a row carries `width="200"` and `style="width:150pt"`,
      so the widths are read from the cells of one row.

  A table with widths for fewer than two columns, for more than twenty (the Editor builds no wider
  table), or with a column that has none, is left to its content. Merged cells are no obstacle: Word's
  widths are read from a row that has none, and the columns are counted by the table's grid.
*/

/** The widths of the columns from `<col>`, one per column (a `span` is expanded). */
function columnWidths(table: Element): (CssWidth | null)[] {
  return columnElements(table).map(declaredWidth);
}

/**
 * The widths of the columns from the cells of one row, for a source that writes no `col`. The row must
 * be a plain one: every cell spans one column, and there are as many cells as the table has columns,
 * otherwise a merge from a row above hides a cell, and the cells could not be matched to columns.
 */
function cellWidths(table: Element): (CssWidth | null)[] {
  const columns = gridWidth(table);
  const rows = table.querySelectorAll(":scope > tbody > tr, :scope > thead > tr, :scope > tr");
  for (const row of rows) {
    const cells = Array.from(row.children).filter((cell) => /^(TD|TH)$/.test(cell.nodeName));
    const plain = cells.every((cell) => !(Number(cell.getAttribute("colspan")) > 1));
    if (plain && cells.length === columns) return cells.map(declaredWidth);
  }
  return [];
}

/** Replaces whatever column markup the table has with a `colgroup` of shares, or removes it. */
function writeColumns(table: Element, shares: number[] | null): void {
  for (const column of table.querySelectorAll(":scope > colgroup, :scope > col")) column.remove();
  if (!shares) return;
  const document = table.ownerDocument;
  const colgroup = document.createElement("colgroup");
  for (const share of shares) {
    const col = document.createElement("col");
    col.setAttribute("data-width", String(share));
    colgroup.append(col);
  }
  table.prepend(colgroup);
}

/**
 * The widths of tables from Word, Excel, Google Docs and Google Sheets as `colgroup` shares. A source
 * that gave no usable widths loses its `col` elements: the Schema would drop them anyway.
 */
export const tableColumnWidths: PasteCleanupStep = {
  name: "tableColumnWidths",
  applies: (sources) => sources.word || sources.excel || sources.googleDocs || sources.googleSheets,
  run(document, context: PasteCleanupContext) {
    for (const table of document.querySelectorAll("table")) {
      const fromColumns = columnWidths(table);
      const widths =
        fromColumns.length > 0 ? fromColumns : context.sources.word ? cellWidths(table) : [];
      const weights = weightsOf(widths);
      writeColumns(
        table,
        weights && weights.length === gridWidth(table) ? snapShares(weights) : null
      );
    }
  },
};
