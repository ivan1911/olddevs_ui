"use client";

import type { DateInput } from "../../lib/date.js";
import { DatePicker } from "./DatePicker.js";
import { TimePicker } from "./TimePicker.js";

// Функции жили в этом файле; re-export — чтобы не ломать публичный API.
export { maskTime, normalizeTime } from "../../lib/time.js";

export interface DateTimePickerProps {
  /** Дата в ISO-формате `ГГГГ-ММ-ДД`. */
  date?: string | null;
  /** Время в формате `ЧЧ:ММ`. */
  time?: string | null;
  /** Вызывается с ISO-датой `ГГГГ-ММ-ДД`, когда в календаре выбран день. */
  onDateChange: (date: string) => void;
  /** Вызывается со временем `ЧЧ:ММ`, когда ввод закончен или выбран слот из списка. */
  onTimeChange: (time: string) => void;
  /** Блокирует оба поля — дату и время. */
  disabled?: boolean;
  /**
   * Границы календарные, то есть дневные, и ко времени не относятся.
   *
   * Ячейки календаря — `CalendarDate` без времени, и сравнение идёт по дню:
   * `parseDate("2026-09-11").compare(parseDateTime("2026-09-11T14:00"))` — это
   * ноль. Поэтому `minValue={…T14:00}` в смысле «не раньше чем через час» НЕ
   * РАБОТАЕТ: тот же день с девятью утра пройдёт.
   *
   * Границ времени компонент не принимает намеренно. «Не раньше чем через час»
   * — это правило бизнес-логики, а не свойство поля: оно зависит от часового
   * пояса, который кит не знает принципиально (см. `timeZoneLabel`), и от
   * момента отправки, а не отрисовки. Проверять его должен потребитель, там же,
   * где он проверяет остальную форму.
   *
   * Значение — ISO-строка `ГГГГ-ММ-ДД`, как `date`; объект `@internationalized/date`
   * тоже принимается.
   */
  minValue?: DateInput;
  /** Самый поздний доступный день; граница календарная, как и `minValue`, ко времени не относится. */
  maxValue?: DateInput;
  /**
   * Подпись зоны справа от времени: `MSK`, `UTC`.
   *
   * Проп, а не строка в разметке. До переезда в пакет здесь стоял хардкод
   * `(MSK)` — надпись, никак не связанная с зоной, по которой сервер на самом
   * деле публикует. Пакет зоны не знает и знать не должен: он показывает то,
   * что ему передали, и по умолчанию — ничего.
   */
  timeZoneLabel?: string;
  /** Часы поля времени: `24` (умолчание) или `12`, как у `TimePicker`. */
  hourCycle?: 12 | 24;
  /** Локаль подписи даты и календаря; по умолчанию локаль `UiProvider`. На поле времени не влияет. */
  locale?: string;
}

/**
 * Дата и время одной строкой.
 *
 * Время — `TimePicker`: то же поле с маской, что жило здесь раньше (ввод
 * нормализуется по уходу фокуса, а не на каждое нажатие), плюс список слотов.
 */
export function DateTimePicker({
  date,
  time,
  onDateChange,
  onTimeChange,
  disabled,
  minValue,
  maxValue,
  timeZoneLabel,
  hourCycle,
  locale,
}: DateTimePickerProps) {
  return (
    <div className="flex items-center gap-2">
      <DatePicker
        value={date}
        onChange={onDateChange}
        disabled={disabled}
        minValue={minValue}
        maxValue={maxValue}
        locale={locale}
      />

      <span className="text-fg-4">·</span>

      <TimePicker value={time} onChange={onTimeChange} hourCycle={hourCycle} disabled={disabled} />

      {timeZoneLabel ? <span className="text-fg-3 text-[13px]">({timeZoneLabel})</span> : null}
    </div>
  );
}
