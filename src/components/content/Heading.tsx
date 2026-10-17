"use client";

import type { ComponentPropsWithRef } from "react";
import { cn } from "../../lib/cn.js";
import { NUMERIC_CLASS, type Numeric } from "../../lib/variants.js";

/** Sizes available to the heading. The small ones (`xs`, `caption`) are on `Text`. */
export type HeadingSize = "md" | "lg" | "xl" | "2xl";

export interface HeadingProps extends ComponentPropsWithRef<"h2"> {
  /**
   * The heading level is a property of the document, not of its size: screen readers
   * build the page outline from it, so the order must be continuous (no `h4` right
   * after an `h2`).
   */
  level: 1 | 2 | 3 | 4;
  /**
   * Size is kept apart from the level, for when the two need to differ.
   *
   * They are separated on purpose. A component where "h3 is always smaller than h2" forces
   * a trade-off: either the heading order is broken to get the right font size, or the font
   * size is set by hand outside the system. Here the default ties them together (the level
   * sets the size), and `size` unties them.
   */
  size?: HeadingSize;
  /**
   * The tag, for when the level is already taken in the markup.
   *
   * A real case: a card with an `h3` inside a section with an `h2` moves into a dialog
   * that has its own header. The level changes, the look must not.
   */
  as?: `h${1 | 2 | 3 | 4 | 5 | 6}`;
  /**
   * Numeral style: `tabular` makes digits equal width. It is the same axis as on `Text`, and
   * it is also the answer to a large number in a heading, such as a dashboard summary that
   * recalculates in place.
   */
  numeric?: Numeric;
}

/**
 * Default size for each level. Level 4 uses `md`, the same size as body text: a fourth-level
 * heading differs from a paragraph by weight, not size, otherwise the scale would drop below
 * what is readable.
 */
const LEVEL_SIZE: Record<1 | 2 | 3 | 4, HeadingSize> = {
  1: "2xl",
  2: "xl",
  3: "lg",
  4: "md",
};

const SIZE_CLASS: Record<HeadingSize, string> = {
  md: "text-md",
  lg: "text-lg",
  xl: "text-xl",
  "2xl": "text-2xl",
};

/**
 * Heading: the document level and the font size are two independent things.
 *
 * `level` is required and has no default. A default would be harmful: only the person who
 * assembles the page knows which heading this is in the document, and an `h2` that is
 * selected silently is a silently broken outline for screen readers.
 */
export function Heading({ level, size, as, numeric, className, ...rest }: HeadingProps) {
  const Comp = as ?? (`h${level}` as const);

  return (
    <Comp
      className={cn(
        "text-fg-0 font-semibold",
        SIZE_CLASS[size ?? LEVEL_SIZE[level]],
        numeric && NUMERIC_CLASS[numeric],
        className
      )}
      {...rest}
    />
  );
}
