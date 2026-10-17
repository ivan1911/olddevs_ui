"use client";

import type { ReactNode } from "react";
import { cn } from "../../lib/cn.js";

export interface DescriptionItem {
  /** Property label (the `dt` term). */
  label: ReactNode;
  /** Property value (the `dd` description). */
  value: ReactNode;
}

export interface DescriptionListProps {
  /** Label–value pairs, in display order. */
  items: DescriptionItem[];
  /**
   * Layout on a wide screen.
   *
   * `columns` puts the label on the left and the value on the right; `stack` puts the value
   * under the label. On a NARROW screen both stack regardless of the prop: two columns at
   * 360 pixels mean the label is squeezed down to a single word and the value wraps letter
   * by letter.
   */
  layout?: "columns" | "stack";
  /** Classes for the root element. */
  className?: string;
}

/**
 * A "property — value" list: file metadata, campaign parameters.
 *
 * The markup is a `dl` with `dt`/`dd` pairs, not a table and not two columns of divs: the
 * link between a label and its value is semantic here, and a screen reader reads the pair
 * as a whole. A table would declare rows and columns that do not really exist.
 */
export function DescriptionList({ items, layout = "columns", className }: DescriptionListProps) {
  return (
    <dl className={cn("m-0 flex flex-col gap-2", className)}>
      {items.map((item, index) => (
        <div
          key={index}
          className={cn(
            "flex gap-1",
            layout === "columns"
              ? // Stacked on narrow screens, two columns from `sm`. The threshold is shared
                // with `Drawer`: below it, the column layout stops being readable.
                "flex-col sm:flex-row sm:items-baseline sm:gap-3"
              : "flex-col"
          )}
        >
          <dt
            className={cn(
              "text-fg-2 text-caption",
              layout === "columns" && "sm:w-[140px] sm:shrink-0"
            )}
          >
            {item.label}
          </dt>
          <dd className="text-fg-1 m-0 min-w-0 text-sm break-words">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
