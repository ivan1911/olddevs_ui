import type { Key, SortDescriptor } from "react-aria-components";
import type { Density } from "./variants.js";

/**
 * Контракт состояния таблицы и его перенос в адрес.
 *
 * Модуль намеренно БЕЗ `"use client"`: разбор адреса нужен и на сервере — в
 * Next.js состояние восстанавливается из `searchParams` до отрисовки. Хук
 * `useTableState` — React-обвязка поверх этих же типов.
 */

/**
 * Применённый фильтр.
 *
 * У токена СВОЙ идентификатор, а не пара «поле + значение», и это не
 * педантизм: два фильтра по одному полю дают одинаковые на вид токены, и снять
 * нужный станет нечем. Подпись источником правды тоже не является — она
 * локализуется и обрезается, а снимать по обрезанной подписи нельзя.
 *
 * Операторов здесь нет намеренно (ADR-0023, ADR-0063): без `to` токен означает
 * равенство, с `to` — диапазон `value…to`. `gte` и `lte` — тот же диапазон с
 * пустой границей, поэтому отдельной оси не заводится. `contains` и `in`
 * по-прежнему ждут своего заказчика, а не догадки.
 */
export interface TableFilter {
  id: string;
  /** Поле данных. Как оно называется на сервере, решает потребитель. */
  field: string;
  /**
   * Значение — или нижняя граница диапазона, если задано `to`. Для диапазона
   * пустая строка значит «снизу не ограничено».
   */
  value: string;
  /**
   * Верхняя граница диапазона. **Не задано — токен равенства; пустая строка —
   * диапазон без верха** («от 50»). Различие несёт сам факт наличия ключа,
   * поэтому проверять его надо через `!== undefined`, а не по истинности.
   * Числа и даты ходят строками: ISO-даты `ГГГГ-ММ-ДД`, как везде в ките.
   */
  to?: string;
  /** Что показать в токене. Нет — потребитель покажет `field: value`. */
  label?: string;
}

export interface TableState {
  /** Не задана — таблица не отсортирована; ось сортировки не включается. */
  sort?: SortDescriptor;
  /** Нумерация с единицы: так же считает `Pagination`. */
  page: number;
  pageSize: number;
  selectedKeys: Set<Key>;
  expandedKeys: Set<Key>;
  filters: TableFilter[];
  /** Порядок колонок идентификаторами. Пустой — порядок объявления. */
  columnOrder: string[];
  hiddenColumns: Set<string>;
  density: Density;
}

/** Умолчания состояния, кроме плотности: её даёт провайдер. */
export const DEFAULT_TABLE_STATE: Omit<TableState, "density"> = {
  page: 1,
  pageSize: 25,
  selectedKeys: new Set(),
  expandedKeys: new Set(),
  filters: [],
  columnOrder: [],
  hiddenColumns: new Set(),
};

const PARAM = {
  sort: "sort",
  page: "page",
  size: "size",
  filter: "f",
  hidden: "hide",
  order: "cols",
  density: "density",
} as const;

/**
 * Части фильтра кодируются по отдельности: `:` внутри значения не помешает.
 *
 * Подпись едет ЧЕТВЁРТОЙ частью. Раньше кодировались только три, и `label`
 * терялся: `FilterBarAdd` всегда проставляет его («Раздел: Договоры»), а
 * пользователь, скопировавший ссылку и открывший её заново, видел
 * «section: contracts» — сырые идентификаторы бэкенда вместо человеческой
 * подписи. Round-trip-тест этого не ловил, потому что брал фильтры без `label`.
 *
 * Верхняя граница диапазона едет ПЯТОЙ частью (ADR-0063). Её присутствие и
 * есть признак диапазона, поэтому пустая пятая часть пишется, а не
 * опускается: «от 50» иначе стало бы равенством «= 50». У равенства пятой
 * части нет, и его адрес остался прежним.
 */
const encodeFilter = (f: TableFilter) => {
  const parts = [f.id, f.field, f.value, f.label ?? ""];
  if (f.to !== undefined) parts.push(f.to);
  return parts.map(encodeURIComponent).join(":");
};

/**
 * `decodeURIComponent`, не бросающий на битой escape-последовательности.
 *
 * `URLSearchParams` уже раскодировал параметр один раз, поэтому `%25zz`
 * приходит сюда как `%zz` — незавершённая последовательность, на которой
 * штатный `decodeURIComponent` бросает `URIError`. Раньше он бросал его прямо
 * в `tableStateFromParams`, а модуль намеренно без `"use client"` и зовётся на
 * сервере из `searchParams`: один символ `%` в ссылке давал 500 на маршруте.
 */
function decodeOrNull(part: string): string | null {
  try {
    return decodeURIComponent(part);
  } catch {
    return null;
  }
}

function decodeFilter(raw: string): TableFilter | null {
  const parts = raw.split(":");
  // Три части — ссылка, сохранённая до волны 26: подписи там нет, и это не
  // повод отбросить фильтр. Пять — диапазон (ADR-0063); четыре и три читаются
  // как раньше.
  if (parts.length < 3 || parts.length > 5) return null;
  const decoded = parts.map(decodeOrNull);
  // Битая часть отбраковывает фильтр целиком — так же, как это уже делает
  // неверное число частей. Отбрасывается один токен, не весь разбор.
  if (decoded.some((part) => part == null)) return null;
  const [id, field, value, label, to] = decoded as [
    string,
    string,
    string,
    string | undefined,
    string | undefined,
  ];
  if (!id || !field) return null;
  const filter: TableFilter = { id, field, value };
  if (label) filter.label = label;
  if (to !== undefined) filter.to = to;
  return filter;
}

/**
 * Состояние → параметры адреса.
 *
 * **Умолчания не пишутся.** Иначе ссылка на первую страницу без фильтров
 * обрастает шестью параметрами, и скопировать её человеку неудобно.
 *
 * **Выделение и раскрытие в адрес не идут**, хотя спека называла выделение
 * среди состояния. Причины две: список ключей ничем не ограничен по длине, и
 * ссылка с выделением, открытая назавтра, отмечает записи, которых уже нет.
 * Выделение — состояние сеанса, а не адреса.
 */
export function tableStateToParams(state: Partial<TableState>): URLSearchParams {
  const params = new URLSearchParams();

  if (state.sort)
    params.set(
      PARAM.sort,
      `${String(state.sort.column)}:${state.sort.direction === "descending" ? "desc" : "asc"}`
    );

  if (state.page != null && state.page !== DEFAULT_TABLE_STATE.page)
    params.set(PARAM.page, String(state.page));

  if (state.pageSize != null && state.pageSize !== DEFAULT_TABLE_STATE.pageSize)
    params.set(PARAM.size, String(state.pageSize));

  for (const filter of state.filters ?? []) params.append(PARAM.filter, encodeFilter(filter));

  if (state.hiddenColumns?.size) params.set(PARAM.hidden, [...state.hiddenColumns].join(","));
  if (state.columnOrder?.length) params.set(PARAM.order, state.columnOrder.join(","));
  if (state.density && state.density !== "comfortable") params.set(PARAM.density, state.density);

  return params;
}

/**
 * Параметры адреса → состояние.
 *
 * Возвращает ЧАСТЬ состояния: адрес несёт не всё, и недостающее берётся из
 * умолчаний вызывающего. Мусор не роняет разбор и не даёт сломанного
 * состояния — адрес приходит от пользователя, а он правит его руками.
 */
export function tableStateFromParams(params: URLSearchParams): Partial<TableState> {
  const state: Partial<TableState> = {};

  const sort = params.get(PARAM.sort);
  if (sort) {
    const at = sort.lastIndexOf(":");
    const column = at === -1 ? sort : sort.slice(0, at);
    const direction = at === -1 ? "asc" : sort.slice(at + 1);
    if (column)
      state.sort = {
        column,
        direction: direction === "desc" ? "descending" : "ascending",
      };
  }

  // `Number` на мусоре даёт `NaN`, а на «-3» — отрицательную страницу: обе
  // ведут к пустому экрану, который пользователь прочтёт как «ничего нет».
  const page = Number(params.get(PARAM.page));
  if (Number.isInteger(page) && page > 0) state.page = page;

  const size = Number(params.get(PARAM.size));
  if (Number.isInteger(size) && size > 0) state.pageSize = size;

  const filters = params
    .getAll(PARAM.filter)
    .map(decodeFilter)
    .filter((f): f is TableFilter => f != null);
  if (filters.length) state.filters = filters;

  const hidden = params.get(PARAM.hidden);
  if (hidden) state.hiddenColumns = new Set(hidden.split(",").filter(Boolean));

  const order = params.get(PARAM.order);
  if (order) state.columnOrder = order.split(",").filter(Boolean);

  const density = params.get(PARAM.density);
  if (density === "compact" || density === "comfortable") state.density = density;

  return state;
}

/**
 * Упорядочить колонки по списку идентификаторов.
 *
 * Список — **префикс, а не полный перечень**. Не названные в нём колонки
 * встают следом в порядке объявления, а неизвестные идентификаторы
 * пропускаются.
 *
 * Иначе порядок, пришедший из адреса, молча выбрасывал бы колонки: ссылка,
 * сохранённая до появления новой колонки, показывала бы урезанную таблицу — и
 * выглядело бы это как рабочая таблица, а не как ошибка. Ровно это ловится
 * тестом; поведение общее для `DataTable` и `TablePreferences`, поэтому живёт
 * здесь, а не двумя копиями.
 */
export function orderColumns<T extends { id: string }>(columns: T[], order: string[]): T[] {
  if (order.length === 0) return columns;

  const byId = new Map(columns.map((c) => [c.id, c]));
  const listed = order.flatMap((id) => {
    const column = byId.get(id);
    if (!column) return [];
    byId.delete(id);
    return [column];
  });

  // Остаток — в порядке объявления: он и есть умолчание.
  return [...listed, ...columns.filter((c) => byId.has(c.id))];
}

/**
 * Отсеять скрытые колонки, не доводя таблицу до нуля.
 *
 * Панель настроек снять последнюю видимую не даёт, но состояние приходит и из
 * адреса, где такой охраны нет: `?hide=` со всеми колонками давал таблицу без
 * единого заголовка. Пустая таблица — не состояние интерфейса, а поломка,
 * поэтому скрытие целиком игнорируется.
 */
export function visibleColumns<T extends { id: string }>(columns: T[], hidden: Set<string>): T[] {
  const visible = columns.filter((c) => !hidden.has(c.id));
  return visible.length > 0 ? visible : columns;
}
