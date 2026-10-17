"use client";

import type { ReactNode } from "react";
import { cn } from "../../lib/cn.js";
import { PROGRESS_STATUS_TONE, type ProgressStatus } from "../../lib/progress-status.js";
import { TONE_TOKENS } from "../../lib/variants.js";

export interface TimelineItem {
  /** Step identifier. */
  id: string;
  /** What happened. Usually a short step name. */
  label: ReactNode;
  /** Step state. The consumer sets the order in the list, not the status. */
  status: ProgressStatus;
  /** Status label, such as "done" or "error". Rendered as a pill to the right of the name. */
  statusLabel?: ReactNode;
  /** Details: an error message, a duration, an identifier. */
  details?: ReactNode;
  /** Step time. Pushed to the right, in monospace. */
  time?: ReactNode;
}

export interface TimelineProps {
  /** Steps in display order; an empty list renders nothing. */
  items: TimelineItem[];
  /** Classes for the root element. */
  className?: string;
  /** Accessible name of the step list for screen readers. */
  "aria-label"?: string;
}

/**
 * A timeline of process steps: what has already happened and how it ended.
 *
 * THE BOUNDARY WITH `Stepper` is worth keeping in mind:
 *
 *   `Stepper`  — a wizard: a linear `current`, the steps ahead have not happened yet,
 *                a step cannot fail, going back is a click.
 *   `Timeline` — an observation log: EACH step has its own state, any of them can fail,
 *                there is nothing to click.
 *
 * The task's step pipeline on the frontend never moved to `Stepper`, and it stayed
 * hand-written: 122 lines of inline styles with hardcoded `rgba` values, that is, colors
 * outside the tokens, which did not change with the theme or with a change of accent.
 *
 * MARKUP is an ordered list. The steps come in order, and a screen reader must announce both
 * the order and the total count; a set of `div`s announces neither. The running step is
 * marked with `aria-current="step"`.
 *
 * COLORS COME FROM THE TONE TOKENS (`TONE_TOKENS`) and are not redefined: an error is the
 * same color here, in `Alert`, in `StatusBadge`, and on the remove button. The glow on the
 * running step was removed on purpose: it was the only place in the timeline where a color
 * came from a shadow instead of a token.
 */
export function Timeline({ items, className, "aria-label": ariaLabel }: TimelineProps) {
  if (items.length === 0) return null;

  return (
    <ol aria-label={ariaLabel} className={cn("flex flex-col", className)}>
      {items.map((item, index) => {
        // An unknown status gets a neutral tone instead of breaking the whole timeline.
        // The consumer is a JS app: the compiler does not check its data, and statuses come
        // from the backend, so a fifth kind of step must not cost the screen. The previous
        // hand-written version covered this case, and the guard must not be lost in the move.
        const tone = TONE_TOKENS[PROGRESS_STATUS_TONE[item.status] ?? "neutral"];
        const isLast = index === items.length - 1;

        return (
          <li
            key={item.id}
            aria-current={item.status === "running" ? "step" : undefined}
            className="relative flex items-start gap-2.5"
          >
            {/* Marker column: the dot and the connecting line. There is no line after the last
                step, since it would suggest that more steps follow. */}
            <div className="flex w-3.5 shrink-0 flex-col items-center pt-1">
              <span aria-hidden className={cn("size-2 shrink-0 rounded-full", tone.dotBg)} />
              {!isLast ? <span aria-hidden className="bg-line-soft mt-[3px] w-px flex-1" /> : null}
            </div>

            <div className={cn("min-w-0 flex-1", isLast ? "pb-0" : "pb-1.5")}>
              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className={cn(
                    "text-caption font-mono tracking-wide",
                    tone.fg,
                    item.status === "failed" ? "font-bold" : "font-medium"
                  )}
                >
                  {item.label}
                </span>
                {item.statusLabel ? (
                  <span
                    className={cn(
                      "text-caption rounded-xs px-1.5 py-px font-bold uppercase",
                      tone.bg,
                      tone.fg
                    )}
                  >
                    {item.statusLabel}
                  </span>
                ) : null}
                {item.time ? (
                  <span className="text-fg-3 ml-auto font-mono text-[10px]">{item.time}</span>
                ) : null}
              </div>

              {item.details ? (
                <div
                  className={cn(
                    "mt-0.5 text-xs leading-relaxed break-words",
                    item.status === "failed" ? "text-danger-strong" : "text-fg-3"
                  )}
                >
                  {item.details}
                </div>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
