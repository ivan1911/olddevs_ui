"use client";

import { useEffect, useRef, type RefObject } from "react";
import type { Key, Selection } from "react-aria-components";
import { toPixels } from "../../hooks/useStickyOffset.js";

export interface DragToSelectOptions {
  /** The gesture is enabled: `dragToSelect` and multiple selection. */
  enabled: boolean;
  /** The order of cells in the collection: the range is computed from it, not from the screen. */
  order: readonly Key[];
  /** What scrolls at the edge: the grid's own area or the window. */
  scroll: "container" | "window";
  /** The sticky header height variable: the top edge of the viewport for autoscroll. */
  offsetVar: string;
  /** The current selection: the base that the gesture adds its range to. */
  selection: () => Selection;
  /** The new set: the previous selection plus the range from the gesture's first cell to the current one. */
  onChange: (keys: Selection) => void;
}

/** How long the finger must stay still before the gesture becomes a selection. */
const HOLD_MS = 300;
/** A move before the hold, after which it is a scroll rather than a gesture. */
const SLOP_PX = 8;
/** The strip at the edge where autoscroll starts. */
const EDGE_PX = 56;
/** The largest autoscroll step per frame. */
const MAX_STEP_PX = 18;

/**
 * Drag-to-select by finger across the grid's cells.
 *
 * OUR OWN, NOT react-aria: react-aria has no such gesture (ADR-0028, addendum). Selection stays
 * an axis of the grid: the gesture only reports the new set through the same `onSelectionChange`.
 *
 * ON TOUCH EVENTS, NOT POINTER EVENTS. As soon as the browser starts scrolling, it sends
 * `pointercancel`, and the gesture is cut short. The only way to stop the scroll is
 * `preventDefault` on `touchmove`, which needs a non-passive touch listener.
 *
 * IT DOES NOT COMPETE WITH THE LONG-PRESS MENU. Holding only arms the gesture (300 ms; the Radix
 * menu waits 700 ms), and the selection starts when the finger moves on to another cell. A finger
 * that stays in place gets the menu.
 *
 * THE START OF THE GESTURE CANCELS THE PRESS with a `pointercancel` event on the element where the
 * touch began. The press would not cancel by itself: during a touch, `pointermove` goes to the cell
 * under the finger, not to the starting one, so the Radix menu timer (which is cleared on
 * `pointermove` of the starting trigger) would open the menu in the middle of the drag, and the
 * cell's `usePress` would treat the release as a click. One event stops both.
 */
export function useDragToSelect(
  gridRef: RefObject<HTMLElement | null>,
  options: DragToSelectOptions
): void {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid || !options.enabled) return;

    let timer = 0;
    let frame = 0;
    let armed = false;
    let dragging = false;
    let suppressClick = false;
    let suppressTimer = 0;
    let pointerId = -1;
    let start: { x: number; y: number; key: Key; target: EventTarget | null } | null = null;
    let last = { x: 0, y: 0 };
    let base: Set<Key> = new Set();
    let current: Key | null = null;

    // The index of each key by its string form: on every finger move and autoscroll frame,
    // without a pass over thousands of keys. Rebuilt when `order` changes (a new page).
    let indexed: readonly Key[] | null = null;
    let positions = new Map<string, number>();
    const positionOf = (key: string) => {
      const { order } = optionsRef.current;
      if (indexed !== order) {
        indexed = order;
        positions = new Map(order.map((k, i) => [String(k), i]));
      }
      return positions.get(key);
    };

    const keyAt = (x: number, y: number): Key | null => {
      const row = document.elementFromPoint(x, y)?.closest<HTMLElement>('[role="row"]');
      if (!row || !grid.contains(row) || row.dataset.key == null) return null;
      // `data-key` is a string; a collection key can be a number.
      const at = positionOf(row.dataset.key);
      return at == null ? null : optionsRef.current.order[at]!;
    };

    const apply = (key: Key) => {
      if (!start || key === current) return;
      current = key;
      const { order, onChange } = optionsRef.current;
      const from = positionOf(String(start.key)) ?? -1;
      const to = positionOf(String(key)) ?? -1;
      if (from < 0 || to < 0) return;
      const range = order.slice(Math.min(from, to), Math.max(from, to) + 1);
      onChange(new Set<Key>([...base, ...range]));
    };

    const topEdge = () => {
      if (optionsRef.current.scroll === "container") return grid.getBoundingClientRect().top;
      const raw = getComputedStyle(document.documentElement)
        .getPropertyValue(optionsRef.current.offsetVar)
        .trim();
      // `4rem` and `calc()` go through the same probe as `useStickyOffset`.
      return Number.parseFloat(toPixels(raw, "0px")) || 0;
    };

    const bottomEdge = () =>
      optionsRef.current.scroll === "container"
        ? grid.getBoundingClientRect().bottom
        : window.innerHeight;

    const autoscroll = () => {
      frame = 0;
      if (!dragging) return;
      const top = topEdge() + EDGE_PX;
      const bottom = bottomEdge() - EDGE_PX;
      let step = 0;
      if (last.y < top) step = -Math.min(MAX_STEP_PX, ((top - last.y) / EDGE_PX) * MAX_STEP_PX);
      else if (last.y > bottom)
        step = Math.min(MAX_STEP_PX, ((last.y - bottom) / EDGE_PX) * MAX_STEP_PX);
      if (step !== 0) {
        if (optionsRef.current.scroll === "container") grid.scrollTop += step;
        else window.scrollBy(0, step);
        // Other cells went past under the still finger.
        const key = keyAt(last.x, last.y);
        if (key != null) apply(key);
      }
      frame = requestAnimationFrame(autoscroll);
    };

    const reset = () => {
      window.clearTimeout(timer);
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      armed = false;
      dragging = false;
      start = null;
      current = null;
    };

    const onTouchStart = (event: TouchEvent) => {
      reset();
      suppressClick = false;
      if (event.touches.length !== 1) return;
      const touch = event.touches[0]!;
      const key = keyAt(touch.clientX, touch.clientY);
      if (key == null) return;
      start = { x: touch.clientX, y: touch.clientY, key, target: event.target };
      last = { x: touch.clientX, y: touch.clientY };
      timer = window.setTimeout(() => {
        armed = true;
      }, HOLD_MS);
    };

    const onTouchMove = (event: TouchEvent) => {
      if (!start) return;
      const touch = event.touches[0];
      if (!touch) return;
      last = { x: touch.clientX, y: touch.clientY };
      if (!armed) {
        // The finger moved before the hold: it is a scroll, not a gesture.
        if (Math.hypot(touch.clientX - start.x, touch.clientY - start.y) > SLOP_PX) reset();
        return;
      }
      event.preventDefault();
      const key = keyAt(touch.clientX, touch.clientY);
      if (!dragging) {
        if (key == null || key === start.key) return;
        dragging = true;
        start.target?.dispatchEvent(
          new PointerEvent("pointercancel", { bubbles: true, pointerId, pointerType: "touch" })
        );
        const selection = optionsRef.current.selection();
        // "All selected": the base is all keys. An empty base would narrow the selection
        // down to the drag range.
        base = new Set(selection === "all" ? optionsRef.current.order : selection);
        current = null;
        apply(start.key);
        frame = requestAnimationFrame(autoscroll);
      }
      if (key != null) apply(key);
    };

    const onTouchEnd = () => {
      if (dragging) {
        // A touch that moved usually produces no click. A flag left set would swallow the next
        // real tap (the "add to favorites" button). A synthesized click arrives right away, so
        // there is no point in waiting longer for it.
        suppressClick = true;
        window.clearTimeout(suppressTimer);
        suppressTimer = window.setTimeout(() => {
          suppressClick = false;
        }, 400);
      }
      reset();
    };

    // The pointer id is needed for cancellation: `usePress` compares it with its own.
    const rememberPointer = (event: PointerEvent) => {
      if (event.pointerType === "touch") pointerId = event.pointerId;
    };

    // A click the browser may have synthesized after the gesture is not a press.
    const swallowClick = (event: Event) => {
      if (!suppressClick) return;
      suppressClick = false;
      event.stopPropagation();
      event.preventDefault();
    };

    grid.addEventListener("touchstart", onTouchStart, { passive: true });
    grid.addEventListener("touchmove", onTouchMove, { passive: false });
    grid.addEventListener("touchend", onTouchEnd);
    grid.addEventListener("touchcancel", reset);
    // A touch cancelled before the drag starts: a long press on a cell with a menu (the grid
    // uses it to suppress react-aria's selection) or a browser scroll. The drag will not start
    // even if the finger moves later, because the person is working with the menu.
    // Only the cancellation of OUR touch counts: the starting element or the cell it is in.
    // A cancellation in a neighboring cell (a second finger) does not affect the drag.
    const disarm = (event: PointerEvent) => {
      if (event.pointerType !== "touch" || dragging || !start) return;
      const own = start.target;
      const at = event.target;
      if (at === own || (at instanceof Node && own instanceof Node && at.contains(own))) reset();
    };

    grid.addEventListener("pointerdown", rememberPointer, true);
    grid.addEventListener("pointercancel", disarm, true);
    grid.addEventListener("click", swallowClick, true);

    return () => {
      reset();
      window.clearTimeout(suppressTimer);
      grid.removeEventListener("touchstart", onTouchStart);
      grid.removeEventListener("touchmove", onTouchMove);
      grid.removeEventListener("touchend", onTouchEnd);
      grid.removeEventListener("touchcancel", reset);
      grid.removeEventListener("pointerdown", rememberPointer, true);
      grid.removeEventListener("pointercancel", disarm, true);
      grid.removeEventListener("click", swallowClick, true);
    };
  }, [gridRef, options.enabled]);
}
