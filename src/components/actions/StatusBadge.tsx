"use client";

import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { cn } from "../../lib/cn.js";
import { TONE_TOKENS, type Size, type Tone } from "../../lib/variants.js";

export interface StatusBadgeProps extends Omit<ComponentPropsWithoutRef<"span">, "children"> {
  /** Status label. The mapping "status → tone and label" stays with the consumer. */
  children: ReactNode;
  /** Background, text and dot color from the tone vocabulary. Defaults to `neutral`. */
  tone?: Tone;
  // Via Extract from the shared Size, not its own union: if a size is added to the vocabulary,
  // the compiler will flag it here, not the reader of the code.
  /** Badge height: `sm` — compact, `md` — taller. Defaults to `sm`. */
  size?: Extract<Size, "sm" | "md">;
  /** Indicator dot on the left, in the tone's color. Shown by default. */
  dot?: boolean;
}

const SIZES = {
  sm: "h-[18px] gap-1.5 pr-2 pl-1.5 text-[11px]",
  md: "h-[22px] gap-1.5 pr-2.5 pl-2 text-xs",
} as const;

/**
 * Status badge: a muted tone background, text in the tone's color, a dot on the left.
 *
 * The previous version on the frontend kept inside it a dictionary of 11 domain statuses together
 * with Russian labels — `in_progress` → "In progress", `duplicate` → "Duplicate". The package
 * cannot know about domain statuses: it has nothing to do with wallpapers or publications. So only
 * the shape remains here, and the mapping "status → tone + label" lives on the frontend, next to
 * the domain.
 *
 * The previous version's sizes and paddings were set with inline numbers (`fontSize: 11`,
 * `padding: "3px 8px 3px 6px"`) outside the token scale — here they are utilities.
 */
export const StatusBadge = forwardRef<HTMLSpanElement, StatusBadgeProps>(function StatusBadge(
  { children, tone = "neutral", size = "sm", dot = true, className, ...rest },
  ref
) {
  const t = TONE_TOKENS[tone];

  return (
    <span
      ref={ref}
      className={cn(
        "inline-flex items-center rounded-full font-semibold tracking-wider whitespace-nowrap",
        SIZES[size],
        t.bg,
        t.fg,
        className
      )}
      {...rest}
    >
      {dot ? (
        <span aria-hidden="true" className={cn("h-1.5 w-1.5 shrink-0 rounded-full", t.dotBg)} />
      ) : null}
      {children}
    </span>
  );
});
