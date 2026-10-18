"use client";

import type { Node as PmNode, NodeRange, ResolvedPos } from "@tiptap/pm/model";

/**
 * The Block unit (ADR-0077): the Block of its container.
 *
 * ONE DEFINITION FOR EVERYTHING THAT WORKS WITH "A BLOCK". The keys `⌘⇧D` and `⌥⇧↑/↓`, the Block
 * handle over a range and Block selection (`features/blockSelection/`) all count Blocks here, so
 * what is highlighted is exactly what is moved, duplicated and deleted. The focus mode
 * (OLDSUI-312) dims the Blocks around the current one by the same rule.
 *
 * - A unit is a child of a container of Blocks (`isBlockContainer`): the Document, a column of a
 *   Column layout, a Wrapper, the content of a Details Block.
 * - In a list the unit is the item, not the list (`LIST_NODES`).
 * - A table is one unit as a whole, even when a cell holds a list.
 * - Several units are always siblings of one parent. A range that starts and ends in different
 *   parents (two columns) takes the unit above them (the whole Column layout).
 *
 * An internal module: it is not part of the public API.
 */

/** Lists: their children are the units, the list itself is one only at the edge of its range. */
export const LIST_NODES: ReadonlySet<string> = new Set(["bulletList", "orderedList", "taskList"]);

/**
 * A container of Blocks — a node whose children are the Blocks: the Document itself, and any node
 * whose Schema is marked `blockContainer: true`.
 *
 * A SEAM FOR THE COLUMN LAYOUT. A column of a Column layout holds its own Blocks, and they should
 * each have their own handle at the column's left edge, not one for the whole layout. The column
 * node declares itself a container with a flag in the Schema (in Tiptap, through
 * `extendNodeSchema`), and the handle, its position and all its actions (up, down, duplicate,
 * delete, add below, format) work inside the column without changing the modules that count Blocks.
 */
export function isBlockContainer(node: PmNode): boolean {
  return node.type.name === "doc" || node.type.spec.blockContainer === true;
}

/** A node whose children are units: a container of Blocks or a list. */
export function holdsUnits(node: PmNode): boolean {
  return isBlockContainer(node) || LIST_NODES.has(node.type.name);
}

/** The depth of the deepest table that holds both positions, or `0` when there is none. */
function sharedTableDepth($from: ResolvedPos, $to: ResolvedPos): number {
  for (let depth = $from.sharedDepth($to.pos); depth > 0; depth--) {
    if ($from.node(depth).type.spec.tableRole === "table") return depth;
  }
  return 0;
}

/**
 * Whether the range lies entirely inside one table: there `⌥⇧↑/↓` does not move anything
 * (`Alt+↓` is the row), and the Block is the whole table. A range that starts or ends outside a
 * table moves the table itself along with its neighbours.
 */
export function inTable($from: ResolvedPos, $to: ResolvedPos): boolean {
  return sharedTableDepth($from, $to) > 0;
}

/**
 * The Block units under a range, as a row of siblings under one parent; `null` when the range
 * lies in no unit (a caret in the gap at the Document level).
 *
 * `$from` and `$to` may be anywhere: in text, in a table cell, or between Blocks (the edges of a
 * selected range of units). A range inside one table takes the whole table; so a table nested in
 * a list item is one unit and not the item that holds it.
 */
export function blockUnitRange($from: ResolvedPos, $to: ResolvedPos = $from): NodeRange | null {
  let low = $from;
  let high = $to;
  const tableDepth = sharedTableDepth($from, $to);
  if (tableDepth > 0) {
    // Step out of the table to its edges: from there it is an ordinary Block of its parent.
    low = $from.doc.resolve($from.before(tableDepth));
    high = $from.doc.resolve($from.after(tableDepth));
  }
  const range = low.blockRange(high, holdsUnits);
  // A caret in the gap at the Document level gives an empty row, not `null`.
  return range && range.startIndex < range.endIndex ? range : null;
}

/** The single Block unit that holds the position, or `null` when it lies in none. */
export function blockUnitAt($pos: ResolvedPos): NodeRange | null {
  return blockUnitRange($pos, $pos);
}

/** The nodes of a row of units, in order. */
export function unitNodes(range: NodeRange): PmNode[] {
  const nodes: PmNode[] = [];
  for (let index = range.startIndex; index < range.endIndex; index++) {
    nodes.push(range.parent.child(index));
  }
  return nodes;
}
