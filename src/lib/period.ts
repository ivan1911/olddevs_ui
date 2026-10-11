import { getLocalTimeZone, today, type CalendarDate } from "@internationalized/date";
import { parseDateOrNull } from "./date.js";
import { DEFAULT_MESSAGES } from "../i18n/defaults.js";
import type { UiMessages } from "../i18n/messages.js";

/** Границы периода в ISO-формате `ГГГГ-ММ-ДД`, обе включительно. */
export interface DateRange {
  start: string;
  end: string;
}

/**
 * Относительный период — то, что на самом деле имеет в виду пользователь,
 * выбирая «последние 30 дней».
 *
 * Хранить вместо него пару замороженных дат — значит превратить ссылку,
 * отправленную коллеге, в «30 дней до того вторника, когда её сформировали».
 * Поэтому в URL живёт `period=30d`, а в абсолютные границы он разворачивается
 * в момент запроса. Решение — ADR-0008.
 */
export const RELATIVE_PERIODS = [
  "7d",
  "30d",
  "90d",
  "180d",
  "365d",
  "thisMonth",
  "lastMonth",
  "thisYear",
] as const;

export type RelativePeriod = (typeof RELATIVE_PERIODS)[number];

/**
 * Проверка периода, пришедшего извне.
 *
 * Список нужен именно в рантайме, а не только типом: период живёт в URL,
 * а URL правится руками. `?period=30days` для компилятора — обычная `string`,
 * потребитель приводит её к `RelativePeriod`, потому что другого способа
 * пакет ему не оставляет, и дальше разворачивать нечего. Поэтому граница
 * проверяется здесь, до `resolvePeriod`.
 */
export function isRelativePeriod(value: unknown): value is RelativePeriod {
  return RELATIVE_PERIODS.includes(value as RelativePeriod);
}

const iso = (date: CalendarDate): string => date.toString();

/**
 * Разворачивает относительный период в конкретные даты.
 *
 * Отсчёт включает сегодняшний день: «7 дней» — это сегодня и шесть предыдущих,
 * а не восемь дат в диапазоне. Исключение — `lastMonth`: он весь в прошлом
 * и кончается последним днём предыдущего месяца.
 *
 * Периоды, кончающиеся сегодня, включают неполный день: у «30 дней» последние
 * сутки всегда короче остальных. Для графика это заметно, и это свойство
 * периода, а не ошибка расчёта.
 *
 * Зона по умолчанию — местная зона браузера; потребитель, у которого своя
 * зона отчётности, передаёт её явно. `now` подменяется только тестами:
 * без него любая проверка расчёта зависела бы от дня прогона.
 */
export function resolvePeriod(
  period: RelativePeriod,
  timeZone?: string,
  now: CalendarDate = today(timeZone ?? getLocalTimeZone())
): DateRange {
  switch (period) {
    case "7d":
    case "30d":
    case "90d":
    case "180d":
    case "365d": {
      const days = Number(period.slice(0, -1));
      return { start: iso(now.subtract({ days: days - 1 })), end: iso(now) };
    }
    case "thisMonth":
      return { start: iso(now.set({ day: 1 })), end: iso(now) };
    case "lastMonth": {
      const prev = now.set({ day: 1 }).subtract({ months: 1 });
      return { start: iso(prev), end: iso(prev.set({ day: prev.calendar.getDaysInMonth(prev) })) };
    }
    case "thisYear":
      return { start: iso(now.set({ month: 1, day: 1 })), end: iso(now) };
    default:
      // Для компилятора ветка недостижима, и в этом всё дело: гарантия
      // исчерпаемости существует только на этапе сборки. В рантайм период
      // приходит из URL, и здесь он либо уже проверен `isRelativePeriod`,
      // либо это ошибка вызова — про которую лучше узнать сразу, а не
      // получить `undefined` и разыменовать его строкой ниже.
      // Текст исключения, а не строка интерфейса: его читает разработчик в
      // стектрейсе, а не пользователь на экране. В каталог не едет.
      throw new Error(`Unknown period: ${String(period)}`);
  }
}

export interface PeriodPreset {
  label: string;
  period: RelativePeriod;
}

/** Порядок пресетов; подписи приходят из каталога. */
const PRESET_ORDER = ["7d", "30d", "90d", "thisMonth", "lastMonth", "365d"] as const;

/**
 * Пресеты по умолчанию. Список короткий намеренно: колонка на десять строк
 * перестаёт быть быстрым путём и становится ещё одним списком для чтения.
 *
 * Функция, а не константа: подпись пресета — user-visible строка, и она обязана
 * идти через каталог. Компонент зовёт `periodPresets(messages)`; без аргумента
 * возвращается английский фолбэк, поэтому вызов из кода без провайдера не
 * ломается.
 */
export function periodPresets(messages: UiMessages = DEFAULT_MESSAGES): readonly PeriodPreset[] {
  return PRESET_ORDER.map((period) => ({ label: messages.period.presets[period], period }));
}

/**
 * @deprecated с 2.0.0 — подписи здесь английские и локаль не знают. Зовите
 * `periodPresets(useMessages())`. Оставлено, чтобы вызов у потребителя не
 * рассыпался в момент обновления; удаляется в следующем мажоре.
 */
export const DEFAULT_PERIOD_PRESETS: readonly PeriodPreset[] = periodPresets();

/**
 * Длина периода в днях, обе границы включительно; `0` — границы неразбираемы.
 *
 * Считается в UTC намеренно: там нет перехода на летнее время, обе границы
 * берут одинаковое смещение, и разница всегда кратна суткам. В местной зоне
 * тот же расчёт ошибался бы на день дважды в год.
 *
 * Перевёрнутый диапазон календарём не выбирается, но собирается руками —
 * поэтому длина не уходит в минус: «−8 дней» под календарём означало бы,
 * что компонент считает, а не то, что вход неверен.
 */
export function periodLength(range: DateRange): number {
  const start = parseDateOrNull(range.start);
  const end = parseDateOrNull(range.end);
  // Ноль означает «показывать нечего», и это ЧЕСТНЕЕ единицы: границы приходят
  // из адреса, а «1 день» под календарём с мусором в границах был бы уверенным
  // враньём о том, чего компонент не знает.
  if (!start || !end) return 0;
  return Math.max(
    1,
    Math.round((end.toDate("UTC").getTime() - start.toDate("UTC").getTime()) / 86_400_000) + 1
  );
}

/**
 * «14 дней» под календарём — чтобы было видно, что выбрано именно две недели,
 * а не тринадцать или пятнадцать дней.
 */
export function formatPeriodLength(
  range: DateRange,
  messages: UiMessages = DEFAULT_MESSAGES
): string {
  // Склонение выбирает ЛОКАЛЬ через `Intl.PluralRules`, а не цепочка остатков
  // здесь: правила «11–14 → дней» знает русский каталог, и знать их должен он,
  // а не общая функция. Компонент, считающий окончания, умеет один язык.
  const days = periodLength(range);
  // Пустая строка, а не «0 дней»: она означает «подписывать нечего», и гасит её
  // тот, кто выводит. Кит про разметку потребителя ничего не знает — свою
  // обёртку `DateRangePicker` прячет сам (`empty:hidden` там же, где подпись).
  if (days === 0) return "";
  return messages.period.length({ days });
}
