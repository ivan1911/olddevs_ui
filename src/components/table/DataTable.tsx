"use client";

import type { ReactNode } from "react";
import type { Key } from "react-aria-components";
import { cn } from "../../lib/cn.js";
import { hasContent } from "../../lib/empty.js";
import { orderColumns, visibleColumns, type TableState } from "../../lib/table-state.js";
import { Skeleton } from "../content/Skeleton.js";
import { Table, type TableColumn, type TableProps } from "../content/Table.js";

export interface DataTableProps<T extends { id: Key }> extends Omit<
  TableProps<T>,
  | "sort"
  | "onSortChange"
  | "selectedKeys"
  | "onSelectionChange"
  | "expandedKeys"
  | "onExpandedChange"
> {
  /** Полный набор колонок таблицы; видимость и порядок накладываются на него из `state`. */
  columns: TableColumn<T>[];
  /** Строки таблицы. Каждая обязана нести `id` — по нему строится ключ и выделение. */
  items: T[];
  /** Состояние целиком — обычно из `useTableState`. */
  state: TableState;
  /**
   * Вызывается при любом изменении состояния — сортировки, выделения, раскрытия — и получает частичный патч.
   *
   * Изменения уходят одним патчем: инварианты живут в хуке, а не здесь.
   */
  onStateChange: (patch: Partial<TableState>) => void;
  /** Идёт загрузка. С данными на экране они остаются, без данных — скелет. */
  loading?: boolean;
  /** Ошибка. Если передана, показывается вместо тела всегда, даже когда данные есть. */
  error?: ReactNode;
  /** Полоса над таблицей — обычно `TableToolbar`. */
  toolbar?: ReactNode;
  /**
   * Выделение строк.
   *
   * Отдельный проп, а не «раз состояние есть — значит нужно»: в состоянии
   * `selectedKeys` лежит всегда, и передавай надстройка его безусловно, колонка
   * флажков появлялась бы у таблиц, которым выделение не нужно. Правило `Table`
   * — ось включается наличием пропа — надстройка не отменяет.
   */
  selectable?: boolean;
}

/*
 * Тип ключа берётся у react-aria, а не у React: у `React.Key` есть `bigint`,
 * которого в коллекциях react-aria нет, и союз не сходится.
 */

/** Плотные строки — классом, а не токеном: это раскладка, а не цвет. */
const DENSITY_CLASS = {
  comfortable: "",
  compact: "[&_td]:py-1 [&_th]:py-1",
} as const;

/**
 * Продуктовая таблица: настройки колонок, плотность, состояния загрузки и
 * ошибки поверх низкоуровневой `Table`.
 *
 * НАДСТРОЙКА, А НЕ ЗАМЕНА. Внутри — та же `Table`, что снаружи: видимость и
 * порядок колонок, плотность и состояния выражаются её пропсами. Единственное,
 * что пришлось добавить в саму `Table`, — ось раскрытия: детальная строка живёт
 * внутри `<tbody>`, и вставить её снаружи невозможно (ADR-0022).
 *
 * Признак нарушения границы проверяемый: если что-то можно было сделать
 * пропсами снаружи, а оно оказалось внутри `Table`, — граница уже сдвинулась.
 *
 * СОСТОЯНИЯ РАЗЛИЧАЮТ ПЕРВУЮ ЗАГРУЗКУ И ПЕРЕЗАПРОС:
 *
 * - ошибка — всегда вместо тела: показанные при ошибке данные врут, а отличить
 *   устаревшие от актуальных пользователь не может;
 * - загрузка без данных — скелет вместо тела, шапка на месте;
 * - загрузка с данными — данные остаются под `aria-busy`. Иначе таблица
 *   схлопывалась бы в скелет на каждой смене страницы;
 * - пусто — только когда загрузка кончилась и ошибки нет.
 */
export function DataTable<T extends { id: Key }>({
  columns,
  items,
  state,
  onStateChange,
  loading = false,
  error,
  toolbar,
  selectable = false,
  className,
  emptyText,
  ...rest
}: DataTableProps<T>) {
  // Скрытая колонка НЕ попадает в разметку, а не прячется классом: спрятанный
  // столбец остаётся в дереве доступности заголовком без ячеек, и скринридер
  // читает таблицу с колонкой, которой на экране нет.
  //
  // Оба хелпера защищают от состояния, пришедшего из адреса: там ни порядок, ни
  // список скрытых с реальными колонками не сверялись.
  const visible = visibleColumns(orderColumns(columns, state.columnOrder), state.hiddenColumns);

  const first = loading && items.length === 0;
  /*
    Через `hasContent`, а не `error != null`.

    Волна завела предикат ровно против этого класса дефектов, и здесь он был
    пропущен. Самая частая идиома условного рендера — `error={isError && <Text/>}`
    — при отсутствии ошибки даёт `false`, а `false != null` истинно: `replaced`
    становился истинным, строки заменялись пустым телом, и таблица С ДАННЫМИ
    показывала пустоту плюс `role="alert"` без текста.
  */
  const failed = hasContent(error);
  const body: ReactNode = failed ? (
    /*
        Ошибка ОБЪЯВЛЯЕТСЯ, а пустой результат — нет.

        Текст ошибки подставлялся в `emptyText` и попадал в `renderEmptyState` —
        обычный `div`. Пользователь клавиатуры жал «Обновить», запрос падал,
        строки исчезали, на их месте появлялся текст, и не произносилось ничего:
        таблица молча пустела и читалась как «ничего не найдено».

        `alert`, а не `status`: сбой загрузки перебивает речь законно. Пустому
        результату и скелету роль не даётся — это не сбой.
      */
    <div role="alert">{error}</div>
  ) : first ? (
    <Skeleton className="h-24 w-full" />
  ) : (
    (emptyText ?? undefined)
  );

  // Замещающее состояние показывается пустым телом со своим содержимым: так
  // шапка остаётся на месте, и страница не скачет между состояниями.
  const replaced = failed || first;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {toolbar}

      <div
        aria-busy={loading || undefined}
        className={cn(loading && items.length > 0 && "opacity-60")}
      >
        <Table
          {...rest}
          columns={visible}
          items={replaced ? [] : items}
          emptyText={body}
          className={DENSITY_CLASS[state.density]}
          sort={state.sort}
          onSortChange={(sort) => onStateChange({ sort })}
          selectedKeys={selectable ? state.selectedKeys : undefined}
          onSelectionChange={
            selectable ? (selectedKeys) => onStateChange({ selectedKeys }) : undefined
          }
          expandedKeys={rest.renderDetail ? state.expandedKeys : undefined}
          onExpandedChange={
            rest.renderDetail ? (expandedKeys) => onStateChange({ expandedKeys }) : undefined
          }
        />
      </div>
    </div>
  );
}
