"use client";

import { createDocument, getHTMLFromFragment, type Editor, type JSONContent } from "@tiptap/core";
import { Fragment, type Node as PmNode } from "@tiptap/pm/model";
import { devError } from "../../lib/dev-warn.js";
import { replaceDocument } from "./maxLength.js";
import { conformToSchema, headingLevels } from "./schemaConform.js";

/*
  JSON envelope of a Document (ADR-0061): an exchange format next to HTML, not instead of it.
  The Editor's value stays HTML (ADR-0050, item 3); the envelope is for files, templates and
  lossless transfer, which Markdown cannot express.

  Inside is the Document's tree in the engine's shape. From now on, the names of its nodes and
  attributes are part of the format's contract: renaming one in the Schema bumps `version`, and
  the kit migrates old files, not the screen.
*/

/** Format name in the envelope: tells an Editor file apart from any other JSON. */
const FORMAT = "olddevs-rich-text";
/** Tree version. There are no others yet, and no migrations either. */
const VERSION = 1;

/**
 * The Editor's Document as JSON: `getJSON()` returns it, `setJSON()` and `defaultValue` accept
 * it. `doc` is the Document's tree, with the top node `"doc"`.
 */
export interface RichTextDocument {
  format: typeof FORMAT;
  version: typeof VERSION;
  doc: JSONContent;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Envelope shape, without the Schema: the format, the version and the top node `doc`. */
export function isRichTextDocument(value: unknown): value is RichTextDocument {
  return (
    isObject(value) &&
    value.format === FORMAT &&
    value.version === VERSION &&
    isObject(value.doc) &&
    value.doc.type === "doc" &&
    (value.doc.content === undefined || Array.isArray(value.doc.content))
  );
}

/** The engine's Document as an envelope. */
export function documentToJSON(editor: Editor): RichTextDocument {
  return { format: FORMAT, version: VERSION, doc: editor.getJSON() };
}

/**
 * A Document from an envelope, through the Schema and not around it. `null` means the envelope
 * was rejected: the shape is wrong, or no nodes can be built from the tree.
 *
 * TWO PASSES. First the tree is conformed to the Schema (`schemaConform.ts`): without that,
 * `nodeFromJSON` would throw on a Block of a disabled Tool. But `nodeFromJSON` knows nothing
 * about the HTML parse rules, and the whole attribute policy rests on them: link and image
 * addresses, the author's color, `data-*`, the rules of custom Tools. So the assembled Document
 * is serialized to HTML and parsed by the Schema again, with the same `createDocument` as the
 * incoming `value`. One policy for every input, and no second copy of the attribute checks. As a
 * side effect, the parse fills in the nesting that `nodeFromJSON` does not check. Whitespace is
 * not collapsed: a `getJSON()` → `setJSON()` round trip does not change the text.
 */
export function documentFromJSON(editor: Editor, value: unknown): PmNode | null {
  if (!isRichTextDocument(value)) return null;
  const { schema } = editor;
  try {
    const options = { levels: headingLevels(editor) };
    const blocks = (value.doc.content ?? []).flatMap((node) =>
      conformToSchema(node, schema, options)
    );
    const fragment = Fragment.fromArray(blocks.map((block) => schema.nodeFromJSON(block)));
    // Whitespace is kept as in the tree: the engine writes this HTML itself, without line breaks
    // or indentation, so there is nothing to collapse except the author's double spaces.
    return createDocument(getHTMLFromFragment(fragment, schema), schema, {
      preserveWhitespace: "full",
    });
  } catch (error) {
    // A malformed file is an ordinary refusal, but a custom Tool's Extensions can throw too.
    // The cause goes to the development console, or it would be hard to find.
    devError("RichTextEditor: a JSON document could not be built from its tree", error);
    return null;
  }
}

/**
 * A whole Document from an envelope, as a Programmatic replacement (`EXTERNAL_CHANGE`), the same
 * as `replaceWithMarkdown`: the character limit does not truncate it. `false` means the envelope
 * was rejected and the Document is untouched.
 */
export function replaceWithJSON(editor: Editor, value: unknown): boolean {
  const next = documentFromJSON(editor, value);
  if (next) replaceDocument(editor, next.content);
  return next !== null;
}
