"use client";

import { SHORTCUT_KEYS } from "../../core/shortcuts.js";
import type { ToolDescriptor } from "../../core/toolDescriptor.js";
import {
  HighlightExtension,
  TEXT_COLOR_EXTENSIONS,
  TextAlignExtension,
} from "./styleExtensions.js";

/*
  Text color, highlight and alignment write `data-color` and `data-align`, not `style`
  (`styleExtensions.ts`; the only exception is the custom color, `customColor.ts`). A disabled
  Tool emits neither the attribute nor a parse rule, so such an attribute from a paste is dropped.

  The widgets (the "Highlight" button on the Toolbar, "Color" and "Highlight" in the Bubble menu
  (`ColorMenus.tsx`, `SelectionBubble.tsx`), and the lazy popover for a custom color) stay in the
  kit and are shown by `has(name)`. Color and highlight have no shortcuts and no Slash menu items,
  so their descriptions are Extensions only.
*/

/** Text color: a `textStyle` Mark with `data-color`, and the custom color. */
export const COLOR_TOOL: ToolDescriptor = {
  name: "color",
  engine: () => TEXT_COLOR_EXTENSIONS,
};

/** Highlight: a `highlight` Mark with `data-color` (several colors). */
export const HIGHLIGHT_TOOL: ToolDescriptor = {
  name: "highlight",
  engine: () => [HighlightExtension],
};

/**
 * Alignment: `data-align` on a paragraph and a heading.
 *
 * The `Mod-Shift-L/E/R` keys are bound by the extension itself, and the three rows of the Reference
 * are the labels for them. The "Align ▾" menu (`AlignMenu`, `FormatMenus.tsx`) is a kit widget: it
 * reads the same shortcuts from `SHORTCUT_KEYS`.
 */
export const ALIGN_TOOL: ToolDescriptor = {
  name: "align",
  engine: () => [TextAlignExtension],
  shortcuts: [
    {
      id: "alignLeft",
      group: "align",
      tool: "align",
      keys: SHORTCUT_KEYS.alignLeft,
      label: (m) => m.alignLeft,
    },
    {
      id: "alignCenter",
      group: "align",
      tool: "align",
      keys: SHORTCUT_KEYS.alignCenter,
      label: (m) => m.alignCenter,
    },
    {
      id: "alignRight",
      group: "align",
      tool: "align",
      keys: SHORTCUT_KEYS.alignRight,
      label: (m) => m.alignRight,
    },
  ],
};
