"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import {
  Cell,
  Column,
  ColumnResizer,
  ResizableTableContainer,
  Row,
  Table as AriaTable,
  TableBody,
  TableHeader,
  type ColumnProps,
  type Key,
  // Имя `Selection` занято глобальным типом DOM — берём под псевдонимом.
  type Selection as AriaSelection,
  type SortDescriptor,
} from "react-aria-components";
import { ChevronDownIcon } from "../../icons.js";
import { cn } from "../../lib/cn.js";
import { useMessages } from "../../i18n/useMessages.js";
import { Checkbox } from "../inputs/Checkbox.js";

export interface TableColumn<T> {
  /** Идентификатор колонки: по нему сообщается сортировка. */
  id: string;
  /** Подпись в шапке. */
  header: ReactNode;
  /** Как достать содержимое ячейки из строки. */
  cell: (item: T) => ReactNode;
  /** Колонку можно сортировать: заголовок становится нажимаемым и показывает направление. */
  sortable?: boolean;
  /**
   * Ширина: число пикселей, доля (`1fr`) или проценты.
   *
   * Тип взят у react-aria (`ColumnSize`), а не расширен до `string`: там он
   * шаблонный (`${number}fr`, `${number}%`), и опечатку вроде `"1 fr"`
   * компилятор ловит на месте, а не таблица — молчаливой раскладкой.
   *
   * Куда она уходит, зависит от режима, и это не деталь реализации: у
   * react-aria проп `width` действует ТОЛЬКО внутри `ResizableTableContainer`,
   * то есть при `resizable`. В обычной таблице он не делает ничего — молча.
   * Поэтому при `resizable` ширина уходит в `defaultWidth` (начальный размер,
   * который пользователь потом меняет ручкой), а без него — в CSS-стиль
   * ячейки шапки, потому что иначе её просто не существует.
   */
  width?: ColumnProps["width"];
  /** Выравнивание содержимого колонки: `start` или `end`. */
  align?: "start" | "end";
}

export interface TableProps<T extends { id: Key }> {
  /** Колонки таблицы в порядке показа. */
  columns: TableColumn<T>[];
  /** Строки таблицы; у каждой есть `id`. */
  items: T[];
  /** Доступное имя таблицы. Обязательно: безымянную таблицу скринридер называет только по роли. */
  "aria-label": string;
  /** Сортировка. Включается только при наличии — таблица её сама не хранит. */
  sort?: SortDescriptor;
  /** Вызывается с новым описанием сортировки после клика на заголовок. */
  onSortChange?: (sort: SortDescriptor) => void;
  /** Выделение строк. Без пропа колонка с флажками не рисуется вовсе. */
  selectedKeys?: Set<Key>;
  /** Вызывается с новым набором выбранных ключей. */
  onSelectionChange?: (keys: Set<Key>) => void;
  /**
   * Действие по строке: открыть запись, перейти к ней. Ось включается наличием
   * пропа; получает строку из `items`.
   *
   * Работает РЯДОМ с выделением, а не вместо него: выделяют флажки, а клик по
   * строке и Enter на сфокусированной строке вызывают действие. Пробел на строке
   * по-прежнему переключает выделение. Это правило `react-aria` («selection
   * mode»): пока ничего не выделено, клик по строке — действие; как только
   * выделение появилось, клик по строке его переключает, и продолжить отмечать
   * можно по всей строке, не целясь во флажок. Действие тогда остаётся на Enter.
   *
   * Элементы внутри ячеек (кнопка, ссылка, меню) сохраняют свой клик и строку
   * не активируют. Ссылку с ручным `stopPropagation` ради этого заводить не
   * нужно. Строки раскрытия (`renderDetail`) и кнопка-раскрыватель действие не
   * вызывают.
   */
  onRowAction?: (item: T) => void;
  /**
   * Раскрытие строки: что показать под ней. Ось включается наличием пропа —
   * без него нет ни колонки-раскрывателя, ни детальных строк в разметке.
   */
  renderDetail?: (item: T) => ReactNode;
  /**
   * Раскрытые строки: множество ключей строк, у которых показаны подробности.
   *
   * Множеством, как `selectedKeys`, и **без переключателя
   * «одна или несколько»**: сколько строк открыто разом, решает тот, у кого
   * лежит состояние, кладя сюда один ключ или несколько (ADR-0022).
   *
   * НЕОБЯЗАТЕЛЕН. Без него раскрытие работает на собственном состоянии
   * таблицы: `renderDetail` без состояния снаружи — законная и самая частая
   * форма вызова, и отнимать её ради чистоты правила «таблица ничего не
   * хранит» значило бы оставить живую на вид кнопку, не делающую ничего.
   *
   * РЕЖИМ ОПРЕДЕЛЯЕТСЯ НАЛИЧИЕМ ПРОПА, как у `InlineEdit` с `editing`. Если
   * состояние появляется лениво (`expandedKeys={saved?.expanded}`), первый
   * рендер выйдет неуправляемым, второй — управляемым, и раскрытые строки
   * схлопнутся. Передавайте пустое множество, а не `undefined`.
   */
  expandedKeys?: Set<Key>;
  /** Вызывается с новым набором раскрытых строк. */
  onExpandedChange?: (keys: Set<Key>) => void;
  /**
   * Имя строки для подписей построчных кнопок.
   *
   * Без него у всех раскрывателей одинаковое имя, и скринридер в режиме
   * перечисления кнопок читает двадцать одинаковых «Показать подробности».
   * Первую колонку в качестве имени взять нельзя: её `cell` возвращает
   * `ReactNode` — там бывает аватар или вёрстка, и в имя попал бы мусор.
   */
  rowLabel?: (item: T) => string;
  /** Липкая шапка. Требует, чтобы у контейнера была своя высота и прокрутка. */
  stickyHeader?: boolean;
  /** Изменение ширины колонок мышью и с клавиатуры. */
  resizable?: boolean;
  /** Что показать, когда строк нет. По умолчанию — стандартный текст пустой таблицы. */
  emptyText?: ReactNode;
  /** Классы корневого элемента. */
  className?: string;
}

/**
 * Таблица.
 *
 * ОСИ ВКЛЮЧАЮТСЯ ЯВНО, и это главное решение компонента. Таблица, которая
 * умеет всё сразу, на экране из трёх строк тащит сортировку, флажки и ручки
 * изменения ширины — всё нерабочее и всё в разметке. Поэтому каждая ось
 * появляется только вместе со своим пропом:
 *
 *   сортировка       — `sort` + `onSortChange`
 *   выделение строк  — `selectedKeys` + `onSelectionChange`
 *   липкая шапка     — `stickyHeader`
 *   изменение ширины — `resizable`
 *
 * Состояние осей таблица, как правило, НЕ ХРАНИТ (исключение — раскрытие, см. `expandedKeys`): сортировка почти всегда уходит
 * в запрос к серверу, а выделение — в панель массовых действий снаружи.
 * Внутреннее состояние здесь означало бы две копии правды.
 *
 * **Виртуализации нет намеренно.** `Virtualizer` в react-aria есть, и включить
 * его недолго, но пока нет экрана, где список настолько длинный, это
 * оптимизация без задачи: она усложняет разметку, ломает поиск по странице и
 * печать, а выигрыш измерить не на чем.
 *
 * Поведение — RAC `Table`: клавиатурная навигация по ячейкам, `aria-sort`,
 * роли строк и заголовков, выделение с Shift и Ctrl.
 */
/**
 * Префикс ключа колонки.
 *
 * У react-aria ключи колонок и строк лежат в ОДНОМ пространстве имён
 * коллекции, и колонка с `id="b"` схлопывается со строкой `id="b"`: одна из
 * них молча исчезает, а таблица падает с «Cell count must match column count»,
 * где числа не сходятся на единицу и ни слова про причину.
 *
 * Совпадение это не экзотика: у строк идентификаторы приходят из данных, у
 * колонок их пишет разработчик, и `id: "name"` рядом со строкой `name` —
 * вопрос времени. Поэтому ключи колонок разведены здесь, внутри, а наружу
 * по-прежнему отдаются и принимаются исходные (`sort.column`).
 */
const COLUMN_KEY = "od-col:";

/** Префикс ключа детальной строки — см. `detailKey` ниже. */
const DETAIL_PREFIX = "od-detail:";

/*
  Снимки для `useSyncExternalStore`: на сервере и при гидратации — `false`,
  после неё — `true`, без подписки (значение больше не меняется).
*/
const subscribeNever = () => () => {};
const isHydrated = () => true;
const isServer = () => false;

export function Table<T extends { id: Key }>({
  columns,
  items,
  sort,
  onSortChange,
  selectedKeys,
  onSelectionChange,
  renderDetail,
  expandedKeys,
  onExpandedChange,
  onRowAction,
  rowLabel,
  stickyHeader,
  resizable,
  emptyText,
  className,
  ...rest
}: TableProps<T>) {
  const messages = useMessages();

  /*
    Сортировка включается для react-aria ПОСЛЕ гидратации, а не с первого кадра.

    `useTableColumnHeader` решает про `aria-sort` по платформе: на Android
    (TalkBack атрибут не поддерживает) он не ставится вовсе, на остальных у
    сортируемой колонки он есть всегда — `none` у несортированной. Сервер
    платформы не знает и пишет вариант «не Android», поэтому Android-клиент
    при гидратации видел разметку, не совпадающую с его собственной, и React
    писал «A tree hydrated but some attributes… didn't match» на каждой
    сортируемой колонке. Обойти это снаружи нельзя: `aria-sort`
    строит сама библиотека и пропсами колонки он не перекрывается.

    Поэтому первый кадр — и серверный, и гидратационный — рисует колонки как
    несортируемые, то есть без `aria-sort` у всех клиентов, а уже смонтированная
    таблица включает сортировку, и атрибут ставится по правилам платформы.
    Цена: в статичной разметке нет `aria-sort`; до гидратации сортировка и так
    не работает, а направление видно по иконке (её рисуем мы, она от этого флага
    не зависит).
  */
  const hydrated = useSyncExternalStore(subscribeNever, isHydrated, isServer);

  const selectable = selectedKeys != null && onSelectionChange != null;
  const expandable = renderDetail != null;

  /*
    Раскрытие работает и БЕЗ `expandedKeys`.

    Раньше ось включалась одним `renderDetail`, а `toggleExpanded` строил
    `new Set(undefined)` и звал необязательный колбэк в никуда: рисовалась живая
    на вид кнопка — `aria-expanded="false"`, рабочее наведение — и клик, не
    делающий ничего. Три пропа необязательны независимо, компилятор такой вызов
    пропускал, и получался «недоступный список, который выглядит рабочим», о
    котором предупреждает докстрока `SortableList`.

    Убрать колонку было бы проще, но это отняло бы простую форму вызова, которой
    пользуются: `renderDetail` без состояния снаружи — законный и самый частый
    случай. Поэтому вторая ветка контролируемости, как у `InlineEdit`: состояние
    держится внутри, пока его не ведут снаружи.
  */
  const [uncontrolledExpanded, setUncontrolledExpanded] = useState<Set<Key>>(new Set());
  const currentExpanded = expandedKeys ?? uncontrolledExpanded;

  /**
   * Префикс ключа детальной строки — по той же причине, что `COLUMN_KEY`: у
   * react-aria строки лежат в одном пространстве имён, и деталь строки `b`
   * схлопнулась бы со строкой `b`, если бы взяла её ключ.
   */
  const detailKey = (id: Key) => `${DETAIL_PREFIX}${String(id)}`;

  /**
   * Что отдать наружу по ответу react-aria.
   *
   * `'all'` — не строка-ключ, а отдельное значение `Selection`, и отдаёт его
   * `toggleSelectAll()`. Приведение к `Set` разбирало эту строку ПО БУКВАМ и
   * отдавало наружу `["a","l"]`: выделение молча не срабатывало, а панель
   * массовых действий получала два ключа, которых нет ни в одной строке.
   *
   * Но и перечислить текущую страницу недостаточно, и это второй, более дорогой
   * дефект. `items` — ЭТО ОДНА СТРАНИЦА: выше стоит `useTableState`, который
   * режет набор. Отдавая наружу только её, «выделить всё» стирало отметки,
   * сделанные на других страницах, — то есть ломало ровно тот инвариант,
   * который `useTableState` объявляет своей главной ценностью («отметил строки,
   * перелистнул — потерял всё»). Пользователь видел, как счётчик массовых
   * действий уменьшается после нажатия «выделить всё».
   *
   * Поэтому «всё» — это ОБЪЕДИНЕНИЕ с уже пришедшим, а снятие — вычитание
   * ключей текущей страницы, а не обнуление набора.
   *
   * Детальные строки из выделения вычитаются здесь же: их синтетический ключ
   * (`detailKey`) наружу уходить не может — он не соответствует ни одной
   * записи, и массовое действие ушло бы на бэкенд с несуществующим id.
   */
  const resolveSelection = (keys: AriaSelection): Set<Key> => {
    // `Set`, а не массив: перебор ниже идёт по ВСЕМУ выделению, а оно теперь
    // межстраничное — то есть ровно эта правка и делает большой набор
    // достижимым. С `includes` пять тысяч отмеченных строк против сотни на
    // странице давали бы полмиллиона сравнений на каждый щелчок.
    const page = new Set(items.map((i) => i.id));
    if (keys === "all") return new Set([...(selectedKeys ?? []), ...page]);

    const next = new Set<Key>();
    for (const key of keys) if (!String(key).startsWith(DETAIL_PREFIX)) next.add(key);

    // Ключи чужих страниц доносим САМИ. react-aria их как раз возвращает —
    // она строит набор из пропа `selectedKeys` как есть, — но полагаться на это
    // нельзя: в наборе, пришедшем от неё, чужих ключей может и не оказаться,
    // если выделение пересобрали. Дубли снимает `Set`.
    for (const key of selectedKeys ?? []) if (!page.has(key)) next.add(key);
    return next;
  };

  const toggleExpanded = (id: Key) => {
    const next = new Set(currentExpanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    if (expandedKeys == null) setUncontrolledExpanded(next);
    onExpandedChange?.(next);
  };

  /** Сколько ячеек в строке — столько же обязана занять детальная. */
  const span = columns.length + (selectable ? 1 : 0) + (expandable ? 1 : 0);

  const table = (
    <AriaTable
      {...rest}
      className={cn("w-full border-separate border-spacing-0 text-sm", className)}
      sortDescriptor={sort ? { ...sort, column: `${COLUMN_KEY}${String(sort.column)}` } : undefined}
      onSortChange={(next) =>
        onSortChange?.({ ...next, column: String(next.column).slice(COLUMN_KEY.length) })
      }
      selectionMode={selectable ? "multiple" : "none"}
      /*
        Детальные строки ВЫЧЕРКИВАЮТСЯ ИЗ КОЛЛЕКЦИИ, а не только из ответа.

        Они входили в подсчёт `isSelectAll` у react-aria, но попасть в
        выделение не могли (их ключ вычитается ниже), поэтому «выделено всё» не
        наступало НИКОГДА: флажок шапки всегда шёл по ветке `selectAll`, и снять
        выделение им было нельзя вовсе — оставалось снимать по строке.

        `disabledBehavior="selection"` оставляет строку интерактивной (кнопка
        раскрытия и содержимое детали работают), запрещая ровно выделение.
      */
      disabledBehavior="selection"
      disabledKeys={expandable ? items.map((item) => detailKey(item.id)) : undefined}
      selectedKeys={selectedKeys}
      onSelectionChange={(keys) => onSelectionChange?.(resolveSelection(keys))}
      /*
        Строка детали сюда не попадает: её синтетический ключ (`detailKey`) не
        соответствует ни одной записи, и `find` вернул бы `undefined`.
      */
      onRowAction={
        onRowAction
          ? (key) => {
              const item = items.find((candidate) => candidate.id === key);
              if (item) onRowAction(item);
            }
          : undefined
      }
    >
      <TableHeader className={cn(stickyHeader && "sticky top-0 z-10")}>
        {selectable ? (
          <Column
            className="border-line-soft bg-bg-1 text-fg-2 border-b px-3 py-2 text-left font-semibold"
            width={40}
          >
            {/*
              Флажок «выделить всё» — родной RAC (`slot="selection"`), а не наш
              `Checkbox`: он читает состояние выделения таблицы из контекста,
              включая третье состояние «выделено не всё». Наш встал бы сюда
              немым.
            */}
            <Checkbox slot="selection" label={messages.table.selectAll} />
          </Column>
        ) : null}

        {expandable ? (
          <Column
            id={`${COLUMN_KEY}od-expander`}
            width={40}
            className="border-line-soft bg-bg-1 border-b px-3 py-2"
          >
            {/*
              Заголовок у колонки-раскрывателя пустой на вид, но не пустой для
              скринридера: безымянная колонка объявляется только по роли, и
              таблица начинается с непонятного столбца.
            */}
            <span className="sr-only">{messages.table.expandColumn}</span>
          </Column>
        ) : null}

        {columns.map((column) => (
          <Column
            key={column.id}
            id={`${COLUMN_KEY}${column.id}`}
            isRowHeader={column === columns[0]}
            allowsSorting={column.sortable && hydrated}
            defaultWidth={resizable ? column.width : undefined}
            style={!resizable && column.width != null ? { width: column.width } : undefined}
            className={cn(
              "border-line-soft bg-bg-1 text-fg-2 border-b px-3 py-2 font-semibold",
              column.align === "end" ? "text-right" : "text-left",
              column.sortable && "cursor-pointer"
            )}
          >
            {({ sortDirection }) => (
              <span
                className={cn("flex items-center gap-1", column.align === "end" && "justify-end")}
              >
                {column.header}
                {column.sortable ? (
                  // Иконка направления рисуется ТОЛЬКО у колонки, по которой
                  // сортируют: иконка на каждой колонке превращает шапку в
                  // ряд стрелок, где текущую не найти. Само направление
                  // скринридеру сообщает `aria-sort`, который ставит RAC.
                  <ChevronDownIcon
                    size={12}
                    aria-hidden
                    className={cn(
                      "shrink-0 transition-transform motion-reduce:transition-none",
                      sortDirection == null && "opacity-0",
                      sortDirection === "ascending" && "rotate-180"
                    )}
                  />
                ) : null}
                {resizable ? (
                  <ColumnResizer className="bg-line-soft hover:bg-accent-strong ml-auto w-px cursor-col-resize" />
                ) : null}
              </span>
            )}
          </Column>
        ))}
      </TableHeader>

      {/*
        Строки перечисляются явно, а не отдаются `items`: детальная строка —
        это вторая `Row` рядом с обычной, а функция-рендер `items` отдаёт
        ровно одну. Без раскрытия результат тот же, что был.
      */}
      <TableBody
        renderEmptyState={() => (
          <div className="text-fg-2 px-3 py-8 text-center text-sm">
            {emptyText ?? messages.table.empty}
          </div>
        )}
      >
        {items.flatMap((item) => {
          const isExpanded = currentExpanded.has(item.id);

          const row = (
            <Row
              key={String(item.id)}
              id={item.id}
              className={cn(
                "outline-none",
                onRowAction && "cursor-pointer",
                "hover:bg-bg-2 selected:bg-accent-soft",
                "focus-visible:outline-accent-strong focus-visible:outline-2 focus-visible:-outline-offset-2"
              )}
            >
              {selectable ? (
                <Cell className="border-line-soft border-b px-3 py-2">
                  <Checkbox slot="selection" label={messages.table.selectRow} />
                </Cell>
              ) : null}
              {expandable ? (
                <Cell className="border-line-soft border-b px-3 py-2">
                  <button
                    type="button"
                    aria-expanded={isExpanded}
                    aria-label={
                      isExpanded
                        ? messages.table.collapseRow({ row: rowLabel?.(item) })
                        : messages.table.expandRow({ row: rowLabel?.(item) })
                    }
                    onClick={() => toggleExpanded(item.id)}
                    className="text-fg-2 hover:text-fg-0 focus-visible:outline-accent-strong inline-flex size-6 cursor-pointer items-center justify-center rounded-sm focus-visible:outline-2 focus-visible:outline-offset-1"
                  >
                    <ChevronDownIcon
                      size={14}
                      aria-hidden
                      className={cn(
                        "transition-transform motion-reduce:transition-none",
                        !isExpanded && "-rotate-90"
                      )}
                    />
                  </button>
                </Cell>
              ) : null}
              {columns.map((column) => (
                <Cell
                  key={column.id}
                  className={cn(
                    "border-line-soft text-fg-1 border-b px-3 py-2",
                    column.align === "end" && "text-right"
                  )}
                >
                  {column.cell(item)}
                </Cell>
              ))}
            </Row>
          );

          if (!isExpanded || renderDetail == null) return [row];

          return [
            row,
            <Row key={detailKey(item.id)} id={detailKey(item.id)} className="outline-none">
              <Cell colSpan={span} className="border-line-soft bg-bg-1 border-b px-3 py-3">
                {renderDetail(item)}
              </Cell>
            </Row>,
          ];
        })}
      </TableBody>
    </AriaTable>
  );

  // Контейнер изменения ширины нужен только при `resizable`: он оборачивает
  // таблицу своим боксом, и ставить его вхолостую значит добавлять лишний узел
  // в раскладку каждой таблицы приложения.
  return resizable ? <ResizableTableContainer>{table}</ResizableTableContainer> : table;
}
