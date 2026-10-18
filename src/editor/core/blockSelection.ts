"use client";

import { NodeRange, Slice, type Node as PmNode, type ResolvedPos } from "@tiptap/pm/model";
import {
  Selection,
  SelectionRange,
  type SelectionBookmark,
  type Transaction,
} from "@tiptap/pm/state";
import type { Mappable } from "@tiptap/pm/transform";
import { holdsUnits, LIST_NODES } from "./blockUnit.js";

/**
 * Block selection (ADR-0077): several Blocks selected whole, with no caret and no text selection.
 *
 * The device follows `NodeRangeSelection` from `@tiptap/extension-node-range`, which the kit does not
 * install: its units of selection are the kit's own (`blockUnit.ts`), and a new package would be a
 * new line in every consumer's install. A selection is a row of sibling Blocks under one parent,
 * from the edge before the first one to the edge after the last one. The order of the two ends
 * carries the direction: `anchor` is where the selection started, `head` is the end that
 * `Shift+↑/↓` moves.
 *
 * It lives in the core, not in the Tool: the Block handle and the Block commands read it in every
 * Editor, even though only the `blockSelection` Tool can produce it.
 */

/**
 * Whether `from..to` is a valid row of units: both edges between Blocks of one parent that holds
 * units, with at least one Block in between.
 */
function isUnitRow(doc: PmNode, from: number, to: number): boolean {
  if (!(from >= 0 && to <= doc.content.size && from < to)) return false;
  const $from = doc.resolve(from);
  const $to = doc.resolve(to);
  return (
    $from.sameParent($to) &&
    $from.depth === $to.depth &&
    holdsUnits($from.parent) &&
    $from.nodeAfter !== null &&
    $to.nodeBefore !== null
  );
}

export class BlockSelection extends Selection {
  /**
   * `$anchor` and `$head` are the two edges of the row. When `$anchor` is before `$head`, the
   * selection grows downwards.
   */
  constructor($anchor: ResolvedPos, $head: ResolvedPos) {
    const $from = $anchor.pos <= $head.pos ? $anchor : $head;
    const $to = $anchor.pos <= $head.pos ? $head : $anchor;
    super($anchor, $head, [new SelectionRange($from, $to)]);
  }

  /**
   * The selection of the row `anchor..head` (the two edges, in either order), or `null` when it is
   * not a row of units. Never throws: positions come from mapped or stored selections.
   */
  static tryCreate(doc: PmNode, anchor: number, head: number): BlockSelection | null {
    const from = Math.min(anchor, head);
    const to = Math.max(anchor, head);
    return isUnitRow(doc, from, to)
      ? new BlockSelection(doc.resolve(anchor), doc.resolve(head))
      : null;
  }

  /** The selection of the units of a range; `forward: false` puts the head at the top edge. */
  static ofRange(range: NodeRange, forward = true): BlockSelection {
    const { doc } = range.$from;
    const [anchor, head] = forward ? [range.start, range.end] : [range.end, range.start];
    return new BlockSelection(doc.resolve(anchor), doc.resolve(head));
  }

  /** The selection runs from the top edge to the bottom one, so `Shift+↓` extends it. */
  get forward(): boolean {
    return this.anchor <= this.head;
  }

  /** The selected units, as a range of their parent. */
  nodeRange(): NodeRange {
    return new NodeRange(this.$from, this.$to, this.$from.depth);
  }

  /** How many Blocks are selected. */
  get count(): number {
    const range = this.nodeRange();
    return range.endIndex - range.startIndex;
  }

  /** The index (in the parent) of the unit the selection grew from. */
  get anchorIndex(): number {
    const range = this.nodeRange();
    return this.forward ? range.startIndex : range.endIndex - 1;
  }

  /** The index (in the parent) of the unit that `Shift+↑/↓` moves. */
  get headIndex(): number {
    const range = this.nodeRange();
    return this.forward ? range.endIndex - 1 : range.startIndex;
  }

  eq(other: Selection): boolean {
    return (
      other instanceof BlockSelection && other.anchor === this.anchor && other.head === this.head
    );
  }

  /**
   * Positions are mapped by the row's edges: the top edge sticks to what follows an insertion at
   * it, and the bottom edge to what precedes one, so an insertion at an edge stays outside. If the
   * row no longer exists (its Blocks were deleted or wrapped into text), the selection falls back
   * to the nearest caret.
   */
  map(doc: PmNode, mapping: Mappable): Selection {
    const from = mapping.map(this.from, 1);
    const to = mapping.map(this.to, -1);
    const [anchor, head] = this.forward ? [from, to] : [to, from];
    return (
      BlockSelection.tryCreate(doc, anchor, head) ??
      Selection.near(doc.resolve(Math.min(Math.max(from, 0), doc.content.size)))
    );
  }

  /**
   * Deleting the selection (`Backspace`, a cut) removes the Blocks and leaves the caret in the
   * neighbour, not the generic replacement: that one may widen the range and take the container
   * with it. A paste replaces them with the pasted content by the generic rule.
   */
  replace(tr: Transaction, content = Slice.empty): void {
    if (content.size > 0) return void super.replace(tr, content);
    removeUnits(tr, this.nodeRange());
  }

  toJSON(): { type: string; anchor: number; head: number } {
    return { type: "blockRange", anchor: this.anchor, head: this.head };
  }

  static fromJSON(doc: PmNode, json: { anchor: number; head: number }): BlockSelection {
    const selection = BlockSelection.tryCreate(doc, json.anchor, json.head);
    if (!selection) throw new RangeError("Invalid input for BlockSelection.fromJSON");
    return selection;
  }

  getBookmark(): SelectionBookmark {
    return new BlockBookmark(this.anchor, this.head);
  }
}

/** The position of a selection that history and the plugins keep across steps. */
class BlockBookmark implements SelectionBookmark {
  constructor(
    private readonly anchor: number,
    private readonly head: number
  ) {}

  map(mapping: Mappable): SelectionBookmark {
    const forward = this.anchor <= this.head;
    const from = mapping.map(Math.min(this.anchor, this.head), 1);
    const to = mapping.map(Math.max(this.anchor, this.head), -1);
    return forward ? new BlockBookmark(from, to) : new BlockBookmark(to, from);
  }

  resolve(doc: PmNode): Selection {
    return (
      BlockSelection.tryCreate(doc, this.anchor, this.head) ??
      Selection.near(doc.resolve(Math.min(Math.max(this.head, 0), doc.content.size)))
    );
  }
}

// No DOM selection and no caret are drawn: the Blocks are highlighted by decorations (as with a
// selected node, which ProseMirror hides in the same way).
BlockSelection.prototype.visible = false;

try {
  Selection.jsonID("blockRange", BlockSelection);
} catch {
  // Registered already: the module was loaded twice (a hot reload); the first class stays.
}

/**
 * Remove a row of Blocks. The caret goes to the neighbour above, and for the first Block to the
 * neighbour below. The units that are all the children of their parent yield their place to an
 * empty default Block (a paragraph): the Schema does not allow an empty Document, and an empty
 * column is no better.
 */
export function removeUnits(tr: Transaction, range: NodeRange): boolean {
  const { parent, startIndex, endIndex } = range;
  if (startIndex === 0 && endIndex === parent.childCount) {
    // Every item of a list: the list goes, not the items one by one into an empty item.
    if (LIST_NODES.has(parent.type.name) && range.depth > 0) {
      const $before = tr.doc.resolve(range.$from.before(range.depth));
      const $after = tr.doc.resolve(range.$from.after(range.depth));
      return removeUnits(tr, new NodeRange($before, $after, $before.depth));
    }
    const filler = parent.type.contentMatch.defaultType?.createAndFill();
    if (!filler) return false;
    tr.replaceWith(range.start, range.end, filler);
    tr.setSelection(Selection.near(tr.doc.resolve(range.start + 1)));
  } else {
    tr.delete(range.start, range.end);
    tr.setSelection(Selection.near(tr.doc.resolve(range.start), startIndex > 0 ? -1 : 1));
  }
  return true;
}
