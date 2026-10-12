// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { Table } from "../src/components/content/Table.js";

/*
  Раскладка шапки (OLDSUI-245): заголовок колонки `align: "end"` не должен
  уезжать влево из-за ручки ширины, а служебные колонки (выбор, раскрытие) —
  оставаться узкими и без `resizable`, где проп `width` у react-aria не действует.
*/
type Row = { id: string; name: string; size: number };
const ROWS: Row[] = [{ id: "1", name: "Contract", size: 3 }];
afterEach(cleanup);

const COLUMNS = [
  { id: "name", header: "Name", cell: (r: Row) => r.name },
  { id: "size", header: "Size", align: "end" as const, cell: (r: Row) => r.size },
];

test("при resizable ручка не получает ml-auto у колонки align end", () => {
  render(<Table aria-label="Files" columns={COLUMNS} items={ROWS} resizable />);
  const resizers = document.querySelectorAll(".cursor-col-resize");
  expect(resizers).toHaveLength(2);
  expect(resizers[0]?.classList.contains("ml-auto")).toBe(true);
  expect(resizers[1]?.classList.contains("ml-auto")).toBe(false);
});

test("без resizable служебные колонки получают ширину стилем", () => {
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
