"use client";

import type { ChainedCommands, Editor, Range } from "@tiptap/core";
import { TextSelection, type Transaction } from "@tiptap/pm/state";
import type { ComponentType } from "react";
import type { UiMessages } from "../../i18n/messages.js";
import { TableIcon, type IconProps } from "../../icons.js";
import { DEFAULT_LOCALE } from "../../i18n/defaults.js";
import { handleBlock } from "./blockCommands.js";
import { projectRecords, type ToolList, type ToolPopover } from "./toolDescriptor.js";
import type { Tool } from "./tools.js";

type EditorMessages = UiMessages["editor"];

/**
 * Insert item.
 *
 * The section decides what happens to the document, and the item decides only which Block:
 *
 * - `insert` — a new Block after the current one. The menu first finds the place: the current
 *   paragraph if it is empty, otherwise a new paragraph right after the current top-level Block
 *   (not inside a quote or a list). The item itself only supplies the command that makes its own
 *   Block here (`setHorizontalRule`, `setCodeBlock`).
 * - `turnInto` — change the type of the current Block, keeping the text. The menu strips the
 *   wrappers around it (a list, a quote), and the item wraps it or changes it again.
 *
 * That is why `run` receives a chain, not the engine: preparing the menu and the item's command
 * go in one transaction, and one `Ctrl+Z` undoes both.
 */
export interface InsertItem {
  /** Stable key, unique among all items: the row's `id` is built from it. */
  id: string;
  section: "insert" | "turnInto";
  /**
   * Label in the `UiProvider` locale. For built-in items it is a catalog string, and `locale` is
   * not needed for them. For a custom Tool's items it is a string or a function that receives `{ locale,
   * messages }` (ADR-0058, item 6.1), which the menu calls when it renders.
   */
  label: (messages: EditorMessages, locale: string) => string;
  icon: ComponentType<IconProps>;
  /**
   * Words for the filter beyond the label: Markdown syntax and short names (`h2`, `ul`, `---`).
   * Only language-independent ones. The labels in the interface language and the English catalog
   * labels are matched by the filter itself.
   */
  aliases?: readonly string[];
  /** The Block's Markdown shortcut, shown as a hint in the row. Takes precedence over `keys`: it is shorter to type. */
  markdown?: string;
  /** A key combination in the engine's notation (`mod` is `⌘` or `Ctrl`); the label, if there is no `markdown`. */
  keys?: readonly string[];
  /**
   * A key combination that the kit binds (ADR-0058, item 5.7). It is the single source of the key,
   * the hint and the reference row. Built-in items have none: their Extensions bind the key, and
   * the label is `keys`.
   */
  shortcut?: readonly string[];
  /**
   * A second Tool the item needs besides its owner. Heading 1 sits under `heading`, but it exists
   * only together with `heading1`, as in the "¶" menu.
   */
  requires?: Tool;
  run: (chain: ChainedCommands, editor: Editor) => ChainedCommands;
  /**
   * A popover instead of `run` (for a custom Tool, ADR-0058, item 5.6). The item does not prepare
   * the Document; it opens a popover at the caret (`applyInsertItem`).
   */
  popover?: ToolPopover;
}

/**
 * The "Table" item of a given size. The header row is always present.
 *
 * The Slash menu uses 3×3 (the Tool description, `tableTool.ts`), while the size picker grid can
 * be any size. One item serves both paths, so the insertion place (`applyInsertItem`) and leaving
 * a cell (`leaveTable`) cannot diverge.
 */
export function tableItem(cols: number, rows: number): InsertItem {
  return {
    id: "table",
    section: "insert",
    label: (m) => m.table,
    icon: TableIcon,
    aliases: ["grid"],
    run: (chain) => chain.command(leaveTable).insertTable({ rows, cols, withHeaderRow: true }),
  };
}

/**
 * Inserts a `cols` × `rows` table with a header row after the current Block, by the same path as
 * the menu item. The size is rounded to a whole number, at least 1×1.
 */
export function insertTableOfSize(editor: Editor, cols: number, rows: number): void {
  const whole = (value: number) => Math.max(1, Math.floor(value) || 1);
  applyInsertItem(editor, tableItem(whole(cols), whole(rows)), null);
}

/**
 * The caret is in a cell, so the new table goes after it, not inside.
 *
 * The menu itself steps away from the current Block, but an empty paragraph counts as a ready
 * place. An empty cell is a paragraph too, so the table would land inside it as a second, nested
 * table. Nested tables are not needed in v1 (there are neither buttons nor a Markdown notation for
 * them), and an insertion that makes a matryoshka out of an empty cell looks like a failure.
 */
function leaveTable({ tr }: { tr: Transaction }): boolean {
  const { $from } = tr.selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    if ($from.node(depth).type.name !== "table") continue;
    const after = $from.after(depth);
    tr.insert(after, tr.doc.type.schema.nodes.paragraph!.create());
    tr.setSelection(TextSelection.create(tr.doc, after + 1));
    break;
  }
  return true;
}

/**
 * The hint in the item's row: the Markdown shortcut, or else the key combination. The Toolbar
 * labels the combination (`shortcutLabel`), since it knows whether this is an Apple device.
 */
export function insertItemHint(
  item: InsertItem,
  shortcut: (keys: readonly string[]) => string
): string | undefined {
  return item.markdown ?? (item.keys ? shortcut(item.keys) : undefined);
}

/**
 * The place of the built-in Tools in the Slash menu: the order of their items within a section.
 * The items live in the Tool descriptions (`insertItems`), while the place on the surface is a
 * privilege of the kit. That is why the order lives here, not in the description.
 */
const INSERT_ORDER: readonly Tool[] = [
  "insertMenu",
  "heading",
  "bulletList",
  "orderedList",
  "taskList",
  "blockquote",
  "codeBlock",
  "horizontalRule",
  "table",
  "image",
  "layout",
  "wrapper",
  "details",
  "mathematics",
  "youtube",
  "twitch",
];

/** Sections in display order. */
export const INSERT_SECTIONS = ["insert", "turnInto"] as const;

/**
 * Items with one `id` are one item. The "Video" item is in the descriptions of both `youtube` and
 * `twitch` (ADR-0071), but the menu shows one. The first entry holds the place, and the search
 * words (`aliases`) are merged.
 */
function merged(items: readonly InsertItem[]): InsertItem[] {
  const byId = new Map<string, InsertItem>();
  for (const item of items) {
    const first = byId.get(item.id);
    byId.set(
      item.id,
      first
        ? { ...first, aliases: [...new Set([...(first.aliases ?? []), ...(item.aliases ?? [])])] }
        : item
    );
  }
  return [...byId.values()];
}

/**
 * Items for a Tool set: a projection of the description list (`insertItems`) in `INSERT_ORDER`
 * order. The paragraph is the item of the `insertMenu` description. A menu with no item beyond
 * the paragraph makes no sense, so the list is then empty: neither "+" nor `/` appears.
 */
export function insertItemsFor(tools: ToolList): readonly InsertItem[] {
  if (!tools.has("insertMenu")) return [];
  const items = merged(
    projectRecords(tools, INSERT_ORDER, (descriptor) => descriptor.insertItems).filter(
      (item) => item.requires === undefined || tools.has(item.requires)
    )
  );
  return items.length > 1 ? items : [];
}

/**
 * Whether the item matches the query typed after `/`.
 *
 * The comparison is `contains` from react-aria: case-insensitive and diacritic-insensitive in the
 * locale, so an accented letter is found by its plain form. It runs against the label in the
 * interface language, the English catalog label, and `aliases`. The English label is kept because
 * `/head` is familiar even to people whose interface is in Russian, and the fallback catalog ships
 * in the bundle anyway.
 */
export function matchesQuery(
  item: InsertItem,
  query: string,
  messages: EditorMessages,
  locale: string,
  fallback: EditorMessages,
  contains: (text: string, query: string) => boolean
): boolean {
  if (query === "") return true;
  const words = [
    item.label(messages, locale),
    item.label(fallback, DEFAULT_LOCALE),
    ...(item.aliases ?? []),
  ];
  return words.some((word) => contains(word, query));
}

/**
 * Where the item puts the Block.
 *
 * - `caret` — the Slash menu and the "¶" item. The item's section decides whether the current
 *   Block is turned into the new type, or a new one is put after it.
 * - `below` — "Add ›" of the Block handle: always a new Block below the handle's Block, even if
 *   the current one is empty, and even for a "Turn into" item. "Heading 2" here is a new empty
 *   heading below, not a change of the current Block.
 */
export type InsertPlace = "caret" | "below";

/**
 * An empty paragraph right after the handle's Block (`handleBlock`), with the caret in it, is the
 * place for a new Block. One path serves "+", `/` and "Add ›": a divider or a table inserted from
 * the middle of a quote or a list would end up inside them, and one inserted after a selected
 * image would land before it. A selection that spans several handle Blocks has no such paragraph.
 * In that case the new Block goes after the top-level Block that holds the start of the selection.
 */
function openParagraphBelow(tr: Transaction): void {
  const after = handleBlock(tr)?.end ?? tr.selection.$from.after(1);
  tr.insert(after, tr.doc.type.schema.nodes.paragraph!.create());
  tr.setSelection(TextSelection.create(tr.doc, after + 1));
}

/**
 * Applies the item.
 *
 * `range` is the typed `/query`, which is deleted in the same transaction. The "+" button on the
 * Toolbar has no query, so `range` is `null` and the item applies to the selection.
 */
export function applyInsertItem(
  editor: Editor,
  item: InsertItem,
  range: Range | null,
  place: InsertPlace = "caret"
): void {
  let chain = editor.chain().focus();
  if (range) chain = chain.deleteRange(range);
  // An item with a popover only removes `/query`. The popover's content sets the Block.
  if (item.popover) return void chain.openToolPopover(item.id).run();
  if (place === "below") {
    // The new empty paragraph is itself the Block that the item changes or wraps.
    chain = chain.command(({ tr }) => {
      openParagraphBelow(tr);
      return true;
    });
    /*
      The "Paragraph" is ready here already, so do not call its command. Tiptap's `setNode` on a
      Block of the same type goes to `clearNodes`, and after an insertion in the same chain that
      maps the new document's positions as if they were the old ones, and it throws past its end.
    */
    if (item.id === "paragraph") return void chain.run();
  } else if (item.section === "insert") {
    chain = chain.command(({ tr }) => {
      // The empty Block under the caret is the place for the new one.
      const { $from } = tr.selection;
      if (!($from.parent.isTextblock && $from.parent.content.size === 0)) openParagraphBelow(tr);
      return true;
    });
  } else {
    // First the current Block becomes a plain paragraph, without the list or quote around it.
    // Only then does its item wrap it or change it.
    chain = chain.clearNodes();
  }
  item.run(chain, editor).run();
}

/**
 * The handle's "Format ›" on the Block: the "Turn into" item applies to the WHOLE Block the handle
 * belongs to. That means the whole list, the whole quote, and not the text Block under the caret.
 * It takes the same path as "¶" (`clearNodes`, then the item's command), except that the Block's
 * whole text is selected for the edit. Afterwards the caret goes back to where it was. One
 * transaction is one undo.
 */
export function turnBlockInto(editor: Editor, item: InsertItem): void {
  if (item.popover) return applyInsertItem(editor, item, null);
  const block = handleBlock(editor.state);
  if (!block) return;
  const before = editor.state.selection;
  const chain = editor
    .chain()
    .focus()
    .command(({ tr }) => {
      const { doc } = tr;
      tr.setSelection(
        TextSelection.between(doc.resolve(block.start + 1), doc.resolve(block.end - 1))
      );
      return true;
    })
    .clearNodes();
  item
    .run(chain, editor)
    .command(({ tr }) => {
      tr.setSelection(before.map(tr.doc, tr.mapping));
      return true;
    })
    .run();
}
