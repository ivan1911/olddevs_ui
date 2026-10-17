"use client";

import type { ComponentPropsWithoutRef } from "react";
import { cn } from "../../lib/cn.js";

export interface ScrollAreaProps extends ComponentPropsWithoutRef<"div"> {
  /** Scroll direction: `vertical` or `horizontal`. Defaults to `vertical`. */
  orientation?: "vertical" | "horizontal";
  /**
   * Accessible name of the area.
   *
   * Set it where the scrollable part is a self-contained part of the screen: a list of items,
   * a filter panel. Without a name the area stays a plain scrollable block. That is valid and
   * no worse: a `role="region"` without a name is announced by a screen reader only by its
   * role: "region".
   */
  label?: string;
}

/**
 * A scrollable area with a styled scrollbar.
 *
 * Built in-house, not a dependency. `@radix-ui/react-scroll-area` replaces the native scrolling
 * with its own: it draws the scrollbar with divs and computes the position in JS. That gives the
 * same look in every browser, but it takes away touchpad scroll momentum, `scroll-behavior`,
 * find-in-page and Shift+wheel scrolling. The kit takes behavior from a library only where its
 * own version would amount to a second library (see ADR-0005), and here the native behavior
 * already exists and is better.
 *
 * The scrollbar is styled with WebKit pseudo-elements and with `scrollbar-*` in Firefox. In
 * browsers where neither works, the system scrollbar stays: that is a difference in looks, not
 * a bug.
 */
export function ScrollArea({
  orientation = "vertical",
  label,
  className,
  children,
  ...rest
}: ScrollAreaProps) {
  return (
    <div
      /*
        `tabIndex={0}` is required, and this is not a matter of taste: a scrollable block that
        keyboard users cannot reach is a violation that axe catches with the
        `scrollable-region-focusable` rule. Without focus, the content of the area is
        unavailable to anyone who does not use a mouse.
      */
      tabIndex={0}
      role={label ? "region" : undefined}
      aria-label={label}
      className={cn(
        "focus-visible:outline-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2",
        orientation === "vertical" ? "overflow-y-auto" : "overflow-x-auto",
        // Firefox: two properties, that is all.
        "[scrollbar-width:thin] [scrollbar-color:var(--border-default)_transparent]",
        // WebKit: scrollbar, track, thumb.
        "[&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar]:w-2",
        "[&::-webkit-scrollbar-track]:bg-transparent",
        "[&::-webkit-scrollbar-thumb]:bg-line [&::-webkit-scrollbar-thumb]:rounded-full",
        "[&::-webkit-scrollbar-thumb:hover]:bg-fg-4",
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
