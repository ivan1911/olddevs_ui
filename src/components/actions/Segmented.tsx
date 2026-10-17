"use client";

import type { ReactNode } from "react";
import { cn } from "../../lib/cn.js";
import { hasContent } from "../../lib/empty.js";
import { Tooltip } from "../overlays/Tooltip.js";

export interface SegmentedOption<T extends string = string> {
  /** Segment value: it arrives in `onChange` and is compared with the toggle's `value`. */
  value: T;
  /** Segment label. An empty string counts as no label. */
  label?: ReactNode;
  /** Icon before the label. */
  icon?: ReactNode;
  /**
   * Tooltip on hover over the segment, and the accessible name of a segment without a label.
   *
   * **Required if the segment has no label** — it becomes the accessible name. Both `undefined`
   * and an empty string count as having no label.
   */
  tooltip?: string;
  /** Disabled segment: the mode exists, but it cannot be applied right now. */
  disabled?: boolean;
}

export interface SegmentedProps<T extends string = string> {
  /** Value of the selected segment: the toggle is controlled and keeps no state of its own. */
  value: T;
  /** Called with the value of the segment that was pressed. */
  onChange: (value: T) => void;
  /** Segments in order, left to right. */
  options: SegmentedOption<T>[];
  /**
   * On a narrow screen (< 640 pixels) a segment keeps only its icon: the label is only visually
   * hidden and remains the button's accessible name.
   *
   * A property of the whole toggle, not of a single segment: a row where some tabs have words and
   * others do not would change width on switching, and the buttons would jump under the finger.
   *
   * The breakpoint is the same `sm` as `Chip.mobileIconOnly`. It is not exposed outward: two
   * consumers with different breakpoints would drift apart in behavior for no reason.
   *
   * `tooltip` does NOT become required here. The requirement "a segment without a label must
   * have a tooltip" applies to a genuinely missing label (`label: ""`); here the label exists,
   * it is just not visible.
   */
  mobileIconOnly?: boolean;
}

/**
 * A toggle of several segments — list view, search mode, date range.
 *
 * The selected segment is marked with `aria-pressed`, not only by its background. The previous
 * version in the front end distinguished the state by color alone: to a screen reader all segments
 * looked like identical unnamed buttons, and it was impossible to tell which one was on. This is
 * the same defect the theme switcher had.
 *
 * Segments without a label (icon only) MUST have a `tooltip` — it also gives the accessible name
 * through `aria-label`. Without it the button stays unnamed, and the axe audit fails the run as
 * `critical`. An empty string does not count as a label: `label: ""` next to an icon means
 * "icon only".
 *
 * `mobileIconOnly` is DIFFERENT: the label stays, it is just not visible on a narrow screen. The
 * button's name then comes from the label itself, and a tooltip is not needed — which is why the
 * mode lives in the kit rather than being assembled by the consumer. Hiding the label correctly
 * is one line of classes, while doing it wrong gives three ways to get a button without a name
 * that only an audit can see.
 */
export function Segmented<T extends string = string>({
  value,
  onChange,
  options,
  mobileIconOnly = false,
}: SegmentedProps<T>) {
  return (
    /*
      `flex-wrap` is BEHAVIOR, NOT TASTE. A segment does not shrink (`shrink-0` plus
      `whitespace-nowrap`, and this is correct: a squeezed tab label reads worse than a wrapped
      one). Without wrapping, the only outcome on a narrow screen is overflowing the edge and
      horizontal scrolling, which is a violation of WCAG 1.4.10 for every consumer.

      The gap is split by axis: 2 pixels between segments, 4 between rows. A single `gap-0.5` on
      both axes would put rows at the same 2 pixels, and two rows would read as one glued grid
      rather than as one control.
    */
    <div className="border-line-soft bg-bg-2 rounded-control inline-flex flex-wrap gap-x-0.5 gap-y-1 border p-[3px]">
      {options.map((opt) => {
        const selected = value === opt.value;
        /*
          THE LABEL IS HIDDEN ONLY ON A SEGMENT WITH AN ICON.

          On a segment without an icon, hiding the label serves no purpose: the button would stay
          empty — the name exists, nothing is on screen. That is worse than an uneven row with a
          single word: an empty button is not pressed, and it cannot be seen.

          The mode nonetheless stays a property of the whole toggle — here it is not the
          consumer's choice but a guard against a set in which the icon was forgotten.
        */
        const hideLabel = mobileIconOnly && opt.icon != null;
        const button = (
          <button
            key={opt.value}
            type="button"
            aria-pressed={selected}
            /*
              An empty string is the ABSENCE of a label, not a label.

              The check was `opt.label == null`, and a consumer who passed `label: ""` next to an
              icon (the usual way to say "icon only") got a button without a name: an empty string
              is not `null`, so the condition did not fire and `aria-label` was not set. The
              docstring promised the opposite, and the audit failed the run as `critical`.
            */
            aria-label={hasContent(opt.label) ? undefined : opt.tooltip}
            disabled={opt.disabled}
            onClick={() => onChange(opt.value)}
            className={cn(
              "inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-sm px-3 py-1.5",
              // Around a lone icon `px-3` looks wide: the button ends up noticeably wider than
              // its height and stops looking like a tab. The padding is cut together with the
              // label and under the same breakpoint.
              hideLabel && "max-sm:px-2",
              "text-xs font-semibold whitespace-nowrap transition-colors",
              "focus-visible:outline-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2",
              "disabled:pointer-events-none disabled:opacity-50",
              selected ? "bg-bg-3 text-fg-0" : "text-fg-2 hover:text-fg-0 bg-transparent"
            )}
          >
            {opt.icon}
            {/*
              The label is hidden with the "visible to screen readers only" class, not with
              `hidden` and not by dropping its children: both remove the node from the
              accessibility tree, which leaves the button WITHOUT A NAME. That would be visible
              only through an audit — by eye the icon is in place and the tab works. The same
              trick and the same single node as in `Chip`: a copy of the label next to it would
              be read twice.
            */}
            {hasContent(opt.label) ? (
              <span className={hideLabel ? "sr-only sm:not-sr-only sm:inline" : undefined}>
                {opt.label}
              </span>
            ) : null}
          </button>
        );

        // The key lives on the button itself, so the wrapper is needed only where there is a
        // tooltip: `Tooltip` accepts exactly one element, and the `key` stays on it.
        return opt.tooltip ? (
          <Tooltip key={opt.value} content={opt.tooltip}>
            {button}
          </Tooltip>
        ) : (
          button
        );
      })}
    </div>
  );
}
