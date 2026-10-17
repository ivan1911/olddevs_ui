// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, test } from "vitest";
import { UiProvider } from "../src/i18n/UiProvider.js";
import { useTableState } from "../src/hooks/useTableState.js";
import { tableStateFromParams, tableStateToParams } from "../src/lib/table-state.js";

afterEach(cleanup);

describe("useTableState: the shape of the state", () => {
  test("the defaults are set in full and not half-empty", () => {
    const { result } = renderHook(() => useTableState());
    const s = result.current.state;

    expect(s.page).toBe(1);
    expect(s.pageSize).toBe(25);
    expect(s.filters).toEqual([]);
    expect(s.selectedKeys.size).toBe(0);
    expect(s.expandedKeys.size).toBe(0);
    expect(s.columnOrder).toEqual([]);
    expect(s.hiddenColumns.size).toBe(0);
    expect(s.sort).toBeUndefined();
  });

  test("the initial state is set by the caller and overrides the defaults", () => {
    const { result } = renderHook(() =>
      useTableState({ pageSize: 50, sort: { column: "name", direction: "ascending" } })
    );

    expect(result.current.state.pageSize).toBe(50);
    expect(result.current.state.sort?.column).toBe("name");
    // Fields that were not set kept their defaults instead of disappearing.
    expect(result.current.state.page).toBe(1);
  });

  test("instances are independent", () => {
    const { result: a } = renderHook(() => useTableState());
    const { result: b } = renderHook(() => useTableState());

    act(() => a.current.set({ page: 3 }));
    expect(a.current.state.page).toBe(3);
    expect(b.current.state.page).toBe(1);
  });
});

/**
 * Invariants are what the hook exists for. Without them the toolbar and the filters would
 * each keep their own state, and the links between the parts would drift apart.
 */
describe("useTableState: invariants", () => {
  test("changing the filters resets to the first page", () => {
    const { result } = renderHook(() => useTableState());

    act(() => result.current.set({ page: 4 }));
    act(() =>
      result.current.set({ filters: [{ id: "f1", field: "section", value: "Contracts" }] })
    );

    // Otherwise the user is looking at the fourth page of a selection of ten rows and reads
    // the emptiness as "no results found".
    expect(result.current.state.page).toBe(1);
  });

  test("changing the sort resets the page", () => {
    const { result } = renderHook(() => useTableState());

    act(() => result.current.set({ page: 4 }));
    act(() => result.current.set({ sort: { column: "name", direction: "descending" } }));

    expect(result.current.state.page).toBe(1);
  });

  /** The main invariant: the opposite behavior would break the bulk action. */
  test("selection survives both a filter change and a page change", () => {
    const { result } = renderHook(() => useTableState());

    act(() => result.current.set({ selectedKeys: new Set(["1", "2"]) }));
    act(() => result.current.set({ filters: [{ id: "f1", field: "s", value: "v" }] }));
    act(() => result.current.set({ page: 2 }));

    expect([...result.current.state.selectedKeys]).toEqual(["1", "2"]);
  });

  test("density and column visibility do not touch the page", () => {
    const { result } = renderHook(() => useTableState());

    act(() => result.current.set({ page: 3 }));
    act(() => result.current.set({ density: "compact" }));
    act(() => result.current.set({ hiddenColumns: new Set(["section"]) }));

    // It is the filter and the sort that narrow the selection, not the look.
    expect(result.current.state.page).toBe(3);
  });

  test("an explicit page together with a filter beats the reset", () => {
    const { result } = renderHook(() => useTableState());

    act(() => result.current.set({ filters: [{ id: "f", field: "s", value: "v" }], page: 7 }));
    // The caller said so directly, which means they know what they are doing: restoring
    // the state from the address comes in exactly this way, whole.
    expect(result.current.state.page).toBe(7);
  });

  test("reset restores the initial state, not an empty one", () => {
    const { result } = renderHook(() => useTableState({ pageSize: 50 }));

    act(() => result.current.set({ page: 3, pageSize: 10 }));
    act(() => result.current.reset());

    expect(result.current.state.page).toBe(1);
    expect(result.current.state.pageSize).toBe(50);
  });
});

describe("useTableState: density", () => {
  const wrapper = (density: "comfortable" | "compact") =>
    function Wrapper({ children }: { children: ReactNode }) {
      return <UiProvider density={density}>{children}</UiProvider>;
    };

  test("without a provider — comfortable", () => {
    const { result } = renderHook(() => useTableState());
    expect(result.current.state.density).toBe("comfortable");
  });

  test("the default comes from the provider", () => {
    const { result } = renderHook(() => useTableState(), { wrapper: wrapper("compact") });
    expect(result.current.state.density).toBe("compact");
  });

  test("an explicit initial value outranks the provider", () => {
    const { result } = renderHook(() => useTableState({ density: "comfortable" }), {
      wrapper: wrapper("compact"),
    });
    expect(result.current.state.density).toBe("comfortable");
  });
});

/**
 * Carrying state into the address is a pair of PURE functions: applying them to the address
 * is the application's job (ADR-0023). Each router has its own rules for writing parameters,
 * and a kit that tried to guess them would get it wrong silently.
 */
describe("carrying state into the address", () => {
  test("wrapping around returns the original", () => {
    const initial = {
      sort: { column: "name", direction: "descending" as const },
      page: 3,
      pageSize: 50,
      filters: [
        { id: "f1", field: "section", value: "Contracts" },
        { id: "f2", field: "section", value: "Reports" },
      ],
      hiddenColumns: new Set(["updated"]),
      columnOrder: ["name", "section"],
      density: "compact" as const,
    };

    expect(tableStateFromParams(tableStateToParams(initial))).toEqual(initial);
  });

  test("defaults are not written into the address", () => {
    const params = tableStateToParams({
      page: 1,
      pageSize: 25,
      filters: [],
      hiddenColumns: new Set(),
      columnOrder: [],
      density: "comfortable",
    });
    // Otherwise a link to the first page without filters would grow six parameters, and it
    // would be inconvenient for a person to copy it.
    expect(params.toString()).toBe("");
  });

  test("selection and expansion do not go into the address", () => {
    const params = tableStateToParams({
      selectedKeys: new Set(["1", "2"]),
      expandedKeys: new Set(["1"]),
    });
    // The list of keys has no length limit, and a link opened tomorrow would mark records
    // that no longer exist.
    expect(params.toString()).toBe("");
  });

  test("a colon and a comma inside a value are carried whole", () => {
    const initial = {
      filters: [{ id: "a:b", field: "note", value: "10:30, urgent" }],
    };
    expect(tableStateFromParams(tableStateToParams(initial))).toEqual(initial);
  });

  test.each([
    ["junk in the page", "page=none"],
    ["negative page", "page=-3"],
    ["fractional page", "page=1.5"],
    ["empty sort", "sort="],
    ["filter without parts", "f=broken"],
    ["foreign density", "density=huge"],
  ])("%s does not break parsing and yields no broken state", (_name, query) => {
    const state = tableStateFromParams(new URLSearchParams(query));

    expect(state.page).toBeUndefined();
    expect(state.sort).toBeUndefined();
    expect(state.filters).toBeUndefined();
    expect(state.density).toBeUndefined();
  });

  test("sorting by a column with a colon in its name parses correctly", () => {
    const params = new URLSearchParams("sort=meta:created:desc");
    // The direction is split off at the LAST colon: the consumer names the column, and the
    // kit has no right to forbid it a colon.
    expect(tableStateFromParams(params).sort).toEqual({
      column: "meta:created",
      direction: "descending",
    });
  });

  test("restoring from the address lands in the hook whole, without resetting the page", () => {
    const params = tableStateToParams({
      page: 4,
      filters: [{ id: "f", field: "s", value: "v" }],
    });
    const { result } = renderHook(() => useTableState());

    act(() => result.current.set(tableStateFromParams(params)));

    // The "a filter resets the page" invariant is overridden by an explicit page in the same
    // call; otherwise restoring a link would always open the first page.
    expect(result.current.state.page).toBe(4);
    expect(result.current.state.filters).toHaveLength(1);
  });
});

/**
 * The address is edited by hand, and this is written in the docstring of
 * `tableStateFromParams`: "junk does not break parsing and does not yield a broken state".
 * Before wave 26 that promise held only halfway — `decodeFilter` called
 * `decodeURIComponent` without protection and threw `URIError` on a single `%` character.
 *
 * The cost of an error here is higher than it seems: the module is deliberately without
 * `"use client"` and is called on the server from `searchParams`, so that is a 500 on the
 * route, not a crooked table. The neighboring `hide=%25zz` had been parsed silently all along.
 */
describe("a hand-edited address does not bring down the parse", () => {
  test("a filter with a malformed escape is dropped, not thrown on", () => {
    // `URLSearchParams` turns `%25` into `%`, after which `decodeURIComponent` sees `%zz`,
    // an incomplete escape sequence.
    const params = new URLSearchParams("f=%25zz%3Aa%3Ab");

    expect(() => tableStateFromParams(params)).not.toThrow();
    // The key is not written at all when no filters are left: defaults do not make it into
    // the result, just as when an address without `f` is parsed.
    expect(tableStateFromParams(params).filters).toBeUndefined();
  });

  test("a good filter survives a broken neighbour in the same parameter", () => {
    const params = new URLSearchParams("f=%25zz%3Aa%3Ab&f=f1%3Asection%3AContracts");

    expect(tableStateFromParams(params).filters).toEqual([
      { id: "f1", field: "section", value: "Contracts" },
    ]);
  });

  test("a malformed escape in the remaining parameters is already tolerated", () => {
    // A guard against a regression in the other direction: `hide` and `cols` are not encoded
    // and therefore never threw — the filter fix must not change that.
    const state = tableStateFromParams(new URLSearchParams("hide=%25zz&cols=%25zz"));

    expect(state.hiddenColumns).toEqual(new Set(["%zz"]));
    expect(state.columnOrder).toEqual(["%zz"]);
  });
});

/**
 * Changing the page size resets the page.
 *
 * `pageSize` is the only field of the hook that changes the number of pages directly, and
 * the reset condition did not include it. 200 rows, `pageSize` 25 → 100 from page 8:
 * `slice(700, 800)` is empty, and the table draws "no results found". This is word for word
 * the failure the invariant exists to prevent (it "sees emptiness and takes it for
 * 'no results found'"). It does not fix itself: `Pagination` clamps the page only on its own
 * side, and it highlights "2" while the table is empty.
 */
describe("changing the page size", () => {
  test("resets the page", () => {
    const { result } = renderHook(() => useTableState({ page: 8, pageSize: 25 }));

    act(() => result.current.set({ pageSize: 100 }));

    expect(result.current.state.page).toBe(1);
  });

  test("density still leaves the user where they were", () => {
    const { result } = renderHook(() => useTableState({ page: 8, pageSize: 25 }));

    act(() => result.current.set({ density: "compact" }));

    expect(result.current.state.page).toBe(8);
  });

  test("an explicit page in the same patch wins", () => {
    const { result } = renderHook(() => useTableState({ page: 8, pageSize: 25 }));

    // The same trick as with the filters: a caller who names the page explicitly knows
    // what they want.
    act(() => result.current.set({ pageSize: 100, page: 3 }));

    expect(result.current.state.page).toBe(3);
  });
});

/**
 * The filter label survives the address.
 *
 * Only `id`, `field` and `value` were encoded. `FilterBarAdd` always sets a `label`
 * ("Section: Contracts"), and a user who copied the link and opened it again got
 * "section: contracts" — the raw backend identifiers. The round-trip test above did not
 * catch this, because it took filters without a label.
 */
test("a filter label survives the round trip", () => {
  const filters = [{ id: "f1", field: "section", value: "contracts", label: "Section: Contracts" }];

  expect(tableStateFromParams(tableStateToParams({ filters })).filters).toEqual(filters);
});

test("a link saved before the label existed still parses", () => {
  // Three parts: a link from the previous version. It must not be discarded.
  const params = new URLSearchParams("f=f1%3Asection%3Acontracts");

  expect(tableStateFromParams(params).filters).toEqual([
    { id: "f1", field: "section", value: "contracts" },
  ]);
});

/**
 * A range is the optional `to` on the token (ADR-0063). In the address it is the FIFTH part:
 * links with three or four parts are read as before, and `to` is present if and only if
 * the fifth part is there — even an empty one.
 */
describe("a range filter in the address", () => {
  test.each([
    ["both bounds", { id: "r", field: "amount", value: "50", to: "100", label: "Amount: 50–100" }],
    [
      "lower bound only",
      { id: "r", field: "amount", value: "50", to: "", label: "Amount: from 50" },
    ],
    [
      "upper bound only",
      { id: "r", field: "amount", value: "", to: "100", label: "Amount: to 100" },
    ],
    ["no label", { id: "r", field: "date", value: "2026-03-01", to: "2026-03-12" }],
    ["colons inside bounds", { id: "r", field: "t", value: "10:30", to: "12:45" }],
  ])("%s survives the round trip", (_name, filter) => {
    expect(tableStateFromParams(tableStateToParams({ filters: [filter] })).filters).toEqual([
      filter,
    ]);
  });

  test("an empty upper bound stays a range and does not turn into equality", () => {
    const filter = { id: "r", field: "amount", value: "50", to: "" };
    const [back] = tableStateFromParams(tableStateToParams({ filters: [filter] })).filters ?? [];

    // `to: ""` is "from 50" with no upper bound; losing the key would turn the range into
    // the equality "amount = 50".
    expect(back).toHaveProperty("to", "");
  });

  test("an equality filter gets no fifth part", () => {
    const params = tableStateToParams({
      filters: [{ id: "f", field: "s", value: "v", label: "S: v" }],
    });

    expect(params.get("f")!.split(":")).toHaveLength(4);
  });

  test("a link of three or four parts still reads as equality, without `to`", () => {
    const state = tableStateFromParams(
      new URLSearchParams("f=a%3Asection%3Ax&f=b%3Asection%3Ay%3AY")
    );

    expect(state.filters).toEqual([
      { id: "a", field: "section", value: "x" },
      { id: "b", field: "section", value: "y", label: "Y" },
    ]);
    expect(state.filters![0]).not.toHaveProperty("to");
  });

  test("a sixth part drops the filter, a broken escape in `to` drops it too", () => {
    const params = new URLSearchParams();
    params.append("f", "a:b:c:d:e:f");
    params.append("f", "a:b:c:d:%zz");
    params.append("f", "ok:amount:1::2");

    expect(() => tableStateFromParams(params)).not.toThrow();
    expect(tableStateFromParams(params).filters).toEqual([
      { id: "ok", field: "amount", value: "1", to: "2" },
    ]);
  });
});

describe("a range filter in the hook", () => {
  test("adding a range resets the page, and the selection survives", () => {
    const { result } = renderHook(() => useTableState({ page: 4 }));

    act(() => result.current.set({ selectedKeys: new Set(["1"]) }));
    act(() =>
      result.current.set({
        filters: [{ id: "r", field: "amount", value: "50", to: "100", label: "Amount: 50–100" }],
      })
    );

    // A range is the same change of the selection as an equality (ADR-0023, ADR-0063).
    expect(result.current.state.page).toBe(1);
    expect(result.current.state.filters[0]).toMatchObject({ to: "100" });
    expect([...result.current.state.selectedKeys]).toEqual(["1"]);
  });

  test("a range restored from the address lands whole, with its page", () => {
    const params = tableStateToParams({
      page: 3,
      filters: [{ id: "r", field: "date", value: "2026-03-01", to: "" }],
    });
    const { result } = renderHook(() => useTableState());

    act(() => result.current.set(tableStateFromParams(params)));

    expect(result.current.state.page).toBe(3);
    expect(result.current.state.filters).toEqual([
      { id: "r", field: "date", value: "2026-03-01", to: "" },
    ]);
  });
});
