"use client";

import { TaskItem, TaskList } from "@tiptap/extension-list";
import { ListIcon, OrderedListIcon, TaskListIcon } from "../../../icons.js";
import { turnIntoTypes } from "../../core/blockTypes.js";
import type { InsertItem } from "../../core/insertItems.js";
import { SHORTCUT_KEYS, shortcutKeys, type ShortcutCommand } from "../../core/shortcuts.js";
import type { ToolDescriptor } from "../../core/toolDescriptor.js";

/**
 * Три вида списка на описаниях Инструментов: маркированный, нумерованный и
 * чек-лист.
 *
 * Пункт один на три поверхности: Меню вставки, «Формат ›» ручки Блока и меню
 * «Списки ▾» читают те же слова, иконку и сочетание (`turnIntoTypes`). Виджет
 * «Списки ▾» (`ListMenu`) и кнопки отступа остаются у кита, показ — по
 * `has(name)`; строки отступа `indentListItem` и `outdentListItem` — общие для
 * трёх списков и лежат в `SHORTCUTS`. Пункт списка (`ListItem`) и клавиши
 * `ListKeymap` — в ядре, они есть в любом наборе.
 *
 */

/** Строка справочника: клавишу вешает расширение Tiptap, строка — подпись к ней. */
function shortcutOf(id: "bulletList" | "orderedList" | "taskList"): ShortcutCommand {
  return {
    id,
    group: "lists",
    tool: id,
    keys: SHORTCUT_KEYS[id],
    label: (m) => m[id],
  };
}

const BULLET_LIST_ITEMS: readonly InsertItem[] = [
  {
    id: "bulletList",
    section: "turnInto",
    label: (m) => m.bulletList,
    icon: ListIcon,
    aliases: ["ul", "-"],
    markdown: "-",
    keys: shortcutKeys("bulletList"),
    run: (chain) => chain.toggleBulletList(),
  },
];

const ORDERED_LIST_ITEMS: readonly InsertItem[] = [
  {
    id: "orderedList",
    section: "turnInto",
    label: (m) => m.orderedList,
    icon: OrderedListIcon,
    aliases: ["ol", "1."],
    markdown: "1.",
    keys: shortcutKeys("orderedList"),
    run: (chain) => chain.toggleOrderedList(),
  },
];

const TASK_LIST_ITEMS: readonly InsertItem[] = [
  {
    id: "taskList",
    section: "turnInto",
    label: (m) => m.taskList,
    icon: TaskListIcon,
    aliases: ["todo", "[]"],
    markdown: "[ ]",
    keys: shortcutKeys("taskList"),
    run: (chain) => chain.toggleTaskList(),
  },
];

/**
 * Маркированный список. Расширение — доля StarterKit: `{}` включает его
 * умолчание так же, как прежний `undefined`.
 */
export const BULLET_LIST_TOOL: ToolDescriptor = {
  name: "bulletList",
  starterKit: () => ({ bulletList: {} }),
  insertItems: BULLET_LIST_ITEMS,
  blockTypes: turnIntoTypes("bulletList", BULLET_LIST_ITEMS),
  shortcuts: [shortcutOf("bulletList")],
};

/** Нумерованный список: `start` и `1.` в Markdown — умолчания StarterKit. */
export const ORDERED_LIST_TOOL: ToolDescriptor = {
  name: "orderedList",
  starterKit: () => ({ orderedList: {} }),
  insertItems: ORDERED_LIST_ITEMS,
  blockTypes: turnIntoTypes("orderedList", ORDERED_LIST_ITEMS),
  shortcuts: [shortcutOf("orderedList")],
};

/**
 * Чек-лист. Подпись флажка пункта — из каталога, читается при каждой
 * перерисовке пункта (`context.taskCheckbox`), поэтому смена локали не
 * пересоздаёт движок.
 */
export const TASK_LIST_TOOL: ToolDescriptor = {
  name: "taskList",
  engine: (context) => [
    TaskList,
    TaskItem.configure({
      // Вложенные чек-листы — как вложенные обычные списки: Tab и Shift+Tab.
      nested: true,
      a11y: { checkboxLabel: (node) => context.taskCheckbox(node.textContent) },
    }),
  ],
  insertItems: TASK_LIST_ITEMS,
  blockTypes: turnIntoTypes("taskList", TASK_LIST_ITEMS),
  shortcuts: [shortcutOf("taskList")],
};
