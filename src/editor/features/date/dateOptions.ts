import type { DateToolOptions } from "../../core/toolOptions.js";
import { TIME_FORMAT_FIELDS } from "./dateFormat.js";

/*
  Date mention options (ADR-0079): the defaults and the check of a value. The module is safe for
  the server, with no Tiptap: the Tool's descriptor takes both from here.
*/

/**
 * The defaults. `format` is empty ON PURPOSE: the Tool then uses `DEFAULT_DATE_FORMAT`. A default
 * object would be merged with the screen's object (`mergeOptions`), and `{ dateStyle: "long" }` next
 * to `day` and `month` is an error in Intl. An absent default is replaced whole.
 */
export const DATE_DEFAULTS: DateToolOptions = { format: undefined };

/**
 * `format` is a plain object of date fields that Intl accepts. A field of time or zone is a mistake
 * (the time comes from the value, the zone from the author's browser), and so is a combination Intl
 * rejects, such as `dateStyle` with `month`.
 */
function isDateFormat(value: unknown): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const given = value as Record<string, unknown>;
  if (TIME_FORMAT_FIELDS.some((field) => given[field] !== undefined)) return false;
  try {
    new Intl.DateTimeFormat("en", value as Intl.DateTimeFormatOptions);
    return true;
  } catch {
    return false;
  }
}

/** The checks of option values by field name, one per field of `DATE_DEFAULTS`. */
export const DATE_CHECKS: Readonly<Record<string, (value: unknown) => boolean>> = {
  format: isDateFormat,
};
