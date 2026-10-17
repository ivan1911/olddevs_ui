// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { DatePicker } from "../src/components/date-time/DatePicker.js";

afterEach(cleanup);

/**
 * The field's value lives in the URL, as the component's docstring also says, and
 * people edit the URL by hand. `parseDate` throws both on garbage and on a date
 * that does not exist: `parseDate("2026-02-29")` throws a `RangeError`, because
 * 2026 is not a leap year.
 *
 * Before wave 26 the parsing was an expression in a JSX child, so it ran on
 * EVERY render, whether or not the popover was open, and one malformed link
 * took down the whole subtree. The neighbouring `DateRangePicker` is protected
 * from this, and its comment claimed that `DatePicker` shows a placeholder on
 * the same input. That claim was wrong.
 */
test.each(["2026-02-29", "2026-13-45", "not-a-date", "2026-09", ""])(
  "a hand-edited value %o shows the placeholder instead of bringing the tree down",
  (value) => {
    expect(() =>
      render(<DatePicker value={value} onChange={() => {}} placeholder="Choose a date" />)
    ).not.toThrow();

    expect(screen.getByRole("button").textContent).toContain("Choose a date");
  }
);

test("a valid value is still shown", () => {
  render(<DatePicker value="2026-09-11" onChange={() => {}} placeholder="Choose a date" />);

  expect(screen.getByRole("button").textContent).not.toContain("Choose a date");
});

/**
 * Years below one hundred.
 *
 * `parseDate` accepts them: `0026-03-05` is a valid ISO string, and the URL can
 * carry worse. Assembly, however, went through `new Date(y, m, d)`, where years
 * 0–99 are mapped to 1900+y by the legacy rule: strict parsing let the value
 * through, and the display still lied.
 */
test.each([
  ["0026-03-05", "1926"],
  ["0099-12-31", "1999"],
])("the year %o is not silently shifted into the 20th century", (value, wrong) => {
  render(<DatePicker value={value} onChange={() => {}} placeholder="Choose a date" />);

  expect(screen.getByRole("button").textContent).not.toContain(wrong);
});
