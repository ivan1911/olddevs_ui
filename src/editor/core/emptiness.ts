"use client";

import { isNodeEmpty } from "@tiptap/core";
import type { Node as PmNode } from "@tiptap/pm/model";

/**
 * The kit's rule for an empty Document: an empty paragraph, heading, list or quote counts as
 * empty; text, an Atom and a table count as content.
 *
 * WHY NOT `editor.isEmpty`. Both it and Tiptap's `isNodeEmpty` count only text and leaf nodes as
 * content, so a table with empty cells looks empty to them. The author inserted a table and had
 * not typed anything yet, and the value came out as an empty string: the table disappeared on
 * save, and `required` did not count it. A table is a structure the author built on purpose, so
 * it must not be thrown away.
 *
 * A table is recognized by the Schema's `tableRole`, as in `blockCommands.ts`, not by the node's
 * name. This rule is what the value (`onChange`, `getHTML()`, the form field, Markdown),
 * `required` and the Handle's `isEmpty()` after mount rest on; before mount the same rule is
 * repeated by `isBlankHtml` on the string (`handle.ts`).
 */
export function isDocumentEmpty(doc: PmNode): boolean {
  // The cheap check goes first: it stops at the first text, and the walk looking for a table is
  // needed only when there is no text. It is called on every edit.
  if (!isNodeEmpty(doc)) return false;
  let table = false;
  doc.descendants((node) => {
    if (node.type.spec.tableRole === "table") table = true;
    return !table;
  });
  return !table;
}
