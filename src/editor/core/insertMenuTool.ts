"use client";

import { ParagraphIcon } from "../../icons.js";
import { shortcutKeys } from "./shortcuts.js";
import { SlashCommand } from "./slashCommand.js";
import type { ToolDescriptor } from "./toolDescriptor.js";

/**
 * Slash menu (`/` in the text; the "+" button on the Toolbar and "Add ›" in the Block handle
 * are kit widgets, and they read `tools.has("insertMenu")`).
 *
 * The Tool has no Block of its own: it is a way to reach other Tools' Blocks. The Tool's
 * Extensions provide `/`, and they exist only when `RichTextEditor` has set up the bridge. With
 * no insert items there is no bridge, and `/` stays an ordinary character. The paragraph item is
 * declared here: a paragraph is not a Tool and is always in the Schema, but "Turn into
 * paragraph" is needed for as long as the menu exists.
 */
export const INSERT_MENU_TOOL: ToolDescriptor = {
  name: "insertMenu",
  engine: (context) => (context.slash ? [SlashCommand.configure({ bridge: context.slash })] : []),
  insertItems: [
    {
      id: "paragraph",
      section: "turnInto",
      label: (m) => m.paragraph,
      icon: ParagraphIcon,
      aliases: ["p", "text"],
      keys: shortcutKeys("paragraph"),
      run: (chain) => chain.setParagraph(),
    },
  ],
};
