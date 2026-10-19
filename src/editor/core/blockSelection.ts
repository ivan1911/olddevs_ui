"use client";

import {
  Fragment,
  NodeRange,
  Slice,
  type Node as PmNode,
  type ResolvedPos,
} from "@tiptap/pm/model";
import {
  Selection,
  SelectionRange,
  type SelectionBookmark,
  type Transaction,
} from "@tiptap/pm/state";
import type { Mappable } from "@tiptap/pm/transform";
import { allUnits, holdsUnits, LIST_NODES, unitNodes } from "./blockUnit.js";

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
 * A set of Blocks from different places (ADR-0083, `Cmd/Ctrl+click`) is the same class: the active
 * row is `anchor..head`, the other Blocks of the set are `others`, and `ranges` holds every row in
 * document order. A set whose Blocks all touch is one row and behaves like one.
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
    $to.nodeBefore !== null &&
    // A node that is not a unit (the footnote list) is never inside a selected row.
    allUnits($from.parent, $from.index(), $to.index())
  );
}

/** One Block of a set: the edges around it, positions between the Blocks of its parent. */
export interface BlockSpan {
  readonly from: number;
  readonly to: number;
}

/** Whether two spans share a Block: a container and a Block inside it overlap too. */
function overlaps(a: BlockSpan, b: BlockSpan): boolean {
  return a.from < b.to && b.from < a.to;
}

/**
 * The rows of a set: the spans in document order, neighbours joined into one row. Two spans that
 * touch share an edge, and an edge is a position between the Blocks of one parent, so a joined row
 * is still a row of siblings.
 */
function joinRows(spans: readonly BlockSpan[]): BlockSpan[] {
  const rows: { from: number; to: number }[] = [];
  for (const span of [...spans].sort((a, b) => a.from - b.from)) {
    const last = rows.at(-1);
    if (last && last.to === span.from) last.to = span.to;
    else rows.push({ from: span.from, to: span.to });
  }
  return rows;
}

/**
 * A selection from positions that may be stale (mapped, stored, read from JSON). The Blocks of the
 * set that are no longer rows of units leave it; when the active row is gone, the first Block left
 * takes its place, and with nothing left the selection falls back to the nearest caret.
 */
function restore(
  doc: PmNode,
  anchor: number,
  head: number,
  others: readonly BlockSpan[]
): Selection {
  const kept = others.filter((span) => isUnitRow(doc, span.from, span.to));
  const active = BlockSelection.tryCreate(doc, anchor, head, kept);
  if (active) return active;
  const [first, ...rest] = kept;
  if (first) return new BlockSelection(doc.resolve(first.from), doc.resolve(first.to), rest);
  return Selection.near(
    doc.resolve(Math.min(Math.max(Math.min(anchor, head), 0), doc.content.size))
  );
}

export class BlockSelection extends Selection {
  /**
   * The Blocks of the set besides the active row (ADR-0083): one span per Block as `Cmd/Ctrl+click`
   * added them, or a whole row after "Format ›" made a list of it (`mapOutward`). A Block that overlaps the active row (it is inside the row, or holds it) is kept
   * here but not selected: the row wins, and the Block comes back once `Shift` shrinks the row off
   * it. The next `Cmd/Ctrl+click` rebuilds the set from what is selected, and such a Block is gone.
   */
  readonly others: readonly BlockSpan[];

  /**
   * `$anchor` and `$head` are the two edges of the active row: the one `Shift+↑/↓` and
   * `Shift+click` change. When `$anchor` is before `$head`, the row grows downwards. `others` are
   * the rest of the set; `ranges` holds every row of the selection in document order.
   */
  constructor($anchor: ResolvedPos, $head: ResolvedPos, others: readonly BlockSpan[] = []) {
    const { doc } = $anchor;
    const active = { from: Math.min($anchor.pos, $head.pos), to: Math.max($anchor.pos, $head.pos) };
    const rows = joinRows([...others.filter((span) => !overlaps(span, active)), active]);
    super(
      $anchor,
      $head,
      rows.map((row) => new SelectionRange(doc.resolve(row.from), doc.resolve(row.to)))
    );
    this.others = others;
  }

  /**
   * The selection of the row `anchor..head` (the two edges, in either order), or `null` when it is
   * not a row of units. Never throws: positions come from mapped or stored selections.
   */
  static tryCreate(
    doc: PmNode,
    anchor: number,
    head: number,
    others: readonly BlockSpan[] = []
  ): BlockSelection | null {
    const from = Math.min(anchor, head);
    const to = Math.max(anchor, head);
    return isUnitRow(doc, from, to)
      ? new BlockSelection(doc.resolve(anchor), doc.resolve(head), others)
      : null;
  }

  /** The selection of the units of a range; `forward: false` puts the head at the top edge. */
  static ofRange(
    range: NodeRange,
    forward = true,
    others: readonly BlockSpan[] = []
  ): BlockSelection {
    const { doc } = range.$from;
    const [anchor, head] = forward ? [range.start, range.end] : [range.end, range.start];
    return new BlockSelection(doc.resolve(anchor), doc.resolve(head), others);
  }

  /** The active row runs from the top edge to the bottom one, so `Shift+↓` extends it. */
  get forward(): boolean {
    return this.anchor <= this.head;
  }

  /**
   * Whether the set is several rows with gaps between them (ADR-0083). Then the actions over a row —
   * moving, duplicating, wrapping, pasting — do nothing, and the handle's menu has them unavailable.
   */
  get scattered(): boolean {
    return this.ranges.length > 1;
  }

  /** Every row of the selection, as ranges of their parents, in document order. */
  rows(): NodeRange[] {
    return this.ranges.map(({ $from, $to }) => new NodeRange($from, $to, $from.depth));
  }

  /** The first row of the selection: the whole selection unless it is `scattered`. */
  nodeRange(): NodeRange {
    return new NodeRange(this.$from, this.$to, this.$from.depth);
  }

  /** The active row: the one `Shift+↑/↓` and `Shift+click` change. */
  activeRange(): NodeRange {
    const [$from, $to] = this.forward ? [this.$anchor, this.$head] : [this.$head, this.$anchor];
    return new NodeRange($from, $to, $from.depth);
  }

  /** Every selected Block, one span each, in document order. */
  units(): BlockSpan[] {
    const spans: BlockSpan[] = [];
    for (const row of this.rows()) {
      let pos = row.start;
      for (let index = row.startIndex; index < row.endIndex; index++) {
        const size = row.parent.child(index).nodeSize;
        spans.push({ from: pos, to: pos + size });
        pos += size;
      }
    }
    return spans;
  }

  /** How many Blocks are selected. */
  get count(): number {
    return this.rows().reduce((sum, row) => sum + row.endIndex - row.startIndex, 0);
  }

  /** The index (in the parent) of the unit the active row grew from. */
  get anchorIndex(): number {
    const range = this.activeRange();
    return this.forward ? range.startIndex : range.endIndex - 1;
  }

  /** The index (in the parent) of the unit that `Shift+↑/↓` moves. */
  get headIndex(): number {
    const range = this.activeRange();
    return this.forward ? range.endIndex - 1 : range.startIndex;
  }

  eq(other: Selection): boolean {
    return (
      other instanceof BlockSelection &&
      other.anchor === this.anchor &&
      other.head === this.head &&
      other.others.length === this.others.length &&
      other.others.every(
        (span, index) =>
          span.from === this.others[index]!.from && span.to === this.others[index]!.to
      )
    );
  }

  /**
   * Positions are mapped by the edges of each Block: the top edge sticks to what follows an
   * insertion at it, and the bottom edge to what precedes one, so an insertion at an edge stays
   * outside. A Block that no longer exists (deleted, or wrapped into text) leaves the set; when
   * nothing is left, the selection falls back to the nearest caret.
   */
  map(doc: PmNode, mapping: Mappable): Selection {
    const span = (from: number, to: number) => ({
      from: mapping.map(from, 1),
      to: mapping.map(to, -1),
    });
    const active = span(Math.min(this.anchor, this.head), Math.max(this.anchor, this.head));
    const [anchor, head] = this.forward ? [active.from, active.to] : [active.to, active.from];
    return restore(
      doc,
      anchor,
      head,
      this.others.map((other) => span(other.from, other.to))
    );
  }

  /**
   * The same mapping outwards, row by row: each edge of a row takes what an edit wrapped around it.
   * After "Format ›" the units are whatever the edit made of them — one list around a row of former
   * paragraphs. The row that holds the active one stays active.
   */
  mapOutward(doc: PmNode, mapping: Mappable): Selection {
    const from = Math.min(this.anchor, this.head);
    const index = Math.max(
      this.ranges.findIndex(({ $from, $to }) => $from.pos <= from && from < $to.pos),
      0
    );
    const rows = this.ranges.map(({ $from, $to }) => ({
      from: mapping.map($from.pos, -1),
      to: mapping.map($to.pos, 1),
    }));
    const active = rows[index]!;
    const [anchor, head] = this.forward ? [active.from, active.to] : [active.to, active.from];
    return restore(
      doc,
      anchor,
      head,
      rows.filter((_, other) => other !== index)
    );
  }

  /**
   * Deleting the selection (`Backspace`, a cut) removes the Blocks and leaves the caret in the
   * neighbour, not the generic replacement: that one may widen the range and take the container
   * with it. A paste replaces them with the pasted content by the generic rule.
   */
  replace(tr: Transaction, content = Slice.empty): void {
    if (content.size > 0) return void super.replace(tr, content);
    removeRows(tr, this.rows());
  }

  /**
   * What a copy takes. One row is a piece of the Document, as with any selection. A set with gaps
   * is its Blocks in document order, each whole: a list item goes in a list of its own kind (an
   * item cannot stand outside a list), the rest as they are.
   */
  content(): Slice {
    if (!this.scattered) return super.content();
    const nodes: PmNode[] = [];
    for (const row of this.rows()) {
      const units = unitNodes(row);
      if (LIST_NODES.has(row.parent.type.name)) {
        nodes.push(row.parent.type.create(row.parent.attrs, units));
      } else nodes.push(...units);
    }
    return new Slice(Fragment.from(nodes), 0, 0);
  }

  toJSON(): {
    type: string;
    anchor: number;
    head: number;
    others?: [number, number][];
  } {
    const json = { type: "blockRange", anchor: this.anchor, head: this.head };
    return this.others.length === 0
      ? json
      : { ...json, others: this.others.map((span) => [span.from, span.to] as [number, number]) };
  }

  static fromJSON(
    doc: PmNode,
    json: { anchor: number; head: number; others?: [number, number][] }
  ): BlockSelection {
    const others = (json.others ?? []).map(([from, to]) => ({ from, to }));
    const selection = BlockSelection.tryCreate(
      doc,
      json.anchor,
      json.head,
      others.filter((span) => isUnitRow(doc, span.from, span.to))
    );
    if (!selection) throw new RangeError("Invalid input for BlockSelection.fromJSON");
    return selection;
  }

  getBookmark(): SelectionBookmark {
    return new BlockBookmark(this.anchor, this.head, this.others);
  }
}

/** The position of a selection that history and the plugins keep across steps. */
class BlockBookmark implements SelectionBookmark {
  constructor(
    private readonly anchor: number,
    private readonly head: number,
    private readonly others: readonly BlockSpan[]
  ) {}

  map(mapping: Mappable): SelectionBookmark {
    const span = (from: number, to: number) => ({
      from: mapping.map(from, 1),
      to: mapping.map(to, -1),
    });
    const forward = this.anchor <= this.head;
    const active = span(Math.min(this.anchor, this.head), Math.max(this.anchor, this.head));
    return new BlockBookmark(
      forward ? active.from : active.to,
      forward ? active.to : active.from,
      this.others.map((other) => span(other.from, other.to))
    );
  }

  resolve(doc: PmNode): Selection {
    return restore(doc, this.anchor, this.head, this.others);
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
 * Remove every row of a selection as one edit (ADR-0083). The last row goes first: an edit shifts
 * the positions after it, never before it, so each row is still where it was. The caret ends up
 * where removing the first row leaves it.
 */
export function removeRows(tr: Transaction, rows: readonly NodeRange[]): boolean {
  let done = false;
  for (const row of [...rows].reverse()) {
    const range = new NodeRange(tr.doc.resolve(row.start), tr.doc.resolve(row.end), row.depth);
    done = removeUnits(tr, range) || done;
  }
  return done;
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
