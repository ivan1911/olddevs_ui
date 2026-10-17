"use client";

import { Slot } from "@radix-ui/react-slot";
import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { cn } from "../../lib/cn.js";
import type { Size } from "../../lib/variants.js";

export interface CardProps extends ComponentPropsWithoutRef<"div"> {
  /** Card size (padding): `sm` or `md`. Defaults to `md`. */
  size?: Extract<Size, "sm" | "md">;
  /**
   * Render the card as a child element that can be pressed: `<button>`, `<a>`, `next/link`. Props
   * and `ref` are merged into the child — the idiom is the same as for `Button`.
   *
   * Added for a specific defect: the collection card and the category card in the front end were
   * `<div onClick>` with no role and no `tabIndex`. They were not reachable from the keyboard at
   * all, and a screen reader did not report that they could be pressed. Ten such places were
   * found in the front end.
   *
   * **`asChild` also turns on the look of a pressable element**: the cursor, the border highlight
   * on hover and the focus ring. Otherwise every consumer would add it by hand — exactly the
   * inconsistency the card exists to remove. A container card (without `asChild` and without
   * `interactive`) does not change by a single pixel.
   */
  asChild?: boolean;
  /**
   * The card is pressable, but the action lives inside it — as a stretched link
   * (`after:absolute after:inset-0`), with secondary actions next to it: a "More" menu, a favorite
   * button.
   *
   * This is a separate case from `asChild`, and one markup rule tells them apart: a button cannot
   * go inside a button, because nested interactive content is not reachable from the keyboard. So
   * a card with a menu inside cannot be a button as a whole: it stays a container, the link covers
   * its area, and the menu sits higher in the stacking order and remains a separate target.
   *
   * The idiom is not new to the kit: the `Select` pill is built the same way — an outer box, a
   * button stretched over it, and a clear button beside it, not inside it.
   *
   * The focus ring outlines the whole card only when the stretched link itself has focus
   * (`has-[a:focus-visible]`), not when any descendant does: otherwise focus on the menu would
   * outline the whole card, promising a click that would go somewhere else.
   */
  interactive?: boolean;
}

/**
 * Padding and radius move as a pair, so this is one axis, not two. The values are taken from
 * actual calls in the front end, not invented.
 */
const SIZES = {
  sm: "p-[14px] rounded-md",
  md: "p-[18px] rounded-lg",
} as const;

/**
 * The shared look of a pressable element: the cursor, and a border highlight from `border-soft`
 * to `border-default` — the same trick that was done by hand in the front end.
 */
const INTERACTIVE = "cursor-pointer transition-colors hover:border-line";

/**
 * Slot variant: the focus ring is shared with the button.
 *
 * `w-full text-left` is not cosmetic here: otherwise a `<button>` inside a grid would shrink to its
 * content and center its text, and the card would stop being a card.
 */
const AS_CHILD =
  "w-full text-left " +
  "focus-visible:outline-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2";

/** Container for a stretched link: it needs a positioning base. */
const CONTAINER =
  "relative " +
  "has-[a:focus-visible]:outline-accent-strong has-[a:focus-visible]:outline-2 " +
  "has-[a:focus-visible]:outline-offset-2";

/**
 * A panel with a border and a shadow.
 *
 * The previous version accepted `padding` and `radius` as separate numbers and substituted them
 * into an inline `style` — so it allowed any value and had no scale. Going through all 16 calls in
 * the front end showed there are exactly two steps, and both axes always change together: `18/16`
 * (12 calls) and `14/12` (4 calls, all in `SchedulePostCards.jsx`). Hence a single `size` axis
 * here.
 *
 * The values are intentionally kept exact (`p-[14px]`, not `p-3`): the move must not shift the
 * layout. Rounding to round numbers is a separate visual decision, not part of moving the
 * component into the kit.
 *
 * The `style` prop of the previous version was never passed, so it is not carried over.
 */
export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { size = "md", asChild = false, interactive = false, className, children, ...rest },
  ref
) {
  const Comp = asChild ? Slot : "div";

  return (
    <Comp
      ref={ref}
      className={cn(
        "border-line-soft bg-bg-1 border shadow-[var(--shadow-1)]",
        SIZES[size],
        (asChild || interactive) && INTERACTIVE,
        asChild && AS_CHILD,
        !asChild && interactive && CONTAINER,
        className
      )}
      {...rest}
    >
      {children}
    </Comp>
  );
});
