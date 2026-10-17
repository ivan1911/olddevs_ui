import { getLocalTimeZone, parseDate, today } from "@internationalized/date";
import { renderToString } from "react-dom/server";
import { expect, test } from "vitest";
import { Calendar } from "../src/components/date-time/Calendar.js";
import { RangeCalendar } from "../src/components/date-time/RangeCalendar.js";

/*
  The calendar heading is `formatRange` from Intl inside react-aria, and Intl differs
  between the server and the browser: ICU in Node puts thin spaces around the dash
  (U+2009), while Chrome uses regular spaces. A `RangeCalendar` rendered on the server
  with two months failed hydration (React #418, OLDSUI-171). The test runs in Node, where
  the thin spaces do appear.
*/
const THIN_SPACES = /[\u2009\u202f]/;

/** The class of the "today" dot under the number. */
const TODAY_MARK = "after:size-[3px]";

function heading(html: string): string {
  return /<h2[^>]*aria-hidden="true"[^>]*>([^<]*)<\/h2>/.exec(html)?.[1] ?? "";
}

test("the two-month RangeCalendar heading uses plain spaces on the server", () => {
  const html = renderToString(
    <RangeCalendar
      aria-label="Period"
      locale="en-US"
      months={2}
      defaultFocusedValue={parseDate("2026-03-01")}
    />
  );
  expect(heading(html)).toBe("March – April 2026");
  expect(heading(html)).not.toMatch(THIN_SPACES);
});

/*
  "Today" is unknown on the server: the static HTML is built on another day and in
  another time zone, so the dot under the number would sit on a different day than the
  reader's. The browser places the dot after mounting.
*/
test("the server HTML marks no day as today", () => {
  const month = today(getLocalTimeZone());
  for (const calendar of [
    <Calendar key="day" aria-label="Day" defaultFocusedValue={month} />,
    <RangeCalendar key="range" aria-label="Period" defaultFocusedValue={month} />,
  ])
    expect(renderToString(calendar)).not.toContain(TODAY_MARK);
});
