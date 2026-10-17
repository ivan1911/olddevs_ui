"use client";

import type { Node as PmNode } from "@tiptap/pm/model";
import type { EditorState } from "@tiptap/pm/state";
import { TextIcon } from "../../icons.js";
import type { PrefixedName } from "./customTool.js";
import type { InsertItem } from "./insertItems.js";
import { shortcutKeys } from "./shortcuts.js";
import { projectRecords, type ToolList } from "./toolDescriptor.js";
import type { Tool } from "./tools.js";

/**
 * The ¶ menu item — a Block type.
 *
 * It is an item of the "Turn into" section of the Slash menu (`InsertItem`, `section:
 * "turnInto"`), and it is applied by the same `applyInsertItem`: first the wrappers (a list, a
 * quote) are removed from the Block, then the item wraps it or changes it again — in one
 * transaction, one undo step. The ¶ menu has no path of its own for changing the type: two paths
 * would diverge on the first list inside a quote.
 *
 * The ¶ items are a field of the `blockTypes` descriptor, not a selection from `insertItems`,
 * because the ¶ menu may have other words and icons: "Text" with the `T` icon, not "Paragraph"
 * with a pilcrow, and the heading level on the icon. There is no code Block in it — it has its
 * own Toolbar button.
 */
export interface BlockTypeItem extends InsertItem {
  section: "turnInto";
  /**
   * The Tool without which the item does not exist. "Text" has `null`: a paragraph is always
   * there. A custom Tool's item has the Tool's name (ADR-0058, item 5): the set is already
   * filtered.
   */
  tool: Tool | PrefixedName | null;
  /** A second required Tool: H1 is an add-on to `heading`. */
  alsoTool?: Tool;
  keys: readonly string[];
}

/**
 * The ¶ items of a Tool, from its descriptor — the same "Turn into" items of the Slash menu:
 * their words, icon, shortcut and command are the same, so the Tool does not write a second
 * record (ADR-0058, item 5).
 */
export function turnIntoTypes(
  tool: Tool | PrefixedName,
  items: readonly InsertItem[]
): BlockTypeItem[] {
  return items
    .filter((item) => item.section === "turnInto")
    .map((item) => ({ ...item, section: "turnInto", tool, keys: item.keys ?? [] }));
}

/**
 * "Text" is a kit item, not a Tool's: a paragraph is in every set. The shortcut is the label from
 * the shared table (`shortcuts.ts`); the engine's extension binds it.
 */
const TEXT_ITEM: BlockTypeItem = {
  id: "text",
  section: "turnInto",
  tool: null,
  label: (m) => m.textBlock,
  icon: TextIcon,
  keys: shortcutKeys("paragraph"),
  run: (chain) => chain.setParagraph(),
};

/**
 * The order of the built-in Tools in the ¶ menu. "Text" always comes first: a paragraph is not a
 * Tool. The items live in the descriptors, but where they appear on the surface is the kit's
 * decision.
 */
const BLOCK_TYPE_ORDER: readonly Tool[] = [
  "heading",
  "blockquote",
  "bulletList",
  "orderedList",
  "taskList",
];

/**
 * The ¶ items of a set: "Text" and the projection of the `blockTypes` descriptors.
 */
function blockTypeItemsOf(tools: ToolList): readonly BlockTypeItem[] {
  return [
    TEXT_ITEM,
    ...projectRecords(tools, BLOCK_TYPE_ORDER, (descriptor) => descriptor.blockTypes),
  ].filter((item) => item.alsoTool === undefined || tools.has(item.alsoTool));
}

/**
 * Items the ¶ menu no longer offers: lists live in the "Lists ▾" menu, the quote is a checkbox in
 * "…". They stay in the Block handle's "Format ›" and in the Slash menu: there a Block is turned
 * into anything, rather than selecting a line type.
 */
const notInBlockTypeMenu = (id: string) =>
  id === "blockquote" || (LIST_TYPES as readonly string[]).includes(id);

/**
 * The ¶ items for a set of Tools: "Text", the headings and the items of custom Tools. A menu with
 * only "Text" offers no choice, and then the list is empty: there is no ¶ button on the Toolbar.
 */
export function blockTypeItemsFor(tools: ToolList): readonly BlockTypeItem[] {
  const items = blockTypeItemsOf(tools).filter((item) => !notInBlockTypeMenu(item.id));
  return items.length > 1 ? items : [];
}

/**
 * The items of the Block handle's "Format ›" menu: the whole "Turn into" set — with the quote and
 * the lists, unlike the ¶ menu (the owner's decision).
 */
export function formatItemsFor(tools: ToolList): readonly BlockTypeItem[] {
  const items = blockTypeItemsOf(tools);
  return items.length > 1 ? items : [];
}

/** The quote item of a set — for the "Quote" checkbox in "…"; without the Tool, `undefined`. */
export function quoteItemFor(tools: ToolList): BlockTypeItem | undefined {
  return blockTypeItemsOf(tools).find((item) => item.id === "blockquote");
}

/** Wrappers that are themselves a Block type in the Block handle's "Format ›". */
const WRAPPERS: Record<string, string> = {
  blockquote: "blockquote",
  bulletList: "bulletList",
  orderedList: "orderedList",
  taskList: "taskList",
};

/** The type of a text Block: the `id` of a ¶ item, `"codeBlock"`, or `null` (not text). */
function textBlockType(block: PmNode): string | null {
  if (block.type.name === "heading") return `heading${String(block.attrs.level)}`;
  if (block.type.name === "codeBlock") return "codeBlock";
  if (block.type.name === "paragraph") return "text";
  return null;
}

/**
 * The current Block type at the start of the selection: the `id` of a ¶ item, `"codeBlock"`, or
 * `null` (the selection is not text — an image, a horizontal rule).
 *
 * THE LINE UNDER THE CARET DECIDES (the owner's decision). The ¶ menu no longer has lists or
 * quotes: a paragraph in a list item or in a quote is "Text", and a heading in a quote gives its
 * level. A list and a quote are shown by their own buttons: the "Lists ▾" menu and the "Quote"
 * checkbox in "…". Previously the nearest wrapper decided.
 */
export function currentBlockType(state: EditorState): string | null {
  return textBlockType(state.selection.$from.parent);
}

/**
 * The type of the whole Block — for the Block handle's "Format ›": the Block itself decides, not
 * the text under the caret. A quote with a list inside is "Quote": the handle turns the whole
 * quote. `null` — a Block that cannot be turned into anything (a table, an image, a horizontal
 * rule).
 */
export function blockTypeOf(block: PmNode): string | null {
  return WRAPPERS[block.type.name] ?? textBlockType(block);
}

/** List kinds — the ids of the "Turn into" items of the Slash menu and the Schema's node names. */
export const LIST_TYPES = ["bulletList", "orderedList", "taskList"] as const;

export type ListType = (typeof LIST_TYPES)[number];

/**
 * The items of the "Lists" menu — the same "Turn into" items of the Slash menu as the list kinds:
 * the same words, icons, shortcuts and one command. Unlike the ¶ menu, a menu with one item stays
 * a menu: "Checklist" with no neighbours is still a choice of list kind.
 */
export function listTypeItemsFor(tools: ToolList): readonly BlockTypeItem[] {
  return blockTypeItemsOf(tools).filter((item) =>
    (LIST_TYPES as readonly string[]).includes(item.id)
  );
}

/**
 * The kind of the nearest list around the start of the selection, or `null` — the caret is not in
 * a list. A quote between the text and the list does not matter: a list item with a quote inside
 * is still a list item, and the "Lists" menu must be able to unset it.
 */
export function currentListType(state: EditorState): ListType | null {
  const { $from } = state.selection;
  for (let depth = $from.depth - 1; depth > 0; depth--) {
    const name = $from.node(depth).type.name;
    if ((LIST_TYPES as readonly string[]).includes(name)) return name as ListType;
  }
  return null;
}
