"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface StickyOffsetOptions {
  /**
   * The name of the CSS variable in which the application publishes the height of its top
   * bar. A prop, not a constant: the package does not know whether the consumer has a header,
   * what it is called, or whether it exists at all ([ADR-0016]).
   */
  offsetVar?: string;
  /** The offset used when the variable is absent. This is a legitimate state, not an error. */
  fallback?: string;
}

export interface StickyOffset {
  /**
   * Attached to an empty zero-height block placed **right before** the sticky element.
   * The intersection of exactly this block is what means the bar has settled in place.
   *
   * A callback ref, not an object: the bar is sometimes conditional and appears after the
   * page itself, and an effect on mount simply never sees such a marker.
   */
  sentinelRef: (node: HTMLElement | null) => void;
  /** The bar is stuck to the top edge. */
  isStuck: boolean;
}

/**
 * An offset with its sign flipped.
 *
 * You CANNOT do this by prefixing a minus sign to the string: the published value can itself
 * be negative, and `-` + `-10px` gave `--10px`, a `SyntaxError` in the observer constructor,
 * which took down the subtree. That is exactly the failure `toPixels` exists to prevent, only
 * through a different entry point.
 */
function negate(value: string): string {
  return value.startsWith("-") ? value.slice(1) : `-${value}`;
}

/**
 * Converts a published length to pixels.
 *
 * `IntersectionObserver` accepts ONLY pixels and percentages and throws a `SyntaxError` on
 * anything else. The value went into `rootMargin` as is, and the kit nowhere requires the
 * application to publish its height in pixels: `--topbar-h: 4rem` took the bar and the whole
 * subtree down during commit.
 *
 * Units the browser understands on its own pass through without any work. Others are measured
 * with a one-off element. Measuring has to happen in the document, because there is no layout
 * outside it. The caller must filter out a repeat BEFORE calling (see `rawRef`): a measurement
 * costs two forced layout recalculations.
 *
 * Deliberately accepted limits: `em` is measured against the `body` font, not the top bar's
 * font. A negative value in unknown units is discarded by the browser and becomes `0px` (in
 * pixels the sign is kept).
 */
export function toPixels(value: string, fallback: string): string {
  const raw = value || fallback;
  // An empty string gets here when the consumer passed an empty `fallback`: the prop type
  // does not forbid it. Without normalization, a `rootMargin` like `"- 0px 0px 0px"` would
  // come out, which is exactly the crash this function exists to prevent, only through a
  // different entry point.
  if (raw === "") return "0px";
  // A number, not `[\d.]+`: that class accepts `1.2.3` and `..`, so it would let through a
  // value the browser rejects without measuring it, and the crash would come back the same way
  // it came in with `4rem`.
  if (/^-?(\d+(\.\d+)?|\.\d+)(px|%)$/.test(raw)) return raw;

  const probe = document.createElement("div");
  // `setProperty`, not `cssText`: the value comes from the application's CSS, and its own
  // declarations inside it would overwrite the probe's protective properties.
  probe.style.position = "absolute";
  probe.style.visibility = "hidden";
  probe.style.pointerEvents = "none";
  probe.style.setProperty("height", raw);
  document.body.appendChild(probe);
  const px = probe.getBoundingClientRect().height;
  probe.remove();
  return Number.isFinite(px) ? `${px}px` : fallback || "0px";
}

/**
 * Sticky bar: knows whether it has already stuck to the application's top bar.
 *
 * The offset is measured from the ACTUAL height of the bar, not from a hard-coded number: on
 * narrow screens the header is shorter than on wide ones, and a constant leaves a gap through
 * which the scrolling content shows. The application publishes the height in a CSS variable,
 * whose name is a prop here. The decision and the rejected alternatives are in [ADR-0016].
 *
 * Consumers usually use `isStuck` to remove the top rounded corners: at the seam, a stuck
 * bar's corners would expose the page background.
 */
export function useStickyOffset({
  offsetVar = "--topbar-h",
  fallback = "0px",
}: StickyOffsetOptions = {}): StickyOffset {
  const [isStuck, setIsStuck] = useState(false);
  const nodeRef = useRef<HTMLElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  /** The last applied offset. There is no point recreating the observer for the same number. */
  const appliedRef = useRef<string | null>(null);
  /** The raw value of the variable that this offset was derived from. */
  const rawRef = useRef<string | null>(null);

  const connect = useCallback(() => {
    const node = nodeRef.current;
    if (!node) return;
    // The absence of the API is a legitimate state, not an error: the server has no such
    // API at all, and a consumer's jsdom tests do not stub it. The bar simply never counts
    // as stuck.
    if (typeof IntersectionObserver === "undefined") return;

    /*
      Compare the RAW string first, before any work.

      The check used to sit after `toPixels`, which contradicted its own comment ("only when the
      value changes"): the root's `getComputedStyle` and the probe loop were paid on every call.
      And there are many calls. Changes to the root's `style` wake the observer: `usePreventScroll`
      from react-aria (it writes `overflow` and `padding-right` when ANY overlay opens, which is
      half the kit), the application's theme switcher, and the `--vh` polyfill. With `4rem` this
      meant two forced layout recalculations on every such wake-up.
    */
    const raw = getComputedStyle(document.documentElement).getPropertyValue(offsetVar).trim();
    if (raw === rawRef.current && observerRef.current) return;
    rawRef.current = raw;

    const offset = toPixels(raw, fallback);
    if (offset === appliedRef.current && observerRef.current) return;

    observerRef.current?.disconnect();
    appliedRef.current = offset;
    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        if (entry) setIsStuck(!entry.isIntersecting);
      },
      { rootMargin: `${negate(offset)} 0px 0px 0px` }
    );
    observerRef.current.observe(node);
  }, [offsetVar, fallback]);

  const sentinelRef = useCallback(
    (node: HTMLElement | null) => {
      nodeRef.current = node;
      if (node) {
        connect();
        return;
      }
      observerRef.current?.disconnect();
      observerRef.current = null;
      appliedRef.current = null;
      rawRef.current = null;
      setIsStuck(false);
    },
    [connect]
  );

  useEffect(() => {
    /*
      Rebuilding is reduced to at most one per frame.

      The `resize` handler was `connect` itself, which makes a synchronous `getComputedStyle` of
      the root (a forced style recalculation) and runs a full observer lifecycle. Dragging a window
      edge with the mouse fires dozens of events per second, and each new observer delivered its
      initial callback, so the rounded corners of the sticky bar jittered. Besides, the variable's
      value is almost always the same during a drag: the height changes at a breakpoint, not on
      every pixel.
    */
    let frame = 0;
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        connect();
      });
    };

    window.addEventListener("resize", schedule);

    /*
      The window width is NOT ENOUGH. The paired side of the contract (`TopBar`) publishes its
      height through a `ResizeObserver`, and its comment names causes unrelated to the width:
      content wrapping in the slots and a second row in search. The header becomes two lines,
      `--topbar-h` goes from 56 to 96, but `rootMargin` stayed the same, so the bar considered
      itself stuck 40px before it actually was.

      We observe not the header (this hook knows nothing about it, ADR-0016) but the root's `style`
      attribute: that is exactly where the variable gets published.
    */
    const mutations =
      typeof MutationObserver === "undefined" ? null : new MutationObserver(schedule);
    mutations?.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["style"],
    });

    /*
      The observer is set up HERE, not only from the callback ref.

      Changing `offsetVar` changes the identity of `connect`, and with it of `sentinelRef`. React
      detaches the old ref (nulling the refs) and attaches the new one, which creates a live
      observer. ONLY AFTER THAT does it run the cleanup of the old passive effect, which disconnects
      that very fresh observer. While `connect` had no guards, the next `resize` recreated it
      unconditionally, so the failure healed itself. The guards by value (above) removed that safety
      net: a dead but not nulled `observerRef` looks alive to them, and the bar froze FOREVER.
    */
    connect();

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedule);
      mutations?.disconnect();
      observerRef.current?.disconnect();
      // The reset is the same as in the branch that handles node detachment. Otherwise the
      // guards take a disconnected observer for a live one.
      observerRef.current = null;
      appliedRef.current = null;
      rawRef.current = null;
    };
  }, [connect]);

  return { sentinelRef, isStuck };
}
