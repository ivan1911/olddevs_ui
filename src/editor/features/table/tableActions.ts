"use client";

import { Fragment, type Node as PMNode } from "@tiptap/pm/model";
import { TextSelection, type Command, type EditorState } from "@tiptap/pm/state";
import {
  addColumnAfter,
  addColumnBefore,
  addRowAfter,
  addRowBefore,
  CellSelection,
  deleteColumn,
  deleteRow,
  deleteTable,
  isInTable,
  mergeCells,
  selectedRect,
  splitCell,
  toggleHeader,
} from "@tiptap/pm/tables";
import type { Editor } from "@tiptap/react";
import type { EditorAlignment } from "../../styles/palette.js";
import { RICH_TEXT_SCHEMA } from "../../core/schema.js";
import { cellAlignment } from "./tableCells.js";

/**
 * The Table menu's actions, as data and ProseMirror commands, without React.
 *
 * ACTION AVAILABILITY IS A DRY RUN OF THE COMMAND with an empty `dispatch`, not
 * `editor.can()`: the "this is the whole table" check in `prosemirror-tables` sits
 * inside the branch with `dispatch`, so without it `can().deleteRow()` answers
 * "yes" to deleting the only row, which would then silently not be deleted. The dry
 * run takes the same path as the real command and answers honestly.
 */

/** Table size in columns and rows. */
export interface TableSize {
  cols: number;
  rows: number;
}

/**
 * Limits of the Insert table dialog. They match the merge limits in the Schema:
 * a cell wider than the widest table that can be inserted cannot be merged, and
 * the reverse holds too.
 */
export const TABLE_MAX_SIZE: TableSize = {
  cols: RICH_TEXT_SCHEMA.tableSpans.colspan,
  rows: RICH_TEXT_SCHEMA.tableSpans.rowspan,
};

const DEFAULT_SIZE: TableSize = { cols: 3, rows: 3 };

/*
  The last selected size is kept per Editor. It is a `WeakMap` keyed by the engine,
  not React state: the size is needed both by the grid in the Toolbar's menu (fixed
  or floating, these are two separate instances) and by the dialog that
  `RichTextEditor` holds. They share one engine, and the entry goes away with it.
*/
const lastSizes = new WeakMap<Editor, TableSize>();

/** The size last selected in this Editor; 3×3 at first. */
export function lastTableSize(editor: Editor): TableSize {
  return lastSizes.get(editor) ?? DEFAULT_SIZE;
}

export function rememberTableSize(editor: Editor, size: TableSize): void {
  lastSizes.set(editor, size);
}

/** The table under the caret (or under a cell selection) and its rectangle. */
function rectOf(state: EditorState) {
  return isInTable(state) ? selectedRect(state) : null;
}

/** The first row consists entirely of header cells. */
function hasHeaderRow(table: PMNode): boolean {
  const first = table.firstChild;
  if (!first || first.childCount === 0) return false;
  let all = true;
  first.forEach((cell) => {
    if (cell.type.spec.tableRole !== "header_cell") all = false;
  });
  return all;
}

/** Whether the table has a merged cell. */
export function hasMergedCells(table: PMNode): boolean {
  let merged = false;
  table.descendants((node) => {
    if (merged) return false;
    if (node.attrs.colspan > 1 || node.attrs.rowspan > 1) merged = true;
    return node.type.spec.tableRole === "table" || node.type.spec.tableRole === "row";
  });
  return merged;
}

/**
 * Merges the selected cells, within the Schema's limits. A merge wider than 20
 * columns or taller than 50 rows would be written as an attribute that reads back
 * as 1 on the next load, and the table would fall apart silently.
 */
const mergeWithinLimits: Command = (state, dispatch) => {
  if (!(state.selection instanceof CellSelection)) return false;
  const rect = selectedRect(state);
  if (rect.right - rect.left > TABLE_MAX_SIZE.cols) return false;
  if (rect.bottom - rect.top > TABLE_MAX_SIZE.rows) return false;
  return mergeCells(state, dispatch);
};

/* ── Column alignment ───────────────────────────────────────────────── */

/** Positions of the cells in the rectangle's columns, across all rows of the table. */
function columnCells(state: EditorState): { pos: number; node: PMNode }[] {
  const rect = rectOf(state);
  if (!rect) return [];
  const { map, table, tableStart, left, right } = rect;
  return map
    .cellsInRect({ left, right, top: 0, bottom: map.height })
    .map((pos) => ({ pos: tableStart + pos, node: table.nodeAt(pos)! }));
}

/**
 * Alignment of the column under the caret: the value shared by all of its cells,
 * otherwise `null`. In that case no option is marked in the menu, and that is
 * accurate: the column is mixed.
 */
export function columnAlignment(state: EditorState): EditorAlignment | null {
  const values = new Set(columnCells(state).map(({ node }) => cellAlignment(node.attrs.align)));
  if (values.size !== 1) return null;
  return [...values][0] ?? "left";
}

/**
 * Aligns the column under the caret (with a cell selection, all of its columns):
 * `data-align` on every cell, top to bottom, in one edit. `left` removes the
 * attribute, since it is the default.
 */
export function setColumnAlignment(alignment: EditorAlignment): Command {
  return (state, dispatch) => {
    const cells = columnCells(state);
    if (cells.length === 0) return false;
    if (dispatch) {
      const tr = state.tr;
      for (const { pos, node } of cells) {
        tr.setNodeMarkup(pos, null, { ...node.attrs, align: cellAlignment(alignment) });
      }
      dispatch(tr);
    }
    return true;
  };
}

/* ── Sorting ─────────────────────────────────────────────────────────── */

const SPACES = /[\s\u00a0\u202f\u2009']/g;

/** The locale's decimal separator: `,` for `ru`, `.` for `en`. */
function decimalSeparator(locale: string): string {
  try {
    return (
      new Intl.NumberFormat(locale).formatToParts(1.5).find((part) => part.type === "decimal")
        ?.value ?? "."
    );
  } catch {
    return ".";
  }
}

/**
 * The number parsed from the cell text, or `null`.
 *
 * Digit groups are separated by a space (including the no-break and thin spaces,
 * as `ru` writes them), an apostrophe, a comma or a dot; the fraction separator is
 * a comma or a dot. Where both marks occur, the fraction is the last one
 * (`1,234.5` and `1.234,5`). Where there is a single mark that occurs once, the UI
 * locale decides: `1,234` in `en` is one thousand two hundred thirty-four, in `ru`
 * it is one with a fraction. A mark from another locale followed by three digits is
 * a digit group, and followed by any other number of digits it is a fraction
 * (`1.5` in `ru`). A repeated mark can only be a digit group of three digits: `1.2.3`
 * is a version, not a number. The minus is a hyphen or `−`; a trailing percent sign
 * is allowed.
 */
export function parseCellNumber(text: string, locale: string): number | null {
  let value = text.replace(SPACES, "").replace(/^\u2212/, "-");
  if (value.endsWith("%")) value = value.slice(0, -1);
  if (!/^[+-]?[\d.,]*\d[\d.,]*$/.test(value)) return null;
  const sign = value.startsWith("-") ? -1 : 1;
  value = value.replace(/^[+-]/, "");
  const lastComma = value.lastIndexOf(",");
  const lastDot = value.lastIndexOf(".");
  let decimal: string | null = null;
  if (lastComma >= 0 && lastDot >= 0) {
    decimal = lastComma > lastDot ? "," : ".";
  } else if (lastComma >= 0 || lastDot >= 0) {
    const mark = lastComma >= 0 ? "," : ".";
    const count = value.split(mark).length - 1;
    const after = value.length - value.lastIndexOf(mark) - 1;
    decimal = count > 1 || (mark !== decimalSeparator(locale) && after === 3) ? null : mark;
  }
  const [whole = "", fraction] = decimal ? value.split(decimal) : [value];
  if (decimal && value.split(decimal).length > 2) return null;
  const group = decimal === "," ? "." : ",";
  const groups = whole.split(group);
  if (groups.length > 1 && (groups[0] === "" || groups.slice(1).some((g) => g.length !== 3))) {
    return null;
  }
  const digits = groups.join("");
  if (!/^\d+$/.test(digits) || (fraction !== undefined && !/^\d+$/.test(fraction))) return null;
  return sign * Number(fraction === undefined ? digits : `${digits}.${fraction}`);
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/;
const DOTTED_DATE = /^(\d{2})\.(\d{2})\.(\d{4})(?: (\d{2}):(\d{2})(?::(\d{2}))?)?$/;

/**
 * The date parsed from the cell text, as milliseconds, or `null`. Two formats
 * are unambiguous: ISO (`2026-10-06`, with the time after `T` or a space) and
 * `DD.MM.YYYY`, the way Russian dates are written. `10/06/2026` is not parsed: in
 * `en-US` it means October, elsewhere June, and the order cannot be guessed.
 */
export function parseCellDate(text: string): number | null {
  const iso = ISO_DATE.exec(text);
  const dotted = iso ? null : DOTTED_DATE.exec(text);
  const parts = iso
    ? [iso[1], iso[2], iso[3], iso[4], iso[5], iso[6]]
    : dotted
      ? [dotted[3], dotted[2], dotted[1], dotted[4], dotted[5], dotted[6]]
      : null;
  if (!parts) return null;
  const [year, month, day, hour, minute, second] = parts.map((part) => Number(part ?? 0)) as [
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  const time = Date.UTC(year, month - 1, day, hour, minute, second);
  const check = new Date(time);
  // 31.02 is not a date but a typo: `Date.UTC` would silently roll it over into March.
  if (check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
  if (hour > 23 || minute > 59 || second > 59) return null;
  return time;
}

/**
 * Comparison for a whole column: numbers compare as numbers, dates as dates,
 * anything else as text by the UI locale's `Intl.Collator` with `numeric` ("item 2"
 * sorts before "item 10", and accented letters such as "é" sort next to their base
 * letter). The kind is decided over all non-empty cells at once, not pair by pair:
 * a pairwise comparison of a mixed column is not transitive, and the order would
 * depend on the input order.
 */
function comparatorFor(keys: readonly string[], locale: string): (a: string, b: string) => number {
  const filled = keys.filter((key) => key !== "");
  if (filled.length > 0 && filled.every((key) => parseCellNumber(key, locale) !== null)) {
    return (a, b) => parseCellNumber(a, locale)! - parseCellNumber(b, locale)!;
  }
  if (filled.length > 0 && filled.every((key) => parseCellDate(key) !== null)) {
    return (a, b) => parseCellDate(a)! - parseCellDate(b)!;
  }
  let collator: Intl.Collator;
  try {
    collator = new Intl.Collator(locale, { numeric: true });
  } catch {
    collator = new Intl.Collator(undefined, { numeric: true });
  }
  return (a, b) => collator.compare(a, b);
}

/**
 * Sorts the table rows by the column under the caret.
 *
 * - The header row stays first: it labels the columns, not the data.
 * - A table with merged cells is not sorted (the command is unavailable): a row
 *   with a merge cannot be moved without splitting the merge.
 * - Empty cells go last in either direction: emptiness is not "less than" everything.
 * - The sort is stable: equal rows keep their order, and sorting again reorders nothing.
 * - The whole reordering is one edit, and `Ctrl/⌘+Z` undoes it in one step.
 * - The caret stays in the same row, which has moved to its new place.
 */
export function sortTable(direction: "ascending" | "descending", locale: string): Command {
  return (state, dispatch) => {
    const rect = rectOf(state);
    if (!rect) return false;
    const { table, tableStart, left, top } = rect;
    if (hasMergedCells(table)) return false;
    const rows: PMNode[] = [];
    table.forEach((row) => rows.push(row));
    const fixed = hasHeaderRow(table) ? 1 : 0;
    const body = rows.slice(fixed);
    if (body.length < 2) return false;
    if (!dispatch) return true;

    const keys = body.map((row) => (row.maybeChild(left)?.textContent ?? "").trim());
    const compare = comparatorFor(keys, locale);
    const sign = direction === "ascending" ? 1 : -1;
    const order = body
      .map((row, index) => ({ row, index, key: keys[index]! }))
      .sort((a, b) => {
        if (a.key === "" || b.key === "") return Number(a.key === "") - Number(b.key === "");
        return sign * compare(a.key, b.key);
      });

    const sorted = table.copy(Fragment.from([...rows.slice(0, fixed), ...order.map((e) => e.row)]));
    const tr = state.tr.replaceWith(tableStart - 1, tableStart - 1 + table.nodeSize, sorted);
    // The row with the caret moves to its new place; in the header the caret never moves anyway.
    const caretRow = top < fixed ? top : fixed + order.findIndex((e) => e.index === top - fixed);
    let pos = tableStart;
    for (let index = 0; index < caretRow; index++) pos += sorted.child(index).nodeSize;
    const row = sorted.child(caretRow);
    pos += 1;
    for (let index = 0; index < left && index < row.childCount; index++) {
      pos += row.child(index).nodeSize;
    }
    tr.setSelection(TextSelection.near(tr.doc.resolve(pos + 1)));
    dispatch(tr.scrollIntoView());
    return true;
  };
}

/* ── Action registry ────────────────────────────────────────────────────── */

/** Table menu action → ProseMirror command. Keys are the `id`s of the menu items. */
export function tableCommands(locale: string) {
  return {
    mergeCells: mergeWithinLimits,
    splitCell: splitCell as Command,
    addRowBefore: addRowBefore as Command,
    addRowAfter: addRowAfter as Command,
    deleteRow: deleteRow as Command,
    headerRow: toggleHeader("row"),
    addColumnBefore: addColumnBefore as Command,
    addColumnAfter: addColumnAfter as Command,
    deleteColumn: deleteColumn as Command,
    alignLeft: setColumnAlignment("left"),
    alignCenter: setColumnAlignment("center"),
    alignRight: setColumnAlignment("right"),
    sortAscending: sortTable("ascending", locale),
    sortDescending: sortTable("descending", locale),
    deleteTable: deleteTable as Command,
  } satisfies Record<string, Command>;
}

export type TableAction = keyof ReturnType<typeof tableCommands>;

/**
 * The dry run passes a `dispatch` that does nothing, not no `dispatch` at all (see
 * the module header). A table the engine has not yet repaired (`tables.ts`): the
 * command throws on it, but the Toolbar must not crash, so the action is unavailable.
 */
export function canRun(command: Command, state: EditorState): boolean {
  try {
    return command(state, () => undefined);
  } catch {
    return false;
  }
}

/**
 * Runs the action and returns focus to the document: the caret stays in the table,
 * and typing continues where the user was before opening the menu.
 */
export function runTableCommand(editor: Editor, command: Command): void {
  editor.commands.focus();
  command(editor.state, editor.view.dispatch);
}

/** Menu state for the current selection: empty outside a table. */
export function tableMenuState(state: EditorState, locale: string) {
  const rect = rectOf(state);
  if (!rect) return null;
  const commands = tableCommands(locale);
  const can = {} as Record<TableAction, boolean>;
  for (const action of Object.keys(commands) as TableAction[]) {
    can[action] = canRun(commands[action], state);
  }
  return {
    can,
    headerRow: hasHeaderRow(rect.table),
    merged: hasMergedCells(rect.table),
    alignment: columnAlignment(state),
  };
}
