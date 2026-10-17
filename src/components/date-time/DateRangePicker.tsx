"use client";

import { useEffect, useState } from "react";
import type { DateValue } from "react-aria-components";
import { cn } from "../../lib/cn.js";
import { parseDateOrNull, toDateBound, type DateInput } from "../../lib/date.js";
import { useMessages, useUiLocale } from "../../i18n/useMessages.js";
import {
  periodPresets,
  formatPeriodLength,
  resolvePeriod,
  type DateRange,
  type PeriodPreset,
  type RelativePeriod,
} from "../../lib/period.js";
import { CalendarIcon, CloseIcon } from "../../icons.js";
import { formatDate } from "./DatePicker.js";
import { Popover, PopoverContent, PopoverTrigger } from "../overlays/Popover.js";
import { RangeCalendar } from "./RangeCalendar.js";

export type { DateRange } from "../../lib/period.js";

export interface DateRangePickerProps {
  /** Selected range: a pair of ISO dates `{ start, end }`; an empty or unparseable value is shown as "not selected". */
  value?: DateRange | null;
  /**
   * The relative period (preset) the value was set with; it is highlighted in the preset column.
   *
   * The selected relative period, if the period was set by a preset. When it is set, the
   * trigger label comes from the preset: "30 days" is more honest than a pair of dates that
   * will be a different pair tomorrow.
   */
  period?: RelativePeriod | null;
  /**
   * Emits both the expanded bounds and the preset they came from (`null` means the range was
   * selected by hand in the calendar). The consumer decides what to put into the URL; the package
   * does not choose it for them.
   */
  onChange: (range: DateRange, period: RelativePeriod | null) => void;
  /**
   * Period presets in the column to the left of the calendar; defaults to the kit's standard set.
   *
   * An empty list removes the preset column entirely.
   */
  presets?: readonly PeriodPreset[];
  /** Time zone used to determine "today" for the presets. */
  timeZone?: string;
  /**
   * Handler that clears the period. The clear button appears only if it is passed.
   *
   * Here it is a separate prop, not `clearable` as on `Select`: there clearing is expressed by
   * the existing `onChange(null)`, and a flag is enough. Here `onChange` emits a pair of
   * "bounds + preset", and "nothing selected" does not fit into it — the consumer has to erase
   * both of its own keys anyway.
   */
  onClear?: () => void;
  /** Accessible name of the clear button. */
  clearLabel?: string;
  /** Trigger text until a period is selected; defaults to the kit's standard label. */
  placeholder?: string;
  /** Disables the trigger and hides the clear button. */
  disabled?: boolean;
  /**
   * Earliest available date; presets are clipped to this bound, and a preset that lies entirely
   * outside the bounds cannot be selected. An ISO string `YYYY-MM-DD`, as with `value`; an
   * `@internationalized/date` object is accepted too.
   */
  minValue?: DateInput;
  /** Latest available date; applies the same way as `minValue`. */
  maxValue?: DateInput;
  /**
   * Marks specific days as unavailable (booked dates, holidays): they cannot be selected in the
   * calendar. Receives a calendar date object; `date.toString()` returns the day as an ISO string.
   *
   * Presets do not take this rule into account: they are clipped only by `minValue` and
   * `maxValue`.
   */
  isDateUnavailable?: (date: DateValue) => boolean;
  /**
   * Month the calendar opens on when no range is selected yet. Defaults to the current month;
   * it is pinned in the showcase, otherwise the visual snapshot would change every day.
   */
  defaultFocusedValue?: DateInput;
  /** Locale of the date labels and the calendar; defaults to the `UiProvider` locale. */
  locale?: string;
  /** Whether the panel is open, when the consumer controls the state; without it the panel opens by itself. */
  open?: boolean;
  /** Called whenever the panel opens or closes; works both with and without `open`. */
  onOpenChange?: (open: boolean) => void;
  /** Classes for the trigger frame. */
  triggerClassName?: string;
  /** Classes for the popover with the presets and the calendar. */
  contentClassName?: string;
}

/**
 * Date range: presets on the left, calendar on the right.
 *
 * Presets are not decoration but the main path. In the admin, a period is chosen by recurring
 * windows ("last 30 days"), and the calendar is needed less often than it seems: before this
 * component, the subscribers dialog had four hardcoded buttons in its place, while in campaigns
 * it was the other way round, with only the calendar.
 *
 * An unfinished selection is not passed outside: `onChange` is called only when both bounds are
 * present. Otherwise the consumer would get a range "from March 5 to March 5" on every first
 * click, and would have time to send it to the network.
 */
export function DateRangePicker({
  value,
  period,
  onChange,
  presets,
  timeZone,
  onClear,
  clearLabel,
  placeholder,
  disabled,
  minValue,
  maxValue,
  isDateUnavailable,
  defaultFocusedValue,
  locale,
  open: controlledOpen,
  onOpenChange,
  triggerClassName,
  contentClassName,
}: DateRangePickerProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const months = useTwoMonths();

  const open = controlledOpen ?? internalOpen;
  // The internal state is always updated, as in `Select`: otherwise someone who passed only
  // the callback without `open` would get a panel that never opens.
  const setOpen = (next: boolean) => {
    setInternalOpen(next);
    onOpenChange?.(next);
  };

  /**
   * The range is parsed once, right here.
   *
   * `parseDate` throws on any garbage (`parseDate("nonsense")` is `Invalid ISO 8601 date string`),
   * and `value` comes from the URL, where people edit it by hand. Previously the parsing sat in
   * the markup, in three calls: one malformed link brought down the whole subtree.
   *
   * The guard for a long time existed ONLY here, while a comment claimed that the neighboring
   * `DatePicker` on the same input shows a placeholder. That was wrong: it parsed the value with
   * an expression in a JSX child, with no guard at all. Since wave 26 both call `parseDateOrNull`
   * from `lib/date.ts`, and the claim finally matches the code.
   *
   * As a side effect the `value!` assertions are gone: after narrowing, the compiler itself
   * knows that the bounds exist further on.
   */
  const messages = useMessages();
  const uiLocale = useUiLocale();
  const effectiveLocale = locale ?? uiLocale;
  const activePresets = presets ?? periodPresets(messages);
  const range = parseRange(value);

  /**
   * Clip the range to the field's declared bounds.
   *
   * `null` if the span of the bounds does NOT INTERSECT the range at all. The first version moved
   * the ends independently and could emit a reversed range: with `minValue` at the first day of
   * the current month, the "last month" preset went outside as
   * `{start: "2026-09-01", end: "2026-08-31"}` — an obviously impossible value that the consumer
   * wrote into the address and into the request. A few lines further down the same file, a
   * reversed range is declared to be "not a value", so emitting one ourselves is even less
   * acceptable.
   */
  const clampRange = (r: DateRange): DateRange | null => {
    // The bounds are converted to objects: an unparseable string counts as "not set", rather
    // than being compared as garbage.
    const min = toDateBound(minValue)?.toString();
    const max = toDateBound(maxValue)?.toString();
    const start = min && r.start < min ? min : r.start;
    const end = max && r.end > max ? max : r.end;
    return start <= end ? { start, end } : null;
  };
  const activePreset = period ? activePresets.find((p) => p.period === period) : undefined;
  const label = activePreset
    ? activePreset.label
    : range
      ? `${formatDate(range.start.toString(), effectiveLocale)} — ${formatDate(range.end.toString(), effectiveLocale)}`
      : (placeholder ?? messages.dateRangePicker.placeholder);

  const hasValue = Boolean(range || activePreset);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {/*
        The structure is the same as the `Select` trigger's, and for the same reason: the clear
        button must be a separate button next to the trigger, not inside it — nested interactive
        content is invalid markup and unreachable from the keyboard. So the frame is carried by
        the wrapper, and the trigger button is stretched over its area with a pseudo-element.
      */}
      <span
        className={cn(
          // `leading-5` — the same declared line box as `TextControl` and the `Select` trigger
          // (see `lib/field.ts`): the trigger stands in a form next to them and must give the
          // same 42px. The old `min-h-[38px]` is removed: it was a floor under the derived
          // height, and with a set height it never kicks in: 20 + 2×10 padding + 2 border is
          // already 42.
          "border-line-soft text-fg-2 hover:border-line hover:text-fg-1 rounded-control relative inline-flex w-full items-center gap-2 border px-3 py-2.5 text-[13px] leading-5 transition-colors",
          disabled && "cursor-not-allowed opacity-50",
          triggerClassName
        )}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className={cn(
              "inline-flex min-w-0 grow cursor-pointer items-center justify-between gap-3 text-left outline-none",
              "after:absolute after:inset-0 after:rounded-[inherit]",
              "focus-visible:after:outline-accent-strong focus-visible:after:outline-2 focus-visible:after:outline-offset-2",
              "disabled:cursor-not-allowed"
            )}
          >
            <span className={hasValue ? "text-fg-1" : "text-fg-3"}>{label}</span>
            <CalendarIcon size={14} className="text-fg-3 shrink-0" />
          </button>
        </PopoverTrigger>

        {hasValue && onClear && !disabled ? (
          <button
            type="button"
            aria-label={clearLabel ?? messages.common.clear}
            onClick={onClear}
            // `relative` lifts the × above the button's stretched pseudo-element; otherwise a
            // click on it would open the panel instead of clearing.
            className="bg-bg-3 text-fg-2 hover:text-fg-0 focus-visible:outline-accent-strong relative z-10 flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <CloseIcon size={10} aria-hidden />
          </button>
        ) : null}
      </span>
      <PopoverContent className={cn("w-auto p-0", contentClassName)} align="start">
        <div className="flex items-stretch">
          {activePresets.length > 0 ? (
            <div className="border-line-soft flex flex-col gap-0.5 border-r p-2">
              {activePresets.map((p) => (
                <button
                  key={p.period}
                  type="button"
                  onClick={() => {
                    // The preset is CLIPPED to the bounds: the limits applied only to the
                    // calendar, and "365 days" went past `minValue` — so a range went out that
                    // cannot be selected in the calendar at all.
                    const clamped = clampRange(resolvePeriod(p.period, timeZone));
                    // A preset that falls entirely outside the bounds cannot be selected: calling
                    // `onChange` with an impossible range is worse than not answering.
                    if (!clamped) return;
                    onChange(clamped, p.period);
                    setOpen(false);
                  }}
                  className={cn(
                    "cursor-pointer rounded-sm px-3 py-[7px] text-left text-[13px] font-medium whitespace-nowrap transition-colors",
                    "focus-visible:outline-accent-strong focus-visible:outline-2 focus-visible:-outline-offset-2",
                    p.period === period ? "bg-bg-3 text-fg-0" : "text-fg-1 hover:bg-bg-2"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          ) : null}

          <div className="flex flex-col">
            <RangeCalendar
              value={range}
              onChange={(next) => {
                // The first click produces a range "from March 5 to March 5" — we do not emit
                // it: the consumer would have time to send it to the network.
                if (!next?.start || !next?.end) return;
                onChange({ start: next.start.toString(), end: next.end.toString() }, null);
                setOpen(false);
              }}
              minValue={minValue}
              maxValue={maxValue}
              isDateUnavailable={isDateUnavailable}
              defaultFocusedValue={defaultFocusedValue}
              locale={locale}
              months={months}
            />
            {range ? (
              <div className="border-line-soft text-fg-2 border-t px-3 py-2 text-[12px] empty:hidden">
                {formatPeriodLength(
                  { start: range.start.toString(), end: range.end.toString() },
                  messages
                )}
              </div>
            ) : null}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Parses a pair of ISO strings into a calendar value; garbage turns into "no value" (`null`).
 *
 * Both bounds must be valid: half a range is not a usable filter, and the calendar has nothing
 * to show it with.
 */
function parseRange(value: DateRange | null | undefined) {
  const start = parseDateOrNull(value?.start);
  const end = parseDateOrNull(value?.end);
  if (!start || !end) return null;
  /*
    A REVERSED range is unparseable too.

    The calendar cannot pick it, but it can be assembled by hand in the address:
    `?from=2026-03-10&to=2026-03-01`. Both dates parsed, `hasValue` was true, the trigger showed
    "10 Mar 2026 — 01 Mar 2026", the calendar highlighted nothing (react-aria checks the range
    as `>= start && <= end`), and the caption below, via `periodLength` with its `Math.max(1, …)`,
    confidently reported "1 day". We reject it right where the garbage is rejected.
  */
  if (start.compare(end) > 0) return null;
  return { start, end };
}

/**
 * Two months side by side — only when there is room for them.
 *
 * We always start with one: on the server `matchMedia` does not exist at all, and trying to guess
 * the width before mount causes a markup mismatch. The second month appears after the first
 * render, when the width can be queried.
 */
function useTwoMonths(): 1 | 2 {
  const [two, setTwo] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)");
    setTwo(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setTwo(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return two ? 2 : 1;
}
