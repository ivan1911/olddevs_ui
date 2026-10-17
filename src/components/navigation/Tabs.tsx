"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "../../lib/cn.js";

export interface TabItem {
  /** Tab identifier. `value` is matched against it, and `{id}-panel` is built from it for `aria-controls`. */
  id: string;
  /** Tab label. */
  label: string;
  /** Icon to the left of the label; hidden from screen readers. */
  icon?: ReactNode;
}

export interface TabsProps {
  /** Tabs, in order. */
  items: TabItem[];
  /** The `id` of the active tab. The component is controlled: the consumer owns the state. */
  value: string;
  /** Called with the tab's `id` on a click and on arrow, Home and End navigation. */
  onChange: (id: string) => void;
  /**
   * `vertical` is a sidebar (a column, arrows ↑↓); `horizontal` is a scrolling strip (arrows ←→).
   * The component renders only the tabs. Panels, their markup, and the responsive layout are the
   * consumer's job.
   */
  orientation?: "vertical" | "horizontal";
  /** Extra classes on the tab strip. */
  className?: string;
}

/**
 * Tab strip. Controlled-only: the one consumer already keeps the active tab in its own state, and
 * an uncontrolled mode would be speculative code.
 *
 * Selection follows focus (automatic activation): panels render instantly here, so there is no
 * reason to wait for a separate Enter after an arrow. Focus moves through a roving tabindex, so
 * Tab reaches only the active tab and the arrows move on from there. Edges do not wrap, as
 * everywhere in the kit.
 *
 * `aria-controls` is set ONLY on the selected tab and points to `{id}-panel`. Consumers render a
 * panel only for the active tab, so a reference from the others would point to an element missing
 * from the markup. That is an invalid attribute value, and the axe audit flags it as `critical`.
 * The specification allows this omission explicitly for exactly this case.
 *
 * The content container on the consumer's side must have `id={`${value}-panel`}` and
 * `role="tabpanel"`.
 */
export function Tabs({ items, value, onChange, orientation = "horizontal", className }: TabsProps) {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const vertical = orientation === "vertical";

  const moveTo = (index: number) => {
    const clamped = Math.max(0, Math.min(index, items.length - 1));
    const item = items[clamped];
    if (!item) return;
    tabRefs.current[clamped]?.focus();
    if (item.id !== value) onChange(item.id);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const current = items.findIndex((t) => t.id === value);
    const prevKey = vertical ? "ArrowUp" : "ArrowLeft";
    const nextKey = vertical ? "ArrowDown" : "ArrowRight";

    switch (e.key) {
      case prevKey:
        e.preventDefault();
        moveTo(current - 1);
        return;
      case nextKey:
        e.preventDefault();
        moveTo(current + 1);
        return;
      case "Home":
        e.preventDefault();
        moveTo(0);
        return;
      case "End":
        e.preventDefault();
        moveTo(items.length - 1);
        return;
    }
  };

  return (
    <div
      role="tablist"
      aria-orientation={orientation}
      onKeyDown={onKeyDown}
      className={cn(vertical ? "flex flex-col gap-px" : "flex gap-0.5 overflow-x-auto", className)}
    >
      {items.map((item, index) => {
        const selected = item.id === value;
        return (
          <button
            key={item.id}
            ref={(el) => {
              tabRefs.current[index] = el;
            }}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={selected ? `${item.id}-panel` : undefined}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.id)}
            className={cn(
              "flex cursor-pointer items-center rounded-lg",
              vertical
                ? "gap-2.5 px-3 py-[9px] text-left text-[13px]"
                : "shrink-0 gap-1.5 px-3 py-1.5 text-[12px] whitespace-nowrap",
              "focus-visible:outline-accent-strong focus-visible:outline-2 focus-visible:-outline-offset-2",
              selected
                ? "border-line-soft bg-bg-2 text-fg-0 border font-semibold"
                : "text-fg-2 border border-transparent font-medium"
            )}
          >
            {item.icon ? (
              <span aria-hidden className={cn("flex", selected ? "text-accent" : "text-fg-3")}>
                {item.icon}
              </span>
            ) : null}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
