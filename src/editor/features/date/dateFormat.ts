import { parseDatetime } from "./dateValue.js";

/*
  THE TEXT OF A DATE MENTION (ADR-0079, item 3). The Document holds the words the reader will see,
  written once, when the author inserts or edits the mention, in the author's locale. The View shows
  them as is, so a page reads the same without JS, in a letter and in a PDF, and never differs
  between the server and the browser. Intl runs only here, in the Editor.
*/

/**
 * The default `format` option: the one `formatDate` of the kit (`DatePicker`) uses, so a date in
 * the text looks like a date in a field.
 */
export const DEFAULT_DATE_FORMAT: Intl.DateTimeFormatOptions = {
  day: "2-digit",
  month: "short",
  year: "numeric",
};

/**
 * Spaces that Intl writes differently across ICU builds: a thin space (U+2009) and a narrow
 * no-break space (U+202F, before `PM` in English). Node and Chrome disagree about them
 * (`Calendar.tsx` fights the same thing), and the text goes into the saved HTML, so it is made of
 * ordinary spaces. A regular no-break space is the same everywhere and is left alone.
 */
const INTL_SPACES = /[  ]/g;

/**
 * The field names that carry a time or a zone. The mention's time comes from its value, and the kit
 * does not know zones (ADR-0008), so the `format` option may describe only the date.
 */
export const TIME_FORMAT_FIELDS = [
  "hour",
  "minute",
  "second",
  "fractionalSecondDigits",
  "timeStyle",
  "timeZone",
  "timeZoneName",
  "hourCycle",
  "hour12",
  "dayPeriod",
] as const;

/** Intl options for the value: the date part as the author set it, plus hours and minutes if there is a time. */
function optionsFor(
  format: Intl.DateTimeFormatOptions,
  withTime: boolean
): Intl.DateTimeFormatOptions {
  // `timeZone: "UTC"` together with a date built by `Date.UTC`: the calendar parts come out exactly as
  // they were typed, whatever the browser's zone and its daylight saving transitions.
  if (!withTime) return { ...format, timeZone: "UTC" };
  // `dateStyle` cannot be mixed with `hour`: its pair is `timeStyle`.
  if (format.dateStyle !== undefined) return { ...format, timeStyle: "short", timeZone: "UTC" };
  return { ...format, hour: "numeric", minute: "2-digit", timeZone: "UTC" };
}

/**
 * The text of a mention in the given locale, or an empty string if the value is not ours. Hours and
 * minutes follow the locale's own cycle (`15:00` in Russian, `3:00 PM` in English); the offset is
 * not shown.
 */
export function dateText(
  value: string,
  locale: string,
  format: Intl.DateTimeFormatOptions = DEFAULT_DATE_FORMAT
): string {
  const parts = parseDatetime(value);
  if (!parts) return "";
  const moment = new Date(0);
  // `Date.UTC` reads years 0–99 as 1900+: the legacy rule is overridden, as `formatDate` does.
  moment.setUTCFullYear(parts.year, parts.month - 1, parts.day);
  moment.setUTCHours(parts.time?.hour ?? 12, parts.time?.minute ?? 0, 0, 0);
  const options = optionsFor(format, parts.time !== undefined);
  let text: string;
  try {
    text = new Intl.DateTimeFormat(locale, options).format(moment);
  } catch {
    // A locale tag the engine does not know: English, so that a date is never lost.
    text = new Intl.DateTimeFormat("en", options).format(moment);
  }
  return text.replace(INTL_SPACES, " ");
}
