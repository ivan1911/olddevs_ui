"use client";

import { Extension, Node, type Extensions } from "@tiptap/core";
import { Fragment, Slice, type Node as PmNode, type ResolvedPos } from "@tiptap/pm/model";
import { GapCursor } from "@tiptap/pm/gapcursor";
import {
  NodeSelection,
  Plugin,
  PluginKey,
  Selection,
  TextSelection,
  type EditorState,
  type Transaction,
} from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import {
  DEFAULT_LAYOUT,
  layoutColumnCount,
  layoutFrom,
  nearestLayout,
  type EditorLayout,
} from "./columnLayouts.js";
import { containerFreeContext, placeContainerBlock, WRAPPER_NODE } from "../../core/containers.js";

/**
 * Раскладка — Блок из колонок: `div[data-block="layout"]` с
 * вариантом в `data-layout`, внутри от одной до четырёх
 * `div[data-block="column"]`, в колонке — любые Блоки, кроме другой Раскладки.
 *
 * ИМЕНА АТРИБУТОВ — ИЗ ОБРАЗЦА ВЛАДЕЛЬЦА (`data-block="layout"`,
 * `data-block="column"`): так размечают колонки редакторы, из которых HTML
 * чаще всего и вставляют. Своё отличие одно — ширины. В образце они в
 * `style="flex-basis: 50%"`, а Схема кита `style` не знает (ADR-0050), поэтому
 * доли — именем варианта (`columnLayouts.ts`), а `flex-basis` из вставки
 * переводится в ближайший вариант.
 *
 * ВЛОЖЕННОСТИ НЕТ НА УРОВНЕ СХЕМЫ ДВИЖКА, а не проверкой в командах. Раскладка
 * не входит в группу `block`: её принимает только Документ (`(block | layout)+`,
 * `document.ts`), а колонка, пункт списка, цитата, ячейка и Обёртка держат
 * `block`. Значит, вложить её не может ни вставка, ни `value`, ни команда.
 * Разбор HTML на такой случай не режет Раскладку надвое, а снимает её обёртки:
 * правило с `skip` в контексте контейнера отдаёт Блоки колонок подряд.
 *
 * `isolating` У ОБОИХ УЗЛОВ, как у таблицы и ячейки: Backspace в начале колонки
 * не сливает её с соседней и не вытаскивает текст из Раскладки, а выделение
 * мышью и команды «Превратить в» не перешагивают границу колонки.
 *
 * Решение — ADR-0056.
 */

/** Имя узла Раскладки в Схеме движка. */
export const LAYOUT_NODE = "layout";
/** Имя узла колонки в Схеме движка. */
export const COLUMN_NODE = "layoutColumn";

const LAYOUT_TAG = 'div[data-block="layout"]';
const COLUMN_TAG = 'div[data-block="column"]';

/**
 * Контейнеры, где Раскладки нет: внутри них разбор снимает её обёртки. Это
 * общий список контейнерных Блоков (`containers.ts`: Обёртка, цитата, пункты
 * списков, ячейки) и ещё колонка — Раскладка в Раскладке. Обёртка
 * в нём есть: Раскладка в ней разворачивается в Блоки, а не разрезает Обёртку
 * надвое.
 */
const NO_LAYOUT_CONTEXT = containerFreeContext(COLUMN_NODE);

/** Доля колонки из чужого `style`: `flex-basis`, `flex: 1 1 50%` или `width` в процентах. */
function columnShare(column: Element): number | null {
  const style = (column as HTMLElement).style;
  const raw = style?.flexBasis || style?.width || "";
  return raw.endsWith("%") ? Number.parseFloat(raw) || null : null;
}

/**
 * Вариант Раскладки из разметки. Свой `data-layout` берётся, если число колонок
 * с ним сходится; иначе вариант подбирается по числу колонок и их долям — так
 * читается HTML чужого редактора с `flex-basis` и Раскладка, у которой колонку
 * удалили руками.
 */
function layoutOf(element: HTMLElement): EditorLayout {
  const columns = Array.from(element.children).filter((child) => child.matches(COLUMN_TAG));
  const declared = layoutFrom(element.getAttribute("data-layout"));
  if (columns.length === 0) return declared ?? DEFAULT_LAYOUT;
  if (declared && layoutColumnCount(declared) === columns.length) return declared;
  const shares = columns.map(columnShare);
  return nearestLayout(
    columns.length,
    shares.every((share) => share !== null) ? (shares as number[]) : []
  );
}

/**
 * Колонка — то, что Раскладка держит: Блоки, и в Markdown — подряд. С
 * инструментом `wrapper` — ещё Обёртку: она группирует Блоки и в
 * колонке, а Раскладки в себе не держит, поэтому вложенности не появляется.
 */
export const LayoutColumn = Node.create<{ wrapper: boolean }>({
  name: COLUMN_NODE,
  addOptions: () => ({ wrapper: false }),
  content() {
    return this.options.wrapper ? `(block | ${WRAPPER_NODE})+` : "block+";
  },
  isolating: true,
  /*
    Колонка — контейнер Блоков (`isBlockContainer`, `blockCommands.ts`): её дети
    — Блоки со своей ручкой у левого края колонки, а «Вверх», «Вниз»,
    «Добавить ниже» и `⌥⇧↑/↓` остаются внутри неё, как в Документе.
  */
  extendNodeSchema: (extension) => (extension.name === COLUMN_NODE ? { blockContainer: true } : {}),
  parseHTML: () => [
    { tag: COLUMN_TAG, context: NO_LAYOUT_CONTEXT, skip: true, priority: 60 },
    { tag: COLUMN_TAG },
  ],
  renderHTML: () => ["div", { "data-block": "column" }, 0],
  renderMarkdown: (node, helpers) =>
    node.content ? helpers.renderChildren(node.content, "\n\n") : "",
});

export const Layout = Node.create({
  name: LAYOUT_NODE,
  content: `${COLUMN_NODE}{1,4}`,
  isolating: true,
  addAttributes: () => ({
    variant: {
      default: DEFAULT_LAYOUT,
      parseHTML: (element) => layoutOf(element),
      // Пишет его `renderHTML` узла: значение сверяется с числом колонок.
      rendered: false,
    },
  }),
  parseHTML: () => [
    { tag: LAYOUT_TAG, context: NO_LAYOUT_CONTEXT, skip: true, priority: 60 },
    { tag: LAYOUT_TAG },
  ],
  /*
    Вариант пишется по узлу, а не по атрибуту: колонку без Раскладки разбор
    оборачивает Раскладкой по умолчанию, и до `fixLayouts` атрибут с числом
    колонок расходится. HTML с таким вариантом не выходит никогда.
  */
  renderHTML: ({ node, HTMLAttributes }) => [
    "div",
    { "data-block": "layout", ...HTMLAttributes, "data-layout": layoutOfNode(node) },
    0,
  ],
  /*
    Колонок в Markdown нет (решение владельца): Блоки колонок выгружаются
    подряд, слева направо — в том же порядке, в каком их читает скринридер.
  */
  renderMarkdown: (node, helpers) =>
    node.content ? helpers.renderChildren(node.content, "\n\n") : "",

  addCommands() {
    return {
      insertLayout:
        (variant = DEFAULT_LAYOUT) =>
        ({ tr, dispatch }) => {
          if (dispatch) placeLayout(tr, variant);
          return true;
        },
      setLayout:
        (variant) =>
        ({ tr, dispatch }) => {
          const found = layoutAt(tr.selection);
          if (!found) return false;
          if (dispatch) switchLayout(tr, found.pos, variant);
          return true;
        },
    };
  },

  /*
    Раскладка из `defaultValue` или `value`, у которой число колонок разошлось с
    вариантом (колонку удалили руками, колонка без Раскладки обернулась в
    Раскладку по умолчанию), приводится к варианту по числу колонок. Как
    выравнивание таблиц: не правка автора — без `onChange` и без записи в историю.
  */
  onCreate() {
    const tr = fixLayouts(this.editor.state.tr);
    if (tr) {
      this.editor.view.dispatch(tr.setMeta("preventUpdate", true).setMeta("addToHistory", false));
    }
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("layoutFix"),
        appendTransaction: (transactions, _old, state) =>
          transactions.some((tr) => tr.docChanged) ? fixLayouts(state.tr) : null,
        props: {
          transformPasted: (slice, view) =>
            view.state.selection.$from.depth > 1 ? flattenSlice(slice) : slice,
        },
      }),
    ];
  },
});

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    layout: {
      /**
       * Вставить Раскладку варианта `variant` (по умолчанию — две колонки) под
       * текущим Блоком верхнего уровня; пустой абзац верхнего уровня
       * заменяется. Каретка — в первую колонку.
       */
      insertLayout: (variant?: EditorLayout) => ReturnType;
      /**
       * Сменить вариант Раскладки под кареткой. Лишние колонки сливаются в
       * последнюю оставшуюся, недостающие добавляются пустыми — содержимое не
       * теряется. Не в Раскладке — `false`.
       */
      setLayout: (variant: EditorLayout) => ReturnType;
    };
  }
}

/** Раскладка под выделением: выделенная узлом или та, в колонке которой каретка. */
export function layoutAt(selection: Selection): { pos: number; node: PmNode } | null {
  if (selection instanceof NodeSelection && selection.node.type.name === LAYOUT_NODE) {
    return { pos: selection.from, node: selection.node };
  }
  const { $from } = selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth);
    if (node.type.name === LAYOUT_NODE) return { pos: $from.before(depth), node };
  }
  return null;
}

/**
 * Вариант узла Раскладки: его атрибут, если число колонок с ним сходится, иначе
 * вариант по числу колонок.
 */
export function layoutOfNode(node: PmNode): EditorLayout {
  const variant = layoutFrom(node.attrs.variant);
  return variant && layoutColumnCount(variant) === node.childCount
    ? variant
    : nearestLayout(node.childCount);
}

/** Вариант Раскладки под выделением или `null` — для отметки в меню «Формат ›». */
export function currentLayout(state: EditorState): EditorLayout | null {
  const found = layoutAt(state.selection);
  return found ? layoutOfNode(found.node) : null;
}

/** Пустая колонка: один пустой текстовый Блок. */
function isEmptyColumn(column: PmNode): boolean {
  const first = column.firstChild;
  return column.childCount === 1 && !!first?.isTextblock && first.content.size === 0;
}

function createLayout(state: { schema: EditorState["schema"] }, variant: EditorLayout): PmNode {
  const { schema } = state;
  const column = () => schema.nodes[COLUMN_NODE]!.create(null, schema.nodes.paragraph!.create());
  return schema.nodes[LAYOUT_NODE]!.create(
    { variant },
    Array.from({ length: layoutColumnCount(variant) }, column)
  );
}

/**
 * Место новой Раскладки — только верхний уровень Документа: её принимает он
 * один, и общий помощник (`placeContainerBlock`, `containers.ts`) поднимается
 * к нему из колонки, Обёртки, списка, цитаты или ячейки. Пустой абзац верхнего
 * уровня заменяется, пустой абзац колонки или Обёртки с `/` — убирается.
 */
function placeLayout(tr: Transaction, variant: EditorLayout): void {
  placeContainerBlock(tr, createLayout(tr.doc.type, variant));
}

/**
 * Сменить вариант Раскладки в `pos`.
 *
 * Лишние колонки СЛИВАЮТСЯ, а не удаляются: `join` двигает их Блоки в конец
 * последней оставшейся, и каретка, стоявшая в лишней колонке, едет вместе со
 * своим текстом. Пустые лишние колонки просто уходят — пустой абзац в чужой
 * колонке был бы мусором. Одна транзакция — одна отмена.
 */
function switchLayout(tr: Transaction, pos: number, variant: EditorLayout): void {
  const count = layoutColumnCount(variant);
  const layoutNode = () => tr.doc.nodeAt(pos)!;
  const columnStart = (index: number) => {
    let at = pos + 1;
    for (let i = 0; i < index; i++) at += layoutNode().child(i).nodeSize;
    return at;
  };
  // Пустые лишние колонки — с конца, чтобы позиции левых не сдвигались.
  for (let index = layoutNode().childCount - 1; index >= count; index--) {
    const column = layoutNode().child(index);
    if (isEmptyColumn(column) && layoutNode().childCount > 1) {
      const start = columnStart(index);
      tr.delete(start, start + column.nodeSize);
    }
  }
  while (layoutNode().childCount > count) tr.join(columnStart(count));
  const node = layoutNode();
  // Последняя оставшаяся была пустой, а в неё слились чужие Блоки: пустой абзац
  // сверху от неё не остаётся.
  if (node.childCount === count && count > 0) {
    const last = node.child(count - 1);
    if (
      last.childCount > 1 &&
      last.firstChild!.isTextblock &&
      last.firstChild!.content.size === 0
    ) {
      const start = columnStart(count - 1) + 1;
      tr.delete(start, start + last.firstChild!.nodeSize);
    }
  }
  const missing = count - layoutNode().childCount;
  if (missing > 0) {
    const { schema } = tr.doc.type;
    const columns = Array.from({ length: missing }, () =>
      schema.nodes[COLUMN_NODE]!.create(null, schema.nodes.paragraph!.create())
    );
    tr.insert(pos + layoutNode().nodeSize - 1, columns);
  }
  tr.setNodeMarkup(pos, undefined, { ...layoutNode().attrs, variant });
}

/**
 * Раскладки, у которых число колонок разошлось с вариантом, — к варианту по
 * числу колонок (60/40 остаётся 60/40, пока колонок две). Раскладки живут
 * только на верхнем уровне, поэтому обход — по детям Документа.
 */
function fixLayouts(tr: Transaction): Transaction | null {
  let changed = false;
  tr.doc.forEach((node, offset) => {
    if (node.type.name !== LAYOUT_NODE) return;
    const variant = layoutOfNode(node);
    if (variant === node.attrs.variant) return;
    tr.setNodeMarkup(offset, undefined, { ...node.attrs, variant });
    changed = true;
  });
  return changed ? tr : null;
}

/** Раскладки фрагмента — Блоками колонок подряд. */
function flatten(fragment: Fragment): Fragment {
  const nodes: PmNode[] = [];
  fragment.forEach((node) => {
    if (node.type.name === LAYOUT_NODE) {
      node.forEach((column) => column.forEach((block) => nodes.push(block)));
    } else {
      nodes.push(node);
    }
  });
  return Fragment.fromArray(nodes);
}

/**
 * Раскладка из буфера, вставленная не на верхний уровень (в колонку, список,
 * цитату, ячейку), разворачивается в Блоки: иначе ProseMirror, не найдя ей
 * места, разрезал бы контейнер вставки надвое. Открытые края фрагмента теряют
 * два уровня — Раскладку и колонку.
 */
function flattenSlice(slice: Slice): Slice {
  const { content } = slice;
  let hasLayout = false;
  content.forEach((node) => {
    if (node.type.name === LAYOUT_NODE) hasLayout = true;
  });
  if (!hasLayout) return slice;
  const open = (side: number, node: PmNode | null) =>
    node?.type.name === LAYOUT_NODE ? Math.max(0, side - 2) : side;
  return new Slice(
    flatten(content),
    open(slice.openStart, content.firstChild),
    open(slice.openEnd, content.lastChild)
  );
}

/*
  Проверка места под щель — та же, что у самого плагина щели (как в
  `tables.ts`): в типах пакета её нет (`@internal`).
*/
const gapCursorFits = ($pos: ResolvedPos): boolean =>
  (GapCursor as unknown as { valid($pos: ResolvedPos): boolean }).valid($pos);

/**
 * Колонка, у края которой стоит каретка: каждый предок текстового Блока до
 * колонки — крайний в своём родителе в сторону `dir`. Иначе `-1`.
 */
function columnAtEdge($head: ResolvedPos, dir: 1 | -1): number {
  for (let depth = $head.depth - 1; depth > 0; depth--) {
    const parent = $head.node(depth);
    const atEdge =
      dir < 0 ? $head.index(depth) === 0 : $head.indexAfter(depth) === parent.childCount;
    if (!atEdge) return -1;
    if (parent.type.name === COLUMN_NODE) return depth;
  }
  return -1;
}

/** Выйти из Раскладки вверх или вниз: в соседний Блок, а у края Документа — щелью. */
function leaveLayout(view: EditorView, layoutDepth: number, dir: 1 | -1): boolean {
  const { state } = view;
  const { $head } = state.selection;
  const $outside = state.doc.resolve(
    dir > 0 ? $head.after(layoutDepth) : $head.before(layoutDepth)
  );
  const next = Selection.findFrom($outside, dir);
  const selection = next ?? (gapCursorFits($outside) ? new GapCursor($outside) : null);
  if (!selection) return false;
  view.dispatch(state.tr.setSelection(selection).scrollIntoView());
  return true;
}

/**
 * Стрелки у края колонки.
 *
 * `←` и `→` — в соседнюю колонку (в конец левой, в начало правой), а из
 * крайней — из Раскладки. `↑` и `↓` у верхней и нижней строки любой колонки —
 * из Раскладки, к Блоку над ней или под ней. Браузер в сетке ведёт каретку по
 * геометрии: `↓` из короткой левой колонки попадал бы в середину правой, а то
 * и мимо Раскладки. Внутри колонки стрелки остаются браузеру.
 */
function arrow(view: EditorView, axis: "horizontal" | "vertical", dir: 1 | -1): boolean {
  const { selection, doc } = view.state;
  if (!(selection instanceof TextSelection) || !selection.empty) return false;
  const { $head } = selection;
  const columnDepth = columnAtEdge($head, dir);
  if (columnDepth < 0) return false;
  const side = axis === "vertical" ? (dir > 0 ? "down" : "up") : dir > 0 ? "right" : "left";
  if (!view.endOfTextblock(side)) return false;
  const layoutDepth = columnDepth - 1;
  if (axis === "horizontal") {
    const layout = $head.node(layoutDepth);
    const index = $head.index(layoutDepth) + dir;
    if (index >= 0 && index < layout.childCount) {
      const boundary = dir > 0 ? $head.after(columnDepth) : $head.before(columnDepth);
      const next = Selection.findFrom(doc.resolve(boundary), dir, true);
      if (!next) return false;
      view.dispatch(view.state.tr.setSelection(next).scrollIntoView());
      return true;
    }
  }
  return leaveLayout(view, layoutDepth, dir);
}

/** Узлы, которым Tab принадлежит в колонке: список, таблица, код. */
const TAB_OWNERS: ReadonlySet<string> = new Set([
  "listItem",
  "taskItem",
  "tableCell",
  "tableHeader",
  "codeBlock",
]);

/**
 * Tab и Shift+Tab — в начало следующей или предыдущей колонки, как Tab по
 * ячейкам таблицы. Список, таблица и блок кода внутри колонки оставляют Tab
 * себе. Из крайней колонки Tab уходит браузеру — фокус покидает Редактор, как из
 * любого абзаца: ловушки клавиатуры нет (WCAG 2.1.2).
 */
function tabToColumn(
  state: EditorState,
  dir: 1 | -1,
  dispatch?: (tr: Transaction) => void
): boolean {
  const { $from } = state.selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth);
    if (TAB_OWNERS.has(node.type.name)) return false;
    if (node.type.name !== COLUMN_NODE) continue;
    const layout = $from.node(depth - 1);
    const index = $from.index(depth - 1) + dir;
    if (index < 0 || index >= layout.childCount) return false;
    let start = $from.before(depth - 1) + 1;
    for (let i = 0; i < index; i++) start += layout.child(i).nodeSize;
    const target = Selection.findFrom(state.doc.resolve(start + 1), 1, true);
    if (!target) return false;
    dispatch?.(state.tr.setSelection(target).scrollIntoView());
    return true;
  }
  return false;
}

/**
 * Каретка в самом начале колонки (`dir < 0`) или в самом конце (`dir > 0`), с
 * пустым выделением.
 */
function atColumnBoundary(state: EditorState, dir: 1 | -1): boolean {
  const { selection } = state;
  if (!(selection instanceof TextSelection) || !selection.empty) return false;
  const { $head } = selection;
  const atTextEdge =
    dir < 0 ? $head.parentOffset === 0 : $head.parentOffset === $head.parent.content.size;
  return atTextEdge && columnAtEdge($head, dir) >= 0;
}

/** Стрелки и Tab между колонками. */
const LayoutKeys = Extension.create({
  name: "layoutKeys",
  addKeyboardShortcuts() {
    const view = () => this.editor.view;
    return {
      ArrowRight: () => arrow(view(), "horizontal", 1),
      ArrowLeft: () => arrow(view(), "horizontal", -1),
      ArrowDown: () => arrow(view(), "vertical", 1),
      ArrowUp: () => arrow(view(), "vertical", -1),
      Tab: () => this.editor.isEditable && tabToColumn(this.editor.state, 1, view().dispatch),
      "Shift-Tab": () =>
        this.editor.isEditable && tabToColumn(this.editor.state, -1, view().dispatch),
    };
  },
});

/**
 * Backspace в начале колонки и Delete в её конце — последними, после всех
 * правил ядра (`priority` ниже, чем у них). Заголовок в начале колонки ядро
 * ещё превращает в абзац, пункт списка — выносит из списка. Если же никто не
 * взялся, клавиша поглощается: `isolating` не даёт командам ProseMirror слить
 * колонки, и без поглощения правку сделал бы сам браузер — по DOM, мимо Схемы, и
 * колонки слились бы в одну.
 */
const LayoutBoundary = Extension.create({
  name: "layoutBoundary",
  priority: 1,
  addKeyboardShortcuts() {
    const guard = (dir: 1 | -1) => () =>
      this.editor.isEditable && atColumnBoundary(this.editor.state, dir);
    return { Backspace: guard(-1), Delete: guard(1) };
  },
});

/**
 * Всё, что нужно Раскладке, кроме Документа (`document.ts`): узлы и
 * клавиатура. `wrapper` — включён ли инструмент Обёртки: тогда колонка
 * принимает и её.
 */
export function layoutExtensions({ wrapper }: { wrapper: boolean }): Extensions {
  return [Layout, LayoutColumn.configure({ wrapper }), LayoutKeys, LayoutBoundary];
}
