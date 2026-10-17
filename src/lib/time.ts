/**
 * Manual time entry. The split into two functions is not cosmetic: the mask runs on
 * every keystroke, normalization only when focus leaves the field. Otherwise "2" would
 * instantly turn into "02:00" and get in the way of typing the rest.
 */

/** Inserts the colon as the user types: `2130` → `21:30`. */
export function maskTime(value: string): string {
  const digits = String(value).replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

/** Normalizes a partial entry to a valid `HH:MM`, clamping it to the bounds of the day. */
export function normalizeTime(value: string, fallback = "00:00"): string {
  const digits = String(value).replace(/\D/g, "");
  if (digits.length === 0) return fallback;
  const h = Math.min(23, parseInt(digits.slice(0, 2), 10) || 0);
  const m = Math.min(59, parseInt(digits.slice(2, 4) || "0", 10) || 0);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Labels for the day periods of the 12-hour format. Latin by default, as in most locales. */
export interface TimePeriodLabels {
  am: string;
  pm: string;
}

const DEFAULT_PERIODS: TimePeriodLabels = { am: "AM", pm: "PM" };

/** Formats `HH:MM` on a 12-hour clock: `14:30` → `2:30 PM`, midnight → `12:00 AM`. */
export function formatTime12(time: string, labels: TimePeriodLabels = DEFAULT_PERIODS): string {
  const [hh = "0", mm = "00"] = time.split(":");
  const h = Math.min(23, parseInt(hh, 10) || 0);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${mm.padStart(2, "0")} ${h < 12 ? labels.am : labels.pm}`;
}

/**
 * The period in the text after the digits: a full label from the catalog (`nachm.`)
 * or the last typed letter `a`/`p` as an abbreviation. The label is checked first,
 * otherwise an `a` inside another locale's label would be read as AM.
 */
function detectPeriod(text: string, labels: TimePeriodLabels): "am" | "pm" | undefined {
  const tail = text.replace(/^.*\d/s, "").trim().toLowerCase();
  if (tail === "") return undefined;
  if (tail === labels.am.toLowerCase()) return "am";
  if (tail === labels.pm.toLowerCase()) return "pm";
  const letter = [...tail].reverse().find((c) => c === "a" || c === "p");
  return letter === "a" ? "am" : letter === "p" ? "pm" : undefined;
}

/**
 * Mask for 12-hour input, applied on every keystroke: `230p` → `2:30 PM`. The hour
 * digits are counted from the end (three digits are `h:mm`, four are `hh:mm`), so
 * typing runs left to right without recalculation. A typed `a` or `p` is completed to
 * a period; without digits no period is set.
 *
 * `previous` is the field text before this keystroke. If the new text is shorter, the
 * user is deleting: the period is then not completed from the leftover letter
 * (otherwise Backspace on `2:30 PM` would return `2:30 PM` and the field would get
 * stuck). It is kept only if the full label is still there.
 */
export function maskTime12(
  value: string,
  labels: TimePeriodLabels = DEFAULT_PERIODS,
  previous?: string
): string {
  const text = String(value);
  const digits = text.replace(/\D/g, "").slice(0, 4);
  if (digits.length === 0) return "";
  const body = digits.length <= 2 ? digits : `${digits.slice(0, -2)}:${digits.slice(-2)}`;
  const deleting = previous !== undefined && text.length < previous.length;
  const tail = text.replace(/^.*\d/s, "").trim().toLowerCase();
  const found = detectPeriod(text, labels);
  if (deleting && tail !== labels.am.toLowerCase() && tail !== labels.pm.toLowerCase()) return body;
  if (!found) return body;
  return `${body} ${found === "am" ? labels.am : labels.pm}`;
}

/**
 * Normalizes 12-hour input to `HH:MM`. If a 24-hour time is typed (hours above twelve),
 * the period is ignored. Without a period, the period of the previous value
 * (`fallback`) is used, and if there is none, AM: "2:30" typed into a field that held
 * `15:00` stays in the afternoon.
 */
export function normalizeTime12(
  value: string,
  fallback = "00:00",
  labels: TimePeriodLabels = DEFAULT_PERIODS
): string {
  const text = String(value);
  const digits = text.replace(/\D/g, "");
  if (digits.length === 0) return fallback;
  const hourDigits = digits.length <= 2 ? digits : digits.slice(0, -2);
  const rawHour = parseInt(hourDigits, 10) || 0;
  const minutes = Math.min(59, digits.length <= 2 ? 0 : parseInt(digits.slice(-2), 10) || 0);
  let hour: number;
  if (rawHour > 12) {
    hour = Math.min(23, rawHour);
  } else {
    const fallbackHour = parseInt(fallback.split(":")[0] ?? "0", 10) || 0;
    const period = detectPeriod(text, labels);
    const pm = period ? period === "pm" : fallbackHour >= 12;
    hour = (rawHour % 12) + (pm ? 12 : 0);
  }
  return `${String(hour).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}
