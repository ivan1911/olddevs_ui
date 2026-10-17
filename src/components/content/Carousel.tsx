"use client";

import {
  Children,
  forwardRef,
  isValidElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "../../icons.js";
import { useMessages } from "../../i18n/useMessages.js";
import type { AccessibleName } from "../../lib/accessible-name.js";
import { clamp } from "../../lib/clamp.js";
import { cn } from "../../lib/cn.js";
import {
  responsiveClasses,
  type Responsive,
  type ResponsiveClassMap,
} from "../../lib/responsive.js";
import { Button } from "../actions/Button.js";

/**
 * How many slides are visible at once. A closed set: a class for each value is written out in the
 * dictionary.
 */
export type CarouselSlidesPerView = 1 | 2 | 3 | 4;

interface CarouselBaseProps extends Omit<
  ComponentPropsWithoutRef<"section">,
  "children" | "aria-label" | "aria-labelledby" | "aria-roledescription"
> {
  /**
   * Slides: each direct child is one slide. A fragment counts as one child, so the slides inside
   * it will not drift apart; `null`, `false` and empty strings do not become slides.
   */
  children?: ReactNode;
  /**
   * How many slides are visible at once: a number, or an object keyed by the kit's breakpoints —
   * `{ base: 1, md: 2, xl: 4 }`. Defaults to 1.
   *
   * There is intentionally no gap between slides: a slide's width is a fraction of the row, and a
   * gap would make it depend on the number of slides in view. The spacing between cards is the
   * inner padding of the slide's content.
   */
  slidesPerView?: Responsive<CarouselSlidesPerView>;
  /**
   * The current slide — controlled mode. This is the leftmost visible slide, counting from zero:
   * with `slidesPerView={3}` and five slides, indexes 0–2 are reachable, because the carousel does
   * not scroll past its end.
   */
  index?: number;
  /** The slide shown on first render — uncontrolled mode. */
  defaultIndex?: number;
  /**
   * Reports the index of the slide where the user stopped the carousel.
   *
   * Called when scrolling has stopped on a different slide — via a button, a gesture or a key. Not
   * called on every scroll frame, and not called when the carousel has reached a slide that was
   * assigned to it through `index` or `defaultIndex`. In controlled mode, a parent that does not
   * accept the new index gets the carousel back at the previous one.
   */
  onIndexChange?: (index: number) => void;
}

/**
 * The region name is required, and the type says so: without it a screen reader would announce
 * just "region" (or, with `aria-roledescription`, an unnamed "carousel"), and the user would not
 * know which of two carousels on the screen they are in.
 *
 * A carousel has no visible caption, so the name is exactly one of `aria-label` and
 * `aria-labelledby` (`AccessibleName`); in the kit, `label` means only a visible caption.
 * Use `aria-labelledby` when a heading already sits above the strip.
 */
export type CarouselProps = CarouselBaseProps & AccessibleName;

/*
  The slide width is a fraction of the row, written out whole and as a literal, including the
  breakpoint prefix: Tailwind scans the source as text, and `md:basis-1/${n}` would never reach the
  CSS. The matrix in `tests/matrix.tsx` iterates over every cell, and the class coverage test fails
  the run if any of them does not make it into the built CSS.
*/
const BASIS_CLASS: ResponsiveClassMap<CarouselSlidesPerView> = {
  base: { 1: "basis-full", 2: "basis-1/2", 3: "basis-1/3", 4: "basis-1/4" },
  sm: { 1: "sm:basis-full", 2: "sm:basis-1/2", 3: "sm:basis-1/3", 4: "sm:basis-1/4" },
  md: { 1: "md:basis-full", 2: "md:basis-1/2", 3: "md:basis-1/3", 4: "md:basis-1/4" },
  lg: { 1: "lg:basis-full", 2: "lg:basis-1/2", 3: "lg:basis-1/3", 4: "lg:basis-1/4" },
  xl: { 1: "xl:basis-full", 2: "xl:basis-1/2", 3: "xl:basis-1/3", 4: "xl:basis-1/4" },
};

/**
 * The pause after the last scroll event, after which the strip is considered to have stopped.
 * It cannot be shorter than an animation frame; if it is longer, the response delay becomes
 * noticeable. 100 ms is a margin above the gap between events during smooth scrolling and
 * trackpad inertia.
 */
const SETTLE_MS = 100;

/** Pixel tolerance: the scroll position is fractional, while `scrollWidth` is an integer. */
const EDGE_EPSILON = 1;

/**
 * What the strip's layout tells us.
 *
 * All slides are of ONE width and without a gap, so the step is `scrollWidth / count`, not a
 * measurement of each slide. This way the position is read from three numbers (`scrollLeft`,
 * `scrollWidth`, `clientWidth`), and jsdom, which does not compute layout, stubs exactly those.
 */
function measure(viewport: HTMLElement, count: number) {
  const stride = count > 0 ? viewport.scrollWidth / count : 0;
  // `scrollLeft` is negative in RTL — the modulus gives the distance from the start of the strip.
  const offset = Math.abs(viewport.scrollLeft);
  const perView = stride > 0 ? Math.max(1, Math.round(viewport.clientWidth / stride)) : 1;
  const max = Math.max(0, count - perView);
  return {
    stride,
    max,
    index: stride > 0 ? clamp(Math.round(offset / stride), 0, max) : 0,
    atStart: offset <= EDGE_EPSILON,
    atEnd: offset + viewport.clientWidth >= viewport.scrollWidth - EDGE_EPSILON,
  };
}

/**
 * Smoothly — unless the user has asked for reduced motion.
 *
 * The preference is read AT THE MOMENT of scrolling, not through a subscription: it is needed only
 * here, and a subscription would bring in state that is never rendered. ADR-0043 turns motion off
 * with the CSS variant `motion-reduce:`, but a scroll started from JS is not stopped by a class —
 * `behavior` is set by the call itself. `"auto"` without `scroll-behavior` in CSS is an instant
 * jump. The `matchMedia` method does not exist in jsdom or on the server.
 */
function scrollBehavior(): ScrollBehavior {
  const reduce =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return reduce ? "auto" : "smooth";
}

/**
 * Carousel: a strip of slides on native scrolling with snap points.
 *
 * THE BROWSER SCROLLS, NOT US. The strip is an ordinary container with `overflow-x` and CSS
 * scroll-snap: the wheel, trackpad, swipe and keyboard arrows work on their own, with inertia and
 * stopping exactly on a slide. The component does not intercept them — it only reads the result and
 * adds buttons. Hence there is no autoplay, no infinite strip, no dot indicators (out of scope),
 * and
 * no pause button is needed.
 *
 * THE CURRENT SLIDE IS READ FROM THE SCROLL POSITION (the `scroll` event and geometry), not from an
 * `IntersectionObserver`. The observer answers "how much of a slide is visible", while we need
 * "which slide is at the leading edge" — with two or more slides in view it would require
 * thresholds and a choice among several. The position gives the answer with one division. Plus the
 * observer is absent in jsdom, while the position there is stubbed with three numbers.
 *
 * THE CURRENT SLIDE IS REPORTED AFTER STOPPING, not on every frame. Otherwise, in controlled mode,
 * changing `index` would start a smooth scroll, which on its way would call `onIndexChange` with
 * intermediate slides; the parent would set them back — and the scroll would fight itself.
 *
 * ACCESSIBILITY — the APG Carousel pattern: a region with `aria-roledescription` and a name; slides
 * are groups with `aria-roledescription="slide"` and a name "N of M". Slides outside the view are
 * NOT hidden from screen readers: with no autoplay, the strip is read in full, and the browser
 * itself scrolls focus from an invisible slide into view.
 */
export const Carousel = forwardRef<HTMLElement, CarouselProps>(function Carousel(
  { children, slidesPerView = 1, index, defaultIndex = 0, onIndexChange, className, ...rest },
  ref
) {
  const messages = useMessages().carousel;
  // `Children.toArray` drops `null` and `false` but keeps the empty string: `{title && <Slide />}`
  // with an empty `title` would otherwise produce an empty slide and throw off the step
  // (`scrollWidth / count`), and with it every index.
  const slides = Children.toArray(children).filter((slide) => slide !== "");
  const count = slides.length;
  // The width class string serves as both the markup and the dependency key: the breakpoints
  // object is new on every render, while the string changes only when it actually should.
  const basis = responsiveClasses(slidesPerView, BASIS_CLASS);

  const viewportRef = useRef<HTMLDivElement>(null);
  const previousRef = useRef<HTMLButtonElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);

  // Edges before the first measurement: with zero, "back" is disabled. "Forward" stays enabled
  // until
  // proven otherwise — the first measurement runs before render (`useLayoutEffect`).
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  /** The slide that has already been reported outward (or that was set from outside). */
  const known = useRef(index ?? defaultIndex);
  /** The slide the strip is heading to by our command, until it stops. */
  const pending = useRef<number | null>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  /**
   * The slide that could not be applied yet: the strip has no layout. A carousel mounted in a
   * hidden
   * container (an inactive tab, `display: none`) measures `scrollWidth` as zero, and the initial
   * slide would be silently lost. The first measurement with a non-zero width (`ResizeObserver`)
   * applies it.
   */
  const deferred = useRef<number | null>(null);

  // The handler is read through a ref: the stop timer outlives the render, and a copy captured in
  // it
  // would call a stale callback.
  const onIndexChangeRef = useRef(onIndexChange);
  const controlledRef = useRef(index !== undefined);
  useLayoutEffect(() => {
    onIndexChangeRef.current = onIndexChange;
    controlledRef.current = index !== undefined;
  });
  // A stop counter: a re-render after the callback, so that a controlled `index` is applied again
  // even if the parent left it unchanged.
  const [stops, setStops] = useState(0);

  const updateEdges = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const m = measure(viewport, count);
    setAtStart(m.atStart);
    setAtEnd(m.atEnd);
  }, [count]);

  const armSettle = useCallback(() => {
    clearTimeout(settleTimer.current);
    const armedAt = Math.abs(viewportRef.current?.scrollLeft ?? 0);
    settleTimer.current = setTimeout(() => {
      const viewport = viewportRef.current;
      if (!viewport) return;
      // A stop means "the position stopped changing", not "there were no events for 100 ms": when
      // the
      // event stream is idle, the event arrives late while a smooth scroll keeps moving meanwhile.
      // If it has moved, wait again.
      if (Math.abs(viewport.scrollLeft) !== armedAt) {
        armSettle();
        return;
      }
      pending.current = null;
      const { index: reached, stride } = measure(viewport, count);
      // A hidden strip (width zero) sits "at zero" not by the user's choice.
      if (stride === 0 || reached === known.current) return;
      known.current = reached;
      onIndexChangeRef.current?.(reached);
      if (controlledRef.current) setStops((n) => n + 1);
    }, SETTLE_MS);
  }, [count]);

  const scrollToIndex = useCallback(
    (target: number, behavior: ScrollBehavior) => {
      const viewport = viewportRef.current;
      if (!viewport) return;
      const m = measure(viewport, count);
      const to = clamp(target, 0, m.max);
      // In RTL the strip grows to the left, and `scrollTo` takes a negative offset.
      const sign = getComputedStyle(viewport).direction === "rtl" ? -1 : 1;
      pending.current = to;
      viewport.scrollTo({ left: sign * to * m.stride, behavior });
      // There may be no scroll events at all (already in place): the timer will still clear
      // `pending`,
      // otherwise the next button would count from a target that does not exist.
      armSettle();
    },
    [count, armSettle]
  );

  /**
   * "Back" and "forward": counted from the target of the current scroll if one is running, so rapid
   * presses accumulate.
   */
  const step = (delta: 1 | -1) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const base = pending.current ?? measure(viewport, count).index;
    scrollToIndex(base + delta, scrollBehavior());
  };

  // The first position and an external change of `index`. On mount — instant: an animation from
  // zero
  // to the initial slide would look like a bug.
  const mounted = useRef(false);
  useLayoutEffect(() => {
    const first = !mounted.current;
    mounted.current = true;
    const target = index ?? (first ? defaultIndex : undefined);
    if (target === undefined) return;
    const viewport = viewportRef.current;
    if (!viewport) return;
    const m = measure(viewport, count);
    // There is no layout — nothing to scroll to yet: the target waits for the first measurement
    // with a
    // width. It is remembered as known, so that even before then it is not mistaken for a slide
    // change.
    if (m.stride === 0 && count > 0) {
      deferred.current = target;
      known.current = target;
      return;
    }
    deferred.current = null;
    // An unreachable index is replaced with the nearest reachable one BEFORE it is remembered:
    // otherwise stopping on it would look like a slide change and would produce a callback about a
    // scroll that we started ourselves.
    const reachable = clamp(target, 0, m.max);
    known.current = reachable;
    // Already there: nothing to scroll.
    if (m.index === reachable) return;
    scrollToIndex(reachable, first ? "instant" : scrollBehavior());
    // `count` and `defaultIndex` are intentionally absent from the dependencies: a slide changes
    // only
    // `index`, and a change in the number of slides must not jerk the strip. `stops` is present: in
    // controlled mode the strip returns to `index` if the parent rejected the change — otherwise
    // the
    // strip would show a slide that is not in the parent's state, and there would be no way to
    // bring
    // it back.
  }, [index, stops]);

  /**
   * The strip's size changed: edges are recomputed; once it gets a width, the waiting slide is
   * applied.
   */
  const onResize = useCallback(() => {
    updateEdges();
    const viewport = viewportRef.current;
    if (!viewport) return;
    const m = measure(viewport, count);
    if (m.stride === 0) {
      // The strip was hidden (`display: none` resets scroll to zero): on the next show it returns
      // to
      // the known slide, not to the first one.
      if (count > 0 && deferred.current === null) deferred.current = known.current;
      return;
    }
    const target = deferred.current;
    if (target === null) return;
    deferred.current = null;
    const reachable = clamp(target, 0, m.max);
    known.current = reachable;
    // Instant, as on mount: for the user this is the first showing of the strip.
    if (m.index !== reachable) scrollToIndex(reachable, "instant");
  }, [updateEdges, count, scrollToIndex]);

  // Edges: after the slides are rendered, when `slidesPerView` changes, and when the strip's size
  // changes. A change to `slidesPerView` through the prop does not change the strip's width — the
  // width of the slides changes, and the observer does not see that; hence `basis` is in the
  // dependencies. A breakpoint does change the strip's width too — the observer catches that.
  useLayoutEffect(() => {
    updateEdges();
    const viewport = viewportRef.current;
    // There is no observer in jsdom or on the server; without it, edges are updated by scrolling.
    if (!viewport || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(onResize);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [updateEdges, onResize, basis]);

  // The stop timer must not outlive the component.
  useEffect(() => () => clearTimeout(settleTimer.current), []);

  /*
    A pressed button that becomes disabled at an edge would drop focus to `body`: a keyboard user
    who reached the end would land at the top of the page. Focus moves to the opposite button, and
    if that one is disabled too — to the strip. `useLayoutEffect`: before the browser sorts out
    the disabled element itself.
  */
  useLayoutEffect(() => {
    const active = document.activeElement;
    if (atEnd && active === nextRef.current) {
      (atStart ? viewportRef.current : previousRef.current)?.focus();
    } else if (atStart && active === previousRef.current) {
      (atEnd ? viewportRef.current : nextRef.current)?.focus();
    }
  }, [atStart, atEnd]);

  return (
    <section
      ref={ref}
      aria-roledescription={messages.roleDescription}
      className={cn("flex items-center gap-2", className)}
      {...rest}
    >
      <Button
        ref={previousRef}
        size="sm"
        iconOnly
        icon={<ChevronLeftIcon size={16} className="rtl:rotate-180" />}
        aria-label={messages.previous}
        disabled={atStart}
        onClick={() => step(-1)}
      />

      <div
        ref={viewportRef}
        /*
          `tabIndex={0}`: a scrollable block must be reachable from the keyboard (axe
          `scrollable-region-focusable`), and the arrows on it scroll natively, with snapping. The
          buttons do not replace this: on slides without focusable content the strip would otherwise
          have no stop in the tab order.
        */
        tabIndex={0}
        onScroll={() => {
          updateEdges();
          armSettle();
        }}
        className={cn(
          "flex min-w-0 flex-1 snap-x snap-mandatory overflow-x-auto",
          // Do not hand the horizontal overscroll to the browser: a swipe at the strip's edge would
          // otherwise go "back in history".
          "overscroll-x-contain",
          // No scrollbar: navigation is by buttons, gestures and keys, and a scrollbar on a strip
          // of
          // cards is just noise. Firefox and WebKit hide it in different ways.
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          "focus-visible:outline-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2"
        )}
      >
        {slides.map((slide, i) => (
          <div
            // The key is given by `Children.toArray`: it is stable for the given child.
            key={isValidElement(slide) ? slide.key : i}
            role="group"
            aria-roledescription={messages.slideRoleDescription}
            aria-label={messages.slide({ index: i + 1, total: count })}
            className={cn("shrink-0 grow-0 snap-start", basis)}
          >
            {slide}
          </div>
        ))}
      </div>

      <Button
        ref={nextRef}
        size="sm"
        iconOnly
        icon={<ChevronRightIcon size={16} className="rtl:rotate-180" />}
        aria-label={messages.next}
        disabled={atEnd}
        onClick={() => step(1)}
      />
    </section>
  );
});
