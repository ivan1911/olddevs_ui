"use client";

import {
  Separator as RACSeparator,
  SeparatorContext,
  useSlottedContext,
  type SeparatorProps as RACSeparatorProps,
} from "react-aria-components";
import { cn } from "../../lib/cn.js";

export interface SeparatorProps extends Omit<RACSeparatorProps, "elementType"> {
  /** Spacing around the line. `none` when the layout around it sets the spacing. */
  spacing?: "none" | "sm" | "md";
}

const SPACING_CLASS = {
  horizontal: { none: "", sm: "my-2", md: "my-4" },
  vertical: { none: "", sm: "mx-2", md: "mx-4" },
} as const;

/**
 * A separator line.
 *
 * Based on react-aria, not drawn as `<div className="border-t">`, for exactly one reason: the
 * role. A line that separates **groups** (menu items, panel blocks) must be `role="separator"`:
 * a screen reader announces the boundary of the group with it. A line that is purely decorative
 * must be hidden from assistive technology completely.
 *
 * Telling these two cases apart is the caller's job. react-aria sets the role itself and adds
 * `aria-orientation` to a vertical line. A hand-written version almost always stops at
 * `border-t` and reports neither.
 */
export function Separator({
  orientation: orientationProp,
  spacing = "none",
  className,
  ...rest
}: SeparatorProps) {
  /*
    The orientation comes from the react-aria context when there is no prop: `Toolbar` puts the
    direction across its own axis there, so a line between groups of actions lies the right way
    without a hint. An explicit prop always beats the context. Outside a toolbar the context is
    empty, and the line is horizontal, as before.
  */
  // The hook is called unconditionally: behind `??` it would not run on every render.
  const fromContext = useSlottedContext(SeparatorContext)?.orientation;
  const orientation = orientationProp ?? fromContext ?? "horizontal";
  return (
    <RACSeparator
      orientation={orientation}
      className={cn(
        "bg-line-soft border-0",
        // The one-pixel thickness comes from the size, not from a border: a border on an element
        // with no content gives different heights in different browsers.
        orientation === "vertical" ? "h-full w-px self-stretch" : "h-px w-full",
        SPACING_CLASS[orientation][spacing],
        className
      )}
      {...rest}
    />
  );
}
