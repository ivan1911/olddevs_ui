"use client";

import { RedoIcon, UndoIcon } from "../../../icons.js";
import { SHORTCUT_KEYS } from "../../core/shortcuts.js";
import type { ToolDescriptor } from "../../core/toolDescriptor.js";

/**
 * Отмена и повтор на описании Инструмента.
 *
 * Расширение — доля StarterKit (`undoRedo`): `{}` включает его умолчание так же,
 * как прежний `undefined`. Клавиши `Mod+Z` и `Mod+Shift+Z` вешает оно, а не
 * кнопки: поэтому у кнопок `keys` (подпись для подсказки, `aria-keyshortcuts` и
 * справочника), а не `shortcut` — тот привязал бы клавишу второй раз. Строки
 * справочника — те же кнопки с группой «История» (`shortcutGroup`), отдельных
 * `shortcuts` у Инструмента нет: иначе строка встала бы дважды.
 *
 * Место кнопок — последняя группа Панели (`slot("history")`, `EditorToolbar.tsx`).
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
