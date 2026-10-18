/*
  THE DATE MENTION'S VALUE (ADR-0079): the strict form of `<time datetime>` and the arithmetic
  around it. The module is server-side, like `mathNames.ts`: strings in, strings and numbers out,
  with no React, Tiptap, `Intl` or the kit's date library. The Schema (`schema.ts`), the sanitizer,
  the Tool's descriptor in the start bundle and the lazy popover all read it, so the Editor and the
  server cleanup accept exactly the same values.

  TWO FORMS ONLY. `YYYY-MM-DD` (a calendar date, no zone: it does not shift by a day for any
  reader) and `YYYY-MM-DDTHH:MM±HH:MM` (a date with the time and the author's UTC offset). The HTML
  allows many more (a year, a week, a period, a time without a date, `Z`, seconds); those are not
  ours, and a `<time>` in such a form stays ordinary text. The kit does not know time zones
  (ADR-0008): the offset is data inside the string, never recalculated.
*/

/** The tag of a date mention in the Document's HTML. */
export const DATE_TAG = "time";
/** The attribute with the machine-readable value: the mention's only data besides its text. */
export const DATE_ATTRIBUTE = "datetime";
/** The selector of a date mention in the HTML. */
export const DATE_SELECTOR = `${DATE_TAG}[${DATE_ATTRIBUTE}]`;
/** The node name of a date mention in the engine's Schema. */
export const DATE_NODE = "date";

/** `YYYY-MM-DD`, optionally followed by `THH:MM±HH:MM`. Groups: date parts, time, offset. */
const DATETIME = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})([+-])(\d{2}):(\d{2}))?$/;

/** A date mention's value, taken apart. */
export interface DateParts {
  year: number;
  month: number;
  day: number;
  /** Present only for a date with a time. */
  time?: { hour: number; minute: number; offset: string };
}

/** Days in a month of the proleptic Gregorian calendar (February follows the leap year rule). */
function daysIn(year: number, month: number): number {
  if (month === 2) return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

/**
 * Takes a `datetime` value apart, or `null` if it is not in our form. The check is strict and
 * calendar-aware: `2026-02-29` and `2026-10-18T24:00+03:00` are not values, so neither the Editor
 * nor the sanitizer lets them through. Year 0000 does not exist in the HTML calendar either.
 */
export function parseDatetime(value: string): DateParts | null {
  const match = DATETIME.exec(value);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > daysIn(year, month)) return null;
  if (match[4] === undefined) return { year, month, day };
  const [hour, minute] = [Number(match[4]), Number(match[5])];
  const [offsetHour, offsetMinute] = [Number(match[7]), Number(match[8])];
  if (hour > 23 || minute > 59 || offsetHour > 23 || offsetMinute > 59) return null;
  return { year, month, day, time: { hour, minute, offset: `${match[6]}${match[7]}:${match[8]}` } };
}

/** Whether the string is a date mention's value: the one check of the Schema and the sanitizer. */
export function isDatetime(value: string): boolean {
  return parseDatetime(value) !== null;
}

const two = (value: number) => String(value).padStart(2, "0");

/** A calendar date as `YYYY-MM-DD`. */
export function isoDate(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${two(month)}-${two(day)}`;
}

/**
 * The UTC offset of the browser's zone at the given local moment, as `±HH:MM`. Zones with a
 * non-whole-hour offset keep their minutes (`+05:30`). The offset belongs to the moment, not to the
 * zone: a date in summer and a date in winter of one zone differ.
 */
export function localOffset(year: number, month: number, day: number, time: string): string {
  const [hour = 0, minute = 0] = time.split(":").map(Number);
  const moment = new Date(year, month - 1, day, hour, minute);
  // `Date` reads years 0–99 as 1900+: the legacy rule is overridden, as `formatDate` does.
  moment.setFullYear(year);
  const minutes = -moment.getTimezoneOffset();
  const sign = minutes < 0 ? "-" : "+";
  const absolute = Math.abs(minutes);
  return `${sign}${two(Math.floor(absolute / 60))}:${two(absolute % 60)}`;
}

/**
 * Assembles a `datetime` value: a date, or a date with a time and the author's offset. `time` is
 * `HH:MM`. The offset is the browser's, taken at the moment of insertion (ADR-0079, item 4): the
 * kit does not store or recalculate zones, it only writes down the author's.
 */
export function composeDatetime(date: string, time?: string): string | null {
  const parts = parseDatetime(date);
  if (!parts || parts.time) return null;
  if (time === undefined) return date;
  if (!/^\d{2}:\d{2}$/.test(time)) return null;
  const value = `${date}T${time}${localOffset(parts.year, parts.month, parts.day, time)}`;
  return isDatetime(value) ? value : null;
}

/** `HH:MM` of a value with a time; `null` for a date without one. */
export function timeOf(value: string): string | null {
  const parts = parseDatetime(value);
  return parts?.time ? `${two(parts.time.hour)}:${two(parts.time.minute)}` : null;
}

/** The `YYYY-MM-DD` part of a valid value; `null` if the value is not ours. */
export function dateOf(value: string): string | null {
  const parts = parseDatetime(value);
  return parts ? isoDate(parts.year, parts.month, parts.day) : null;
}
