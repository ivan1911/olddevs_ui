"use client";

import {
  Label,
  Slider as AriaSlider,
  SliderOutput,
  SliderStateContext,
  SliderThumb,
  SliderTrack,
  type DOMRenderFunction,
  type SliderProps as AriaSliderProps,
  type SliderRenderProps,
} from "react-aria-components";
import { useContext, useEffect, useRef, type RefObject } from "react";
import { useFieldDescribedBy } from "../../hooks/useFieldDescription.js";
import { cn } from "../../lib/cn.js";

/**
 * `orientation` exists only on `Slider`. Before this change there was no such prop anywhere:
 * the track and the fill had one horizontal geometry, so a vertical slider would simply
 * render horizontally. A single slider now has its own vertical geometry; `RangeSlider` has
 * none, and the prop is still removed from its type — a prop that compiles and does nothing
 * is worse than no prop at all.
 */
interface SliderLookProps {
  /** Label in the slider header, to the left of the value. */
  label?: string;
  /**
   * Where to show the value.
   *
   * `side` — in the label row on the right: the value is always visible and does not jump.
   * `none` — do not show it: when a field with the same number sits next to the slider,
   * two copies of one value would look inconsistent to the reader.
   *
   * The value is intentionally NOT shown above the thumb: it moves with the thumb, and at the
   * ends of the track it would stick out past the control's bounds.
   */
  valuePosition?: "side" | "none";
  /** Value formatter. Defaults to the raw value. */
  formatValue?: (value: number) => string;
  /** Classes for the root element. */
  className?: string;
}

export type SliderProps = SliderLookProps &
  Omit<AriaSliderProps<number>, "children" | "className" | "style">;

export type RangeSliderProps = SliderLookProps &
  Omit<AriaSliderProps<number[]>, "children" | "className" | "style" | "orientation"> & {
    /**
     * The smallest distance between the two ends, in value units.
     *
     * react-aria keeps the ends from jumping over each other, but lets them touch.
     * A zero-length range is almost always meaningless: "from 500 to 500" is not a filter
     * but an exact match that the data never contains.
     */
    minGap?: number;
  };

/*
  A disabled slider is dimmed AS A WHOLE, at the root: label, value, track and thumb share
  one opacity, like the other fields of the kit and `State=disabled` in Figma. `disabled:`
  here matches `data-disabled`, which react-aria sets on the root. Previously there was no
  visual disabled state at all — only the cursor over the thumb differed.

  `has-[input:disabled]:` covers a slider inside `<fieldset disabled>` (this is how `Form`
  with `pending` disables its fields): react-aria does not know about such an ancestor and
  does not set `data-disabled` on the root, while the native state is visible only on the
  thumb's hidden `input`.
*/
const DIMMED_WHEN_DISABLED = "disabled:opacity-50 has-[input:disabled]:opacity-50";
const ROOT_CLASS = `flex w-full flex-col gap-2 ${DIMMED_WHEN_DISABLED}`;
const TRACK_CLASS = "bg-bg-3 relative h-1.5 w-full rounded-full";
const FILL_CLASS = "bg-accent absolute h-full rounded-full";
const THUMB_BASE_CLASS =
  "border-accent bg-bg-1 size-4 cursor-grab rounded-full border-2 shadow-[var(--shadow-1)] transition-shadow " +
  "dragging:cursor-grabbing focus-visible:outline-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2 " +
  "disabled:cursor-not-allowed has-[input:disabled]:cursor-not-allowed";
// Along the axis react-aria sets the thumb position (`left` or `top`); across it, we do.
const THUMB_CLASS = `${THUMB_BASE_CLASS} top-1/2`;

/*
  The geometry of a single slider by orientation: one map instead of a branch in every node.
  `RangeSlider` takes the horizontal classes directly: it has no vertical orientation.

  Vertical. The root sets the height: unlike a horizontal track, a vertical track has nothing
  to stretch against, and without an explicit height it collapses to a point. The default is
  `h-48`; the consumer changes it through `className`. The width follows the header, not
  `w-full`: a column as wide as the form looks like a layout bug. The fill grows from the
  bottom edge: "more" on a vertical scale is up.
*/
const GEOMETRY = {
  horizontal: {
    root: ROOT_CLASS,
    track: TRACK_CLASS,
    fill: FILL_CLASS,
    fillSize: "width",
    thumb: THUMB_CLASS,
  },
  vertical: {
    root: `flex h-48 w-max flex-col gap-2 ${DIMMED_WHEN_DISABLED}`,
    track: "bg-bg-3 relative w-1.5 flex-1 self-center rounded-full",
    fill: "bg-accent absolute bottom-0 w-full rounded-full",
    fillSize: "height",
    thumb: `${THUMB_BASE_CLASS} left-1/2`,
  },
} as const;

/**
 * The root that declares the group disabled (`aria-disabled`).
 *
 * The dimmed label and value are the text of an inactive control, which is not required to meet
 * the WCAG 1.4.3 contrast ratio. But both a screen reader and axe can learn about the disabled
 * state only from `aria-disabled` on the group. react-aria does not set it, and filters out
 * one passed as a prop, so the attribute is put on through `render`.
 * The consumer's `render` is not lost: it receives the already augmented props.
 */
function withDisabledGroup(
  render?: DOMRenderFunction<"div", SliderRenderProps>
): DOMRenderFunction<"div", SliderRenderProps> {
  return (props, renderProps) => {
    const merged = { ...props, "aria-disabled": renderProps.isDisabled || undefined };
    return render ? render(merged, renderProps) : <div {...merged} />;
  };
}

function Header({
  label,
  valuePosition,
  formatValue,
}: {
  label?: string;
  valuePosition: "side" | "none";
  formatValue?: (value: number) => string;
}) {
  if (!label && valuePosition === "none") return null;
  return (
    <div className="flex items-baseline justify-between gap-3">
      {label ? <Label className="text-fg-1 text-sm">{label}</Label> : <span />}
      {valuePosition === "side" ? (
        <SliderOutput className="text-fg-2 text-caption font-mono">
          {/*
            Custom formatting goes through the render prop, not by replacing the output from
            outside: `SliderOutput` is the `<output>` linked to the slider, and the text must
            sit inside it, otherwise the link is lost and a screen reader reads an empty output.
          */}
          {formatValue
            ? ({ state }) => state.values.map((v) => formatValue(v)).join(" — ")
            : undefined}
        </SliderOutput>
      ) : null}
    </div>
  );
}

/*
  The wheel changes the value by one step. react-aria does not handle the wheel, so the listener
  is attached to the root and reads the slider state through context: this way `onChange`,
  `onChangeEnd` and the clamping of the ends in `RangeSlider` behave as they do for the keyboard.

  The listener is native and non-passive: React attaches `wheel` as passive, and
  `preventDefault` in it silently does nothing — the page would scroll along with the value.
*/
const WHEEL_NOTCH = 40;
// Idle time after which the unfinished remainder of a wheel gesture is treated as a new gesture.
const WHEEL_IDLE_MS = 200;

function WheelStep({
  rootRef,
  trackRef,
  vertical,
}: {
  rootRef: RefObject<HTMLDivElement | null>;
  trackRef: RefObject<HTMLDivElement | null>;
  vertical: boolean;
}) {
  const state = useContext(SliderStateContext);
  // The fresh state is read from a ref: the listener is attached once.
  const stateRef = useRef(state);
  stateRef.current = state;
  const accumulated = useRef(0);
  const lastWheelAt = useRef(0);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const onWheel = (event: WheelEvent) => {
      const current = stateRef.current;
      // Ctrl + wheel is page zoom (and a trackpad pinch too): do not take it over.
      if (!current || current.isDisabled || event.ctrlKey) return;
      // The slider's axis is the primary one; on a horizontal slider we also take the trackpad's sideways scroll.
      const raw = vertical
        ? -event.deltaY
        : Math.abs(event.deltaX) > Math.abs(event.deltaY)
          ? event.deltaX
          : -event.deltaY;
      if (raw === 0) return;
      const direction = raw > 0 ? 1 : -1;

      const count = current.values.length;
      let index = 0;
      if (count > 1) {
        const rect = trackRef.current?.getBoundingClientRect();
        const along = vertical ? rect?.height : rect?.width;
        if (rect && along) {
          const fraction = vertical
            ? 1 - (event.clientY - rect.top) / along
            : (event.clientX - rect.left) / along;
          const at =
            current.getThumbMinValue(0) +
            fraction * (current.getThumbMaxValue(0) - current.getThumbMinValue(0));
          // On equal distance (the ends have met), pick the one that can move in the scroll direction:
          // up — the upper one, down — the lower one.
          index = current.values.reduce((best, value, i) => {
            const distance = Math.abs(value - at);
            const bestDistance = Math.abs(current.values[best]! - at);
            return distance < bestDistance || (distance === bestDistance && direction > 0)
              ? i
              : best;
          }, 0);
        }
      }

      const value = current.values[index]!;
      const atEdge =
        direction > 0
          ? value >= current.getThumbMaxValue(index)
          : value <= current.getThumbMinValue(index);
      // At the edge of the scale the wheel does not capture the scroll: otherwise the cursor gets stuck and the page cannot scroll.
      if (atEdge) return;
      event.preventDefault();

      // One mouse click is one step; a trackpad sends small deltas, so we accumulate them.
      // The leftover of an old gesture is not carried over: after a pause, or when the direction
      // changes, we accumulate from zero, otherwise the first click gets swallowed.
      const now = Date.now();
      if (
        now - lastWheelAt.current > WHEEL_IDLE_MS ||
        Math.sign(accumulated.current) === -direction
      ) {
        accumulated.current = 0;
      }
      lastWheelAt.current = now;
      accumulated.current += raw * (event.deltaMode === 1 ? 16 : 1);
      if (Math.abs(accumulated.current) < WHEEL_NOTCH) return;
      accumulated.current = 0;

      current.setThumbDragging(index, true);
      current.setThumbValue(index, value + direction * current.step);
      current.setThumbDragging(index, false);
    };
    root.addEventListener("wheel", onWheel, { passive: false });
    return () => root.removeEventListener("wheel", onWheel);
  }, [rootRef, trackRef, vertical]);

  return null;
}

/**
 * A single-value slider.
 *
 * The behavior is entirely react-aria's: pointer and touch drag, keyboard (arrows step,
 * Shift for a large step, Home/End to the ends), `aria-valuetext` and the label announcement.
 * The kit controls the look and the two decisions above: where the value sits and what to do with
 * a zero-length range in a pair.
 */
export function Slider({
  label,
  valuePosition = "side",
  formatValue,
  className,
  ...rest
}: SliderProps) {
  // The `FormField` hint and error did not reach the slider at all: it did not read
  // the description context, although it sits in a form next to fields that do.
  /*
    Only the form description is taken here, without merging with the user's one.

    Do not merge: the consumer's `aria-describedby` goes into `{...rest}` on the group,
    and react-aria itself moves it onto the thumb and combines it with its own.
    If we added the merged value on top, we got `own own _r_0_` — the same id twice,
    and the hint was read twice in a row.
  */
  const describedBy = useFieldDescribedBy();
  // Read orientation rather than destructuring it: the prop must reach
  // react-aria through `{...rest}` — arrows and `aria-orientation` depend on it.
  const geometry = GEOMETRY[rest.orientation ?? "horizontal"];
  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  return (
    <AriaSlider
      {...rest}
      ref={rootRef}
      render={withDisabledGroup(rest.render)}
      className={cn(geometry.root, className)}
    >
      <WheelStep rootRef={rootRef} trackRef={trackRef} vertical={rest.orientation === "vertical"} />
      <Header label={label} valuePosition={valuePosition} formatValue={formatValue} />
      <SliderTrack ref={trackRef} className={geometry.track}>
        {({ state }) => (
          <>
            <div
              data-fill
              className={geometry.fill}
              style={{ [geometry.fillSize]: `${state.getThumbPercent(0) * 100}%` }}
            />
            {/*
              The description sits on the THUMB, not on the group: the thumb is what gets focus,
              and `role="slider"` is on it too. react-aria does not set the attribute on the group
              at all — verified, it does not reach it.
            */}
            <SliderThumb
              className={geometry.thumb}
              {...(describedBy ? { "aria-describedby": describedBy } : {})}
            />
          </>
        )}
      </SliderTrack>
    </AriaSlider>
  );
}

/**
 * A range slider: two ends on one track.
 *
 * A separate component, not a `range` prop on `Slider`: a pair has a different value type
 * (`number[]` versus `number`), and a union over a boolean prop would turn `onChange` into
 * "one of two things" for every caller. It is the same logic by which `Select`'s `multiple`
 * axis is kept apart by types.
 */
export function RangeSlider({
  label,
  valuePosition = "side",
  minGap = 0,
  formatValue,
  className,
  onChange,
  ...rest
}: RangeSliderProps) {
  const min = rest.minValue ?? 0;
  const max = rest.maxValue ?? 100;
  // As above: react-aria merges the description; our job is the form description.
  const describedBy = useFieldDescribedBy();
  /*
    The PREVIOUS pair, not the initial one.

    The base for "which end was moved" was taken from `rest.value ?? rest.defaultValue`.
    For an UNCONTROLLED slider `value` is always `undefined`, and `defaultValue` never changes —
    after the first move the comparison ran against the initial value, and the wrong end got
    clamped: the user dragged the upper end, and it was the upper end that got pushed away.
  */
  const previous = useRef<[number, number] | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  return (
    <AriaSlider
      {...rest}
      ref={rootRef}
      render={withDisabledGroup(rest.render)}
      onChange={(value) => {
        /*
          The gap is enforced HERE: react-aria does not let the ends swap places, but it does
          let them touch, and "from 500 to 500" goes into the filter as a valid value.

          The value is CLAMPED, not discarded. Discarding broke in two ways at once, and both
          were found in review:

          1. A controlled slider froze completely. The check looked at the resulting gap, not at
             whether the move made things better: from a state that already violated `minGap`
             (a saved filter, a server default), ALL moves were rejected, including the ones
             that fix it.
          2. An uncontrolled one had its view and data diverge. react-aria's internal state
             changes independently of our callback: the thumbs slid together on screen, while
             the caller got nothing and kept considering the value unchanged.

          WHAT REMAINS. The clamped pair goes to `onChange`, but react-aria's internal state
          cannot be corrected by us — the library owns it. For an UNCONTROLLED slider the ends
          on screen can still end up closer than the gap, although the correct value went out.
          With `minGap`, keep the slider controlled; this is also documented on the component page.

          We clamp the end that was not touched: the one being moved stays under the finger,
          and the neighbor is pushed away.
        */
        if (minGap > 0 && Array.isArray(value) && value.length === 2) {
          const [low, high] = value as [number, number];
          if (high - low < minGap) {
            const [prevLow] = (rest.value ??
              previous.current ??
              rest.defaultValue ?? [low, high]) as [number, number];
            const lowerThumbMoved = low !== prevLow;
            const clamped: [number, number] = lowerThumbMoved
              ? [low, Math.min(low + minGap, max)]
              : [Math.max(high - minGap, min), high];
            previous.current = clamped;
            onChange?.(clamped);
            return;
          }
        }
        if (Array.isArray(value) && value.length === 2) {
          previous.current = value as [number, number];
        }
        onChange?.(value);
      }}
      className={cn(ROOT_CLASS, className)}
    >
      <WheelStep rootRef={rootRef} trackRef={trackRef} vertical={false} />
      <Header label={label} valuePosition={valuePosition} formatValue={formatValue} />
      <SliderTrack ref={trackRef} className={TRACK_CLASS}>
        {({ state }) => (
          <>
            <div
              className={FILL_CLASS}
              style={{
                left: `${state.getThumbPercent(0) * 100}%`,
                width: `${(state.getThumbPercent(1) - state.getThumbPercent(0)) * 100}%`,
              }}
            />
            {/* The description sits on the FIRST thumb: repeating it on both would mean
                reading the hint twice when moving between the ends. */}
            <SliderThumb
              index={0}
              className={THUMB_CLASS}
              {...(describedBy ? { "aria-describedby": describedBy } : {})}
            />
            <SliderThumb index={1} className={THUMB_CLASS} />
          </>
        )}
      </SliderTrack>
    </AriaSlider>
  );
}
