// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { Table } from "../src/components/content/Table.js";

/*
  Header layout (OLDSUI-245): the header of a column with `align: "end"` must not shift
  left because of the width handle, and service columns (selection, expansion) must stay
  narrow and without `resizable`, where react-aria's `width` prop has no effect.
*/
type Row = { id: string; name: string; size: number };
const ROWS: Row[] = [{ id: "1", name: "Contract", size: 3 }];
afterEach(cleanup);

const COLUMNS = [
  { id: "name", header: "Name", cell: (r: Row) => r.name },
  { id: "size", header: "Size", align: "end" as const, cell: (r: Row) => r.size },
];

test("with resizable, the handle of an end-aligned column does not push the header left", () => {
  render(<Table aria-label="Files" columns={COLUMNS} items={ROWS} resizable />);
  const resizers = document.querySelectorAll(".cursor-col-resize");
  expect(resizers).toHaveLength(2);
  expect(resizers[0]?.classList.contains("ml-auto")).toBe(true);
  expect(resizers[1]?.classList.contains("ml-auto")).toBe(false);
});

test("without resizable, the selection and expand columns get their width as a style", () => {
  render(
    <Table
      aria-label="Files"
      columns={COLUMNS}
      items={ROWS}
      selectedKeys={new Set()}
      onSelectionChange={() => {}}
      renderDetail={() => <div>detail</div>}
    />
  );
  const headers = screen.getAllByRole("columnheader");
  expect(headers[0]?.style.width).toBe("40px");
  expect(headers[1]?.style.width).toBe("40px");
  expect(headers[2]?.style.width).toBe("");
});
