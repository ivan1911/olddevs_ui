"use client";

import { Typography } from "@tiptap/extension-typography";
import type { ToolDescriptor } from "../../core/toolDescriptor.js";
import type { TypographyToolOptions } from "../../core/toolOptions.js";
import { TypographyQuotes } from "./typography.js";

/**
 * Option defaults: the quote set is taken from the catalog; the single quotes and the
 * other rules are Tiptap's symbols (all rules enabled). The defaults deliberately have no
 * double quotes: an explicit string overrides the `quotes` set, and "not set" differs from
 * "equal to the Tiptap default".
 */
export const TYPOGRAPHY_DEFAULTS: TypographyToolOptions = {
  quotes: "auto",
  openSingleQuote: "‘",
  closeSingleQuote: "’",
  emDash: "—",
  ellipsis: "…",
  leftArrow: "←",
  rightArrow: "→",
  copyright: "©",
  trademark: "™",
  servicemark: "℠",
  registeredTrademark: "®",
  oneHalf: "½",
  oneQuarter: "¼",
  threeQuarters: "¾",
  plusMinus: "±",
  notEqual: "≠",
  laquo: "«",
  raquo: "»",
  multiplication: "×",
  superscriptTwo: "²",
  superscriptThree: "³",
};

/** A rule: `false` disables it; a non-empty string is the replacement symbol (an empty one would erase what was typed). */
const isRule = (value: unknown) => value === false || (typeof value === "string" && value !== "");

/**
 * Typing replacements on the Tool descriptor (ADR-0048): the Typography extension from
 * Tiptap and the kit's double-quote rule (`typography.ts`). These are input rules only:
 * there is no Schema, no buttons, no Insert item, no state and no commands, and only
 * plain symbols go into `value`. Outside the presets, it is enabled by an explicit entry in `tools`.
 */
export const TYPOGRAPHY_TOOL: ToolDescriptor = {
  name: "typography",
  defaults: TYPOGRAPHY_DEFAULTS,
  checks: {
    // The other default fields are rules. The defaults have no double quotes, so those get their own checks.
    ...Object.fromEntries(Object.keys(TYPOGRAPHY_DEFAULTS).map((key) => [key, isRule])),
    openDoubleQuote: isRule,
    closeDoubleQuote: isRule,
    quotes: (value) => value === "auto" || value === "ru" || value === "en",
  },
  engine: (context, options) => {
    const { quotes, openDoubleQuote, closeDoubleQuote, ...rules } =
      options as TypographyToolOptions;
    return [
      // Typography's double quotes are disabled: `TypographyQuotes` sets them instead.
      Typography.configure({ ...rules, openDoubleQuote: false, closeDoubleQuote: false }),
      TypographyQuotes.configure({
        set: quotes === "auto" ? context.quoteSet : () => quotes,
        open: openDoubleQuote,
        close: closeDoubleQuote,
      }),
    ];
  },
};
