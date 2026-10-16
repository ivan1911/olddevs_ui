// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import type { Editor } from "@tiptap/react";
import { NodeSelection } from "@tiptap/pm/state";
import createDOMPurify from "dompurify";
import { createRef } from "react";
import { afterEach, beforeAll, expect, test } from "vitest";
import {
  RichTextEditor,
  RichTextView,
  type RichTextEditorHandle,
  type RichTextEditorProps,
} from "../src/editor/index.js";
import { RICH_TEXT_SCHEMA, sanitizeRichText } from "../src/editor/schema-entry.js";
import { TOOLS } from "../src/editor/core/tools.js";
import { loadLazyBuiltins } from "./editor-lazy-builtins.js";

// Ленивые `codeBlock` и `table` (OLDSUI-111): `full` готов в `render` после загрузки чанков.
beforeAll(loadLazyBuiltins);

afterEach(cleanup);

/**
 * Раскладка — Блок из колонок (OLDSUI-74).
 *
 * Через публичный `RichTextEditor`, как остальные тесты Редактора: вставка —
 * Меню вставки, клавиши — настоящие `keydown`, результат — выходной HTML,
 * Markdown и шаг отмены. Каретка ставится командами движка: jsdom не умеет
 * ввода в `contenteditable`. Подключение к меню ручки Блока — отдельно.
 */
function renderEditor(props: Partial<RichTextEditorProps> = {}) {
  const ref = createRef<RichTextEditorHandle>();
  const view = render(<RichTextEditor ref={ref} aria-label="Body" {...props} />);
  const editor = ref.current?.editor;
  if (!editor) throw new Error("the editor was not created inside render()");
  return { ...view, editor, handle: ref.current! };
}

function focusField() {
  act(() => screen.getByRole("textbox", { name: "Body" }).focus());
}

function type(editor: Editor, text: string) {
  act(() => void editor.commands.insertContent(text));
}

/** `keydown` на документе; `true` — Редактор отпустил клавишу браузеру. */
function press(editor: Editor, key: string, init: KeyboardEventInit = {}) {
  const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init });
  act(() => void editor.view.dom.dispatchEvent(event));
  return !event.defaultPrevented;
}

/** Каретка — в конец текста `text` (или в его начало). */
function caretIn(editor: Editor, text: string, at: "end" | "start" = "end") {
  let found = -1;
  editor.state.doc.descendants((node, pos) => {
    if (found < 0 && node.isText && node.text === text) {
      found = at === "end" ? pos + node.nodeSize : pos;
    }
  });
  if (found < 0) throw new Error(`no text "${text}" in the document`);
  act(() => void editor.commands.setTextSelection(found));
}

/** Текст Блока, в котором стоит каретка. */
const here = (editor: Editor) => editor.state.selection.$from.parent.textContent;

const column = (...blocks: string[]) => `<div data-block="column">${blocks.join("")}</div>`;
const layout = (variant: string, ...columns: string[]) =>
  `<div data-block="layout" data-layout="${variant}">${columns.join("")}</div>`;

const TWO = layout("50-50", column("<p>Left</p>"), column("<p>Right</p>"));

// ── Схема ────────────────────────────────────────────────────────────────

test("a layout survives a round trip in every variant, with no style", () => {
  for (const [variant, count] of [
    ["100", 1],
    ["50-50", 2],
    ["33-33-33", 3],
    ["25-25-25-25", 4],
    ["60-40", 2],
    ["40-60", 2],
  ] as const) {
    const columns = Array.from({ length: count }, (_, i) => column(`<p>c${i}</p>`));
    const html = layout(variant, ...columns);
    const { editor, unmount } = renderEditor({ defaultValue: html });
    expect(editor.getHTML()).toBe(html);
    unmount();
  }
});

test("flex-basis widths from a foreign editor become the nearest variant, style is dropped", () => {
  const foreign =
    '<div data-block="layout"><div data-block="column" style="flex-basis: 60%;"><p>a</p></div>' +
    '<div data-block="column" style="flex-basis: 40%;"><p>b</p></div></div>' +
    '<div data-block="layout"><div data-block="column" style="flex-basis: 50%;"><p>c</p></div>' +
    '<div data-block="column" style="flex-basis: 50%;"><p>d</p></div></div>' +
    '<div data-block="layout"><div data-block="column" style="flex-basis: 38%;"><p>e</p></div>' +
    '<div data-block="column" style="flex-basis: 62%;"><p>f</p></div></div>' +
    '<div data-block="layout">' +
    '<div data-block="column" style="flex-basis: 33.33%;"><p>g</p></div>'.repeat(3) +
    "</div>";
  const { editor } = renderEditor({ defaultValue: foreign });

  expect(editor.getHTML()).toBe(
    layout("60-40", column("<p>a</p>"), column("<p>b</p>")) +
      layout("50-50", column("<p>c</p>"), column("<p>d</p>")) +
      layout("40-60", column("<p>e</p>"), column("<p>f</p>")) +
      layout("33-33-33", column("<p>g</p>"), column("<p>g</p>"), column("<p>g</p>"))
  );
});

test("the variant follows the number of columns when they disagree", () => {
  const { editor } = renderEditor({
    defaultValue:
      layout("50-50", column("<p>a</p>"), column("<p>b</p>"), column("<p>c</p>")) +
      layout("25-25-25-25", column("<p>d</p>")) +
      // Колонка без Раскладки получает Раскладку из одной колонки.
      column("<p>e</p>"),
  });

  expect(editor.getHTML()).toBe(
    layout("33-33-33", column("<p>a</p>"), column("<p>b</p>"), column("<p>c</p>")) +
      layout("100", column("<p>d</p>")) +
      layout("100", column("<p>e</p>"))
  );
});

test("a layout inside a column, list, quote or cell unfolds into its blocks", () => {
  const nested = layout("50-50", column("<p>x</p>"), column("<p>y</p>"));
  const { editor } = renderEditor({
    defaultValue:
      layout("50-50", column("<p>a</p>", nested), column("<p>b</p>")) +
      `<blockquote>${nested}</blockquote>` +
      `<ul><li>${nested}</li></ul>`,
  });

  expect(editor.getHTML()).toBe(
    layout("50-50", column("<p>a</p><p>x</p><p>y</p>"), column("<p>b</p>")) +
      "<blockquote><p>x</p><p>y</p></blockquote>" +
      "<ul><li><p>x</p><p>y</p></li></ul>"
  );
});

test("without the layout tool a layout unfolds into blocks in a row", () => {
  const { editor } = renderEditor({
    defaultValue: TWO,
    tools: TOOLS.filter((tool) => tool !== "layout"),
  });
  expect(editor.getHTML()).toBe("<p>Left</p><p>Right</p>");
});

test("the basic preset has no layout", () => {
  const { editor } = renderEditor({ preset: "basic", defaultValue: TWO });
  expect(editor.getHTML()).toBe("<p>Left</p><p>Right</p>");
});

test("the schema data and the sanitiser know the layout", () => {
  expect(RICH_TEXT_SCHEMA.attributes.div).toEqual([
    "data-block",
    "data-layout",
    "data-tone",
    "data-type",
    "data-provider",
    "data-src",
  ]);
  expect([...RICH_TEXT_SCHEMA.layouts]).toEqual([
    "100",
    "50-50",
    "33-33-33",
    "25-25-25-25",
    "60-40",
    "40-60",
  ]);

  const purify = createDOMPurify(window);
  const saved = renderEditor({ defaultValue: TWO }).editor.getHTML();
  expect(sanitizeRichText(saved, purify)).toBe(saved);

  for (const [input, output] of [
    // Чужой вариант, `style` и обработчики снимаются; без варианта Раскладки нет.
    [
      '<div data-block="layout" data-layout="70-30" style="display:flex" onclick="x()">' +
        '<div data-block="column" style="flex-basis:70%"><p>a</p></div></div>',
      "<p>a</p>",
    ],
    // Колонка — только прямо в Раскладке.
    ['<div data-block="column"><p>a</p></div>', "<p>a</p>"],
    // Раскладка в Раскладке, в списке и в цитате — Блоками подряд.
    [
      layout("50-50", column(layout("50-50", column("<p>x</p>"))), column("<p>b</p>")),
      layout("50-50", column("<p>x</p>"), column("<p>b</p>")),
    ],
    [`<blockquote>${TWO}</blockquote>`, "<blockquote><p>Left</p><p>Right</p></blockquote>"],
    // Вариант — только у Раскладки, `data-block` — только у `div`.
    ['<p data-layout="50-50" data-block="layout">a</p>', "<p>a</p>"],
    ['<div data-layout="50-50"><p>a</p></div>', "<p>a</p>"],
  ] as [string, string][]) {
    expect(sanitizeRichText(input, purify), input).toBe(output);
  }
});

/** Вставка HTML из буфера: разбор Схемой и транзакция с меткой `paste`. */
function paste(editor: Editor, html: string) {
  act(() => void editor.view.pasteHTML(html, new Event("paste") as ClipboardEvent));
}

test("pasted layout HTML from the owner's sample becomes a layout at the top level", () => {
  const { editor } = renderEditor({ defaultValue: "<p>Intro</p>" });
  caretIn(editor, "Intro");
  paste(
    editor,
    '<div data-block="layout"><div data-block="column" style="flex-basis: 40%;"><p>a</p></div>' +
      '<div data-block="column" style="flex-basis: 60%;"><p>b</p></div></div>'
  );
  expect(editor.getHTML()).toBe(
    "<p>Intro</p>" + layout("40-60", column("<p>a</p>"), column("<p>b</p>"))
  );
});

test("a layout pasted into a column unfolds into its blocks and keeps the column whole", () => {
  const { editor } = renderEditor({ defaultValue: TWO });
  caretIn(editor, "Left");
  paste(editor, layout("50-50", column("<p>x</p>"), column("<p>y</p>")));

  // Первый абзац вставки продолжает строку, как у любой вставки текста.
  expect(editor.getHTML()).toBe(
    layout("50-50", column("<p>Leftx</p><p>y</p>"), column("<p>Right</p>"))
  );
});

// ── Вставка ──────────────────────────────────────────────────────────────

test("the Layout item of the insert menu adds two columns, caret in the first", () => {
  const { editor } = renderEditor({ defaultValue: "<p>Intro</p>" });
  focusField();
  act(() => void editor.commands.setTextSelection(6));

  type(editor, " /layout");
  press(editor, "Enter");

  expect(editor.getHTML()).toBe(
    "<p>Intro </p>" + layout("50-50", column("<p></p>"), column("<p></p>"))
  );
  expect(editor.state.selection.$from.node(-2).type.name).toBe("layout");
  expect(editor.state.selection.$from.index(-2)).toBe(0);

  type(editor, "Typed");
  expect(editor.getHTML()).toContain(column("<p>Typed</p>"));
});

test("the Layout item of the toolbar insert menu is one undo step", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: "<p>Intro</p>" });
  act(() => void editor.commands.setTextSelection(3));

  await user.click(screen.getByRole("button", { name: "Insert block" }));
  await user.click(screen.getByRole("menuitem", { name: "Layout" }));
  expect(editor.getHTML()).toBe(
    "<p>Intro</p>" + layout("50-50", column("<p></p>"), column("<p></p>"))
  );

  act(() => void editor.commands.undo());
  expect(editor.getHTML()).toBe("<p>Intro</p>");
});

test("from inside a column a new layout goes below the current one, not into it", () => {
  const { editor } = renderEditor({ defaultValue: TWO });
  focusField();
  caretIn(editor, "Right");

  type(editor, " /layout");
  press(editor, "Enter");

  expect(editor.getHTML()).toBe(
    layout("50-50", column("<p>Left</p>"), column("<p>Right </p>")) +
      layout("50-50", column("<p></p>"), column("<p></p>"))
  );
  expect(editor.state.selection.$from.node(-2).type.name).toBe("layout");
});

test("a slash typed in an empty line of a column leaves no empty line behind", () => {
  const { editor } = renderEditor({
    defaultValue: layout("50-50", column("<p>Left</p>", "<p></p>"), column("<p>Right</p>")),
  });
  focusField();
  // Пустой абзац левой колонки: сразу за «Left».
  caretIn(editor, "Left");
  act(() => void editor.commands.setTextSelection(editor.state.selection.from + 2));
  expect(here(editor)).toBe("");

  type(editor, "/layout");
  press(editor, "Enter");

  expect(editor.getHTML()).toBe(TWO + layout("50-50", column("<p></p>"), column("<p></p>")));
});

test("other blocks from the insert menu stay inside the column", () => {
  const { editor } = renderEditor({ defaultValue: TWO });
  focusField();
  caretIn(editor, "Left");

  type(editor, " /divider");
  press(editor, "Enter");

  expect(editor.getHTML()).toBe(
    layout("50-50", column("<p>Left </p>", "<hr>", "<p></p>"), column("<p>Right</p>"))
  );
});

test("the insert menu has no Layout without the layout tool", () => {
  const { editor } = renderEditor({ tools: TOOLS.filter((tool) => tool !== "layout") });
  focusField();
  type(editor, "/layout");
  expect(screen.queryByRole("option", { name: /Layout/ })).toBeNull();
});

// ── Смена варианта ───────────────────────────────────────────────────────

const THREE = layout(
  "33-33-33",
  column("<p>One</p>"),
  column("<p>Two</p>", "<p>Two more</p>"),
  column("<p>Three</p>")
);

test("fewer columns merge the extra ones into the last that stays, nothing is lost", () => {
  const { editor } = renderEditor({ defaultValue: THREE });
  caretIn(editor, "Three");

  act(() => void editor.commands.setLayout("60-40"));

  expect(editor.getHTML()).toBe(
    layout("60-40", column("<p>One</p>"), column("<p>Two</p><p>Two more</p><p>Three</p>"))
  );
  // Каретка уехала вместе со своим текстом.
  expect(here(editor)).toBe("Three");

  act(() => void editor.commands.setLayout("100"));
  expect(editor.getHTML()).toBe(
    layout("100", column("<p>One</p><p>Two</p><p>Two more</p><p>Three</p>"))
  );
});

test("empty extra columns go away instead of leaving empty lines", () => {
  const { editor } = renderEditor({
    defaultValue: layout(
      "25-25-25-25",
      column("<p>One</p>"),
      column("<p></p>"),
      column("<p>Three</p>"),
      column("<p></p>")
    ),
  });
  caretIn(editor, "One");
  act(() => void editor.commands.setLayout("50-50"));
  expect(editor.getHTML()).toBe(layout("50-50", column("<p>One</p>"), column("<p>Three</p>")));
});

test("more columns add empty ones; a switch is one undo step", () => {
  const { editor } = renderEditor({ defaultValue: TWO });
  caretIn(editor, "Left");

  act(() => void editor.commands.setLayout("25-25-25-25"));
  expect(editor.getHTML()).toBe(
    layout(
      "25-25-25-25",
      column("<p>Left</p>"),
      column("<p>Right</p>"),
      column("<p></p>"),
      column("<p></p>")
    )
  );
  expect(here(editor)).toBe("Left");

  act(() => void editor.commands.undo());
  expect(editor.getHTML()).toBe(TWO);
});

test("same column count keeps the content and only changes the widths", () => {
  const { editor } = renderEditor({ defaultValue: TWO });
  caretIn(editor, "Right");
  act(() => void editor.commands.setLayout("40-60"));
  expect(editor.getHTML()).toBe(layout("40-60", column("<p>Left</p>"), column("<p>Right</p>")));
});

test("outside a layout the variant switch does nothing", () => {
  const { editor } = renderEditor({ defaultValue: "<p>Text</p>" });
  caretIn(editor, "Text");
  expect(editor.commands.setLayout("50-50")).toBe(false);
  expect(editor.getHTML()).toBe("<p>Text</p>");
});

// ── Клавиатура ───────────────────────────────────────────────────────────

test("Tab and Shift+Tab move between columns; the edge column leaves Tab to the browser", () => {
  const { editor } = renderEditor({ defaultValue: THREE });
  focusField();
  caretIn(editor, "One");

  expect(press(editor, "Tab")).toBe(false);
  expect(here(editor)).toBe("Two");
  expect(editor.state.selection.$from.parentOffset).toBe(0);

  expect(press(editor, "Tab")).toBe(false);
  expect(here(editor)).toBe("Three");

  // Последняя колонка — Tab уходит браузеру: фокус покидает Редактор, ловушки нет.
  expect(press(editor, "Tab")).toBe(true);
  expect(here(editor)).toBe("Three");

  expect(press(editor, "Tab", { shiftKey: true })).toBe(false);
  expect(here(editor)).toBe("Two");
  press(editor, "Tab", { shiftKey: true });
  expect(here(editor)).toBe("One");
  expect(press(editor, "Tab", { shiftKey: true })).toBe(true);
});

test("a Tab the document took does not reach the window around it, a released one does", () => {
  const { editor, container } = renderEditor({ defaultValue: THREE });
  const reached: string[] = [];
  // Так слушает Tab ловушка фокуса окна Radix: на своём контейнере, всплытием.
  container.addEventListener("keydown", () => reached.push(here(editor)));
  focusField();
  caretIn(editor, "Two");

  press(editor, "Tab");
  press(editor, "Tab");
  expect(reached).toEqual(["Three"]);
});

test("Tab in a list inside a column belongs to the list", () => {
  const { editor } = renderEditor({
    defaultValue: layout(
      "50-50",
      column("<ul><li><p>First</p></li><li><p>Second</p></li></ul>"),
      column("<p>Right</p>")
    ),
  });
  focusField();
  caretIn(editor, "Second");

  press(editor, "Tab");

  expect(here(editor)).toBe("Second");
  expect(editor.getHTML()).toContain("<li><p>First</p><ul><li><p>Second</p></li></ul></li>");
});

test("arrows cross to the neighbouring column at the edge of the text", () => {
  const { editor } = renderEditor({ defaultValue: THREE });
  focusField();
  caretIn(editor, "One");

  press(editor, "ArrowRight");
  expect(here(editor)).toBe("Two");
  expect(editor.state.selection.$from.parentOffset).toBe(0);

  press(editor, "ArrowLeft");
  expect(here(editor)).toBe("One");
  expect(editor.state.selection.$from.parentOffset).toBe(3);
});

test("up and down leave the layout to the blocks around it", () => {
  const { editor } = renderEditor({ defaultValue: `<p>Above</p>${THREE}<p>Below</p>` });
  focusField();
  caretIn(editor, "One");

  press(editor, "ArrowDown");
  expect(here(editor)).toBe("Below");

  caretIn(editor, "Two more", "start");
  press(editor, "ArrowUp");
  // Не первая строка колонки — стрелка остаётся браузеру.
  expect(here(editor)).toBe("Two more");

  caretIn(editor, "Two", "start");
  press(editor, "ArrowUp");
  expect(here(editor)).toBe("Above");
});

test("a layout that ends the document is left by a gap cursor", () => {
  const { editor } = renderEditor({ defaultValue: TWO });
  focusField();
  caretIn(editor, "Right");

  press(editor, "ArrowDown");
  expect(editor.state.selection.constructor.name).toBe("GapCursor");
  expect(editor.state.selection.from).toBe(editor.state.doc.content.size);

  caretIn(editor, "Right");
  press(editor, "ArrowRight");
  expect(editor.state.selection.constructor.name).toBe("GapCursor");
});

test("Backspace at the start of the first column keeps the structure", () => {
  const empty = layout("50-50", column("<p></p>"), column("<p>Right</p>"));
  const { editor } = renderEditor({ defaultValue: `<p>Above</p>${empty}` });
  focusField();
  act(() => void editor.commands.setTextSelection(10));
  expect(editor.state.selection.$from.node(-1).type.name).toBe("layoutColumn");

  expect(press(editor, "Backspace")).toBe(false);
  expect(editor.getHTML()).toBe(`<p>Above</p>${empty}`);

  caretIn(editor, "Right", "start");
  expect(press(editor, "Backspace")).toBe(false);
  expect(editor.getHTML()).toBe(`<p>Above</p>${empty}`);
});

test("an empty heading alone in a column turns into text on Backspace, as at the top", () => {
  const { editor } = renderEditor({
    defaultValue: layout("50-50", column("<h2></h2>"), column("<p>Right</p>")),
  });
  focusField();
  act(() => void editor.commands.setTextSelection(3));
  expect(editor.isActive("heading")).toBe(true);

  press(editor, "Backspace");
  expect(editor.getHTML()).toBe(layout("50-50", column("<p></p>"), column("<p>Right</p>")));
});

test("Backspace on the block below selects the whole layout, the second one removes it", () => {
  const { editor } = renderEditor({ defaultValue: `${TWO}<p>Below</p>` });
  focusField();
  caretIn(editor, "Below", "start");

  press(editor, "Backspace");
  expect(editor.state.selection.constructor.name).toBe("NodeSelection");
  expect(editor.getHTML()).toBe(`${TWO}<p>Below</p>`);

  press(editor, "Backspace");
  expect(editor.getHTML()).toBe("<p>Below</p>");
});

// ── Команды над Блоками ──────────────────────────────────────────────────

test("moving and duplicating a block stay inside its column", () => {
  const { editor } = renderEditor({ defaultValue: THREE });
  focusField();
  caretIn(editor, "Two more");

  press(editor, "ArrowUp", { altKey: true, shiftKey: true });
  expect(editor.getHTML()).toContain(column("<p>Two more</p><p>Two</p>"));

  // У края колонки соседа нет: Блок остаётся в ней.
  press(editor, "ArrowUp", { altKey: true, shiftKey: true });
  expect(editor.getHTML()).toContain(column("<p>Two more</p><p>Two</p>"));
});

// ── Markdown ─────────────────────────────────────────────────────────────

test("getMarkdown writes the columns in a row, left to right", () => {
  const { handle } = renderEditor({ defaultValue: `<p>Intro</p>${THREE}` });
  expect(handle.getMarkdown()).toBe("Intro\n\nOne\n\nTwo\n\nTwo more\n\nThree");
});

test("setMarkdown never creates a layout", () => {
  const { editor, handle } = renderEditor();
  act(() => handle.setMarkdown(`One\n\n${TWO}\n\nTwo`));
  expect(editor.getHTML()).not.toContain("data-block");
});

// ── Показ ────────────────────────────────────────────────────────────────

test("RichTextView keeps the columns in reading order", () => {
  const { container } = render(<RichTextView html={THREE} />);
  const columns = container.querySelectorAll('[data-block="layout"] > [data-block="column"]');
  expect([...columns].map((element) => element.textContent)).toEqual([
    "One",
    "TwoTwo more",
    "Three",
  ]);
});

// ── Ручка Блока ──────────────────────────────────────────────────────────

const HANDLE = "Block actions";

/** Фокус в Документ: ручка видна только при нём. */
function focusAt(editor: Editor, text: string) {
  caretIn(editor, text);
  act(() => editor.view.focus());
}

async function openHandleMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: HANDLE }));
  return screen.findByRole("menu", { name: HANDLE });
}

async function openSubmenu(
  user: ReturnType<typeof userEvent.setup>,
  menu: HTMLElement,
  name: string
) {
  await user.click(within(menu).getByRole("menuitem", { name }));
  return screen.findByRole("menu", { name });
}

const names = (menu: HTMLElement) =>
  Array.from(menu.querySelectorAll('[role^="menuitem"]')).map((item) => item.textContent);

const VARIANTS = [
  "Single column",
  "Two columns",
  "Three columns",
  "Four columns",
  "60/40",
  "40/60",
];

test("Add › Layout › offers six variants and puts the chosen one below the block", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: "<p>One</p><p>Two</p>" });
  focusAt(editor, "One");

  const add = await openSubmenu(user, await openHandleMenu(user), "Add");
  const variants = await openSubmenu(user, add, "Layout");
  expect(names(variants)).toEqual(VARIANTS);

  await user.click(within(variants).getByRole("menuitem", { name: "60/40" }));

  expect(editor.getHTML()).toBe(
    "<p>One</p>" + layout("60-40", column("<p></p>"), column("<p></p>")) + "<p>Two</p>"
  );
  expect(editor.state.selection.$from.node(-2).type.name).toBe("layout");
  act(() => void editor.commands.undo());
  expect(editor.getHTML()).toBe("<p>One</p><p>Two</p>");
});

test("a block in a column has its own handle: Add puts a block below it in the same column", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: THREE });
  focusAt(editor, "Two");

  const add = await openSubmenu(user, await openHandleMenu(user), "Add");
  await user.click(within(add).getByRole("menuitem", { name: "Divider" }));

  expect(editor.getHTML()).toContain(column("<p>Two</p><hr><p>Two more</p>"));
});

test("Move down and Delete of a block in a column stay inside the column", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: THREE });
  focusAt(editor, "Two");

  await user.click(within(await openHandleMenu(user)).getByRole("menuitem", { name: /Move down/ }));
  expect(editor.getHTML()).toContain(column("<p>Two more</p><p>Two</p>"));

  focusAt(editor, "Three");
  await user.click(within(await openHandleMenu(user)).getByRole("menuitem", { name: "Delete" }));
  // Единственный Блок колонки уступает место пустому абзацу — колонка остаётся.
  expect(editor.getHTML()).toContain(column("<p></p>"));
  expect(editor.getHTML()).toContain('data-layout="33-33-33"');
});

test("the handle of a block in a column switches the layout variant from Layout ›", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: THREE });
  focusAt(editor, "One");

  // Формат — тип самого Блока, как везде.
  const format = await openSubmenu(user, await openHandleMenu(user), "Format");
  expect(
    within(format).getByRole("menuitemradio", { name: /Text/ }).getAttribute("aria-checked")
  ).toBe("true");
  await user.keyboard("{Escape}");
  await user.keyboard("{Escape}");
  focusAt(editor, "One");

  const variants = await openSubmenu(user, await openHandleMenu(user), "Layout");
  expect(names(variants)).toEqual(VARIANTS);
  expect(
    within(variants)
      .getByRole("menuitemradio", { name: "Three columns" })
      .getAttribute("aria-checked")
  ).toBe("true");

  await user.click(within(variants).getByRole("menuitemradio", { name: "Two columns" }));
  expect(editor.getHTML()).toBe(
    layout("50-50", column("<p>One</p>"), column("<p>Two</p><p>Two more</p><p>Three</p>"))
  );
});

test("a layout selected as a whole has Format › with the six variants, current marked", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: `<p>Above</p>${TWO}` });
  act(() => {
    editor.view.focus();
    editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, 7)));
  });
  expect(editor.state.selection.constructor.name).toBe("NodeSelection");

  const format = await openSubmenu(user, await openHandleMenu(user), "Format");
  expect(names(format)).toEqual(VARIANTS);
  expect(
    within(format).getByRole("menuitemradio", { name: "Two columns" }).getAttribute("aria-checked")
  ).toBe("true");

  await user.click(within(format).getByRole("menuitemradio", { name: "Four columns" }));
  expect(editor.getHTML()).toBe(
    "<p>Above</p>" +
      layout(
        "25-25-25-25",
        column("<p>Left</p>"),
        column("<p>Right</p>"),
        column("<p></p>"),
        column("<p></p>")
      )
  );
  act(() => void editor.commands.undo());
  expect(editor.getHTML()).toBe(`<p>Above</p>${TWO}`);
});
