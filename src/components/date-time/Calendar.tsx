"use client";

import { getLocalTimeZone, today, type CalendarDate } from "@internationalized/date";
import { useEffect, useState } from "react";
import {
  Button,
  CalendarCell,
  CalendarGrid,
  CalendarGridBody,
  CalendarGridHeader,
  CalendarHeaderCell,
  Calendar as CalendarRac,
  Heading,
  HeadingContext,
  I18nProvider,
  useSlottedContext,
  type CalendarProps as CalendarPropsRac,
  type DateValue,
} from "react-aria-components";
import { cn } from "../../lib/cn.js";
import { ChevronLeftIcon, ChevronRightIcon } from "../../icons.js";
import { toDateBound, toDateValue, toIsoDate, type DateInput } from "../../lib/date.js";

export interface CalendarProps extends Omit<
  CalendarPropsRac<DateValue>,
  "value" | "defaultValue" | "onChange" | "minValue" | "maxValue" | "defaultFocusedValue"
> {
  /**
   * Выбранный день: объект `@internationalized/date` или ISO-строка `ГГГГ-ММ-ДД`.
   * `null` — управляемое пустое значение. Неразбираемая строка считается пустой.
   */
  value?: DateInput | null;
  /** Начальный день неуправляемого календаря; те же два вида, что у `value`. */
  defaultValue?: DateInput | null;
  /**
   * Вызывается при выборе дня. Первый аргумент — объект календаря, как у React
   * Aria; второй — тот же день ISO-строкой `ГГГГ-ММ-ДД`, для
   * тех, у кого значение хранится строкой, как в `DatePicker`.
   */
  onChange?: (value: DateValue, iso: string) => void;
  /** Самый ранний доступный день: объект календаря или ISO-строка `ГГГГ-ММ-ДД`. */
  minValue?: DateInput;
  /** Самый поздний доступный день; те же два вида, что у `minValue`. */
  maxValue?: DateInput;
  /** Месяц, на котором открывается неуправляемый календарь; те же два вида, что у `minValue`. */
  defaultFocusedValue?: DateInput;
  /** Классы на корень календаря: ширина, отступы, фон. */
  className?: string;
  /**
   * Локаль подписей и первого дня недели. По умолчанию русская: подписи
   * примитивов кита русские везде, и календарь не исключение.
   */
  locale?: string;
}

/** Кнопки листания месяцев — одинаковые в обоих календарях. */
export const NAV_BUTTON_CLASS =
  "text-fg-3 hover:bg-bg-3 hover:text-fg-1 data-[focus-visible]:ring-accent-strong flex size-8 cursor-pointer items-center justify-center rounded-lg transition-colors outline-none data-[focus-visible]:ring-2";

/** Подписи дней недели — тоже общие. */
export const WEEKDAY_CELL_CLASS = "text-fg-3 size-9 p-0 text-[11px] font-medium";

/**
 * Пробелы, которые Intl разных сборок ICU ставит по-разному: тонкий (U+2009)
 * вокруг тире в диапазоне и узкий неразрывный (U+202F). Обычный неразрывный
 * не трогается — он одинаков у сервера и браузера и держит «2026 г.» вместе.
 */
const INTL_SPACES = /[\u2009\u202f]/g;

/**
 * Заголовок календаря — месяц или диапазон месяцев над сеткой.
 *
 * Текст берётся у react-aria (`HeadingContext`), а там он — `formatRange` из
 * Intl, и Intl у сервера и браузера разный: ICU в Node ставит вокруг тире
 * тонкие пробелы, Chrome — обычные. Отрисованный на сервере `RangeCalendar`
 * с двумя месяцами не проходил гидратацию (React #418). Здесь
 * пробелы приводятся к обычным, и строка одна на обеих сторонах.
 */
export function CalendarHeading() {
  const title = useSlottedContext(HeadingContext)?.children;
  return (
    <Heading className="text-fg-1 grow text-center text-[13px] font-semibold">
      {typeof title === "string" ? title.replace(INTL_SPACES, " ") : title}
    </Heading>
  );
}

/**
 * Сегодняшний день — только в браузере, после монтирования.
 *
 * На сервере «сегодня» неизвестно: статику собирают в другой день и в другом
 * часовом поясе, и точка в HTML стояла бы не на том дне, что у читателя, а
 * гидратация расходилась бы классами ячеек. Первый кадр без точки.
 */
export function useToday(): CalendarDate | null {
  const [now, setNow] = useState<CalendarDate | null>(null);
  useEffect(() => setNow(today(getLocalTimeZone())), []);
  return now;
}

/**
 * Календарь одной даты.
 *
 * Поведение — `react-aria-components`: клавиатура, роль `grid`, объявление
 * полной даты у ячейки, локаль и первый день недели. Своя реализация этого
 * была бы не примитивом, а второй библиотекой — та же логика, что у Radix
 * для тултипа и поповера (ADR-0004).
 *
 * Сегодняшний день помечается точкой под числом, а не заливкой: заливка
 * занята выбранным значением, и два разных состояния одним приёмом
 * различить нельзя.
 */
export function Calendar({
  className,
  locale,
  value,
  defaultValue,
  onChange,
  minValue,
  maxValue,
  defaultFocusedValue,
  ...props
}: CalendarProps) {
  const now = useToday();

  /*
    Свой `I18nProvider` разворачивается ТОЛЬКО под точечный проп `locale`.
    До 2.0.0 он стоял всегда и жёстко на `ru-RU` — то есть календарь перебивал
    локаль приложения собственной. Теперь без пропа локаль приходит сверху:
    от `UiProvider` кита, от `I18nProvider` потребителя или от браузера.
  */
  const calendar = (
    <CalendarRac
      {...props}
      value={toDateValue(value)}
      defaultValue={toDateValue(defaultValue)}
      onChange={onChange && ((next) => onChange(next, toIsoDate(next)))}
      minValue={toDateBound(minValue)}
      maxValue={toDateBound(maxValue)}
      defaultFocusedValue={toDateBound(defaultFocusedValue)}
      className={cn("w-fit p-3 select-none", className)}
    >
      <header className="mb-1 flex items-center gap-1">
        <Button slot="previous" className={NAV_BUTTON_CLASS}>
          <ChevronLeftIcon size={15} />
        </Button>
        <CalendarHeading />
        <Button slot="next" className={NAV_BUTTON_CLASS}>
          <ChevronRightIcon size={15} />
        </Button>
      </header>

      <CalendarGrid>
        <CalendarGridHeader>
          {(day) => <CalendarHeaderCell className={WEEKDAY_CELL_CLASS}>{day}</CalendarHeaderCell>}
        </CalendarGridHeader>
        <CalendarGridBody className="[&_td]:px-0">
          {(date) => (
            <CalendarCell
              date={date}
              className={cn(
                "text-fg-1 relative flex size-9 cursor-pointer items-center justify-center rounded-lg border border-transparent p-0 text-[13px] font-normal outline-none",
                "duration-fast transition-colors",
                "data-[hovered]:bg-bg-3 data-[hovered]:text-fg-0",
                "data-[selected]:bg-accent data-[selected]:text-text-on-accent data-[selected]:border-transparent",
                "data-[disabled]:pointer-events-none data-[disabled]:opacity-30",
                "data-[unavailable]:pointer-events-none data-[unavailable]:line-through data-[unavailable]:opacity-30",
                "data-[focus-visible]:outline-accent-strong data-[focus-visible]:outline data-[focus-visible]:outline-2",
                now !== null &&
                  date.compare(now) === 0 &&
                  "after:bg-accent data-[selected]:after:bg-text-on-accent after:absolute after:bottom-1 after:left-1/2 after:size-[3px] after:-translate-x-1/2 after:rounded-full"
              )}
            />
          )}
        </CalendarGridBody>
      </CalendarGrid>
    </CalendarRac>
  );

  return locale ? <I18nProvider locale={locale}>{calendar}</I18nProvider> : calendar;
}
