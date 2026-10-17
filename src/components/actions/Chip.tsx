"use client";

import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { cn } from "../../lib/cn.js";
import { TONE_TOKENS, type Size, type Tone } from "../../lib/variants.js";

export interface ChipProps extends Omit<ComponentPropsWithoutRef<"button">, "children"> {
  /**
   * Chip label. When hidden by `iconOnly` or `mobileIconOnly`, it remains the button's
   * accessible name.
   */
  children?: ReactNode;
  /** Only `sm` and `md`: a chip larger than medium stops reading as a chip. */
  size?: Extract<Size, "sm" | "md">;
  /** Color of the selected state. Does not affect an unselected chip — that one is always neutral. */
  tone?: Tone;
  /** Was `active`. Renamed: the vocabulary allows only `selected`. */
  selected?: boolean;
  /** Icon before the label. */
  icon?: ReactNode;
  /** Counter on the right. Zero is shown; `null`/`undefined` is not. */
  count?: number | null;
  /** Always hide the label, leaving the icon. */
  iconOnly?: boolean;
  /** Hide the label only on narrow screens (< 640px). */
  mobileIconOnly?: boolean;
}

const SIZES: Record<"sm" | "md", string> = {
  sm: "h-7 gap-1.5 px-2.5 text-xs",
  md: "h-8 gap-2 px-3 text-[13px]",
};

/**
 * Filter chip — the reference implementation of the kit's variant API.
 *
 * Three things that set it apart from the front-end version, and that the other primitives follow:
 *
 * 1. All states are CSS, not React. No `useState`, no mouse handlers: hover, focus-visible,
 *    disabled and press are described by pseudo-classes. The component does not re-render on
 *    cursor hover.
 * 2. No inline `style` at all. Only Tailwind utilities on top of tokens, so a theme switch works
 *    without JS.
 * 3. An explicit `:focus-visible`. The global rule in `styles.css` gives it too, but a primitive
 *    must not depend on whether the consumer included the base styles.
 */
export const Chip = forwardRef<HTMLButtonElement, ChipProps>(function Chip(
  {
    children,
    size = "md",
    tone = "accent",
    selected = false,
    icon,
    count,
    iconOnly = false,
    mobileIconOnly = false,
    className,
    type = "button",
    ...rest
  },
  ref
) {
  const t = TONE_TOKENS[tone];

  return (
    <button
      ref={ref}
      type={type}
      // A toggle button: screen readers must announce the state, not only the label.
      aria-pressed={selected}
      className={cn(
        "rounded-pill inline-flex shrink-0 cursor-pointer items-center border font-semibold",
        "transition-colors",
        "focus-visible:outline-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2",
        "disabled:pointer-events-none disabled:opacity-50",
        SIZES[size],
        selected
          ? cn(t.border, t.bg, "text-fg-0")
          : "border-line-soft text-fg-1 hover:bg-bg-2 hover:text-fg-0 bg-transparent",
        className
      )}
      {...rest}
    >
      {icon ? <span className="shrink-0 opacity-70">{icon}</span> : null}
      {/*
        The hidden label stays in the accessibility tree instead of disappearing from the markup.
        Previously `iconOnly` dropped `children` altogether, and `mobileIconOnly` hid them with
        `hidden` (`display: none`) — and both remove the node from the tree, which leaves the
        button WITHOUT A NAME. This was visible only through an audit: by eye the icon is in
        place and the chip works.

        `sr-only` hides it visually while leaving it for screen readers; `sm:not-sr-only` brings
        the label back on a wide screen. One node instead of two — a copy next to it would be
        read twice.
      */}
      {children != null ? (
        <span
          className={
            iconOnly ? "sr-only" : mobileIconOnly ? "sr-only sm:not-sr-only sm:inline" : undefined
          }
        >
          {children}
        </span>
      ) : null}
      {/*
        The counter differs from the label by weight, not by color. Its own `text-fg-3` was a
        fixed gray on top of a background that changes with the tone: on `accent-soft` it gave
        4.26, on `warning-soft` — 3.85. The inherited color passes by definition: it is the same
        as the label's, whose contrast is already verified.
      */}
      {count != null ? <span className="font-mono tabular-nums">{count}</span> : null}
    </button>
  );
});
