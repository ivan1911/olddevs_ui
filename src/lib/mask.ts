/**
 * Input mask: formatting, parsing and caret position.
 *
 * The functions are pure and deliberately live apart from the component. The caret is what makes
 * a mask complicated in the first place, and it is easier to check on strings than through the DOM.
 *
 * MASK TOKENS: `9` is a digit, `a` is a letter, `*` is a digit or a letter. Any other character is
 * a literal: it is inserted by itself and does not take input.
 *
 * There is no escaping: there is no way to express a literal `9` in a mask. This is a limitation,
 * not an oversight. None of our formats needed a required digit literal, and a `\` in the mask would
 * turn the mask itself into a syntax that has to be documented separately. If such a format appears,
 * escaping will appear with it.
 */

/** Mask tokens. A union rather than `string`: the rejection message is built from it. */
export type MaskToken = "9" | "a" | "*";

const TOKENS: Record<MaskToken, RegExp> = {
  9: /\d/,
  a: /\p{L}/u,
  "*": /[\p{L}\d]/u,
};

const isToken = (ch: string): ch is MaskToken => Object.hasOwn(TOKENS, ch);
const matches = (ch: string, token: MaskToken) => TOKENS[token].test(ch);

/**
 * Lays a raw value out over the mask.
 *
 * Literals are inserted only while there is something to put after them. Otherwise an empty field
 * would show "+7 (" before the first character, and a field with one digit would show a tail of
 * brackets and dashes.
 */
export function formatMask(raw: string, mask: string): string {
  let out = "";
  let ri = 0;

  for (const m of mask) {
    if (ri >= raw.length) break;
    if (isToken(m)) {
      out += raw[ri]!;
      ri += 1;
    } else {
      out += m;
    }
  }
  return out;
}

/**
 * Extracts the raw value from the displayed string.
 *
 * Parsing goes POSITIONALLY, together with the mask, rather than "drop everything that looks like
 * a literal". In the mask `+7 (999)` the literal `7` is also a digit, and a naive filter would drag
 * it into the value.
 */
export function unmask(display: string, mask: string): string {
  return walkMask(display, mask).raw;
}

/**
 * One pass over the mask: both the value and the point where the pass stopped.
 *
 * Extracted so that `unmask` and `unmaskOverflow` cannot diverge. Two copies of one positional
 * parse are exactly the case where the second one quietly starts counting differently.
 */
function walkMask(
  display: string,
  mask: string,
  kinds: MaskToken[] = []
): { raw: string; consumed: number; skipped: number } {
  let raw = "";
  let di = 0;
  let skipped = 0;

  for (let mi = 0; mi < mask.length && di < display.length; mi += 1) {
    const m = mask[mi]!;
    if (isToken(m)) {
      // Characters that do not fit this token are skipped, so a paste of "+7 916 123"
      // is laid out over a mask made of digits only.
      while (di < display.length && !matches(display[di]!, m)) {
        // Skipped characters are not all alike. A space or a dash between groups is
        // decoration, and losing it means nothing. But a character that the mask WOULD
        // have accepted in ANOTHER place is a loss of VALUE, and it must be counted: on
        // the mask `999-aaa`, pasting `123-456` yields `123`, silently losing the second half.
        if (kinds.some((token) => matches(display[di]!, token))) skipped += 1;
        di += 1;
      }
      if (di < display.length) {
        raw += display[di]!;
        di += 1;
      }
    } else if (display[di] === m) {
      di += 1;
    }
  }
  return { raw, consumed: di, skipped };
}

/**
 * Counts the matching characters that DID NOT FIT into the mask.
 *
 * A separate function rather than a second field on `unmask`: that one is public and returns a
 * string, and its contract cannot be changed for the sake of a flag.
 *
 * Why the flag is needed at all. `unmask` walks the mask and stops at its end, so extra characters
 * are dropped silently. On a phone field this produced not a truncated number but a FOREIGN one:
 * `89161234567` (the most common form in the clipboard) under the mask `+7 (999) 999-99-99` turned
 * into `+7 (891) 612-34-56`. The value had changed, so the `raw === value` check in `MaskedInput`
 * did not notice the rejection, and nobody told the user anything.
 *
 * Only characters that the mask COULD have accepted count as overflow. A tail of spaces and literals
 * is not a lost value, just noise around it.
 *
 * Loss is counted in the MIDDLE of the pass too, not only at the tail. A mask of uniform tokens never
 * has that, but on a mixed mask (`999-aaa`) pasting `123-456` yields `123` and loses the second half,
 * silently, because the value has changed and the per-token rejection check does not see it.
 */
export function unmaskOverflow(display: string, mask: string): number {
  const kinds = [...mask].filter(isToken);
  if (kinds.length === 0) return 0;

  // Counting "all matching characters minus capacity" is NOT allowed. This is the trap
  // that the module header warns about: in `+7 (999)` the literal `7` is also a digit.
  // A naive count would report `79161234567` as one character over, although the number
  // fits exactly. A position is resolved only by position.
  const { consumed, skipped } = walkMask(display, mask, kinds);
  let overflow = skipped;
  for (let i = consumed; i < display.length; i += 1) {
    if (kinds.some((token) => matches(display[i]!, token))) overflow += 1;
  }
  return overflow;
}

/** How many characters of the value stand to the left of the position in the displayed string. */
export function rawLengthBefore(mask: string, caret: number): number {
  let count = 0;
  for (let i = 0; i < Math.min(caret, mask.length); i += 1) if (isToken(mask[i]!)) count += 1;
  return count;
}

/**
 * Where the caret should stand after `count` characters have been entered.
 *
 * The position is taken AFTER the last occupied token, together with the literals that follow it.
 * Otherwise, after the third digit the caret would land before `)`, and the next digit would be
 * pushed past the bracket.
 */
export function caretAfter(mask: string, count: number): number {
  if (count === 0) return 0;
  let seen = 0;
  for (let i = 0; i < mask.length; i += 1) {
    if (isToken(mask[i]!)) {
      seen += 1;
      if (seen === count) {
        let end = i + 1;
        while (end < mask.length && !isToken(mask[end]!)) end += 1;
        return end;
      }
    }
  }
  return mask.length;
}

/** How many characters of the value the mask holds. */
export function maskCapacity(mask: string): number {
  return [...mask].filter(isToken).length;
}

/**
 * The token that the character of the value at position `index` must satisfy.
 *
 * It is needed to tell the user WHAT was expected here, rather than a faceless "invalid input".
 * `undefined` means the mask has run out: the value is filled completely, and the next character
 * has no place.
 */
export function maskTokenAt(mask: string, index: number): MaskToken | undefined {
  let seen = 0;
  for (const m of mask) {
    if (!isToken(m)) continue;
    if (seen === index) return m;
    seen += 1;
  }
  return undefined;
}

/**
 * The tail of the mask after what is already shown: a mask guide.
 *
 * `formatMask` stops where the value ends, so an empty field shows nothing, and a field with one digit
 * does not say how many are still missing. This function fills in the remainder: unoccupied tokens are
 * replaced with a filler character, and literals stay as they are. An empty phone value gives
 * `+7 (___) ___-__-__`, not a bare row of underscores. The literals are half of the guide.
 *
 * THE LENGTHS ALWAYS MATCH: `formatMask(raw, mask).length + maskRemainder(...).length` equals the length
 * of the mask for any value. The display relies on this. The typed part and the remainder lie one after
 * another and together take exactly the width of the mask. The filler is therefore one character;
 * a longer string would break the equality.
 *
 * Not exported, like `caretAfter` and `rawLengthBefore`: this is display mechanics, not a vocabulary
 * for the consumer.
 */
export function maskRemainder(raw: string, mask: string, fill = "_"): string {
  let out = "";
  let ri = 0;
  let mi = 0;

  // The first pass repeats `formatMask` up to the point where the value ends.
  // Duplicating the pass is cheaper than returning a pair from there: `formatMask`
  // is public, and its signature is a contract with the consumer.
  for (; mi < mask.length; mi += 1) {
    if (ri >= raw.length) break;
    if (isToken(mask[mi]!)) ri += 1;
  }

  for (; mi < mask.length; mi += 1) out += isToken(mask[mi]!) ? fill : mask[mi]!;

  return out;
}
