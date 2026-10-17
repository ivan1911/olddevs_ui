// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { AvatarGroup } from "../src/components/content/AvatarGroup.js";
import { Badge } from "../src/components/content/Badge.js";
import { Stat } from "../src/components/content/Stat.js";
import { Table } from "../src/components/content/Table.js";

afterEach(cleanup);

const PHOTOS = [
  { id: "1", name: "Night city" },
  { id: "2", name: "Sunset" },
];

test("table axes do not appear without their props", () => {
  render(
    <Table
      aria-label="Photos"
      items={PHOTOS}
      columns={[{ id: "name", header: "Name", cell: (w) => w.name }]}
    />
  );

  // There are no selection checkboxes or sort buttons in the markup at all: a table
  // of three rows does not pull in what was never asked for.
  expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  expect(screen.getByRole("columnheader", { name: "Name" }).getAttribute("aria-sort")).toBeNull();
});

test("sorting appears with the prop and is announced to a screen reader", () => {
  render(
    <Table
      aria-label="Photos"
      items={PHOTOS}
      sort={{ column: "name", direction: "descending" }}
      onSortChange={() => {}}
      columns={[{ id: "name", header: "Name", cell: (w) => w.name, sortable: true }]}
    />
  );

  expect(screen.getByRole("columnheader", { name: /Name/ }).getAttribute("aria-sort")).toBe(
    "descending"
  );
});

test("selection appears with the prop", () => {
  render(
    <Table
      aria-label="Photos"
      items={PHOTOS}
      selectedKeys={new Set(["1"])}
      onSelectionChange={() => {}}
      columns={[{ id: "name", header: "Name", cell: (w) => w.name }]}
    />
  );

  // A checkbox in the header plus one per row.
  expect(screen.getAllByRole("checkbox")).toHaveLength(3);
});

test("a count above the limit is collapsed", () => {
  render(<Badge max={99}>{140}</Badge>);

  expect(screen.getByText("99+")).toBeTruthy();
});

test("a dot shows no number", () => {
  const { container } = render(<Badge dot>{5}</Badge>);

  // "New" without a count: "237 unread" reads worse than a plain marker.
  expect(container.textContent).toBe("");
});

test("the delta tone is not derived from the sign", () => {
  const { container } = render(
    <Stat label="Unsubscribes" value="184" delta="+12" deltaTone="danger" />
  );

  // A rise in unsubscribes is bad news, and colouring the plus sign green automatically
  // would mean lying exactly where a mistake costs the most.
  expect(container.querySelector(".text-danger-strong")?.textContent).toBe("+12");
});

test("an avatar group is announced as a list of names, not a set of initials", () => {
  render(
    <AvatarGroup
      names={["Ada Lovelace", "Grace Hopper", "Alan Turing", "Barbara Liskov"]}
      max={2}
    />
  );

  const group = screen.getByRole("img");
  expect(group.getAttribute("aria-label")).toBe(
    "Ada Lovelace, Grace Hopper, Alan Turing, Barbara Liskov"
  );
  // Shows two and the remainder. The initials of the circles do get into the text, but
  // the screen reader hides them: the group's name comes from `aria-label` above.
  expect(group.textContent).toContain("+2");
  expect(group.querySelectorAll("[aria-hidden]").length).toBe(3);
});

test("a column id may coincide with a row id", () => {
  render(
    <Table
      aria-label="Photos"
      items={[
        { id: "name", name: "Row with a column-like id" },
        { id: "2", name: "Plain" },
      ]}
      columns={[
        { id: "name", header: "Name", cell: (w) => w.name },
        { id: "second", header: "Second", cell: () => "—" },
      ]}
    />
  );

  // React-aria keeps column and row keys in one namespace, and a collision collapsed
  // one of them: the table threw "Cell count must match column count". The column
  // keys are kept apart by a prefix inside the component.
  expect(screen.getAllByRole("columnheader")).toHaveLength(2);
  expect(screen.getAllByRole("row")).toHaveLength(3);
});

test("the internal column key does not leak into aria-sort", () => {
  render(
    <Table
      aria-label="Photos"
      items={PHOTOS}
      sort={{ column: "name", direction: "ascending" }}
      onSortChange={() => {}}
      columns={[{ id: "name", header: "Name", cell: (w) => w.name, sortable: true }]}
    />
  );

  // Outside, the component speaks in the source identifiers; the prefix is its own
  // internal concern. Returning the key outwards is verified in the browser: a click on
  // the header in jsdom requires `CSS.escape`, which is not there.
  expect(screen.getByRole("columnheader", { name: /Name/ }).getAttribute("aria-sort")).toBe(
    "ascending"
  );
});

test("width without resizable reaches the style instead of vanishing", () => {
  render(
    <Table
      aria-label="Photos"
      items={PHOTOS}
      columns={[{ id: "name", header: "Name", cell: (w) => w.name, width: 200 }]}
    />
  );

  // React-aria's `width` prop only works inside `ResizableTableContainer`;
  // in a plain table it silently did nothing.
  expect((screen.getByRole("columnheader") as HTMLElement).style.width).toBe("200px");
});

/**
 * The row expansion axis (ADR-0022) is the only one that required changing
 * `Table`: the detail row lives inside `<tbody>`, between the rows of the
 * react-aria collection, and it cannot be inserted from outside.
 */
describe("Table: row expansion", () => {
  const COLUMNS = [{ id: "name", header: "Name", cell: (w: { name: string }) => w.name }];

  /**
   * The main check of this change. The axis is turned on by the presence of the prop, and
   * "without the prop nothing changed" is not a wish but the condition on which
   * changing a stable component was accepted at all.
   */
  test("without renderDetail the markup does not change by a single node", () => {
    // React-aria assigns auto ids to nodes, and they differ between any two
    // renders: comparing them would mean comparing a counter, not the markup.
    const withoutId = (html: string) => html.replace(/react-aria-[\w]+/g, "RA");

    const { container: withoutDetail } = render(
      <Table aria-label="Photos" items={PHOTOS} columns={COLUMNS} />
    );
    const snapshot = withoutId(withoutDetail.innerHTML);
    cleanup();

    const { container: withDetail } = render(
      <Table
        aria-label="Photos"
        items={PHOTOS}
        columns={COLUMNS}
        expandedKeys={new Set(["1"])}
        onExpandedChange={() => {}}
      />
    );
    // `expandedKeys` without `renderDetail` does not turn the axis on: there is nothing to show.
    expect(withoutId(withDetail.innerHTML)).toBe(snapshot);
  });

  test("the expander column appears with the prop and is named", () => {
    render(
      <Table
        aria-label="Photos"
        items={PHOTOS}
        columns={COLUMNS}
        renderDetail={(w) => <p>Details {w.name}</p>}
      />
    );
    expect(screen.getByRole("columnheader", { name: "Row details" })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Show details" })).toHaveLength(2);
  });

  test("a collapsed row keeps no details in the markup", () => {
    render(
      <Table
        aria-label="Photos"
        items={PHOTOS}
        columns={COLUMNS}
        renderDetail={(w) => <p>Details {w.name}</p>}
      />
    );
    expect(screen.queryByText(/Details/)).toBeNull();
    expect(screen.getAllByRole("row")).toHaveLength(3); // header + two rows
  });

  test("an expanded row shows the detail and announces the state", () => {
    render(
      <Table
        aria-label="Photos"
        items={PHOTOS}
        columns={COLUMNS}
        renderDetail={(w) => <p>Details {w.name}</p>}
        expandedKeys={new Set(["1"])}
        onExpandedChange={() => {}}
      />
    );
    expect(screen.getByText("Details Night city")).toBeTruthy();
    expect(screen.getAllByRole("row")).toHaveLength(4); // the detail row was added
    expect(screen.getByRole("button", { name: "Hide details" }).getAttribute("aria-expanded")).toBe(
      "true"
    );
  });

  test("the detail spans the whole row, not a single cell", () => {
    const { container } = render(
      <Table
        aria-label="Photos"
        items={PHOTOS}
        columns={[...COLUMNS, { id: "x", header: "X", cell: () => "—" }]}
        selectedKeys={new Set()}
        onSelectionChange={() => {}}
        renderDetail={(w) => <p>Details {w.name}</p>}
        expandedKeys={new Set(["1"])}
        onExpandedChange={() => {}}
      />
    );
    // Selection + expander + two columns = four cells.
    expect(container.querySelector("[colspan='4']")).toBeTruthy();
  });

  /** The table does not store this state, under the same rule as sorting. */
  test("a click reports outwards and expands nothing itself", async () => {
    const user = userEvent.setup();
    const onExpandedChange = vi.fn();
    render(
      <Table
        aria-label="Photos"
        items={PHOTOS}
        columns={COLUMNS}
        renderDetail={(w) => <p>Details {w.name}</p>}
        expandedKeys={new Set()}
        onExpandedChange={onExpandedChange}
      />
    );

    await user.click(screen.getAllByRole("button", { name: "Show details" })[0]!);
    expect(onExpandedChange).toHaveBeenCalledWith(new Set(["1"]));
    expect(screen.queryByText(/Details/)).toBeNull();
  });

  test("the caller applied it — the detail appeared", async () => {
    const user = userEvent.setup();
    function Controlled() {
      const [expanded, setExpanded] = useState<Set<string>>(new Set());
      return (
        <Table
          aria-label="Photos"
          items={PHOTOS}
          columns={COLUMNS}
          renderDetail={(w) => <p>Details {w.name}</p>}
          expandedKeys={expanded}
          onExpandedChange={(keys) => setExpanded(keys as Set<string>)}
        />
      );
    }
    render(<Controlled />);

    await user.click(screen.getAllByRole("button", { name: "Show details" })[0]!);
    expect(screen.getByText("Details Night city")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Hide details" }));
    expect(screen.queryByText(/Details/)).toBeNull();
  });

  /**
   * Without `rowLabel`, twenty rows have twenty identical "Show details" buttons,
   * and in the mode that lists buttons a screen reader cannot tell them apart at all.
   * A finding from an external review of accessibility audits.
   */
  test("rowLabel names the row in the expander label", () => {
    render(
      <Table
        aria-label="Photos"
        items={PHOTOS}
        columns={COLUMNS}
        renderDetail={(w) => <p>Details {w.name}</p>}
        rowLabel={(w) => w.name}
        expandedKeys={new Set(["1"])}
        onExpandedChange={() => {}}
      />
    );
    expect(screen.getByRole("button", { name: "Hide details for Night city" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Show details for Sunset" })).toBeTruthy();
  });

  test("without rowLabel the label stays generic, not empty", () => {
    render(
      <Table
        aria-label="Photos"
        items={PHOTOS}
        columns={COLUMNS}
        renderDetail={(w) => <p>Details {w.name}</p>}
      />
    );
    expect(screen.getAllByRole("button", { name: "Show details" })).toHaveLength(2);
  });

  test("several rows expand at once — there is no toggle and none is needed", () => {
    render(
      <Table
        aria-label="Photos"
        items={PHOTOS}
        columns={COLUMNS}
        renderDetail={(w) => <p>Details {w.name}</p>}
        expandedKeys={new Set(["1", "2"])}
        onExpandedChange={() => {}}
      />
    );
    expect(screen.getByText("Details Night city")).toBeTruthy();
    expect(screen.getByText("Details Sunset")).toBeTruthy();
  });
});
