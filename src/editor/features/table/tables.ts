"use client";

import type { CommandProps, JSONContent } from "@tiptap/core";
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import { GapCursor } from "@tiptap/pm/gapcursor";
import { Selection, TextSelection, type EditorState, type Transaction } from "@tiptap/pm/state";
import { addRow, fixTables, isInTable, selectedRect, TableMap } from "@tiptap/pm/tables";
import type { ResolvedPos } from "@tiptap/pm/model";
import type { EditorView } from "@tiptap/pm/view";
import { cellAlignment, cellAttributes, tableShareAttributes, tableSpec } from "./tableCells.js";
import { columnSharesGuard, withColumnShares } from "./tableColumns.js";
import { readColumnShares } from "./tableShareForeign.js";

/**
 * The Editor's table: Tiptap extensions trimmed down to the kit's Schema.
 *
 * WHY TRIM. By default `@tiptap/extension-table` writes markup that the Schema
 * does not have and must not have (spec, "Schema and security"):
 *
 * - `style` on `<table>` (`min-width: 75px`) and `<colgroup><col style>`: the
 *   engine computes widths for the column resize handles;
 * - `colwidth` on cells;
 * - `style="text-align"` on a cell, which is alignment that comes from Markdown
 *   (`:--:`), and `class="tableWrapper"` on the node view's wrapper.
 *
 * All of this is turned off here. The output is `table > tbody > tr > th|td`, and a cell has only
 * the Schema's three attributes. Column widths are the one thing the table writes beyond that: an
 * optional `colgroup` of `col[data-width]` before `tbody`, shares in 5% steps (see COLUMN WIDTHS).
 *
 * MERGING: `colspan` and `rowspan`, a decision of the owner (the Table menu items
 * "Merge" and "Split"). The first slice did not read them: there was no way to
 * split a merged cell. Now there is, and a table pasted from Word, Excel or Google
 * Docs keeps its merges. The value is an integer from 2 up to the Schema limit
 * (`tableSpans`); anything else reads as 1: a `colspan="10000"` from a paste would
 * mean ten thousand empty cells in every document.
 *
 * COLUMN ALIGNMENT: `data-align` on every cell of a column, with the same values
 * as Block alignment (`palette.ts`): `left` is not written. The node attribute is
 * named `align`, as in Tiptap: Markdown reads and writes it under that name
 * (`:---:`), so the table export does not need rewriting. Besides `data-align`,
 * `style="text-align"` and the legacy `align` from a paste (Word, Excel, Google
 * Docs) are read and converted into `data-align`; they are never written.
 *
 * `colwidth` STAYS ON THE NODE, but is neither written nor read. The table engine
 * (`prosemirror-tables`) touches it on every edit and crashes without it.
 *
 * COLUMN WIDTHS (ADR-0080): the table node has a `shares` attribute, the shares of the table's width
 * in percent, or `null` for a table sized by its content. It is written as `<colgroup><col
 * data-width="35">…</colgroup>` and read from one (`tableShares.ts`). The engine's pixels are not the
 * source: they are in the cells and stay unused. The shares live on the table, so merging, splitting
 * and sorting cannot disturb them; inserting and deleting a column carry them along, and anything
 * else that changes the column count drops them (`tableColumns.ts`).
 *
 * NODE VIEW IS OFF (`View: null`). The stock node view wraps the table in a
 * `div.tableWrapper` with a `colgroup` and sets `style` directly on the DOM.
 * Without it, the table in the Editor is the same `<table><tbody>` as in
 * `getHTML()` and `RichTextView`, and the styles of one module (`prose.ts`) work
 * on all three.
 *
 * A CELL HOLDS ANY BLOCKS OF THE SCHEMA (`block+`, as in Tiptap), not only
 * paragraphs. A narrow `paragraph+` would break pasting: ProseMirror would find no
 * place for a list inside the cell and would move it out of the table, splitting
 * the table in two.
 */

/**
 * A table with merges, for Markdown: every cell in its own place on the grid.
 *
 * GFM has no merges, and the Tiptap export writes the cells of a row one after
 * another. Without expanding `rowspan`, the cells of the lower rows would shift
 * left, under the wrong headers. Here a merged cell stays in the top-left corner
 * of its area with its content, and the other positions of the area become empty
 * cells of the same kind and alignment: the text and the columns stay in place,
 * only the merge is lost.
 */
export function expandSpans(table: JSONContent): JSONContent {
  const rows = table.content ?? [];
  const slots: JSONContent[][] = rows.map(() => []);
  rows.forEach((row, rowIndex) => {
    let col = 0;
    for (const cell of row.content ?? []) {
      while (slots[rowIndex]![col]) col++;
      const colspan = Math.max(1, Number(cell.attrs?.colspan) || 1);
      const rowspan = Math.max(1, Number(cell.attrs?.rowspan) || 1);
      for (let down = 0; down < rowspan && rowIndex + down < rows.length; down++) {
        for (let across = 0; across < colspan; across++) {
          slots[rowIndex + down]![col + across] =
            down === 0 && across === 0
              ? { ...cell, attrs: { ...cell.attrs, colspan: 1, rowspan: 1 } }
              : {
                  type: cell.type,
                  attrs: { align: cell.attrs?.align ?? null },
                  content: [{ type: "paragraph" }],
                };
        }
      }
      col += colspan;
    }
  });
  return {
    ...table,
    content: rows.map((row, index) => ({ ...row, content: slots[index]!.filter(Boolean) })),
  };
}

/** Strips `left` from the cells of a parsed table: in the Schema it is the default, not a value. */
function dropDefaultAlignment(node: JSONContent): JSONContent {
  if (node.attrs && "align" in node.attrs) {
    node = { ...node, attrs: { ...node.attrs, align: cellAlignment(node.attrs.align) } };
  }
  return node.content ? { ...node, content: node.content.map(dropDefaultAlignment) } : node;
}

/*
  The check that a gap cursor fits: the same one the gap cursor plugin uses. The
  package types do not export it (`@internal`), but the plugin calls it on every
  arrow key, and a copy of our own would silently drift from it.
*/
const gapCursorFits = ($pos: ResolvedPos): boolean =>
  (GapCursor as unknown as { valid($pos: ResolvedPos): boolean }).valid($pos);

/**
 * An arrow from the edge row of the table, with nothing after it in the document,
 * puts a gap cursor after the table (or before it for `↑`).
 *
 * `prosemirror-tables` looks for a place past the table with `Selection.near`, and
 * when the table is the last Block, the search goes back to the last cell: `↓`
 * from the first cell of the last row moved the caret to the end of the table, and
 * only a second arrow got out of it. That is exactly the path "Tab in the last
 * cell added a row → arrow down → typing below the table". Here the arrow places
 * the gap cursor at once; if there is a valid caret position after the table, the table
 * engine decides.
 */
export function leaveTableVertically(view: EditorView, dir: 1 | -1): boolean {
  const { selection, doc } = view.state;
  if (!(selection instanceof TextSelection) || !selection.empty) return false;
  const { $head } = selection;
  let cellDepth = -1;
  for (let depth = $head.depth - 1; depth > 0; depth--) {
    const parent = $head.node(depth);
    const atEdge =
      dir < 0 ? $head.index(depth) === 0 : $head.indexAfter(depth) === parent.childCount;
    if (!atEdge) return false;
    const role = parent.type.spec.tableRole;
    if (role === "cell" || role === "header_cell") {
      cellDepth = depth;
      break;
    }
  }
  if (cellDepth < 0 || !view.endOfTextblock(dir > 0 ? "down" : "up")) return false;

  const tableDepth = cellDepth - 2;
  const table = $head.node(tableDepth);
  const row = $head.index(tableDepth);
  const rowspan = Number($head.node(cellDepth).attrs.rowspan) || 1;
  if (dir > 0 ? row + rowspan < table.childCount : row > 0) return false;

  const $outside = doc.resolve(dir > 0 ? $head.after(tableDepth) : $head.before(tableDepth));
  if (Selection.findFrom($outside, dir) || !gapCursorFits($outside)) return false;
  view.dispatch(view.state.tr.setSelection(new GapCursor($outside)).scrollIntoView());
  return true;
}

/**
 * Inserts a row below the current one, with the caret in the same column of the
 * new row (`Alt+↓`, `⌥↓` on Mac). One transaction, one undo. Outside a table it
 * returns `false`: the shortcut stays with the browser (on Mac `⌥↓` moves to the
 * end of the paragraph).
 */
export function addRowBelow(state: EditorState, dispatch?: (tr: Transaction) => void): boolean {
  if (!isInTable(state)) return false;
  if (dispatch) {
    const rect = selectedRect(state);
    const tr = addRow(state.tr, rect, rect.bottom);
    const table = tr.doc.nodeAt(rect.tableStart - 1);
    if (!table) return false;
    const map = TableMap.get(table);
    const cell = rect.tableStart + map.map[rect.bottom * map.width + rect.left]!;
    tr.setSelection(TextSelection.near(tr.doc.resolve(cell + 1)));
    dispatch(tr.scrollIntoView());
  }
  return true;
}

export const RichTable = Table.extend({
  addAttributes() {
    // The engine reads the widths other applications write as well; the Skeleton only its own markup.
    return { ...this.parent?.(), ...tableShareAttributes(readColumnShares) };
  },
  /*
    The engine commands that add and remove columns carry the shares along. Anything that calls
    them (the menu, a screen through `editor.commands`) gets the same result; the chained form works
    too, because the wrapped `dispatch` edits the transaction the command built.
  */
  addCommands() {
    const parent =
      this.parent?.() ?? ({} as NonNullable<ReturnType<NonNullable<typeof this.parent>>>);
    const carry =
      (name: "addColumnBefore" | "addColumnAfter" | "deleteColumn") =>
      () =>
      (props: CommandProps) =>
        parent[name]!()({
          ...props,
          dispatch: withColumnShares(name, props.state, props.dispatch),
        });
    return {
      ...parent,
      addColumnBefore: carry("addColumnBefore"),
      addColumnAfter: carry("addColumnAfter"),
      deleteColumn: carry("deleteColumn"),
    };
  },
  addProseMirrorPlugins() {
    return [...(this.parent?.() ?? []), columnSharesGuard()];
  },
  addKeyboardShortcuts() {
    return {
      ...this.parent?.(),
      ArrowDown: () => leaveTableVertically(this.editor.view, 1),
      ArrowUp: () => leaveTableVertically(this.editor.view, -1),
      "Alt-ArrowDown": () =>
        this.editor.isEditable && addRowBelow(this.editor.state, this.editor.view.dispatch),
    };
  },
  renderHTML: ({ node }) => tableSpec(node.attrs.shares),
  /*
    The stock export starts and ends with a line break, and the Markdown manager
    separates Blocks with a blank line on its own: around the table that came to
    two on each side. The edges are trimmed, and the table is separated from its
    neighbors like any other Block.
  */
  /*
    A table from `defaultValue` with a different number of cells per row (foreign
    HTML with an error, or with merges beyond the Schema limit) reaches the engine
    as is: `tableEditing` normalizes it only inside a transaction, and paste and
    `value` both go through one. Until it does, the table commands throw on such a
    table (`toggleHeader` lands in a nonexistent cell), and the first action from
    the menu would crash the field. Normalization is not an edit by the author: no
    `onChange`, no entry in the history.
  */
  onCreate() {
    const tr = fixTables(this.editor.state);
    if (tr)
      this.editor.view.dispatch(tr.setMeta("preventUpdate", true).setMeta("addToHistory", false));
  },
  renderMarkdown(node, helpers, context) {
    return (this.parent?.(expandSpans(node), helpers, context) ?? "").replace(/^\n+|\n+$/g, "");
  },
  /*
    GFM `:---` is left alignment, and in the Schema left is the default, with no
    attribute. Without stripping it, the parsed table would keep `align: "left"`,
    which does not exist in HTML: after a round trip through `value`, the document
    would differ from the parsed one.
  */
  parseMarkdown(token, helpers) {
    const result = this.parent?.(token, helpers) ?? [];
    return Array.isArray(result) || "mark" in result ? result : dropDefaultAlignment(result);
  },
}).configure({ resizable: false, renderWrapper: false, View: null });

export const RichTableRow = TableRow;

export const RichTableCell = TableCell.extend({ addAttributes: cellAttributes });

export const RichTableHeader = TableHeader.extend({ addAttributes: cellAttributes });

/** All four table extensions: the Schema does not work without any one of them. */
export const TABLE_EXTENSIONS = [RichTable, RichTableRow, RichTableHeader, RichTableCell];
