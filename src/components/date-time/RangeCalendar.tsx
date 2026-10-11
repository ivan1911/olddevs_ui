"use client";

import {
  Button,
  CalendarCell,
  CalendarGrid,
  CalendarGridBody,
  CalendarGridHeader,
  CalendarHeaderCell,
  I18nProvider,
  RangeCalendar as RangeCalendarRac,
  type DateValue,
  type RangeCalendarProps as RangeCalendarPropsRac,
} from "react-aria-components";
import { cn } from "../../lib/cn.js";
import { ChevronLeftIcon, ChevronRightIcon } from "../../icons.js";
import {
  toDateBound,
  toIsoDate,
  toRangeValue,
  type DateInput,
  type DateRangeInput,
} from "../../lib/date.js";
import type { DateRange } from "../../lib/period.js";
import { CalendarHeading, NAV_BUTTON_CLASS, WEEKDAY_CELL_CLASS, useToday } from "./Calendar.js";

export interface RangeCalendarProps extends Omit<
  RangeCalendarPropsRac<DateValue>,
  "value" | "defaultValue" | "onChange" | "minValue" | "maxValue" | "defaultFocusedValue"
> {
  /**
   * Выбранный период: `{ start, end }` объектов `@internationalized/date` или
   * ISO-строк `ГГГГ-ММ-ДД` — вторые такие же, как `DateRange` у `DateRangePicker`.
   * `null` — управляемое пустое значение. Если хоть одна граница не разбирается,
   * период считается пустым: половина диапазона выбранным не бывает.
   */
  value?: DateRangeInput | null;
  /** Начальный период неуправляемого календаря; те же два вида, что у `value`. */
  defaultValue?: DateRangeInput | null;
  /**
   * Вызывается, когда выбраны обе границы. Первый аргумент — объект календаря,
   * как у React Aria; второй — тот же период парой ISO-строк
   * `ГГГГ-ММ-ДД`, как `DateRange` у `DateRangePicker`.
   */
  onChange?: (value: { start: DateValue; end: DateValue }, iso: DateRange) => void;
  /** Самый ранний доступный день: объект календаря или ISO-строка `ГГГГ-ММ-ДД`. */
  minValue?: DateInput;
  /** Самый поздний доступный день; те же два вида, что у `minValue`. */
  maxValue?: DateInput;
  /** Месяц, на котором открывается неуправляемый календарь; те же два вида, что у `minValue`. */
  defaultFocusedValue?: DateInput;
  /** Классы на корень календаря: ширина, отступы, фон. */
  className?: string;
  /** Локаль подписей и первого дня недели — см. `Calendar`. */
  locale?: string;
  /**
   * Сколько месяцев показать рядом: `1` или `2`; по умолчанию `1`.
   *
   * Сколько месяцев показать рядом. Два — рабочий вариант для диапазона:
   * период, пересекающий границу месяца, иначе требует листать туда-обратно,
   * теряя из виду уже выбранный конец. Один остаётся для узких экранов.
   */
  months?: 1 | 2;
}

/**
 * Календарь диапазона.
 *
 * Концы диапазона заливаются акцентом, середина — приглушённой подложкой:
 * иначе выбранные две недели читаются как двадцать одинаковых кнопок,
 * и по картинке не видно, где начало.
 */
export function RangeCalendar({
  className,
  locale,
  months = 1,
  value,
  defaultValue,
  onChange,
  minValue,
  maxValue,
  defaultFocusedValue,
  ...props
}: RangeCalendarProps) {
  const now = useToday();

  // Ячейка одна на оба месяца — иначе второй месяц пришлось бы описывать
  // копией из семнадцати классов, и они разъехались бы с первой же правкой.
  const cell = (offset?: { months: number }) => (
    <CalendarGrid offset={offset} className="w-fit">
      <CalendarGridHeader>
        {(day) => <CalendarHeaderCell className={WEEKDAY_CELL_CLASS}>{day}</CalendarHeaderCell>}
      </CalendarGridHeader>
      <CalendarGridBody className="[&_td]:px-0">
        {(date) => (
          <CalendarCell
            date={date}
            className={cn(
              "text-fg-1 relative flex size-9 cursor-pointer items-center justify-center rounded-none border border-transparent p-0 text-[13px] font-normal outline-none",
              "duration-fast transition-colors",
              "data-[hovered]:bg-bg-3 data-[hovered]:text-fg-0",
              "data-[selected]:bg-accent-soft data-[selected]:text-fg-0",
              "data-[selection-start]:bg-accent data-[selection-start]:text-text-on-accent",
              "data-[selection-end]:bg-accent data-[selection-end]:text-text-on-accent",
              "data-[selection-start]:rounded-l-lg data-[selection-start]:rounded-r-none",
              "data-[selection-end]:rounded-l-none data-[selection-end]:rounded-r-lg",
              "data-[selection-start]:data-[selection-end]:rounded-lg",
              "data-[disabled]:pointer-events-none data-[disabled]:opacity-30",
              "data-[unavailable]:pointer-events-none data-[unavailable]:line-through data-[unavailable]:opacity-30",
              "data-[focus-visible]:outline-accent-strong data-[focus-visible]:z-10 data-[focus-visible]:outline data-[focus-visible]:outline-2",
              now !== null &&
                date.compare(now) === 0 &&
                "after:bg-accent data-[selection-end]:after:bg-text-on-accent data-[selection-start]:after:bg-text-on-accent after:absolute after:bottom-1 after:left-1/2 after:size-[3px] after:-translate-x-1/2 after:rounded-full"
            )}
          />
        )}
      </CalendarGridBody>
    </CalendarGrid>
  );

  const calendar = (
    <RangeCalendarRac
      {...props}
      value={toRangeValue(value)}
      defaultValue={toRangeValue(defaultValue)}
      onChange={
        onChange &&
        ((next) => onChange(next, { start: toIsoDate(next.start), end: toIsoDate(next.end) }))
      }
      minValue={toDateBound(minValue)}
      maxValue={toDateBound(maxValue)}
      defaultFocusedValue={toDateBound(defaultFocusedValue)}
      visibleDuration={{ months }}
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

      <div className="flex gap-4">
        {cell()}
        {months === 2 ? cell({ months: 1 }) : null}
      </div>
    </RangeCalendarRac>
  );

  // Тот же приём, что в `Calendar`: провайдер разворачивается только под явный
  // проп, иначе локаль приходит сверху.
  return locale ? <I18nProvider locale={locale}>{calendar}</I18nProvider> : calendar;
}
