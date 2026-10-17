"use client";

import { RedoIcon, UndoIcon } from "../../../icons.js";
import { SHORTCUT_KEYS } from "../../core/shortcuts.js";
import type { ToolDescriptor } from "../../core/toolDescriptor.js";

/**
 * Undo and redo on the Tool description.
 *
 * The extension is part of StarterKit (`undoRedo`): `{}` turns it on with its default, just as the
 * former `undefined` did. `Mod+Z` and `Mod+Shift+Z` are bound by the extension, not by the buttons.
 * So the buttons have `keys` (the hint label, `aria-keyshortcuts` and the reference), not `shortcut`,
 * which would bind the key a second time. The reference rows are the same buttons in the "History"
 * group (`shortcutGroup`); the Tool has no separate `shortcuts`, or the row would appear twice.
 *
 * The buttons go in the last group of the Toolbar (`slot("history")`, `EditorToolbar.tsx`).
 */
export const HISTORY_TOOL: ToolDescriptor = {
  name: "history",
  starterKit: () => ({ undoRedo: {} }),
  buttons: [
    {
      id: "undo",
      label: ({ messages }) => messages.undo,
      icon: UndoIcon,
      keys: SHORTCUT_KEYS.undo,
      shortcutGroup: "history",
      run: (editor) => void editor.chain().focus().undo().run(),
      can: (editor) => editor.can().undo(),
    },
    {
      id: "redo",
      label: ({ messages }) => messages.redo,
      icon: RedoIcon,
      keys: SHORTCUT_KEYS.redo,
      shortcutGroup: "history",
      run: (editor) => void editor.chain().focus().redo().run(),
      can: (editor) => editor.can().redo(),
    },
  ],
};
