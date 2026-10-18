"use client";

import { Extension, type Editor } from "@tiptap/core";
import { Fragment, type Node as PmNode, type NodeRange } from "@tiptap/pm/model";
import {
  Plugin,
  PluginKey,
  Selection,
  TextSelection,
  type EditorState,
  type Transaction,
} from "@tiptap/pm/state";
import { StepMap } from "@tiptap/pm/transform";
import { isFootnoteListName } from "../features/footnotes/footnoteNames.js";

/**
 * Commands over Blocks: duplicate, move, select the text of a Block, shift a list item, clear
 * styles — as in Notion and Google Docs.
 *
 * It has no markup of its own, so the extension is always on, like `ToolbarFocus`; the Tool is
 * needed only for clearing styles — its shortcut lives and dies together with the
 * `clearFormatting` button. Each command is one transaction, that is, one undo step. In `readOnly`
 * and `disabled` the editing commands hand the key to the browser: ProseMirror listens to the
 * keyboard even in a non-editable field, and without the check the shortcut would edit a read-only
 * Document.
 *
 * SHORTCUTS ARE CHOSEN SO THAT THEY DO NOT TAKE OVER THE SYSTEM'S OWN KEYS. Moving is `⌥⇧↑/↓`,
 * as in VS Code, not the reference app's `⌘⇧↑/↓`: on a Mac that means "select to the start/end
 * of the document". Selecting a Block is the first `⌘A`, not `⌘⇧A`: in Chrome that is tab
 * search. The Block handle's menu is `⌘/`, like "Block actions" in Notion: browsers and systems
 * leave this shortcut free in an input field.
 */

const LIST_NODES: ReadonlySet<string> = new Set(["bulletList", "orderedList", "taskList"]);
const LIST_ITEMS: ReadonlySet<string> = new Set(["listItem", "taskItem"]);

/**
 * A container of Blocks — a node whose children are the Blocks: the Document itself, and any node
 * whose Schema is marked `blockContainer: true`.
 *
 * A SEAM FOR THE COLUMN LAYOUT. A column of a Column layout holds its own Blocks, and they should
 * each have their own handle at the column's left edge, not one for the whole layout. The column
 * node will declare itself a container with a flag in the Schema (in Tiptap — through
 * `extendNodeSchema`), and the handle, its position and all its actions (up, down, duplicate,
 * delete, add below, format) will work inside the column without changing this module:
 * `handleBlock` below computes "Block" everywhere.
 */
export function isBlockContainer(node: PmNode): boolean {
  return node.type.name === "doc" || node.type.spec.blockContainer === true;
}

/**
 * Whether the selection lies entirely inside one table: there `⌥⇧↑/↓` does not move anything
 * (`Alt+↓` is the row), and the Block is the whole table. A selection that starts or ends outside
 * a table moves the table itself along with its neighbours.
 */
function inTable(state: Pick<EditorState, "selection">): boolean {
  const { $from, $to } = state.selection;
  for (let depth = $from.sharedDepth($to.pos); depth > 0; depth--) {
    if ($from.node(depth).type.spec.tableRole === "table") return true;
  }
  return false;
}

/**
 * Whose Blocks the command takes.
 *
 * - `selection` — keyboard shortcuts: the Blocks under the selection, and in a list — the item;
 *   duplicating and moving an item stay within its list.
 * - `handle` — the Block handle: the whole container Block (the whole list, the whole table);
 *   exactly one — the one the handle stands on (`handleBlock`).
 */
export type BlockScope = "selection" | "handle";

/**
 * The handle's Block — a child of the nearest container of Blocks (`isBlockContainer`) that holds
 * the selection: a paragraph, a heading, a whole list, a quote, a code Block, a table, an image, a
 * horizontal rule. ONE function for everything the handle knows about a Block: where to draw it,
 * what to move, copy, delete, insert under, and what to turn into. A selection across several
 * Blocks, and a caret in the gap between them, give `null`: the handle has nothing to attach to.
 */
export function handleBlock(state: Pick<EditorState, "selection">): NodeRange | null {
  const { $from, $to } = state.selection;
  const range = $from.blockRange($to, isBlockContainer);
  // The footnote list is kept by the kit (ADR-0076): the handle does not stand on it.
  return range &&
    range.endIndex - range.startIndex === 1 &&
    !isFootnoteListName(range.parent.child(range.startIndex).type.name)
    ? range
    : null;
}

/**
 * The Blocks under the selection — a row of siblings under one parent.
 *
 * A Block is a child of a container of Blocks, and in a list it is an item. In a Column layout's
 * column the Block is a child of the column: moving does not take it out of the column, while a
 * selection across two columns takes the whole Column layout. A table is one Block as a whole,
 * even if its cell contains a list. A selection across several Blocks takes all of them: the row
 * is counted where the start and the end of the selection diverge. A caret in the gap between
 * Blocks is inside no Block — `null`.
 */
function blockRange(state: EditorState, scope: BlockScope): NodeRange | null {
  if (scope === "handle") return handleBlock(state);
  const { $from, $to } = state.selection;
  const table = inTable(state);
  const range = $from.blockRange(
    $to,
    (parent) => isBlockContainer(parent) || (!table && LIST_NODES.has(parent.type.name))
  );
  // A caret in the gap at the Document level gives an empty row, not `null`. The footnote list is not a
  // Block to move, copy or delete (ADR-0076).
  return range &&
    range.startIndex < range.endIndex &&
    !blocksOf(range).some((block) => isFootnoteListName(block.type.name))
    ? range
    : null;
}

function blocksOf(range: NodeRange): PmNode[] {
  const nodes: PmNode[] = [];
  for (let index = range.startIndex; index < range.endIndex; index++) {
    nodes.push(range.parent.child(index));
  }
  return nodes;
}

/**
 * The selection moved by `shift` positions — of the same kind (a caret, a node, cells) as it was:
 * shifting the whole Document by some amount is exactly the position mapping, and each kind of
 * selection maps itself through it.
 */
function shifted(state: EditorState, tr: Transaction, shift: number): Transaction {
  const map = shift >= 0 ? new StepMap([0, 0, shift]) : new StepMap([0, -shift, 0]);
  return tr.setSelection(state.selection.map(tr.doc, map));
}

type Dispatch = ((tr: Transaction) => void) | undefined;
type Command = (state: EditorState, dispatch?: Dispatch) => boolean;

/** `⌘⇧D` — a copy of the Blocks under the selection; the selection moves to the copy. */
export function duplicateBlock(scope: BlockScope = "selection"): Command {
  return (state, dispatch) => {
    const range = blockRange(state, scope);
    if (!range) return false;
    if (dispatch) {
      const size = range.end - range.start;
      const tr = state.tr.insert(range.end, Fragment.from(blocksOf(range)));
      dispatch(shifted(state, tr, size).scrollIntoView());
    }
    return true;
  };
}

/**
 * `⌥⇧↑/↓` — Blocks swap places with the neighbour above or below. At the edge of the Document or
 * the list there is no neighbour: the Document does not change, but the key is still consumed —
 * otherwise on a Mac it would quietly stretch the selection. In a table the shortcut gives `false`
 * (`Alt+↓` is its row), while the handle moves the whole table.
 */
export function moveBlock(dir: -1 | 1, scope: BlockScope = "selection"): Command {
  return (state, dispatch) => {
    if (scope === "selection" && inTable(state)) return false;
    const range = blockRange(state, scope);
    if (!range) return false;
    const blocks = blocksOf(range);
    const neighbourIndex = dir < 0 ? range.startIndex - 1 : range.endIndex;
    if (neighbourIndex < 0 || neighbourIndex >= range.parent.childCount) return true;
    if (dispatch) {
      const neighbour = range.parent.child(neighbourIndex);
      const from = dir < 0 ? range.start - neighbour.nodeSize : range.start;
      const to = dir < 0 ? range.end : range.end + neighbour.nodeSize;
      const content = dir < 0 ? [...blocks, neighbour] : [neighbour, ...blocks];
      const tr = state.tr.replaceWith(from, to, Fragment.from(content));
      dispatch(shifted(state, tr, dir * neighbour.nodeSize).scrollIntoView());
    }
    return true;
  };
}

/**
 * The handle's "Delete" — the whole Block; the caret goes to the neighbour above, and for the
 * first Block to the neighbour below. The only Block of a container yields its place to an empty
 * default Block (a paragraph): the Schema does not allow an empty Document, and an empty column is
 * no better.
 */
export const deleteBlock: Command = (state, dispatch) => {
  const range = handleBlock(state);
  if (!range) return false;
  if (dispatch) {
    const tr = state.tr;
    if (range.parent.childCount === 1) {
      const filler = range.parent.type.contentMatch.defaultType?.createAndFill();
      if (!filler) return false;
      tr.replaceWith(range.start, range.end, filler);
      tr.setSelection(Selection.near(tr.doc.resolve(range.start + 1)));
    } else {
      tr.delete(range.start, range.end);
      tr.setSelection(Selection.near(tr.doc.resolve(range.start), range.startIndex > 0 ? -1 : 1));
    }
    dispatch(tr.scrollIntoView());
  }
  return true;
};

/**
 * Whether the Block shortcuts do the same as the handle's items (the item's shortcut label is
 * shown only then).
 *
 * - `duplicate` — `⌘⇧D` takes the same Block: the caret is not in a list item.
 * - `move` — the same, and not in a table: there `⌥⇧↑/↓` belongs to the rows.
 * - `type` — the ¶ shortcuts (`⌘⌥2`) change the text Block under the caret, while "Format" changes
 *   the handle's Block: the same thing only when it is one Block (not a list item, not a paragraph
 *   in a quote).
 */
export function handleShortcutsMatch(state: EditorState): {
  duplicate: boolean;
  move: boolean;
  type: boolean;
} {
  const handle = handleBlock(state);
  const keys = blockRange(state, "selection");
  const same = !!handle && !!keys && handle.start === keys.start && handle.end === keys.end;
  return {
    duplicate: same,
    move: same && !inTable(state),
    type: !!handle && state.selection.$from.depth === handle.depth + 1,
  };
}

/**
 * `⌘A` as in Notion: the first press selects the text of the current Block, the second — the whole
 * Document. It selects the whole Document at once if the Block's text is already selected, the
 * Block is empty, or the selection is already wider than one Block. The Document does not change —
 * it also works in `readOnly`, like the usual `⌘A`.
 */
export function selectBlockText(editor: Editor): boolean {
  const { selection } = editor.state;
  const { $from, $to } = selection;
  if (selection instanceof TextSelection && $from.sameParent($to) && $from.parent.inlineContent) {
    const start = $from.start();
    const end = $from.end();
    if (start < end && (selection.from !== start || selection.to !== end)) {
      editor.view.dispatch(
        editor.state.tr.setSelection(TextSelection.create(editor.state.doc, start, end))
      );
      return true;
    }
  }
  return editor.commands.selectAll();
}

/** The nearest list item under the caret; its type is the one that gets shifted. */
function listItemType(state: EditorState): string | null {
  const { $from } = state.selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    const name = $from.node(depth).type.name;
    if (LIST_ITEMS.has(name)) return name;
  }
  return null;
}

export interface BlockCommandsOptions {
  /** Whether the `clearFormatting` Tool is on: without it `⌘\` does not clear the styles. */
  clearFormatting: boolean;
}

export const BlockCommands = Extension.create<BlockCommandsOptions>({
  name: "blockCommands",
  addOptions: () => ({ clearFormatting: false }),
  addKeyboardShortcuts() {
    const editable = () => this.editor.isEditable;
    const run = (command: Command) => () =>
      editable() && command(this.editor.state, this.editor.view.dispatch);
    /*
      `⌘]` and `⌘[` do what Tab and Shift+Tab do in a list. In an item the key is consumed even
      if there is nowhere to shift (the first item): in Chrome on a Mac `⌘[` means "Back", and a
      miss at the edge of the list would navigate away from a page with unsaved text. Outside a
      list it returns `false`, and the shortcut goes to the browser: a paragraph has no indent in
      the Schema.
    */
    const shiftItem = (dir: "sink" | "lift") => () => {
      const type = editable() ? listItemType(this.editor.state) : null;
      if (!type) return false;
      if (dir === "sink") this.editor.commands.sinkListItem(type);
      else this.editor.commands.liftListItem(type);
      return true;
    };
    return {
      "Mod-Shift-d": run(duplicateBlock()),
      "Alt-Shift-ArrowUp": run(moveBlock(-1)),
      "Alt-Shift-ArrowDown": run(moveBlock(1)),
      "Mod-a": () => selectBlockText(this.editor),
      "Mod-]": shiftItem("sink"),
      "Mod-[": shiftItem("lift"),
      "Mod-\\": () => {
        if (!this.options.clearFormatting || !editable()) return false;
        this.editor.commands.unsetAllMarks();
        return true;
      },
    };
  },
});

/**
 * `⌘/` (`Ctrl+/`) — the Block handle's menu, BY THE KEY'S POSITION, not by the character.
 *
 * ProseMirror's keymap matches the character: on a Russian layout the "/" key types ".", so
 * `Mod-/` turned into `Mod-.`, which is the superscript shortcut. So the key is recognised by
 * `event.code` ("Slash" on any layout), and the extension sits above the usual priority: its
 * handler is polled before the Marks' keymaps, so the superscript does not get the keystroke in
 * time. Alt is ignored: it is a different shortcut.
 */
export const BlockMenuKey = Extension.create<{ openBlockMenu: () => boolean }>({
  name: "blockMenuKey",
  priority: 1001,
  addOptions: () => ({ openBlockMenu: () => false }),
  addProseMirrorPlugins() {
    const { editor, options } = this;
    return [
      new Plugin({
        key: new PluginKey("blockMenuKey"),
        props: {
          handleKeyDown: (_view, event) => {
            const mod = event.metaKey || event.ctrlKey;
            const slash = event.code === "Slash" || (!event.code && event.key === "/");
            if (!mod || event.altKey || event.shiftKey || !slash) return false;
            if (!editor.isEditable || !options.openBlockMenu()) return false;
            event.preventDefault();
            return true;
          },
        },
      }),
    ];
  },
});
