"use client";

import Blockquote from "@tiptap/extension-blockquote";
import HorizontalRule from "@tiptap/extension-horizontal-rule";
import { DividerIcon, QuoteIcon } from "../../icons.js";
import { turnIntoTypes } from "../core/blockTypes.js";
import type { InsertItem } from "../core/insertItems.js";
import { INSERT_MENU_TOOL } from "../core/insertMenuTool.js";
import { SHORTCUT_KEYS, type ShortcutCommand } from "../core/shortcuts.js";
import { BLOCK_SELECTION_TOOL } from "./blockSelection/blockSelectionTool.js";
import { ALIGN_TOOL, COLOR_TOOL, HIGHLIGHT_TOOL } from "./color/colorTools.js";
import { CODE_BLOCK_TOOL } from "./code/codeBlockTool.js";
import { DATE_TOOL } from "./date/dateTool.js";
import { DETAILS_TOOL } from "./details/detailsTool.js";
import { EMOJI_TOOL } from "./emoji/emojiTool.js";
import { HEADING1_TOOL, HEADING_TOOL } from "./heading/headingTool.js";
import { HISTORY_TOOL } from "./history/historyTool.js";
import { IMAGE_TOOL } from "./image/imageTool.js";
import { INVISIBLE_CHARACTERS_TOOL } from "./invisibleCharacters/invisibleCharactersTool.js";
import { LANGUAGE_TOOL } from "./language/languageTool.js";
import { LAYOUT_TOOL } from "./layout/layoutTool.js";
import { LINK_TOOL } from "./link/linkTool.js";
import { BULLET_LIST_TOOL, ORDERED_LIST_TOOL, TASK_LIST_TOOL } from "./lists/listTools.js";
import {
  BOLD_TOOL,
  CODE_TOOL,
  ITALIC_TOOL,
  STRIKE_TOOL,
  SUBSCRIPT_TOOL,
  SUPERSCRIPT_TOOL,
  UNDERLINE_TOOL,
} from "./marks/markTools.js";
import { MATHEMATICS_TOOL } from "./mathematics/mathematicsTool.js";
import type { ToolEntry } from "../core/customTool.js";
import { describeCustomTool, describeDefinition } from "../core/customToolEngine.js";
import { toolList, type ToolDescriptor, type ToolList } from "../core/toolDescriptor.js";
import {
  configuredBuiltins,
  isConfiguredTool,
  repeatedConfigured,
  resolveToolOptions,
  type ConfiguredTool,
} from "../core/toolOptions.js";
import { SEARCH_TOOL } from "./search/searchTool.js";
import { PASTE_CLEANUP_TOOL } from "./pasteCleanup/pasteCleanupTool.js";
import { TABLE_TOOL } from "./table/tableTool.js";
import { TOC_TOOL } from "./toc/tocTool.js";
import { TYPOGRAPHY_TOOL } from "./typography/typographyTool.js";
import { TWITCH_TOOL, YOUTUBE_TOOL } from "./video/videoTools.js";
import { resolveTools, TOOLS, type RichTextEditorPreset, type Tool } from "../core/tools.js";
import { WRAPPER_TOOL } from "./wrapper/wrapperTool.js";

/** Quote shortcut: one entry for the keyboard shortcuts popover, the Slash menu and the "¶" control. */
const BLOCKQUOTE_SHORTCUT: ShortcutCommand = {
  id: "blockquote",
  group: "blockType",
  tool: "blockquote",
  keys: SHORTCUT_KEYS.blockquote,
  label: (m) => m.blockquote,
};

const BLOCKQUOTE_ITEMS: readonly InsertItem[] = [
  {
    id: "blockquote",
    section: "turnInto",
    label: (m) => m.blockquote,
    icon: QuoteIcon,
    aliases: [">"],
    markdown: ">",
    keys: BLOCKQUOTE_SHORTCUT.keys,
    run: (chain) => chain.setBlockquote(),
  },
];

/**
 * Descriptions of the built-in Tools (ADR-0058, item 10; type — `toolDescriptor.ts`).
 *
 * Each entry is complete, one per name in `TOOLS`: a built-in Tool is taken only from its
 * description, there are no legacy registries by name, and the compiler rejects a new name
 * without a description. The Toolbar and Bubble menu widgets remain kit components and query
 * the set by name.
 */
export const BUILTIN_TOOLS: Record<Tool, ToolDescriptor> = {
  search: SEARCH_TOOL,
  invisibleCharacters: INVISIBLE_CHARACTERS_TOOL,
  blockSelection: BLOCK_SELECTION_TOOL,
  // The Table of contents carries only options: its strip and list are drawn in `RichTextEditor`.
  toc: TOC_TOOL,
  layout: LAYOUT_TOOL,
  color: COLOR_TOOL,
  highlight: HIGHLIGHT_TOOL,
  align: ALIGN_TOOL,
  language: LANGUAGE_TOOL,
  wrapper: WRAPPER_TOOL,
  details: DETAILS_TOOL,
  mathematics: MATHEMATICS_TOOL,
  date: DATE_TOOL,
  typography: TYPOGRAPHY_TOOL,
  pasteCleanup: PASTE_CLEANUP_TOOL,
  youtube: YOUTUBE_TOOL,
  twitch: TWITCH_TOOL,
  /*
    The divider and the blockquote: a Tool with a Slash menu item and a Tool with a "Turn into"
    item. The `insertItems` and `engine` fields are the same as in the public description of a
    custom Tool: the kit's code checks the shape.
  */
  horizontalRule: {
    name: "horizontalRule",
    engine: () => [HorizontalRule],
    insertItems: [
      {
        id: "horizontalRule",
        section: "insert",
        label: (m) => m.horizontalRule,
        icon: DividerIcon,
        aliases: ["hr", "---"],
        markdown: "---",
        run: (chain) => chain.setHorizontalRule(),
      },
    ],
  },
  blockquote: {
    name: "blockquote",
    engine: () => [Blockquote],
    insertItems: BLOCKQUOTE_ITEMS,
    // "¶" is the same "Turn into" item: the same words, icon and shortcut.
    blockTypes: turnIntoTypes("blockquote", BLOCKQUOTE_ITEMS),
    // The shortcut is bound by the Tiptap extension; the reference row is only its label.
    shortcuts: [BLOCKQUOTE_SHORTCUT],
  },
  history: HISTORY_TOOL,
  bold: BOLD_TOOL,
  italic: ITALIC_TOOL,
  underline: UNDERLINE_TOOL,
  strike: STRIKE_TOOL,
  code: CODE_TOOL,
  superscript: SUPERSCRIPT_TOOL,
  subscript: SUBSCRIPT_TOOL,
  heading: HEADING_TOOL,
  heading1: HEADING1_TOOL,
  link: LINK_TOOL,
  bulletList: BULLET_LIST_TOOL,
  orderedList: ORDERED_LIST_TOOL,
  taskList: TASK_LIST_TOOL,
  image: IMAGE_TOOL,
  emoji: EMOJI_TOOL,
  insertMenu: INSERT_MENU_TOOL,
  /*
    Clear formatting has no Tiptap extension of its own: the `⌘\` shortcut is held by the core's
    `BlockCommands` (it asks `has("clearFormatting")`), and the button in the "…" menu is a kit
    widget. The descriptor carries only the reference row.
  */
  clearFormatting: {
    name: "clearFormatting",
    shortcuts: [
      {
        id: "clearFormatting",
        group: "clear",
        tool: "clearFormatting",
        keys: SHORTCUT_KEYS.clearFormatting,
        label: (m) => m.clearFormatting,
      },
    ],
  },
  /*
    The HTML mode is the "HTML" widget of the Toolbar and a mode of `RichTextEditor`, shown by
    `has("source")`. The Tool has neither a Schema nor entries, but every built-in has a
    description, even an empty one.
  */
  source: { name: "source" },
  /*
    Lazy built-ins (ADR-0058, item 11.1): they are absent from `basic`, and their Extensions weigh
    more than 10 kB gzip, so a Loader (`load`) loads them, the same one a custom Tool uses.
    Formulas (`mathematics`) are lazy in the same way, but sit higher, next to the other newer
    Tools; they are not in `full` either.
  */
  codeBlock: CODE_BLOCK_TOOL,
  table: TABLE_TOOL,
};

/** Description with options for the Editor (`resolveToolOptions`: defaults, with `tool()` on top). */
function resolveOptions(
  descriptor: ToolDescriptor,
  configured: ConfiguredTool | undefined
): ToolDescriptor {
  const { defaults, checks, name } = descriptor;
  return defaults
    ? {
        ...descriptor,
        options: resolveToolOptions("RichTextEditor", name, defaults, checks, configured),
      }
    : descriptor;
}

/**
 * Expand `tools` (or `preset`) into one list of descriptions.
 *
 * The names are the same as in `resolveTools`: an exact `tools` list or a preset; an unknown
 * string is dropped silently. A `tool()` entry enables a Tool just as its name does, and if
 * `tools` holds both a name (from a preset) and an entry, the Configured Tool wins; two entries
 * with one name are a set error (`ToolList.error`). The built-ins are ordered by the kit
 * (`TOOLS`), not by `tools`: the kit decides where a built-in stands on the surface, and a
 * Configured Tool stands where its bare name would. Custom Tools (descriptions in `tools`)
 * follow, in the `tools` order (ADR-0058, item 5.3); the set of names (`Set`) holds only kit names.
 *
 * The Tool options are read here, once, together with the set.
 */
export function expandTools(
  preset: RichTextEditorPreset,
  tools: readonly ToolEntry[] | undefined
): ToolList {
  // Configured built-ins: a tool(name, options) entry configures a built-in Tool; a tool(definition) entry is handled below.
  const configured = configuredBuiltins(tools);
  const twice = repeatedConfigured(configured);
  const names = resolveTools(
    preset,
    tools && [
      ...tools.filter((entry) => typeof entry === "string"),
      ...configured.map((entry) => entry.name),
    ]
  );
  const builtin = TOOLS.filter((name) => names.has(name)).map((name) =>
    resolveOptions(
      BUILTIN_TOOLS[name],
      configured.find((entry) => entry.name === name)
    )
  );
  // Custom Tools: a definition (with or without `tool()`) or a plain description; the set checks name uniqueness.
  const custom = (tools ?? []).flatMap((entry) => {
    if (typeof entry !== "object" || entry === null) return [];
    if (isConfiguredTool(entry)) {
      return entry.definition ? describeDefinition(entry.definition, entry.options) : [];
    }
    return "defined" in entry ? describeDefinition(entry) : describeCustomTool(entry);
  });
  return toolList(
    builtin.map((descriptor) => descriptor.name as Tool),
    [...builtin, ...custom],
    twice && `tool "${twice.name}": two tool() entries share this name`
  );
}
