"use client";

import type { Node as PMNode } from "@tiptap/pm/model";
import {
  Plugin,
  PluginKey,
  type Command,
  type EditorState,
  type Transaction,
} from "@tiptap/pm/state";
import {
  addColumnAfter,
  addColumnBefore,
  deleteColumn,
  isInTable,
  selectedRect,
  TableMap,
  type TableRect,
} from "@tiptap/pm/tables";
import {
  equalShares,
  insertShare,
  isShares,
  nudgeShare,
  removeShares,
  sameShares,
  snapShares,
} from "./tableShares.js";

/*
  Column widths of a table, as ProseMirror commands over the table node's `shares` attribute
  (ADR-0080). The shares are DATA OF THE TABLE, not of its cells: the engine keeps its own pixel
  `colwidth` on every cell and the kit never reads it (`tables.ts`), so a width change is one
  `setNodeMarkup` on the table, and merging, splitting and sorting cannot disturb it.

  What does change the number of columns has to carry the shares along: inserting and deleting a
  column (decision 9). Those commands are wrapped below, for the menu and for the engine commands
  `addColumnBefore`, `addColumnAfter` and `deleteColumn`. Anything else that changes the column
  count after the table exists (a paste that grows it) is caught by `columnSharesGuard`: shares for the wrong number
  of columns would size every column wrongly, so they are dropped and the table goes back to its
  content.
*/

/** The shares of a table node: a list the Document may keep, or `null` for a table sized by content. */
export function sharesOf(table: PMNode): number[] | null {
  const shares: unknown = table.attrs.shares;
  return isShares(shares) ? shares : null;
}

/** The number of columns of a table. */
export function columnCount(table: PMNode): number {
  return TableMap.get(table).width;
}

/** Writes the shares of the table at `tablePos` into `tr`; the same shares write nothing. */
export function writeShares(
  tr: Transaction,
  tablePos: number,
  shares: number[] | null
): Transaction {
  const table = tr.doc.nodeAt(tablePos);
  if (!table || sameShares(sharesOf(table), shares)) return tr;
  return tr.setNodeMarkup(tablePos, undefined, { ...table.attrs, shares });
}

/** The table under the caret (or under a cell selection) and its rectangle. */
function rectOf(state: EditorState): TableRect | null {
  return isInTable(state) ? selectedRect(state) : null;
}

/** The column the width commands act on: the leftmost one of the selection. */
export function activeColumn(state: EditorState): number | null {
  return rectOf(state)?.left ?? null;
}

/** The share of the column under the caret, or `null` when the table is sized by content. */
export function columnShare(state: EditorState): number | null {
  const rect = rectOf(state);
  const shares = rect && sharesOf(rect.table);
  return rect && shares ? (shares[rect.left] ?? null) : null;
}

/* ── Inserting and deleting columns ─────────────────────────────────── */

export type ColumnEdit = "addColumnBefore" | "addColumnAfter" | "deleteColumn";

/**
 * The shares of a table after a column edit, from the rectangle the engine command saw. The new
 * column of "insert left" takes the place of the column under the caret and half of its share;
 * "insert right" sits after the last selected column.
 */
function sharesAfter(edit: ColumnEdit, rect: TableRect, shares: number[]): number[] | null {
  if (edit === "addColumnBefore") return insertShare(shares, rect.left, rect.left);
  if (edit === "addColumnAfter") return insertShare(shares, rect.right, rect.right - 1);
  return removeShares(shares, rect.left, rect.right);
}

/**
 * Runs a column edit through its dispatch: the transaction the engine built also gets the new shares.
 * The table keeps its position (columns change cells inside it), so the position from before the edit
 * is still the table's. `dispatch` is whatever the caller passed, undefined for a dry run.
 */
export function withColumnShares<D extends ((tr: Transaction) => void) | undefined>(
  edit: ColumnEdit,
  state: EditorState,
  dispatch: D
): D {
  const rect = rectOf(state);
  const shares = rect && sharesOf(rect.table);
  if (!dispatch || !rect || !shares) return dispatch;
  return ((tr: Transaction) => {
    writeShares(tr, rect.tableStart - 1, sharesAfter(edit, rect, shares));
    dispatch(tr);
  }) as D;
}

const columnEdit =
  (edit: ColumnEdit, command: Command): Command =>
  (state, dispatch, view) =>
    command(state, withColumnShares(edit, state, dispatch), view);

/** "Insert column left", the engine command with the shares carried along. */
export const insertColumnBefore = columnEdit("addColumnBefore", addColumnBefore);
/** "Insert column right". */
export const insertColumnAfter = columnEdit("addColumnAfter", addColumnAfter);
/** "Delete column". */
export const removeColumn = columnEdit("deleteColumn", deleteColumn);

/* ── Setting the widths ─────────────────────────────────────────────── */

/**
 * A width command: `change` returns the new shares of the table under the caret, or `null` for "no
 * change". Without a table, or when nothing would change, the command is unavailable.
 */
function shareCommand(
  change: (
    shares: number[] | null,
    rect: TableRect,
    state: EditorState
  ) => number[] | null | undefined
): Command {
  return (state, dispatch) => {
    const rect = rectOf(state);
    if (!rect) return false;
    const next = change(sharesOf(rect.table), rect, state);
    if (next === undefined) return false;
    if (dispatch) dispatch(writeShares(state.tr, rect.tableStart - 1, next));
    return true;
  };
}

/** "Equal columns": every column the same width, the spare steps to the leading columns. */
export const equalColumns: Command = shareCommand((shares, rect) => {
  const equal = equalShares(columnCount(rect.table));
  return equal && !sameShares(shares, equal) ? equal : undefined;
});

/** "Fit to content": all the shares go, and the browser sizes the table by what is in it. */
export const fitColumnsToContent: Command = shareCommand((shares) => (shares ? null : undefined));

/**
 * One step wider or narrower for the column under the caret, at the expense of its neighbour.
 *
 * A table without shares takes the widths it has now first: `measured` are the pixel widths of its
 * columns from the browser (the pointer handle measures them the same way), and without them the
 * columns are taken as equal. The widths are measured only when the command runs (`view` is set), so
 * the dry run that decides whether the menu item is enabled never touches the layout.
 */
export function stepColumnWidth(
  direction: 1 | -1,
  measured?: (state: EditorState, rect: TableRect) => number[] | null
): Command {
  return (state, dispatch) => {
    const rect = rectOf(state);
    if (!rect) return false;
    const count = columnCount(rect.table);
    const current = sharesOf(rect.table);
    if (!current && !dispatch) return count >= 2 && equalShares(count) !== null;
    const pixels = measured?.(state, rect);
    const base = current ?? (pixels ? snapShares(pixels) : null) ?? equalShares(count);
    const next = base && nudgeShare(base, rect.left, direction);
    if (!next) return false;
    if (dispatch) dispatch(writeShares(state.tr, rect.tableStart - 1, next));
    return true;
  };
}

/* ── The guard ──────────────────────────────────────────────────────── */

/** Positions of the tables in `[from, to]` whose shares do not match their column count. */
function mismatched(doc: PMNode, from: number, to: number): number[] {
  const found: number[] = [];
  doc.nodesBetween(from, to, (node, pos) => {
    if (node.type.spec.tableRole !== "table") return true;
    const shares = sharesOf(node);
    if (shares && shares.length !== columnCount(node)) found.push(pos);
    return true;
  });
  return found;
}

/**
 * Keeps the shares of a table honest after any edit: a table whose number of columns no longer matches
 * its shares loses them. Only the tables in the part of the document that changed are looked at, so
 * typing in a text paragraph costs a comparison of two document ends and no table walk.
 */
export const columnSharesGuard = (): Plugin =>
  new Plugin({
    key: new PluginKey("tableColumnShares"),
    appendTransaction(transactions, oldState, newState) {
      if (!transactions.some((tr) => tr.docChanged)) return null;
      const start = oldState.doc.content.findDiffStart(newState.doc.content);
      const end = oldState.doc.content.findDiffEnd(newState.doc.content);
      if (start === null || end === null) return null;
      const tr = newState.tr;
      for (const pos of mismatched(newState.doc, start, Math.max(start, end.b))) {
        writeShares(tr, pos, null);
      }
      return tr.docChanged ? tr : null;
    },
  });
