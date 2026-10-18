"use client";

import type { ToolDescriptor } from "../../core/toolDescriptor.js";
import type { FocusToolCommands } from "../../core/toolCommands.js";
import type { FocusToolOptions } from "../../core/toolOptions.js";
import { FocusModeExtension } from "./focusModeExtension.js";
import { toggleFocusMode } from "./focusModeState.js";

/**
 * The default Tool option: the mode is off. The Tool is part of `full`, and a kit update must not
 * change how each such Editor looks; the author turns the mode on, with the item or the option.
 */
export const FOCUS_DEFAULTS: FocusToolOptions = { enabled: false };

/**
 * The focus mode on the Tool's description (ADR-0082). A Decoration over the Document: the Schema,
 * the sanitizer, Markdown and the saved HTML do not change. Like `invisibleCharacters`, it has no
 * Toolbar button and no Slash menu item: "Focus mode" is a checkbox item in the "view" section of
 * the "…" menu (`FormatMenus.tsx`), and the Tool has no shortcut.
 */
export const FOCUS_TOOL: ToolDescriptor = {
  name: "focus",
  defaults: FOCUS_DEFAULTS,
  checks: { enabled: (value) => typeof value === "boolean" },
  engine: (_context, options) => [
    FocusModeExtension.configure({
      enabled: (options as FocusToolOptions | undefined)?.enabled === true,
    }),
  ],
  /*
    In Source mode the Document is not on screen, so there is nothing to dim: `false` (the "…" menu
    is locked in that mode).
  */
  commands: ({ editor, bridge }): FocusToolCommands => ({
    toggle: () => !bridge.sourceOpen() && toggleFocusMode(editor),
  }),
};
