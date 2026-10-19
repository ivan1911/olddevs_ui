"use client";

import type { Node as PmNode, NodeRange } from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";
import type { Editor } from "@tiptap/react";
import { BlockSelection } from "./blockSelection.js";
import { blockTypeOf } from "./blockTypes.js";
import { LIST_ITEMS } from "./blockUnit.js";
import type { InsertItem } from "./insertItems.js";

/**
 * "Format ›" over a row of Blocks (ADR-0077): the type of the handle's menu applied to a group.
 *
 * - EVERY TEXT BLOCK BECOMES THE NEW TYPE: paragraphs, headings, quotes, lists and code Blocks. A
 *   table, an image, a rule and the containers (a Wrapper, a Column layout, a Details Block) stay as
 *   they are, and a custom Block does not change unless it has the `turnInto` trait.
 * - A LIST IS ONE LIST. A run of neighbouring text Blocks turned into a list becomes one list of
 *   that many items (a list is not "a list per paragraph"). A run ends at a Block that does not
 *   change, so a table in the middle splits it in two.
 * - "Text" breaks a list into paragraphs. It is the same step that turns any Block into a list
 *   or a heading: the Block is first freed from what wraps it (`clearNodes`), then the item applies.
 * - A QUOTE IS ONE QUOTE, like a list: a run of neighbouring text Blocks becomes one quote of that many
 *   paragraphs (the kit's rule for quotes; "Wrap in › Quote" gives the same for any Blocks).
 *
 * - A SET FROM DIFFERENT PLACES (ADR-0083) TURNS ROW BY ROW: a run never crosses a gap, so two rows of
 *   paragraphs become two lists.
 *
 * The whole group is one transaction, so it is one undo step.
 */

/** Whether the Block changes under "Format ›": a text Block, a list item, or a custom Block that opted in. */
export function isTurnable(node: PmNode): boolean {
  return (
    blockTypeOf(node) !== null || node.type.spec.turnInto === true || LIST_ITEMS.has(node.type.name)
  );
}

/** The `id` shared by all text Blocks of the rows, or `null` when they differ or there are none. */
export function sharedBlockType(rows: readonly NodeRange[]): string | null {
  let shared: string | null = null;
  for (const range of rows) {
    for (let index = range.startIndex; index < range.endIndex; index++) {
      const node = range.parent.child(index);
      if (!isTurnable(node)) continue;
      const type = blockTypeOf(node);
      if (type === null || (shared !== null && shared !== type)) return null;
      shared = type;
    }
  }
  return shared;
}

/** Positions of the text inside runs of the row's Blocks that change, in document order. */
function runsOf(range: NodeRange): { from: number; to: number }[] {
  const runs: { from: number; to: number }[] = [];
  let open: { from: number; to: number } | null = null;
  let pos = range.start;
  for (let index = range.startIndex; index < range.endIndex; index++) {
    const node = range.parent.child(index);
    const next = pos + node.nodeSize;
    if (!isTurnable(node)) {
      open = null;
    } else if (open) {
      open.to = next - 1;
    } else {
      open = { from: pos + 1, to: next - 1 };
      runs.push(open);
    }
    pos = next;
  }
  return runs;
}

/**
 * Turn the Blocks of the rows into the item's type. `false` means nothing in them can change.
 * The item must not open a popover (`item.popover`): those are insertions, not types.
 */
export function turnBlocksInto(
  editor: Editor,
  item: InsertItem,
  rows: readonly NodeRange[]
): boolean {
  const runs = rows.flatMap(runsOf);
  if (runs.length === 0 || item.popover) return false;
  const before = editor.state.selection;
  const chain = editor.chain().focus();
  // The last run first: an edit shifts the positions after it, never before it.
  for (const run of [...runs].reverse()) {
    chain
      .command(({ tr }) => {
        tr.setSelection(TextSelection.between(tr.doc.resolve(run.from), tr.doc.resolve(run.to)));
        return true;
      })
      .clearNodes();
    item.run(chain, editor);
  }
  chain
    .command(({ tr }) => {
      if (before instanceof BlockSelection) {
        // Outward: the units are now whatever the edit made of them (a list around the items).
        tr.setSelection(before.mapOutward(tr.doc, tr.mapping));
      } else {
        tr.setSelection(before.map(tr.doc, tr.mapping));
      }
      return true;
    })
    .run();
  return true;
}
