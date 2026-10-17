"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { useMessages } from "../../i18n/useMessages.js";
import { clamp } from "../../lib/clamp.js";
import { cn } from "../../lib/cn.js";

export interface SplitPanelProps {
  /**
   * Where the panel sits: to the side of the content or below it.
   *
   * The axis changes the direction of the layout, not just the classes: with
   * `bottom` the panel takes the full width and is resized along the height, and the
   * handle turns with it.
   */
  position?: "side" | "bottom";
  /** The main area: a list, a table, a grid. */
  children?: ReactNode;
  /** The content of the details panel. */
  panel?: ReactNode;
  /**
   * Panel size in pixels: width for `side`, height for `bottom`.
   *
   * A controlled size. Without it the panel remembers its size itself, starting from
   * `defaultSize`, but only for as long as it lives. Long-term memory (the page
   * address, the user profile) stays with the consumer: the consumer already keeps
   * that state somewhere, and a second store inside the kit would drift apart from
   * the first one silently (ADR-0023).
   */
  size?: number;
  /**
   * The initial size when `size` is not passed. Double-clicking the handle also restores it.
   *
   * It is read **once, on mount**: changing the prop later does not move the initial
   * size, otherwise the panel would jump under the user because of someone else's
   * re-render. The double-click target, however, is the current size, and in
   * controlled mode a double-click calls `onSizeChange(defaultSize)`: the kit's
   * default, if the consumer did not pass its own.
   */
  defaultSize?: number;
  /**
   * Called on every size change, including every frame of a drag.
   *
   * Whoever writes the size to the page address or to the server does not need every
   * frame: throttling or saving on `pointerup` is the consumer's concern. The kit
   * reports the intent as often as it occurs.
   *
   * Narrowing the bounds on the fly corrects the displayed size, but this callback is
   * NOT called for it: the value the consumer stores stays the same, while the clamped
   * value is shown. The silence is deliberate: an event without a user action would
   * look like someone else editing its state.
   */
  onSizeChange?: (size: number) => void;
  /**
   * Lower bound. The panel cannot become narrower, whether by dragging or through the prop.
   *
   * An inverted range (`minSize > maxSize`) breaks nothing: the upper bound is raised
   * to the lower one. Otherwise you would get a control with no way out, neither by
   * arrow keys nor by dragging, and without a single message about the cause.
   */
  minSize?: number;
  /**
   * Upper bound.
   *
   * In pixels, not fractions: a fraction would require knowing the container size,
   * that is, measuring it on every frame of a drag.
   */
  maxSize?: number;
  /**
   * The panel is collapsed.
   *
   * The content is **not unmounted**: the state of forms and scroll positions inside
   * survives the collapse. The panel is removed from the accessibility tree: a hidden
   * panel that Tab can reach is focus that has gone somewhere invisible. The handle
   * disappears with it: there is nothing to drag.
   */
  collapsed?: boolean;
  /**
   * Accessible name of the panel. With it the panel is announced as a region; without
   * it, it is not.
   *
   * An unnamed region is an extra announcement to the screen reader with nothing after it;
   * the same rule as for `ButtonGroup`.
   */
  "aria-label"?: string;
  /** Classes for the root layout element. */
  className?: string;
}

/** Thickness of the handle strip in pixels. */
const HANDLE = 10;

/**
 * Arrow-key step. Any smaller, and reaching the needed size would take fifty-odd presses.
 *
 * It lives in the key handler, NOT in a `step` attribute. The step base of
 * `input[type=range]` is `min`, so `step=16` would allow only values `min + 16n`:
 * `maxSize` would not be reachable with `End` or the arrows, and the browser would
 * silently round the pixel-by-pixel result of a drag, so `aria-valuenow` would drift
 * from the panel width on screen.
 */
const STEP = 16;

/** The exact step, for those who need precisely that pixel. */
const FINE_STEP = 1;

/**
 * Two areas with a movable boundary: the content and the details panel.
 *
 * THE SIZE LIVES WITH THE CONSUMER; the kit provides the shape. This is the same
 * split as for table state (ADR-0023). The panel can remember its size itself, but
 * only for as long as it lives: the consumer usually already keeps it in the page
 * address or in the profile, and a second store inside the kit would drift apart
 * from the first one silently.
 *
 * THE HANDLE IS A VISIBLE STRIP PLUS A REAL `input[type=range]` UNDER IT, and this is
 * the central decision of the component. react-aria does not provide a general-purpose
 * resizer: `ColumnResizer` and `ResizableTableContainer`, which already work in
 * `Table`, are tied to the table and do not work outside it. Their model was taken,
 * not the components themselves.
 *
 * Why not a `div` with `role="separator"` and an arrow-key handler: the platform slider
 * brings with it everything that otherwise gets written by hand and forgotten piece by
 * piece: the role, the announcement of the value and bounds, the step, repeat on hold,
 * screen reader support on touch screens. A custom implementation repeats this at best
 * halfway.
 *
 * The slider lies over the strip, transparent and without pointer events: the strip
 * itself drives the dragging. If the slider kept the events, it would change the value
 * by its own horizontal logic, and with `position="bottom"` the panel would move in the
 * wrong direction. Focus still goes to the real slider: the strip is highlighted through
 * `focus-within`.
 *
 * THE SLIDER VALUE IS THE PANEL SIZE, NOT THE BOUNDARY COORDINATE. So pressing Right
 * always enlarges the panel, even though the boundary moves left. The model is the same
 * as the column resizer's: the user drags the size, not the divider.
 *
 * Both areas get `min-w-0 min-h-0`. Without them a flex child refuses to become smaller
 * than its content, and the panel being dragged does not shrink. Instead, the whole
 * layout gets pushed away.
 *
 * The component does not touch `--topbar-h` at all (ADR-0016): it occupies the area it
 * is given and does not stick to the top.
 */
export function SplitPanel({
  position = "side",
  children,
  panel,
  size,
  defaultSize = 280,
  onSizeChange,
  minSize = 120,
  maxSize = 720,
  collapsed = false,
  "aria-label": ariaLabel,
  className,
}: SplitPanelProps) {
  const messages = useMessages();
  const [ownSize, setOwnSize] = useState(defaultSize);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ from: number; size: number } | null>(null);
  const slider = useRef<HTMLInputElement>(null);
  /** The content area: where focus moves when the panel collapses. */
  const contentRef = useRef<HTMLDivElement>(null);
  /** The collapsible panel, used to tell whether focus was inside it. */
  const collapsingRef = useRef<HTMLDivElement>(null);
  /** Whether focus was inside the collapsible part; computed BEFORE collapsing. */
  const focusWasInside = useRef(false);
  /** The handle: it unmounts together with the collapse. */
  const handleRef = useRef<HTMLDivElement>(null);

  const side = position === "side";
  // An inverted range breaks nothing, but it silently produces a dead control:
  // `min > max` in the slider markup is a state with no way out, neither by arrow
  // keys nor by dragging. The upper bound is raised to the lower one, so at least a
  // valid range goes outward.
  const hi = Math.max(minSize, maxSize);
  const current = clamp(size ?? ownSize, minSize, hi);

  /*
    The cleanup is tied to `collapsed`, NOT to unmounting the component.

    The drag state lives in the component's ref, not in the element's, and survives the
    unmounting of the handle alone. For example, `collapsed` may be switched in the
    middle of a drag. A cleanup with an empty dependency list would run when the next
    handle no longer exists, so it would do nothing: `select-none` would stay on the
    root forever, and HOVERING over a new handle would move the boundary without a
    single press.
  */
  useEffect(() => {
    if (!collapsed) return;
    drag.current = null;
    setDragging(false);

    /*
      Focus that was INSIDE the collapsible part is moved to the content.

      The flag is kept IN ADVANCE, not checked afterwards. The first fix looked at
      `document.activeElement` in the effect, that is, AFTER the DOM was committed, when
      it was too late to ask: by then the handle was unmounted (it renders as a sibling,
      under `{!collapsed && …}`), and the browser had already blurred the field under
      `hidden`. The condition was false in both cases it was written for. The test missed
      this because jsdom does not remove focus from `hidden` elements, so it depended on
      the difference from the browser.

      The content area is already focusable (`tabIndex={0}` for the axe rule
      `scrollable-region-focusable`), so no new target is needed.
    */
    if (!focusWasInside.current) return;
    focusWasInside.current = false;
    contentRef.current?.focus();
  }, [collapsed]);

  function commit(next: number) {
    const value = clamp(Math.round(next), minSize, hi);
    // A drag past the limit is clamped to the same number, and there is nothing to
    // report: the same reason why narrowing the bounds on the fly does not call the
    // callback. Without this line, one movement past the limit gave dozens of identical
    // events in a row, and their recipient, per the documentation, is a write to the
    // page address or to the server.
    if (value === current) return;
    // A controlled size is not written inside: two sources of truth would diverge
    // on exactly the frame where the consumer rejects the value.
    if (size === undefined) setOwnSize(value);
    onSizeChange?.(value);
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    // Only the main button: dragging with the right button leaves the strip stuck to
    // the cursor after the context menu opens.
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { from: side ? event.clientX : event.clientY, size: current };
    setDragging(true);
    // Focus is moved to the slider by hand: the strip itself is not focusable, and the
    // slider under it has no pointer events. Otherwise "drag with the mouse, fine-tune
    // with the arrows" would not work at all, and focus would stay on `<body>`.
    slider.current?.focus();
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const from = drag.current;
    if (!from) return;
    // The button was released, but `pointerup` did not reach the strip, so the capture
    // was lost somewhere else. Without this check the boundary follows the cursor with
    // no press.
    if (event.buttons === 0) {
      endDrag(event);
      return;
    }
    const delta = (side ? event.clientX : event.clientY) - from.from;
    // The panel comes after the content, so moving right or down SHRINKS it. The sign
    // is here, not at the call site, so that it is one and the same for both directions.
    commit(from.size - delta);
  }

  function endDrag(event?: PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    drag.current = null;
    setDragging(false);
    // The event is not always there: `onLostPointerCapture` arrives without a target to
    // hold on to, but the cleanup must happen anyway.
    if (event && event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  }

  /*
    Arrow keys are intercepted because with `step=1` the slider's native reaction is one
    pixel per press. Shift leaves the native reaction alone: that is what "exactly that
    pixel" means.
  */
  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    const back = event.key === "ArrowLeft" || event.key === "ArrowDown";
    const forward = event.key === "ArrowRight" || event.key === "ArrowUp";
    if (!back && !forward) return;
    const step = event.shiftKey ? FINE_STEP : STEP;
    event.preventDefault();
    commit(current + (forward ? step : -step));
  }

  const panelStyle: CSSProperties = side ? { width: current } : { height: current };

  return (
    <div
      /*
        The "focus is inside the collapsible part" flag is kept IN ADVANCE: by the time
        the panel collapses, it is too late to ask. The handle is unmounted, and the
        browser has blurred the field under `hidden`.
      */
      onFocusCapture={(event) => {
        focusWasInside.current =
          collapsingRef.current?.contains(event.target as Node) === true ||
          handleRef.current?.contains(event.target as Node) === true;
      }}
      className={cn(
        "flex h-full w-full overflow-hidden",
        side ? "flex-row" : "flex-col",
        // While dragging, text selection in the neighboring areas is turned off:
        // otherwise moving away from the strip highlights half the list.
        dragging && "select-none",
        className
      )}
    >
      {/*
        Both areas are declared scrollable by the component itself, so it must also make
        them reachable from the keyboard: Tab does not reach content that scrolls only
        with the pointer. The axe rule is `scrollable-region-focusable`.
      */}
      <div ref={contentRef} tabIndex={0} className="min-h-0 min-w-0 flex-1 overflow-auto">
        {children}
      </div>

      {!collapsed && (
        <div
          ref={handleRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onLostPointerCapture={() => endDrag()}
          onDoubleClick={() => commit(defaultSize)}
          className={cn(
            "bg-bg-2 border-line relative flex shrink-0 touch-none items-center justify-center",
            "focus-within:bg-accent-strong focus-within:ring-[3px] focus-within:ring-[color:var(--focus-ring)]",
            // The visible strip is 10 px, but the hit area is widened to 26 px by a
            // pseudo-element: WCAG 2.5.8 requires 24, and on a touch screen a
            // ten-pixel target is no formality.
            "before:absolute before:content-['']",
            side
              ? "cursor-col-resize border-x before:-inset-x-2 before:inset-y-0"
              : "cursor-row-resize border-y before:inset-x-0 before:-inset-y-2"
          )}
          style={side ? { width: HANDLE } : { height: HANDLE }}
        >
          {/* The grip: the only thing that distinguishes the strip from a plain border. */}
          <span
            aria-hidden
            className={cn("bg-fg-1 rounded-pill", side ? "h-7 w-0.5" : "h-0.5 w-7")}
          />
          <input
            ref={slider}
            type="range"
            aria-label={
              ariaLabel
                ? messages.splitPanel.resizeNamed({ panel: ariaLabel })
                : messages.splitPanel.resize
            }
            aria-orientation={side ? "horizontal" : "vertical"}
            aria-valuetext={messages.splitPanel.size({ size: current })}
            min={minSize}
            max={hi}
            step={FINE_STEP}
            value={current}
            onKeyDown={onKeyDown}
            onChange={(event) => commit(Number(event.target.value))}
            className="pointer-events-none absolute inset-0 h-full w-full appearance-none bg-transparent opacity-0"
          />
        </div>
      )}

      <div
        ref={collapsingRef}
        hidden={collapsed}
        tabIndex={collapsed ? undefined : 0}
        role={ariaLabel ? "region" : undefined}
        aria-label={ariaLabel}
        className="bg-bg-1 min-h-0 min-w-0 shrink-0 overflow-auto"
        style={panelStyle}
      >
        {panel}
      </div>
    </div>
  );
}
