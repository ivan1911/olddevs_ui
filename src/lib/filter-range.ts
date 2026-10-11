import type { UiMessages } from "../i18n/messages.js";
import { parseDateOrNull } from "./date.js";

/**
 * Подпись границ диапазона: «50–100», «от 50», «до 12 марта».
 *
 * Принимает границы уже ОТФОРМАТИРОВАННЫМИ, а слова «от» и «до» берёт из
 * каталога сообщений: порядок слов в подписи — дело языка, а не кода
 * (ADR-0063). Пустая граница значит «не ограничено» и в подпись не попадает.
 */
export function rangeText(messages: UiMessages, from: string, to: string): string {
  if (from !== "" && to !== "") return messages.filterBar.rangeBetween({ from, to });
  if (from !== "") return messages.filterBar.rangeFrom({ from });
  return messages.filterBar.rangeTo({ to });
}

/**
 * Число-граница для подписи по правилам локали. Не число — как есть: значение
 * могло прийти из адреса, и выдумывать за него «NaN» нельзя.
 */
export function formatRangeNumber(value: string, locale: string): string {
  if (value === "") return value;
  const n = Number(value);
  return Number.isFinite(n) ? new Intl.NumberFormat(locale).format(n) : value;
}

/**
 * Дата-граница для подписи: «12 марта 2026 г.».
 *
 * Год пишется всегда, даже в текущем: подпись переживает адрес и сохранённый
 * вид, и «до 12 марта», открытое годом позже, молча означало бы другую дату.
 * Строка из адреса разбирается строго (`parseDateOrNull`), неразбираемая
 * остаётся как есть.
 */
export function formatRangeDate(value: string, locale: string): string {
  const parsed = parseDateOrNull(value);
  if (!parsed) return value;
  // Сборка по частям в местном полудне, как в `formatDate`: `new Date("ГГГГ-ММ-ДД")`
  // — полночь UTC, и восточнее Гринвича дата сдвинулась бы на сутки.
  const date = new Date(parsed.year, parsed.month - 1, parsed.day);
  // Годы 0–99 конструктор отображает в 1900+y.
  date.setFullYear(parsed.year);
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}
