"use client";

import type { ReactNode } from "react";
import { CloseIcon } from "../../icons.js";
import { cn } from "../../lib/cn.js";
import { useMessages } from "../../i18n/useMessages.js";
import { useStickyOffset } from "../../hooks/useStickyOffset.js";
import { BUTTON_ICON_SIZE } from "../../lib/button.js";

export interface SelectionBarProps {
  /** How many objects are selected. At zero the bar is not rendered at all. */
  count: number;
  /**
   * Count label. The default is "Selected N". Supply your own where the count is in domain units
   * ("12 wallpapers selected"): the word has to agree with the number.
   */
  countLabel?: (count: number) => ReactNode;
  /**
   * Called when the user clears the selection. The button sits to the left of the count and is
   * drawn as a "×" icon. Without a handler there is no button.
   */
  onClear?: () => void;
  /** Actions on the selection, usually `Button size="sm"`. */
  children?: ReactNode;
  /**
   * The right edge of the bar: "Select all", a help link. It is separate from `children` because
   * it lives on the other side of the spacer, and on a narrow screen it moves to the first row,
   * next to the count.
   */
  secondary?: ReactNode;
  /**
   * Stick below the app's top bar. Turn this off where the bar sits in an area without scrolling.
   */
  sticky?: boolean;
  /**
   * The name of the CSS variable with the height of the top bar. See `useStickyOffset` and
   * ADR-0016.
   *
   * One name serves both halves of stickiness: it drives the sticking point (`top`) and the moment
   * the bar loses its top rounded corners. If they drifted apart, the bar would stick to one top
   * bar while its corners were cut off by another.
   */
  offsetVar?: string;
  /** Accessible name of the action group. */
  "aria-label"?: string;
  /** Extra classes on the bar. */
  className?: string;
}

/** Default shared with `useStickyOffset`: this is the name the consumer uses for the variable. */
const DEFAULT_OFFSET_VAR = "--topbar-h";

const PANEL =
  "border-line z-20 mb-4 flex flex-col gap-2 border p-[10px_14px] backdrop-blur-md " +
  "shadow-[var(--shadow-1)] sm:flex-row sm:items-center sm:gap-[14px]";

/**
 * Mass-action bar: "Selected 12" and what can be done with the selection.
 *
 * The frontend had three of these bars, and they had drifted apart: different shadows (`shadow-1`
 * vs `shadow-2`), different radii (14 vs 12), and the third was built from inline styles with a
 * hard-coded `rgba(47,139,230,0.07)` instead of a token. One and the same thing in three forms is
 * exactly the case a design system exists for.
 *
 * TWO SLOTS, NOT ONE. `children` are the actions, `secondary` is the right edge ("Select all").
 * The split is not cosmetic: actions take all the free space and push `secondary` to the right
 * edge, while on a narrow screen `secondary` moves up, next to the count, and the actions wrap
 * onto a second row. A single slot cannot express this.
 *
 * STICKINESS IS MEASURED FROM THE ACTUAL HEIGHT OF THE TOP BAR the app publishes (`--topbar-h` by
 * default; the variable name is a prop). A hard-coded number left a gap: on narrow screens the top
 * bar is taller. When stuck, the bar loses its top rounded corners, otherwise they expose the page
 * background as small corners at the joint. The contract and the rejected options are in ADR-0016.
 *
 * The bar is declared as a group with an accessible name: for screen readers it is the set of
 * actions on the selection, not random buttons in the middle of the page. The counter comes first
 * and is read together with the group name.
 */
export function SelectionBar({
  count,
  countLabel,
  onClear,
  children,
  secondary,
  sticky = true,
  offsetVar = DEFAULT_OFFSET_VAR,
  "aria-label": ariaLabel,
  className,
}: SelectionBarProps) {
  const messages = useMessages();
  const label = countLabel ?? ((n: number) => messages.selectionBar.count({ count: n }));
  const { sentinelRef, isStuck } = useStickyOffset({ offsetVar });

  if (count <= 0) return null;

  return (
    <>
      {/* Zero-height marker: its intersection means the bar has settled in place. It is a
          separate node because the bar itself is already sticky and never leaves the flow. */}
      {sticky ? <div ref={sentinelRef} aria-hidden="true" style={{ height: 0 }} /> : null}

      <div
        role="group"
        aria-label={ariaLabel ?? messages.selectionBar.label}
        className={cn(PANEL, sticky && "sticky", className)}
        style={{
          top: sticky ? `var(${offsetVar}, 0px)` : undefined,
          background: "var(--topbar-bg)",
          borderRadius: sticky && isStuck ? "0 0 14px 14px" : "14px",
          transition: "border-radius 120ms ease",
        }}
      >
        <div className="flex items-center justify-between gap-2 sm:shrink-0">
          <div className="flex items-center gap-2.5 whitespace-nowrap">
            {onClear ? (
              <button
                type="button"
                onClick={onClear}
                aria-label={messages.selectionBar.clearSelection}
                className="text-fg-1 hover:text-fg-0 focus-visible:outline-accent-strong flex cursor-pointer items-center focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                <CloseIcon size={BUTTON_ICON_SIZE.md} />
              </button>
            ) : null}
            <span className="text-[13px] font-semibold">{label(count)}</span>
          </div>
          {secondary ? <span className="sm:hidden">{secondary}</span> : null}
        </div>

        <span className="bg-line hidden h-[22px] w-px sm:block" />

        {/*
          Actions form their own wrapping row, which takes all the space between the counter and
          the right edge. Before, at `sm`, the wrapper was `contents`, and the buttons went into the
          bar's shared row without wrapping: at medium widths flex squeezed them below the label,
          the labels broke onto two lines, and the icons were flattened. In a wrapping row an
          element does not shrink while it fits whole, and the extra buttons drop lower. The gap
          between buttons is the bar's former 14 px, and between rows it is 8.
        */}
        <div className="flex flex-wrap items-center gap-2 sm:min-w-0 sm:flex-1 sm:gap-x-[14px]">
          {children}
        </div>

        {secondary ? <span className="hidden whitespace-nowrap sm:block">{secondary}</span> : null}
      </div>
    </>
  );
}
