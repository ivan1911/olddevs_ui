"use client";

import { Extension, InputRule } from "@tiptap/core";
import type { EditorQuoteSet } from "../../../i18n/messages.js";
import { LANGUAGE_MARK } from "../language/languageState.js";
import { quoteSetOfLanguage } from "../language/languageTag.js";

/*
  The double quote `"` is the only Typography rule that the kit writes itself. The
  Tiptap extension sets quotes as a fixed pair, but the kit picks them by the message
  catalog's language, and the catalog can change while the Editor is mounted: the set
  is read at the moment of typing, not when the rules are built. Inside nested Russian
  quotes («He said: „hi“»), the pair also depends on what is open in the Block before the caret.

  A language Mark under the caret (the `language` Tool, ADR-0078) overrides the set: `en…` gives
  “English”, `ru…` gives «guillemets», and any other language leaves the set as it was.
*/

/** Quote pairs of the sets: the opening and the closing first-level quote. */
const PAIRS: Record<EditorQuoteSet, readonly [string, string]> = {
  en: ["“", "”"],
  ru: ["«", "»"],
};

/*
  What makes the character before a quote an opening quote. The list is Tiptap's (the
  start of a Block, a space, a bracket, another opening quote). The Russian set adds the
  guillemet « and the low-9 quote „, and drops the high “: it closes rather than opens.
*/
const OPENING_BEFORE: Record<EditorQuoteSet, RegExp> = {
  en: /[\s{[(<'"‘“]/,
  ru: /[\s{[(<'"‘«„]/,
};

/**
 * Russian quotes that are open and not yet closed in the text before the caret, from
 * the outermost to the innermost. A closing quote counts only if it closes its own pair:
 * a stray closing quote without an opening one does not throw off the count.
 */
export function openRussianQuotes(before: string): string[] {
  const open: string[] = [];
  for (const char of before) {
    if (char === "«" || char === "„") open.push(char);
    else if (char === "»" && open.at(-1) === "«") open.pop();
    else if (char === "“" && open.at(-1) === "„") open.pop();
  }
  return open;
}

/** Explicit values of the `openDoubleQuote` and `closeDoubleQuote` Options: `undefined` means not set. */
export interface DoubleQuoteOverrides {
  open?: false | string;
  close?: false | string;
}

/**
 * The quote that `"` turns into. `before` is the text of the Block before the caret.
 *
 * Opening or closing is decided by the character before the quote, as in Tiptap. In the
 * Russian set, without explicit strings, the pair depends on what is open: outside any
 * quotes it is «»; inside «…» an opening quote gives „ (a nested quote), and a closing one
 * closes «»; inside „…“ a closing quote gives “. Russian typography has no third nesting
 * level: an opening quote inside „…“ again gives «. An explicit Option string turns nesting
 * off, so the quotes go in pairs. `false` means no quote.
 */
export function doubleQuoteFor(
  set: EditorQuoteSet,
  before: string,
  overrides: DoubleQuoteOverrides = {}
): false | string {
  const opening = before === "" || OPENING_BEFORE[set].test(before.at(-1) ?? "");
  const explicit = overrides.open !== undefined || overrides.close !== undefined;
  if (set === "ru" && !explicit) {
    const inner = openRussianQuotes(before).at(-1);
    if (opening) return inner === "«" ? "„" : "«";
    return inner === "„" ? "“" : "»";
  }
  const [open, close] = PAIRS[set];
  return opening ? (overrides.open ?? open) : (overrides.close ?? close);
}

interface QuotesOptions extends DoubleQuoteOverrides {
  /** The quote set at the moment of typing: the `quotes` Option or the Editor's message catalog. */
  set: () => EditorQuoteSet;
}

/**
 * The input rule for the double quote. Inside `code` and a code block it does not fire
 * by itself: the Tiptap core skips input rules there (`inputRulesPlugin`), as it does for
 * the other Typography rules. Undo is `Backspace` right after the replacement (`undoInputRule`).
 */
export const TypographyQuotes = Extension.create<QuotesOptions>({
  name: "typographyQuotes",
  addOptions: () => ({ set: () => "en" }),
  addInputRules() {
    const { set, open, close } = this.options;
    // Both quotes are disabled: there is no rule, and `"` stays straight.
    if (open === false && close === false) return [];
    return [
      new InputRule({
        find: /"$/,
        handler: ({ state, range }) => {
          // The state's document already contains the typed quote: the text before it ends at `range.from`.
          const $from = state.doc.resolve(range.from);
          const before = $from.parent.textBetween(0, $from.parentOffset, undefined, "￼");
          // Inside a language mark (the `language` Tool) the quotes are that language's: English
          // inside Russian text is “English”, and Russian inside English text is «Russian». Another
          // language, and no mark, use the Tool's set: the `quotes` Option or the catalog's.
          const marks = state.storedMarks ?? $from.marks();
          const lang = marks.find((mark) => mark.type.name === LANGUAGE_MARK)?.attrs.lang;
          const own = typeof lang === "string" ? quoteSetOfLanguage(lang) : null;
          const quote = doubleQuoteFor(own ?? set(), before, { open, close });
          if (quote === false) return null;
          state.tr.insertText(quote, range.from, range.to);
        },
      }),
    ];
  },
});
