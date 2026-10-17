"use client";

import {
  Extension,
  getExtensionField,
  getTextBetween,
  getTextSerializersFromSchema,
  type Editor,
  type JSONContent,
  type TextSerializer,
} from "@tiptap/core";
import type { Node as ProseMirrorNode, Schema } from "@tiptap/pm/model";
import { MARKDOWN_FALLBACK, warnNoMarkdown } from "./customMarkdown.js";

/*
  The atom text (ADR-0058, section 4). One rule for built-in and custom atoms, and everything
  that outputs the Document's text reads it from here:

  - The atom text is given by `renderText` in the Extensions. A leaf atom without it gives an
    empty string; an atom with content (an image with a caption) gives the text of its children;
  - an atom's weight in `maxLength` is the length of this text (`countCharacters`);
  - `getText`, `getSelectedText`, copying as text and copying as Markdown all return the same text.

  There is no separate weight field: it would drift from the text, and the counter from `getText`.
*/

/**
 * The Schema's text serializers — the `renderText` of its nodes. The Schema does not change, so the
 * set is looked up on every edit rather than rebuilt.
 */
const SERIALIZERS = new WeakMap<Schema, Record<string, TextSerializer>>();

export function textSerializers(schema: Schema): Record<string, TextSerializer> {
  let found = SERIALIZERS.get(schema);
  if (!found) SERIALIZERS.set(schema, (found = getTextSerializersFromSchema(schema)));
  return found;
}

/** The node's own `renderText`; `undefined` — its type has no serializer. */
function ownText(node: ProseMirrorNode): string | undefined {
  return textSerializers(node.type.schema)[node.type.name]?.({
    node,
    pos: 0,
    parent: node,
    index: 0,
    range: { from: 0, to: node.nodeSize },
  });
}

/**
 * The Schema's `leafText` from `renderText`: this is how the atom text and ProseMirror read it
 * (`textContent`, `textBetween`, the text on copy), and Tiptap, for which `renderText` itself
 * becomes only `toText`.
 *
 * `leafText` has no position or parent — neither does ProseMirror's call — so the serializer
 * gets only the node: an atom's `renderText` reads its attributes, per the documentation.
 * The field sits on every node of the Schema, and `toText` reads it lazily: while the Schema is
 * being built, a node's `renderText` function is not yet visible.
 */
export const AtomText = Extension.create({
  name: "atomText",

  extendNodeSchema() {
    return { leafText: (node: ProseMirrorNode): string => ownText(node) ?? "" };
  },
});

/**
 * The Document's text between positions: Blocks are separated by `blockSeparator`, and an atom
 * gives its own atom text.
 */
export function textBetween(
  doc: ProseMirrorNode,
  from: number,
  to: number,
  blockSeparator: string
): string {
  return getTextBetween(
    doc,
    { from, to },
    { blockSeparator, textSerializers: textSerializers(doc.type.schema) }
  );
}

/**
 * Atom text: its `renderText`, and without one the text of its children (a leaf gives an empty
 * string).
 */
export function atomText(node: ProseMirrorNode): string {
  return ownText(node) ?? textBetween(node, 0, node.content.size, "");
}

/*
  Markdown. A Node without `renderMarkdown` is exported by Tiptap's Markdown manager as an empty
  string, and its own atom would vanish from `getMarkdown` even though `getText` sees it. So
  before export such an atom is replaced by its atom text (in a paragraph, if it is a Block);
  only an atom with no text is lost.
*/

/**
 * Nodes for Markdown export: `true` — the Extensions handle it themselves; a string — an atom
 * of a custom Tool without rules (the Tool's name, for the warning).
 */
function markdownHandled(editor: Editor): Map<string, true | string> {
  const names = new Map<string, true | string>();
  for (const extension of editor.extensionManager.extensions) {
    if (extension.type !== "node") continue;
    if (getExtensionField(extension, "renderMarkdown")) names.set(extension.name, true);
    const tool = getExtensionField<string>(extension, MARKDOWN_FALLBACK as never);
    if (typeof tool === "string") names.set(extension.name, tool);
  }
  return names;
}

function markdownJson(
  node: ProseMirrorNode,
  handled: ReadonlyMap<string, true | string>
): JSONContent[] {
  if (node.isText) return [node.toJSON()];
  const rule = handled.get(node.type.name);
  if (node.isAtom && rule !== true) {
    if (typeof rule === "string") warnNoMarkdown(rule);
    const text = atomText(node);
    if (!text) return [];
    const run: JSONContent = {
      type: "text",
      text,
      ...(node.marks.length > 0 && { marks: node.marks.map((mark) => mark.toJSON()) }),
    };
    return [node.isBlock ? { type: "paragraph", content: [run] } : run];
  }
  const content: JSONContent[] = [];
  node.forEach((child) => void content.push(...markdownJson(child, handled)));
  return [
    {
      type: node.type.name,
      ...(Object.keys(node.attrs).length > 0 && { attrs: node.attrs }),
      ...(node.marks.length > 0 && { marks: node.marks.map((mark) => mark.toJSON()) }),
      ...(content.length > 0 && { content }),
    },
  ];
}

/**
 * The Document's Markdown: Tiptap's `getMarkdown`, where an atom without its own export goes out
 * as its atom text.
 */
export function markdownOf(editor: Editor): string {
  const [doc] = markdownJson(editor.state.doc, markdownHandled(editor));
  return editor.markdown?.serialize(doc as JSONContent) ?? "";
}
