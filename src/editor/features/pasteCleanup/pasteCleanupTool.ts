"use client";

import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { ToolDescriptor } from "../../core/toolDescriptor.js";
// Type only: a static import of the module would pull the steps into the start bundle.
import type * as CleanupModule from "./cleanPastedHtml.js";

/*
  WHY A CHUNK, AND WHY NOT A LOADER. The steps are about 7 kB gzip, and they are needed only at the
  moment of a paste, while the Tool is in both presets. A Tool Loader (`toolLoader.ts`) would delay
  the engine until the chunk arrives, and `basic`, ready in `render` today, would start showing the
  Skeleton. So the engine is created at once, and the chunk starts loading when the Editor's view
  appears. A paste in the first moments after mount, before the chunk has arrived, goes in without
  cleanup: the same result as a failed step, and the same as before the Tool existed.
*/
let cleanup: typeof CleanupModule.cleanPastedHtml | undefined;
let loading: Promise<void> | undefined;

/** Load the cleanup steps once per page. Exported for tests that paste right after `render`. */
export function loadPasteCleanup(): Promise<void> {
  loading ??= import("./cleanPastedHtml.js").then(
    (module) => {
      cleanup = module.cleanPastedHtml;
    },
    () => {
      // A failed chunk leaves pastes uncleaned; the next Editor tries again.
      loading = undefined;
    }
  );
  return loading;
}

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
        view: () => {
          void loadPasteCleanup();
          return {};
        },
        props: { transformPastedHTML: (html) => (cleanup ? cleanup(html) : html) },
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
