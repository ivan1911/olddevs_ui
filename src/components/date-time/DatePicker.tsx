"use client";

import { useState, type ReactNode } from "react";
import type { DateValue } from "react-aria-components";
import { cn } from "../../lib/cn.js";
import { parseDateOrNull, type DateInput } from "../../lib/date.js";
import { useMessages, useUiLocale } from "../../i18n/useMessages.js";
import { ChevronDownIcon } from "../../icons.js";
import { Calendar } from "./Calendar.js";
import { useFieldDescribedBy } from "../../hooks/useFieldDescription.js";
import { Popover, PopoverContent, PopoverTrigger } from "../overlays/Popover.js";

export interface DatePickerProps {
  /** Дата в ISO-формате `ГГГГ-ММ-ДД` либо пусто. */
  value?: string | null;
  /** Вызывается с выбранной датой в виде ISO-строки `ГГГГ-ММ-ДД`, как `value`. Компонент не знает про `Date` и таймзоны. */
  onChange: (date: string) => void;
  /** Текст триггера, пока дата не выбрана; по умолчанию стандартная подпись кита. */
  placeholder?: string;
  /** Блокирует кнопку-триггер: календарь не открывается. */
  disabled?: boolean;
  /**
   * Самая ранняя доступная дата.
   *
   * Ограничения показываются в календаре, а не проверяются после выбора.
   * ISO-строка `ГГГГ-ММ-ДД`, как и `value`; объект `@internationalized/date`
   * тоже принимается.
   */
  minValue?: DateInput;
  /** Самая поздняя доступная дата; показывается в календаре так же, как `minValue`. */
  maxValue?: DateInput;
  /** Отмечает конкретные дни недоступными (праздники, занятые даты): их нельзя выбрать. */
  isDateUnavailable?: (date: DateValue) => boolean;
  /** Локаль подписи даты и календаря; по умолчанию локаль `UiProvider`. */
  locale?: string;
  /** Классы на кнопку-триггер. */
  triggerClassName?: string;
  /**
   * Своё описание триггера. Сливается с описанием `FormField`, а не заменяет
   * его: подсказка формы и пояснение потребителя обязаны звучать обе.
   */
  "aria-describedby"?: string;
}

/**
 * Дата с подчёркнутым триггером — компактный вид для строки формы.
 *
 * Значение ходит ISO-строкой, а не объектом `@internationalized/date`:
 * потребитель хранит дату в URL и шлёт в API, и заставлять его конвертировать
 * туда-обратно значит переложить на него внутреннюю кухню календаря.
 */
export function DatePicker({
  value,
  onChange,
  placeholder,
  disabled,
  minValue,
  maxValue,
  isDateUnavailable,
  locale,
  triggerClassName,
  "aria-describedby": ariaDescribedBy,
}: DatePickerProps) {
  const messages = useMessages();
  const uiLocale = useUiLocale();
  const effectiveLocale = locale ?? uiLocale;
  /**
   * Описание поля из `FormField` плюс своё, если потребитель его передал.
   *
   * Тот же приём, что у `TextControl` и `NumberInput`: значения СЛИВАЮТСЯ, а
   * не заменяют друг друга. Вне `FormField` контекст пуст, и разметка та же,
   * что была до появления описаний.
   */
  const fieldDescribedBy = useFieldDescribedBy();
  const describedBy = [ariaDescribedBy, fieldDescribedBy].filter(Boolean).join(" ") || undefined;

  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-describedby={describedBy}
          className={cn(
            "border-line-soft text-fg-2 hover:border-line hover:text-fg-1 inline-flex cursor-pointer items-center gap-1 border-b pb-px font-mono text-[13px] transition-colors outline-none",
            "focus-visible:outline-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50",
            triggerClassName
          )}
        >
          {formatDate(value, effectiveLocale) ?? placeholder ?? messages.datePicker.placeholder}
          <ChevronDownIcon size={12} className="text-fg-3 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          value={parseDateOrNull(value)}
          onChange={(date) => {
            if (!date) return;
            onChange(date.toString());
            setOpen(false);
          }}
          minValue={minValue}
          maxValue={maxValue}
          isDateUnavailable={isDateUnavailable}
          locale={locale ?? uiLocale}
        />
      </PopoverContent>
    </Popover>
  );
}

/**
 * Дата разбирается по частям, а не через `new Date(iso)`.
 *
 * `new Date("2026-03-05")` — это полночь **UTC**, и восточнее Гринвича строка
 * превращается в предыдущий день. Компонент оперирует календарной датой без
 * времени, поэтому и собирать её надо в местном полудне календаря.
 *
 * НО СОБИРАТЬ МОЖНО ТОЛЬКО РАЗОБРАННОЕ. Сборка по частям ничего не проверяет, и
 * до волны 26 функция отвечала на мусор правдоподобной ложью: `2026-02-29`
 * (год не високосный) молча становился `Mar 01, 2026`, `2026-09` — `Sep 01,
 * 2026`, а `ерунда` — строкой `Invalid Date` прямо на кнопке. Значение
 * приходит из адреса, поэтому сначала строгий разбор, и только потом сборка.
 */
export function formatDate(isoDate: string | null | undefined, locale = "en-US"): ReactNode {
  const parsed = parseDateOrNull(isoDate);
  if (!parsed) return null;

  const date = new Date(parsed.year, parsed.month - 1, parsed.day);
  // Годы 0–99 конструктор `Date` отображает в 1900+y — легаси-правило, живое до
  // сих пор. `parseDate` такие годы принимает (`0026-03-05` — законная строка из
  // адреса), и без этой строки кнопка показывала бы «Mar 05, 1926»: та же
  // правдоподобная ложь, ради устранения которой разбор и сделан строгим.
  date.setFullYear(parsed.year);
  return date.toLocaleDateString(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
