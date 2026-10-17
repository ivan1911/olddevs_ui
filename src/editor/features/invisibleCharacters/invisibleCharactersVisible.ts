"use client";

import type { Editor } from "@tiptap/core";

/**
 * Whether invisible characters are shown. The extension's plugin keeps the flag in its own state
 * and exposes it through `storage` (`visibility()`). It is read on every call: once the engine is
 * created, the extension replaces `visibility` with a read of the plugin's state. `false` means
 * the extension is not in the engine.
 *
 * It lives apart from `invisibleCharactersTool.ts` and from the Tool state snapshot. The read is
 * needed both by the "…" menu of the Toolbar (which is in the starting graph) and by the hook
 * (which is not). Neither needs the Tiptap package: the Toolbar does not import it.
 */
export function invisibleCharactersVisible(editor: Editor): boolean {
  const storage = editor.storage as {
    invisibleCharacters?: { visibility?: () => boolean | undefined };
  };
  return storage.invisibleCharacters?.visibility?.() === true;
}

/**
 * Toggle the display. This is the only path, both for the "Invisible characters" item of the "…"
 * menu and for the `tool("invisibleCharacters").toggle()` command. It sits next to the read, not
 * in the Tool's description: the item lives in the Toolbar from the starting graph, and it does
 * not need the Tiptap package. `false` means the extension is not in the engine.
 */
export function toggleInvisibleCharacters(editor: Editor): boolean {
  return editor.commands.toggleInvisibleCharacters();
}
