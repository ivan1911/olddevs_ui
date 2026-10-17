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
  // The name `Selection` is taken by the global DOM type — import it under an alias.
  type Selection as AriaSelection,
  type SortDescriptor,
} from "react-aria-components";
import { ChevronDownIcon } from "../../icons.js";
import { cn } from "../../lib/cn.js";
import { useMessages } from "../../i18n/useMessages.js";
import { Checkbox } from "../inputs/Checkbox.js";

export interface TableColumn<T> {
  /** Column identifier: sorting is reported by it. */
  id: string;
  /** Header label. */
  header: ReactNode;
  /** How to get the cell content from a row. */
  cell: (item: T) => ReactNode;
  /** The column can be sorted: the header becomes clickable and shows the direction. */
  sortable?: boolean;
  /**
   * Width: a number of pixels, a fraction (`1fr`), or a percentage.
   *
   * The type comes from react-aria (`ColumnSize`) rather than being widened to `string`: there
   * it is a template type (`${number}fr`, `${number}%`), so a typo like `"1 fr"` is caught by
   * the compiler on the spot, not as a silent layout in the table.
   *
   * Where it goes depends on the mode, and this is not an implementation detail: in react-aria
   * the `width` prop works ONLY inside `ResizableTableContainer`, that is, with `resizable`. In
   * a regular table it does nothing — silently. So with `resizable`, the width goes to
   * `defaultWidth` (the initial size, which the user later changes with the handle), and without
   * it, the width goes into the CSS style of the header cell, because otherwise it would have
   * no effect.
   */
  width?: ColumnProps["width"];
  /** Cell content alignment: `start` or `end`. */
  align?: "start" | "end";
}

export interface TableProps<T extends { id: Key }> {
  /** Table columns, in display order. */
  columns: TableColumn<T>[];
  /** Table rows; each has an `id`. */
  items: T[];
  /**
   * Accessible name of the table. Required: a table without a name is announced by its role
   * alone.
   */
  "aria-label": string;
  /** Sorting. Enabled only when provided: the table does not store it itself. */
  sort?: SortDescriptor;
  /** Called with the new sort descriptor after a header click. */
  onSortChange?: (sort: SortDescriptor) => void;
  /** Row selection. Without this prop, the checkbox column is not rendered at all. */
  selectedKeys?: Set<Key>;
  /** Called with the new set of selected keys. */
  onSelectionChange?: (keys: Set<Key>) => void;
  /**
   * Row action: open a record, navigate to it. The axis is enabled by the presence of the prop;
   * it receives the row from `items`.
   *
   * It works ALONGSIDE selection, not instead of it: checkboxes select, and a click on a row or
   * Enter on a focused row triggers the action. Space on a row still toggles selection. This is
   * the react-aria "selection mode" rule: while nothing is selected, a click on a row is the
   * action; once something is selected, a click on a row toggles it, so you can keep marking by
   * clicking the whole row without aiming at a checkbox. The action then stays on Enter.
   *
   * Elements inside cells (a button, a link, a menu) keep their own click and do not activate the
   * row. There is no need to add a link with a manual `stopPropagation` for this. Expansion rows
   * (`renderDetail`) and the expander button do not trigger the action.
   */
  onRowAction?: (item: T) => void;
  /**
   * Row expansion: what to show below the row. The axis is enabled by the presence of the prop —
   * without it there is neither an expander column nor detail rows in the markup.
   */
  renderDetail?: (item: T) => ReactNode;
  /**
   * Expanded rows: a set of keys of the rows whose details are shown.
   *
   * A set, like `selectedKeys`, and **with no single-or-multiple switch**: how many rows are open
   * at once is decided by whoever holds the state, by putting one key or several here (ADR-0022).
   *
   * OPTIONAL. Without it, expansion works on the table's own state: `renderDetail` without
   * external state is a legitimate and the most common form of use, and removing it for the sake
   * of the rule "the table stores nothing" would leave a button that looks alive but does nothing.
   *
   * THE MODE IS SET BY THE PRESENCE OF THE PROP, as with `InlineEdit` and `editing`. If the state
   * appears lazily (`expandedKeys={saved?.expanded}`), the first render is uncontrolled and the
   * second is controlled, and the expanded rows collapse. Pass an empty set, not `undefined`.
   */
  expandedKeys?: Set<Key>;
  /** Called with the new set of expanded rows. */
  onExpandedChange?: (keys: Set<Key>) => void;
  /**
   * Row name for the labels of the per-row buttons.
   *
   * Without it, all expanders share one name, and a screen reader in button-list mode reads
   * twenty identical "Show details". The first column cannot serve as the name: its `cell`
   * returns a `ReactNode`, which can be an avatar or markup, and that junk would end up in the
   * name.
   */
  rowLabel?: (item: T) => string;
  /** Sticky header. Requires the container to have its own height and scrolling. */
  stickyHeader?: boolean;
  /** Resizing columns with the mouse and the keyboard. */
  resizable?: boolean;
  /** What to show when there are no rows. Defaults to the standard empty-table text. */
  emptyText?: ReactNode;
  /** Classes for the root element. */
  className?: string;
}

/**
 * A table.
 *
 * AXES ARE ENABLED EXPLICITLY, and this is the component's main decision. A table that does
 * everything at once, on a screen with three rows, drags along sorting, checkboxes, and resize
 * handles — all non-functional and all in the markup. So each axis appears only together with
 * its own prop:
 *
 *   sorting          — `sort` + `onSortChange`
 *   row selection    — `selectedKeys` + `onSelectionChange`
 *   sticky header    — `stickyHeader`
 *   column resizing  — `resizable`
 *
 * As a rule the table does NOT STORE the state of its axes (expansion is the exception, see
 * `expandedKeys`): sorting almost always goes to a server request, and selection goes to a bulk
 * actions panel outside. Internal state here would mean two copies of the truth.
 *
 * **Virtualization is deliberately absent.** react-aria has `Virtualizer`, and turning it on
 * would be quick, but until there is a screen with a list this long, it is an optimization
 * without a task: it complicates the markup, breaks page search and printing, and there is
 * nothing to measure the gain on.
 *
 * Behavior comes from react-aria's RAC `Table`: keyboard navigation between cells, `aria-sort`,
 * row and header roles, selection with Shift and Ctrl.
 */
/**
 * Column key prefix.
 *
 * In react-aria, column and row keys live in ONE namespace of the collection, so a column with
 * `id="b"` collides with a row with `id="b"`: one of them silently disappears, and the table
 * fails with "Cell count must match column count", where the numbers differ by one and there is
 * no word about the cause.
 *
 * Collisions are not exotic: row identifiers come from data, while the developer writes column
 * ids, and `id: "name"` next to a row `name` is a matter of time. So column keys are kept apart
 * here, internally, while the original keys (`sort.column`) are still passed in and out.
 */
const COLUMN_KEY = "od-col:";

/** Prefix of the detail row key — see `detailKey` below. */
const DETAIL_PREFIX = "od-detail:";

/*
  Snapshots for `useSyncExternalStore`: on the server and during hydration, `false`; after it,
  `true`; no subscription, since the value no longer changes.
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
    Sorting is turned on for react-aria AFTER hydration, not from the first frame.

    `useTableColumnHeader` decides `aria-sort` per platform: on Android (TalkBack does not support
    the attribute) it is not set at all; on other platforms a sortable column always has it —
    `none` on an unsorted one. The server does not know the platform, so it writes the "not
    Android" variant, and an Android client during hydration saw markup that did not match its own,
    and React printed "A tree hydrated but some attributes… didn't match" on every sortable
    column. This cannot be worked around from outside: `aria-sort` is built by the library itself,
    and the column props do not override it.

    So the first frame — both server and hydration — renders the columns as non-sortable, that is,
    without `aria-sort`, for all clients, and an already mounted table turns sorting on, and the
    attribute is set by the platform rules. The cost: static markup has no `aria-sort`; before
    hydration sorting does not work anyway, and the direction is visible from the icon (which we
    draw ourselves and which does not depend on this flag).
  */
  const hydrated = useSyncExternalStore(subscribeNever, isHydrated, isServer);

  const selectable = selectedKeys != null && onSelectionChange != null;
  const expandable = renderDetail != null;

  /*
    Expansion works WITHOUT `expandedKeys` too.

    Previously the axis was enabled by `renderDetail` alone, and `toggleExpanded` built
    `new Set(undefined)` and called an optional callback into nothing: a live-looking button —
    `aria-expanded="false"`, working hover — and a click that did nothing. The three props are
    optional independently, the compiler allowed such a call, and the result was an "inaccessible
    list that looks functional", which the `SortableList` docstring warns about.

    Removing the column would have been simpler, but it would take away the simple call form people
    actually use: `renderDetail` without external state is a legitimate and the most common case.
    So the second branch of controllability, as in `InlineEdit`: the state lives inside until it
    is driven from outside.
  */
  const [uncontrolledExpanded, setUncontrolledExpanded] = useState<Set<Key>>(new Set());
  const currentExpanded = expandedKeys ?? uncontrolledExpanded;

  /**
   * Prefix of the detail row key — for the same reason as `COLUMN_KEY`: in react-aria rows live
   * in one namespace, so the detail of row `b` would collide with row `b` if it took that
   * row's key.
   */
  const detailKey = (id: Key) => `${DETAIL_PREFIX}${String(id)}`;

  /**
   * What to hand out in response to react-aria's selection.
   *
   * `'all'` is not a key string but a separate `Selection` value, and it is returned by
   * `toggleSelectAll()`. Converting it to a `Set` parsed this string letter by letter and handed
   * out `["a","l"]`: selection silently failed, and the bulk actions panel received two keys that
   * exist in no row.
   *
   * But listing the current page is not enough either, and that is the second, more costly defect.
   * `items` is ONE PAGE: above it sits `useTableState`, which slices the set. By handing out
   * only the page, "select all" erased marks made on other pages — which broke exactly the
   * invariant that `useTableState` declares its main value ("you checked rows, turned the page,
   * lost everything").
   * The user saw the bulk actions counter drop after clicking "select all".
   *
   * So "all" is a UNION with what has already arrived, and deselecting is a subtraction of the
   * current page's keys, not a reset of the set.
   *
   * Detail rows are subtracted from the selection here too: their synthetic key (`detailKey`) must
   * never leave the component — it matches no record, and a bulk action would go to the backend
   * with a nonexistent id.
   */
  const resolveSelection = (keys: AriaSelection): Set<Key> => {
    // A `Set`, not an array: the loop below walks ALL of the selection, and it now spans pages —
    // that is exactly what makes a large set reachable. With `includes`, five thousand marked rows
    // against a hundred on the page would mean half a million comparisons on every click.
    const page = new Set(items.map((i) => i.id));
    if (keys === "all") return new Set([...(selectedKeys ?? []), ...page]);

    const next = new Set<Key>();
    for (const key of keys) if (!String(key).startsWith(DETAIL_PREFIX)) next.add(key);

    // Keys from other pages are carried over ON PURPOSE. react-aria does return them — it builds
    // the set from the `selectedKeys` prop as is — but we must not rely on that: the set it
    // returns may lack foreign keys if the selection was rebuilt. Duplicates are removed by the `Set`.
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

  /** The number of cells in a row — the detail row must span the same count. */
  const span = columns.length + (selectable ? 1 : 0) + (expandable ? 1 : 0);

  /*
    The width of service columns (selection, expansion) goes the same route as `column.width`:
    `width` takes effect only inside `ResizableTableContainer`; outside it the column stretches
    with the data, so a CSS style is needed.
  */
  const serviceWidth = resizable ? { width: 40 } : { style: { width: 40 } };

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
        Detail rows are removed FROM THE COLLECTION, not just from the response.

        They were counted in react-aria's `isSelectAll`, but could never enter the selection (their
        key is subtracted below), so "everything selected" NEVER happened: the header checkbox
        always took the `selectAll` branch, and you could not deselect everything from the header —
        only row by row.

        `disabledBehavior="selection"` keeps a row interactive (the expander button and the detail
        content work), forbidding exactly selection.
      */
      disabledBehavior="selection"
      disabledKeys={expandable ? items.map((item) => detailKey(item.id)) : undefined}
      selectedKeys={selectedKeys}
      onSelectionChange={(keys) => onSelectionChange?.(resolveSelection(keys))}
      /*
        A detail row does not get here: its synthetic key (`detailKey`) matches no record, and
        `find` would return `undefined`.
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
            {...serviceWidth}
          >
            {/*
              The select-all checkbox is RAC's native one (`slot="selection"`), not our `Checkbox`:
              it reads the table's selection state from context, including the third "not everything
              selected" state. Ours would sit here as a dead control.
            */}
            <Checkbox slot="selection" label={messages.table.selectAll} />
          </Column>
        ) : null}

        {expandable ? (
          <Column
            id={`${COLUMN_KEY}od-expander`}
            {...serviceWidth}
            className="border-line-soft bg-bg-1 border-b px-3 py-2"
          >
            {/*
              The header of the expander column looks empty but is not empty for screen readers:
              an unnamed column is announced by its role alone, and the table would start with a
              column that means nothing.
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
                  // The direction icon is drawn ONLY on a sortable column: an icon on every
                  // column turns the header into a row of arrows where the current one cannot be
                  // found. The direction itself is announced to screen readers by `aria-sort`,
                  // which RAC sets.
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
                  <ColumnResizer
                    className={cn(
                      "bg-line-soft hover:bg-accent-strong w-px cursor-col-resize",
                      column.align !== "end" && "ml-auto"
                    )}
                  />
                ) : null}
              </span>
            )}
          </Column>
        ))}
      </TableHeader>

      {/*
        Rows are listed explicitly rather than handed to `items`: a detail row is a second `Row`
        next to the regular one, while the render function for `items` returns exactly one. Without
        expansion, the result is the same as before.
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

  // The resize container is needed only with `resizable`: it wraps the table in its own box, and
  // rendering it for nothing adds an extra node to the layout of every table in the app.
  return resizable ? <ResizableTableContainer>{table}</ResizableTableContainer> : table;
}
