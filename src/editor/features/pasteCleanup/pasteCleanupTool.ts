"use client";

import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { ToolDescriptor } from "../../core/toolDescriptor.js";
import { cleanPastedHtml } from "./cleanPastedHtml.js";

/**
 * The paste cleanup as a ProseMirror prop: `transformPastedHTML` runs on the clipboard HTML before
 * the Schema parses it, so it can only change what the Schema then reads, never widen it.
 */
const PasteCleanup = Extension.create({
  name: "pasteCleanup",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("pasteCleanup"),
        props: { transformPastedHTML: (html) => cleanPastedHtml(html) },
      }),
    ];
  },
});

/**
 * Paste cleanup on the Tool descriptor (OLDSUI-274, ADR-0075): clipboard HTML from Word, Excel,
 * Google Docs and SharePoint keeps its meaning (lists, headings, highlights) instead of losing it to
 * the Schema. No Schema, buttons, items, state or commands of its own. It is in both presets: it
 * does not change what the author types, only what the Schema reads from a paste, and it leaves HTML
 * from other sources untouched.
 */
export const PASTE_CLEANUP_TOOL: ToolDescriptor = {
  name: "pasteCleanup",
  engine: () => [PasteCleanup],
};
