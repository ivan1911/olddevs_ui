"use client";

import type { ComponentPropsWithRef, ReactNode } from "react";
import { cn } from "../../lib/cn.js";

export interface ButtonGroupProps extends ComponentPropsWithRef<"div"> {
  /** Buttons. Plain `Button` elements; the group does not impose its own look on them. */
  children?: ReactNode;
  /**
   * Direction of the row: `horizontal` — in a line, `vertical` — in a column.
   * Defaults to `horizontal`.
   */
  orientation?: "horizontal" | "vertical";
  /**
   * Accessible name of the group.
   *
   * Set it where the buttons form one decision ("View: list, tiles"). Without a name the group
   * is just a set of adjacent buttons — that is legitimate and breaks nothing.
   */
  "aria-label"?: string;
}

/**
 * A row of buttons joined into one block.
 *
 * The GROUP, not the buttons, sets the rounded corners and borders: otherwise each button would
 * have to know where it stands in the row — that is, get an "I am first" prop, which means
 * nothing when used alone.
 *
 * This is done with descendant selectors rather than classes on the children, so it works with
 * any content: a plain button, `iconOnly`, a link-button via `asChild`. Neighbors get the shared
 * border trimmed (`-ml-px`), so that the double border between buttons does not look thicker
 * than the outer one.
 *
 * `role="group"` is set only together with a name: an unnamed group is an extra announcement
 * for screen readers with nothing to follow it.
 */
export function ButtonGroup({
  children,
  orientation = "horizontal",
  className,
  ...rest
}: ButtonGroupProps) {
  const horizontal = orientation === "horizontal";

  return (
    <div
      role={rest["aria-label"] ? "group" : undefined}
      className={cn(
        "inline-flex",
        horizontal ? "flex-row" : "flex-col",
        // Inner corners are cut, outer ones stay.
        horizontal
          ? "[&>*:not(:first-child)]:-ml-px [&>*:not(:first-child)]:rounded-l-none [&>*:not(:last-child)]:rounded-r-none"
          : "[&>*:not(:first-child)]:-mt-px [&>*:not(:first-child)]:rounded-t-none [&>*:not(:last-child)]:rounded-b-none",
        // A button under the cursor or in focus is raised above its neighbors: otherwise its
        // border and focus ring would be overlapped by the neighboring one, and the highlight
        // would look clipped on one side.
        "[&>*:focus-visible]:relative [&>*:focus-visible]:z-10 [&>*:hover]:relative [&>*:hover]:z-10",
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
