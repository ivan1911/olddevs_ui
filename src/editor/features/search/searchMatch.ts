"use client";

import type { Node as PmNode } from "@tiptap/pm/model";
import { isFormulaNodeName } from "../mathematics/mathNames.js";

/** Search options: the flags of the Find and replace panel. */
export interface SearchOptions {
  /** Match case: without it, "Cat" and "cat" are the same. */
  matchCase: boolean;
  /** Whole word: "cat" does not match inside "category". */
  wholeWord: boolean;
  /** The query is a JavaScript regular expression, not plain text. */
  regex: boolean;
}

/** A match is a range of the Document in ProseMirror positions. */
export interface SearchMatch {
  from: number;
  to: number;
  /**
   * The found text and the regular expression groups (`[0]` is the whole match) come
   * from the Block's line where the match was found. Replace expands `$1…$9` from them
   * instead of running the expression again on the found piece: lookbehind and lookahead
   * (`(?<=a)b`) would not work without the neighboring text.
   */
  captures: readonly string[];
  /**
   * A match inside a formula's LaTeX source: `from`–`to` cover the whole formula as a
   * node, not a text range. It is highlighted and selected as a node, but Replace and
   * Replace all skip it: a formula is edited only in its popover.
   */
  formula: boolean;
}

export interface SearchResult {
  matches: SearchMatch[];
  /** The regular expression did not parse: the JS engine's error text, no matches. */
  error?: string;
}

/**
 * A stand-in for an inline non-text node (an atom, a soft hyphen) in a Block's text line.
 * A match does not pass through it: the character is outside any alphabet, so neither
 * the text nor a reasonable regular expression contains it.
 */
const ATOM = "￼";

/** A letter, digit or underscore of any script: the word boundary covers Cyrillic too. */
const WORD = "[\\p{L}\\p{N}_]";

/**
 * The query's regular expression, or the error. Without `regex` the query is text:
 * special characters are escaped. "Whole word" uses lookbehind and lookahead on the
 * Unicode letter class, not `\b`: JS `\b` knows only Latin letters, so for it "cat" is
 * a whole word inside "cats".
 */
export function searchPattern(
  query: string,
  options: SearchOptions
): { pattern: RegExp } | { error: string } | null {
  if (query === "") return null;
  const source = options.regex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const wrapped = options.wholeWord ? `(?<!${WORD})(?:${source})(?!${WORD})` : source;
  const flags = options.matchCase ? "g" : "gi";
  try {
    return { pattern: new RegExp(wrapped, `${flags}u`) };
  } catch (cause) {
    /*
      The `u` flag is stricter: `a\-b` and `\_` are ordinary escapes without it and an
      error with it. An expression that works in plain JS must not throw, so without
      "Whole word" (which needs `u` for `\p{L}`) we try again without the flag.
    */
    if (!options.wholeWord) {
      try {
        return { pattern: new RegExp(wrapped, flags) };
      } catch {
        // Report the error from the strict parse: it is the clearer one.
      }
    }
    return { error: cause instanceof Error ? cause.message : String(cause) };
  }
}

/** The formula's LaTeX source: the string the formula is searched in (ADR-0070, item 8). */
const sourceOf = (node: PmNode): string => String(node.attrs.latex ?? "");

/**
 * A match of the query inside a formula: one per formula, however many times the query
 * repeats in it. The whole formula is highlighted and counted. `null` means the query
 * is not found in its source.
 */
function formulaMatch(node: PmNode, pos: number, pattern: RegExp): SearchMatch | null {
  pattern.lastIndex = 0;
  for (const found of sourceOf(node).matchAll(pattern)) {
    if (found[0].length === 0) continue;
    return { from: pos, to: pos + node.nodeSize, captures: [...found], formula: true };
  }
  return null;
}

/**
 * All matches of the query in the Document, in order.
 *
 * SCOPE IS THE TEXT INSIDE TEXT BLOCKS: paragraphs, headings, table cells and code
 * Blocks. Each text Block is its own line, so a match never crosses its boundary. Marks
 * inside a Block do not get in the way: the text of their nodes is joined, so "bo**ld**"
 * is found as "bold". Inline atoms (an image, a mention, a soft hyphen) stand in the line
 * as the `ATOM` placeholder, and a match does not pass through them.
 *
 * FORMULAS ARE THE ONLY ATOMS WITH TEXT: their LaTeX source is searched as a separate
 * line, like a separate Block, and a match inside one covers the whole formula
 * (`SearchMatch.formula`). A match with text next to a formula does not cross the
 * formula's boundary either, the same as with any other atom.
 *
 * Empty regular expression matches (`x*`) are skipped: there is nothing to highlight or
 * replace.
 */
export function findMatches(doc: PmNode, query: string, options: SearchOptions): SearchResult {
  const compiled = searchPattern(query, options);
  if (!compiled) return { matches: [] };
  if ("error" in compiled) return { matches: [], error: compiled.error };
  const { pattern } = compiled;

  const matches: SearchMatch[] = [];
  doc.descendants((node, pos) => {
    // A block formula is an atom without children: it is searched by its own source.
    if (isFormulaNodeName(node.type.name)) {
      const inFormula = formulaMatch(node, pos, pattern);
      if (inFormula) matches.push(inFormula);
      return false;
    }
    if (!node.isTextblock) return true;
    // The Block's text line, and the Document position of each of its characters (+1 is the end).
    let text = "";
    const positions: number[] = [];
    node.forEach((child, offset) => {
      const start = pos + 1 + offset;
      if (child.isText) {
        const value = child.text ?? "";
        for (let i = 0; i < value.length; i++) positions.push(start + i);
        text += value;
      } else {
        positions.push(start);
        text += ATOM;
        if (isFormulaNodeName(child.type.name)) {
          const inFormula = formulaMatch(child, start, pattern);
          if (inFormula) matches.push(inFormula);
        }
      }
    });
    positions.push(pos + 1 + node.content.size);

    pattern.lastIndex = 0;
    for (const found of text.matchAll(pattern)) {
      const length = found[0].length;
      if (length === 0) continue;
      const index = found.index;
      matches.push({
        from: positions[index]!,
        to: positions[index + length]!,
        captures: [...found],
        formula: false,
      });
    }
    return false;
  });
  // Formulas inside a line were pushed to the end of their Block, so the Document order
  // is by position.
  matches.sort((a, b) => a.from - b.from);
  return { matches };
}
