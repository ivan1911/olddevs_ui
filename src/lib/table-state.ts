import type { Key, SortDescriptor } from "react-aria-components";
import type { Density } from "./variants.js";

/**
 * The table state contract and its transfer to the address.
 *
 * The module is deliberately WITHOUT `"use client"`: parsing the address is needed on
 * the server too. In Next.js the state is restored from `searchParams` before
 * rendering. The `useTableState` hook is a React wrapper over these same types.
 */

/**
 * An applied filter.
 *
 * A token has ITS OWN identifier, not a "field + value" pair, and this is not
 * pedantry: two filters on the same field produce tokens that look alike, and there
 * would be no way to remove the right one. The label is not the source of truth
 * either: it is localized and truncated, and a removal cannot be keyed on a truncated
 * label.
 *
 * There are no operators here on purpose (ADR-0023, ADR-0063): without `to` a token
 * means equality, and with `to` it means the range `value…to`. `gte` and `lte` are the
 * same range with an empty bound, so no separate axis is added. `contains` and `in`
 * still wait for a real requester, not guesses.
 */
export interface TableFilter {
  id: string;
  /** The data field. What it is called on the server is up to the consumer. */
  field: string;
  /**
   * The value, or the lower bound of the range if `to` is set. For a range, an empty
   * string means "no lower bound".
   */
  value: string;
  /**
   * The upper bound of the range. **Not set: an equality token. An empty string: a
   * range with no upper bound** ("from 50"). The difference is carried by the key's
   * presence itself, so check it with `!== undefined`, not by truthiness. Numbers and
   * dates travel as strings: ISO dates `YYYY-MM-DD`, as everywhere in the kit.
   */
  to?: string;
  /** What to show in the token. If absent, the consumer shows `field: value`. */
  label?: string;
}

export interface TableState {
  /** Not set: the table is not sorted, and sorting is not enabled. */
  sort?: SortDescriptor;
  /** Numbering starts at one, the same way `Pagination` counts. */
  page: number;
  pageSize: number;
  selectedKeys: Set<Key>;
  expandedKeys: Set<Key>;
  filters: TableFilter[];
  /** Column order as a list of identifiers. Empty means declaration order. */
  columnOrder: string[];
  hiddenColumns: Set<string>;
  density: Density;
}

/** State defaults, except density: the provider supplies that. */
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
 * Filter parts are encoded separately, so a `:` inside a value does not break things.
 *
 * The label travels as the FOURTH part. Previously only three parts were encoded, and
 * `label` was lost: `FilterBarAdd` always sets it ("Section: Contracts"), and a user
 * who copied the link and opened it again saw "section: contracts" — the raw backend
 * identifiers instead of the human label. A round-trip test did not catch this,
 * because it used filters without `label`.
 *
 * The upper bound of a range travels as the FIFTH part (ADR-0063). Its presence is
 * itself the mark of a range, so an empty fifth part is written rather than dropped:
 * "from 50" would otherwise become the equality "= 50". An equality has no fifth
 * part, and its address stayed the same.
 */
const encodeFilter = (f: TableFilter) => {
  const parts = [f.id, f.field, f.value, f.label ?? ""];
  if (f.to !== undefined) parts.push(f.to);
  return parts.map(encodeURIComponent).join(":");
};

/**
 * A `decodeURIComponent` that does not throw on a broken escape sequence.
 *
 * `URLSearchParams` has already decoded the parameter once, so `%25zz` arrives here
 * as `%zz`, an incomplete sequence on which the standard `decodeURIComponent` throws a
 * `URIError`. It used to throw right inside `tableStateFromParams`, and the module is
 * deliberately without `"use client"` and is called on the server from `searchParams`:
 * a single `%` character in a link produced a 500 on the route.
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
  // Three parts: a link saved before wave 26. It has no label, and that is no reason
  // to drop the filter. Five: a range (ADR-0063). Four and three are read as before.
  if (parts.length < 3 || parts.length > 5) return null;
  const decoded = parts.map(decodeOrNull);
  // A broken part rejects the whole filter, the same way a wrong number of parts
  // already does. Only one token is dropped, not the whole parse.
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
 * State → address parameters.
 *
 * **Defaults are not written.** Otherwise a link to the first page without filters
 * grows six parameters, and it becomes awkward for a person to copy.
 *
 * **Selection and expansion do not go into the address**, although the spec listed
 * selection as part of the state. There are two reasons: the list of keys has no
 * length limit, and a link with a selection, opened the next day, would mark records
 * that no longer exist. Selection is session state, not address state.
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
 * Address parameters → state.
 *
 * Returns PART of the state: the address does not carry everything, and the missing
 * parts come from the caller's defaults. Garbage does not break parsing and does not
 * produce a broken state, because the address comes from the user, who edits it by
 * hand.
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

  // `Number` on garbage gives `NaN`, and on "-3" a negative page. Both lead to an
  // empty screen that the user will read as "nothing here".
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
 * Order columns by a list of identifiers.
 *
 * The list is a **prefix, not a full enumeration**. Columns it does not name follow
 * in declaration order, and unknown identifiers are skipped.
 *
 * Otherwise an order that arrived from the address would silently drop columns: a
 * link saved before a new column appeared would show a truncated table, and it would
 * look like a working table rather than an error. A test catches exactly this. The
 * behavior is shared by `DataTable` and `TablePreferences`, so it lives here, not in
 * two copies.
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

  // The remainder goes in declaration order: that is the default.
  return [...listed, ...columns.filter((c) => byId.has(c.id))];
}

/**
 * Filter out hidden columns without taking the table to zero.
 *
 * The settings panel does not let you hide the last visible column, but the state
 * also comes from the address, where no such guard exists: `?hide=` with all the
 * columns gave a table with no headers at all. An empty table is not a UI state but a
 * breakage, so hiding everything is ignored.
 */
export function visibleColumns<T extends { id: string }>(columns: T[], hidden: Set<string>): T[] {
  const visible = columns.filter((c) => !hidden.has(c.id));
  return visible.length > 0 ? visible : columns;
}
