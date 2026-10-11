"use client";

import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { useMessages } from "../../i18n/useMessages.js";
import { cn } from "../../lib/cn.js";

export interface TableToolbarProps extends Omit<ComponentPropsWithoutRef<"div">, "title"> {
  /** Заголовок таблицы. Обычно `Heading` или строка. */
  title?: ReactNode;
  /**
   * Сколько записей всего. Число, а не готовая строка: склонение делает каталог
   * по локали, а не вызывающий по своему разумению.
   */
  count?: number;
  /**
   * Своя подпись счётчика — когда нужно назвать сущность («12 документов»).
   * Тот же приём, что у `SelectionBar`: каталог знает про склонение, но не про
   * предметную область.
   */
  countLabel?: (count: number) => ReactNode;
  /** Действия справа: «Создать», «Экспорт», меню. */
  actions?: ReactNode;
  /** Слот фильтров — обычно `FilterBar`. Стоит второй строкой. */
  filters?: ReactNode;
  /** Слот настроек — обычно `TablePreferences` внутри `Popover` или `Menu`. */
  preferences?: ReactNode;
}

/**
 * Полоса над таблицей: заголовок, счётчик, действия, фильтры и настройки.
 *
 * Состояния не хранит вовсе — ни счётчика, ни фильтров: всё приходит сверху,
 * обычно из `useTableState`.
 *
 * РОЛИ `toolbar` ЗДЕСЬ НЕТ, и это решение. Роль обязывает к клавиатурной
 * навигации стрелками между своими элементами, а ARIA сама её не даёт: объявив
 * роль и не реализовав поведение, мы пообещали бы скринридеру то, чего нет.
 * Обычный контейнер с заголовком внутри честнее и никого не обманывает.
 *
 * Работает и без `DataTable` — над обычной `Table` тоже: полоса ничего не знает
 * о том, что под ней.
 */
export const TableToolbar = forwardRef<HTMLDivElement, TableToolbarProps>(function TableToolbar(
  { title, count, countLabel, actions, filters, preferences, className, ...rest },
  ref
) {
  const messages = useMessages();
  const hasHeader = title != null || count != null || actions != null || preferences != null;

  return (
    <div ref={ref} className={cn("flex flex-col gap-3", className)} {...rest}>
      {hasHeader ? (
        <div className="flex flex-wrap items-center gap-3">
          {title != null ? <div className="text-fg-0 text-base font-semibold">{title}</div> : null}

          {count != null ? (
            <span className="text-fg-2 text-[13px]">
              {countLabel ? countLabel(count) : messages.tableToolbar.total({ count })}
            </span>
          ) : null}

          {actions != null || preferences != null ? (
            <div className="ml-auto flex shrink-0 items-center gap-2">
              {actions}
              {preferences}
            </div>
          ) : null}
        </div>
      ) : null}

      {filters}
    </div>
  );
});
