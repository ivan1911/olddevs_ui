"use client";

import type { Editor } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { NodeSelection, TextSelection, type EditorState } from "@tiptap/pm/state";
import { BLOCK_FORMULA_NODE, INLINE_FORMULA_NODE, isFormulaNodeName } from "./mathNames.js";

/** The node is a formula, inline or block. */
export function isFormulaNode(node: ProseMirrorNode): boolean {
  return isFormulaNodeName(node.type.name);
}

/**
 * The selected formula: a node with its position. It is selected when the whole node is
 * selected (a click), or when the selection is exactly its range, as with `Shift+→` from
 * the caret in front of it. From the keyboard only the second case selects a formula:
 * ProseMirror moves the caret across an inline atom without selecting it, and a node
 * selection made by the program is reset by Chromium to the caret on the next
 * `selectionchange`. An arrow key handled for this purpose would not move the caret at
 * all. `null` means something else is selected.
 */
export function selectedFormula(state: EditorState): { node: ProseMirrorNode; pos: number } | null {
  const { selection } = state;
  if (selection instanceof NodeSelection) {
    return isFormulaNode(selection.node) ? { node: selection.node, pos: selection.from } : null;
  }
  const node = selection.empty ? null : state.doc.nodeAt(selection.from);
  return node && isFormulaNode(node) && selection.to === selection.from + node.nodeSize
    ? { node, pos: selection.from }
    : null;
}

/**
 * Insert a formula at the caret (the Slash menu's popover). An inline formula replaces
 * the selection. A block formula takes the place of an empty paragraph with the caret, or
 * goes right after the Block the caret is in, the way a Block from the "Add" item does: a
 * Block has no place inside a paragraph. After a block formula the caret moves to the
 * paragraph after it; if the Block was the last one, a paragraph is appended, since otherwise
 * there would be nowhere to type after the formula. One transaction is one undo step.
 */
export function insertFormula(editor: Editor, kind: "inline" | "block", latex: string): boolean {
  if (kind === "inline") {
    return editor
      .chain()
      .focus()
      .insertContent({ type: INLINE_FORMULA_NODE, attrs: { latex } })
      .run();
  }
  return editor
    .chain()
    .focus()
    .command(({ tr }) => {
      const type = tr.doc.type.schema.nodes[BLOCK_FORMULA_NODE];
      const paragraph = tr.doc.type.schema.nodes.paragraph;
      if (!type || !paragraph) return false;
      const { selection } = tr;
      const { $from } = selection;
      // Where it goes: a selected Block goes after it, an empty paragraph is replaced, and
      // otherwise after the Block the caret is in, at the deepest level where a formula fits.
      let from: number | null = null;
      let to: number | null = null;
      if (selection instanceof NodeSelection && selection.node.isBlock) {
        const index = $from.indexAfter();
        if ($from.parent.canReplaceWith(index, index, type)) from = to = selection.to;
      } else {
        const replacing =
          selection.empty && $from.parent.isTextblock && $from.parent.childCount === 0;
        for (let depth = $from.depth; depth > 0 && from === null; depth--) {
          const container = $from.node(depth - 1);
          // An empty paragraph is replaced; otherwise the formula goes right after the Block at the
          // `depth` level.
          const swap = replacing && depth === $from.depth;
          const index = swap ? $from.index(depth - 1) : $from.indexAfter(depth - 1);
          if (container.canReplaceWith(index, swap ? index + 1 : index, type)) {
            from = swap ? $from.before(depth) : $from.after(depth);
            to = swap ? $from.after(depth) : from;
          }
        }
      }
      if (from === null || to === null) return false;
      const formula = type.create({ latex });
      const nodes = [formula];
      // If the Block is the last one in its container, a paragraph is needed after it for
      // the caret.
      if (!tr.doc.resolve(to).nodeAfter) nodes.push(paragraph.create());
      tr.replaceWith(from, to, nodes);
      tr.setSelection(TextSelection.near(tr.doc.resolve(from + formula.nodeSize), 1));
      return true;
    })
    .run();
}
