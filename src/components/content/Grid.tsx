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

/** Number of columns. A closed set: a class for each value is written out in the dictionary. */
export type GridColumns = 1 | 2 | 3 | 4 | 5 | 6;

/** Smallest cell width in pixels, used to auto-fill a row. */
export type GridMinItemWidth = 120 | 160 | 200 | 240 | 280 | 320;

/** A step of the gap between cells. */
export type GridGap = "none" | "xs" | "sm" | "md" | "lg" | "xl";

interface GridBaseProps extends ComponentPropsWithoutRef<"div"> {
  /**
   * The gap between cells, a step of the scale: `xs` 8, `sm` 12, `md` 16, `lg` 24,
   * `xl` 32 pixels. A raw number is not accepted: grids on different screens would drift
   * apart by a couple of pixels, and the scale would stop meaning anything.
   */
  gap?: GridGap;
  /**
   * The tag. Use `ul`/`ol` when the set is itself a list: a screen reader will then announce
   * the number of items. The children are `<li>` elements, which is the consumer's job.
   */
  as?: "div" | "ul" | "ol";
}

/**
 * `columns` and `minItemWidth` are mutually exclusive, and the type says so: either there are
 * as many columns as specified, or as many as fit. Passing both is a contradiction in the call.
 * A JS consumer may still pass both; then `minItemWidth` wins, and in development the console
 * says so.
 */
export type GridProps = GridBaseProps &
  (
    | {
        /**
         * The number of columns. A number is a responsive ladder (see `COLUMNS_LADDER`);
         * an object is an exact number per breakpoint: `{ base: 1, md: 3 }`.
         * A constant number at every width is `{ base: 3 }`.
         */
        columns?: Responsive<GridColumns>;
        minItemWidth?: never;
      }
    | {
        /** Smallest cell width; as many columns as fit. */
        minItemWidth: GridMinItemWidth;
        columns?: never;
      }
  );

/*
  Each class is written out whole as a literal, including the breakpoint prefix: Tailwind
  scans the source as text, and `md:grid-cols-${n}` would never reach the CSS.
  The matrix `tests/matrix.tsx` iterates over every cell, and the class coverage test fails
  the run if even one of them does not reach the built CSS.
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
 * The ladder for a number: on a phone one column; from `sm` no more than two; from `lg`
 * as many as requested.
 *
 * The jump to the full count happens at `lg`, not `md`, because of `AppShell`: at `md` it
 * shows the side navigation, which takes 240 pixels from the content. At `md` about as much
 * room is left for the grid as at `sm`, and two columns are enough there. `FormLayout` works
 * the same way: `columns={2}` gives one column below `sm`, and CSS decides that, not the caller.
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
  `auto-fill`, not `auto-fit`: with three cards on a wide screen, `auto-fit` would collapse the
  empty tracks and stretch those three across the whole row, so cells of one set would end up
  different widths on different pages. `min(100%, …)` keeps the cell within the container when
  the container is already narrower than the minimum width: without it, the cell would overflow
  the edge and cause horizontal scrolling.
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
 * A grid of equal columns.
 *
 * PRESENTATION WITHOUT BEHAVIOR: no roles, no keyboard handling, no state. Hence its level:
 * periphery (ADR-0014). A grid with keyboard navigation between cells is `VirtualGrid`, not
 * this component.
 *
 * COLUMNS BY SCREEN WIDTH, NOT CONTAINER WIDTH. The media queries are the same breakpoints at
 * which `AppShell` and `FormLayout` collapse, so the grid breaks together with the shell, not
 * on its own. Container queries did not make it into this wave: the kit has none anywhere, and
 * the first case should not be introduced as a side effect.
 *
 * CSS, NOT A JS CALCULATION: the layout is correct from the first frame and on the server.
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
          // `null` is also an object for `typeof`: a JS consumer gets the default from it,
          // not a grid without columns at all.
          columns != null && typeof columns === "object" ? columns : COLUMNS_LADDER[columns ?? 1],
          COLUMNS_CLASS
        );

  // The three tags differ only in the element type of the ref, and TypeScript requires a ref
  // that fits all three at once. The ref does not depend on the tag (the consumer gets the node
  // that was rendered), so the tag is reduced to one type.
  const Comp = tag as "div";

  return (
    <Comp
      ref={ref as Ref<HTMLDivElement>}
      /*
        The `list` role on `ul`/`ol` looks redundant, but it is needed: Tailwind's preflight
        removes list markers (`list-style: none`), and after that WebKit with VoiceOver stops
        announcing the list and its item count. An explicit role restores the semantics.
        It sits before `rest` so that the consumer can override it.
      */
      role={tag === "div" ? undefined : "list"}
      className={cn("grid", template, GAP_CLASS[gap], className)}
      {...rest}
    />
  );
});
