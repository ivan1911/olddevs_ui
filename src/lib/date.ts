import { type CalendarDate, parseDate } from "@internationalized/date";
import type { DateValue } from "react-aria-components";

/**
 * Parse an ISO date without throwing on an unparseable value.
 *
 * `parseDate` throws TWO different exceptions, and both are reachable from the URL:
 * `parseDate("nonsense")` gives `Error: Invalid ISO 8601 date string`, and
 * `parseDate("2026-02-29")` gives `RangeError: Value out of range`, because 2026 is not a leap year.
 * The second is especially treacherous: the string looks correct, and a link carrying it works until
 * the first non-leap year.
 *
 * Extracted when it turned out that the guard sat in one of three places.
 * `DateRangePicker` wrapped the parse in `try/catch`, and its comment claimed that the neighboring
 * `DatePicker` shows a placeholder on the same input. But `DatePicker` parsed the value with an
 * expression in a JSX child, that is, on every render and with no guard at all. The comment described
 * an invariant that did not exist: that is exactly how three copies of one idea drift apart.
 *
 * `@internal`: not exported from the package. The consumer has the library's `parseDate`, and the kit
 * must not decide for them what to do with an unparseable value.
 */
export function parseDateOrNull(value: string | null | undefined): CalendarDate | null {
  if (!value) return null;
  try {
    return parseDate(value);
  } catch {
    return null;
  }
}

/**
 * A date in either of the two forms the kit's calendars accept: an ISO string `YYYY-MM-DD`
 * or an `@internationalized/date` object.
 *
 * The string is needed by a consumer that does not have this package. `@internationalized/date` is not
 * among the kit's public entry points, and for a single `minValue` bound there is no reason to pull it
 * into the application's dependencies. The object form stays, since it is already in use.
 */
export type DateInput = DateValue | string;

/**
 * Converts a `DateInput` to a calendar object.
 *
 * `undefined` and `null` pass straight through. In react-aria these are different things
 * (`value={undefined}` is an uncontrolled field, `value={null}` is a controlled empty one), and the
 * difference must not be erased here. An unparseable string gives `null`: "no value", not an exception,
 * as `DatePicker` does with garbage from the URL.
 */
export function toDateValue(value: DateInput | null | undefined): DateValue | null | undefined {
  if (value === undefined || value === null) return value;
  return typeof value === "string" ? parseDateOrNull(value) : value;
}

/**
 * The same for a bound and for the focus value: empty and unparseable are equally "not set".
 * A bound made of garbage must not turn into `null`: react-aria reads `null` as a type error,
 * not as an absence.
 */
export function toDateBound(value: DateInput | undefined): DateValue | undefined {
  return toDateValue(value) ?? undefined;
}

/** The calendar day of a calendar object, as an ISO string `YYYY-MM-DD`. */
export function toIsoDate(value: DateValue): string {
  // `toString()` of `CalendarDateTime` and `ZonedDateTime` carries the time and the zone;
  // only the day goes out, as it does for `DatePicker`.
  return value.toString().slice(0, 10);
}

/** A range in either form: a pair of ISO strings or `{ start, end }` objects. */
export interface DateRangeInput {
  start: DateInput;
  end: DateInput;
}

/** A pair of range bounds as calendar objects. Half a range is not a range. */
export function toRangeValue(
  value: DateRangeInput | null | undefined
): { start: DateValue; end: DateValue } | null | undefined {
  if (value === undefined || value === null) return value;
  const start = toDateValue(value.start);
  const end = toDateValue(value.end);
  return start && end ? { start, end } : null;
}
