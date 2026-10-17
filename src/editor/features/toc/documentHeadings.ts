import type { Editor } from "@tiptap/core";
import type { Node as PmNode } from "@tiptap/pm/model";
import { WRAPPER_NODE } from "../../core/nodeNames.js";
import type { TocLevel, TocToolOptions } from "../../core/toolOptions.js";

/*
  A module without Tiptap at runtime (types only). The table-of-contents core
  (`TocCore`, `RichTextToc.tsx`) reads it, and the core does not need the engine in its bundle.
*/

/** A Document heading with its position: the `jumpTo` command finds the DOM node by it. */
export interface TocDocumentHeading {
  level: TocLevel;
  text: string;
  /** Position of the heading node in the Document (for `editor.view.nodeDOM`). */
  pos: number;
}

/**
 * Table-of-contents headings taken from the engine's Document, not from the DOM. The
 * table-of-contents core (`TocCore`) is a lazy chunk: until it arrives (or while the
 * HTML mode is shown), there are no nodes to traverse, yet the screen asks for the data
 * from the first frame. This is the only traversal the indices are counted by. Both the
 * `toc` state snapshot and the `jumpTo` command take the heading from here, so an index
 * from the snapshot leads to the same heading right after an edit, without waiting for
 * the core to rebuild its list from the DOM (`REBUILD_DELAY`).
 *
 * THE SAME RULES AS `collectHeadings` (`headings.ts`), otherwise the indices diverge from
 * the list items: a heading at the top level or inside Wrappers (not inside Layout
 * columns, custom Blocks, quotes, or lists), a level from `levels`, and text that is
 * not empty after trimming the outer spaces. The text is the same as the DOM's
 * `textContent`: a soft hyphen is not part of it, but Atom text is.
 *
 * The traversal goes through the top level and Wrappers, not the whole Document: the cost
 * is the number of top-level Blocks. It does not grow with nesting and will not be noticeable
 * even on every transaction.
 */
export function tocDocumentHeadings(
  editor: Editor,
  { levels }: Pick<TocToolOptions, "levels">
): TocDocumentHeading[] {
  const headings: TocDocumentHeading[] = [];
  // `start` is the position where the content of `parent` begins.
  const visit = (parent: PmNode, start: number) =>
    parent.forEach((node, offset) => {
      const pos = start + offset;
      if (node.type.name === WRAPPER_NODE) return visit(node, pos + 1);
      if (node.type.name !== "heading") return;
      const level = node.attrs.level as TocLevel;
      const text = node
        .textBetween(0, node.content.size, "", (leaf) =>
          leaf.type.name === "hardBreak" ? "" : leaf.textContent
        )
        .trim();
      if (text && levels.includes(level)) headings.push({ level, text, pos });
    });
  visit(editor.state.doc, 0);
  return headings;
}
