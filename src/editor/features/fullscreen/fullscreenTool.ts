"use client";

import { Extension } from "@tiptap/core";
import { SHORTCUT_KEYS } from "../../core/shortcuts.js";
import type { ToolDescriptor } from "../../core/toolDescriptor.js";
import type { FullscreenToolCommands } from "../../core/toolCommands.js";

/**
 * `Mod+Shift+F` turns the layer on and off (the owner's decision of 2026-10-19, OLDSUI-316). The key is
 * the engine's, so it works only with focus in the Document; `Esc` still collapses the layer.
 */
const FullscreenKeys = Extension.create<{ toggle: () => boolean }>({
  name: "fullscreenKeys",
  addOptions: () => ({ toggle: () => false }),
  addKeyboardShortcuts() {
    return { "Mod-Shift-f": () => this.options.toggle() };
  },
});

/**
 * Fullscreen mode on the Tool's description (ADR-0082). The Tool has no Extensions, no Schema and no
 * options: the layer, the Document's column and the exit are drawn by `RichTextEditor`
 * (`FullscreenLayer.tsx`), which holds the state, as it holds the Find panel's. The Commands go
 * through the bridge for the same reason.
 *
 * "Fullscreen" is a checkbox item in the "view" section of the "…" menu (the fixed Toolbar and the
 * selection menu, `FormatMenus.tsx`), and "Collapse" is a button at the right edge of the Toolbar
 * (or in the layer's corner when there is no fixed Toolbar). `Mod+Shift+F` toggles it, and `Esc`
 * collapses it. `F11` stays the browser's: it fills the screen with the whole page, not the field.
 */
export const FULLSCREEN_TOOL: ToolDescriptor = {
  name: "fullscreen",
  engine: (context) => [
    FullscreenKeys.configure({ toggle: context.toggleFullscreen ?? (() => false) }),
  ],
  shortcuts: [
    {
      id: "fullscreen",
      group: "view",
      tool: "fullscreen",
      keys: SHORTCUT_KEYS.fullscreen,
      label: (m) => m.fullscreen,
    },
  ],
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
