"use client";

import { Extension } from "@tiptap/core";
import { handleBlock } from "./blockCommands.js";
import { applyInsertItem, type InsertItem } from "./insertItems.js";
import { keymapName } from "./toolButtons.js";
import { blockActionVisible, type BlockAction } from "./toolDescriptor.js";

export interface ToolEntryShortcutsOptions {
  /** Insert items that have a shortcut, in the order of the descriptor list. */
  insertItems: readonly InsertItem[];
  /** Block actions that have a shortcut, in the order of the descriptor list. */
  blockActions: readonly BlockAction[];
}

/**
 * Shortcuts of the insert items and Block actions of the descriptors (ADR-0058, item 5.7): the
 * shortcut is a field of the entry and the only source of the key, so the kit binds the key itself.
 *
 * An item is applied the same way as from the Slash menu at the caret (`applyInsertItem`: one edit,
 * one undo). An action runs on the Block under the caret, the same Block that the Block handle picks
 * (`handleBlock`), and only where the action is visible in the handle's menu. On another Block the
 * key falls through to the Document.
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
