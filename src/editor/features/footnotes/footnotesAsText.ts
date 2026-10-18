"use client";

import { Extension } from "@tiptap/core";
import { DOMParser as ProseMirrorParser, type Schema } from "@tiptap/pm/model";

/*
  FOOTNOTES WITHOUT THE `footnotes` TOOL ARE TEXT (ADR-0076, decision 15: the markup goes, the text
  stays).

  A Document with footnotes opened in an Editor that does not have the Tool is read by the ordinary
  rules: the reference's number stays as text (a superscript one with `superscript` on), and the
  footnotes' paragraphs follow it. The one thing that would be junk is the "↩" of the backlink: it is a
  link to a place that does not exist here, so it is dropped before the parse, and only the footnote's
  words stay.

  HOW. The same seam as `mathAsText.ts`, but the parser's methods are wrapped, not the parser replaced:
  both seams sit on the one cached `DOMParser`, and a replacement by one would lose the other. This
  extension is registered after `FormulasAsText`, so it wraps whatever parser is there by then.
*/

const BACKLINK = 'a[role="doc-backlink"]';
const patched = new WeakSet<object>();

/** Removes the footnote backlinks from a subtree. Changes `dom` in place: the parse gets a fresh DOM. */
function withoutBacklinks(dom: Node): Node {
  const root = dom as Partial<ParentNode>;
  for (const backlink of Array.from(root.querySelectorAll?.(BACKLINK) ?? [])) backlink.remove();
  return dom;
}

/** The Schema reads a footnote's HTML without the backlink. */
export function dropFootnoteBacklinks(schema: Schema): void {
  const parser = ProseMirrorParser.fromSchema(schema);
  if (patched.has(parser)) return;
  patched.add(parser);
  const parse = parser.parse.bind(parser);
  const parseSlice = parser.parseSlice.bind(parser);
  parser.parse = (dom, options) => parse(withoutBacklinks(dom), options);
  parser.parseSlice = (dom, options) => parseSlice(withoutBacklinks(dom), options);
}

/** An extension of a `tools` list without `footnotes`: no nodes, no markup, only the parse. */
export const FootnotesAsText = Extension.create({
  name: "footnotesAsText",

  onBeforeCreate() {
    dropFootnoteBacklinks(this.editor.schema);
  },
});
