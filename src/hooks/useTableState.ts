"use client";

import { useCallback, useMemo, useState } from "react";
import { useUiConfig } from "../i18n/useMessages.js";
import { DEFAULT_TABLE_STATE, type TableState } from "../lib/table-state.js";

export interface TableStateApi {
  state: TableState;
  /**
   * Изменить часть состояния. Один обновлятель, а не десять именованных
   * обработчиков: инварианты ниже обязаны срабатывать независимо от того, что
   * именно поменяли, и разложенные по десяти функциям они разъехались бы.
   */
  set: (patch: Partial<TableState>) => void;
  /** Вернуть начальное состояние целиком. */
  reset: () => void;
}

/**
 * Состояние таблицы: форма и связи между её частями.
 *
 * Хук **ничего не хранит вне React** и ни на что не подписывается — ни на
 * маршрутизатор, ни на хранилище. Кит описывает форму, владеет ею потребитель
 * (ADR-0023). Перенос в адрес — `tableStateToParams` / `tableStateFromParams`,
 * применять их к адресу тоже дело приложения.
 *
 * ИНВАРИАНТЫ, ради которых хук вообще существует:
 *
 * - смена фильтров, сортировки или РАЗМЕРА СТРАНИЦЫ **сбрасывает страницу на
 *   первую**. Иначе
 *   пользователь оказывается на четвёртой странице выборки из десяти строк и
 *   видит пустоту, приняв её за «ничего не найдено»;
 * - выделение при этом **не сбрасывается**. Обратное выглядит аккуратнее и
 *   срывает массовое действие ровно тогда, когда оно нужнее всего: отметил
 *   строки, перелистнул — потерял всё.
 *
 * Начальная плотность берётся у `UiProvider`, если её не задали явно: админка
 * с пятью таблицами объявляет её один раз.
 */
export function useTableState(initial: Partial<TableState> = {}): TableStateApi {
  const { density: providerDensity } = useUiConfig();

  const start = useMemo<TableState>(
    () => ({ ...DEFAULT_TABLE_STATE, density: providerDensity, ...initial }),
    // Начальное значение и есть начальное: пересобирать его на каждое
    // изменение пропов значило бы сбрасывать состояние пользователя под ним.
    []
  );

  const [state, setState] = useState<TableState>(start);

  const set = useCallback((patch: Partial<TableState>) => {
    setState((prev) => {
      const next = { ...prev, ...patch };

      // Страницу сбрасывает смена выборки, а не любое изменение: смена
      // плотности или видимости колонок оставляет пользователя там, где он был.
      const narrowed =
        ("filters" in patch && patch.filters !== prev.filters) ||
        ("sort" in patch && patch.sort !== prev.sort) ||
        // `pageSize` меняет ЧИСЛО СТРАНИЦ напрямую, и без него инвариант
        // держался наполовину: 200 строк, размер 25 → 100 со страницы 8 дают
        // `slice(700, 800)` — пусто, и таблица рисует «ничего не найдено».
        // Само это не чинится: `Pagination` зажимает страницу только у себя и
        // подсвечивает «2», пока таблица пуста.
        ("pageSize" in patch && patch.pageSize !== prev.pageSize);

      if (narrowed && !("page" in patch)) next.page = 1;
      return next;
    });
  }, []);

  const reset = useCallback(() => setState(start), [start]);

  return { state, set, reset };
}
