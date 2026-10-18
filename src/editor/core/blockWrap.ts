"use client";

import { Fragment, type Node as PmNode, type NodeRange } from "@tiptap/pm/model";
import { Selection, TextSelection, type Transaction } from "@tiptap/pm/state";
import { openDetailsOnInsert } from "../features/details/details.js";
import { BlockSelection } from "./blockSelection.js";
import { unitNodes } from "./blockUnit.js";

/**
 * Wrap existing Blocks into a container (ADR-0077): a Wrapper, a quote or a Details Block. Until
 * now the containers were only inserted empty, and "Unwrap" was the only way back. The command takes
 * a row of Block units (`blockUnit.ts`) and puts all of them into ONE container, in one edit.
 *
 * THE SCHEMA DECIDES WHERE IT IS ALLOWED. The container must accept these Blocks as its content
 * (a Wrapper does not hold another Wrapper or a Column layout), and its parent must accept the
 * container (a Wrapper stands only in the Document or a column; nothing goes into a list or a
 * table). Where it is not allowed, `planWrap` gives `null` and the menu item is unavailable. This
 * is the rule `CONTAINER_FREE_NODES` (`containers.ts`) states for insertion and parsing, read from
 * the Schema itself, so it cannot drift from the Tools that are enabled.
 */

/** Containers the Blocks can be wrapped into; the names are the Tools' names too. */
export type WrapKind = "wrapper" | "blockquote" | "details";

/** The container with the Blocks in it, or `null` where the Schema does not allow it. */
export function planWrap(range: NodeRange, kind: WrapKind, persist = false): PmNode | null {
  const { schema } = range.$from.doc.type;
  const content = Fragment.from(unitNodes(range));
  let node: PmNode;
  if (kind === "details") {
    // Names of the Details nodes (`details.ts`): the Tool may be off, then they are not in the Schema.
    const { details, detailsSummary, detailsContent } = schema.nodes;
    if (!details || !detailsSummary || !detailsContent || !detailsContent.validContent(content)) {
      return null;
    }
    node = details.create(persist ? { open: true } : null, [
      detailsSummary.create(),
      detailsContent.create(null, content),
    ]);
  } else {
    const type = schema.nodes[kind];
    if (!type || !type.validContent(content)) return null;
    node = type.create(null, content);
  }
  return range.parent.canReplaceWith(range.startIndex, range.endIndex, node.type) ? node : null;
}

/**
 * Wrap the units into the container. The caret goes into the title of a Details Block (it is
 * empty, and the author is expected to name it). In the other two the selection stays what it was:
 * a Block selection now holds the new container, a text selection becomes a caret at the start of
 * its first Block. `false` means the Schema does not allow it, and nothing changed.
 */
export function wrapUnits(
  tr: Transaction,
  range: NodeRange,
  kind: WrapKind,
  persist = false
): boolean {
  const node = planWrap(range, kind, persist);
  if (!node) return false;
  const blocks = tr.selection instanceof BlockSelection;
  const start = range.start;
  tr.replaceWith(start, range.end, node);
  if (kind === "details") {
    // The title: inside `details` and then inside `summary`.
    tr.setSelection(TextSelection.create(tr.doc, start + 2));
    if (!persist) openDetailsOnInsert(tr, start);
  } else if (blocks) {
    tr.setSelection(
      BlockSelection.tryCreate(tr.doc, start, start + node.nodeSize) ??
        Selection.near(tr.doc.resolve(start + 1))
    );
  } else {
    tr.setSelection(Selection.near(tr.doc.resolve(start + 1)));
  }
  tr.scrollIntoView();
  return true;
}
