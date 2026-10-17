"use client";

import type { Editor } from "@tiptap/core";
import type { SearchToolState } from "../../core/toolState.js";
import { searchState } from "./searchPlugin.js";

/**
 * Snapshot of the `search` Tool state for `useRichTextToolState`: the public properties of
 * the plugin's `searchState` plus whether the Find panel is open, without match
 * positions. It lives apart from `searchPlugin.ts`: only the hook needs this
 * calculation, and it must not end up in the Editor's static graph.
 *
 * The flags come from the plugin even when the panel is closed: the engine holds them,
 * not the panel. Closing resets them to the starting Tool options, and `setQuery`
 * without the panel sets its own. `null` means there is no plugin (the `search` Tool is
 * not in the engine).
 */
export function searchSnapshot(editor: Editor, open: boolean): SearchToolState | null {
  const state = searchState(editor.state);
  if (!state) return null;
  const { matchCase, wholeWord, regex } = state.options;
  return {
    open,
    query: state.query,
    flags: { matchCase, wholeWord, regex },
    total: state.total,
    current: state.current,
    error: state.error ?? null,
  };
}
