/*
  FORMULAS IN THE DOCUMENT'S HTML (ADR-0070). The Editor writes a formula as an empty
  element: `<span data-type="inline-math" data-latex="…"></span>` and
  `<div data-type="block-math" data-latex="…"></div>`. There is no rendered KaTeX markup
  in the Document: the node view in the Editor draws it, and so does the `RichTextView`
  Island.

  The module is server-side, like `codeHeader.ts`: strings in, strings out, with no DOM
  and no KaTeX. `RichTextView`, a server component, reads it.
*/
import { BLOCK_FORMULA_TYPE, INLINE_FORMULA_TYPE } from "./mathNames.js";

/**
 * The LaTeX source, made safe for the `data-latex` attribute: a space goes inside the pairs
 * that DOMPurify 3 treats as the end of markup.
 *
 * WHY. DOMPurify's `SAFE_FOR_XML` strips the whole attribute if its value contains `]>`,
 * `-->`, `--!>` or `</style|script|title|…`, and it does so before the kit's hooks run.
 * LaTeX legitimately contains such sequences: `\left[0,1\right]>x`, arrows `-->`. Without
 * the fix the formula would vanish on the consumer's server together with its wrapper. A
 * space breaks the pair: `]>` → `] >`, `-->` → `-- >`, `--!>` → `--! >`, `</` → `< /`. In
 * math mode KaTeX draws no spaces, so the formula looks the same; inside `\text{…}` the
 * space is visible — a limit, and it is recorded in the Reference.
 *
 * ONE FUNCTION FOR TWO PLACES. The Editor already writes `data-latex` in this form (the
 * saved HTML is safe and does not change on a second pass), and the sanitizer applies the
 * function to someone else's HTML before DOMPurify checks it. A repeated call does not
 * change the source.
 */
export function safeLatexSource(latex: string): string {
  return latex.replace(/(--!?|\])>/g, "$1 >").replace(/<\//g, "< /");
}

/**
 * Whether the Document contains a formula: `RichTextView` decides by it whether to mount
 * the Island.
 */
export function hasMath(html: string): boolean {
  return (
    html.includes(`data-type="${INLINE_FORMULA_TYPE}"`) ||
    html.includes(`data-type="${BLOCK_FORMULA_TYPE}"`)
  );
}

/**
 * An opening `span` or `div` tag with attributes in double quotes, as the DOM serializer
 * writes them. An attribute value can contain `>` (LaTeX `a>b`), so the tag is parsed by
 * its attributes, not up to the first `>`.
 */
const FORMULA_ELEMENT = /<(span|div)((?:\s+[\w:-]+(?:="[^"]*")?)*)\s*><\/\1>/g;

/** The LaTeX source from a formula's attributes, or `null` if the element is not a formula. */
function formulaSource(tag: string, attributes: string): string | null {
  const type = /\sdata-type="([^"]*)"/.exec(attributes)?.[1];
  if (type !== (tag === "span" ? INLINE_FORMULA_TYPE : BLOCK_FORMULA_TYPE)) return null;
  return /\sdata-latex="([^"]*)"/.exec(attributes)?.[1] ?? null;
}

/**
 * The LaTeX source inside empty formula elements, string for string, on the server.
 *
 * WHY. Without JS, and before the Island has rendered the formula, the reader sees its
 * source (ADR-0070, item 6), and the text is selected and searched like ordinary text.
 * Without this, an empty element would be an empty gap. The Island later replaces the
 * content with the rendered formula.
 *
 * The attribute value is already escaped by the serializer (`&amp;`, `&quot;`); for the
 * text the helper additionally escapes only `<` and `>`, since they can appear bare in the
 * value. The helper does not open up other markup sources: only what already stood in the
 * attribute of the same element gets into the string. An element with content is left alone.
 */
export function withMathSource(html: string): string {
  if (!hasMath(html)) return html;
  return html.replace(FORMULA_ELEMENT, (element, tag: string, attributes: string) => {
    const latex = formulaSource(tag, attributes);
    if (latex === null) return element;
    const text = latex.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return `<${tag}${attributes}>${text}</${tag}>`;
  });
}
