"use client";

import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { Button as AriaButton, Tag, TagGroup, TagList } from "react-aria-components";
import { CloseIcon } from "../../icons.js";
import { useMessages } from "../../i18n/useMessages.js";
import { cn } from "../../lib/cn.js";
import { rangeText } from "../../lib/filter-range.js";
import type { TableFilter } from "../../lib/table-state.js";
import { Button } from "../actions/Button.js";

export interface FilterBarProps extends Omit<ComponentPropsWithoutRef<"div">, "onChange"> {
  /** Применённые фильтры; каждый рисуется снимаемым токеном. */
  filters: TableFilter[];
  /** Получает новый список фильтров после снятия одного токена или всех сразу. */
  onFiltersChange: (filters: TableFilter[]) => void;
  /**
   * Подпись токена. Не задана — «поле: значение», а у диапазона (есть `to`) —
   * «поле: 50–100», «поле: от 50», «поле: до 100» словами каталога сообщений.
   *
   * Подпись **не является** идентификатором: снятие идёт по `filter.id`.
   * Иначе два фильтра по одному полю с одинаковыми на вид подписями стали бы
   * неразличимы, а локализованная или обрезанная подпись — вовсе непригодной.
   */
  renderLabel?: (filter: TableFilter) => string;
  /** Доступное имя набора. Не задано — из каталога сообщений. */
  label?: string;
  /** Слот добавления фильтра — обычно `FilterBarAdd`. */
  children?: ReactNode;
}

/**
 * Применённые фильтры снимаемыми токенами.
 *
 * Компонент **не знает, какие бывают фильтры**: их список приходит пропом, а
 * доменного словаря в ките не появляется. Это и отличает его от `LibraryFilterBar`
 * во фронте, где 373 строки состоят из зашитых групп и продуктовых пикеров, —
 * переносится форма, а не код.
 *
 * Токены стоят на `TagGroup` из react-aria, тем же приёмом, что `TagInput`, а не
 * на `Chip`: у чипа нет снятия, и он про переключение, а не про снятие. Заодно
 * бесплатно приходит клавиатура: Delete и Backspace на токене.
 */
export const FilterBar = forwardRef<HTMLDivElement, FilterBarProps>(function FilterBar(
  { filters, onFiltersChange, renderLabel, label, className, children, ...rest },
  ref
) {
  const messages = useMessages();

  // Диапазон без своей подписи нельзя показать как «поле: значение»: «от 50»
  // выглядело бы равенством «= 50» (ADR-0063). Подпись, собранная
  // `FilterBarAdd`, приходит в `filter.label` и сюда не доходит.
  const labelOf =
    renderLabel ??
    ((filter: TableFilter) =>
      filter.label ??
      `${filter.field}: ${
        filter.to !== undefined ? rangeText(messages, filter.value, filter.to) : filter.value
      }`);

  return (
    <div ref={ref} className={cn("flex flex-wrap items-center gap-2", className)} {...rest}>
      {filters.length > 0 ? (
        <TagGroup
          aria-label={label ?? messages.filterBar.label}
          className="contents"
          onRemove={(keys) => onFiltersChange(filters.filter((f) => !keys.has(f.id)))}
        >
          <TagList items={filters} className="contents">
            {(filter) => (
              <Tag
                id={filter.id}
                textValue={labelOf(filter)}
                className="border-line-soft bg-bg-2 text-fg-1 focus-visible:outline-accent-strong flex items-center gap-1 rounded-full border py-0.5 pr-1 pl-2.5 text-[13px] outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                {labelOf(filter)}
                {/*
                  Кнопка ОБЯЗАНА быть `Button` из react-aria: поведение снятия
                  подключается через `ButtonContext`, и голая `<button>` его не
                  читает — разметка валидна, axe доволен, а нажатие не делает
                  ничего. Ровно эта ловушка уже описана в `TagInput`.

                  Подпись здесь ОБЩАЯ, без имени фильтра: react-aria дописывает
                  к имени кнопки подпись своего тега сам, и «Снять фильтр
                  Раздел: Договоры» читалось бы с задвоением. Проверено
                  вычисленным доступным именем, а не глазами по разметке.
                */}
                <AriaButton
                  slot="remove"
                  aria-label={messages.filterBar.remove}
                  className="text-fg-3 hover:text-fg-0 focus-visible:outline-accent-strong flex cursor-pointer items-center rounded-full p-0.5 outline-none focus-visible:outline-2 focus-visible:outline-offset-1"
                >
                  <CloseIcon size={12} />
                </AriaButton>
              </Tag>
            )}
          </TagList>
        </TagGroup>
      ) : null}

      {children}

      {/*
        Кнопка «снять все» появляется со второго фильтра: при одном она делает
        ровно то же, что его крестик, и только удлиняет обход с клавиатуры.
      */}
      {filters.length > 1 ? (
        <Button variant="ghost" size="sm" onClick={() => onFiltersChange([])}>
          {messages.filterBar.clear}
        </Button>
      ) : null}
    </div>
  );
});
