"use client";

import { ColumnLayoutIcon } from "../../../icons.js";
import type { ToolDescriptor } from "../../core/toolDescriptor.js";
import { DEFAULT_LAYOUT } from "./columnLayouts.js";
import { LAYOUT_NODE, layoutExtensions } from "./layout.js";

/**
 * Column layout on the Tool descriptor: the column nodes and their keyboard
 * (`layout.ts`), the Insert item in the Slash menu, and the place in the Document's
 * content model.
 *
 * The layout variants ("Add › Column layout ›", "Format ›", and the column's
 * "Layout ›") are menu widgets of the Block handle. They have no Tool of their own and
 * stay in `BlockHandle.tsx`, shown when `has("layout")`.
 */
export const LAYOUT_TOOL: ToolDescriptor = {
  name: "layout",
  // Without this Tool, `div[data-block]` from a paste and `value` are not parsed, and the
  // column Blocks end up in the Document one after another. A Wrapper inside a column
  // only when the `wrapper` Tool is on.
  engine: (context) => layoutExtensions({ wrapper: context.has("wrapper") }),
  // The column layout is not in the `block` group: only the Document can accept it, and only
  // when it names it explicitly.
  documentContent: [LAYOUT_NODE],
  /*
    The layout is an item without a submenu. The Slash menu is a flat list filtered by `/`,
    and submenus do not live in it. The default variant is two columns; the other variants
    are under "Add › Column layout ›" and "Format ›" in the Block handle. The layout is
    inserted only at the top level: from inside a column, it goes after its own Column
    layout (`insertLayout`).
  */
  insertItems: [
    {
      id: "layout",
      section: "insert",
      label: (m) => m.layout,
      icon: ColumnLayoutIcon,
      aliases: ["columns", "cols"],
      run: (chain) => chain.insertLayout(DEFAULT_LAYOUT),
    },
  ],
};
