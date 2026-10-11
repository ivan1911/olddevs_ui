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
 * Действия меню «Таблица» — данными и командами ProseMirror, без React.
 *
 * ДОСТУПНОСТЬ ДЕЙСТВИЯ — ПРОБНЫЙ ПРОГОН КОМАНДЫ с пустым `dispatch`, а не
 * `editor.can()`: проверка «это вся таблица» у `prosemirror-tables` стоит
 * внутри ветки с `dispatch`, и без него `can().deleteRow()` отвечает «да» на
 * удаление единственной строки, которая потом молча не удалится. Пробный
 * прогон идёт тем же путём, что настоящий, и отвечает честно.
 */

/** Размер таблицы в столбцах и строках. */
export interface TableSize {
  cols: number;
  rows: number;
}

/**
 * Пределы окна «Вставить таблицу». Те же, что у слияния в Схеме: ячейку шире
 * самой широкой вставляемой таблицы не слить, и наоборот.
 */
export const TABLE_MAX_SIZE: TableSize = {
  cols: RICH_TEXT_SCHEMA.tableSpans.colspan,
  rows: RICH_TEXT_SCHEMA.tableSpans.rowspan,
};

const DEFAULT_SIZE: TableSize = { cols: 3, rows: 3 };

/*
  Последний выбранный размер — у каждого Редактора свой. `WeakMap` по движку,
  а не состояние React: размер нужен и сетке в меню Панели (фиксированной или
  плавающей — это два разных экземпляра), и окну, которое держит
  `RichTextEditor`. Движок у них общий, а с его уничтожением уходит и запись.
*/
const lastSizes = new WeakMap<Editor, TableSize>();

/** Последний выбранный в этом Редакторе размер; сначала — 3×3. */
export function lastTableSize(editor: Editor): TableSize {
  return lastSizes.get(editor) ?? DEFAULT_SIZE;
}

export function rememberTableSize(editor: Editor, size: TableSize): void {
  lastSizes.set(editor, size);
}

/** Таблица под кареткой (или под выделением ячеек) и её прямоугольник. */
function rectOf(state: EditorState) {
  return isInTable(state) ? selectedRect(state) : null;
}

/** Первая строка — вся из ячеек-заголовков. */
function hasHeaderRow(table: PMNode): boolean {
  const first = table.firstChild;
  if (!first || first.childCount === 0) return false;
  let all = true;
  first.forEach((cell) => {
    if (cell.type.spec.tableRole !== "header_cell") all = false;
  });
  return all;
}

/** Есть ли в таблице слитая ячейка. */
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
 * Слить выделенные ячейки — в пределах Схемы. Слияние шире 20 столбцов или
 * выше 50 строк записалось бы атрибутом, который при следующей загрузке
 * читается как 1, и таблица развалилась бы молча.
 */
const mergeWithinLimits: Command = (state, dispatch) => {
  if (!(state.selection instanceof CellSelection)) return false;
  const rect = selectedRect(state);
  if (rect.right - rect.left > TABLE_MAX_SIZE.cols) return false;
  if (rect.bottom - rect.top > TABLE_MAX_SIZE.rows) return false;
  return mergeCells(state, dispatch);
};

/* ── Выравнивание столбца ───────────────────────────────────────────────── */

/** Позиции ячеек в столбцах прямоугольника — во всех строках таблицы. */
function columnCells(state: EditorState): { pos: number; node: PMNode }[] {
  const rect = rectOf(state);
  if (!rect) return [];
  const { map, table, tableStart, left, right } = rect;
  return map
    .cellsInRect({ left, right, top: 0, bottom: map.height })
    .map((pos) => ({ pos: tableStart + pos, node: table.nodeAt(pos)! }));
}

/**
 * Выравнивание столбца под кареткой: общее у всех его ячеек, иначе `null` —
 * тогда в меню не отмечен ни один вариант, и это правда: столбец смешанный.
 */
export function columnAlignment(state: EditorState): EditorAlignment | null {
  const values = new Set(columnCells(state).map(({ node }) => cellAlignment(node.attrs.align)));
  if (values.size !== 1) return null;
  return [...values][0] ?? "left";
}

/**
 * Выровнять столбец под кареткой (при выделении ячеек — все его столбцы):
 * `data-align` на каждой ячейке, сверху донизу, одной правкой. `left` снимает
 * атрибут — это умолчание.
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

/* ── Сортировка ─────────────────────────────────────────────────────────── */

const SPACES = /[\s\u00a0\u202f\u2009']/g;

/** Десятичный знак локали: `,` у `ru`, `.` у `en`. */
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
 * Число из текста ячейки или `null`.
 *
 * Разряды — пробелом (в том числе неразрывным и узким, как пишет `ru`),
 * апострофом, запятой или точкой; дробная часть — запятой или точкой. Где
 * знака два, дробный — последний (`1,234.5` и `1.234,5`). Где он один и
 * встречается раз, решает локаль интерфейса: `1,234` у `en` — тысяча двести
 * тридцать четыре, у `ru` — одна целая с дробью; знак чужой локали с тремя
 * цифрами после — разряд, с другим числом цифр — дробь (`1.5` у `ru`).
 * Повторённый знак — только разряды по три цифры: `1.2.3` — версия, а не число.
 * Минус — дефис или `−`, процент в конце допустим.
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
 * Дата из текста ячейки — миллисекунды или `null`. Две записи без
 * двусмысленности: ISO (`2026-10-06`, с временем через `T` или пробел) и
 * `ДД.ММ.ГГГГ`, как пишут даты по-русски. `10/06/2026` не читается: у `en-US`
 * это октябрь, у остальных — июнь, и угадывать порядок нельзя.
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
  // 31.02 — не дата, а опечатка: `Date.UTC` молча перенёс бы её в март.
  if (check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
  if (hour > 23 || minute > 59 || second > 59) return null;
  return time;
}

/**
 * Сравнение для столбца целиком: числа — как числа, даты — как даты, иначе —
 * текст по `Intl.Collator` локали интерфейса с `numeric` («пункт 2» раньше
 * «пункта 10», «ё» на месте). Вид решается по всем непустым ячейкам сразу, а
 * не попарно: попарное сравнение смешанного столбца нетранзитивно, и порядок
 * зависел бы от исходного.
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
 * Отсортировать строки таблицы по столбцу под кареткой.
 *
 * - Строка-заголовок остаётся первой: она подписывает столбцы, а не данные.
 * - Таблица со слитыми ячейками не сортируется (команда недоступна): строку
 *   со слиянием нельзя переставить, не разрезав его.
 * - Пустые ячейки — в конце при любом направлении: пустота не «меньше» всех.
 * - Порядок устойчивый: равные строки остаются в прежнем порядке, и повторная
 *   сортировка ничего не перемешивает.
 * - Вся перестановка — одна правка, и `Ctrl/⌘+Z` отменяет её целиком.
 * - Каретка остаётся в той же строке, уехавшей на новое место.
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
    // Строка с кареткой — на её новое место; в шапке каретка и так не двигалась.
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

/* ── Реестр действий ────────────────────────────────────────────────────── */

/** Действие меню «Таблица» → команда ProseMirror. Ключи — `id` пунктов меню. */
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
 * Пробный прогон: с `dispatch`, который ничего не делает, — не без него (см.
 * шапку модуля). Таблица, которую движок ещё не выровнял (`tables.ts`): команда
 * на ней бросает, а Панель при этом не должна падать — действие недоступно.
 */
export function canRun(command: Command, state: EditorState): boolean {
  try {
    return command(state, () => undefined);
  } catch {
    return false;
  }
}

/**
 * Выполнить действие и вернуть фокус в документ: каретка остаётся в таблице,
 * и набор продолжается там, откуда пришли в меню.
 */
export function runTableCommand(editor: Editor, command: Command): void {
  editor.commands.focus();
  command(editor.state, editor.view.dispatch);
}

/** Состояние меню для текущего выделения: пусто вне таблицы. */
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
