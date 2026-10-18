"use client";

import type { Editor } from "@tiptap/core";
import { BlockSelection } from "../../core/blockSelection.js";
import type { BlockSelectionToolState } from "../../core/toolState.js";

/**
 * The Tool state snapshot of `blockSelection` for `useRichTextToolState`. It lives in its own
 * file, like `searchSnapshot.ts`: only the hook needs it, and it must not end up in the Editor's
 * static import graph.
 */
export function blockSelectionSnapshot(editor: Editor): BlockSelectionToolState {
  const { selection } = editor.state;
  return { count: selection instanceof BlockSelection ? selection.count : 0 };
}
