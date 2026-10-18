"use client";

import type { Editor } from "@tiptap/core";
import type { FootnotesToolState } from "../../core/toolState.js";
import { footnotesChunk } from "./footnotesLoader.js";

/**
 * The Tool state snapshot of `footnotes` for `useRichTextToolState`. It lives in its own file, like
 * `searchSnapshot.ts`: only the hook needs it, and it must not end up in the Editor's static import
 * graph. The scan of the list comes from the lazy chunk (`footnotesChunk.ts`): an Editor whose Tool
 * set has footnotes is created after the Loader, so by the time a snapshot is asked for, it is there.
 */
export function footnotesSnapshot(editor: Editor): FootnotesToolState {
  const chunk = footnotesChunk();
  if (!chunk) return { footnotes: [], current: null };
  const { state } = editor;
  const footnotes = chunk.scanFootnotes(state.doc).notes.map(({ node }, index) => ({
    number: index + 1,
    // A hard break is a line break; the footnote has no other leaf that carries text.
    text: node.textBetween(0, node.content.size, "", (leaf) =>
      leaf.type.name === "hardBreak" ? "\n" : leaf.textContent
    ),
  }));
  return { footnotes, current: chunk.currentFootnoteNumber(state) };
}
