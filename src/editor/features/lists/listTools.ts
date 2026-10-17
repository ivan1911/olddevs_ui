"use client";

import { TaskItem, TaskList } from "@tiptap/extension-list";
import { ListIcon, OrderedListIcon, TaskListIcon } from "../../../icons.js";
import { turnIntoTypes } from "../../core/blockTypes.js";
import type { InsertItem } from "../../core/insertItems.js";
import { SHORTCUT_KEYS, shortcutKeys, type ShortcutCommand } from "../../core/shortcuts.js";
import type { ToolDescriptor } from "../../core/toolDescriptor.js";

/**
 * Three kinds of list on the Tool descriptors: bulleted, numbered and task list.
 *
 * Each item appears on three surfaces: the Slash menu, the "Format ›" of the Block handle, and the
 * "Lists ▾" menu. All three read the same words, icon and shortcut (`turnIntoTypes`). The
 * "Lists ▾" widget (`ListMenu`) and the indent buttons stay with the kit and are shown by
 * `has(name)`. The indent rows `indentListItem` and `outdentListItem` are shared by the three
 * lists and live in `SHORTCUTS`. The list item (`ListItem`) and the `ListKeymap` keys are in
 * the core, so they are present in any preset.
 *
 */

/** Shortcuts reference row: the Tiptap extension binds the key, and the row is its label. */
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
 * Bulleted list. The extension is a part of StarterKit: `{}` turns on its default, the same
 * as the former `undefined`.
 */
export const BULLET_LIST_TOOL: ToolDescriptor = {
  name: "bulletList",
  starterKit: () => ({ bulletList: {} }),
  insertItems: BULLET_LIST_ITEMS,
  blockTypes: turnIntoTypes("bulletList", BULLET_LIST_ITEMS),
  shortcuts: [shortcutOf("bulletList")],
};

/** Numbered list: `start` and `1.` in Markdown are the StarterKit defaults. */
export const ORDERED_LIST_TOOL: ToolDescriptor = {
  name: "orderedList",
  starterKit: () => ({ orderedList: {} }),
  insertItems: ORDERED_LIST_ITEMS,
  blockTypes: turnIntoTypes("orderedList", ORDERED_LIST_ITEMS),
  shortcuts: [shortcutOf("orderedList")],
};

/**
 * Task list. The label of the item's checkbox comes from the catalog and is read on every
 * re-render of the item (`context.taskCheckbox`), so a locale change does not recreate the
 * engine.
 */
export const TASK_LIST_TOOL: ToolDescriptor = {
  name: "taskList",
  engine: (context) => [
    TaskList,
    TaskItem.configure({
      // Nested task lists work like nested regular lists: Tab and Shift+Tab.
      nested: true,
      a11y: { checkboxLabel: (node) => context.taskCheckbox(node.textContent) },
    }),
  ],
  insertItems: TASK_LIST_ITEMS,
  blockTypes: turnIntoTypes("taskList", TASK_LIST_ITEMS),
  shortcuts: [shortcutOf("taskList")],
};
