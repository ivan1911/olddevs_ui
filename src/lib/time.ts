/**
 * Ручной ввод времени. Разделение на две функции не косметическое: маска
 * работает на каждое нажатие, нормализация — только по уходу фокуса. Иначе
 * «2» немедленно превращалось бы в «02:00» и мешало дописывать.
 */

/** Ставит двоеточие по мере ввода: `2130` → `21:30`. */
export function maskTime(value: string): string {
  const digits = String(value).replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

/** Доводит частичный ввод до валидного `ЧЧ:ММ`, обрезая по границам суток. */
export function normalizeTime(value: string, fallback = "00:00"): string {
  const digits = String(value).replace(/\D/g, "");
  if (digits.length === 0) return fallback;
  const h = Math.min(23, parseInt(digits.slice(0, 2), 10) || 0);
  const m = Math.min(59, parseInt(digits.slice(2, 4) || "0", 10) || 0);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Подписи периодов суток 12-часового формата. По умолчанию — латиница, как в большинстве локалей. */
export interface TimePeriodLabels {
  am: string;
  pm: string;
}

const DEFAULT_PERIODS: TimePeriodLabels = { am: "AM", pm: "PM" };

/** Печатает `ЧЧ:ММ` на 12-часовых часах: `14:30` → `2:30 PM`, полночь — `12:00 AM`. */
export function formatTime12(time: string, labels: TimePeriodLabels = DEFAULT_PERIODS): string {
  const [hh = "0", mm = "00"] = time.split(":");
  const h = Math.min(23, parseInt(hh, 10) || 0);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${mm.padStart(2, "0")} ${h < 12 ? labels.am : labels.pm}`;
}

/**
 * Период в тексте после цифр: полная метка из каталога (`nachm.`) или последняя
 * набранная буква `a`/`p` как сокращение. Метка проверяется первой, иначе буква `a` внутри
 * чужой метки читалась бы как AM.
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
 * Маска 12-часового ввода на каждое нажатие: `230p` → `2:30 PM`. Разряд часов
 * определяется с конца (три цифры — `ч:мм`, четыре — `чч:мм`), поэтому набор
 * идёт слева направо без пересчёта. Буква `a` или `p` достраивается до периода;
 * без цифр период не ставится.
 *
 * `previous` — текст поля до этого нажатия. Если новый текст короче, идёт стирание: период
 * тогда не достраивается из оставшейся буквы (иначе Backspace на `2:30 PM` возвращал бы
 * `2:30 PM` и поле застревало), а сохраняется, только если полная метка осталась.
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
 * Доводит 12-часовой ввод до `ЧЧ:ММ`. Если набрано 24-часовое время (часы больше
 * двенадцати), период не учитывается. Без периода берётся период прежнего значения
 * (`fallback`), а при его отсутствии — AM: «2:30» в поле, где стояло `15:00`, остаётся
 * дневным.
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
