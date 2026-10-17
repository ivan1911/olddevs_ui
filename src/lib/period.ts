import { getLocalTimeZone, today, type CalendarDate } from "@internationalized/date";
import { parseDateOrNull } from "./date.js";
import { DEFAULT_MESSAGES } from "../i18n/defaults.js";
import type { UiMessages } from "../i18n/messages.js";

/** Bounds of the range in ISO format `YYYY-MM-DD`, both inclusive. */
export interface DateRange {
  start: string;
  end: string;
}

/**
 * A relative period: what the user actually means by choosing "last 30 days".
 *
 * Storing a frozen date range in its place would turn a link sent to a colleague into
 * "30 days before the Tuesday it was generated on". So the URL carries `period=30d`, and it
 * expands into absolute bounds at the moment of the request. The decision is ADR-0008.
 */
export const RELATIVE_PERIODS = [
  "7d",
  "30d",
  "90d",
  "180d",
  "365d",
  "thisMonth",
  "lastMonth",
  "thisYear",
] as const;

export type RelativePeriod = (typeof RELATIVE_PERIODS)[number];

/**
 * Checks a period that came from outside.
 *
 * The list is needed at runtime, not only as a type: the period lives in the URL, and URLs
 * are edited by hand. For the compiler, `?period=30days` is an ordinary `string`. The consumer
 * casts it to `RelativePeriod` because the package leaves it no other way, and there is
 * nothing to expand after that. So the boundary is checked here, before `resolvePeriod`.
 */
export function isRelativePeriod(value: unknown): value is RelativePeriod {
  return RELATIVE_PERIODS.includes(value as RelativePeriod);
}

const iso = (date: CalendarDate): string => date.toString();

/**
 * Expands a relative period into concrete dates.
 *
 * The count includes today: "7 days" is today and the six days before it, not eight dates
 * in the range. The exception is `lastMonth`: it lies entirely in the past and ends on the
 * last day of the previous month.
 *
 * Periods that end today include an incomplete day: for "30 days" the last day is always
 * shorter than the others. This shows on a chart. It is a property of the period, not an
 * error in the calculation.
 *
 * The default time zone is the browser's local one. A consumer with its own reporting time
 * zone passes it explicitly. `now` is overridden only in tests: without it, every check of
 * the calculation would depend on the day the test run happens to fall on.
 */
export function resolvePeriod(
  period: RelativePeriod,
  timeZone?: string,
  now: CalendarDate = today(timeZone ?? getLocalTimeZone())
): DateRange {
  switch (period) {
    case "7d":
    case "30d":
    case "90d":
    case "180d":
    case "365d": {
      const days = Number(period.slice(0, -1));
      return { start: iso(now.subtract({ days: days - 1 })), end: iso(now) };
    }
    case "thisMonth":
      return { start: iso(now.set({ day: 1 })), end: iso(now) };
    case "lastMonth": {
      const prev = now.set({ day: 1 }).subtract({ months: 1 });
      return { start: iso(prev), end: iso(prev.set({ day: prev.calendar.getDaysInMonth(prev) })) };
    }
    case "thisYear":
      return { start: iso(now.set({ month: 1, day: 1 })), end: iso(now) };
    default:
      // For the compiler this branch is unreachable, and that is the whole point: the
      // exhaustiveness guarantee exists only at build time. At runtime the period comes from
      // the URL, so here it has either already been checked by `isRelativePeriod`, or the call
      // is a bug. Better to learn about a bug right away than to get `undefined` and fail on
      // it further down.
      // This is the text of an exception, not a UI string: a developer reads it in the stack
      // trace, not a user on the screen. It does not go into the message catalog.
      throw new Error(`Unknown period: ${String(period)}`);
  }
}

export interface PeriodPreset {
  label: string;
  period: RelativePeriod;
}

/** Order of the presets; the labels come from the message catalog. */
const PRESET_ORDER = ["7d", "30d", "90d", "thisMonth", "lastMonth", "365d"] as const;

/**
 * Default presets. The list is deliberately short: a column of ten rows stops being a fast
 * path and becomes one more list to read.
 *
 * A function, not a constant: a preset label is a user-visible string, so it must go through
 * the message catalog. The component calls `periodPresets(messages)`. Without an argument the
 * English fallback is returned, so a call from code without a provider does not break.
 */
export function periodPresets(messages: UiMessages = DEFAULT_MESSAGES): readonly PeriodPreset[] {
  return PRESET_ORDER.map((period) => ({ label: messages.period.presets[period], period }));
}

/**
 * @deprecated Since 2.0.0. The labels here are in English and ignore the locale. Call
 * `periodPresets(useMessages())` instead. Kept so that the consumer's call does not break at
 * the moment of the upgrade; removed in the next major version.
 */
export const DEFAULT_PERIOD_PRESETS: readonly PeriodPreset[] = periodPresets();

/**
 * Length of the range in days, both bounds inclusive; `0` means the bounds cannot be parsed.
 *
 * It is computed in UTC on purpose: UTC has no daylight saving transition, both bounds get
 * the same offset, and the difference is always a whole number of days. In the local time
 * zone the same calculation would be off by a day twice a year.
 *
 * A reversed range cannot be selected in the calendar, but it can be assembled by hand. That is
 * why the length never goes negative: "-8 days" under the calendar would look like the result
 * of the component's arithmetic, not like a sign that the input is invalid.
 */
export function periodLength(range: DateRange): number {
  const start = parseDateOrNull(range.start);
  const end = parseDateOrNull(range.end);
  // Zero means "nothing to show", and that is MORE HONEST than one: the bounds come from the
  // address bar, and "1 day" under a calendar with garbage in its bounds would be a confident
  // lie about something the component does not know.
  if (!start || !end) return 0;
  return Math.max(
    1,
    Math.round((end.toDate("UTC").getTime() - start.toDate("UTC").getTime()) / 86_400_000) + 1
  );
}

/**
 * The label "14 days" under the calendar: it makes clear that exactly two weeks are selected,
 * not thirteen or fifteen days.
 */
export function formatPeriodLength(
  range: DateRange,
  messages: UiMessages = DEFAULT_MESSAGES
): string {
  // The plural form is chosen by the LOCALE through `Intl.PluralRules`, not by a chain of
  // remainders here: the Russian catalog knows the rules (for example, 11–14 take the genitive
  // plural), and it is the catalog that must know them, not a shared function. A component that
  // computes word endings by hand handles only one language.
  const days = periodLength(range);
  // An empty string, not "0 days": it means "nothing to label", and the caller that renders
  // it suppresses the label. The kit knows nothing about the consumer's markup: the consumer
  // hides its own `DateRangePicker` wrapper (`empty:hidden` on the same element as the label).
  if (days === 0) return "";
  return messages.period.length({ days });
}
