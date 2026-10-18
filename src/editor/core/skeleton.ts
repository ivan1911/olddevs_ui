"use client";

import { createDocument, getSchema } from "@tiptap/core";
import { DOMSerializer } from "@tiptap/pm/model";
import { withCodeHeaders } from "../features/code/codeHeader.js";
import { readFormulasAsText } from "../features/mathematics/mathAsText.js";
import { createEditorExtensions, type EditorExtensionOptions } from "./extensions.js";
import { toolList, type ToolDescriptor, type ToolList } from "./toolDescriptor.js";
import type { ToolLoader } from "./toolLoader.js";

/*
  Skeleton Document (ADR-0058, item 11.4): `value` cleaned by the kit's Schema. It is the same
  parse the engine does, only without the engine.

  The Skeleton stands in for the Document until Readiness. Before the Editor epic it was safe even
  with the uncleaned `value`, since the string went only through the Schema parse. Inserting it
  as-is would run `<img onerror>` from a foreign value. So the string is parsed in an inert
  document (the browser's `DOMParser`: no scripts or handlers run there, and no images load)
  against the tool set's Schema, and serialized back to HTML, into a document that is also inert.
  Whatever the Schema does not know (tags, attributes, handlers, `javascript:`) does not reach the
  page.

  The Schema is the one the engine will get, but without Extensions whose loaders have not run yet:
  their Blocks show as text, and the Schema strips the wrapper. A lazy built-in Tool (`codeBlock`,
  `table`) gives its Blocks' shape (the descriptor's `skeleton` field) in place of Extensions. Its
  Blocks show with their own markup, and the field does not jump when the chunk arrives. The code
  block header is the same as in `RichTextView` (`withCodeHeaders`): it exists in the Editor, and
  without it the Skeleton would be shorter. The extension set is assembled for the sake of one
  Schema alone: there are no engine, plugins, or node views here, and the `RichTextEditor` bridges
  are not needed, so they get stubs.
*/

const quiet = () => {};
const no = () => false;

/**
 * Bridges of the engine's extension set. The Schema does not read them, but an image has no
 * place in the Schema without them.
 */
const SCHEMA_ONLY: Omit<EditorExtensionOptions, "tools"> = {
  placeholder: () => "",
  limit: () => undefined,
  taskCheckbox: (text) => text,
  detailsToggle: (text) => text,
  quoteSet: () => "en",
  locale: () => "en",
  openPopover: quiet,
  focusToolbar: no,
  openBlockMenu: no,
  onNotice: quiet,
  image: {
    onOpenEditor: quiet,
    captionPlaceholder: () => "",
    uploadingLabel: (name) => name,
    upload: () => undefined,
    describeNotice: () => ({ tone: "status", text: "" }),
  },
};

/**
 * A tool set with the descriptors that `pick` keeps (`undefined` drops the descriptor). The names
 * are the same; the descriptors decide the Schema.
 */
function narrowed(
  tools: ToolList,
  pick: (descriptor: ToolDescriptor) => ToolDescriptor | undefined
): ToolList {
  return toolList(
    tools,
    tools.descriptors.flatMap((d) => pick(d) ?? [])
  );
}

/** The Document's HTML cleaned by the tool set's Schema; `null` if the Schema could not be built. */
function cleaned(html: string, tools: ToolList): string | null {
  try {
    const schema = getSchema(createEditorExtensions({ tools, ...SCHEMA_ONLY }));
    // Without `mathematics`, a formula in the Skeleton is text, as in the engine. The extension
    // would not do this, and the Skeleton has no engine (`mathAsText.ts`).
    if (!tools.has("mathematics")) readFormulasAsText(schema);
    const inert = document.implementation.createHTMLDocument("");
    const box = inert.createElement("div");
    box.append(
      DOMSerializer.fromSchema(schema).serializeFragment(createDocument(html, schema).content, {
        document: inert,
      })
    );
    // An empty "Copy" placeholder: the Skeleton has no island, and the placeholder holds the space.
    return withCodeHeaders(box.innerHTML, "");
  } catch {
    return null;
  }
}

/**
 * The Skeleton Document: `html`, cleaned by the tool set's Schema without the Extensions of loaders
 * that have not run yet (`pending`). Browser only.
 *
 * A tool set whose custom Tools break the Schema does not produce one (a field error, ADR-0058,
 * item 1.5). Then the Skeleton is cleaned with the built-in Schema, so the Document stays visible.
 */
export function skeletonHtml(
  html: string,
  tools: ToolList,
  pending: readonly ToolLoader[]
): string {
  // A descriptor whose loader has not run yet gives way to the Block shape, or is dropped.
  const settled = (d: ToolDescriptor): ToolDescriptor | undefined =>
    !d.load || !pending.includes(d.load) ? d : d.skeleton && { name: d.name, engine: d.skeleton };
  return (
    cleaned(html, narrowed(tools, settled)) ??
    cleaned(
      html,
      narrowed(tools, (d) => (d.custom ? undefined : settled(d)))
    ) ??
    ""
  );
}
