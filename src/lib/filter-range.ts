import type { UiMessages } from "../i18n/messages.js";
import { parseDateOrNull } from "./date.js";

/**
 * Label for the range bounds: "50–100", "from 50", "to 12 March".
 *
 * Takes the bounds ALREADY FORMATTED, and takes the words for "from" and "to" from the message
 * catalog. Word order in a label is a matter of language, not of code (ADR-0063). An empty bound
 * means "unbounded" and does not appear in the label.
 */
export function rangeText(messages: UiMessages, from: string, to: string): string {
  if (from !== "" && to !== "") return messages.filterBar.rangeBetween({ from, to });
  if (from !== "") return messages.filterBar.rangeFrom({ from });
  return messages.filterBar.rangeTo({ to });
}

/**
 * A bound number for a label, formatted by the locale's rules. A non-number is returned as is:
 * the value could have come from the URL, and it is wrong to invent a "NaN" for it.
 */
export function formatRangeNumber(value: string, locale: string): string {
  if (value === "") return value;
  const n = Number(value);
  return Number.isFinite(n) ? new Intl.NumberFormat(locale).format(n) : value;
}

/**
 * Date bound for a label: "12 March 2026".
 *
 * The year is always written, even in the current one. The label outlives the URL and a saved view,
 * and "to 12 March", opened a year later, would silently mean a different date. A string from the URL
 * is parsed strictly (`parseDateOrNull`), and an unparseable one is kept as is.
 */
export function formatRangeDate(value: string, locale: string): string {
  const parsed = parseDateOrNull(value);
  if (!parsed) return value;
  // Build the date from its parts at local noon, as in `formatDate`: `new Date("YYYY-MM-DD")`
  // is UTC midnight, and east of Greenwich the date would shift by a day.
  const date = new Date(parsed.year, parsed.month - 1, parsed.day);
  // The Date constructor maps years 0–99 to 1900+y.
  date.setFullYear(parsed.year);
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}
