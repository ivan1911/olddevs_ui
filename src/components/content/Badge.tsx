"use client";

import type { ComponentPropsWithRef, ReactNode } from "react";
import { cn } from "../../lib/cn.js";
import { TONE_TOKENS, type Tone } from "../../lib/variants.js";

export interface BadgeProps extends Omit<ComponentPropsWithRef<"span">, "children"> {
  /** What to show: a number or a short label. */
  children?: ReactNode;
  /**
   * Color tone of the badge: `neutral`, `accent`, `success`, `warning` or `danger`. Defaults to
   * `danger`.
   */
  tone?: Tone;
  /**
   * A dot instead of a number: "there is something new", without saying how much.
   *
   * Needed where a number does not help: a notification badge reading "237" is harder to read
   * than a plain mark that tells the user there is something to look at.
   */
  dot?: boolean;
  /** Upper limit for the number: anything above it is shown as "99+". */
  max?: number;
  /**
   * Whether to place the badge over an icon: in the top-right corner of a parent that has
   * `position` set (usually `relative`).
   */
  overlay?: boolean;
}

/**
 * A counter or a short label.
 *
 * THE BOUNDARY WITH NEIGHBORS — the only thing worth explaining here, because three kit components
 * look alike and mean different things:
 *
 *   `Badge`       — HOW MANY. A number next to something: five unread, twelve in the queue.
 *                   Not clickable on its own.
 *   `StatusBadge` — IN WHICH STATE the entity is: draft, published, error. A value from a closed
 *                   set, not a number.
 *   `Chip count`  — a counter inside a filter: how many will match if it is pressed. Part of the
 *                   clickable pill, not a standalone mark.
 *
 * Easy to mix up, and the cost of the mistake is not cosmetic: `StatusBadge` reports a state
 * through its tone ("error" in red), whereas `Badge` uses the tone for importance. A red counter
 * next to an icon means "urgent", not "broken".
 */
export function Badge({
  children,
  tone = "danger",
  dot,
  max = 99,
  overlay,
  className,
  ...rest
}: BadgeProps) {
  const t = TONE_TOKENS[tone];

  const content = typeof children === "number" && children > max ? `${max}+` : children;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold",
        t.solid,
        dot
          ? "size-2"
          : // Minimum width equals height: a counter showing "1" has to be a circle,
            // not a narrow pill, otherwise a row of badges looks ragged.
            "text-caption h-4 min-w-4 px-1",
        // Overlay is absolute positioning in the corner of a sibling; a ring in the
        // background color separates the badge from the icon underneath it.
        overlay && "ring-bg-1 absolute -top-1 -right-1 ring-2",
        className
      )}
      {...rest}
    >
      {dot ? null : content}
    </span>
  );
}
