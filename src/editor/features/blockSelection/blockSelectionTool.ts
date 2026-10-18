"use client";

import { DEFAULT_MESSAGES } from "../../../i18n/defaults.js";
import { SHORTCUT_KEYS } from "../../core/shortcuts.js";
import type { ToolDescriptor } from "../../core/toolDescriptor.js";
import type { BlockSelectionToolCommands } from "../../core/toolCommands.js";
import { loaded } from "../../core/toolLoader.js";
// Type only: a static import of the module would pull the chunk into the start bundle.
import type * as BlockSelectionChunk from "./blockSelectionChunk.js";

const loadBlockSelection = () => import("./blockSelectionChunk.js");

/**
 * Block selection on the Tool's description (ADR-0077): `Esc` in the text selects the current
 * Block, `Shift+↑/↓` and `Shift+click` grow the selection, and the keys and the clipboard then act on
 * the Blocks. The engine is one extension (`blockSelectionExtension.ts`); the selection itself is
 * the core's `BlockSelection`, which the Block handle reads in every Editor.
 *
 * The extension is lazy (ADR-0058, item 11.1): it is outside `basic`, and the keys, the decorations
 * and the moves are the whole Tool, so a Loader brings them and the start chunk pays only for this
 * description. Until it loads the Editor is the Skeleton, with no engine: `Esc` does nothing, the
 * handle's menu is not on screen, and the Handle's `selectCurrent()` and `clear()` return `false`.
 *
 * There is no Schema, no Markdown and no markup: the mode leaves no trace in the saved HTML, in
 * `RichTextView` or in the JSON. The "Select" item of the Block handle's menu belongs to the handle
 * (`BlockHandle.tsx`) and is shown when the Tool is on. The two reference rows below are labels:
 * the keys are bound by the extension.
 */
export const BLOCK_SELECTION_TOOL: ToolDescriptor = {
  name: "blockSelection",
  load: loadBlockSelection,
  // The engine is built after the loader, so the chunk is there (as for `table`).
  engine: (context) => [
    (loaded(loadBlockSelection) as typeof BlockSelectionChunk).BlockSelectionExtension.configure({
      onNotice: context.onNotice,
      messages: () => context.editorMessages?.() ?? DEFAULT_MESSAGES.editor,
    }),
  ],
  shortcuts: [
    {
      id: "blockSelect",
      group: "selection",
      tool: "blockSelection",
      keys: SHORTCUT_KEYS.blockSelect,
      label: (m) => m.blockSelectionSelect,
    },
    {
      id: "blockExtend",
      group: "selection",
      tool: "blockSelection",
      keys: SHORTCUT_KEYS.blockExtend,
      label: (m) => m.blockSelectionExtend,
    },
  ],
  /*
    `editor.commands` is read on every call, as in `search`. In Source mode the Document is not on
    screen, so there is nothing to select: `false` (the commands refuse a disabled field themselves).
  */
  commands: ({ editor, bridge }): BlockSelectionToolCommands => ({
    selectCurrent: () => !bridge.sourceOpen() && editor.commands.selectBlocks(),
    clear: () => editor.commands.clearBlockSelection(),
  }),
};
