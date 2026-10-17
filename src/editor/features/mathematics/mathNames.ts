/**
 * Formula names: THE LIGHTWEIGHT PART OF THE DATA (ADR-0070). Everything that the
 * server-side cleanup (`schema.ts`), `RichTextView` and the Tool's descriptor in the start
 * bundle need to know about how a formula is named. Previously the same strings sat in six
 * files, and `INLINE_MATH` meant two different things in two of them (a `data-type` value
 * and a node name).
 *
 * There are two kinds of names, and they must not be confused:
 *
 * - **the `data-type` value** in the Document's HTML (`*_FORMULA_TYPE`): this is how the
 *   Mathematics extension from Tiptap writes a formula, and how the sanitizer, the View and
 *   the Island read it;
 * - **the Tiptap node name** (`*_FORMULA_NODE`): this is what the engine's Schema, the
 *   commands (`insertInlineMath`, …), the Document's JSON envelope and the Markdown
 *   tokenizers call it.
 *
 * The module is safe for the server: only strings, no React, Tiptap or KaTeX.
 */

/** The `data-type` value of an inline formula: `span[data-type="inline-math"]`. */
export const INLINE_FORMULA_TYPE = "inline-math";
/** The `data-type` value of a block formula: `div[data-type="block-math"]`. */
export const BLOCK_FORMULA_TYPE = "block-math";

/** The node name of an inline formula in the engine's Schema. */
export const INLINE_FORMULA_NODE = "inlineMath";
/** The node name of a block formula in the engine's Schema. */
export const BLOCK_FORMULA_NODE = "blockMath";

/** The attribute with the LaTeX source: the formula's only content in the HTML. */
export const FORMULA_SOURCE_ATTRIBUTE = "data-latex";

/** The selector of an inline formula in the HTML: the tag and the `data-type` from the pair. */
export const INLINE_FORMULA_SELECTOR = `span[data-type=${INLINE_FORMULA_TYPE}]`;
/** The selector of a block formula in the HTML. */
export const BLOCK_FORMULA_SELECTOR = `div[data-type=${BLOCK_FORMULA_TYPE}]`;
/** The selector of any formula in the HTML. */
export const FORMULA_SELECTOR = `${INLINE_FORMULA_SELECTOR}, ${BLOCK_FORMULA_SELECTOR}`;

/** A node with this name is a formula, inline or block. */
export function isFormulaNodeName(name: string): boolean {
  return name === INLINE_FORMULA_NODE || name === BLOCK_FORMULA_NODE;
}
