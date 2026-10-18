"use client";

import type { Editor } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";

/**
 * The focus mode's plugin key and its two small reads and writes. They live apart from the
 * extension (`focusModeExtension.ts`) because the "…" menu of the Toolbar (which is in the starting
 * graph) and the Tool state hook (which is not) need them too, and neither needs the extension's code.
 */
export const FOCUS_MODE_KEY = new PluginKey<{ enabled: boolean }>("focusMode");

/** Whether the focus mode is on. `false` also means the extension is not in the engine. */
export function focusModeEnabled(editor: Editor): boolean {
  return FOCUS_MODE_KEY.getState(editor.state)?.enabled === true;
}

/**
 * Turn the mode on or off. The only path, for the "Focus mode" item of the "…" menu and for the
 * `tool("focus").toggle()` command. It is a transaction with a meta and no change to the Document,
 * kept out of the edit history. `false` means the extension is not in the engine.
 */
export function toggleFocusMode(editor: Editor): boolean {
  const current = FOCUS_MODE_KEY.getState(editor.state);
  if (!current) return false;
  editor.view.dispatch(
    editor.state.tr
      .setMeta(FOCUS_MODE_KEY, { enabled: !current.enabled })
      .setMeta("addToHistory", false)
  );
  return true;
}
