// @vitest-environment jsdom
import createDOMPurify from "dompurify";
import { expect, test } from "vitest";
import { RICH_TEXT_SCHEMA, sanitizeRichText } from "../src/editor/schema-entry.js";
import { composeDatetime, isDatetime, parseDatetime } from "../src/editor/features/date/dateValue.js";

/**
 * Date mentions in the sanitizer (OLDSUI-309, ADR-0079): `time[datetime]` with a strict value,
 * a real DOMPurify on jsdom, as on the consumer's server.
 */

const purify = createDOMPurify(window);
const clean = (html: string) => sanitizeRichText(html, purify);

test("a date mention the Editor writes passes unchanged", () => {
  const html =
    '<p>On <time datetime="2026-10-18">Oct 18, 2026</time> and ' +
    '<time datetime="2026-10-18T15:00+03:00">Oct 18, 2026, 3:00 PM</time>.</p>';

  expect(clean(html)).toBe(html);
});

test("the Schema lists the tag and its attribute", () => {
  expect(RICH_TEXT_SCHEMA.marks).toContain("time");
  expect(RICH_TEXT_SCHEMA.attributes.time).toEqual(["datetime"]);
});

test.each([
  ["a year", "2026"],
  ["a month", "2026-10"],
  ["a week", "2026-W42"],
  ["a period", "P3D"],
  ["a time without a date", "15:00"],
  ["a time without an offset", "2026-10-18T15:00"],
  ["a UTC designator", "2026-10-18T15:00Z"],
  ["seconds", "2026-10-18T15:00:30+03:00"],
  ["a space instead of T", "2026-10-18 15:00+03:00"],
  ["a day that does not exist", "2026-02-29"],
  ["month 13", "2026-13-01"],
  ["hour 24", "2026-10-18T24:00+03:00"],
  ["minute 60", "2026-10-18T15:60+03:00"],
  ["year zero", "0000-01-01"],
  ["garbage", "tomorrow"],
])("%s is not a date mention: the wrapper goes, the text stays", (_name, value) => {
  expect(clean(`<p>a <time datetime="${value}">some <strong>text</strong></time> b</p>`)).toBe(
    "<p>a some <strong>text</strong> b</p>"
  );
});

test("a leap day passes, and so does a date at the end of a month", () => {
  expect(clean('<p><time datetime="2028-02-29">x</time></p>')).toBe(
    '<p><time datetime="2028-02-29">x</time></p>'
  );
  expect(clean('<p><time datetime="2026-04-30">x</time></p>')).toBe(
    '<p><time datetime="2026-04-30">x</time></p>'
  );
  expect(clean('<p><time datetime="2026-04-31">x</time></p>')).toBe("<p>x</p>");
});

test("the element keeps only text: marks, links and tags inside it are cut", () => {
  expect(
    clean('<p><time datetime="2026-10-18"><a href="https://example.com">18</a> <i>Oct</i></time></p>')
  ).toBe('<p><time datetime="2026-10-18">18 Oct</time></p>');
});

test("`datetime` on another tag does not pass", () => {
  expect(clean('<p><span datetime="2026-10-18">x</span><del datetime="2026-10-18">y</del></p>')).toBe(
    "<p>xy</p>"
  );
  expect(clean('<p><mark data-color="red" datetime="2026-10-18">x</mark></p>')).toBe(
    '<p><mark data-color="red">x</mark></p>'
  );
});

test("a `time` without datetime is only a wrapper", () => {
  expect(clean("<p><time>noon</time></p>")).toBe("<p>noon</p>");
});

test("the value check is one function for the Editor and the sanitizer", () => {
  expect(isDatetime("2026-10-18")).toBe(true);
  expect(isDatetime("2026-10-18T15:00+03:00")).toBe(true);
  expect(isDatetime("2026-10-18T15:00-11:30")).toBe(true);
  expect(isDatetime("2026-10-18T15:00Z")).toBe(false);
  expect(parseDatetime("2026-10-18T15:05+03:00")).toEqual({
    year: 2026,
    month: 10,
    day: 18,
    time: { hour: 15, minute: 5, offset: "+03:00" },
  });
  expect(parseDatetime("2026-10-18")).toEqual({ year: 2026, month: 10, day: 18 });
});

test("a value is composed from a date and a time, with the zone of the browser", () => {
  expect(composeDatetime("2026-10-18")).toBe("2026-10-18");
  expect(composeDatetime("2026-02-29")).toBeNull();
  expect(composeDatetime("2026-10-18", "9:00")).toBeNull();
  expect(composeDatetime("2026-10-18", "09:00")).toMatch(/^2026-10-18T09:00[+-]\d\d:\d\d$/);
  // The offset is the browser's at that moment, and the result is always in our form.
  expect(isDatetime(composeDatetime("2026-01-05", "23:59")!)).toBe(true);
});
