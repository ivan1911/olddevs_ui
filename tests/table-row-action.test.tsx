// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useState } from "react";
import type { Key } from "react-aria-components";
import { afterEach, describe, expect, test, vi } from "vitest";
import { Table, type TableProps } from "../src/components/content/Table.js";
import { DataTable } from "../src/components/table/DataTable.js";
import { DEFAULT_TABLE_STATE, type TableState } from "../src/lib/table-state.js";

afterEach(cleanup);

/*
  `onRowAction` (OLDSUI-193): действие по строке рядом с выделением. Клик и
  Enter по строке открывают запись, а выделение остаётся за флажками.
*/

interface Row {
  id: string;
  name: string;
}

const ROWS: Row[] = [
  { id: "a", name: "Contract" },
  { id: "b", name: "Report" },
];

const COLUMNS = [{ id: "name", header: "Name", cell: (r: Row) => r.name }];

/** Таблица с выделением, которое держит тест, как держит его экран. */
function Harness(props: Partial<TableProps<Row>>) {
  const [selected, setSelected] = useState<Set<Key>>(new Set());
  return (
    <Table
      aria-label="Documents"
      columns={COLUMNS}
      items={ROWS}
      selectedKeys={selected}
      onSelectionChange={setSelected}
      {...props}
    />
  );
}

const rowOf = (name: string) => screen.getByRole("row", { name: new RegExp(name) });

describe("Table: onRowAction", () => {
  test("a click on a row runs the action with the row's item and selects nothing", async () => {
    const user = userEvent.setup();
    const onRowAction = vi.fn();
    render(<Harness onRowAction={onRowAction} />);

    await user.click(screen.getByText("Report"));

    expect(onRowAction).toHaveBeenCalledTimes(1);
    expect(onRowAction).toHaveBeenCalledWith(ROWS[1]);
    for (const box of screen.getAllByRole("checkbox"))
      expect((box as HTMLInputElement).checked).toBe(false);
  });

  test("a click on a checkbox selects the row and does not run the action", async () => {
    const user = userEvent.setup();
    const onRowAction = vi.fn();
    render(<Harness onRowAction={onRowAction} />);

    await user.click(within(rowOf("Contract")).getByRole("checkbox"));

    expect(onRowAction).not.toHaveBeenCalled();
    expect(within(rowOf("Contract")).getByRole("checkbox")).toHaveProperty("checked", true);
  });

  test("Enter on a focused row runs the action, Space toggles the selection", async () => {
    const user = userEvent.setup();
    const onRowAction = vi.fn();
    render(<Harness onRowAction={onRowAction} />);

    rowOf("Contract").focus();
    await user.keyboard("{Enter}");
    expect(onRowAction).toHaveBeenCalledTimes(1);
    expect(onRowAction).toHaveBeenCalledWith(ROWS[0]);
    expect(within(rowOf("Contract")).getByRole("checkbox")).toHaveProperty("checked", false);

    await user.keyboard(" ");
    expect(onRowAction).toHaveBeenCalledTimes(1);
    expect(within(rowOf("Contract")).getByRole("checkbox")).toHaveProperty("checked", true);
  });

  test("works without the selection axis too", async () => {
    const user = userEvent.setup();
    const onRowAction = vi.fn();
    render(
      <Table aria-label="Documents" columns={COLUMNS} items={ROWS} onRowAction={onRowAction} />
    );

    await user.click(screen.getByText("Contract"));
    expect(onRowAction).toHaveBeenCalledWith(ROWS[0]);
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  test("a control inside a cell keeps its own click and does not run the row action", async () => {
    const user = userEvent.setup();
    const onRowAction = vi.fn();
    const onInner = vi.fn();
    render(
      <Table
        aria-label="Documents"
        columns={[
          {
            id: "name",
            header: "Name",
            cell: (r: Row) => (
              <button type="button" onClick={onInner}>
                Menu {r.id}
              </button>
            ),
          },
        ]}
        items={ROWS}
        onRowAction={onRowAction}
      />
    );

    await user.click(screen.getByRole("button", { name: "Menu a" }));
    expect(onInner).toHaveBeenCalledTimes(1);
    expect(onRowAction).not.toHaveBeenCalled();
  });

  test("the expand button and the detail row do not run the action", async () => {
    const user = userEvent.setup();
    const onRowAction = vi.fn();
    render(
      <Harness
        onRowAction={onRowAction}
        renderDetail={(r) => <p>Detail of {r.name}</p>}
        rowLabel={(r) => r.name}
      />
    );

    await user.click(screen.getByRole("button", { name: /Contract/ }));
    expect(screen.getByText("Detail of Contract")).toBeTruthy();
    expect(onRowAction).not.toHaveBeenCalled();

    await user.click(screen.getByText("Detail of Contract"));
    expect(onRowAction).not.toHaveBeenCalled();
  });

  test("once rows are selected a click on a row toggles the selection (react-aria selection mode)", async () => {
    const user = userEvent.setup();
    const onRowAction = vi.fn();
    render(<Harness onRowAction={onRowAction} />);

    await user.click(within(rowOf("Contract")).getByRole("checkbox"));
    await user.click(screen.getByText("Report"));

    expect(onRowAction).not.toHaveBeenCalled();
    expect(within(rowOf("Report")).getByRole("checkbox")).toHaveProperty("checked", true);
  });

  test("without onRowAction a click on a row still toggles the selection", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByText("Report"));

    expect(within(rowOf("Report")).getByRole("checkbox")).toHaveProperty("checked", true);
  });
});

describe("DataTable: onRowAction", () => {
  const state: TableState = { ...DEFAULT_TABLE_STATE, density: "comfortable" };

  test("is passed through to the table next to the selection column", async () => {
    const user = userEvent.setup();
    const onRowAction = vi.fn();
    const onStateChange = vi.fn();
    render(
      <DataTable
        aria-label="Documents"
        columns={COLUMNS}
        items={ROWS}
        state={state}
        onStateChange={onStateChange}
        selectable
        onRowAction={onRowAction}
      />
    );

    await user.click(screen.getByText("Report"));
    expect(onRowAction).toHaveBeenCalledWith(ROWS[1]);
    expect(onStateChange).not.toHaveBeenCalled();

    await user.click(within(rowOf("Report")).getByRole("checkbox"));
    expect(onRowAction).toHaveBeenCalledTimes(1);
    expect(onStateChange).toHaveBeenCalledTimes(1);
  });
});
