"use client";

import type { Editor } from "@tiptap/core";
import type { FootnotesToolState } from "../../core/toolState.js";
import { currentFootnoteNumber } from "./footnoteCommands.js";
import { scanFootnotes } from "./footnoteSync.js";

/**
 * The Tool state snapshot of `footnotes` for `useRichTextToolState`. It lives in its own file, like
 * `searchSnapshot.ts`: only the hook needs it, and it must not end up in the Editor's static import
 * graph.
 */
export function footnotesSnapshot(editor: Editor): FootnotesToolState {
  const { state } = editor;
  const footnotes = scanFootnotes(state.doc).notes.map(({ node }, index) => ({
    number: index + 1,
    // A hard break is a line break; the footnote has no other leaf that carries text.
    text: node.textBetween(0, node.content.size, "", (leaf) =>
      leaf.type.name === "hardBreak" ? "\n" : leaf.textContent
    ),
  }));
  return { footnotes, current: currentFootnoteNumber(state) };
}
