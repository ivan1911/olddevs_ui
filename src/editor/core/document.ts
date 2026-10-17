"use client";

import { Node } from "@tiptap/core";

/**
 * The Document with the containers of top-level Blocks: the Column layout (`layout.ts`) and the
 * Wrapper (`wrapper.ts`).
 *
 * Neither is in the `block` group, so they can be nested only where they are named by name
 * (ADR-0056, ADR-0057). The Document names those whose Tools are enabled:
 * `(block | layout | wrapper)+`. With neither enabled, the Document is the ordinary StarterKit
 * one, and a content expression that names a node missing from the Schema would not build in
 * ProseMirror at all.
 *
 * The name is not `createDocument`: `@tiptap/core` uses that name for parsing HTML into a
 * Document, which the source mode (`RichTextEditor.tsx`) relies on. Here it is the factory of a
 * Schema node, and one name for two meanings would confuse the imports.
 */
export function createDocumentNode(containers: readonly string[]) {
  return Node.create({
    name: "doc",
    topNode: true,
    content: `(${["block", ...containers].join(" | ")})+`,
    renderMarkdown: (node, helpers) =>
      node.content ? helpers.renderChildren(node.content, "\n\n") : "",
  });
}
