"use client";

import { Extension, type Editor } from "@tiptap/core";
import { Fragment, type NodeRange } from "@tiptap/pm/model";
import {
  Plugin,
  PluginKey,
  TextSelection,
  type EditorState,
  type Transaction,
} from "@tiptap/pm/state";
import { StepMap } from "@tiptap/pm/transform";
import { BlockSelection, removeUnits } from "./blockSelection.js";
import {
  blockUnitRange,
  inTable,
  isBlockContainer,
  isBlockUnit,
  onlyUnits,
  unitNodes,
} from "./blockUnit.js";

export { isBlockContainer };

/**
 * Commands over Blocks: duplicate, move, select the text of a Block, shift a list item, clear
 * styles — as in Notion and Google Docs. Which Blocks a command takes is `blockUnit.ts`.
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

const LIST_ITEMS: ReadonlySet<string> = new Set(["listItem", "taskItem"]);

/**
 * Whose Blocks the command takes.
 *
 * - `selection` — keyboard shortcuts: the Blocks under the selection, and in a list — the item;
 *   duplicating and moving an item stay within its list.
 * - `handle` — the Block handle: the whole container Block (the whole list, the whole table), or
 *   the row of Blocks the handle stands on (`handleBlocks`): the Blocks a text selection touches, or
 *   the units of a Block selection.
 */
export type BlockScope = "selection" | "handle";

/**
 * The handle's Block — a child of the nearest container of Blocks (`isBlockContainer`) that holds
 * the selection: a paragraph, a heading, a whole list, a quote, a code Block, a table, an image, a
 * horizontal rule. ONE function for everything the handle knows about a Block: where to draw it,
 * what to move, copy, delete, insert under, and what to turn into. A selection across several
 * Blocks, and a caret in the gap between them, give `null`: the handle has nothing to attach to.
 * The Block handle over a row of Blocks is `handleBlocks`.
 */
export function handleBlock(state: Pick<EditorState, "selection">): NodeRange | null {
  const range = handleBlocks(state);
  return range && range.endIndex - range.startIndex === 1 ? range : null;
}

/**
 * The Blocks the handle stands on: one or several, a row of siblings under one parent.
 *
 * - Block selection (ADR-0077) gives exactly its units, in a list the items.
 * - Otherwise the text selection gives the Blocks it touches, taken whole as `handleBlock` takes
 *   them: a list touched at one item is one Block, the whole list.
 *
 * The handle stands at the first Block of the row, and its menu acts on all of them. A caret in
 * the gap between Blocks gives `null`.
 */
export function handleBlocks(state: Pick<EditorState, "selection">): NodeRange | null {
  const { selection } = state;
  if (selection instanceof BlockSelection) return selection.nodeRange();
  const { $from, $to } = selection;
  const range = $from.blockRange($to, isBlockContainer);
  return onlyUnits(range && range.startIndex < range.endIndex ? range : null);
}

/**
 * The Blocks under the selection — a row of siblings under one parent (`blockUnitRange`).
 *
 * A Block is a child of a container of Blocks, and in a list it is an item. In a Column layout's
 * column the Block is a child of the column: moving does not take it out of the column, while a
 * selection across two columns takes the whole Column layout. A table is one Block as a whole,
 * even if its cell contains a list. A selection across several Blocks takes all of them: the row
 * is counted where the start and the end of the selection diverge. A caret in the gap between
 * Blocks is inside no Block — `null`. Block selection is exactly its units.
 */
function blockRange(state: EditorState, scope: BlockScope): NodeRange | null {
  if (scope === "handle") return handleBlocks(state);
  const { $from, $to } = state.selection;
  return blockUnitRange($from, $to);
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
      const tr = state.tr.insert(range.end, Fragment.from(unitNodes(range)));
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
    if (scope === "selection" && inTable(state.selection.$from, state.selection.$to)) return false;
    const range = blockRange(state, scope);
    if (!range) return false;
    const blocks = unitNodes(range);
    const neighbourIndex = dir < 0 ? range.startIndex - 1 : range.endIndex;
    if (neighbourIndex < 0 || neighbourIndex >= range.parent.childCount) return true;
    // The footnote list is always the last Block (ADR-0076): nothing moves past it.
    if (!isBlockUnit(range.parent.child(neighbourIndex))) return true;
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
 * The handle's "Delete" — the whole Block, or all the Blocks of the row the handle stands on; the
 * caret goes to the neighbour above, and for the first Block to the neighbour below. Every Block of
 * a container yields its place to an empty default Block (a paragraph): the Schema does not allow
 * an empty Document, and an empty column is no better.
 */
export const deleteBlock: Command = (state, dispatch) => {
  const range = handleBlocks(state);
  if (!range) return false;
  if (dispatch) {
    const tr = state.tr;
    if (!removeUnits(tr, range)) return false;
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
  const handle = handleBlocks(state);
  const keys = blockRange(state, "selection");
  const same = !!handle && !!keys && handle.start === keys.start && handle.end === keys.end;
  return {
    duplicate: same,
    move: same && !inTable(state.selection.$from, state.selection.$to),
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
