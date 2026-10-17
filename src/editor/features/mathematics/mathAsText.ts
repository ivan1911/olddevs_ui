"use client";

import { Extension } from "@tiptap/core";
import type { JSONContent } from "@tiptap/core";
import { DOMParser as ProseMirrorParser, type ParseOptions, type Schema } from "@tiptap/pm/model";
import { BLOCK_FORMULA_NODE, FORMULA_SELECTOR, INLINE_FORMULA_NODE } from "./mathNames.js";

/*
  A FORMULA WITHOUT THE `mathematics` TOOL IS TEXT (ADR-0070, "behavior without a Tool").

  The formula sits in the HTML as an empty element, and its source is in `data-latex`.
  A Schema without the Tool has no node for it, and the ordinary parse would drop the
  empty `span` together with the formula: an Editor without `mathematics` that opened
  someone else's Document would silently erase the formula on save. So such an Editor
  reads the formula as text: `$…$` inside a line and `$$…$$` as a paragraph (a Block).
  The LaTeX is not lost, the author sees it, and with the Tool on it is turned back
  into a formula.

  HOW. Parsing HTML into a Document goes through a single ProseMirror `DOMParser`,
  cached on the Schema, and every path uses it: `value`, paste, Source mode, the
  Skeleton. It is replaced as a whole, not at each entry point: formulas in the DOM
  become text before the parse, and everything after it works as usual. The cache is
  `schema.cached.domParser`, the standard place of `DOMParser.fromSchema`; the test
  `rich-text-editor-mathematics.test.tsx` keeps the behavior in place if ProseMirror
  changes.
*/

/**
 * A formula in the JSON tree (`inlineMath`, `blockMath`) as text: the same path for the
 * Document's JSON envelope (`jsonDocument.ts`) as `formulasToText` for HTML. `null` means
 * the node is not a formula, or that it has no source. It is called by `conformToSchema`
 * when the node is not in the Schema.
 */
export function formulaJsonAsText(node: JSONContent): JSONContent[] | null {
  const latex = node.attrs?.latex;
  if (
    typeof latex !== "string" ||
    (node.type !== INLINE_FORMULA_NODE && node.type !== BLOCK_FORMULA_NODE)
  ) {
    return null;
  }
  if (!latex.trim()) return [];
  if (node.type === INLINE_FORMULA_NODE) return [{ type: "text", text: `$${latex}$` }];
  return [{ type: "paragraph", content: [{ type: "text", text: `$$${latex}$$` }] }];
}

/**
 * Turns the formulas of a subtree into text. Changes `dom` in place: the parse gets a fresh
 * DOM.
 */
function formulasToText(dom: Node): Node {
  const root = dom as Partial<ParentNode>;
  for (const element of [...(root.querySelectorAll?.(FORMULA_SELECTOR) ?? [])]) {
    const latex = element.getAttribute("data-latex") ?? "";
    const owner = element.ownerDocument;
    if (!latex.trim()) {
      element.remove();
    } else if (element.localName === "span") {
      element.replaceWith(owner.createTextNode(`$${latex}$`));
    } else {
      const paragraph = owner.createElement("p");
      paragraph.textContent = `$$${latex}$$`;
      element.replaceWith(paragraph);
    }
  }
  return dom;
}

class FormulaTextParser extends ProseMirrorParser {
  override parse(dom: Node, options?: ParseOptions) {
    return super.parse(formulasToText(dom), options);
  }
  override parseSlice(dom: Node, options?: ParseOptions) {
    return super.parseSlice(formulasToText(dom), options);
  }
}

/**
 * The Schema reads formulas as text: it is set on the Schema of a `tools` list without
 * `mathematics`.
 */
export function readFormulasAsText(schema: Schema): void {
  if (schema.cached.domParser instanceof FormulaTextParser) return;
  schema.cached.domParser = new FormulaTextParser(
    schema,
    ProseMirrorParser.fromSchema(schema).rules
  );
}

/**
 * An extension of a `tools` list without `mathematics`: the Schema reads formulas as text.
 * It adds no markup and no nodes, so the list's Schema does not change because of it.
 * `onBeforeCreate` runs before the first parse of `value` (Tiptap parses it at the end of
 * building the engine).
 */
export const FormulasAsText = Extension.create({
  name: "formulasAsText",

  onBeforeCreate() {
    readFormulasAsText(this.editor.schema);
  },
});
