// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { parseDate, type CalendarDate } from "@internationalized/date";
import { afterAll, afterEach, beforeAll, expect, test, vi } from "vitest";
import { Calendar } from "../src/components/date-time/Calendar.js";
import { DatePicker } from "../src/components/date-time/DatePicker.js";
import { DateRangePicker } from "../src/components/date-time/DateRangePicker.js";
import { RangeCalendar } from "../src/components/date-time/RangeCalendar.js";

/*
  Строковое API календарей: границы, значение и ответ ходят ISO-строками
  `ГГГГ-ММ-ДД`, как у `DatePicker`/`DateRangePicker`, и потребителю не нужен
  `@internationalized/date`, чтобы их собрать. Объекты по-прежнему принимаются.
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
afterAll(() => vi.restoreAllMocks());

/** Ячейка дня мартовской сетки 2026 по полному имени, которое объявляет react-aria. */
const day = (n: number, weekday: string) =>
  screen.getByRole("button", { name: new RegExp(`^${weekday}, March ${n}, 2026`) });

const isUnavailable = (el: HTMLElement) => el.getAttribute("aria-disabled") === "true";

test("Calendar: minValue and maxValue as ISO strings disable days outside", () => {
  render(
    <Calendar
      aria-label="Day"
      locale="en-US"
      defaultFocusedValue={parseDate("2026-03-10")}
      minValue="2026-03-05"
      maxValue="2026-03-20"
    />
  );

  expect(isUnavailable(day(4, "Wednesday"))).toBe(true);
  expect(isUnavailable(day(5, "Thursday"))).toBe(false);
  expect(isUnavailable(day(20, "Friday"))).toBe(false);
  expect(isUnavailable(day(21, "Saturday"))).toBe(true);
});

test("Calendar: DateValue bounds still work", () => {
  render(
    <Calendar
      aria-label="Day"
      locale="en-US"
      defaultFocusedValue={parseDate("2026-03-10")}
      minValue={parseDate("2026-03-05")}
    />
  );

  expect(isUnavailable(day(4, "Wednesday"))).toBe(true);
  expect(isUnavailable(day(5, "Thursday"))).toBe(false);
});

test("Calendar: an unparsable bound is ignored instead of throwing", () => {
  render(
    <Calendar
      aria-label="Day"
      locale="en-US"
      defaultFocusedValue={parseDate("2026-03-10")}
      minValue="whatever"
      maxValue="2026-02-29"
    />
  );

  expect(isUnavailable(day(4, "Wednesday"))).toBe(false);
});

test("Calendar: a string value is shown and the ISO string comes second", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(<Calendar aria-label="Day" locale="en-US" value="2026-03-10" onChange={onChange} />);

  expect(day(10, "Tuesday").getAttribute("aria-label")).toContain("selected");

  await user.click(day(12, "Thursday"));
  const [picked, iso] = onChange.mock.calls.at(-1) as [CalendarDate, string];
  expect(picked.toString()).toBe("2026-03-12");
  expect(iso).toBe("2026-03-12");
});

test("Calendar: an object value keeps getting objects back", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(
    <Calendar aria-label="Day" locale="en-US" value={parseDate("2026-03-10")} onChange={onChange} />
  );

  await user.click(day(12, "Thursday"));
  const [picked] = onChange.mock.calls.at(-1) as [CalendarDate];
  expect(typeof picked).toBe("object");
  expect(picked.toString()).toBe("2026-03-12");
});

test("Calendar: an uncontrolled string defaultValue starts selected", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(
    <Calendar aria-label="Day" locale="en-US" defaultValue="2026-03-10" onChange={onChange} />
  );

  expect(day(10, "Tuesday").getAttribute("aria-label")).toContain("selected");
  await user.click(day(12, "Thursday"));
  expect(onChange.mock.calls.at(-1)?.[1]).toBe("2026-03-12");
});

test("RangeCalendar: minValue and maxValue as ISO strings disable days outside", () => {
  render(
    <RangeCalendar
      aria-label="Period"
      locale="en-US"
      defaultFocusedValue="2026-03-10"
      minValue="2026-03-05"
      maxValue="2026-03-20"
    />
  );

  expect(isUnavailable(day(4, "Wednesday"))).toBe(true);
  expect(isUnavailable(day(5, "Thursday"))).toBe(false);
  expect(isUnavailable(day(21, "Saturday"))).toBe(true);
});

test("RangeCalendar: a { start, end } string value is shown and the ISO range comes second", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(
    <RangeCalendar
      aria-label="Period"
      locale="en-US"
      value={{ start: "2026-03-10", end: "2026-03-12" }}
      onChange={onChange}
    />
  );

  expect(day(11, "Wednesday").getAttribute("aria-label")).toContain("selected");

  await user.click(day(16, "Monday"));
  await user.click(day(18, "Wednesday"));
  expect(onChange.mock.calls.at(-1)?.[1]).toEqual({ start: "2026-03-16", end: "2026-03-18" });
});

test("RangeCalendar: an object value keeps getting objects back", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(
    <RangeCalendar
      aria-label="Period"
      locale="en-US"
      value={{ start: parseDate("2026-03-10"), end: parseDate("2026-03-12") }}
      onChange={onChange}
    />
  );

  await user.click(day(16, "Monday"));
  await user.click(day(18, "Wednesday"));
  const [range] = onChange.mock.calls.at(-1) as [{ start: CalendarDate; end: CalendarDate }];
  expect(range.start.toString()).toBe("2026-03-16");
  expect(range.end.toString()).toBe("2026-03-18");
});

test("RangeCalendar: an unparsable string value shows nothing selected", () => {
  render(
    <RangeCalendar
      aria-label="Period"
      locale="en-US"
      value={{ start: "nonsense", end: "2026-03-12" }}
      defaultFocusedValue="2026-03-10"
      onChange={() => {}}
    />
  );

  expect(day(11, "Wednesday").getAttribute("aria-label")).not.toContain("selected");
});

test("DatePicker: minValue and maxValue accept ISO strings", async () => {
  const user = userEvent.setup();
  render(
    <DatePicker
      value="2026-03-10"
      onChange={() => {}}
      minValue="2026-03-05"
      maxValue="2026-03-20"
    />
  );

  await user.click(screen.getByRole("button"));
  expect(isUnavailable(screen.getByRole("button", { name: /^Wednesday, March 4, 2026/ }))).toBe(
    true
  );
  expect(isUnavailable(screen.getByRole("button", { name: /^Thursday, March 5, 2026/ }))).toBe(
    false
  );
});

test("DateRangePicker: minValue as an ISO string clamps presets", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(
    <DateRangePicker value={null} onChange={onChange} placeholder="Pick" minValue="2026-01-01" />
  );

  await user.click(screen.getAllByRole("button")[0]!);
  await user.click(screen.getByRole("button", { name: "Year" }));

  const [range] = onChange.mock.calls.at(-1) ?? [];
  expect((range as { start: string }).start >= "2026-01-01").toBe(true);
});

test("DateRangePicker: isDateUnavailable crosses out days in the calendar", async () => {
  const user = userEvent.setup();
  render(
    <DateRangePicker
      value={{ start: "2026-03-02", end: "2026-03-04" }}
      onChange={() => {}}
      locale="en-US"
      isDateUnavailable={(date) => date.toString() === "2026-03-11"}
    />
  );

  await user.click(screen.getAllByRole("button")[0]!);
  expect(isUnavailable(screen.getByRole("button", { name: /^Wednesday, March 11, 2026/ }))).toBe(
    true
  );
  expect(isUnavailable(screen.getByRole("button", { name: /^Thursday, March 12, 2026/ }))).toBe(
    false
  );
});
