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
  /** The full set of table columns; visibility and order are applied on top of it from `state`. */
  columns: TableColumn<T>[];
  /** Table rows. Each must carry an `id`: it is the basis for the key and the selection. */
  items: T[];
  /** The whole state, usually from `useTableState`. */
  state: TableState;
  /**
   * Called on any state change (sorting, selection, expansion) with a partial patch.
   *
   * Changes are sent as a single patch: the invariants live in the hook, not here.
   */
  onStateChange: (patch: Partial<TableState>) => void;
  /** Loading in progress. If data is already on screen, it stays; otherwise a skeleton is shown. */
  loading?: boolean;
  /** An error. If passed, it is always shown instead of the body, even when there is data. */
  error?: ReactNode;
  /** The bar above the table, usually `TableToolbar`. */
  toolbar?: ReactNode;
  /**
   * Row selection.
   *
   * A separate prop, not "the state exists, so it is needed": `selectedKeys` is always in the
   * state, and if a wrapper passed it unconditionally, the checkbox column would appear in tables
   * that do not need selection. The `Table` rule, where an axis is turned on by the presence of
   * its prop, is not overridden by the wrapper.
   */
  selectable?: boolean;
}

/*
 * The key type comes from react-aria, not from React: `React.Key` includes `bigint`, which
 * react-aria collections do not have, so the union does not match.
 */

/** Compact rows: a class, not a token, because this is layout, not color. */
const DENSITY_CLASS = {
  comfortable: "",
  compact: "[&_td]:py-1 [&_th]:py-1",
} as const;

/**
 * A product table: column settings, density, loading and error states on top of the
 * low-level `Table`.
 *
 * A WRAPPER, NOT A REPLACEMENT. Inside is the same `Table` as outside: column visibility and
 * order, density and states are expressed through its props. The only thing that had to be added
 * to `Table` itself is the expansion axis: the detail row lives inside `<tbody>`, and it cannot be
 * inserted from outside (ADR-0022).
 *
 * A sign of a boundary violation is easy to check: if something could have been done with props
 * from outside but ended up inside `Table`, the boundary has already shifted.
 *
 * THE STATES DISTINGUISH THE FIRST LOAD FROM A RE-QUERY:
 *
 * - an error is always shown instead of the body: data shown alongside an error is misleading,
 *   and the user cannot tell stale data from current;
 * - loading without data shows a skeleton instead of the body, with the header in place;
 * - loading with data keeps the data under `aria-busy`. Otherwise the table would collapse into
 *   a skeleton on every page change;
 * - empty is shown only when loading has finished and there is no error.
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
  // A hidden column is NOT rendered into the markup, rather than hidden with a class: a hidden
  // column stays in the accessibility tree as a header with no cells, and a screen reader reads
  // the table with a column that is not on screen.
  //
  // Both helpers guard against a state that came from the URL: neither the order nor the list of
  // hidden columns was checked against the real columns there.
  const visible = visibleColumns(orderColumns(columns, state.columnOrder), state.hiddenColumns);

  const first = loading && items.length === 0;
  /*
    Checked with `hasContent`, not `error != null`.

    A batch of fixes introduced the predicate against exactly this class of defect, and it had
    been missed here. The most common idiom of conditional rendering, `error={isError && <Text/>}`,
    gives `false` when there is no error, and `false != null` is true: `replaced` became true, the
    rows were replaced with an empty body, and a table WITH DATA showed emptiness plus a
    `role="alert"` with no text.
  */
  const failed = hasContent(error);
  const body: ReactNode = failed ? (
    /*
        An error is announced, an empty result is not.

        The error text was passed into `emptyText` and landed in `renderEmptyState`, a plain
        `div`. A keyboard user pressed Refresh, the request failed, the rows disappeared, text
        appeared in their place, and nothing was spoken: the table silently went empty and read
        as "nothing found".

        `alert`, not `status`: a loading failure is allowed to interrupt speech. An empty result
        and the skeleton get no role, because they are not a failure.
      */
    <div role="alert">{error}</div>
  ) : first ? (
    <Skeleton className="h-24 w-full" />
  ) : (
    (emptyText ?? undefined)
  );

  // A replacing state is shown as an empty body with its own content: this keeps the header in
  // place, and the page does not jump between states.
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
