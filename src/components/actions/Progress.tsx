"use client";

import { forwardRef } from "react";
import { ProgressBar } from "react-aria-components";
import { cn } from "../../lib/cn.js";
import { isShowableNumber } from "../../lib/empty.js";
import { TONE_TOKENS, type Size, type Tone } from "../../lib/variants.js";

export interface ProgressProps {
  /**
   * 0–100. `null` — progress is unknown: a moving bar instead of a fraction.
   *
   * This is not the same as `0`. Zero means "started, nothing done yet"; `null` means "how much
   * work there is in total is unknown". The second case happens with a request that has no
   * response length, and showing it as zero would be lying.
   */
  value: number | null;
  /** Color of the filled part of the bar, from the tone vocabulary. Defaults to `accent`. */
  tone?: Tone;
  /** Bar thickness: `sm` is thinner, `md` is thicker. Defaults to `md`. */
  size?: Extract<Size, "sm" | "md">;
  /** What is in progress. Required: an unnamed indicator says nothing. */
  label: string;
  /** Show the percentage to the right of the bar. */
  showValue?: boolean;
  /** Classes for the root element that holds the bar and the percentage. */
  className?: string;
}

const HEIGHTS: Record<"sm" | "md", string> = { sm: "h-1", md: "h-1.5" };

/**
 * Progress bar.
 *
 * `aria-valuenow` is ABSENT when progress is unknown, not equal to zero — this is how ARIA
 * distinguishes "a bar at zero" from "something is running for an unknown amount of time".
 * React Aria does this if no value is passed; putting `0` there would tell the screen reader
 * something untrue.
 *
 * When a bar, and when a `Skeleton` or a `Spinner`: a bar is needed where the fraction of work
 * can be named — a file upload, processing a batch. If the fraction cannot be named but the shape
 * of the future content is known — `Skeleton`; if neither is known — `Spinner`.
 */
export const Progress = forwardRef<HTMLDivElement, ProgressProps>(function Progress(
  { value, tone = "accent", size = "md", label, showValue, className },
  ref
) {
  const t = TONE_TOKENS[tone];
  /*
    `NaN` is ALSO unknown progress, not a value.

    The check `value == null` did not catch it, and neither does `?? 0` below: `??` handles only
    null and undefined. The markup got `width: NaN%` — the declaration is invalid, the browser
    discards it, and the block div stretched to the full width: the user saw 100% for work that
    had not started, and the screen reader read "NaN percent". It comes from ordinary arithmetic
    on the consumer's side: `loaded / total * 100` with a zero `total`.
  */
  const indeterminate = !isShowableNumber(value);

  return (
    <ProgressBar
      ref={ref}
      // Through the same predicate as `indeterminate` above: `?? undefined` lets `NaN` through
      // into react-aria, and it is saved only by the fact that with unknown progress it does not
      // read `percentage`. One predicate for both places.
      value={isShowableNumber(value) ? value : undefined}
      isIndeterminate={indeterminate}
      aria-label={label}
      className={cn("flex items-center gap-2", className)}
    >
      {({ percentage, valueText }) => (
        <>
          <div
            className={cn("bg-bg-3 relative w-full overflow-hidden rounded-full", HEIGHTS[size])}
          >
            <div
              className={cn(
                "duration-moderate h-full rounded-full transition-[width]",
                t.dotBg,
                // Unknown progress — a moving third of the bar. The width is not animated here:
                // the position is, otherwise the bar would jitter in width on every frame.
                // The moving third is NOT stopped by `prefers-reduced-motion`: it is the second
                // of the kit's two exceptions (ADR-0043; the first is `Spinner`). When the
                // fraction is unknown, the motion of the bar is the whole message — a frozen
                // third reads as "stuck", not as "calm".
                indeterminate && "animate-progress-indeterminate w-1/3"
              )}
              style={indeterminate ? undefined : { width: `${percentage ?? 0}%` }}
            />
          </div>
          {showValue && (
            <span className="text-fg-2 w-10 shrink-0 text-right text-[11px] tabular-nums">
              {indeterminate ? "—" : valueText}
            </span>
          )}
        </>
      )}
    </ProgressBar>
  );
});
