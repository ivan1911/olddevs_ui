"use client";

import type { EditorView } from "@tiptap/pm/view";
import { TableMap } from "@tiptap/pm/tables";

/*
  Where the columns of a table are on the screen. The Document keeps shares (`tableShares.ts`), but a
  table that has none is laid out by the browser, and the first width edit of such a table has to
  start from what the author sees: the shares are rounded from these measurements. The pointer handle
  (`TableColumnHandles.tsx`) puts its bars at the same edges.
*/

/**
 * The horizontal edges of the columns of the table at `tablePos`, in viewport coordinates: one more
 * than the columns (the left edge of the first, then the right edge of each). Read from the cells,
 * not computed from the shares: a column the browser widened to fit its content (6 rem minimum,
 * a long word) is where it is, and the handle must sit on that edge.
 *
 * A column edge that no cell ends at (every row merges across it) is placed halfway between its
 * neighbours. `null` when there is nothing to measure: the table is not on screen, or has no layout
 * (a server render, a test DOM).
 */
export function columnEdges(view: EditorView, tablePos: number): number[] | null {
  const table = view.state.doc.nodeAt(tablePos);
  if (!table) return null;
  const map = TableMap.get(table);
  const edges: (number | undefined)[] = Array.from({ length: map.width + 1 });
  const start = tablePos + 1;
  for (let row = 0; row < map.height; row++) {
    for (let column = 0; column < map.width; column++) {
      const at = row * map.width + column;
      const cellPos = map.map[at]!;
      // A cell that began in a column to the left or in a row above was already measured there.
      if (
        (column > 0 && map.map[at - 1] === cellPos) ||
        (row > 0 && map.map[at - map.width] === cellPos)
      ) {
        continue;
      }
      const node = table.nodeAt(cellPos);
      const dom = view.nodeDOM(start + cellPos);
      if (!node || !(dom instanceof HTMLElement)) continue;
      const box = dom.getBoundingClientRect();
      const span = Math.max(1, Number(node.attrs.colspan) || 1);
      edges[column] ??= box.left;
      edges[column + span] ??= box.right;
    }
  }
  const first = edges[0];
  const last = edges[map.width];
  if (first === undefined || last === undefined || !(last > first)) return null;
  return fillGaps(edges as (number | undefined)[]);
}

/** Edges nobody measured sit evenly between the measured ones on either side. */
function fillGaps(edges: (number | undefined)[]): number[] {
  const result = [...edges];
  for (let i = 1; i < result.length - 1; i++) {
    if (result[i] !== undefined) continue;
    let next = i;
    while (result[next] === undefined) next++;
    const before = result[i - 1]!;
    const step = (result[next]! - before) / (next - i + 1);
    for (let j = i; j < next; j++) result[j] = before + step * (j - i + 1);
  }
  return result as number[];
}

/** The pixel width of each column, from the edges. */
export function columnWidths(edges: readonly number[]): number[] {
  return edges.slice(1).map((edge, i) => edge - edges[i]!);
}
