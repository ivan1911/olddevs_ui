"use client";

import type { ComponentPropsWithRef, CSSProperties } from "react";
import { cn } from "../../lib/cn.js";
import { NUMERIC_CLASS, TONE_TOKENS, type Numeric, type Tone } from "../../lib/variants.js";

/** Size steps available to text. Heading sizes (`xl`, `2xl`) belong to `Heading`. */
export type TextSize = "caption" | "xs" | "sm" | "md" | "lg";

export interface TextProps extends Omit<ComponentPropsWithRef<"p">, "color"> {
  /** Size step: `caption`, `xs`, `sm`, `md` or `lg`. Defaults to `md`. */
  size?: TextSize;
  /**
   * Emphasis: `1` — primary text, `2` — secondary, `3` — supporting.
   *
   * This is NOT a heading level, even though the `Heading` prop has the same name. Giving them
   * different names would be more honest, but `Heading`'s `level` is an HTML concept rather than
   * a kit invention, so it is the prop that would need renaming. Here, "level" carries the same
   * everyday meaning as the word: how important the text is.
   *
   * In practice they cannot be confused: `Text` has no `h1` and no heading role, and `Heading`
   * has no emphasis, since a heading is never lighter than body text.
   */
  level?: 1 | 2 | 3;
  /**
   * Semantic color. `neutral` (default) means "color by emphasis": tone and `level` are
   * separate axes, and they must not be mixed.
   */
  tone?: Tone;
  /** Font weight: `regular`, `medium` or `bold`. Defaults to `regular`. */
  weight?: "regular" | "medium" | "bold";
  /**
   * Numeral width: `tabular` — equal-width digits, for values that tick, recalculate, or sit
   * in a column.
   *
   * No default is set on purpose: tabular digits are wider than proportional ones and read
   * worse in running text. Turn the axis on where numbers change in place, not everywhere.
   */
  numeric?: Numeric;
  /**
   * Ellipsis truncation. `true` — one line, a number — that many lines.
   */
  truncate?: boolean | number;
  /** Text tag: `p`, `span` or `div`. Defaults to `p`. */
  as?: "p" | "span" | "div";
}

const SIZE_CLASS: Record<TextSize, string> = {
  caption: "text-caption",
  xs: "text-xs",
  sm: "text-sm",
  md: "text-md",
  lg: "text-lg",
};

/**
 * Emphasis. The steps are the same as across the kit: `fg-0` is primary, `fg-1` is secondary,
 * `fg-2` is supporting. The levels below (`fg-3`, `fg-4`) are not used here: they do not reach
 * 4.5:1 contrast on the app's backgrounds, and they are kept for non-text roles — icons and
 * dividers.
 */
const LEVEL_CLASS: Record<1 | 2 | 3, string> = {
  1: "text-fg-0",
  2: "text-fg-1",
  3: "text-fg-2",
};

const WEIGHT_CLASS = {
  regular: "font-normal",
  medium: "font-medium",
  bold: "font-semibold",
} as const;

/**
 * A paragraph or a line of text on a scale step.
 *
 * The component exists not for the sake of `<p className="text-sm">`, but so that size and
 * emphasis come from two closed sets. Before the scale, the kit used eight sizes, three of
 * which were arbitrary, and the difference between a "supporting caption" and "secondary
 * text" lived in the author's head.
 *
 * `as` changes only the element, never the look: a `<span>` inside a line and a `<p>` in a
 * paragraph must look the same.
 */
export function Text({
  size = "md",
  level = 1,
  tone = "neutral",
  weight = "regular",
  numeric,
  truncate,
  as: Comp = "p",
  className,
  style,
  ...rest
}: TextProps) {
  // Zero lines does not mean "no limit" but hidden text: `-webkit-line-clamp: 0` on a box with
  // `overflow: hidden` shows nothing. Treat it as a typo on the caller's side and clamp to one
  // line.
  const lines = typeof truncate === "number" && truncate > 0 ? truncate : undefined;
  const oneLine = truncate === true || truncate === 0;

  return (
    <Comp
      className={cn(
        SIZE_CLASS[size],
        // Tone overrides emphasis: for colored text, "secondary" is expressed by the tone itself,
        // not by a second color on top. Dimming the tone with opacity is not allowed: the tones
        // are calibrated to exactly 4.5:1 contrast.
        tone === "neutral" ? LEVEL_CLASS[level] : TONE_TOKENS[tone].fg,
        WEIGHT_CLASS[weight],
        numeric && NUMERIC_CLASS[numeric],
        oneLine && "truncate",
        // Multi-line clamp: the box classes are literal, and the line count goes into an inline
        // style. `line-clamp-${lines}` cannot be built: Tailwind scans the source as plain text,
        // and a class assembled at runtime silently misses the CSS. A literal list of 2–6 lines
        // would cover the usual cases and be wrong at seven.
        lines != null && "[display:-webkit-box] overflow-hidden [-webkit-box-orient:vertical]",
        className
      )}
      style={lines != null ? ({ WebkitLineClamp: lines, ...style } as CSSProperties) : style}
      {...rest}
    />
  );
}
