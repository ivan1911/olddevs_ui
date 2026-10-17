"use client";

import type { Editor } from "@tiptap/core";
import type { ToolDescriptor } from "../../core/toolDescriptor.js";
import type { SearchToolCommands } from "../../core/toolCommands.js";
import type { SearchToolOptions } from "../../core/toolOptions.js";
import { SearchExtension } from "./searchPlugin.js";

/**
 * Find and replace, described in the Tool description. Extensions: the state and
 * highlight plugin with the `Mod+F` and `Mod+Alt+F` shortcuts. The panel is held by
 * `RichTextEditor` and opened through the `openSearch` bridge. The "Search" button is a
 * widget of the fixed Toolbar at its right edge (`EditorToolbar.tsx`), like the shortcut
 * reference rather than a `buttons` entry: the panel attaches to the corner of the field,
 * not to the button or the selection.
 */
/**
 * Keys of the "Search" button: the shortcut reference row and the button hint come from
 * one entry.
 */
export const SEARCH_KEYS = ["mod", "F"] as const;

/** Starting flags of the panel: all off. */
export const SEARCH_DEFAULTS: SearchToolOptions = {
  matchCase: false,
  wholeWord: false,
  regex: false,
};

const isFlag = (value: unknown) => typeof value === "boolean";

/*
  Show the current match after a command. ProseMirror scrolls only when focus is in the
  Document, while commands can also come from a screen button. The scroll code
  (`revealMatch.ts`) sits in the panel's lazy chunk and is not part of the initial
  bundle: it loads on the first call, so the scroll arrives a microtask and a frame
  later. An open panel has already loaded it, and its moves merge with this call into
  one scroll.
*/
const reveal = (editor: Editor, done: boolean) => {
  if (done) void import("./revealMatch.js").then((module) => module.scheduleRevealMatch(editor));
  return done;
};

export const SEARCH_TOOL: ToolDescriptor = {
  name: "search",
  defaults: SEARCH_DEFAULTS,
  checks: { matchCase: isFlag, wholeWord: isFlag, regex: isFlag },
  /*
    Query, navigation and replacement are engine commands, as for the panel; the panel
    and the HTML mode reach them through the bridge. `editor.commands` is read on every
    call, not once: Tiptap builds it together with the transaction, and a saved set
    would be stale.
  */
  commands: ({ editor, bridge }): SearchToolCommands => ({
    open: (options) => bridge.openSearch(options?.replace === true, options?.query),
    close: bridge.closeSearch,
    setQuery: (query, flags) =>
      !bridge.sourceOpen() &&
      editor.commands.setSearch(query, flags) &&
      (reveal(editor, query !== ""), true),
    next: () => reveal(editor, editor.commands.searchStep(1)),
    previous: () => reveal(editor, editor.commands.searchStep(-1)),
    replace: (text) => editor.commands.replaceMatch(text),
    replaceAll: (text) => editor.commands.replaceAllMatches(text),
  }),
  engine: (context, options) => [
    SearchExtension.configure({
      open: context.openSearch ?? (() => false),
      flags: options as SearchToolOptions,
    }),
  ],
  shortcuts: [
    { id: "search", group: "search", tool: "search", keys: SEARCH_KEYS, label: (m) => m.search },
    {
      id: "searchReplace",
      group: "search",
      tool: "search",
      keys: ["mod", "alt", "F"],
      label: (m) => m.searchReplace,
    },
  ],
};
