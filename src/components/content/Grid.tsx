"use client";

import { forwardRef, type ComponentPropsWithoutRef, type Ref } from "react";
import { cn } from "../../lib/cn.js";
import { devWarn } from "../../lib/dev-warn.js";
import {
  responsiveClasses,
  type Breakpoint,
  type Responsive,
  type ResponsiveClassMap,
} from "../../lib/responsive.js";

/** Число колонок. Закрытый набор: класс на каждое значение написан в словаре. */
export type GridColumns = 1 | 2 | 3 | 4 | 5 | 6;

/** Наименьшая ширина ячейки в пикселях — для автозаполнения строки. */
export type GridMinItemWidth = 120 | 160 | 200 | 240 | 280 | 320;

/** Ступень зазора между ячейками. */
export type GridGap = "none" | "xs" | "sm" | "md" | "lg" | "xl";

interface GridBaseProps extends ComponentPropsWithoutRef<"div"> {
  /**
   * Зазор между ячейками, ступенью шкалы: `xs` 8, `sm` 12, `md` 16, `lg` 24,
   * `xl` 32 пикселя. Число здесь не принимается: сетки на разных экранах
   * расходились бы на пару пикселей, и шкала перестала бы что-либо значить.
   */
  gap?: GridGap;
  /**
   * Тег. `ul`/`ol` — когда набор и есть список: скринридер объявит число
   * элементов. Детьми тогда идут `<li>` — это работа потребителя.
   */
  as?: "div" | "ul" | "ol";
}

/**
 * `columns` и `minItemWidth` взаимоисключающие, и это сказано типом: колонок
 * либо столько, сколько велено, либо столько, сколько влезает. Обе записи
 * сразу — противоречие в вызове. Потребитель на JS его всё же передаст; тогда
 * побеждает `minItemWidth`, и в разработке об этом пишет консоль.
 */
export type GridProps = GridBaseProps &
  (
    | {
        /**
         * Число колонок. Число — отзывчивая лестница (см. `COLUMNS_LADDER`),
         * объект — точное число с каждого брейкпойнта: `{ base: 1, md: 3 }`.
         * Неизменное число на любой ширине — `{ base: 3 }`.
         */
        columns?: Responsive<GridColumns>;
        minItemWidth?: never;
      }
    | {
        /** Наименьшая ширина ячейки; колонок столько, сколько влезает. */
        minItemWidth: GridMinItemWidth;
        columns?: never;
      }
  );

/*
  Каждый класс — целиком и литералом, включая префикс брейкпойнта: Tailwind
  сканирует исходник как текст, и `md:grid-cols-${n}` в CSS не попал бы.
  Матрица `tests/matrix.tsx` перебирает все клетки, и тест покрытия классов
  уронит прогон, если хоть одна не дошла до собранного CSS.
*/
const COLUMNS_CLASS: ResponsiveClassMap<GridColumns> = {
  base: {
    1: "grid-cols-1",
    2: "grid-cols-2",
    3: "grid-cols-3",
    4: "grid-cols-4",
    5: "grid-cols-5",
    6: "grid-cols-6",
  },
  sm: {
    1: "sm:grid-cols-1",
    2: "sm:grid-cols-2",
    3: "sm:grid-cols-3",
    4: "sm:grid-cols-4",
    5: "sm:grid-cols-5",
    6: "sm:grid-cols-6",
  },
  md: {
    1: "md:grid-cols-1",
    2: "md:grid-cols-2",
    3: "md:grid-cols-3",
    4: "md:grid-cols-4",
    5: "md:grid-cols-5",
    6: "md:grid-cols-6",
  },
  lg: {
    1: "lg:grid-cols-1",
    2: "lg:grid-cols-2",
    3: "lg:grid-cols-3",
    4: "lg:grid-cols-4",
    5: "lg:grid-cols-5",
    6: "lg:grid-cols-6",
  },
  xl: {
    1: "xl:grid-cols-1",
    2: "xl:grid-cols-2",
    3: "xl:grid-cols-3",
    4: "xl:grid-cols-4",
    5: "xl:grid-cols-5",
    6: "xl:grid-cols-6",
  },
};

/**
 * Лестница для числа: на телефоне одна колонка, с `sm` — не больше двух, с
 * `lg` — сколько сказано.
 *
 * Скачок к полному числу стоит на `lg`, а не на `md`, из-за `AppShell`: с `md`
 * он показывает боковую навигацию, и она забирает у содержимого 240 пикселей.
 * На `md` под сетку остаётся примерно столько же, сколько на `sm`, — двух
 * колонок там и хватает. Так же устроен `FormLayout`: `columns={2}` даёт одну
 * колонку до `sm`, и решает это CSS, а не вызывающий.
 */
const COLUMNS_LADDER: Record<GridColumns, Partial<Record<Breakpoint, GridColumns>>> = {
  1: { base: 1 },
  2: { base: 1, sm: 2 },
  3: { base: 1, sm: 2, lg: 3 },
  4: { base: 1, sm: 2, lg: 4 },
  5: { base: 1, sm: 2, lg: 5 },
  6: { base: 1, sm: 2, lg: 6 },
};

/*
  `auto-fill`, а не `auto-fit`: при трёх карточках на широком экране `auto-fit`
  схлопнул бы пустые дорожки и растянул эти три во всю строку — ячейки одного
  набора оказались бы разной ширины на разных страницах. `min(100%, …)` держит
  ячейку в контейнере уже минимальной ширины: без него она вылезала бы за край
  и давала горизонтальную прокрутку.
*/
const MIN_ITEM_WIDTH_CLASS: Record<GridMinItemWidth, string> = {
  120: "grid-cols-[repeat(auto-fill,minmax(min(100%,120px),1fr))]",
  160: "grid-cols-[repeat(auto-fill,minmax(min(100%,160px),1fr))]",
  200: "grid-cols-[repeat(auto-fill,minmax(min(100%,200px),1fr))]",
  240: "grid-cols-[repeat(auto-fill,minmax(min(100%,240px),1fr))]",
  280: "grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))]",
  320: "grid-cols-[repeat(auto-fill,minmax(min(100%,320px),1fr))]",
};

const GAP_CLASS: Record<GridGap, string> = {
  none: "gap-0",
  xs: "gap-2",
  sm: "gap-3",
  md: "gap-4",
  lg: "gap-6",
  xl: "gap-8",
};

/**
 * Сетка равных колонок.
 *
 * ПРЕДСТАВЛЕНИЕ БЕЗ ПОВЕДЕНИЯ: ни ролей, ни клавиатуры, ни состояния. Отсюда
 * и уровень — периферия (ADR-0014). Сетка с клавиатурой по ячейкам — это
 * `VirtualGrid`, а не этот компонент.
 *
 * КОЛОНКИ ПО ШИРИНЕ ЭКРАНА, А НЕ КОНТЕЙНЕРА. Медиазапросы — те же брейкпойнты,
 * на которых схлопываются `AppShell` и `FormLayout`, поэтому сетка ломается
 * вместе с оболочкой, а не сама по себе. Container queries в эту волну не
 * вошли: у кита их нет нигде, и первый случай не должен заводиться попутно.
 *
 * НА CSS, А НЕ НА РАСЧЁТЕ В JS: раскладка верна с первого кадра и на сервере.
 */
export const Grid = forwardRef<HTMLElement, GridProps>(function Grid(
  { columns, minItemWidth, gap = "md", as: tag = "div", className, ...rest },
  ref
) {
  if (columns != null && minItemWidth != null) {
    devWarn(
      "Grid: both `columns` and `minItemWidth` were passed, but they are mutually exclusive " +
        "(a fixed number of columns, or as many as fit). `minItemWidth` wins and `columns` is " +
        "ignored. Pass only one: `columns` for a set number, `minItemWidth` for auto-fill."
    );
  }
  const template =
    minItemWidth != null
      ? MIN_ITEM_WIDTH_CLASS[minItemWidth]
      : responsiveClasses(
          // `null` тоже объект для `typeof`; потребитель на JS получает от него
          // умолчание, а не сетку вовсе без колонок.
          columns != null && typeof columns === "object" ? columns : COLUMNS_LADDER[columns ?? 1],
          COLUMNS_CLASS
        );

  // Три тега различаются только типом элемента в ссылке, и TypeScript требует
  // ссылку, годную всем трём сразу. Ссылка от тега не зависит — потребитель
  // получает тот узел, что отрисован, — поэтому тег сводится к одному типу.
  const Comp = tag as "div";

  return (
    <Comp
      ref={ref as Ref<HTMLDivElement>}
      /*
        Роль `list` у `ul`/`ol` кажется лишней, но она нужна: preflight Tailwind
        снимает со списков маркеры (`list-style: none`), и WebKit с VoiceOver
        после этого перестаёт объявлять список и число элементов. Явная роль
        возвращает семантику. Стоит до `rest`, чтобы потребитель мог её
        переопределить.
      */
      role={tag === "div" ? undefined : "list"}
      className={cn("grid", template, GAP_CLASS[gap], className)}
      {...rest}
    />
  );
});
