import { parseDate } from "@internationalized/date";
import { describe, expect, test } from "vitest";
import {
  DEFAULT_PERIOD_PRESETS,
  formatPeriodLength,
  isRelativePeriod,
  periodLength,
  RELATIVE_PERIODS,
  resolvePeriod,
  type RelativePeriod,
} from "../src/lib/period.js";

/**
 * "Today" is passed explicitly in every calculation check.
 *
 * Without it the test would depend on the day it runs: `lastMonth` in March and in May
 * are different ranges, and a failure on the first day of a month would look random.
 * That is why `resolvePeriod` takes `now` as its third argument.
 */
const TODAY = parseDate("2026-03-15");

describe("resolvePeriod", () => {
  test.each([
    ["7d", "2026-03-09", "2026-03-15"],
    ["30d", "2026-02-14", "2026-03-15"],
    ["90d", "2025-12-16", "2026-03-15"],
    ["180d", "2025-09-17", "2026-03-15"],
    ["365d", "2025-03-16", "2026-03-15"],
    ["thisMonth", "2026-03-01", "2026-03-15"],
    ["lastMonth", "2026-02-01", "2026-02-28"],
    ["thisYear", "2026-01-01", "2026-03-15"],
  ] as const)("%s → %s..%s", (period, start, end) => {
    expect(resolvePeriod(period, undefined, TODAY)).toEqual({ start, end });
  });

  /**
   * The count includes today, so "7 days" is exactly seven dates, not eight.
   * An off-by-one error is invisible to the eye here and shows up in a report.
   */
  test("day periods contain exactly as many dates as they promise", () => {
    for (const [period, days] of [
      ["7d", 7],
      ["30d", 30],
      ["90d", 90],
      ["180d", 180],
      ["365d", 365],
    ] as const) {
      expect(periodLength(resolvePeriod(period, undefined, TODAY))).toBe(days);
    }
  });

  /** February's length, a leap year, and a range that crosses the year boundary. */
  test.each([
    ["2026-03-15", "2026-02-01", "2026-02-28"],
    ["2024-03-15", "2024-02-01", "2024-02-29"],
    ["2026-05-31", "2026-04-01", "2026-04-30"],
    ["2026-01-10", "2025-12-01", "2025-12-31"],
  ])("lastMonth from %s → %s..%s", (today, start, end) => {
    expect(resolvePeriod("lastMonth", undefined, parseDate(today))).toEqual({ start, end });
  });

  test("an unknown period does not turn into a “filter without bounds”", () => {
    // The cast repeats what a consumer does when it forgets the check: a failure
    // at the boundary is more honest than an empty result three lines below.
    expect(() => resolvePeriod("30days" as RelativePeriod, undefined, TODAY)).toThrow(
      /Unknown period/
    );
  });
});

describe("isRelativePeriod", () => {
  test("lets every declared period through", () => {
    for (const period of RELATIVE_PERIODS) expect(isRelativePeriod(period)).toBe(true);
  });

  test.each([["30days"], ["30D"], [""], ["7d "], [null], [undefined], [30], [{}]])(
    "rejects %o",
    (value) => {
      expect(isRelativePeriod(value)).toBe(false);
    }
  );

  test("every default preset is a valid period", () => {
    for (const preset of DEFAULT_PERIOD_PRESETS) expect(isRelativePeriod(preset.period)).toBe(true);
  });
});

describe("periodLength", () => {
  test("both bounds are inclusive: one day is one day", () => {
    expect(periodLength({ start: "2026-03-12", end: "2026-03-12" })).toBe(1);
  });

  /**
   * The calculation runs in UTC, which guards against daylight saving time: in the local
   * time zone a switch day lasts 23 or 25 hours, and dividing by 86 400 000 would give
   * 30.96 days instead of 31.
   */
  test("a daylight-saving switch does not shift the length", () => {
    // In the US the clocks change on March 8, 2026; in Europe, on March 29.
    expect(periodLength({ start: "2026-03-01", end: "2026-03-31" })).toBe(31);
    expect(periodLength({ start: "2026-10-20", end: "2026-11-05" })).toBe(17);
  });

  test("an inverted range yields no negative length", () => {
    expect(periodLength({ start: "2026-03-20", end: "2026-03-12" })).toBe(1);
  });
});

/**
 * The `DateRange` bounds are plain strings, and they come from the URL just like the period.
 * `isRelativePeriod` and the `default` branch in `resolvePeriod` exist for exactly that
 * reason; `periodLength` had no such guard and threw `parseDate` straight into the render of
 * the caption under the calendar.
 */
describe("the length of a period does not throw on a hand-edited bound", () => {
  test.each([
    ["", ""],
    ["zzz", "2024-01-01"],
    ["2024-01-01", "2024-02-30"],
  ])("bounds %o / %o give nothing to show rather than an exception", (start, end) => {
    expect(() => periodLength({ start, end })).not.toThrow();
    expect(periodLength({ start, end })).toBe(0);
  });

  test("an unshowable length renders as an empty string, not as “1 day”", () => {
    // An empty string is hidden by `empty:hidden` on the caption; "1 day" under the
    // calendar with garbage in the bounds would be a confident lie.
    expect(formatPeriodLength({ start: "", end: "" })).toBe("");
  });
});
