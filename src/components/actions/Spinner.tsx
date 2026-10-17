"use client";

import { forwardRef } from "react";
import { cn } from "../../lib/cn.js";
import { useMessages } from "../../i18n/useMessages.js";
import { TONE_TOKENS, type Size, type Tone } from "../../lib/variants.js";

export interface SpinnerProps {
  /** Ring size: `sm`, `md` or `lg`. Defaults to `md`. */
  size?: Size;
  /** Ring color from the tone vocabulary. Defaults to `accent`. */
  tone?: Tone;
  /** Accessible name. Defaults to "Loading". */
  label?: string;
  /** Classes for the root element. */
  className?: string;
}

const SIZES: Record<Size, string> = {
  sm: "size-3.5 border-[1.5px]",
  md: "size-4 border-2",
  lg: "size-6 border-2",
};

/**
 * A spinning indicator, for waits where neither the duration nor the content is known.
 *
 * THE BOUNDARY WITH ITS NEIGHBORS, keep it in mind:
 *
 *   `Skeleton`  — the shape of the future content is known: list rows, a card.
 *   `Progress`  — the share of completed work is known.
 *   `Spinner`   — neither is known: a form submission, waiting for a response with no layout
 *                 reserved for it.
 *
 * A skeleton instead of a spinner where the shape is known is not decoration: it holds the
 * layout, so the content does not jump when it appears.
 *
 * `role="status"` with a visually hidden label, not a bare `div`: without a name, a spinning
 * circle does not exist for a screen reader, and the user does not learn that the page is busy.
 *
 * The spin is NOT disabled under `prefers-reduced-motion`. This is one of the two named
 * exceptions in the kit (ADR-0043; the other is the indeterminate `Progress`). The reasoning is
 * the same as for `role="status"` above: the spinner is the only way the kit reports
 * "work in progress". A frozen circle is no calmer than a spinning one; it looks broken, and
 * the user loses information rather than removing an irritant. W3C exempts essential motion
 * from the rule; here the motion is essential.
 *
 * So that the exception is visible beyond this file, `--animate-spin` is declared explicitly in
 * the kit's `@theme`: the gate reads `styles.css` and does not know Tailwind's default theme.
 *
 * Before wave 27 this paragraph claimed the opposite: that animation is turned off by a "global
 * rule of the package". No such rule existed: across the whole repository the string
 * `prefers-reduced-motion` appeared exactly once, in this very comment.
 */
export const Spinner = forwardRef<HTMLSpanElement, SpinnerProps>(function Spinner(
  { size = "md", tone = "accent", label, className },
  ref
) {
  const messages = useMessages();
  const t = TONE_TOKENS[tone];

  return (
    <span ref={ref} role="status" className={cn("inline-flex items-center", className)}>
      <span
        aria-hidden
        className={cn(
          // A ring with one transparent segment: three sides are colored, the fourth is
          // transparent — that is what makes the rotation visible.
          "animate-spin rounded-full border-current border-t-transparent",
          SIZES[size],
          t.fg
        )}
      />
      <span className="sr-only">{label ?? messages.spinner.label}</span>
    </span>
  );
});
