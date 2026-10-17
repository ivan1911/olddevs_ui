"use client";

import {
  Button,
  CalendarCell,
  CalendarGrid,
  CalendarGridBody,
  CalendarGridHeader,
  CalendarHeaderCell,
  I18nProvider,
  RangeCalendar as RangeCalendarRac,
  type DateValue,
  type RangeCalendarProps as RangeCalendarPropsRac,
} from "react-aria-components";
import { cn } from "../../lib/cn.js";
import { ChevronLeftIcon, ChevronRightIcon } from "../../icons.js";
import {
  toDateBound,
  toIsoDate,
  toRangeValue,
  type DateInput,
  type DateRangeInput,
} from "../../lib/date.js";
import type { DateRange } from "../../lib/period.js";
import { CalendarHeading, NAV_BUTTON_CLASS, WEEKDAY_CELL_CLASS, useToday } from "./Calendar.js";

export interface RangeCalendarProps extends Omit<
  RangeCalendarPropsRac<DateValue>,
  "value" | "defaultValue" | "onChange" | "minValue" | "maxValue" | "defaultFocusedValue"
> {
  /**
   * Selected range: a `{ start, end }` pair of `@internationalized/date` objects or ISO strings
   * `YYYY-MM-DD`, the latter the same as `DateRange` of `DateRangePicker`.
   * `null` is a controlled empty value. If either bound cannot be parsed, the range counts as
   * empty: a range with only one end is never treated as selected.
   */
  value?: DateRangeInput | null;
  /** Initial range of an uncontrolled calendar; the same two forms as `value`. */
  defaultValue?: DateRangeInput | null;
  /**
   * Called when both bounds are selected. The first argument is the calendar object,
   * as in React Aria; the second is the same range as a pair of ISO strings
   * `YYYY-MM-DD`, like `DateRange` in `DateRangePicker`.
   */
  onChange?: (value: { start: DateValue; end: DateValue }, iso: DateRange) => void;
  /** Earliest available day: a calendar object or an ISO string `YYYY-MM-DD`. */
  minValue?: DateInput;
  /** Latest available day; the same two forms as `minValue`. */
  maxValue?: DateInput;
  /** Month the uncontrolled calendar opens on; the same two forms as `minValue`. */
  defaultFocusedValue?: DateInput;
  /** Classes for the calendar root: width, padding, background. */
  className?: string;
  /** Locale of the labels and the first day of the week; see `Calendar`. */
  locale?: string;
  /**
   * How many months to show side by side: `1` or `2`; defaults to `1`.
   *
   * Two is the practical choice for a range: a period that crosses a month boundary
   * would otherwise force the user to page back and forth and lose sight of the end already
   * chosen. One stays for narrow screens.
   */
  months?: 1 | 2;
}

/**
 * Range calendar.
 *
 * The ends of the range are filled with the accent, the middle with a muted background:
 * otherwise a selected two-week span reads as twenty identical buttons,
 * and the picture does not show where it starts.
 */
export function RangeCalendar({
  className,
  locale,
  months = 1,
  value,
  defaultValue,
  onChange,
  minValue,
  maxValue,
  defaultFocusedValue,
  ...props
}: RangeCalendarProps) {
  const now = useToday();

  // One cell serves both months. Otherwise the second month would need a copy of the
  // seventeen classes, and the copies would drift apart at the first edit.
  const cell = (offset?: { months: number }) => (
    <CalendarGrid offset={offset} className="w-fit">
      <CalendarGridHeader>
        {(day) => <CalendarHeaderCell className={WEEKDAY_CELL_CLASS}>{day}</CalendarHeaderCell>}
      </CalendarGridHeader>
      <CalendarGridBody className="[&_td]:px-0">
        {(date) => (
          <CalendarCell
            date={date}
            className={cn(
              "text-fg-1 relative flex size-9 cursor-pointer items-center justify-center rounded-none border border-transparent p-0 text-[13px] font-normal outline-none",
              "duration-fast transition-colors",
              "data-[hovered]:bg-bg-3 data-[hovered]:text-fg-0",
              "data-[selected]:bg-accent-soft data-[selected]:text-fg-0",
              "data-[selection-start]:bg-accent data-[selection-start]:text-text-on-accent",
              "data-[selection-end]:bg-accent data-[selection-end]:text-text-on-accent",
              "data-[selection-start]:rounded-l-lg data-[selection-start]:rounded-r-none",
              "data-[selection-end]:rounded-l-none data-[selection-end]:rounded-r-lg",
              "data-[selection-start]:data-[selection-end]:rounded-lg",
              "data-[disabled]:pointer-events-none data-[disabled]:opacity-30",
              "data-[unavailable]:pointer-events-none data-[unavailable]:line-through data-[unavailable]:opacity-30",
              "data-[focus-visible]:outline-accent-strong data-[focus-visible]:z-10 data-[focus-visible]:outline data-[focus-visible]:outline-2",
              now !== null &&
                date.compare(now) === 0 &&
                "after:bg-accent data-[selection-end]:after:bg-text-on-accent data-[selection-start]:after:bg-text-on-accent after:absolute after:bottom-1 after:left-1/2 after:size-[3px] after:-translate-x-1/2 after:rounded-full"
            )}
          />
        )}
      </CalendarGridBody>
    </CalendarGrid>
  );

  const calendar = (
    <RangeCalendarRac
      {...props}
      value={toRangeValue(value)}
      defaultValue={toRangeValue(defaultValue)}
      onChange={
        onChange &&
        ((next) => onChange(next, { start: toIsoDate(next.start), end: toIsoDate(next.end) }))
      }
      minValue={toDateBound(minValue)}
      maxValue={toDateBound(maxValue)}
      defaultFocusedValue={toDateBound(defaultFocusedValue)}
      visibleDuration={{ months }}
      className={cn("w-fit p-3 select-none", className)}
    >
      <header className="mb-1 flex items-center gap-1">
        <Button slot="previous" className={NAV_BUTTON_CLASS}>
          <ChevronLeftIcon size={15} />
        </Button>
        <CalendarHeading />
        <Button slot="next" className={NAV_BUTTON_CLASS}>
          <ChevronRightIcon size={15} />
        </Button>
      </header>

      <div className="flex gap-4">
        {cell()}
        {months === 2 ? cell({ months: 1 }) : null}
      </div>
    </RangeCalendarRac>
  );

  // The same approach as in `Calendar`: the provider is rendered only when the `locale` prop
  // is set; otherwise the locale comes from above.
  return locale ? <I18nProvider locale={locale}>{calendar}</I18nProvider> : calendar;
}
