"use client";

import type { ReactNode } from "react";
import { cn } from "../../lib/cn.js";
import { TONE_TOKENS, type Tone } from "../../lib/variants.js";

export interface StatProps {
  /** Metric label. */
  label: ReactNode;
  /** Metric value. */
  value: ReactNode;
  /** Note under the value: a time frame, a share, anything short. */
  hint?: ReactNode;
  /** Change: a number or a preformatted string ("+320", "−4%"). */
  delta?: ReactNode;
  /**
   * Tone of the delta. It is set by a prop, not derived from the sign.
   *
   * Growth is not always green: a rising number of unsubscribes, publishing errors or response
   * time is bad news, while falling costs is good news. A component that paints a plus green lies
   * in exactly the cases where a mistake costs the most.
   *
   * When not set, the delta is neutral: "changed by this much", with no judgment.
   */
  deltaTone?: Tone;
  /**
   * Font size of the value.
   *
   * `md`: a metric in a dense panel, where there are a dozen of them and all are equal.
   * `lg`: the headline number of the screen, the one people come to the dashboard for.
   * The difference is not cosmetic: the same size for the main metric and for a neighboring
   * label means the screen has no hierarchy at all.
   */
  size?: "md" | "lg";
  /** Classes for the root element. */
  className?: string;
}

const VALUE_CLASS: Record<"md" | "lg", string> = {
  md: "text-xl font-semibold",
  lg: "text-2xl font-bold tracking-tight",
};

/**
 * A metric: label, value, change.
 *
 * Hand-assembled: there is no behavior here at all, only layout and one decision about the
 * delta tone.
 *
 * The markup is a `dl`: the label and the value are linked as a term and its definition, and a
 * screen reader reads them as a pair. Two adjacent `div`s do not create that link, and the value
 * "12,480" would be read with no indication of what it counts.
 */
export function Stat({ label, value, hint, delta, deltaTone, size = "md", className }: StatProps) {
  return (
    <dl className={cn("m-0 flex flex-col gap-0.5", className)}>
      <dt className="text-fg-2 text-caption">{label}</dt>
      <dd className="m-0 flex items-baseline gap-2">
        <span className={cn("text-fg-0 tabular-nums", VALUE_CLASS[size])}>{value}</span>
        {delta != null ? (
          <span
            className={cn(
              "text-caption font-semibold",
              deltaTone ? TONE_TOKENS[deltaTone].fg : "text-fg-2"
            )}
          >
            {delta}
          </span>
        ) : null}
      </dd>
      {hint != null ? <dd className="text-fg-2 text-caption m-0">{hint}</dd> : null}
    </dl>
  );
}
