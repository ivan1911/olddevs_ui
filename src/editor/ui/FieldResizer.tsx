"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { useMessages } from "../../i18n/useMessages.js";
import { cn } from "../../lib/cn.js";

/** The field does not shrink below this: the Toolbar and a few lines of the Document (8 rem). */
export const FIELD_MIN_HEIGHT = 128;

/** Arrow key step; Shift moves by one pixel, as in `SplitPanel`. */
const STEP = 16;
const FINE_STEP = 1;

export interface FieldResizerProps {
  /** The Document area whose height is dragged. */
  area: HTMLElement | null;
  /** Height set by hand; `null` means the initial height (`maxHeight` or the Document's own height). */
  height: number | null;
  onHeight: (height: number | null) => void;
  disabled: boolean;
}

/**
 * Resize handle of the field (`resizable`, ADR-0059): a strip along the bottom edge
 * of the Document area, with a grip in the middle, styled like the `SplitPanel`
 * divider. The browser's native `resize: vertical` draws its own corner that ignores
 * the theme: in dark theme it shows as a white square on the field's frame.
 *
 * The visible strip is 10 px; a pseudo-element widens the hit area to 26 px
 * (WCAG 2.5.8). From the keyboard, a hidden `range` slider does the job: Arrow Up and
 * Arrow Down move by 16 px, with Shift by one pixel. A double-click restores the initial height.
 */
export function FieldResizer({ area, height, onHeight, disabled }: FieldResizerProps) {
  const messages = useMessages().editor;
  const slider = useRef<HTMLInputElement>(null);
  const drag = useRef<{ from: number; size: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  /*
    The area is measured in state, not during render: the on-screen height and the
    content height (the slider's upper bound) are updated by a size observer, on slider
    focus, and at the start of a drag. The initial height can be in `rem` or `vh`, so it
    is measured rather than derived from `maxHeight`.
  */
  const [measured, setMeasured] = useState({ size: FIELD_MIN_HEIGHT, content: 0 });
  const measure = () => {
    if (!area) return;
    const size = Math.round(area.getBoundingClientRect().height);
    setMeasured((prev) =>
      prev.size === size && prev.content === area.scrollHeight
        ? prev
        : { size, content: area.scrollHeight }
    );
  };
  useEffect(() => {
    // Measure right away instead of waiting for the observer: it fires only with a paint
    // frame, and until then the slider would report its lower bound, not the height.
    measure();
    if (!area || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => measure());
    observer.observe(area);
    return () => observer.disconnect();
    // `measure` reads only `area`: the observer is recreated together with it.
  }, [area]);

  const current = height ?? measured.size;
  const commit = (value: number) => onHeight(Math.max(FIELD_MIN_HEIGHT, Math.round(value)));

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (disabled || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      from: event.clientY,
      size: Math.round(area?.getBoundingClientRect().height ?? current),
    };
    measure();
    setDragging(true);
    // Dragged with the mouse, then continued with the arrow keys: focus goes to the
    // slider, as in `SplitPanel`. Without `preventDefault`, the `mousedown` that follows
    // `pointerdown` on a non-focusable strip moves focus to `body` at once.
    event.preventDefault();
    slider.current?.focus({ preventScroll: true });
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const from = drag.current;
    if (!from) return;
    // The button was released outside the strip and the capture was lost: the edge must
    // not move without a press.
    if (event.buttons === 0) {
      endDrag(event);
      return;
    }
    commit(from.size + event.clientY - from.from);
  }

  function endDrag(event?: PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    drag.current = null;
    setDragging(false);
    if (event && event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    const down = event.key === "ArrowDown" || event.key === "ArrowRight";
    const up = event.key === "ArrowUp" || event.key === "ArrowLeft";
    if (!down && !up) return;
    event.preventDefault();
    const step = event.shiftKey ? FINE_STEP : STEP;
    commit(current + (down ? step : -step));
  }

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onLostPointerCapture={() => endDrag()}
      onDoubleClick={() => !disabled && onHeight(null)}
      className={cn(
        "group relative -mx-3 flex h-2.5 shrink-0 touch-none items-center justify-center",
        "before:absolute before:inset-x-0 before:-inset-y-2 before:content-['']",
        disabled ? "cursor-not-allowed" : "cursor-row-resize",
        dragging && "select-none"
      )}
    >
      {/* The grip: a pill like the `SplitPanel` divider, but quieter, since this is the field's edge, not a boundary between areas. */}
      <span
        aria-hidden
        className={cn(
          "bg-line duration-fast h-0.5 w-7 rounded-full transition-colors",
          !disabled && "group-hover:bg-fg-2",
          dragging && "bg-accent-strong",
          "group-has-[:focus-visible]:bg-accent-strong group-has-[:focus-visible]:ring-[3px] group-has-[:focus-visible]:ring-[color:var(--focus-ring)]"
        )}
      />
      <input
        ref={slider}
        type="range"
        aria-label={messages.resizeField}
        aria-orientation="vertical"
        aria-valuetext={messages.fieldHeight({ size: current })}
        min={FIELD_MIN_HEIGHT}
        max={Math.max(current, measured.content, FIELD_MIN_HEIGHT)}
        step={FINE_STEP}
        value={current}
        disabled={disabled}
        onFocus={measure}
        onKeyDown={onKeyDown}
        onChange={(event) => commit(Number(event.target.value))}
        className="pointer-events-none absolute inset-0 h-full w-full appearance-none bg-transparent opacity-0"
      />
    </div>
  );
}
