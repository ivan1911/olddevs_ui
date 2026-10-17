"use client";

import type { Editor } from "@tiptap/core";
import type { InvisibleCharactersToolState } from "../../core/toolState.js";
import { invisibleCharactersVisible } from "./invisibleCharactersVisible.js";

/**
 * The Tool state snapshot of `invisibleCharacters` for `useRichTextToolState`. It lives in its
 * own file, like `searchSnapshot.ts`: only the hook needs it, and it must not end up in the
 * Editor's static import graph.
 */
export function invisibleCharactersSnapshot(editor: Editor): InvisibleCharactersToolState {
  return { visible: invisibleCharactersVisible(editor) };
}
