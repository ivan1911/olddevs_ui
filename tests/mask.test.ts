import { describe, expect, test } from "vitest";
import {
  caretAfter,
  formatMask,
  maskCapacity,
  maskRemainder,
  rawLengthBefore,
  unmask,
  unmaskOverflow,
} from "../src/lib/mask.js";

const PHONE = "+7 (999) 999-99-99";

describe("formatMask", () => {
  test("literals are inserted on their own", () => {
    expect(formatMask("9161234567", PHONE)).toBe("+7 (916) 123-45-67");
  });

  test("the mask tail is not shown ahead of time", () => {
    // Otherwise an empty field would show "+7 (" before the first character, and
    // a field with one digit would show a tail of brackets and dashes.
    expect(formatMask("", PHONE)).toBe("");
    expect(formatMask("9", PHONE)).toBe("+7 (9");
  });

  test("extra characters are dropped", () => {
    expect(formatMask("91612345678888", PHONE)).toBe("+7 (916) 123-45-67");
  });

  test("letters and any-character are their own tokens", () => {
    expect(formatMask("AB12", "aa-**")).toBe("AB-12");
  });
});

describe("unmask", () => {
  test("a digit literal does not leak into the value", () => {
    // In the mask `+7 (999)` the literal `7` is a digit too, and a naive "keep only
    // digits" filter would pull it into the value.
    expect(unmask("+7 (916) 123-45-67", PHONE)).toBe("9161234567");
  });

  test("a paste with foreign separators is laid out", () => {
    expect(unmask("+7 916 123 45 67", PHONE)).toBe("9161234567");
  });

  test("unfinished input is parsed partially", () => {
    expect(unmask("+7 (916", PHONE)).toBe("916");
  });

  test("an erased literal does not eat a value character", () => {
    // The user erased `)`; the digits stay in place.
    expect(unmask("+7 (916", PHONE)).toBe("916");
    expect(unmask("+7 (916)", PHONE)).toBe("916");
  });
});

describe("caret", () => {
  test("counts value characters left of the position", () => {
    expect(rawLengthBefore(PHONE, 0)).toBe(0);
    expect(rawLengthBefore(PHONE, 5)).toBe(1);
    expect(rawLengthBefore(PHONE, 7)).toBe(3);
  });

  test("lands after literals, not before them", () => {
    // Otherwise, after the third digit the caret landed before `)`, and the next
    // digit would end up past the bracket.
    expect(caretAfter(PHONE, 3)).toBe(9);
    expect(caretAfter(PHONE, 0)).toBe(0);
    expect(caretAfter(PHONE, 10)).toBe(PHONE.length);
  });
});

test("mask capacity is counted by tokens", () => {
  expect(maskCapacity(PHONE)).toBe(10);
  expect(maskCapacity("99.99.9999")).toBe(8);
});

describe("maskRemainder", () => {
  test("an empty value yields a skeleton together with the literals", () => {
    // Literals are half of the hint: `+7 (` says more about the format than
    // a row of underscores of the same length.
    expect(maskRemainder("", PHONE)).toBe("+7 (___) ___-__-__");
  });

  test("the remainder is eaten left to right", () => {
    expect(maskRemainder("9", PHONE)).toBe("__) ___-__-__");
    expect(maskRemainder("916", PHONE)).toBe(") ___-__-__");
    expect(maskRemainder("916123", PHONE)).toBe("-__-__");
  });

  test("a filled mask yields an empty tail", () => {
    expect(maskRemainder("9161234567", PHONE)).toBe("");
    // Overflow also yields an empty tail: `formatMask` drops the extra characters.
    expect(maskRemainder("91612345678888", PHONE)).toBe("");
  });

  test("the placeholder is a parameter", () => {
    expect(maskRemainder("", "99.99", "·")).toBe("··.··");
  });

  test("the lengths add up for any value", () => {
    // The property the display relies on: the typed value and the remainder sit
    // one after another and together take exactly the width of the mask.
    for (const mask of [PHONE, "99.99.9999", "aa-**", "9"]) {
      for (const raw of ["", "9", "91", "916123", "9161234567", "91612345678888"]) {
        expect(formatMask(raw, mask).length + maskRemainder(raw, mask).length).toBe(mask.length);
      }
    }
  });
});

/**
 * Overflow when pasting.
 *
 * `unmask` walks the mask and silently stops at its end, so extra matching
 * characters were dropped without a trace. On the most common input a phone
 * field gets, this produced not a truncated number but a DIFFERENT one:
 * `89161234567`, the most common form of a Russian number on the clipboard,
 * under the mask `+7 (999) 999-99-99` turned into `+7 (891) 612-34-56`.
 *
 * A plausible result is worse than an empty one: neither the component nor the
 * eye sees the error. The module could already reject a token that did not match
 * (`maskTokenAt`: "tell the user WHAT was expected here"), but not an overflow.
 */
describe("overflow when pasting", () => {
  test("the most common Russian phone form does not become a different number", () => {
    // The leading "8" is not part of the number, but it must not be silently eaten along with the tail.
    expect(unmaskOverflow("89161234567", PHONE)).toBe(1);
  });

  test("a value that fits reports no overflow", () => {
    expect(unmaskOverflow("79161234567", PHONE)).toBe(0);
    expect(unmaskOverflow("+7 916 123-45-67", PHONE)).toBe(0);
    expect(unmaskOverflow("", PHONE)).toBe(0);
  });

  test("overflow counts every character that did not fit", () => {
    expect(unmaskOverflow("7916123456789", PHONE)).toBe(2);
  });

  test("characters that no token accepts are not overflow", () => {
    // A tail of literals and spaces is not a lost value.
    expect(unmaskOverflow("79161234567   ", PHONE)).toBe(0);
  });

  test("unmask itself keeps returning what fits", () => {
    // The overflow signal is a separate function, not a change to the `unmask` contract:
    // `unmask` is public and returns a string.
    expect(unmask("89161234567", PHONE)).toBe("8916123456");
  });
});

/**
 * A value lost IN THE MIDDLE of the walk, not only in the tail.
 *
 * `walkMask` skips characters that do not fit the current token; that is how a
 * paste like "+7 916 123" gets laid out over a digit mask. On a uniform mask only
 * the formatting is skipped, but on a mixed mask the VALUE is skipped:
 * `123-456` under `999-aaa` gives `123` and loses the second half. By then the
 * value has changed, so rejection by token does not see this loss.
 */
describe("value lost inside the walk", () => {
  test("digits falling where the mask wants letters count as overflow", () => {
    expect(unmask("123-456", "999-aaa")).toBe("123");
    expect(unmaskOverflow("123-456", "999-aaa")).toBe(3);
  });

  test("a well-formed value on a mixed mask reports nothing", () => {
    expect(unmask("123-abc", "999-aaa")).toBe("123abc");
    expect(unmaskOverflow("123-abc", "999-aaa")).toBe(0);
  });

  test("separators are not value and are not counted", () => {
    expect(unmaskOverflow("+7 916 123-45-67", PHONE)).toBe(0);
  });
});
