// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { parseDate } from "@internationalized/date";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { DateRangePicker } from "../src/components/date-time/DateRangePicker.js";

/*
  `matchMedia` does not exist in jsdom, but `DateRangePicker` asks it to decide
  whether to show one month or two. The stub answers "narrow", meaning one month,
  so the test markup does not depend on the window width.
*/
beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  });
});

afterEach(cleanup);

/**
 * A reversed range from the URL is not a value.
 *
 * It cannot be selected with the calendar, but it can be built by hand. Both dates
 * were parsed, the trigger showed "10 Mar 2026 — 01 Mar 2026", the calendar
 * highlighted nothing, and the caption below via `periodLength` confidently
 * reported "1 day".
 */
test("an inverted range from the address shows the placeholder", () => {
  render(
    <DateRangePicker
      value={{ start: "2026-03-10", end: "2026-03-01" }}
      onChange={() => {}}
      placeholder="Pick a period"
    />
  );

  expect(screen.getAllByRole("button")[0]!.textContent).toContain("Pick a period");
});

test("a correct range is still shown", () => {
  render(
    <DateRangePicker
      value={{ start: "2026-03-01", end: "2026-03-10" }}
      onChange={() => {}}
      placeholder="Pick a period"
    />
  );

  expect(screen.getAllByRole("button")[0]!.textContent).not.toContain("Pick a period");
});

/**
 * A preset is clamped to the field's bounds.
 *
 * `resolvePeriod` counts from "today" and passed the result to `onChange` without
 * a check: the limits applied only to the calendar, and "365 days" went past
 * `minValue`, so a range went out that cannot be selected in the calendar at all.
 */
test("a preset is clamped to minValue", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();

  render(
    <DateRangePicker
      value={null}
      onChange={onChange}
      placeholder="Pick a period"
      minValue={parseDate("2026-01-01")}
    />
  );

  await user.click(screen.getAllByRole("button")[0]!);
  await user.click(screen.getByRole("button", { name: "Year" }));

  const [range] = onChange.mock.calls.at(-1) ?? [];
  expect((range as { start: string }).start >= "2026-01-01").toBe(true);
});

/**
 * A preset that falls entirely outside the bounds does not yield a reversed range.
 *
 * `clampRange` moved the ends independently: with `minValue` set to the first day
 * of the current month, "last month" went out as `{start: "2026-09-01", end:
 * "2026-08-31"}`, a value that cannot be valid, which the consumer wrote to the URL
 * and to the request. Meanwhile the trigger showed the preset's label, the calendar
 * highlighted nothing, and the length caption was hidden by `empty:hidden`: an impossible
 * value went out, but on screen everything looked selected.
 */
test("a preset entirely outside the bounds is not reported at all", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();

  // Data is available only from the first day of the current month.
  const firstOfThisMonth = `${new Date().toISOString().slice(0, 7)}-01`;

  render(
    <DateRangePicker
      value={null}
      onChange={onChange}
      placeholder="Pick a period"
      minValue={parseDate(firstOfThisMonth)}
    />
  );

  await user.click(screen.getAllByRole("button")[0]!);
  await user.click(screen.getByRole("button", { name: "Last month" }));

  for (const [range] of onChange.mock.calls) {
    const { start, end } = range as { start: string; end: string };
    expect(start <= end).toBe(true);
  }
});
