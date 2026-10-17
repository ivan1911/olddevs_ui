"use client";

import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { cn } from "../../lib/cn.js";
import type { Size } from "../../lib/variants.js";

export interface SectionHeaderProps extends Omit<ComponentPropsWithoutRef<"div">, "title"> {
  /** Title: a string or markup, for example an icon with a label, a counter, or a range switch. */
  title: ReactNode;
  /** Actions on the right: a link, a button, or a counter. */
  right?: ReactNode;
  /** Title font size: `sm` is smaller, `md` is larger (default). */
  size?: Extract<Size, "sm" | "md">;
  /**
   * Heading level in the document: `h2`, `h3` (default), or `h4`.
   *
   * The heading level in the document is separate from the size, by the same rule as for
   * `Heading`: heading levels must follow one another without gaps, while the font size is not
   * tied to them.
   *
   * The default `3` is what the component always rendered. It is right for a section inside a
   * card that sits under a page section heading, and wrong directly under `PageHeader`: there a
   * gap forms between `h1` and `h3`, and the outline for screen readers breaks. On such a screen
   * pass `level={2}`.
   */
  level?: 2 | 3 | 4;
}

/** Scale of title sizes. Both steps are taken from actual call sites. */
const SIZES = {
  sm: "text-[13px]",
  md: "text-[15px]",
} as const;

/**
 * Section header inside a card: a label on the left, actions on the right.
 *
 * `title` is typed as `ReactNode`, not as a string, because on the frontend markup is put into it:
 * an icon with a label, a counter, a range switch. Narrowing the type to a string would break
 * eight of the seventeen call sites.
 */
export const SectionHeader = forwardRef<HTMLDivElement, SectionHeaderProps>(function SectionHeader(
  { title, right, size = "md", level = 3, className, ...rest },
  ref
) {
  const Comp = `h${level}` as const;

  return (
    <div ref={ref} className={cn("mb-3.5 flex items-center justify-between", className)} {...rest}>
      <Comp className={cn("m-0 font-bold", SIZES[size])}>{title}</Comp>
      {right}
    </div>
  );
});
