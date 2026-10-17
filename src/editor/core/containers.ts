"use client";

import type { Node as PmNode, NodeType, ResolvedPos } from "@tiptap/pm/model";
import { TextSelection, type Transaction } from "@tiptap/pm/state";
import { WRAPPER_NODE } from "./nodeNames.js";

/**
 * What the container Blocks have in common — the Column layout (`layout.ts`, ADR-0056) and the
 * Wrapper (`wrapper.ts`, ADR-0057): where they are missing and where a new one goes.
 *
 * Neither is in the `block` group: only nodes that name them one by one accept them — the
 * Document, and a Wrapper also a Column layout's column. So the parsing and insertion rules are
 * the same for both, and they live here, so that the lists and the position arithmetic cannot
 * silently drift apart.
 */

/*
  The name of the Wrapper node lives in `nodeNames.ts`, without Tiptap: the Table of contents
  reads it too. Not in `wrapper.ts`: it is also in the common list below, and `wrapper.ts`
  imports this module, so a definition there would make an import cycle. `wrapper.ts`
  re-exports it.
*/
export { WRAPPER_NODE };

/**
 * Nodes inside which there is no container Block at all: a Wrapper, a quote, list items, table
 * cells and the content of a Details Block (`details.ts`). The column is not here — a Wrapper
 * accepts it; a Column layout adds it with its argument.
 */
const CONTAINER_FREE_NODES = [
  WRAPPER_NODE,
  "blockquote",
  "listItem",
  "taskItem",
  "tableCell",
  "tableHeader",
  "detailsContent",
];

/**
 * The context of a parse rule (`context` in `parseHTML`) in which a container Block is unwrapped:
 * a rule with `skip` hands its Blocks over one after another, instead of cutting the inserted
 * container in two. `more` — nodes where this Block is not present (the column — for a Column
 * layout). Names of disabled Tools are harmless: the context is matched by node name.
 */
export function containerFreeContext(...more: string[]): string {
  return [...more, ...CONTAINER_FREE_NODES].map((name) => `${name}//`).join(" | ");
}

/**
 * Whether the position lies inside a node where there is no container Block
 * (`CONTAINER_FREE_NODES`): the same rule as `containerFreeContext` for parsing HTML, for the
 * paths where Blocks are built without parsing HTML (Markdown paste, `markdown.ts`).
 */
export function inContainerFreeNode($pos: ResolvedPos): boolean {
  for (let depth = $pos.depth; depth > 0; depth--) {
    if (CONTAINER_FREE_NODES.includes($pos.node(depth).type.name)) return true;
  }
  return false;
}

/** Whether the node can hold a child of type `type`. */
function holds(node: PmNode, type: NodeType): boolean {
  return node.type.contentMatch.matchType(type) !== null;
}

/**
 * Place the container Block `container` under the current Block — in the nearest node up the tree
 * that accepts it (the Document; for a Wrapper, also a column).
 *
 * An empty paragraph right in it (prepared by the Slash menu) is replaced. From a Wrapper, a
 * column, a list, a quote or a cell, the Block goes under their Block in that node; an empty
 * paragraph of a container of Blocks (a Wrapper or a column) in which `/` was typed is removed in
 * that case, if there is something else there — otherwise the insertion would leave an empty
 * tail. The caret goes into the first text Block of the new container.
 */
export function placeContainerBlock(tr: Transaction, container: PmNode): void {
  const { selection } = tr;
  const { $from } = selection;
  let depth = $from.depth;
  while (depth > 0 && !holds($from.node(depth), container.type)) depth--;
  const emptyBlock = $from.parent.isTextblock && $from.parent.content.size === 0;
  let pos: number;
  if (emptyBlock && $from.depth === depth + 1) {
    pos = $from.before();
    tr.replaceWith(pos, $from.after(), container);
  } else {
    pos = $from.depth === depth ? selection.to : $from.after(depth + 1);
    const parent = $from.depth > depth + 1 ? $from.node(-1) : null;
    if (emptyBlock && parent?.type.spec.blockContainer === true && parent.childCount > 1) {
      const steps = tr.mapping.maps.length;
      tr.delete($from.before(), $from.after());
      pos = tr.mapping.slice(steps).map(pos);
    }
    tr.insert(pos, container);
  }
  // One step inward per level, down to the text Block: Wrapper › paragraph — two;
  // Column layout › column › paragraph — three.
  let inner = pos + 1;
  for (let node = container; !node.isTextblock && node.firstChild; node = node.firstChild) inner++;
  tr.setSelection(TextSelection.create(tr.doc, inner)).scrollIntoView();
}
