// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import type { Editor } from "@tiptap/react";
import { createRef } from "react";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import {
  RichTextEditor,
  type RichTextEditorHandle,
  type RichTextEditorProps,
} from "../src/editor/index.js";
import { ModalOverlay } from "../src/components/overlays/ModalOverlay.js";
import { UiProvider } from "../src/i18n/UiProvider.js";
import { messages as ru } from "../src/locales/ru.js";
import { loadLazyBuiltins } from "./editor-lazy-builtins.js";

// Ленивые `codeBlock` и `table` (OLDSUI-111): `full` готов в `render` после загрузки чанков.
beforeAll(loadLazyBuiltins);

afterEach(cleanup);

/**
 * Меню «Таблица» на Панели (OLDSUI-45), как у TinyMCE: одна кнопка вместо
 * «Таблицы» и «Действий с таблицей».
 *
 * Через публичный `RichTextEditor`: пункты выбираются мышью и клавишами, как
 * пользователь, результат читается по ячейкам документа. Курсор ставится
 * командами движка: jsdom не умеет ввода в `contenteditable`.
 */
function renderEditor(props: Partial<RichTextEditorProps> = {}) {
  const ref = createRef<RichTextEditorHandle>();
  const view = render(<RichTextEditor ref={ref} aria-label="Body" {...props} />);
  const editor = ref.current?.editor;
  if (!editor) throw new Error("the editor was not created inside render()");
  return { ...view, ref, editor, handle: ref.current! };
}

/** Таблица 2×3 с заголовком и текстом в каждой ячейке. */
const TABLE =
  "<table><tbody>" +
  "<tr><th><p>h1</p></th><th><p>h2</p></th></tr>" +
  "<tr><td><p>a1</p></td><td><p>a2</p></td></tr>" +
  "<tr><td><p>b1</p></td><td><p>b2</p></td></tr>" +
  "</tbody></table>";

/** Курсор в конец ячейки (или абзаца) с этим текстом. */
function caretIn(editor: Editor, text: string) {
  let found = -1;
  editor.state.doc.descendants((node, pos) => {
    if (found < 0 && node.isText && node.text === text) found = pos + node.nodeSize;
  });
  if (found < 0) throw new Error(`no text "${text}" in the document`);
  act(() => void editor.commands.setTextSelection(found));
}

const tableButton = () => screen.getByRole("button", { name: "Table" });

async function openMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(tableButton());
  return screen.getByRole("menu", { name: "Table" });
}

/** Пункты меню первого уровня: имя и недоступность. */
const topItems = (menu: HTMLElement) =>
  Array.from(menu.querySelectorAll(':scope [role^="menuitem"]'))
    .filter((item) => item.closest('[role="menu"]') === menu)
    .map((item) => ({
      name: item.textContent,
      disabled: item.getAttribute("aria-disabled") === "true",
    }));

test("one Table button with a menu replaces the Table and Table actions buttons", () => {
  const { editor } = renderEditor({ defaultValue: `<p>Text</p>${TABLE}` });
  caretIn(editor, "a2");

  expect(screen.getAllByRole("button", { name: /table/i })).toHaveLength(1);
  expect(tableButton().getAttribute("aria-haspopup")).toBe("menu");
  caretIn(editor, "Text");
  expect(screen.getAllByRole("button", { name: /table/i })).toHaveLength(1);
});

test("outside a table only Table and Insert table are available; the rest stays in navigation", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: `<p>Text</p>` });
  caretIn(editor, "Text");

  const menu = await openMenu(user);

  expect(topItems(menu)).toEqual([
    { name: "Table", disabled: false },
    { name: "Insert table…", disabled: false },
    { name: "Cell", disabled: true },
    { name: "Row", disabled: true },
    { name: "Column", disabled: true },
    { name: "Sort", disabled: true },
    { name: "Delete table", disabled: true },
  ]);
  // Недоступный пункт — `aria-disabled`, а не пропуск: стрелка на него встаёт.
  await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}");
  expect(document.activeElement?.textContent).toBe("Cell");
});

test("inside a table every top-level item is available", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: TABLE });
  caretIn(editor, "a2");

  const menu = await openMenu(user);

  expect(topItems(menu).every((item) => !item.disabled)).toBe(true);
  expect(within(menu).getByRole("menuitem", { name: "Delete table" })).toBeDefined();
});

const rowsOf = (html: string) => html.match(/<tr>.*?<\/tr>/g) ?? [];
const sizeOf = (html: string) => {
  const rows = rowsOf(html);
  return { cols: (rows[0]?.match(/<t[hd]>/g) ?? []).length, rows: rows.length };
};
const textbox = () => screen.getByRole("textbox", { name: "Body" });

test("Table › opens a size grid; a click inserts that size with a header row and closes the menu", async () => {
  const user = userEvent.setup();
  const { editor, handle } = renderEditor({ defaultValue: "<p>Text</p>" });
  caretIn(editor, "Text");

  const menu = await openMenu(user);
  await user.hover(within(menu).getByRole("menuitem", { name: "Table" }));
  const grid = await screen.findByRole("grid", { name: "Table size" });
  await user.click(within(grid).getByRole("gridcell", { name: "4 columns, 2 rows" }));

  expect(sizeOf(handle.getHTML())).toEqual({ cols: 4, rows: 2 });
  expect(rowsOf(handle.getHTML())[0]).toBe(`<tr>${"<th><p></p></th>".repeat(4)}</tr>`);
  expect(screen.queryByRole("menu")).toBeNull();
  // Каретка — в первой ячейке новой таблицы, фокус — в документе.
  expect(editor.isActive("tableHeader")).toBe(true);
  await waitFor(() => expect(document.activeElement).toBe(textbox()));
});

test("the keyboard path: Enter opens the menu, → opens the grid and focuses it, arrows and Enter pick", async () => {
  const user = userEvent.setup();
  const { editor, handle } = renderEditor({ defaultValue: "<p>Text</p>" });
  caretIn(editor, "Text");

  act(() => tableButton().focus());
  await user.keyboard("{Enter}");
  expect(document.activeElement?.closest('[role="menu"]')).toBe(
    screen.getByRole("menu", { name: "Table" })
  );
  // `Enter` на кнопке меню ставит фокус на первый пункт — «Таблица ›».
  expect(document.activeElement?.textContent).toBe("Table");
  await user.keyboard("{ArrowRight}");
  const grid = await screen.findByRole("grid", { name: "Table size" });
  await waitFor(() => expect(document.activeElement).toBe(grid));
  // Меню под сеткой при этом открыто: фокус в подменю его не закрыл.
  expect(screen.getByRole("menu", { name: "Table" })).toBeDefined();

  await user.keyboard("{ArrowRight}{ArrowDown}{Enter}");

  expect(sizeOf(handle.getHTML())).toEqual({ cols: 4, rows: 4 });
  expect(screen.queryByRole("menu")).toBeNull();
  await waitFor(() => expect(document.activeElement).toBe(textbox()));
  expect(editor.isActive("tableHeader")).toBe(true);
});

/*
  Фокус в сетку ставит сигнал поповера («место посчитано, вход доигран»), а не
  таймер: часы здесь заморожены, и фокус обязан прийти без их хода. Таймер на
  50 мс — гонка с устройством, сигнал react-aria — нет.
*/
test("the grid takes focus once its popover has settled, without waiting on a timer", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: "<p>Text</p>" });
  caretIn(editor, "Text");
  act(() => tableButton().focus());
  await user.keyboard("{Enter}");
  expect(document.activeElement?.textContent).toBe("Table");

  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval"] });
  try {
    // `fireEvent`, а не `user.keyboard`: тому самому нужны часы между событиями.
    const item = document.activeElement!;
    await act(async () => {
      fireEvent.keyDown(item, { key: "ArrowRight" });
      fireEvent.keyUp(item, { key: "ArrowRight" });
    });
    const grid = screen.getByRole("grid", { name: "Table size" });
    expect(document.activeElement).toBe(grid);
    expect(screen.getByRole("menu", { name: "Table" })).toBeDefined();
  } finally {
    // Таймеры, заведённые под замороженными часами (react-aria, движок), должны
    // отработать: иначе их состояние протечёт в следующие тесты файла.
    act(() => vi.runOnlyPendingTimers());
    vi.useRealTimers();
  }
});

test("Escape in the grid closes only the grid and returns focus to the Table item", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: "<p>Text</p>" });
  caretIn(editor, "Text");

  act(() => tableButton().focus());
  await user.keyboard("{Enter}{ArrowRight}");
  const grid = await screen.findByRole("grid", { name: "Table size" });
  await waitFor(() => expect(document.activeElement).toBe(grid));

  await user.keyboard("{Escape}");

  expect(screen.queryByRole("grid")).toBeNull();
  expect(screen.getByRole("menu", { name: "Table" })).toBeDefined();
  expect(document.activeElement?.textContent).toBe("Table");
});

test("the grid opens on the last picked size of this editor, 3x3 at first", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: "<p>Text</p>" });
  caretIn(editor, "Text");

  await user.hover(within(await openMenu(user)).getByRole("menuitem", { name: "Table" }));
  expect((await screen.findByRole("status")).textContent).toBe("3 columns, 3 rows");
  await user.click(screen.getByRole("gridcell", { name: "5 columns, 2 rows" }));

  caretIn(editor, "Text");
  await user.hover(within(await openMenu(user)).getByRole("menuitem", { name: "Table" }));
  const grid = await screen.findByRole("grid", { name: "Table size" });
  expect(grid.parentElement?.parentElement?.querySelector('[role="status"]')?.textContent).toBe(
    "5 columns, 2 rows"
  );
});

async function openDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(within(await openMenu(user)).getByRole("menuitem", { name: "Insert table…" }));
  return screen.findByRole("dialog", { name: "Insert table" });
}

test("Insert table… opens a dialog on the last size; Enter in a field inserts up to 20x50", async () => {
  const user = userEvent.setup();
  const { editor, handle } = renderEditor({ defaultValue: "<p>Text</p>" });
  caretIn(editor, "Text");

  const dialog = await openDialog(user);
  const columns = within(dialog).getByRole("textbox", { name: "Columns" });
  const rows = within(dialog).getByRole("textbox", { name: "Rows" });
  expect([columns, rows].map((field) => (field as HTMLInputElement).value)).toEqual(["3", "3"]);
  await waitFor(() => expect(document.activeElement).toBe(columns));

  // Сверх предела поле прижимается к нему: 99 столбцов — это 20.
  await user.clear(columns);
  await user.type(columns, "99");
  await user.clear(rows);
  await user.type(rows, "50{Enter}");

  expect(sizeOf(handle.getHTML())).toEqual({ cols: 20, rows: 50 });
  expect(screen.queryByRole("dialog")).toBeNull();
  await waitFor(() => expect(document.activeElement).toBe(textbox()));
  expect(editor.isActive("tableHeader")).toBe(true);

  // Размер из окна запоминается так же, как из сетки.
  caretIn(editor, "Text");
  const again = await openDialog(user);
  expect((within(again).getByRole("textbox", { name: "Columns" }) as HTMLInputElement).value).toBe(
    "20"
  );
});

test("Cancel closes the dialog without a table and returns focus to the document", async () => {
  const user = userEvent.setup();
  const { editor, handle } = renderEditor({ defaultValue: "<p>Text</p>" });
  caretIn(editor, "Text");

  const dialog = await openDialog(user);
  await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

  expect(handle.getHTML()).toBe("<p>Text</p>");
  await waitFor(() => expect(document.activeElement).toBe(textbox()));
});

test("the insert menu item /table still inserts 3x3 immediately, whatever was picked before", async () => {
  const user = userEvent.setup();
  const { editor, handle } = renderEditor({ defaultValue: "<p>Text</p>" });
  caretIn(editor, "Text");
  await user.hover(within(await openMenu(user)).getByRole("menuitem", { name: "Table" }));
  await user.click(await screen.findByRole("gridcell", { name: "5 columns, 2 rows" }));

  act(() => void editor.commands.setContent("<p>Next</p>"));
  caretIn(editor, "Next");
  act(() => void editor.commands.insertContent(" /table"));
  act(() => {
    editor.view.dom.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true })
    );
  });

  expect(sizeOf(handle.getHTML())).toEqual({ cols: 3, rows: 3 });
});

const cells = (editor: Editor) =>
  Array.from(editor.view.dom.querySelectorAll("tr")).map((tr) =>
    Array.from(tr.children).map((cell) => cell.textContent)
  );

/** Пункт подменю выбирается мышью: наведение на пункт первого уровня, щелчок в подменю. */
async function choose(user: ReturnType<typeof userEvent.setup>, submenu: string, name: string) {
  const menu = await openMenu(user);
  await user.hover(within(menu).getByRole("menuitem", { name: submenu }));
  const sub = await screen.findByRole("menu", { name: submenu });
  const item = within(sub).getByText(name).closest('[role^="menuitem"]');
  if (!(item instanceof HTMLElement)) throw new Error(`no item "${name}" in ${submenu}`);
  await user.click(item);
}

test("Insert row below shows its shortcut Alt+↓", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: TABLE });
  caretIn(editor, "a2");

  const menu = await openMenu(user);
  await user.hover(within(menu).getByRole("menuitem", { name: "Row" }));
  const row = await screen.findByRole("menu", { name: "Row" });
  const below = within(row).getByRole("menuitem", { name: /Insert row below/ });

  expect(below.querySelector("kbd")?.textContent).toBe("Alt+↓");
  // Сочетание есть только у этой строки: у «выше» и столбцов его нет.
  expect(row.querySelectorAll("kbd")).toHaveLength(1);
});

test("Row: insert above, insert below and delete act on the row under the caret", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: TABLE });
  caretIn(editor, "a2");

  await choose(user, "Row", "Insert row above");
  expect(cells(editor)).toEqual([
    ["h1", "h2"],
    ["", ""],
    ["a1", "a2"],
    ["b1", "b2"],
  ]);

  caretIn(editor, "a2");
  await choose(user, "Row", "Insert row below");
  expect(cells(editor)).toEqual([
    ["h1", "h2"],
    ["", ""],
    ["a1", "a2"],
    ["", ""],
    ["b1", "b2"],
  ]);

  caretIn(editor, "a2");
  await choose(user, "Row", "Delete row");
  expect(cells(editor)).toEqual([
    ["h1", "h2"],
    ["", ""],
    ["", ""],
    ["b1", "b2"],
  ]);
});

test("Column: insert left, insert right and delete act on the column under the caret", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: TABLE });
  caretIn(editor, "a2");

  await choose(user, "Column", "Insert column left");
  expect(cells(editor)).toEqual([
    ["h1", "", "h2"],
    ["a1", "", "a2"],
    ["b1", "", "b2"],
  ]);

  caretIn(editor, "a2");
  await choose(user, "Column", "Insert column right");
  expect(cells(editor)).toEqual([
    ["h1", "", "h2", ""],
    ["a1", "", "a2", ""],
    ["b1", "", "b2", ""],
  ]);

  caretIn(editor, "a2");
  await choose(user, "Column", "Delete column");
  expect(cells(editor)).toEqual([
    ["h1", "", ""],
    ["a1", "", ""],
    ["b1", "", ""],
  ]);
});

test("Header row is a checked toggle in the Row submenu: th becomes td and back", async () => {
  const user = userEvent.setup();
  const { editor, handle } = renderEditor({ defaultValue: TABLE });
  caretIn(editor, "b1");

  const menu = await openMenu(user);
  await user.hover(within(menu).getByRole("menuitem", { name: "Row" }));
  const toggle = await screen.findByRole("menuitemcheckbox", { name: "Header row" });
  expect(toggle.getAttribute("aria-checked")).toBe("true");
  await user.click(toggle);
  expect(handle.getHTML()).not.toContain("<th>");

  caretIn(editor, "b1");
  await choose(user, "Row", "Header row");
  expect(handle.getHTML()).toContain("<th><p>h1</p></th>");
});

test("Delete table removes it and keeps the rest; the caret stays in the document", async () => {
  const user = userEvent.setup();
  const { editor, handle } = renderEditor({ defaultValue: `<p>Before</p>${TABLE}<p>After</p>` });
  caretIn(editor, "a2");

  await user.click(within(await openMenu(user)).getByRole("menuitem", { name: "Delete table" }));

  expect(handle.getHTML()).toBe("<p>Before</p><p>After</p>");
  await waitFor(() => expect(document.activeElement).toBe(textbox()));
});

test("an action keeps the caret in the document: typing continues there", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: TABLE });
  caretIn(editor, "a2");

  await choose(user, "Row", "Insert row below");

  await waitFor(() => expect(document.activeElement).toBe(textbox()));
  expect(editor.state.selection.$from.parent.textContent).toBe("a2");
});

test("submenus from the keyboard: → opens and focuses the first item, ← closes back to the parent", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: TABLE });
  caretIn(editor, "a2");

  act(() => tableButton().focus());
  // Таблица › — Вставить таблицу… — Ячейка — Строка.
  await user.keyboard("{Enter}{ArrowDown}{ArrowDown}{ArrowDown}");
  expect(document.activeElement?.textContent).toBe("Row");
  await user.keyboard("{ArrowRight}");
  const sub = screen.getByRole("menu", { name: "Row" });
  expect(document.activeElement?.closest('[role="menu"]')).toBe(sub);
  expect(document.activeElement?.textContent).toBe("Insert row above");

  await user.keyboard("{ArrowLeft}");
  expect(screen.queryByRole("menu", { name: "Row" })).toBeNull();
  expect(document.activeElement?.textContent).toBe("Row");

  await user.keyboard("{ArrowRight}{ArrowDown}{Enter}");
  expect(cells(editor)).toHaveLength(4);
  expect(cells(editor)[2]).toEqual(["", ""]);
});

test("Escape closes one level at a time and leaves the table as it was", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: TABLE });
  caretIn(editor, "a2");

  act(() => tableButton().focus());
  await user.keyboard("{Enter}{ArrowDown}{ArrowDown}{ArrowDown}{ArrowRight}");
  expect(screen.getByRole("menu", { name: "Row" })).toBeDefined();

  await user.keyboard("{Escape}");
  expect(screen.queryByRole("menu", { name: "Row" })).toBeNull();
  expect(screen.getByRole("menu", { name: "Table" })).toBeDefined();
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("menu")).toBeNull();
  expect(cells(editor)).toHaveLength(3);
});

test("the only row and the only column cannot be deleted; the submenus say so", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({
    defaultValue: "<table><tbody><tr><td><p>solo</p></td></tr></tbody></table>",
  });
  caretIn(editor, "solo");

  const menu = await openMenu(user);
  await user.hover(within(menu).getByRole("menuitem", { name: "Row" }));
  const row = await screen.findByRole("menu", { name: "Row" });
  expect(
    within(row).getByRole("menuitem", { name: "Delete row" }).getAttribute("aria-disabled")
  ).toBe("true");
  await user.hover(within(menu).getByRole("menuitem", { name: "Column" }));
  const column = await screen.findByRole("menu", { name: "Column" });
  expect(
    within(column).getByRole("menuitem", { name: "Delete column" }).getAttribute("aria-disabled")
  ).toBe("true");
  expect(
    within(menu).getByRole("menuitem", { name: "Delete table" }).hasAttribute("aria-disabled")
  ).toBe(false);
});

/** Позиция ячейки (перед ней) с этим текстом — для выделения поперёк ячеек. */
function cellPos(editor: Editor, text: string): number {
  let found = -1;
  editor.state.doc.descendants((node, pos) => {
    if (found >= 0) return false;
    if (node.type.spec.tableRole?.endsWith("cell") && node.textContent === text) found = pos;
    return true;
  });
  if (found < 0) throw new Error(`no cell "${text}"`);
  return found;
}

function selectCells(editor: Editor, from: string, to: string) {
  act(
    () =>
      void editor.commands.setCellSelection({
        anchorCell: cellPos(editor, from),
        headCell: cellPos(editor, to),
      })
  );
}

async function submenuItems(user: ReturnType<typeof userEvent.setup>, submenu: string) {
  const menu = await openMenu(user);
  await user.hover(within(menu).getByRole("menuitem", { name: submenu }));
  const sub = await screen.findByRole("menu", { name: submenu });
  return Object.fromEntries(
    Array.from(sub.querySelectorAll('[role^="menuitem"]')).map((item) => [
      item.textContent,
      item.getAttribute("aria-disabled") === "true" ? "disabled" : "enabled",
    ])
  );
}

test("Merge cells needs several selected cells; Split cell needs a merged one", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: TABLE });
  caretIn(editor, "a1");

  expect(await submenuItems(user, "Cell")).toEqual({
    "Merge cells": "disabled",
    "Split cell": "disabled",
  });
  await user.keyboard("{Escape}{Escape}");

  selectCells(editor, "a1", "b2");
  expect(await submenuItems(user, "Cell")).toEqual({
    "Merge cells": "enabled",
    "Split cell": "disabled",
  });
});

test("merging writes colspan and rowspan that survive save and load; split takes them away", async () => {
  const user = userEvent.setup();
  const { editor, handle } = renderEditor({ defaultValue: TABLE });

  selectCells(editor, "a1", "b2");
  await choose(user, "Cell", "Merge cells");

  // Строка, целиком накрытая слиянием сверху, остаётся пустой `<tr>`: так
  // таблица помнит свою высоту, и `rowspan="2"` есть куда растянуть.
  const saved = handle.getHTML();
  expect(saved).toBe(
    "<table><tbody>" +
      "<tr><th><p>h1</p></th><th><p>h2</p></th></tr>" +
      '<tr><td colspan="2" rowspan="2"><p>a1</p><p>a2</p><p>b1</p><p>b2</p></td></tr>' +
      "<tr></tr>" +
      "</tbody></table>"
  );

  cleanup();
  const reloaded = renderEditor({ defaultValue: saved });
  expect(reloaded.handle.getHTML()).toBe(saved);

  caretIn(reloaded.editor, "b2");
  expect(await submenuItems(user, "Cell")).toEqual({
    "Merge cells": "disabled",
    "Split cell": "enabled",
  });
  await user.click(screen.getByRole("menuitem", { name: "Split cell" }));
  expect(reloaded.handle.getHTML()).not.toMatch(/colspan|rowspan/);
  expect(cells(reloaded.editor).map((row) => row.length)).toEqual([2, 2, 2]);
});

test("column alignment writes data-align on every cell of the column; the radio shows it", async () => {
  const user = userEvent.setup();
  const { editor, handle } = renderEditor({ defaultValue: TABLE });
  caretIn(editor, "a2");

  await choose(user, "Column", "Align column center");

  expect(handle.getHTML()).toBe(
    "<table><tbody>" +
      '<tr><th><p>h1</p></th><th data-align="center"><p>h2</p></th></tr>' +
      '<tr><td><p>a1</p></td><td data-align="center"><p>a2</p></td></tr>' +
      '<tr><td><p>b1</p></td><td data-align="center"><p>b2</p></td></tr>' +
      "</tbody></table>"
  );

  caretIn(editor, "b2");
  const menu = await openMenu(user);
  await user.hover(within(menu).getByRole("menuitem", { name: "Column" }));
  const column = await screen.findByRole("menu", { name: "Column" });
  const radios = within(column).getAllByRole("menuitemradio");
  expect(radios.map((radio) => [radio.textContent, radio.getAttribute("aria-checked")])).toEqual([
    ["Align column left", "false"],
    ["Align column center", "true"],
    ["Align column right", "false"],
  ]);

  // «По левому краю» — умолчание: атрибут снимается.
  await user.click(radios[0]!);
  expect(handle.getHTML()).not.toContain("data-align");
});

test("a column with mixed alignment checks no radio", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({
    defaultValue:
      "<table><tbody>" +
      '<tr><td data-align="right"><p>a</p></td></tr><tr><td><p>b</p></td></tr>' +
      "</tbody></table>",
  });
  caretIn(editor, "b");

  const menu = await openMenu(user);
  await user.hover(within(menu).getByRole("menuitem", { name: "Column" }));
  const column = await screen.findByRole("menu", { name: "Column" });
  expect(
    within(column)
      .getAllByRole("menuitemradio")
      .map((radio) => radio.getAttribute("aria-checked"))
  ).toEqual(["false", "false", "false"]);
});

test("column alignment round-trips through Markdown as GFM :---: and ---:", () => {
  const { handle } = renderEditor({
    defaultValue:
      "<table><tbody>" +
      '<tr><th><p>Name</p></th><th data-align="center"><p>Qty</p></th><th data-align="right"><p>Sum</p></th></tr>' +
      '<tr><td><p>apple</p></td><td data-align="center"><p>2</p></td><td data-align="right"><p>10</p></td></tr>' +
      "</tbody></table>",
  });
  const html = handle.getHTML();

  const markdown = handle.getMarkdown();
  expect(markdown.split("\n")[1]).toBe("| ----- | :---: | ---: |");

  act(() => handle.setMarkdown(markdown));
  expect(handle.getHTML()).toBe(html);
});

test("pasted GFM alignment becomes column alignment; :--- is the default and writes nothing", () => {
  const { editor, handle } = renderEditor();
  // Обычный текст буфера, как в `rich-text-editor-markdown.test.tsx`: в jsdom
  // нет `DataTransfer`, поэтому буфер — объектом.
  const text = "| a | b | c |\n| :--- | :---: | ---: |\n| 1 | 2 | 3 |";
  const event = new Event("paste", { bubbles: true, cancelable: true });
  Object.assign(event, {
    clipboardData: {
      getData: (type: string) => (type === "text/plain" ? text : ""),
      types: ["text/plain"],
    },
  });
  act(() => void editor.view.dom.dispatchEvent(event));

  expect(handle.getHTML()).toBe(
    "<table><tbody>" +
      '<tr><th><p>a</p></th><th data-align="center"><p>b</p></th><th data-align="right"><p>c</p></th></tr>' +
      '<tr><td><p>1</p></td><td data-align="center"><p>2</p></td><td data-align="right"><p>3</p></td></tr>' +
      "</tbody></table>"
  );
});

test("getMarkdown degrades merged cells: the content stays in the top-left place, the merge is lost", () => {
  const { handle } = renderEditor({
    defaultValue:
      "<table><tbody>" +
      "<tr><th><p>h1</p></th><th><p>h2</p></th><th><p>h3</p></th></tr>" +
      '<tr><td rowspan="2"><p>tall</p></td><td colspan="2"><p>wide</p></td></tr>' +
      "<tr><td><p>x</p></td><td><p>y</p></td></tr>" +
      "</tbody></table>",
  });

  expect(handle.getMarkdown()).toBe(
    [
      "| h1   | h2   | h3  |",
      "| ---- | ---- | --- |",
      "| tall | wide |     |",
      "|      | x    | y   |",
    ].join("\n")
  );
});

/** Таблица со строкой-заголовком и одним столбцом значений. */
const column = (header: string, values: readonly string[]) =>
  "<table><tbody>" +
  `<tr><th><p>${header}</p></th></tr>` +
  values.map((value) => `<tr><td><p>${value}</p></td></tr>`).join("") +
  "</tbody></table>";

/** Значения столбца сверху вниз, без строки-заголовка. */
const columnValues = (editor: Editor) => cells(editor).map((row) => row[0]);

test("Sort ascending and descending: numbers compare as numbers, the header row stays first", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({
    defaultValue: column("Amount", ["1,200", "15", "3.5", "-2", "1,000.25"]),
  });
  caretIn(editor, "15");

  await choose(user, "Sort", "Sort ascending");
  expect(columnValues(editor)).toEqual(["Amount", "-2", "3.5", "15", "1,000.25", "1,200"]);

  caretIn(editor, "15");
  await choose(user, "Sort", "Sort descending");
  expect(columnValues(editor)).toEqual(["Amount", "1,200", "1,000.25", "15", "3.5", "-2"]);
  // Каретка уехала вместе со своей строкой.
  expect(editor.state.selection.$from.parent.textContent).toBe("15");
});

test("ISO and dd.mm.yyyy dates compare as dates", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({
    defaultValue: column("Date", ["2026-01-15", "31.12.2025", "2026-01-02 09:30", "02.01.2026"]),
  });
  caretIn(editor, "31.12.2025");

  await choose(user, "Sort", "Sort ascending");

  expect(columnValues(editor)).toEqual([
    "Date",
    "31.12.2025",
    "02.01.2026",
    "2026-01-02 09:30",
    "2026-01-15",
  ]);
});

test("text compares by the UI locale with numeric parts: ё in its place, item 2 before item 10", async () => {
  const user = userEvent.setup();
  const ref = createRef<RichTextEditorHandle>();
  render(
    <UiProvider locale="ru-RU" messages={ru}>
      <RichTextEditor
        ref={ref}
        aria-label="Body"
        defaultValue={column("Имя", ["яблоко", "Елка", "арбуз", "ёж", "пункт 10", "пункт 2"])}
      />
    </UiProvider>
  );
  const editor = ref.current!.editor!;
  caretIn(editor, "арбуз");

  await user.click(screen.getByRole("button", { name: ru.editor.table }));
  await user.hover(screen.getByRole("menuitem", { name: ru.editor.tableSort }));
  await user.click(await screen.findByRole("menuitem", { name: ru.editor.tableSortAscending }));

  // По кодам символов «Е» встала бы первой, а «ё» — после «я».
  expect(columnValues(editor)).toEqual([
    "Имя",
    "арбуз",
    "ёж",
    "Елка",
    "пункт 2",
    "пункт 10",
    "яблоко",
  ]);
});

test("Russian number formats: a space for thousands and a comma for decimals", async () => {
  const user = userEvent.setup();
  const ref = createRef<RichTextEditorHandle>();
  render(
    <UiProvider locale="ru-RU" messages={ru}>
      <RichTextEditor
        ref={ref}
        aria-label="Body"
        defaultValue={column("Сумма", ["1\u00a0234,5", "99,9", "1 000", "1,5"])}
      />
    </UiProvider>
  );
  const editor = ref.current!.editor!;
  caretIn(editor, "99,9");

  await user.click(screen.getByRole("button", { name: ru.editor.table }));
  await user.hover(screen.getByRole("menuitem", { name: ru.editor.tableSort }));
  await user.click(await screen.findByRole("menuitem", { name: ru.editor.tableSortAscending }));

  expect(columnValues(editor)).toEqual(["Сумма", "1,5", "99,9", "1 000", "1\u00a0234,5"]);
});

test("empty cells go last in both directions, and equal values keep their order", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({
    defaultValue:
      "<table><tbody>" +
      "<tr><th><p>Key</p></th><th><p>Id</p></th></tr>" +
      ["b|1", "|2", "a|3", "b|4", "a|5"]
        .map((pair) => pair.split("|"))
        .map(([key, id]) => `<tr><td><p>${key}</p></td><td><p>${id}</p></td></tr>`)
        .join("") +
      "</tbody></table>",
  });
  caretIn(editor, "a");

  await choose(user, "Sort", "Sort ascending");
  expect(cells(editor).slice(1)).toEqual([
    ["a", "3"],
    ["a", "5"],
    ["b", "1"],
    ["b", "4"],
    ["", "2"],
  ]);

  caretIn(editor, "a");
  await choose(user, "Sort", "Sort descending");
  expect(cells(editor).slice(1)).toEqual([
    ["b", "1"],
    ["b", "4"],
    ["a", "3"],
    ["a", "5"],
    ["", "2"],
  ]);
});

test("a sort is one undo step", async () => {
  const user = userEvent.setup();
  const { editor, handle } = renderEditor({ defaultValue: column("N", ["3", "1", "2"]) });
  const before = handle.getHTML();
  caretIn(editor, "3");

  await choose(user, "Sort", "Sort ascending");
  expect(columnValues(editor)).toEqual(["N", "1", "2", "3"]);

  act(() => void editor.commands.undo());
  expect(handle.getHTML()).toBe(before);
});

test("a table without a header row sorts every row", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({
    defaultValue:
      "<table><tbody><tr><td><p>b</p></td></tr><tr><td><p>a</p></td></tr></tbody></table>",
  });
  caretIn(editor, "b");

  await choose(user, "Sort", "Sort ascending");

  expect(columnValues(editor)).toEqual(["a", "b"]);
});

test("with merged cells sorting is unavailable, and the submenu says why", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({
    defaultValue:
      "<table><tbody>" +
      '<tr><td colspan="2"><p>wide</p></td></tr><tr><td><p>b</p></td><td><p>a</p></td></tr>' +
      "<tr><td><p>c</p></td><td><p>d</p></td></tr>" +
      "</tbody></table>",
  });
  caretIn(editor, "b");

  expect(await submenuItems(user, "Sort")).toEqual({
    "Sort ascending": "disabled",
    "Sort descending": "disabled",
  });
  const sort = screen.getByRole("menu", { name: "Sort" });
  expect(within(sort).getByRole("group").getAttribute("aria-labelledby")).toBeTruthy();
  expect(sort.textContent).toContain("Unavailable: the table has merged cells");
});

/**
 * Escape — слой за слоем (ADR-0041): сетка, потом меню, и только потом слой
 * вокруг поля.
 *
 * Слой — `ModalOverlay`, а не `Dialog`: меню react-aria внутри окна Radix в
 * jsdom не раскрывается — ловушка фокуса Radix возвращает фокус (разбор в
 * `rich-text-editor-toolbar.test.tsx`). Подложка спрашивает тот же предикат
 * чужого слоя, что и `Dialog`; сочетание с настоящим `Dialog` проверяет
 * браузер — `tests-visual/rich-text-editor-table-menu.spec.ts`.
 */
test("inside a modal layer, Escape closes the grid, then the menu, and only then the layer", async () => {
  const user = userEvent.setup();
  const onClose = vi.fn();
  const ref = createRef<RichTextEditorHandle>();
  render(
    <ModalOverlay onClose={onClose}>
      <RichTextEditor ref={ref} aria-label="Body" defaultValue="<p>Text</p>" />
    </ModalOverlay>
  );
  caretIn(ref.current!.editor!, "Text");

  act(() => tableButton().focus());
  await user.keyboard("{Enter}{ArrowRight}");
  const grid = await screen.findByRole("grid", { name: "Table size" });
  await waitFor(() => expect(document.activeElement).toBe(grid));

  await user.keyboard("{Escape}");
  expect(screen.queryByRole("grid")).toBeNull();
  expect(screen.getByRole("menu", { name: "Table" })).toBeDefined();
  expect(onClose).not.toHaveBeenCalled();

  await user.keyboard("{Escape}");
  expect(screen.queryByRole("menu")).toBeNull();
  expect(onClose).not.toHaveBeenCalled();

  // Контроль: без открытого меню тот же Escape закрывает слой.
  await user.keyboard("{Escape}");
  expect(onClose).toHaveBeenCalledTimes(1);
});
