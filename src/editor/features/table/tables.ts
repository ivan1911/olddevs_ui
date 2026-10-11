"use client";

import type { JSONContent } from "@tiptap/core";
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import { GapCursor } from "@tiptap/pm/gapcursor";
import { Selection, TextSelection, type EditorState, type Transaction } from "@tiptap/pm/state";
import { addRow, fixTables, isInTable, selectedRect, TableMap } from "@tiptap/pm/tables";
import type { ResolvedPos } from "@tiptap/pm/model";
import type { EditorView } from "@tiptap/pm/view";
import { cellAlignment, cellAttributes } from "./tableCells.js";

/**
 * Таблица Редактора: расширения Tiptap, обрезанные до Схемы кита.
 *
 * ЗАЧЕМ ОБРЕЗАТЬ. `@tiptap/extension-table` по умолчанию пишет в разметку
 * то, чего в Схеме нет и быть не должно (спека, «Схема и безопасность»):
 *
 * - `style` на `<table>` (`min-width: 75px`) и `<colgroup><col style>` —
 *   ширину считает движок для ручек ресайза столбцов;
 * - `colwidth` на ячейках;
 * - `style="text-align"` на ячейке — выравнивание, пришедшее из Markdown
 *   (`:--:`), и `class="tableWrapper"` у обёртки представления узла.
 *
 * Здесь всё это выключено: ширину столбцов в v1 не строим. На выходе
 * `table > tbody > tr > th|td`, и у ячейки бывают только три атрибута Схемы.
 *
 * СЛИЯНИЕ — `colspan` и `rowspan`, решение владельца (меню «Таблица», пункты
 * «Объединить» и «Разделить»). Первый срез их не читал: расщепить слитую
 * ячейку было нечем. Теперь есть чем, и таблица из Word, Excel или Google Docs
 * вставляется со своими слияниями. Значение — целое от 2 до предела Схемы
 * (`tableSpans`); всё прочее читается как 1: `colspan="10000"` из вставки
 * означал бы десять тысяч пустых ячеек в каждом документе.
 *
 * ВЫРАВНИВАНИЕ СТОЛБЦА — `data-align` на каждой ячейке столбца, теми же
 * значениями, что выравнивание Блока (`palette.ts`): `left` не пишется. Атрибут
 * узла назван `align`, как у Tiptap: под этим именем его читает и пишет
 * Markdown (`:---:`), и выгрузку таблицы переписывать не нужно. Кроме
 * `data-align` читаются `style="text-align"` и устаревший `align` из вставки
 * (Word, Excel, Google Docs) — переводом в `data-align`; сами они не пишутся.
 *
 * `colwidth` ОСТАЁТСЯ В УЗЛЕ, но не пишется и не читается. Движок таблиц
 * (`prosemirror-tables`) лезет в него при каждой правке и без него падает.
 *
 * ПРЕДСТАВЛЕНИЕ УЗЛА ВЫКЛЮЧЕНО (`View: null`). Штатное оборачивает таблицу в
 * `div.tableWrapper` с `colgroup` и выставляет `style` прямо на DOM. Без него
 * таблица в Редакторе — тот же `<table><tbody>`, что `getHTML()` и
 * `RichTextView`, и стили одного модуля (`prose.ts`) работают на всех трёх.
 *
 * ЯЧЕЙКА ДЕРЖИТ ЛЮБЫЕ БЛОКИ СХЕМЫ (`block+`, как у Tiptap), а не только
 * абзацы. Узкое `paragraph+` ломало бы вставку: ProseMirror не нашёл бы списку
 * в ячейке места и вынес бы его из таблицы, разрезав её надвое.
 */

/**
 * Таблица со слиянием — для Markdown: каждая ячейка на своём месте сетки.
 *
 * GFM слияния не знает, а выгрузка Tiptap пишет ячейки строки подряд. Без
 * развёртки `rowspan` сдвигал бы ячейки нижних строк влево, под чужие
 * заголовки. Здесь слитая ячейка остаётся в левом верхнем углу своей области с
 * содержимым, а остальные места области становятся пустыми ячейками того же
 * вида и выравнивания: текст и столбцы на месте, теряется только слияние.
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

/** Снимает `left` с ячеек разобранной таблицы: в Схеме это умолчание, а не значение. */
function dropDefaultAlignment(node: JSONContent): JSONContent {
  if (node.attrs && "align" in node.attrs) {
    node = { ...node, attrs: { ...node.attrs, align: cellAlignment(node.attrs.align) } };
  }
  return node.content ? { ...node, content: node.content.map(dropDefaultAlignment) } : node;
}

/*
  Проверка места под щель — та же, что у самого плагина щели. В типах пакета
  её нет (`@internal`), но плагин зовёт её на каждой стрелке: своя копия
  разошлась бы с ним молча.
*/
const gapCursorFits = ($pos: ResolvedPos): boolean =>
  (GapCursor as unknown as { valid($pos: ResolvedPos): boolean }).valid($pos);

/**
 * Стрелка из крайней строки таблицы, за которой в документе ничего нет, —
 * курсор-щель за таблицей (или перед ней для `↑`).
 *
 * `prosemirror-tables` ищет место за таблицей через `Selection.near`, и когда
 * таблица — последний Блок, поиск возвращается назад, в последнюю ячейку:
 * `↓` из первой ячейки последней строки переносил каретку в конец таблицы, и
 * только вторая стрелка выводила из неё. А это ровно путь «Tab в последней
 * ячейке добавил строку → стрелка вниз → набор под таблицей». Здесь стрелка
 * сразу ставит щель; если за таблицей есть куда встать, решает движок таблиц.
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
 * Строка под текущей, каретка — в тот же столбец новой строки (`Alt+↓`,
 * на Mac `⌥↓`). Одна транзакция — одна отмена. Вне таблицы — `false`: сочетание
 * остаётся браузеру (на Mac `⌥↓` ведёт в конец абзаца).
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
  addKeyboardShortcuts() {
    return {
      ...this.parent?.(),
      ArrowDown: () => leaveTableVertically(this.editor.view, 1),
      ArrowUp: () => leaveTableVertically(this.editor.view, -1),
      "Alt-ArrowDown": () =>
        this.editor.isEditable && addRowBelow(this.editor.state, this.editor.view.dispatch),
    };
  },
  renderHTML: () => ["table", {}, ["tbody", 0]],
  /*
    Штатная выгрузка начинается и кончается переводом строки, а менеджер
    Markdown сам разделяет Блоки пустой строкой: вокруг таблицы выходило по
    две. Края срезаются, и таблица отделяется от соседей, как любой Блок.
  */
  /*
    Таблица из `defaultValue` с разным числом ячеек в строках (чужой HTML с
    ошибкой или со слиянием сверх предела Схемы) приходит в движок как есть: выравнивает
    `tableEditing` только по транзакции, а вставка и `value` ею служат. Пока
    её нет, команды таблицы на такой таблице бросают (`toggleHeader` попадает в
    несуществующую ячейку), и первое же действие из меню роняло бы поле.
    Выравнивание — не правка автора: без `onChange`, без записи в историю.
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
    GFM `:---` — выравнивание влево, а в Схеме лево — умолчание без атрибута.
    Без снятия разобранная таблица держала бы `align: "left"`, которого в HTML
    нет: после круга через `value` документ отличался бы от разобранного.
  */
  parseMarkdown(token, helpers) {
    const result = this.parent?.(token, helpers) ?? [];
    return Array.isArray(result) || "mark" in result ? result : dropDefaultAlignment(result);
  },
}).configure({ resizable: false, renderWrapper: false, View: null });

export const RichTableRow = TableRow;

export const RichTableCell = TableCell.extend({ addAttributes: cellAttributes });

export const RichTableHeader = TableHeader.extend({ addAttributes: cellAttributes });

/** Все четыре расширения таблицы: схема не заработает без любого из них. */
export const TABLE_EXTENSIONS = [RichTable, RichTableRow, RichTableHeader, RichTableCell];
