"use client";

import type { Node as PmNode } from "@tiptap/pm/model";
import type { EditorState } from "@tiptap/pm/state";
import { ListIcon, OrderedListIcon, TaskListIcon, TextIcon } from "../../icons.js";
import type { PrefixedName } from "./customTool.js";
import type { InsertItem } from "./insertItems.js";
import { shortcutKeys } from "./shortcuts.js";
import { projectRecords, type ToolList } from "./toolDescriptor.js";
import type { Tool } from "./tools.js";

/**
 * Пункт меню «¶» — тип Блока.
 *
 * Это пункт раздела «Превратить в» Меню вставки (`InsertItem`, `section:
 * "turnInto"`), и применяется он тем же `applyInsertItem`: сначала с Блока
 * снимаются обёртки (список, цитата), потом пункт оборачивает или меняет его
 * заново — одной транзакцией, на одну отмену. Своего пути смены типа у меню
 * нет: два пути разошлись бы на первом же списке внутри цитаты.
 *
 * Отдельный реестр, а не выборка из `INSERT_ITEMS`, потому что у меню «¶»
 * другие слова и иконки: «Текст» с иконкой `T`, а не
 * «Абзац» с пилкроу, и уровень заголовка на иконке. Блока кода в нём нет — у
 * него своя кнопка Панели.
 */
export interface BlockTypeItem extends InsertItem {
  section: "turnInto";
  /**
   * Инструмент, без которого пункта нет. У «Текста» — `null`: абзац есть всегда.
   * У пункта своего Инструмента — его имя (ADR-0058, п. 5): набор уже отфильтрован.
   */
  tool: Tool | PrefixedName | null;
  /** Второй нужный инструмент: H1 — надстройка над `heading`. */
  alsoTool?: Tool;
  keys: readonly string[];
}

/**
 * Пункты «¶» Инструмента из его описания — те же пункты «Превратить в» Меню
 * вставки: слова, иконка, сочетание и команда у них одни, поэтому вторую запись
 * Инструмент не пишет (ADR-0058, п. 5).
 */
export function turnIntoTypes(
  tool: Tool | PrefixedName,
  items: readonly InsertItem[]
): BlockTypeItem[] {
  return items
    .filter((item) => item.section === "turnInto")
    .map((item) => ({ ...item, section: "turnInto", tool, keys: item.keys ?? [] }));
}

/**
 * Пункты «¶» по порядку показа. Сочетания — подписи из общей таблицы
 * (`shortcuts.ts`), по тем же id, что у Меню вставки и справочника:
 * вешают их расширения движка, и подпись обязана совпадать с ними.
 */
export const BLOCK_TYPE_ITEMS: readonly BlockTypeItem[] = [
  {
    id: "text",
    section: "turnInto",
    tool: null,
    label: (m) => m.textBlock,
    icon: TextIcon,
    keys: shortcutKeys("paragraph"),
    run: (chain) => chain.setParagraph(),
  },
  {
    id: "bulletList",
    section: "turnInto",
    tool: "bulletList",
    label: (m) => m.bulletList,
    icon: ListIcon,
    keys: shortcutKeys("bulletList"),
    run: (chain) => chain.toggleBulletList(),
  },
  {
    id: "orderedList",
    section: "turnInto",
    tool: "orderedList",
    label: (m) => m.orderedList,
    icon: OrderedListIcon,
    keys: shortcutKeys("orderedList"),
    run: (chain) => chain.toggleOrderedList(),
  },
  {
    id: "taskList",
    section: "turnInto",
    tool: "taskList",
    label: (m) => m.taskList,
    icon: TaskListIcon,
    keys: shortcutKeys("taskList"),
    run: (chain) => chain.toggleTaskList(),
  },
];

/**
 * Место встроенных Инструментов в «¶». «Текст» стоит первым всегда: абзац —
 * не Инструмент. Держится отдельно от `BLOCK_TYPE_ITEMS`: Инструмент,
 * переехавший на описание (`toolDescriptor.ts`), уходит из реестра, а место
 * остаётся здесь.
 */
const BLOCK_TYPE_ORDER: readonly Tool[] = [
  "heading",
  "blockquote",
  "bulletList",
  "orderedList",
  "taskList",
];

/**
 * Пункты «¶» набора — проекция списка описаний: у переехавшего Инструмента —
 * из описания (`blockTypes`), у остальных — из `BLOCK_TYPE_ITEMS`.
 */
function blockTypeItemsOf(tools: ToolList): readonly BlockTypeItem[] {
  return [
    ...BLOCK_TYPE_ITEMS.filter((item) => item.tool === null),
    ...projectRecords(
      tools,
      BLOCK_TYPE_ORDER,
      (tool) => BLOCK_TYPE_ITEMS.filter((item) => item.tool === tool),
      (descriptor) => descriptor.blockTypes
    ),
  ].filter((item) => item.alsoTool === undefined || tools.has(item.alsoTool));
}

/**
 * Пункты, которые «¶» больше не предлагает: списки живут в меню
 * «Списки ▾», цитата — флажком в «…». В «Формат ›» ручки Блока и в «/» они
 * остаются: там Блок превращают во что угодно, а не выбирают тип строки.
 */
const notInBlockTypeMenu = (id: string) =>
  id === "blockquote" || (LIST_TYPES as readonly string[]).includes(id);

/**
 * Пункты «¶» для набора инструментов: «Текст», заголовки и пункты своих
 * Инструментов. Меню из одного «Текста» ничего не выбирает, и тогда список
 * пуст: кнопки «¶» на Панели нет.
 */
export function blockTypeItemsFor(tools: ToolList): readonly BlockTypeItem[] {
  const items = blockTypeItemsOf(tools).filter((item) => !notInBlockTypeMenu(item.id));
  return items.length > 1 ? items : [];
}

/**
 * Пункты «Формат ›» ручки Блока: весь набор «Превратить в» —
 * с цитатой и списками, в отличие от «¶» (решение владельца).
 */
export function formatItemsFor(tools: ToolList): readonly BlockTypeItem[] {
  const items = blockTypeItemsOf(tools);
  return items.length > 1 ? items : [];
}

/** Пункт цитаты набора — для флажка «Цитата» в «…»; без инструмента — `undefined`. */
export function quoteItemFor(tools: ToolList): BlockTypeItem | undefined {
  return blockTypeItemsOf(tools).find((item) => item.id === "blockquote");
}

/** Обёртки, которые сами — тип Блока в «Формат ›» ручки. */
const WRAPPERS: Record<string, string> = {
  blockquote: "blockquote",
  bulletList: "bulletList",
  orderedList: "orderedList",
  taskList: "taskList",
};

/** Тип текстового Блока: `id` пункта «¶», `"codeBlock"` или `null` (не текст). */
function textBlockType(block: PmNode): string | null {
  if (block.type.name === "heading") return `heading${String(block.attrs.level)}`;
  if (block.type.name === "codeBlock") return "codeBlock";
  if (block.type.name === "paragraph") return "text";
  return null;
}

/**
 * Текущий тип Блока под началом выделения: `id` пункта «¶», `"codeBlock"` или
 * `null` (выделен не текст — картинка, разделитель).
 *
 * РЕШАЕТ СТРОКА ПОД КАРЕТКОЙ (решение владельца). Списков и цитаты
 * в «¶» больше нет, и абзац в пункте списка или в цитате — это «Текст», а
 * заголовок в цитате — его уровень. Список и цитату показывают свои кнопки:
 * «Списки ▾» и флажок «Цитата» в «…». Прежде решала ближайшая обёртка.
 */
export function currentBlockType(state: EditorState): string | null {
  return textBlockType(state.selection.$from.parent);
}

/**
 * Тип Блока целиком — для «Формат ›» ручки Блока: решает сам
 * Блок, а не текст под кареткой. Цитата со списком внутри — «Цитата»: ручка
 * превращает всю цитату. `null` — Блок, который превратить нельзя (таблица,
 * картинка, линия).
 */
export function blockTypeOf(block: PmNode): string | null {
  return WRAPPERS[block.type.name] ?? textBlockType(block);
}

/** Виды списка — id пунктов «Превратить в» Меню вставки и имена узлов Схемы. */
export const LIST_TYPES = ["bulletList", "orderedList", "taskList"] as const;

export type ListType = (typeof LIST_TYPES)[number];

/**
 * Пункты меню «Списки» — те же пункты «Превратить в» Меню вставки,
 * что и виды списка: одни слова, иконки, сочетания и одна команда. В отличие от «¶», меню из одного
 * пункта остаётся меню: «Чек-лист» без соседей — всё равно выбор вида списка.
 */
export function listTypeItemsFor(tools: ToolList): readonly BlockTypeItem[] {
  return blockTypeItemsOf(tools).filter((item) =>
    (LIST_TYPES as readonly string[]).includes(item.id)
  );
}

/**
 * Вид ближайшего списка вокруг начала выделения или `null` — каретка не в
 * списке. Цитата между текстом и списком не мешает: пункт списка с цитатой
 * внутри всё равно пункт списка, и снимать меню «Списки» должно его.
 */
export function currentListType(state: EditorState): ListType | null {
  const { $from } = state.selection;
  for (let depth = $from.depth - 1; depth > 0; depth--) {
    const name = $from.node(depth).type.name;
    if ((LIST_TYPES as readonly string[]).includes(name)) return name as ListType;
  }
  return null;
}
