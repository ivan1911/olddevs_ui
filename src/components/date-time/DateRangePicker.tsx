"use client";

import { useEffect, useState } from "react";
import type { DateValue } from "react-aria-components";
import { cn } from "../../lib/cn.js";
import { parseDateOrNull, toDateBound, type DateInput } from "../../lib/date.js";
import { useMessages, useUiLocale } from "../../i18n/useMessages.js";
import {
  periodPresets,
  formatPeriodLength,
  resolvePeriod,
  type DateRange,
  type PeriodPreset,
  type RelativePeriod,
} from "../../lib/period.js";
import { CalendarIcon, CloseIcon } from "../../icons.js";
import { formatDate } from "./DatePicker.js";
import { Popover, PopoverContent, PopoverTrigger } from "../overlays/Popover.js";
import { RangeCalendar } from "./RangeCalendar.js";

export type { DateRange } from "../../lib/period.js";

export interface DateRangePickerProps {
  /** Выбранный период: пара ISO-дат `{ start, end }`; пусто или неразбираемое значение показывается как «не выбрано». */
  value?: DateRange | null;
  /**
   * Относительный период (пресет), которым задано значение; подсвечивается в колонке пресетов.
   *
   * Выбранный относительный период, если период задан пресетом. Когда он
   * задан, подпись триггера берётся у пресета: «30 дней» честнее пары дат,
   * которая завтра станет другой.
   */
  period?: RelativePeriod | null;
  /**
   * Отдаёт и развёрнутые границы, и то, каким пресетом они получены
   * (`null` — выбраны вручную в календаре). Потребитель сам решает, что
   * из этого положить в URL; пакет за него не выбирает.
   */
  onChange: (range: DateRange, period: RelativePeriod | null) => void;
  /**
   * Пресеты периода в колонке слева от календаря; по умолчанию стандартный набор кита.
   *
   * Пустой список убирает колонку пресетов целиком.
   */
  presets?: readonly PeriodPreset[];
  /** Зона, в которой считается «сегодня» для пресетов. */
  timeZone?: string;
  /**
   * Очистка периода. Кнопка очистки появляется, только когда обработчик передан.
   *
   * Здесь это отдельный проп, а не `clearable` как у `Select`: там очистка
   * выражается существующим `onChange(null)`, и хватает флага. Тут же
   * `onChange` отдаёт пару «границы + пресет», и «ничего не выбрано» в неё
   * не укладывается — потребителю всё равно надо стирать оба своих ключа.
   */
  onClear?: () => void;
  /** Доступное имя кнопки очистки. */
  clearLabel?: string;
  /** Текст триггера, пока период не выбран; по умолчанию стандартная подпись кита. */
  placeholder?: string;
  /** Блокирует триггер и убирает кнопку очистки. */
  disabled?: boolean;
  /**
   * Самая ранняя доступная дата; пресеты подрезаются по этой границе, а пресет
   * целиком вне границ не выбирается. ISO-строка `ГГГГ-ММ-ДД`, как и `value`;
   * объект `@internationalized/date` тоже принимается.
   */
  minValue?: DateInput;
  /** Самая поздняя доступная дата; действует так же, как `minValue`. */
  maxValue?: DateInput;
  /**
   * Отмечает конкретные дни недоступными (занятые даты, праздники): в календаре
   * их нельзя выбрать. Получает объект календаря; `date.toString()` даёт ISO-день.
   *
   * Пресеты это правило не учитывают: они подрезаются только по `minValue` и
   * `maxValue`.
   */
  isDateUnavailable?: (date: DateValue) => boolean;
  /**
   * Месяц, на котором открывается календарь, когда период ещё не выбран.
   * По умолчанию текущий; фиксируется в витрине, иначе снимок менялся бы
   * каждые сутки.
   */
  defaultFocusedValue?: DateInput;
  /** Локаль подписей дат и календаря; по умолчанию локаль `UiProvider`. */
  locale?: string;
  /** Открыта ли панель, когда состоянием управляет потребитель; без него панель открывается сама. */
  open?: boolean;
  /** Вызывается при каждом открытии и закрытии панели; работает и с `open`, и без него. */
  onOpenChange?: (open: boolean) => void;
  /** Классы на рамку триггера. */
  triggerClassName?: string;
  /** Классы на всплывающую панель с пресетами и календарём. */
  contentClassName?: string;
}

/**
 * Диапазон дат: пресеты слева, календарь справа.
 *
 * Пресеты — не украшение, а основной путь. В админке период выбирают
 * повторяющимися окнами («последние 30 дней»), и календарь нужен реже, чем
 * кажется: до этого компонента в модалке подписчиков вместо него стояли
 * четыре захардкоженные кнопки, а в кампаниях — наоборот, только календарь.
 *
 * Незавершённый выбор наружу не отдаётся: `onChange` зовётся, только когда
 * есть обе границы. Иначе потребитель на каждый первый клик получал бы
 * диапазон «с 5 марта по 5 марта» и успевал сходить с ним в сеть.
 */
export function DateRangePicker({
  value,
  period,
  onChange,
  presets,
  timeZone,
  onClear,
  clearLabel,
  placeholder,
  disabled,
  minValue,
  maxValue,
  isDateUnavailable,
  defaultFocusedValue,
  locale,
  open: controlledOpen,
  onOpenChange,
  triggerClassName,
  contentClassName,
}: DateRangePickerProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const months = useTwoMonths();

  const open = controlledOpen ?? internalOpen;
  // Внутреннее состояние обновляется всегда — как в `Select`: иначе тот, кто
  // передал только колбэк без `open`, получил бы панель, которая не открывается.
  const setOpen = (next: boolean) => {
    setInternalOpen(next);
    onOpenChange?.(next);
  };

  /**
   * Диапазон разбирается один раз и здесь же.
   *
   * `parseDate` бросает на любой мусор (`parseDate("ерунда")` — это
   * `Invalid ISO 8601 date string`), а `value` приходит из URL, где его правят
   * руками. Раньше разбор стоял прямо в разметке, тремя вызовами: одна кривая
   * ссылка роняла всё поддерево.
   *
   * Защита долго стояла ТОЛЬКО здесь, а комментарий утверждал, что соседний
   * `DatePicker` на том же вводе показывает плейсхолдер. Это было неверно: он
   * разбирал значение выражением в JSX-потомке, без всякой защиты. С волны 26
   * оба зовут `parseDateOrNull` из `lib/date.ts`, и утверждение наконец
   * соответствует коду.
   *
   * Заодно исчезают `value!`: после сужения компилятор сам знает, что дальше
   * границы есть.
   */
  const messages = useMessages();
  const uiLocale = useUiLocale();
  const effectiveLocale = locale ?? uiLocale;
  const activePresets = presets ?? periodPresets(messages);
  const range = parseRange(value);

  /**
   * Подрезать диапазон по объявленным границам поля.
   *
   * `null`, если окно с границами НЕ ПЕРЕСЕКАЕТСЯ вовсе. Первая версия двигала
   * концы независимо и могла выдать перевёрнутый диапазон: при `minValue`
   * первого числа текущего месяца пресет «прошлый месяц» уезжал наружу как
   * `{start: "2026-09-01", end: "2026-08-31"}` — заведомо невозможное значение,
   * которое потребитель писал в адрес и в запрос. Тот же файл строкой ниже
   * объявляет перевёрнутый диапазон «не значением», так что выдавать его
   * самим тем более нельзя.
   */
  const clampRange = (r: DateRange): DateRange | null => {
    // Границы приводятся к объектам: неразбираемая строка — «не задано», а не
    // сравнение с мусором.
    const min = toDateBound(minValue)?.toString();
    const max = toDateBound(maxValue)?.toString();
    const start = min && r.start < min ? min : r.start;
    const end = max && r.end > max ? max : r.end;
    return start <= end ? { start, end } : null;
  };
  const activePreset = period ? activePresets.find((p) => p.period === period) : undefined;
  const label = activePreset
    ? activePreset.label
    : range
      ? `${formatDate(range.start.toString(), effectiveLocale)} — ${formatDate(range.end.toString(), effectiveLocale)}`
      : (placeholder ?? messages.dateRangePicker.placeholder);

  const hasValue = Boolean(range || activePreset);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {/*
        Устройство то же, что у триггера `Select`, и по той же причине: крестик
        обязан быть отдельной кнопкой рядом, а не внутри — вложенная
        интерактивность недопустима в разметке и недостижима с клавиатуры.
        Поэтому рамку несёт обёртка, а кнопка растянута на её площадь
        псевдоэлементом.
      */}
      <span
        className={cn(
          // `leading-5` — тот же объявленный строчный бокс, что у `TextControl`
          // и триггера `Select` (см. `lib/field.ts`): триггер стоит в форме
          // рядом с ними и обязан давать те же 42px. Прежний `min-h-[38px]`
          // убран — он был порогом снизу при выведенной высоте, а при заданной
          // не срабатывает никогда: 20 + 2×10 отступа + 2 рамки уже 42.
          "border-line-soft text-fg-2 hover:border-line hover:text-fg-1 rounded-control relative inline-flex w-full items-center gap-2 border px-3 py-2.5 text-[13px] leading-5 transition-colors",
          disabled && "cursor-not-allowed opacity-50",
          triggerClassName
        )}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className={cn(
              "inline-flex min-w-0 grow cursor-pointer items-center justify-between gap-3 text-left outline-none",
              "after:absolute after:inset-0 after:rounded-[inherit]",
              "focus-visible:after:outline-accent-strong focus-visible:after:outline-2 focus-visible:after:outline-offset-2",
              "disabled:cursor-not-allowed"
            )}
          >
            <span className={hasValue ? "text-fg-1" : "text-fg-3"}>{label}</span>
            <CalendarIcon size={14} className="text-fg-3 shrink-0" />
          </button>
        </PopoverTrigger>

        {hasValue && onClear && !disabled ? (
          <button
            type="button"
            aria-label={clearLabel ?? messages.common.clear}
            onClick={onClear}
            // `relative` поднимает крестик над растянутым псевдоэлементом кнопки,
            // иначе клик по нему открывал бы панель вместо очистки.
            className="bg-bg-3 text-fg-2 hover:text-fg-0 focus-visible:outline-accent-strong relative z-10 flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <CloseIcon size={10} aria-hidden />
          </button>
        ) : null}
      </span>
      <PopoverContent className={cn("w-auto p-0", contentClassName)} align="start">
        <div className="flex items-stretch">
          {activePresets.length > 0 ? (
            <div className="border-line-soft flex flex-col gap-0.5 border-r p-2">
              {activePresets.map((p) => (
                <button
                  key={p.period}
                  type="button"
                  onClick={() => {
                    // Пресет ПОДРЕЗАЕТСЯ по границам: ограничения применялись
                    // только к календарю, и «365 дней» уезжали за `minValue`
                    // — то есть наружу шёл диапазон, который в календаре
                    // выбрать нельзя вовсе.
                    const clamped = clampRange(resolvePeriod(p.period, timeZone));
                    // Пресет, целиком выпавший за границы, не выбирается: звать
                    // `onChange` с невозможным диапазоном хуже, чем не ответить.
                    if (!clamped) return;
                    onChange(clamped, p.period);
                    setOpen(false);
                  }}
                  className={cn(
                    "cursor-pointer rounded-sm px-3 py-[7px] text-left text-[13px] font-medium whitespace-nowrap transition-colors",
                    "focus-visible:outline-accent-strong focus-visible:outline-2 focus-visible:-outline-offset-2",
                    p.period === period ? "bg-bg-3 text-fg-0" : "text-fg-1 hover:bg-bg-2"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          ) : null}

          <div className="flex flex-col">
            <RangeCalendar
              value={range}
              onChange={(next) => {
                // Первый клик даёт диапазон «с 5 марта по 5 марта» — наружу его
                // не отдаём: потребитель успел бы сходить с ним в сеть.
                if (!next?.start || !next?.end) return;
                onChange({ start: next.start.toString(), end: next.end.toString() }, null);
                setOpen(false);
              }}
              minValue={minValue}
              maxValue={maxValue}
              isDateUnavailable={isDateUnavailable}
              defaultFocusedValue={defaultFocusedValue}
              locale={locale}
              months={months}
            />
            {range ? (
              <div className="border-line-soft text-fg-2 border-t px-3 py-2 text-[12px] empty:hidden">
                {formatPeriodLength(
                  { start: range.start.toString(), end: range.end.toString() },
                  messages
                )}
              </div>
            ) : null}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Разбирает пару ISO-строк в значение календаря; мусор превращает в «не hasValue».
 *
 * Обе границы обязаны быть валидны: половина диапазона фильтром не является,
 * а показать её календарём нечем.
 */
function parseRange(value: DateRange | null | undefined) {
  const start = parseDateOrNull(value?.start);
  const end = parseDateOrNull(value?.end);
  if (!start || !end) return null;
  /*
    ПЕРЕВЁРНУТЫЙ диапазон — тоже неразбираемый.

    Календарём его не выбрать, но собрать руками в адресе можно:
    `?from=2026-03-10&to=2026-03-01`. Обе даты разбирались, `hasValue` было
    истинно, триггер показывал «10 мар 2026 — 01 мар 2026», календарь не
    подсвечивал ничего (react-aria проверяет диапазон как `>= start && <= end`),
    а подпись снизу через `periodLength` с её `Math.max(1, …)` уверенно
    сообщала «1 день». Отбраковываем там же, где мусор.
  */
  if (start.compare(end) > 0) return null;
  return { start, end };
}

/**
 * Два месяца рядом — только когда для них есть место.
 *
 * Начинаем всегда с одного: на сервере `matchMedia` нет вовсе, и попытка
 * угадать ширину до монтирования даёт расхождение разметки. Второй месяц
 * появляется после первого рендера, когда ширину уже можно спросить.
 */
function useTwoMonths(): 1 | 2 {
  const [two, setTwo] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)");
    setTwo(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setTwo(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return two ? 2 : 1;
}
