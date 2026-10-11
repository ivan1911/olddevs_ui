"use client";

import { Extension } from "@tiptap/core";
import { handleBlock } from "./blockCommands.js";
import { applyInsertItem, type InsertItem } from "./insertItems.js";
import { keymapName } from "./toolButtons.js";
import { blockActionVisible, type BlockAction } from "./toolDescriptor.js";

export interface ToolEntryShortcutsOptions {
  /** Пункты вставки с сочетанием — в порядке списка описаний. */
  insertItems: readonly InsertItem[];
  /** Действия над Блоком с сочетанием — в порядке списка описаний. */
  blockActions: readonly BlockAction[];
}

/**
 * Сочетания пунктов вставки и Действий над Блоком описаний (ADR-0058, п. 5.7):
 * сочетание — поле записи и единственный источник клавиши, поэтому её вешает кит.
 *
 * Пункт применяется так же, как из Меню вставки у каретки (`applyInsertItem`:
 * одна правка, одна отмена). Действие — над Блоком под кареткой, тем же Блоком,
 * который выбирает Ручка (`handleBlock`), и только там, где оно видно в её
 * меню: на чужом Блоке клавиша идёт дальше, в Документ.
 */
export const ToolEntryShortcuts = Extension.create<ToolEntryShortcutsOptions>({
  name: "toolEntryShortcuts",

  addOptions: () => ({ insertItems: [], blockActions: [] }),

  addKeyboardShortcuts() {
    const { editor } = this;
    const insert = this.options.insertItems.flatMap((item) =>
      item.shortcut
        ? [
            [
              keymapName(item.shortcut),
              () => {
                if (!editor.isEditable) return false;
                applyInsertItem(editor, item, null);
                return true;
              },
            ] as const,
          ]
        : []
    );
    const act = this.options.blockActions.flatMap((action) =>
      action.shortcut
        ? [
            [
              keymapName(action.shortcut),
              () => {
                const block = editor.isEditable ? handleBlock(editor.state) : null;
                if (!block) return false;
                const name = block.parent.child(block.startIndex).type.name;
                const place = { name, container: block.parent.type.name };
                if (!blockActionVisible(action, editor, block.start, place)) return false;
                action.run(editor, block.start);
                return true;
              },
            ] as const,
          ]
        : []
    );
    return Object.fromEntries([...insert, ...act]);
  },
});
