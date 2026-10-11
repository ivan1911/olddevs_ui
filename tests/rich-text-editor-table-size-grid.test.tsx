// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { createRef } from "react";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import {
  TableSizeGrid,
  type TableSizeGridProps,
} from "../src/editor/features/table/TableSizeGrid.js";
import { insertTableOfSize } from "../src/editor/core/insertItems.js";
import { RichTextEditor, type RichTextEditorHandle } from "../src/editor/index.js";
import { UiProvider } from "../src/i18n/UiProvider.js";
import { messages as ru } from "../src/locales/ru.js";
import { loadLazyBuiltins } from "./editor-lazy-builtins.js";

// Ленивые `codeBlock` и `table` (OLDSUI-111): `full` готов в `render` после загрузки чанков.
beforeAll(loadLazyBuiltins);

afterEach(cleanup);

/**
 * Сетка выбора размера таблицы (OLDSUI-45).
 *
 * Тесты — на самом компоненте: он самостоятельный и ляжет внутрь подменю
 * Панели, поэтому от кнопки Панели не зависит. Клавиши — настоящие, через
 * `user-event`; фокус при монтировании приходит на сетку.
 */
function setup(props: Partial<TableSizeGridProps> = {}) {
  const onPick = vi.fn();
  const onCancel = vi.fn();
  const user = userEvent.setup();
  const view = render(<TableSizeGrid onPick={onPick} onCancel={onCancel} {...props} />);
  return { user, onPick, onCancel, ...view };
}

const grid = () => screen.getByRole("grid", { name: "Table size" });
const cellCount = () => within(grid()).getAllByRole("gridcell").length;
const selected = () =>
  within(grid())
    .getAllByRole("gridcell")
    .filter((cell) => cell.getAttribute("aria-selected") === "true").length;
const status = () => screen.getByRole("status").textContent;

test("opens on 3x3 inside a 5x5 grid and puts focus on the grid", () => {
  setup();

  expect(cellCount()).toBe(25);
  expect(selected()).toBe(9);
  expect(status()).toBe("3 columns, 3 rows");
  expect(document.activeElement).toBe(grid());
});

test("opens on the size it is given", () => {
  setup({ initial: { cols: 4, rows: 2 } });

  expect(selected()).toBe(8);
  expect(status()).toBe("4 columns, 2 rows");
});

test("arrow keys move the selection; Enter picks it", async () => {
  const { user, onPick } = setup();

  await user.keyboard("{ArrowRight}{ArrowDown}{ArrowDown}");
  expect(status()).toBe("4 columns, 5 rows");
  await user.keyboard("{ArrowLeft}{ArrowUp}");
  expect(status()).toBe("3 columns, 4 rows");

  await user.keyboard("{Enter}");
  expect(onPick).toHaveBeenCalledExactlyOnceWith(3, 4);
});

test("the selection never goes below 1x1", async () => {
  const { user } = setup({ initial: { cols: 1, rows: 1 } });

  await user.keyboard("{ArrowLeft}{ArrowUp}");

  expect(status()).toBe("1 column, 1 row");
});

test("the grid grows by one column or row when the selection reaches its edge", async () => {
  const { user } = setup();
  expect(cellCount()).toBe(25);

  await user.keyboard("{ArrowRight}{ArrowRight}");
  expect(status()).toBe("5 columns, 3 rows");
  // Пять столбцов — край сетки 5x5: появился шестой, строки прежние.
  expect(cellCount()).toBe(6 * 5);

  await user.keyboard("{ArrowDown}{ArrowDown}");
  expect(cellCount()).toBe(6 * 6);
});

test("the grid stops growing at 10x10 and the arrows stop with it", async () => {
  const { user, onPick } = setup();

  await user.keyboard("{ArrowRight>12/}{ArrowDown>12/}");

  expect(status()).toBe("10 columns, 10 rows");
  expect(cellCount()).toBe(100);
  await user.keyboard("{Enter}");
  expect(onPick).toHaveBeenCalledWith(10, 10);
});

test("the grid shrinks back when the selection does", async () => {
  const { user } = setup({ initial: { cols: 8, rows: 3 } });
  expect(cellCount()).toBe(9 * 5);

  await user.keyboard("{ArrowLeft>5/}");

  expect(cellCount()).toBe(5 * 5);
});

test("Home and End jump along the row, with Ctrl to the corners", async () => {
  const { user } = setup();

  await user.keyboard("{Home}");
  expect(status()).toBe("1 column, 3 rows");
  await user.keyboard("{End}");
  // Последний столбец видимой сетки; она при этом вырастает.
  expect(status()).toBe("5 columns, 3 rows");
  await user.keyboard("{Control>}{Home}{/Control}");
  expect(status()).toBe("1 column, 1 row");
});

test("the active cell is announced by name through aria-activedescendant", async () => {
  const { user } = setup();
  await user.keyboard("{ArrowRight}");

  const active = document.getElementById(grid().getAttribute("aria-activedescendant")!);
  expect(active?.getAttribute("role")).toBe("gridcell");
  expect(active?.getAttribute("aria-label")).toBe("4 columns, 3 rows");
});

test("a cell has the name of the size it picks, and a click on it picks it", async () => {
  const { user, onPick } = setup();

  await user.click(screen.getByRole("gridcell", { name: "5 columns, 2 rows" }));

  expect(onPick).toHaveBeenCalledExactlyOnceWith(5, 2);
});

test("hovering a cell previews its size", async () => {
  const { user, onPick } = setup();

  await user.hover(screen.getByRole("gridcell", { name: "4 columns, 5 rows" }));

  expect(status()).toBe("4 columns, 5 rows");
  expect(selected()).toBe(20);
  expect(onPick).not.toHaveBeenCalled();
});

test("the first row is marked as the header row", () => {
  setup();

  const rows = within(grid()).getAllByRole("row");
  expect(rows[0]?.getAttribute("data-header")).toBe("true");
  expect(rows[1]?.hasAttribute("data-header")).toBe(false);
});

test("Escape asks to cancel", async () => {
  const { user, onCancel, onPick } = setup();

  await user.keyboard("{Escape}");

  expect(onCancel).toHaveBeenCalledOnce();
  expect(onPick).not.toHaveBeenCalled();
});

test("max narrows the grid", async () => {
  const { user } = setup({ max: 6 });

  await user.keyboard("{ArrowRight>10/}");

  expect(status()).toBe("6 columns, 3 rows");
  expect(cellCount()).toBe(6 * 5);
});

test("the live region says the size in Russian with the right plural forms", async () => {
  const user = userEvent.setup();
  render(
    <UiProvider locale="ru-RU" messages={ru}>
      <TableSizeGrid onPick={() => undefined} />
    </UiProvider>
  );
  const text = () => screen.getByRole("status").textContent;

  expect(text()).toBe("3 столбца, 3 строки");
  await user.keyboard("{ArrowRight}{ArrowDown}");
  expect(text()).toBe("4 столбца, 4 строки");
  await user.keyboard("{ArrowRight}{ArrowDown}");
  expect(text()).toBe("5 столбцов, 5 строк");
  await user.keyboard("{Home}{Control>}{Home}{/Control}");
  expect(text()).toBe("1 столбец, 1 строка");
  expect(screen.getByRole("grid", { name: "Размер таблицы" })).toBeDefined();
});

test("a field-less grid has no numeric fields, a grid with fields has", () => {
  setup();
  expect(screen.queryByRole("textbox", { name: "Columns" })).toBeNull();
  cleanup();

  setup({ fields: { maxCols: 20, maxRows: 50 } });
  expect(screen.getByRole("textbox", { name: "Columns" })).toBeDefined();
  expect(screen.getByRole("textbox", { name: "Rows" })).toBeDefined();
});

test("typing in the fields moves the grid, the arrows move the fields, up to 20 columns and 50 rows", async () => {
  const { user, onPick } = setup({ fields: { maxCols: 20, maxRows: 50 } });
  const cols = screen.getByRole("textbox", { name: "Columns" }) as HTMLInputElement;
  const rows = screen.getByRole("textbox", { name: "Rows" }) as HTMLInputElement;

  await user.clear(cols);
  await user.type(cols, "7");
  await user.tab();
  expect(status()).toBe("7 columns, 3 rows");
  expect(selected()).toBe(21);

  await user.clear(rows);
  await user.type(rows, "99");
  await user.tab();
  // Выше предела — предел.
  expect(rows.value).toBe("50");
  expect(status()).toBe("7 columns, 50 rows");

  await user.clear(cols);
  await user.type(cols, "20");
  await user.tab();
  expect(cols.value).toBe("20");
  // Сетка не больше 10x10, выбор — больше.
  expect(cellCount()).toBe(100);

  await user.click(screen.getByRole("button", { name: "Insert" }));
  expect(onPick).toHaveBeenCalledExactlyOnceWith(20, 50);
});

test("the fields follow the grid", async () => {
  const { user } = setup({ fields: { maxCols: 20, maxRows: 50 } });

  await user.click(screen.getByRole("gridcell", { name: "5 columns, 4 rows" }).parentElement!);
  grid().focus();
  await user.keyboard("{ArrowRight}{ArrowDown}");

  expect((screen.getByRole("textbox", { name: "Columns" }) as HTMLInputElement).value).toBe("4");
  expect((screen.getByRole("textbox", { name: "Rows" }) as HTMLInputElement).value).toBe("4");
});

test("an empty field does not lose the size: Insert uses the last valid one", async () => {
  const { user, onPick } = setup({ fields: { maxCols: 20, maxRows: 50 } });

  await user.clear(screen.getByRole("textbox", { name: "Columns" }));
  await user.tab();
  await user.click(screen.getByRole("button", { name: "Insert" }));

  expect(onPick).toHaveBeenCalledExactlyOnceWith(3, 3);
});

test("a ref reaches the grid so a host can move focus into it", () => {
  const ref = createRef<HTMLDivElement>();
  render(<TableSizeGrid ref={ref} autoFocus={false} onPick={() => undefined} />);

  expect(ref.current).toBe(grid());
  expect(document.activeElement).not.toBe(grid());
  act(() => ref.current?.focus());
  expect(document.activeElement).toBe(grid());
});

const row = (cell: "th" | "td", count: number) =>
  `<tr>${`<${cell}><p></p></${cell}>`.repeat(count)}</tr>`;

test("insertTableOfSize puts an N x M table with a header row after the current block", () => {
  const ref = createRef<RichTextEditorHandle>();
  render(<RichTextEditor ref={ref} aria-label="Body" defaultValue="<p>Text</p>" />);
  const editor = ref.current!.editor!;

  act(() => insertTableOfSize(editor, 4, 2));

  expect(editor.getHTML()).toBe(
    `<p>Text</p><table><tbody>${row("th", 4)}${row("td", 4)}</tbody></table>`
  );
  expect(editor.isActive("tableHeader")).toBe(true);
});

test("insertTableOfSize keeps the size inside what a table can be", () => {
  const ref = createRef<RichTextEditorHandle>();
  render(<RichTextEditor ref={ref} aria-label="Body" />);
  const editor = ref.current!.editor!;

  act(() => insertTableOfSize(editor, 0, 1));

  expect(editor.getHTML()).toBe(`<table><tbody>${row("th", 1)}</tbody></table>`);
});
