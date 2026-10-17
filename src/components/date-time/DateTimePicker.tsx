"use client";

import type { DateInput } from "../../lib/date.js";
import { DatePicker } from "./DatePicker.js";
import { TimePicker } from "./TimePicker.js";

// These functions used to live in this file; the re-export keeps the public API intact.
export { maskTime, normalizeTime } from "../../lib/time.js";

export interface DateTimePickerProps {
  /** Date in ISO format `YYYY-MM-DD`. */
  date?: string | null;
  /** Time in `HH:MM` format. */
  time?: string | null;
  /** Called with the ISO date `YYYY-MM-DD` when a day is selected in the calendar. */
  onDateChange: (date: string) => void;
  /** Called with the time `HH:MM` when the input is finished or a slot is selected from the list. */
  onTimeChange: (time: string) => void;
  /** Disables both fields: the date and the time. */
  disabled?: boolean;
  /**
   * The bounds are calendar bounds, that is, per day, and do not apply to time.
   *
   * Calendar cells are `CalendarDate` values with no time, and the comparison works by day:
   * `parseDate("2026-09-11").compare(parseDateTime("2026-09-11T14:00"))` is
   * zero. So `minValue={…T14:00}` meant as "not earlier than an hour from now" does NOT
   * WORK: the same day at nine in the morning gets through.
   *
   * The component does not accept time bounds on purpose. "Not earlier than an hour from now"
   * is a business rule, not a property of the field: it depends on the time zone, which the kit
   * deliberately does not know (see `timeZoneLabel`), and on the moment of submission, not of
   * rendering. The consumer validates it, in the same place where it validates the rest
   * of the form.
   *
   * The value is an ISO string `YYYY-MM-DD`, like `date`; an `@internationalized/date` object
   * is accepted too.
   */
  minValue?: DateInput;
  /**
   * Latest available day. Like `minValue`, the bound is calendar-based and does not apply
   * to time.
   */
  maxValue?: DateInput;
  /**
   * Time zone label shown to the right of the time: `MSK`, `UTC`.
   *
   * A prop, not a string in the markup. Before the move into the package, the code hardcoded
   * `(MSK)`: a label with no link to the zone the server actually publishes in. The package
   * does not know the zone and must not: it shows what it is given, and by default nothing.
   */
  timeZoneLabel?: string;
  /** Hour cycle of the time field: `24` (default) or `12`, as in `TimePicker`. */
  hourCycle?: 12 | 24;
  /**
   * Locale of the date label and the calendar; defaults to the `UiProvider` locale.
   * Does not affect the time field.
   */
  locale?: string;
}

/**
 * Date and time on one line.
 *
 * The time is a `TimePicker`: the same masked field that used to live here (input is
 * normalized on blur, not on every keystroke), plus a list of time slots.
 */
export function DateTimePicker({
  date,
  time,
  onDateChange,
  onTimeChange,
  disabled,
  minValue,
  maxValue,
  timeZoneLabel,
  hourCycle,
  locale,
}: DateTimePickerProps) {
  return (
    <div className="flex items-center gap-2">
      <DatePicker
        value={date}
        onChange={onDateChange}
        disabled={disabled}
        minValue={minValue}
        maxValue={maxValue}
        locale={locale}
      />

      <span className="text-fg-4">·</span>

      <TimePicker value={time} onChange={onTimeChange} hourCycle={hourCycle} disabled={disabled} />

      {timeZoneLabel ? <span className="text-fg-3 text-[13px]">({timeZoneLabel})</span> : null}
    </div>
  );
}
