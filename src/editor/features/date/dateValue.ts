/*
  THE DATE MENTION'S VALUE (ADR-0079): the strict form of `<time datetime>` and its parts. The
  module is server-side, like `mathNames.ts`: strings in, strings and numbers out, with no React,
  Tiptap, `Intl` or the kit's date library. The Schema (`schema.ts`), the sanitizer and the Tool's
  descriptor in the start bundle read it, so the Editor and the server cleanup accept exactly the
  same values.

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
