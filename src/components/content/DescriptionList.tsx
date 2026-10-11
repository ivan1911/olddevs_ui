"use client";

import type { ReactNode } from "react";
import { cn } from "../../lib/cn.js";

export interface DescriptionItem {
  /** Подпись свойства (термин `dt`). */
  label: ReactNode;
  /** Значение свойства (описание `dd`). */
  value: ReactNode;
}

export interface DescriptionListProps {
  /** Пары «подпись — значение» в порядке показа. */
  items: DescriptionItem[];
  /**
   * Раскладка на широком экране.
   *
   * `columns` — подпись слева, значение справа; `stack` — значение под
   * подписью. На УЗКОМ экране обе складываются в стопку независимо от пропа:
   * две колонки на 360 пикселях означают, что подпись жмётся до одного слова,
   * а значение переносится по букве.
   */
  layout?: "columns" | "stack";
  /** Классы корневого элемента. */
  className?: string;
}

/**
 * Список «свойство — значение»: метаданные обоя, параметры кампании.
 *
 * Разметка — `dl` с парами `dt`/`dd`, а не таблица и не два столбца дивов:
 * связь подписи со значением здесь смысловая, и скринридер читает пару
 * целиком. Таблица объявила бы строки и колонки, которых по сути нет.
 */
export function DescriptionList({ items, layout = "columns", className }: DescriptionListProps) {
  return (
    <dl className={cn("m-0 flex flex-col gap-2", className)}>
      {items.map((item, index) => (
        <div
          key={index}
          className={cn(
            "flex gap-1",
            layout === "columns"
              ? // Стопка на узком, две колонки от `sm`. Порог общий с `Drawer`:
                // ниже него колоночная раскладка перестаёт быть читаемой.
                "flex-col sm:flex-row sm:items-baseline sm:gap-3"
              : "flex-col"
          )}
        >
          <dt
            className={cn(
              "text-fg-2 text-caption",
              layout === "columns" && "sm:w-[140px] sm:shrink-0"
            )}
          >
            {item.label}
          </dt>
          <dd className="text-fg-1 m-0 min-w-0 text-sm break-words">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
