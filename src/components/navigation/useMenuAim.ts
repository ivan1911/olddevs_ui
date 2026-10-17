"use client";

import { useCallback, useEffect, useRef, type RefObject } from "react";

/*
  MENU AIM. This is the Amazon technique, described by Ben Kamens in 2013.

  The pointer moves from a category diagonally toward its flyout, and along the way it crosses the
  neighboring categories. A naive "hover opens" would switch the flyout the user is still reaching
  for. Aim looks at WHERE the pointer is moving: while it moves toward the open flyout, a
  neighboring category does not take the hover.

  The model is the same as `useSafelyMouseToSubmenu` in react-aria, so that the `Menu` submenu and
  the mega menu behave alike. The direction of the last step is compared with the sector from the
  previous point to the two corners of the flyout's near edge. A change of direction is forgiven.
  Processing is throttled to one frame. Mouse only.

  There are two deliberate deviations from react-aria:

  1. The mechanism is a DEFERRED CATEGORY SWITCH, not `pointer-events: none` on the category
     column. Disabled events suppress the highlight under the pointer and swallow a click on a
     neighboring category, but a click must open at once.
  2. The reset time is 300 ms (Kamens's value), not react-aria's 1000 ms. Its submenu is narrow and
     short. The category column is scrolled through, and a one-second wait at every stop feels like
     a stall.
*/

/** The pointer rests longer than this: the category under it opens even if it was aiming. */
export const AIM_SETTLE_MS = 300;

/** Throttling: one step per frame. More often, the direction is noisy with pixel-level jitter. */
const THROTTLE_MS = 16;

/**
 * How many consecutive "wrong" steps are forgiven. The counter rises by one for a step toward the
 * flyout and falls by one for a step away from it. The pointer is aiming while the counter is above
 * zero. Hence one random sideways move does not reset the aim, but two in a row do.
 */
const ALLOWED_INVALID_MOVES = 2;

/**
 * Vertical padding of the sector, in pixels. Without it, a pointer heading exactly for the corner of
 * the flyout would fall out of the sector on a shaky hand.
 */
const SECTOR_PADDING = 24;

interface Point {
  x: number;
  y: number;
}

/**
 * Whether the step `from → to` moves toward the flyout: the step's direction lies inside the sector
 * from `from` to the two corners of the flyout's near edge.
 *
 * A cross product, not `atan2`, gives the same sector without a break in the angle at ±π. The
 * screen's y axis points down, hence the signs.
 */
export function isMovingToward(from: Point, to: Point, rect: DOMRect, side: "left" | "right") {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx === 0 && dy === 0) return false;
  const edge = side === "right" ? rect.left : rect.right;
  // The pointer is already past the near edge: it is inside the flyout, not on the way to it.
  if (side === "right" ? from.x >= edge : from.x <= edge) return false;
  // A step horizontally away from the flyout cannot lead toward it.
  if (side === "right" ? dx <= 0 : dx >= 0) return false;
  const top = { x: edge - from.x, y: rect.top - SECTOR_PADDING - from.y };
  const bottom = { x: edge - from.x, y: rect.bottom + SECTOR_PADDING - from.y };
  const cross = (a: Point, b: Point) => a.x * b.y - a.y * b.x;
  const step = { x: dx, y: dy };
  // For the right side: a step "below" the ray to the top corner, and "above" the ray to the bottom
  // corner. For the left side the rays are mirrored, and the signs swap places.
  return side === "right"
    ? cross(top, step) >= 0 && cross(step, bottom) >= 0
    : cross(top, step) <= 0 && cross(step, bottom) <= 0;
}

const NONE = Symbol("none");

interface MenuAimOptions {
  /** The open category. `null` means there is no flyout, so there is nothing to aim at. */
  value: string | null;
  /** The flyout open now. Its rectangle is the target. */
  showcaseRef: RefObject<HTMLElement | null>;
  /** Switch the category, or close the flyout with `null`. */
  commit: (next: string | null) => void;
}

/**
 * Menu aim: decides whether to switch the category under the pointer now or defer the switch.
 *
 * `request` is called from hovering a row of the category column. If there is no flyout, or the
 * pointer is not aiming, the switch happens at once. If it is aiming, the switch is deferred. Once
 * the pointer stops aiming or stays still for `AIM_SETTLE_MS`, whatever is under it opens. If it
 * reaches the flyout, the switch is cancelled.
 *
 * The flyout's rectangle is read anew on every step rather than cached. Page scrolling and window
 * resizing do not leave it stale. The cost is one layout read per frame, and only while the flyout
 * is open.
 */
export function useMenuAim({ value, showcaseRef, commit }: MenuAimOptions) {
  const previous = useRef<Point | null>(null);
  const lastStep = useRef(0);
  const aim = useRef(0);
  const pending = useRef<string | null | typeof NONE>(NONE);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const commitRef = useRef(commit);
  commitRef.current = commit;

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  const flush = useCallback(() => {
    clearTimer();
    const next = pending.current;
    pending.current = NONE;
    if (next !== NONE) commitRef.current(next);
  }, []);

  const settleLater = useCallback(() => {
    clearTimer();
    timer.current = setTimeout(flush, AIM_SETTLE_MS);
  }, [flush]);

  // A new flyout is a new target: the previous count toward it means nothing.
  useEffect(() => {
    aim.current = 0;
    previous.current = null;
    pending.current = NONE;
    clearTimer();
  }, [value]);

  useEffect(() => clearTimer, []);

  useEffect(() => {
    if (value === null) return;
    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch" || event.pointerType === "pen") return;
      const now = Date.now();
      if (now - lastStep.current < THROTTLE_MS) return;
      lastStep.current = now;
      const point = { x: event.clientX, y: event.clientY };
      const showcase = showcaseRef.current;
      const from = previous.current;
      previous.current = point;
      if (!showcase || !from) return;

      // The pointer reached the flyout, so the deferred switch is no longer needed.
      if (event.target instanceof Node && showcase.contains(event.target)) {
        pending.current = NONE;
        clearTimer();
        return;
      }

      const rect = showcase.getBoundingClientRect();
      const side = rect.left >= from.x ? "right" : "left";
      aim.current = isMovingToward(from, point, rect, side)
        ? Math.min(aim.current + 1, ALLOWED_INVALID_MOVES)
        : Math.max(aim.current - 1, 0);

      if (pending.current === NONE) return;
      // The pointer stopped aiming, so whatever it is over now opens. Otherwise we wait for a stop
      // again: each step postpones the deadline.
      if (aim.current === 0) flush();
      else settleLater();
    };
    document.addEventListener("pointermove", onPointerMove);
    return () => document.removeEventListener("pointermove", onPointerMove);
  }, [value, showcaseRef, flush, settleLater]);

  /** The pointer is over a row of the category column: open it (`null` closes the flyout). */
  const request = useCallback(
    (next: string | null) => {
      if (next === value) {
        // Returned to the open category, so the deferred switch is cancelled.
        pending.current = NONE;
        clearTimer();
        return;
      }
      if (value === null || aim.current === 0) {
        pending.current = NONE;
        clearTimer();
        commitRef.current(next);
        return;
      }
      pending.current = next;
      settleLater();
    },
    [value, settleLater]
  );

  /** Cancel the deferred switch. A click, the keyboard, or leaving the menu decides on its own. */
  const cancel = useCallback(() => {
    pending.current = NONE;
    clearTimer();
  }, []);

  return { request, cancel };
}
