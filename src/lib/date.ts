import { type CalendarDate, parseDate } from "@internationalized/date";
import type { DateValue } from "react-aria-components";

/**
 * Разбор ISO-даты, не бросающий на неразбираемом значении.
 *
 * `parseDate` бросает ДВА разных исключения, и оба достижимы из адреса:
 * `parseDate("ерунда")` — это `Error: Invalid ISO 8601 date string`, а
 * `parseDate("2026-02-29")` — `RangeError: Value out of range`, потому что 2026
 * год не високосный. Второе особенно коварно: строка выглядит правильной, и
 * ссылка с ней живёт до первого не-високосного года.
 *
 * Вынесено, когда выяснилось, что защита стоит в одном месте из трёх.
 * `DateRangePicker` заворачивал разбор в `try/catch` и в комментарии
 * утверждал, что соседний `DatePicker` на том же вводе показывает
 * плейсхолдер, — а `DatePicker` разбирал значение выражением в JSX-потомке,
 * то есть на каждом рендере и без всякой защиты. Комментарий описывал
 * инвариант, которого не было: ровно так и разъезжаются три копии одной мысли.
 *
 * `@internal` — наружу не экспортируется: у потребителя есть `parseDate`
 * библиотеки, и решать за него, что делать с неразбираемым значением, кит не
 * должен.
 */
export function parseDateOrNull(value: string | null | undefined): CalendarDate | null {
  if (!value) return null;
  try {
    return parseDate(value);
  } catch {
    return null;
  }
}

/**
 * Дата в любом из двух видов, которые принимают календари кита: ISO-строка
 * `ГГГГ-ММ-ДД` или объект `@internationalized/date`.
 *
 * Строка нужна потребителю, у которого этого пакета нет: `@internationalized/date`
 * не входит в публичные точки входа кита, и ради одной границы `minValue`
 * тянуть его в зависимости приложения незачем. Объект остаётся — им уже
 * пользуются.
 */
export type DateInput = DateValue | string;

/**
 * Приводит `DateInput` к объекту календаря.
 *
 * `undefined` и `null` проходят насквозь — у react-aria это разные вещи
 * (`value={undefined}` — неуправляемое поле, `value={null}` — управляемое
 * пустое), и стирать различие здесь нельзя. Неразбираемая строка даёт `null`:
 * «значения нет», а не исключение, как у `DatePicker` с мусором из адреса.
 */
export function toDateValue(value: DateInput | null | undefined): DateValue | null | undefined {
  if (value === undefined || value === null) return value;
  return typeof value === "string" ? parseDateOrNull(value) : value;
}

/**
 * То же для границы и фокуса: пустое и неразбираемое — одинаково «не задано».
 * Граница из мусора не должна превращаться в `null`: react-aria читает `null`
 * как ошибку типа, а не как отсутствие.
 */
export function toDateBound(value: DateInput | undefined): DateValue | undefined {
  return toDateValue(value) ?? undefined;
}

/** Календарный день объекта календаря в виде ISO-строки `ГГГГ-ММ-ДД`. */
export function toIsoDate(value: DateValue): string {
  // `toString()` у `CalendarDateTime` и `ZonedDateTime` несёт время и зону;
  // наружу идёт день, как у `DatePicker`.
  return value.toString().slice(0, 10);
}

/** Диапазон в любом из двух видов: пара ISO-строк или `{ start, end }` объектов. */
export interface DateRangeInput {
  start: DateInput;
  end: DateInput;
}

/** Пара границ диапазона в виде объектов календаря; половина диапазона — не диапазон. */
export function toRangeValue(
  value: DateRangeInput | null | undefined
): { start: DateValue; end: DateValue } | null | undefined {
  if (value === undefined || value === null) return value;
  const start = toDateValue(value.start);
  const end = toDateValue(value.end);
  return start && end ? { start, end } : null;
}
