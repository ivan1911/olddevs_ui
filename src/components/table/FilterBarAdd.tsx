"use client";

import { forwardRef, useRef, useState, type ComponentPropsWithoutRef } from "react";
import { AddIcon } from "../../icons.js";
import { useMessages, useUiLocale } from "../../i18n/useMessages.js";
import { cn } from "../../lib/cn.js";
import { parseDateOrNull } from "../../lib/date.js";
import { formatRangeDate, formatRangeNumber, rangeText } from "../../lib/filter-range.js";
import type { TableFilter } from "../../lib/table-state.js";
import { Button } from "../actions/Button.js";
import { DatePicker } from "../date-time/DatePicker.js";
import { NumberInput } from "../inputs/NumberInput.js";
import { Popover, PopoverContent, PopoverTrigger } from "../overlays/Popover.js";
import { Select } from "../inputs/Select.js";

/**
 * Разделитель составного ключа «поле + значение».
 *
 * Ключ нужен, чтобы за один проход узнать, какие пары уже выбраны: искать
 * пару перебором списка на каждый пункт меню — квадрат по числу фильтров.
 * Разделителем взят символ, которого не бывает в идентификаторе поля или
 * значения, иначе пары `a` + `bc` и `ab` + `c` дали бы один ключ.
 *
 * Записан ИМЕННО escape-последовательностью, а не самим символом. Сырой
 * нулевой байт в исходнике делает файл бинарным для `file` и `grep`: `grep`
 * такой файл молча пропускает, выходя с кодом 1 и без сообщения, — то есть
 * любой текстовый гейт обходит его стороной, не сказав об этом ни слова.
 */
const KEY_SEPARATOR = "\u0000";

const filterKey = (field: string | undefined, value: string) => `${field}${KEY_SEPARATOR}${value}`;

export interface FilterField {
  /** Идентификатор поля; попадает в `field` создаваемого фильтра. */
  id: string;
  /** Подпись поля. Строка: она же попадает в подпись токена. */
  label: string;
  /**
   * Вид поля (ADR-0063). `"values"` — выбор из списка `values`, равенство;
   * `"number-range"` и `"date-range"` — два поля «от» и «до», токен с `to`.
   * Не задан — `"values"`.
   */
  kind?: "values" | "number-range" | "date-range";
  /**
   * Допустимые значения для `kind: "values"`. Пустой список — поле в выборе не
   * появится. У диапазонов не используется: передайте `[]`.
   *
   * Обязательно и у диапазонов: необязательное поле сломало бы потребителя,
   * который читает `field.values.length` у своих полей (minor не ломает типы).
   */
  values: { id: string; label: string }[];
}

/** Строка границы диапазона → число для `NumberInput`; пусто — `null`. */
const toNumber = (bound: string) => (bound === "" ? null : Number(bound));

/** Перевёрнутый диапазон: обе границы заданы, и нижняя больше верхней. ISO-даты сравнимы как строки. */
function isInverted(kind: FilterField["kind"], from: string, to: string) {
  if (from === "" || to === "") return false;
  return kind === "number-range" ? Number(from) > Number(to) : from > to;
}

export interface FilterBarAddProps extends Omit<
  ComponentPropsWithoutRef<"div">,
  "onChange" | "children"
> {
  /** Поля, по которым можно добавить фильтр, со своими значениями. */
  fields: FilterField[];
  /** Уже применённые: их значения повторно не предлагаются. */
  filters: TableFilter[];
  /** Получает собранный фильтр после нажатия «Применить». */
  onAdd: (filter: TableFilter) => void;
}

/**
 * Добавление фильтра: выбор поля, затем значения.
 *
 * Список полей и значений приходит пропом — доменного словаря в ките не
 * появляется, как и в `FilterBar`.
 *
 * УЖЕ ПРИМЕНЁННОЕ ЗНАЧЕНИЕ ПОВТОРНО НЕ ПРЕДЛАГАЕТСЯ. Иначе пользователь
 * добавляет второй такой же токен, выборка не меняется, и он остаётся с двумя
 * одинаковыми на вид фильтрами, из которых непонятно, какой снимать.
 *
 * Идентификатор токена собирается из поля и значения: пара уникальна как раз
 * потому, что дубли запрещены выше.
 *
 * ДИАПАЗОН (`kind: "number-range" | "date-range"`) — два поля вместо списка
 * значений, ADR-0063. «Применить» доступно, когда задана хотя бы одна граница;
 * перевёрнутый диапазон («от 100 до 50») применить нельзя — он ничего не
 * выберет, а пустоту пользователь прочтёт как «данных нет». Поле с уже
 * применённым диапазоном повторно не предлагается: два диапазона по одному
 * полю — пересечение, а не добавление, и токены были бы неразличимы. Подпись
 * токена («Сумма: 50–100», «Дата: до 12 марта 2026 г.») собирается здесь, из
 * каталога сообщений и локали `UiProvider`, и едет в `label`.
 */
export const FilterBarAdd = forwardRef<HTMLDivElement, FilterBarAddProps>(function FilterBarAdd(
  { fields, filters, onAdd, className, ...rest },
  ref
) {
  const messages = useMessages();
  const locale = useUiLocale();
  const [open, setOpen] = useState(false);
  const [field, setField] = useState<string | null>(null);
  const [value, setValue] = useState<string | null>(null);
  // Границы диапазона строками, как они уйдут в фильтр; пусто — не задана.
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const taken = new Set(filters.map((f) => filterKey(f.field, f.value)));
  const rangeApplied = (f: FilterField) => filters.some((x) => x.field === f.id);
  const availableFields = fields.filter((f) =>
    f.kind === "number-range" || f.kind === "date-range"
      ? !rangeApplied(f)
      : (f.values ?? []).some((v) => !taken.has(filterKey(f.id, v.id)))
  );
  const current = fields.find((f) => f.id === field);
  const kind = current?.kind ?? "values";
  const isRange = kind === "number-range" || kind === "date-range";
  const availableValues = (current?.values ?? []).filter(
    (v) => !taken.has(filterKey(current?.id, v.id))
  );

  const close = () => {
    setOpen(false);
    setField(null);
    setValue(null);
    setFrom("");
    setTo("");
    // Фокус возвращается на кнопку, а не теряется в закрывшемся попоувере:
    // потерянный фокус уезжает в начало документа, и клавиатурный пользователь
    // начинает обход страницы заново.
    triggerRef.current?.focus();
  };

  const canApply = isRange
    ? (from !== "" || to !== "") && !isInverted(kind, from, to)
    : value != null;

  const apply = () => {
    if (!current || !canApply) return;

    if (isRange) {
      const format = kind === "number-range" ? formatRangeNumber : formatRangeDate;
      onAdd({
        id: `${current.id}:range`,
        field: current.id,
        value: from,
        // Пустая строка, а не отсутствие ключа: именно `to` отличает «от 50»
        // от равенства «= 50».
        to,
        label: `${current.label}: ${rangeText(messages, format(from, locale), format(to, locale))}`,
      });
      close();
      return;
    }

    const label = (current.values ?? []).find((v) => v.id === value)?.label ?? value;
    onAdd({
      id: `${current.id}:${value}`,
      field: current.id,
      value: value!,
      label: `${current.label}: ${label}`,
    });
    close();
  };

  const inverted = isInverted(kind, from, to);

  return (
    <div ref={ref} className={cn("inline-flex", className)} {...rest}>
      <Popover open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
        <PopoverTrigger asChild>
          {/*
            `asChild` обязателен: без него Radix рисует свою кнопку вокруг
            нашей, и получается кнопка в кнопке — аудит роняет прогон.
          */}
          <Button
            ref={triggerRef}
            variant="outline"
            size="sm"
            icon={<AddIcon size={14} />}
            disabled={availableFields.length === 0}
          >
            {messages.filterBar.add}
          </Button>
        </PopoverTrigger>

        <PopoverContent className="flex w-[260px] flex-col gap-3 p-3">
          <Select
            aria-label={messages.filterBar.field}
            placeholder={messages.filterBar.field}
            items={availableFields.map((f) => ({ id: f.id, label: f.label }))}
            value={field}
            onChange={(id) => {
              setField(id == null ? null : String(id));
              setValue(null);
              setFrom("");
              setTo("");
            }}
          />

          {/*
            Второй шаг рисуется ТОЛЬКО после выбора поля: пустой выключенный
            селект рядом с заполненным читается как ошибка, а не как «шаг ещё
            не пройден».
          */}
          {current && kind === "values" ? (
            <Select
              aria-label={messages.filterBar.value}
              placeholder={messages.filterBar.value}
              items={availableValues}
              value={value}
              onChange={(id) => setValue(id == null ? null : String(id))}
            />
          ) : null}

          {current && kind === "number-range" ? (
            <>
              <NumberInput
                label={messages.filterBar.fromField}
                value={toNumber(from)}
                onChange={(n) => setFrom(n == null ? "" : String(n))}
                invalid={inverted}
              />
              <NumberInput
                label={messages.filterBar.toField}
                value={toNumber(to)}
                onChange={(n) => setTo(n == null ? "" : String(n))}
                invalid={inverted}
              />
            </>
          ) : null}

          {current && kind === "date-range" ? (
            <>
              {/*
                У `DatePicker` нет пропа с именем, а триггер показывает дату, а
                не подпись поля: имя несёт группа вокруг него.
              */}
              <div role="group" aria-label={messages.filterBar.fromField}>
                <DatePicker
                  value={from}
                  onChange={setFrom}
                  placeholder={messages.filterBar.fromField}
                  maxValue={parseDateOrNull(to) ?? undefined}
                />
              </div>
              <div role="group" aria-label={messages.filterBar.toField}>
                <DatePicker
                  value={to}
                  onChange={setTo}
                  placeholder={messages.filterBar.toField}
                  minValue={parseDateOrNull(from) ?? undefined}
                />
              </div>
            </>
          ) : null}

          <Button size="sm" tone="accent" disabled={!canApply} onClick={apply}>
            {messages.filterBar.apply}
          </Button>
        </PopoverContent>
      </Popover>
    </div>
  );
});
