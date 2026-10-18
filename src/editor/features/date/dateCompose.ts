"use client";

import { isDatetime, parseDatetime } from "./dateValue.js";

/*
  COMPOSING A DATE MENTION'S VALUE (ADR-0079): the code that only the popover form needs, kept
  out of `dateValue.ts` so that the start bundle (the node, the Schema, the sanitizer) does not carry
  it. The form's chunk imports this module; nothing in the start graph does.
*/

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
