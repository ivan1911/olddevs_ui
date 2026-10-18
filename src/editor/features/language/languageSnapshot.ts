"use client";

import type { Editor } from "@tiptap/core";
import type { LanguageToolState } from "../../core/toolState.js";
import { primaryLanguageOf, selectedLanguage } from "./languageState.js";

/**
 * The Tool state snapshot of `language` for `useRichTextToolState`. It lives in its own file, like
 * `searchSnapshot.ts`: only the hook needs it, and it must not end up in the Editor's static import
 * graph.
 */
export function languageSnapshot(editor: Editor): LanguageToolState {
  return { current: selectedLanguage(editor.state).current, primary: primaryLanguageOf(editor) };
}
