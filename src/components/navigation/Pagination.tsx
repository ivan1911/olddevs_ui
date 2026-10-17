"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "../../icons.js";
import { clamp } from "../../lib/clamp.js";
import { cn } from "../../lib/cn.js";
import { useMessages } from "../../i18n/useMessages.js";
import { Button } from "../actions/Button.js";

export interface PaginationProps {
  /** Current page number, counted from 1. A value outside the range is clamped to it. */
  page: number;
  /** Total number of pages. With a value of 1 or less, the component renders nothing. */
  pageCount: number;
  /** Called with the number of the page the user moved to, by a number or by an arrow. */
  onChange: (page: number) => void;
  /** How many pages to show on each side of the current page. */
  siblings?: number;
  /** Extra classes on the `nav`. */
  className?: string;
  /** Accessible name of the navigation. By default it comes from the message catalog. */
  "aria-label"?: string;
}

/**
 * Range of pages to show.
 *
 * The algorithm is written here because "which numbers are visible" is a decision, not a detail: a list
 * of thirty numbers is useless, and a list of three does not let the user jump to the start or the end.
 *
 * The rule: the first and the last page are ALWAYS visible; around the current page there are `siblings`
 * neighbors on each side; the gaps between these groups collapse into an ellipsis. The ellipsis is drawn
 * only when MORE than one page is hidden behind it: "1 … 3 4 5" instead of "1 2 3 4 5" misstates the
 * length and saves exactly nothing.
 *
 * The width of the row stays constant: `2×siblings + 5` cells, and on a short range as many cells as
 * there are pages in total. Buttons under the pointer do not jump when moving to a neighboring page.
 */
export function pageRange(page: number, pageCount: number, siblings: number): (number | "gap")[] {
  const first = 1;
  const last = pageCount;
  /*
    The window is PADDED out to a constant width on the side that has room.

    Without this, the row went 4→5→6→7→7→6→5→4 with `siblings=1` and ten pages, and the step 4→5 moved
    the "5" button to the left: a repeated click at the same spot on screen landed on "4". The doc comment
    promised a constant width, but only the maximum was constant.

    The width is COUNTED FROM THE FINISHED ROW, not derived with a formula: the end pages and the ellipses
    take either one cell or two (it is cheaper to show exactly one skipped page than to hide it), and
    arithmetic "by eye" gets this wrong.
  */
  const width = Math.min(2 * siblings + 5, pageCount);
  /*
    The page is CLAMPED here, not only in the component.

    The function is exported (`index.ts`), and calling it directly is an expected scenario: a consumer
    builds its own row and takes `?page=` from the address. The padding step is one at a time, so with a
    page outside the range the loop ran `page − pageCount` iterations, each building an array: `page=1e9`
    never finished, and the tab hung. Clamping in the component did not help, because it runs lower in
    the stack.
  */
  const current = clamp(page, first, last);
  let from = Math.max(first, current - siblings);
  let to = Math.min(last, current + siblings);

  while (build(from, to, first, last).length < width && (from > first || to < last)) {
    if (to < last) to += 1;
    else from -= 1;
  }
  // The last step may have overshot the target: a cell at the edge adds two at once (the page and the
  // ellipsis). In that case we step back.
  if (build(from, to, first, last).length > width) {
    if (to > Math.min(last, page + siblings)) to -= 1;
    else if (from < Math.max(first, page - siblings)) from += 1;
  }

  return build(from, to, first, last);
}

/** The row of cells for a finished window. Pulled out so that the width can be measured. */
function build(from: number, to: number, first: number, last: number): (number | "gap")[] {
  const out: (number | "gap")[] = [];

  if (from > first) {
    out.push(first);
    // Showing exactly one skipped page is cheaper than hiding it.
    if (from === first + 2) out.push(first + 1);
    else if (from > first + 1) out.push("gap");
  }

  for (let p = from; p <= to; p++) out.push(p);

  if (to < last) {
    if (to === last - 2) out.push(last - 1);
    else if (to < last - 1) out.push("gap");
    out.push(last);
  }

  return out;
}

/**
 * Page navigation (pagination).
 *
 * **With one page nothing is rendered.** Pagination with a single "1" button is not navigation but clutter
 * in the layout: it signals that a move is possible where there is nowhere to move.
 *
 * Built by hand rather than on react-aria: there is no ready-made component there, and all that is needed
 * is a `nav`, a list of buttons and `aria-current`. No keyboard logic of its own appears here: the buttons
 * are reached with the ordinary Tab.
 */
export function Pagination({
  page,
  pageCount,
  onChange,
  siblings = 1,
  className,
  "aria-label": ariaLabel,
}: PaginationProps) {
  const messages = useMessages();
  if (pageCount <= 1) return null;

  /*
    A page outside the range is a normal case: a filter narrowed the results, and the page number stayed.
    Without clamping, the row degraded to "1 …" with no current page at all, and "previous" led to a page
    that does not exist.
  */
  const current = clamp(page, 1, pageCount);
  const range = pageRange(current, pageCount, siblings);

  return (
    <nav
      aria-label={ariaLabel ?? messages.pagination.label}
      className={cn("flex items-center gap-1", className)}
    >
      <Button
        size="sm"
        iconOnly
        icon={<ChevronLeftIcon size={16} />}
        aria-label={messages.pagination.previous}
        disabled={current <= 1}
        onClick={() => onChange(current - 1)}
      />

      {range.map((item, index) =>
        item === "gap" ? (
          // The ellipsis is not a button: there is nothing to press, and a button would promise an action. For
          // screen readers it is hidden: they know the page count anyway.
          <span key={`gap-${index}`} aria-hidden className="text-fg-3 px-1 text-sm">
            …
          </span>
        ) : (
          <Button
            key={item}
            size="sm"
            variant={item === current ? "solid" : "ghost"}
            tone={item === current ? "accent" : "neutral"}
            // `aria-current` instead of `aria-selected`: a page is a place, not an item selected from a set.
            aria-current={item === current ? "page" : undefined}
            onClick={() => onChange(item)}
          >
            {item}
          </Button>
        )
      )}

      <Button
        size="sm"
        iconOnly
        icon={<ChevronRightIcon size={16} />}
        aria-label={messages.pagination.next}
        disabled={current >= pageCount}
        onClick={() => onChange(current + 1)}
      />
    </nav>
  );
}
