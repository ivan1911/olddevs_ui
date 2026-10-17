"use client";

import type { MarkdownTokenizer } from "@tiptap/core";
import { BLOCK_FORMULA_NODE, INLINE_FORMULA_NODE } from "./mathNames.js";

/**
 * Formulas in Markdown: `$…$` inside a line and a `$$…$$` Block (ADR-0070).
 *
 * WHY THE MODULE HAS ITS OWN TOKENIZERS AND NOT THE ONES FROM THE TIPTAP EXTENSION. The
 * extension's inline tokenizer (`/^\$([^$]+)\$(?!\$)/`) took any pair of dollar signs for
 * a formula: "costs $5 or $6" turned into the formula "5 or ", and money in text is
 * common. Here the rules are Pandoc's: no space after the opening `$`, no space before the
 * closing `$`, and no digit after the closing `$`. "$5 or $6" stays text, while `$x^2$`
 * and `$\alpha + \beta$` are formulas. An escaped character (`\$`, `\\`) inside a formula
 * is a pair, not an end: `$\text{\$5}$` is read whole. The extension's block tokenizer
 * also stepped over `\$` and did not require the end of the line: `$$a$$ and text` cut
 * the paragraph in two. Here a block formula takes its lines whole.
 *
 * The export is like the extension's: `$latex$`, and `$$` / latex / `$$` on their own
 * lines. The LaTeX is kept without spaces at the ends (the popover trims it), so the round
 * trip is lossless. The regular expressions have no lookbehind: old WebKit cannot parse
 * it (the extension's own code says the same).
 */

/** A formula character: not a space and not a `$` sign, or an escaped pair. */
const SOLID = String.raw`(?:[^\s$\\]|\\[\s\S])`;
/** Any formula character in the middle, without a line break. */
const ANY = String.raw`(?:[^$\\\n]|\\[\s\S])`;

const INLINE = new RegExp(String.raw`^\$(${SOLID}(?:${ANY}*?${SOLID})?)\$(?!\d)`);
const BLOCK = /^\$\$((?:[^$\\]|\\[\s\S])+?)\$\$[ \t]*(?:\n|$)/;

/** An inline formula: `$…$`. */
export const inlineMathTokenizer: MarkdownTokenizer = {
  name: INLINE_FORMULA_NODE,
  level: "inline",
  start: (src) => src.indexOf("$"),
  tokenize(src) {
    const match = INLINE.exec(src);
    if (!match) return undefined;
    return { type: INLINE_FORMULA_NODE, raw: match[0], latex: match[1] };
  },
};

/** A block formula: `$$…$$` on its own lines. */
export const blockMathTokenizer: MarkdownTokenizer = {
  name: BLOCK_FORMULA_NODE,
  level: "block",
  start: (src) => src.search(/^\$\$/m),
  tokenize(src) {
    const match = BLOCK.exec(src);
    const latex = match?.[1]?.trim();
    if (!match || !latex) return undefined;
    return { type: BLOCK_FORMULA_NODE, raw: match[0], latex };
  },
};

/** The Markdown of an inline formula. */
export const renderInlineMath = (latex: string): string => `$${latex}$`;

/** The Markdown of a block formula. */
export const renderBlockMath = (latex: string): string => `$$\n${latex}\n$$`;
