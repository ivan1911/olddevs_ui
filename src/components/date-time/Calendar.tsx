"use client";

import { getLocalTimeZone, today, type CalendarDate } from "@internationalized/date";
import { useEffect, useState } from "react";
import {
  Button,
  CalendarCell,
  CalendarGrid,
  CalendarGridBody,
  CalendarGridHeader,
  CalendarHeaderCell,
  Calendar as CalendarRac,
  Heading,
  HeadingContext,
  I18nProvider,
  useSlottedContext,
  type CalendarProps as CalendarPropsRac,
  type DateValue,
} from "react-aria-components";
import { cn } from "../../lib/cn.js";
import { ChevronLeftIcon, ChevronRightIcon } from "../../icons.js";
import { toDateBound, toDateValue, toIsoDate, type DateInput } from "../../lib/date.js";

export interface CalendarProps extends Omit<
  CalendarPropsRac<DateValue>,
  "value" | "defaultValue" | "onChange" | "minValue" | "maxValue" | "defaultFocusedValue"
> {
  /**
   * Selected day: an `@internationalized/date` object or an ISO string `YYYY-MM-DD`. `null` is a
   * controlled empty value. An unparseable string counts as empty.
   */
  value?: DateInput | null;
  /** Initial day of an uncontrolled calendar; accepts the same two forms as `value`. */
  defaultValue?: DateInput | null;
  /**
   * Called when a day is selected. The first argument is the calendar's date object, as in
   * React Aria; the second is the same day as an ISO string `YYYY-MM-DD`, for those who
   * store the value as a string, as `DatePicker` does.
   */
  onChange?: (value: DateValue, iso: string) => void;
  /** Earliest available day: a calendar object or an ISO string `YYYY-MM-DD`. */
  minValue?: DateInput;
  /** Latest available day; the same two forms as `minValue`. */
  maxValue?: DateInput;
  /** Month the uncontrolled calendar opens on; the same two forms as `minValue`. */
  defaultFocusedValue?: DateInput;
  /** Classes for the calendar root: width, padding, background. */
  className?: string;
  /**
   * Locale for labels and the first day of the week; defaults to the `UiProvider` locale.
   */
  locale?: string;
}

/** Month navigation buttons, shared by both calendars. */
export const NAV_BUTTON_CLASS =
  "text-fg-3 hover:bg-bg-3 hover:text-fg-1 data-[focus-visible]:ring-accent-strong flex size-8 cursor-pointer items-center justify-center rounded-lg transition-colors outline-none data-[focus-visible]:ring-2";

/** Weekday header cells, shared as well. */
export const WEEKDAY_CELL_CLASS = "text-fg-3 size-9 p-0 text-[11px] font-medium";

/**
 * Spaces that Intl places differently across ICU builds: a thin space (U+2009) around the
 * dash in a range, and a narrow no-break space (U+202F). A regular no-break space is left
 * alone: it is the same on server and browser, and it keeps a number and its unit together,
 * as in "10 km".
 */
const INTL_SPACES = /[\u2009\u202f]/g;

/**
 * Calendar heading: the month, or the range of months, above the grid.
 *
 * The text comes from react-aria (`HeadingContext`), where it is `formatRange` from Intl, and
 * Intl differs between server and browser: ICU in Node puts thin spaces around the dash,
 * Chrome puts regular ones. A server-rendered `RangeCalendar` with two months did not pass
 * hydration (React #418). Here the spaces are normalized to regular ones, so the string is
 * the same on both sides.
 */
export function CalendarHeading() {
  const title = useSlottedContext(HeadingContext)?.children;
  return (
    <Heading className="text-fg-1 grow text-center text-[13px] font-semibold">
      {typeof title === "string" ? title.replace(INTL_SPACES, " ") : title}
    </Heading>
  );
}

/**
 * Today's date — browser only, after mount.
 *
 * On the server "today" is unknown: static pages are built on another day and in another
 * time zone, so the dot in the HTML would sit on a different day than the reader's, and
 * hydration would mismatch on the cell classes. The first frame renders without the dot.
 */
export function useToday(): CalendarDate | null {
  const [now, setNow] = useState<CalendarDate | null>(null);
  useEffect(() => setNow(today(getLocalTimeZone())), []);
  return now;
}

/**
 * Single-date calendar.
 *
 * Behavior comes from `react-aria-components`: keyboard, the `grid` role, the full date
 * announced for each cell, locale and first day of the week. A home-made implementation would
 * be not a primitive but a second library, the same reasoning Radix applies to tooltips and
 * popovers (ADR-0004).
 *
 * Today is marked with a dot under the number rather than with a fill: the fill is taken by the
 * selected value, and two different states cannot be told apart by the same means.
 */
export function Calendar({
  className,
  locale,
  value,
  defaultValue,
  onChange,
  minValue,
  maxValue,
  defaultFocusedValue,
  ...props
}: CalendarProps) {
  const now = useToday();

  /*
    The calendar's own `I18nProvider` is rendered ONLY when the `locale` prop is passed.
    Up to 2.0.0 it was always there, hard-coded to `ru-RU`, so the calendar overrode the app's
    locale with its own. Now, without the prop, the locale comes from above: from the kit's
    `UiProvider`, from the consumer's `I18nProvider`, or from the browser.
  */
  const calendar = (
    <CalendarRac
      {...props}
      value={toDateValue(value)}
      defaultValue={toDateValue(defaultValue)}
      onChange={onChange && ((next) => onChange(next, toIsoDate(next)))}
      minValue={toDateBound(minValue)}
      maxValue={toDateBound(maxValue)}
      defaultFocusedValue={toDateBound(defaultFocusedValue)}
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

      <CalendarGrid>
        <CalendarGridHeader>
          {(day) => <CalendarHeaderCell className={WEEKDAY_CELL_CLASS}>{day}</CalendarHeaderCell>}
        </CalendarGridHeader>
        <CalendarGridBody className="[&_td]:px-0">
          {(date) => (
            <CalendarCell
              date={date}
              className={cn(
                "text-fg-1 relative flex size-9 cursor-pointer items-center justify-center rounded-lg border border-transparent p-0 text-[13px] font-normal outline-none",
                "duration-fast transition-colors",
                "data-[hovered]:bg-bg-3 data-[hovered]:text-fg-0",
                "data-[selected]:bg-accent data-[selected]:text-text-on-accent data-[selected]:border-transparent",
                "data-[disabled]:pointer-events-none data-[disabled]:opacity-30",
                "data-[unavailable]:pointer-events-none data-[unavailable]:line-through data-[unavailable]:opacity-30",
                "data-[focus-visible]:outline-accent-strong data-[focus-visible]:outline data-[focus-visible]:outline-2",
                now !== null &&
                  date.compare(now) === 0 &&
                  "after:bg-accent data-[selected]:after:bg-text-on-accent after:absolute after:bottom-1 after:left-1/2 after:size-[3px] after:-translate-x-1/2 after:rounded-full"
              )}
            />
          )}
        </CalendarGridBody>
      </CalendarGrid>
    </CalendarRac>
  );

  return locale ? <I18nProvider locale={locale}>{calendar}</I18nProvider> : calendar;
}
