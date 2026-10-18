"use client";

import type { NodeRange } from "@tiptap/pm/model";
import { NodeSelection, Selection, type EditorState } from "@tiptap/pm/state";
import { BlockSelection } from "../../core/blockSelection.js";
import { blockUnitRange } from "../../core/blockUnit.js";

/**
 * The moves of Block selection (ADR-0077) as pure functions of the state: where `Esc`, `Shift+↑/↓`,
 * `↑/↓` and `Shift+click` lead. The plugin (`blockSelectionPlugin.ts`) only dispatches the result.
 */

/**
 * `Esc` in the text: the Blocks the selection touches become selected, found by the Block unit rule
 * (`blockUnit.ts`). A caret gives its own Block, a text selection across several Blocks gives all
 * of them, a click into a table cell gives the whole table. `null` where the selection is in no
 * unit (a caret in the gap between Blocks).
 */
export function selectCurrent(state: EditorState): BlockSelection | null {
  const { selection } = state;
  const range = blockUnitRange(selection.$from, selection.$to);
  return range ? BlockSelection.ofRange(range, selection.anchor <= selection.head) : null;
}

/** The selection of the units `anchor` and `head` (indices in the row's parent) and everything between. */
function selectSpan(range: NodeRange, anchor: number, head: number): BlockSelection | null {
  const { $from, depth } = range;
  const first = Math.min(anchor, head);
  const last = Math.max(anchor, head);
  const from = $from.posAtIndex(first, depth);
  const to = $from.posAtIndex(last + 1, depth);
  const [edgeAnchor, edgeHead] = head >= anchor ? [from, to] : [to, from];
  return BlockSelection.tryCreate($from.doc, edgeAnchor, edgeHead);
}

/**
 * The Block above or below the row, as a range of one unit — or, past the edge of the parent, the
 * container itself: a column, a Wrapper or the content of a Details Block yields the whole thing,
 * and through two columns the whole Column layout (the same row `⌘⇧D` takes). `null` at the edge of
 * the Document.
 */
function containerUnit(range: NodeRange): NodeRange | null {
  const { $from, depth } = range;
  if (depth === 0) return null;
  // A position just inside the parent: the unit rule then starts one level up, at the parent itself.
  const inside = $from.doc.resolve($from.start(depth));
  return blockUnitRange(inside, inside);
}

/**
 * `Shift+↑/↓`: move the head by one Block. Past the edge of the parent the selection becomes the
 * container whole, and the next press goes on at its level. The anchor stays put, so the same
 * keys shrink the selection back.
 */
export function extendSelection(selection: BlockSelection, dir: -1 | 1): BlockSelection {
  const range = selection.nodeRange();
  const head = selection.headIndex + dir;
  if (head >= 0 && head < range.parent.childCount) {
    return selectSpan(range, selection.anchorIndex, head) ?? selection;
  }
  const up = containerUnit(range);
  return up ? BlockSelection.ofRange(up, dir > 0) : selection;
}

/**
 * `↑/↓`: move the selection to the neighbouring Block. A single Block moves by one; a group
 * collapses onto the Block just beyond its edge. At the edge of the parent the selection stays.
 */
export function moveSelection(selection: BlockSelection, dir: -1 | 1): BlockSelection {
  const range = selection.nodeRange();
  const index = dir < 0 ? range.startIndex - 1 : range.endIndex;
  if (index < 0 || index >= range.parent.childCount) return selection;
  return selectSpan(range, index, index) ?? selection;
}

/**
 * `Shift+click` (and a tap after "Select" on a touch screen): draw the selection from its anchor to
 * the Block at `pos`. When that Block is in another container, the row is lifted to the level that
 * holds both, so a click in the second column selects the whole Column layout.
 */
export function extendToPosition(
  state: EditorState,
  selection: BlockSelection,
  pos: number
): BlockSelection | null {
  const { doc } = state;
  if (pos < 0 || pos > doc.content.size) return null;
  const range = selection.nodeRange();
  const anchorStart = range.$from.posAtIndex(selection.anchorIndex, range.depth);
  const anchorEnd = range.$from.posAtIndex(selection.anchorIndex + 1, range.depth);
  const forward = pos >= anchorStart;
  // The edge of the anchor Block that the row grows away from, so that the Block is always included.
  const pivot = doc.resolve(forward ? anchorStart : anchorEnd);
  const target = doc.resolve(pos);
  const units = blockUnitRange(pivot, target);
  return units ? BlockSelection.ofRange(units, forward) : null;
}

/**
 * Where the caret goes when the selection ends: the end of the first selected Block, as in
 * Notion. A Block with no text (an image, a rule) is selected itself instead.
 */
export function caretAfter(selection: BlockSelection): Selection {
  const range = selection.nodeRange();
  const first = range.parent.child(range.startIndex);
  const { doc } = selection.$from;
  if (first.isLeaf) {
    const node = NodeSelection.isSelectable(first) ? NodeSelection.create(doc, range.start) : null;
    return node ?? Selection.near(doc.resolve(range.start), 1);
  }
  return Selection.near(doc.resolve(range.start + first.nodeSize - 1), -1);
}
