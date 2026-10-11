"use client";

import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { ChevronDownIcon, ChevronUpIcon } from "../../icons.js";
import { useMessages } from "../../i18n/useMessages.js";
import { cn } from "../../lib/cn.js";
import { orderColumns } from "../../lib/table-state.js";
import type { Density } from "../../lib/variants.js";
import { Button } from "../actions/Button.js";
import { Checkbox } from "../inputs/Checkbox.js";
import { Segmented } from "../actions/Segmented.js";

export interface TablePreferencesColumn {
  /** Идентификатор колонки; совпадает с `id` колонки таблицы. */
  id: string;
  /** Подпись. Строка, а не `ReactNode`: она же доступное имя флажка. */
  label: string;
  /** Колонку нельзя скрыть — например ту, что называет строку. */
  required?: boolean;
}

export interface TablePreferencesProps extends Omit<
  ComponentPropsWithoutRef<"div">,
  "onChange" | "children"
> {
  /** Колонки таблицы в порядке объявления. */
  columns: TablePreferencesColumn[];
  /** Скрытые колонки. Компонент ничего не хранит — значение приходит сверху. */
  hiddenColumns: Set<string>;
  /** Получает новое множество скрытых колонок после смены флажка. */
  onHiddenColumnsChange: (hidden: Set<string>) => void;
  /** Порядок колонок. Пустой — порядок объявления. Нет обработчика — нет кнопок. */
  columnOrder?: string[];
  /** Получает полный новый порядок после нажатия «выше» или «ниже». Не передан — кнопок порядка нет. */
  onColumnOrderChange?: (order: string[]) => void;
  /** Текущая плотность строк: `comfortable` или `compact`. */
  density: Density;
  /** Получает выбранную плотность. */
  onDensityChange: (density: Density) => void;
}

/**
 * Настройки таблицы: видимость и порядок колонок, плотность.
 *
 * ЭТО ПАНЕЛЬ, А НЕ МЕНЮ, и это решение, а не оплошность. Меню кита включает в
 * себя `Popover` и ждёт триггер; а главное — пункт меню не контейнер для
 * кнопок: вложенные в него кнопки «выше/ниже» ломают клавиатурную семантику
 * меню, где стрелки принадлежат самому меню. Поэтому обычные флажки и
 * `Segmented`, а оболочку — `Popover`, `Drawer` или `Dialog` — выбирает
 * потребитель.
 *
 * Состояния не хранит: видимость, порядок и плотность приходят сверху, обычно
 * из `useTableState`.
 *
 * ПОРЯДОК МЕНЯЕТСЯ КНОПКАМИ, а не перетаскиванием. Перетаскивание без
 * клавиатурной альтернативы недоступно вовсе, а альтернатива к нему — эти же
 * кнопки; заводить оба способа ради одного экрана несоразмерно.
 */
export const TablePreferences = forwardRef<HTMLDivElement, TablePreferencesProps>(
  function TablePreferences(
    {
      columns,
      hiddenColumns,
      onHiddenColumnsChange,
      columnOrder,
      onColumnOrderChange,
      density,
      onDensityChange,
      className,
      ...rest
    },
    ref
  ) {
    const messages = useMessages();

    // Список порядка — префикс: не названные в нём колонки встают следом. Прежняя
    // охрана по совпадению длин пропускала список той же длины с другими
    // идентификаторами, и часть колонок пропадала из панели.
    const ordered = orderColumns(columns, columnOrder ?? []);

    const visibleCount = columns.filter((c) => !hiddenColumns.has(c.id)).length;

    const toggle = (id: string, visible: boolean) => {
      const next = new Set(hiddenColumns);
      if (visible) next.delete(id);
      else next.add(id);
      onHiddenColumnsChange(next);
    };

    const move = (id: string, by: -1 | 1) => {
      const ids = ordered.map((c) => c.id);
      const at = ids.indexOf(id);
      const to = at + by;
      if (at === -1 || to < 0 || to >= ids.length) return;
      [ids[at], ids[to]] = [ids[to]!, ids[at]!];
      onColumnOrderChange?.(ids);
    };

    return (
      <div ref={ref} className={cn("flex w-[280px] flex-col gap-4", className)} {...rest}>
        <fieldset className="flex flex-col gap-1">
          <legend className="text-fg-2 mb-1 text-[11px] font-semibold tracking-wide uppercase">
            {messages.tablePreferences.columns}
          </legend>

          {ordered.map((column, index) => {
            const visible = !hiddenColumns.has(column.id);
            // Последнюю видимую колонку снять нельзя: таблица без колонок — не
            // состояние интерфейса, а поломка, из которой пользователю не
            // выбраться, потому что скрывать станет нечего.
            const last = visible && visibleCount === 1;

            return (
              <div key={column.id} className="flex items-center gap-2">
                <Checkbox
                  checked={visible}
                  disabled={column.required || last}
                  onCheckedChange={(next) => toggle(column.id, next)}
                >
                  {column.label}
                </Checkbox>
                {onColumnOrderChange ? (
                  <span className="ml-auto flex shrink-0 gap-0.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      iconOnly
                      icon={<ChevronUpIcon size={12} />}
                      aria-label={messages.tablePreferences.moveUp({ column: column.label })}
                      /*
                        `aria-disabled`, а НЕ `disabled`: кнопка на краю — та
                        самая, на которой стоит фокус. Браузер снимает фокус с
                        отключаемого элемента, и обход панели начинался заново
                        после второго нажатия подряд. Пустой обработчик здесь
                        честнее: кнопка остаётся в обходе и объявляется
                        недоступной, а не исчезает из-под пальца.
                      */
                      aria-disabled={index === 0 || undefined}
                      onClick={() => index !== 0 && move(column.id, -1)}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      iconOnly
                      icon={<ChevronDownIcon size={12} />}
                      aria-label={messages.tablePreferences.moveDown({ column: column.label })}
                      aria-disabled={index === ordered.length - 1 || undefined}
                      onClick={() => index !== ordered.length - 1 && move(column.id, 1)}
                    />
                  </span>
                ) : null}
              </div>
            );
          })}
        </fieldset>

        <div className="flex flex-col gap-1">
          <span className="text-fg-2 text-[11px] font-semibold tracking-wide uppercase">
            {messages.tablePreferences.density}
          </span>
          <Segmented
            value={density}
            onChange={onDensityChange}
            options={[
              { value: "comfortable", label: messages.tablePreferences.comfortable },
              { value: "compact", label: messages.tablePreferences.compact },
            ]}
          />
        </div>
      </div>
    );
  }
);
