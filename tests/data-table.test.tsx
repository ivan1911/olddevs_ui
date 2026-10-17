// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { DataTable } from "../src/components/table/DataTable.js";
import { Table } from "../src/components/content/Table.js";
import { DEFAULT_TABLE_STATE, type TableState } from "../src/lib/table-state.js";

afterEach(cleanup);

const ROWS = [
  { id: "1", name: "Contract", section: "Contracts" },
  { id: "2", name: "Report", section: "Reports" },
];

const COLUMNS = [
  { id: "name", header: "Name", cell: (r: (typeof ROWS)[number]) => r.name },
  { id: "section", header: "Section", cell: (r: (typeof ROWS)[number]) => r.section },
];

const state = (patch: Partial<TableState> = {}): TableState => ({
  ...DEFAULT_TABLE_STATE,
  density: "comfortable",
  ...patch,
});

const base = {
  "aria-label": "Documents",
  columns: COLUMNS,
  items: ROWS,
  onStateChange: () => {},
};

describe("DataTable: column preferences", () => {
  /**
   * A column hidden by a class stays in the accessibility tree as a header without
   * cells, and the screen reader reads the table with a column that is not on screen.
   */
  test("a hidden column stays out of the markup instead of being hidden by a class", () => {
    render(<DataTable {...base} state={state({ hiddenColumns: new Set(["section"]) })} />);
    expect(screen.getByRole("columnheader", { name: "Name" })).toBeTruthy();
    expect(screen.queryByRole("columnheader", { name: "Section" })).toBeNull();
    expect(screen.queryByText("Contracts")).toBeNull();
  });

  test("the column order is applied", () => {
    render(<DataTable {...base} state={state({ columnOrder: ["section", "name"] })} />);
    const headings = screen.getAllByRole("columnheader").map((h) => h.textContent);
    expect(headings).toEqual(["Section", "Name"]);
  });

  test("an empty order keeps the declaration order", () => {
    render(<DataTable {...base} state={state()} />);
    expect(screen.getAllByRole("columnheader").map((h) => h.textContent)).toEqual([
      "Name",
      "Section",
    ]);
  });

  /**
   * Regression. The order from the URL listed only some of the columns, and `flatMap`
   * dropped the rest: a link saved before a new column appeared showed a truncated
   * table, and it looked like a working table.
   */
  test("a partial order does not drop columns, it appends the rest", () => {
    render(<DataTable {...base} state={state({ columnOrder: ["section"] })} />);
    expect(screen.getAllByRole("columnheader").map((h) => h.textContent)).toEqual([
      "Section",
      "Name",
    ]);
  });

  test("an unknown id in the order is skipped", () => {
    render(<DataTable {...base} state={state({ columnOrder: ["obsolete", "section"] })} />);
    expect(screen.getAllByRole("columnheader").map((h) => h.textContent)).toEqual([
      "Section",
      "Name",
    ]);
  });

  /**
   * The settings panel does not let you hide the last column, but this state is
   * reachable from the URL around it: `?hide=` with every column gave a table with
   * no header at all.
   */
  test("hiding ALL columns is ignored — there is no table without columns", () => {
    render(<DataTable {...base} state={state({ hiddenColumns: new Set(["name", "section"]) })} />);
    expect(screen.getAllByRole("columnheader")).toHaveLength(2);
  });

  test("density changes the class, not the structure", () => {
    const { container, rerender } = render(<DataTable {...base} state={state()} />);
    const before = container.querySelectorAll("td").length;

    rerender(<DataTable {...base} state={state({ density: "compact" })} />);
    expect(container.querySelector("table")?.className).toContain("[&_td]:py-1");
    expect(container.querySelectorAll("td").length).toBe(before);
  });
});

/**
 * This is why the flat order of states was rewritten in ADR-0022: on a page change
 * the data is already on screen, and a skeleton in its place is a jump at every step.
 */
describe("DataTable: loading, emptiness, error", () => {
  test("loading without data gives a skeleton and the header stays", () => {
    const { container } = render(<DataTable {...base} items={[]} loading state={state()} />);
    expect(screen.getByRole("columnheader", { name: "Name" })).toBeTruthy();
    expect(container.querySelector("[aria-busy='true']")).toBeTruthy();
    expect(screen.queryByRole("row", { name: /Contract/ })).toBeNull();
  });

  test("loading WITH data leaves it in place under aria-busy", () => {
    const { container } = render(<DataTable {...base} loading state={state()} />);
    // The data is still there: the table did not collapse into a skeleton.
    expect(screen.getByText("Contract")).toBeTruthy();
    expect(container.querySelector("[aria-busy='true']")).toBeTruthy();
  });

  test("an error replaces the body even when data is there", () => {
    render(<DataTable {...base} error={<span>Could not load</span>} state={state()} />);
    // Data shown alongside an error is misleading: the user cannot tell stale data
    // from current data.
    expect(screen.getByText("Could not load")).toBeTruthy();
    expect(screen.queryByText("Contract")).toBeNull();
    expect(screen.getByRole("columnheader", { name: "Name" })).toBeTruthy();
  });

  test("an error outranks loading", () => {
    render(<DataTable {...base} items={[]} loading error={<span>Error</span>} state={state()} />);
    expect(screen.getByText("Error")).toBeTruthy();
  });

  test("empty shows only when loading is over and there is no error", () => {
    render(<DataTable {...base} items={[]} emptyText="Nothing found" state={state()} />);
    expect(screen.getByText("Nothing found")).toBeTruthy();
  });
});

describe("DataTable: state goes outwards", () => {
  test("without selectable there is no checkbox column — the Table rule is not cancelled", () => {
    render(<DataTable {...base} state={state()} />);
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  });

  test("selection is reported as a patch", async () => {
    const user = userEvent.setup();
    const onStateChange = vi.fn();
    render(
      <DataTable
        {...base}
        selectable
        onStateChange={onStateChange}
        state={state({ selectedKeys: new Set() })}
      />
    );

    await user.click(screen.getAllByRole("checkbox")[1]!);
    expect(onStateChange).toHaveBeenCalledWith({ selectedKeys: new Set(["1"]) });
  });

  test("without renderDetail the expansion axis stays off", () => {
    render(<DataTable {...base} state={state({ expandedKeys: new Set(["1"]) })} />);
    // The axis is turned on by the presence of the prop on `Table`, and the wrapper does not break this rule.
    expect(screen.queryByRole("button", { name: /details/ })).toBeNull();
  });

  test("with renderDetail expansion goes down and back", async () => {
    const user = userEvent.setup();
    const onStateChange = vi.fn();
    render(
      <DataTable
        {...base}
        onStateChange={onStateChange}
        renderDetail={(r) => <span>Details {r.name}</span>}
        state={state({ expandedKeys: new Set(["1"]) })}
      />
    );

    expect(screen.getByText("Details Contract")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Hide details" }));
    expect(onStateChange).toHaveBeenCalledWith({ expandedKeys: new Set() });
  });

  test("the toolbar renders above the table", () => {
    render(<DataTable {...base} toolbar={<div>Bar</div>} state={state()} />);
    expect(screen.getByText("Bar")).toBeTruthy();
  });
});

/**
 * The selection axis of `Table`.
 *
 * Two defects of one mechanism, both found by the wave 26 review, and neither was
 * covered by anything: in `tests/`, `selectable` and `renderDetail` were never combined, not once.
 */
describe("the selection axis keeps what it was given", () => {
  test("selecting all adds the current page instead of replacing everything", async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();

    // Selection survives a page change: this is the main invariant, stated in the
    // `useTableState` docstring. "Select all" passed out ONLY the current page, and
    // three marks from page 1 vanished silently: a bulk delete was applied to two
    // records instead of five.
    render(
      <Table
        aria-label="Documents"
        items={[
          { id: "3", name: "Third" },
          { id: "4", name: "Fourth" },
        ]}
        columns={[{ id: "name", header: "Name", cell: (r: { name: string }) => r.name }]}
        selectedKeys={new Set(["1", "2"])}
        onSelectionChange={onSelectionChange}
      />
    );

    await user.click(screen.getAllByRole("checkbox")[0]!);

    expect(onSelectionChange).toHaveBeenCalledWith(new Set(["1", "2", "3", "4"]));
  });

  test("clearing all removes only the current page", async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();

    render(
      <Table
        aria-label="Documents"
        items={[
          { id: "3", name: "Third" },
          { id: "4", name: "Fourth" },
        ]}
        columns={[{ id: "name", header: "Name", cell: (r: { name: string }) => r.name }]}
        selectedKeys={new Set(["1", "2", "3", "4"])}
        onSelectionChange={onSelectionChange}
      />
    );

    await user.click(screen.getAllByRole("checkbox")[0]!);

    expect(onSelectionChange).toHaveBeenCalledWith(new Set(["1", "2"]));
  });

  test("a detail row is not selectable and its synthetic key never leaves", async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();

    // `od-detail:` is an internal prefix, kept apart precisely so that the detail does
    // not collide with the row. It must never leave the component: `SelectionBar` would
    // count it as a selected record, and a bulk action would go to the backend with an
    // id that exists in no record.
    render(
      <Table
        aria-label="Documents"
        items={[{ id: "1", name: "First" }]}
        columns={[{ id: "name", header: "Name", cell: (r: { name: string }) => r.name }]}
        selectedKeys={new Set<string>()}
        onSelectionChange={onSelectionChange}
        renderDetail={() => <span>Detail body</span>}
        expandedKeys={new Set(["1"])}
        onExpandedChange={() => {}}
      />
    );

    await user.click(screen.getByText("Detail body"));

    /*
      A click on the detail gives NO selection event at all.

      Previously it did, with a synthetic key inside, and the check caught the
      leak on the way out. Now the detail rows are removed from the collection
      (`disabledKeys` + `disabledBehavior="selection"`), so they have nothing to be
      selected with: the filter on the way out remains as a safety net. It also fixes
      the "select all" checkbox, which never cleared without this.
    */
    expect(onSelectionChange).not.toHaveBeenCalled();
    for (const call of onSelectionChange.mock.calls) {
      for (const key of call[0] as Set<string>) {
        expect(String(key).startsWith("od-detail:")).toBe(false);
      }
    }

    // The detail does not look selected either: the selection is controlled, and the
    // detail's key is not in it, so there is no selection ring on it either.
    const detailRow = screen.getByText("Detail body").closest("tr")!;
    expect(detailRow.getAttribute("aria-selected")).toBe("false");
  });
});

/**
 * A loading error is announced aloud.
 *
 * The error text was substituted into `emptyText` and landed inside `renderEmptyState` —
 * a plain `div` with no live region. A keyboard user pressed "Refresh", the request
 * failed, the rows disappeared and text appeared in their place, and NOTHING was
 * announced: the table silently emptied and read as "nothing found". The component
 * docstring now takes the error state on itself, so the announcement is its
 * responsibility too.
 */
test("a load error is announced, an empty result is not", () => {
  const { rerender } = render(
    <DataTable
      aria-label="Documents"
      columns={COLUMNS}
      items={[]}
      error="Could not load"
      state={state()}
      onStateChange={() => {}}
    />
  );

  const alert = screen.getByRole("alert");
  expect(alert.textContent).toContain("Could not load");

  rerender(
    <DataTable
      aria-label="Documents"
      columns={COLUMNS}
      items={[]}
      emptyText="Nothing found"
      state={state()}
      onStateChange={() => {}}
    />
  );

  // An empty result is not a failure, so it must not interrupt the screen reader.
  expect(screen.queryByRole("alert")).toBeNull();
});

/**
 * Expansion works without state from outside.
 *
 * The axis was turned on by `renderDetail` alone, while `toggleExpanded` built
 * `new Set(undefined)` and called `onExpandedChange?.()` into the void: a button that
 * looked live, with `aria-expanded="false"` and working hover, was drawn, and a click did
 * nothing. The three props are each optional, so the compiler stayed silent. This is the
 * very "inaccessible list that looks working" that the `SortableList` docstring warns about.
 */
test("renderDetail alone gives a WORKING expander, not a dead one", async () => {
  const user = userEvent.setup();
  render(
    <Table
      aria-label="Documents"
      items={[{ id: "1", name: "First" }]}
      columns={[{ id: "name", header: "Name", cell: (r: { name: string }) => r.name }]}
      renderDetail={() => <span>Detail</span>}
    />
  );

  // The button is there and the simple call form remains, but now it WORKS:
  // the state is held inside until it is driven from outside.
  await user.click(screen.getByRole("button", { expanded: false }));
  expect(screen.getByText("Detail")).toBeDefined();
});

test("the full trio draws a working expander", async () => {
  const user = userEvent.setup();
  const onExpandedChange = vi.fn();

  render(
    <Table
      aria-label="Documents"
      items={[{ id: "1", name: "First" }]}
      columns={[{ id: "name", header: "Name", cell: (r: { name: string }) => r.name }]}
      renderDetail={() => <span>Detail</span>}
      expandedKeys={new Set<string>()}
      onExpandedChange={onExpandedChange}
    />
  );

  await user.click(screen.getByRole("button", { expanded: false }));
  expect(onExpandedChange).toHaveBeenCalledWith(new Set(["1"]));
});

/**
 * A falsy `error` does not hide the table with data.
 *
 * `error != null` is true for `false`, and `error={isError && <Text/>}` is the most
 * common idiom for conditional rendering. With no error, the rows were replaced by an
 * empty body, and a table WITH DATA showed emptiness plus a `role="alert"` with no
 * text. The wave introduced `hasContent` precisely against this, and here it was missed.
 */
test.each([false, "", null, undefined])("error=%o leaves the rows alone", (error) => {
  render(
    <DataTable
      aria-label="Documents"
      columns={COLUMNS}
      items={ROWS}
      error={error as never}
      state={state()}
      onStateChange={() => {}}
    />
  );

  expect(screen.getByText("Contract")).toBeTruthy();
  expect(screen.queryByRole("alert")).toBeNull();
});

/**
 * "Select all" is cleared by the same checkbox, even when a row is expanded.
 *
 * The detail row was counted in react-aria's `isSelectAll`, but it could not get into
 * the selection (its key is subtracted on the way out), so "all selected" NEVER
 * happened: the header checkbox always took the `selectAll` branch, so it could not
 * clear the selection at all. The combination became reachable in the simplest call form
 * once expansion started working without external state.
 */
test("select all is reversible with an expanded detail row", async () => {
  const user = userEvent.setup();

  function Host() {
    const [selected, setSelected] = useState<Set<string>>(new Set());
    return (
      <Table
        aria-label="Documents"
        items={[
          { id: "a", name: "A" },
          { id: "b", name: "B" },
        ]}
        columns={[{ id: "name", header: "Name", cell: (r: { name: string }) => r.name }]}
        selectedKeys={selected}
        onSelectionChange={(keys) => setSelected(keys as Set<string>)}
        renderDetail={() => <span>Detail</span>}
      />
    );
  }

  render(<Host />);
  await user.click(screen.getAllByRole("button", { expanded: false })[0]!);

  const header = screen.getAllByRole("checkbox")[0]!;
  const checked = () =>
    screen.getAllByRole("checkbox").filter((c) => (c as HTMLInputElement).checked).length;

  await user.click(header);
  expect(checked()).toBeGreaterThan(0);

  await user.click(header);
  expect(checked()).toBe(0);
});
