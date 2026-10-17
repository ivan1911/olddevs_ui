"use client";

import {
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  Heading4Icon,
  HeadingIcon,
} from "../../../icons.js";
import { turnIntoTypes } from "../../core/blockTypes.js";
import type { InsertItem } from "../../core/insertItems.js";
import { SHORTCUT_KEYS, type ShortcutCommand } from "../../core/shortcuts.js";
import type { ToolDescriptor } from "../../core/toolDescriptor.js";

const LEVELS = [1, 2, 3, 4] as const;

/** Icons of the ¶ menu: unlike the Slash menu (one `HeadingIcon`), the level shows on the icon itself. */
const BLOCK_TYPE_ICONS = [Heading1Icon, Heading2Icon, Heading3Icon, Heading4Icon] as const;

/**
 * Heading items: the Slash menu and the ¶ menu share the same "Turn into" items.
 * H1 is listed under `heading` and exists only together with `heading1`: `heading1` has no place of
 * its own in the order of the UI surfaces (`INSERT_ORDER`, `BLOCK_TYPE_ORDER`), so its item lives
 * here and is hidden by `requires`.
 */
const HEADING_ITEMS: readonly InsertItem[] = LEVELS.map((level): InsertItem => ({
  id: `heading${level}`,
  section: "turnInto",
  label: (m) => m.heading({ level }),
  icon: HeadingIcon,
  aliases: [`h${level}`],
  markdown: "#".repeat(level),
  keys: SHORTCUT_KEYS[`h${level}`],
  requires: level === 1 ? "heading1" : undefined,
  run: (chain) => chain.setHeading({ level }),
}));

/**
 * Headings on the Tool description (ADR-0058, item 10).
 *
 * The node and its keys come from StarterKit, so the description holds a share of StarterKit, not
 * `engine`. H1 comes only with `heading1`; without it, `#` and `<h1>` keep their old meaning: the
 * input rule and the HTML parsing are built on these levels. The ¶ menu (`BlockTypeMenu`) is a kit
 * widget, and the Tool description does not touch it.
 */
export const HEADING_TOOL: ToolDescriptor = {
  name: "heading",
  starterKit: (context) => ({
    heading: { levels: context.has("heading1") ? [1, 2, 3, 4] : [2, 3, 4] },
  }),
  insertItems: HEADING_ITEMS,
  blockTypes: turnIntoTypes("heading", HEADING_ITEMS).map((item, index) => ({
    ...item,
    icon: BLOCK_TYPE_ICONS[index]!,
    alsoTool: item.requires,
  })),
  // The Tiptap extension binds the keys; the reference rows are their labels.
  // The label is the same as the ¶ menu item ("Text"), not the "Paragraph" item of the Slash menu:
  // the reference names the command with the word people pick it by on the Toolbar.
  shortcuts: [
    {
      id: "paragraph",
      group: "blockType",
      tool: "heading",
      keys: SHORTCUT_KEYS.paragraph,
      label: (m) => m.textBlock,
    },
    ...([2, 3, 4] as const).map((level): ShortcutCommand => ({
      id: `h${level}`,
      group: "blockType",
      tool: "heading",
      keys: SHORTCUT_KEYS[`h${level}`],
      label: (m) => m.heading({ level }),
    })),
  ],
};

/**
 * `heading1` is an add-on to `heading`: it has no node of its own, and it adds only H1 (the heading
 * levels query `has("heading1")`, and the H1 items live in the description of `heading`). In the
 * description, the reference row `⌘⌥1` exists only together with `heading`.
 */
export const HEADING1_TOOL: ToolDescriptor = {
  name: "heading1",
  shortcuts: [
    {
      id: "h1",
      group: "blockType",
      tool: "heading1",
      requires: "heading",
      keys: SHORTCUT_KEYS.h1,
      label: (m) => m.heading({ level: 1 }),
    },
  ],
};
