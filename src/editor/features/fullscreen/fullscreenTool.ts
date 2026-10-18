"use client";

import type { ToolDescriptor } from "../../core/toolDescriptor.js";
import type { FullscreenToolCommands } from "../../core/toolCommands.js";

/**
 * Fullscreen mode on the Tool's description (ADR-0082). The Tool has no Extensions, no Schema and no
 * options: the layer, the Document's column and the exit are drawn by `RichTextEditor`
 * (`FullscreenLayer.tsx`), which holds the state, as it holds the Find panel's. The Commands go
 * through the bridge for the same reason.
 *
 * "Fullscreen" is a checkbox item in the "view" section of the "…" menu (the fixed Toolbar and the
 * selection menu, `FormatMenus.tsx`), and "Collapse" is a button at the right edge of the Toolbar
 * (or in the layer's corner when there is no fixed Toolbar). The Tool has no shortcut: `F11` and
 * `Mod+Shift+F` belong to browsers and to the Find panel, and `Esc` already collapses it.
 */
export const FULLSCREEN_TOOL: ToolDescriptor = {
  name: "fullscreen",
  /*
    `false` means "nothing changed": the layer is already in that state, the field is disabled, or
    Source mode is open (the Document is not on screen, so there is nothing to work with).
  */
  commands: ({ bridge }): FullscreenToolCommands => ({
    open: () => bridge.setFullscreen(true),
    close: () => bridge.setFullscreen(false),
    toggle: () => bridge.setFullscreen(!bridge.fullscreenOpen()),
  }),
};
