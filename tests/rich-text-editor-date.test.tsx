// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import type { Editor } from "@tiptap/react";
import createDOMPurify from "dompurify";
import { NodeSelection } from "@tiptap/pm/state";
import { createRef } from "react";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { UiProvider } from "../src/i18n/UiProvider.js";
import { messages as ru } from "../src/locales/ru.js";
import {
  RichTextEditor,
  tool,
  type RichTextEditorHandle,
  type RichTextEditorProps,
} from "../src/editor/index.js";
import { sanitizeRichText } from "../src/editor/schema-entry.js";
import { resetDevWarnings } from "../src/lib/dev-warn.js";
import { loadLazyBuiltins } from "./editor-lazy-builtins.js";

beforeAll(loadLazyBuiltins);

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
  resetDevWarnings();
});

/**
 * The `date` Tool (OLDSUI-309, ADR-0079): a date mention, `<time datetime="…">text</time>`.
 *
 * Through the public `RichTextEditor` with a concrete `tools`: the Slash menu, the popover, real
 * `keydown` events and clicks; the result is the output HTML, Markdown and an undo step. The caret is
 * placed with engine commands: jsdom cannot type into `contenteditable`. The locale is set by
 * `UiProvider`, because the text of a mention is written in it.
 */
const TOOLS_WITH_DATE = ["bold", "history", "insertMenu", "date"] as const;

function renderEditor(props: Partial<RichTextEditorProps> = {}, locale = "en-US") {
  const ref = createRef<RichTextEditorHandle>();
  const view = render(
    <UiProvider locale={locale} messages={locale.startsWith("ru") ? ru : undefined}>
      <RichTextEditor ref={ref} aria-label="Body" tools={TOOLS_WITH_DATE} {...props} />
    </UiProvider>
  );
  const editor = ref.current?.editor;
  if (!editor) throw new Error("the editor was not created inside render()");
  return { ...view, editor, handle: ref.current! };
}

/** A mention as the Editor writes it. */
const mention = (datetime: string, text: string) => `<time datetime="${datetime}">${text}</time>`;

/** Moves the caret to the end of the text `text`. */
function caretIn(editor: Editor, text: string) {
  let found = -1;
  editor.state.doc.descendants((node, pos) => {
    if (found < 0 && node.isText && node.text === text) found = pos + node.nodeSize;
  });
  if (found < 0) throw new Error(`no text "${text}" in the document`);
  act(() => {
    editor.view.focus();
    editor.commands.setTextSelection(found);
  });
}

function press(editor: Editor, key: string, modifiers: KeyboardEventInit = {}) {
  const event = new KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true,
    ...modifiers,
  });
  Object.defineProperty(event, "keyCode", { value: key === "Enter" ? 13 : key.charCodeAt(0) });
  act(() => void editor.view.dom.dispatchEvent(event));
  return event.defaultPrevented;
}

type User = ReturnType<typeof userEvent.setup>;

/** Finds a menu item by its name, without the shortcut label. */
function itemNamed(menu: HTMLElement, name: string) {
  const found = Array.from(menu.querySelectorAll<HTMLElement>('[role^="menuitem"]')).find(
    (item) =>
      (item.textContent ?? "").replace(item.querySelector("kbd")?.textContent ?? "", "") === name
  );
  if (!found) throw new Error(`no item "${name}" in the menu`);
  return found;
}

/** Selects the item in the Toolbar's "+" menu and waits for the popover. */
async function openFromMenu(user: User, item = "Date", dialog = item) {
  await user.click(screen.getByRole("button", { name: "Insert block" }));
  await user.click(itemNamed(await screen.findByRole("menu", { name: "Insert block" }), item));
  return screen.findByRole("dialog", { name: dialog });
}

/** The cell of the calendar for a day: the grid names a cell by its full date. */
const dayCell = (popover: HTMLElement, name: RegExp | string) =>
  within(popover).getByRole("button", { name });

/** Clicks a mention. Only `click`: the full mouse sequence reaches `elementFromPoint`, which jsdom lacks. */
function clickOn(element: Element) {
  act(() => void fireEvent.click(element));
}

const time = (editor: Editor) => editor.view.dom.querySelector("time")!;

// ── Schema, HTML and the round trip ──────────────────────────────────────────────────────

test("a mention is an Atom whose HTML is a `time` with the words as they were written", () => {
  const html = `<p>On ${mention("2026-10-18", "Oct 18, 2026")} and ${mention("2026-10-18T15:00+03:00", "Oct 18, 2026, 3:00 PM")}.</p>`;
  const { editor } = renderEditor({ defaultValue: html });

  expect(editor.getHTML()).toBe(html);
  // The Atom is one unit: its words are not text of the paragraph, and the paragraph holds five children.
  const paragraph = editor.state.doc.firstChild!;
  expect(paragraph.childCount).toBe(5);
  expect(paragraph.child(1).isAtom).toBe(true);
  expect(paragraph.child(1).attrs).toEqual({ datetime: "2026-10-18", text: "Oct 18, 2026" });
});

test("value, engine, HTML, sanitizer and value again lose nothing", () => {
  const purify = createDOMPurify(window);
  const tools = ["bold", "bulletList", "date"] as const;
  const html =
    `<p>Due ${mention("2026-10-18", "18 Oct 2026")} <strong>or ${mention("2026-10-19T09:30-05:00", "Oct 19, 9:30 AM")}</strong></p>` +
    `<ul><li><p>${mention("2028-02-29", "Feb 29")}</p></li></ul>`;

  const first = renderEditor({ tools, defaultValue: html });
  const saved = first.editor.getHTML();
  const sanitized = sanitizeRichText(saved, purify, tools);

  expect(saved).toBe(html);
  expect(sanitized).toBe(saved);
  cleanup();
  expect(renderEditor({ tools, defaultValue: sanitized }).editor.getHTML()).toBe(saved);
});

test("someone else's `time` becomes an Atom in our forms of datetime, with its words as they are", () => {
  const { editor } = renderEditor({
    defaultValue:
      '<p><time datetime="2026-10-18">the eighteenth</time> and ' +
      '<time datetime="2026-10-18T15:00+03:00">  3 in the\n afternoon </time></p>',
  });

  expect(editor.getHTML()).toBe(
    `<p>${mention("2026-10-18", "the eighteenth")} and ${mention("2026-10-18T15:00+03:00", "3 in the afternoon")}</p>`
  );
});

test.each([
  ["a year", "2026"],
  ["a week", "2026-W42"],
  ["a period", "P3D"],
  ["a time without a date", "15:00"],
  ["a time without an offset", "2026-10-18T15:00"],
  ["a UTC time", "2026-10-18T15:00Z"],
  ["a day that does not exist", "2026-02-29"],
])("someone else's `time` with %s stays ordinary text, losslessly", (_name, value) => {
  const { editor } = renderEditor({
    defaultValue: `<p>a <time datetime="${value}">some words</time> b</p>`,
  });

  expect(editor.getHTML()).toBe("<p>a some words b</p>");
});

test("pasting someone else's `time` follows the same rules as a value", () => {
  const { editor } = renderEditor({ defaultValue: "<p></p>" });

  act(
    () =>
      void editor.view.pasteHTML(
        '<p><time datetime="2026-10-12">twelfth of October</time> <time datetime="P3D">three days</time></p>',
        new Event("paste") as ClipboardEvent
      )
  );

  expect(editor.getHTML()).toBe(`<p>${mention("2026-10-12", "twelfth of October")} three days</p>`);
});

test("an empty `time` is written by the option in the author's locale", () => {
  const { editor } = renderEditor({
    defaultValue: '<p><time datetime="2026-10-18"></time> <time datetime="2026-10-19"> </time></p>',
  });

  expect(editor.getHTML()).toBe(
    `<p>${mention("2026-10-18", "Oct 18, 2026")} ${mention("2026-10-19", "Oct 19, 2026")}</p>`
  );
});

test("a `time` that wraps a sentence is page markup and stays text", () => {
  const sentence = "x".repeat(121);
  const { editor } = renderEditor({
    defaultValue: `<p><time datetime="2026-10-18">${sentence}</time></p>`,
  });

  expect(editor.getHTML()).toBe(`<p>${sentence}</p>`);
});

test("without the Tool a mention is its words, in HTML and in JSON", () => {
  const withTool = renderEditor({
    defaultValue: `<p>On ${mention("2026-10-18", "Oct 18, 2026")}.</p>`,
  });
  const json = withTool.handle.getJSON()!;
  cleanup();

  const html = renderEditor({
    tools: ["bold"],
    defaultValue: `<p>On ${mention("2026-10-18", "Oct 18, 2026")}.</p>`,
  });
  expect(html.editor.getHTML()).toBe("<p>On Oct 18, 2026.</p>");
  cleanup();

  const fromJson = renderEditor({ tools: ["bold"], defaultValue: json });
  expect(fromJson.editor.getHTML()).toBe("<p>On Oct 18, 2026.</p>");
});

// ── Atom text, counter and Markdown ───────────────────────────────────────────────────

test("the text of a mention is what the reader sees: getText, the counter, the selected text", () => {
  const { editor, handle } = renderEditor({
    maxLength: 20,
    defaultValue: `<p>Due ${mention("2026-10-18", "Oct 18, 2026")}</p>`,
  });

  expect(handle.getText()).toBe("Due Oct 18, 2026");
  expect(screen.getByText("4 characters left")).toBeTruthy();
  act(() => void editor.commands.selectAll());
  expect(handle.getSelectedText()).toBe("Due Oct 18, 2026");
});

test("Markdown carries the words and loses the machine value", () => {
  const { handle } = renderEditor({
    defaultValue: `<p>Due ${mention("2026-10-18T15:00+03:00", "Oct 18, 2026, 3:00 PM")}!</p>`,
  });

  expect(handle.getMarkdown().trim()).toBe("Due Oct 18, 2026, 3:00 PM!");
  // And back it is plain text: Markdown has no date.
  act(() => handle.setMarkdown("Due Oct 18, 2026!"));
  expect(handle.editor!.getHTML()).toBe("<p>Due Oct 18, 2026!</p>");
});

/*
  The Russian words are the output of Intl, written as escapes because the i18n gate keeps Cyrillic out
  of tests: the day, the abbreviated month with a dot ("okt." in Latin letters), the year with its "g."
  suffix, and the 24-hour clock.
*/
const RU_DATE = "18 \u043e\u043a\u0442. 2026 \u0433.";
const RU_TEXT_15 = `${RU_DATE}, 15:00`;
const RU_TEXT_0930 = `${RU_DATE}, 9:30`;

// ── Inserting: the Slash menu item and the popover ───────────────────────────────────────

/** Pins "today" without freezing timers: the calendar, the form and `insert` all read the Date. */
function today(iso = "2026-10-18T09:00:00") {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(iso));
}

/** A zone with an offset the test can name: the browser of an author in Moscow. */
function inMoscow() {
  vi.spyOn(Date.prototype, "getTimezoneOffset").mockReturnValue(-180);
}

test("the Slash menu has a Date item, and Enter in its popover inserts today", async () => {
  today();
  const user = userEvent.setup({ advanceTimers: () => {} });
  const { editor } = renderEditor({ defaultValue: "<p>Due</p>" });
  caretIn(editor, "Due");

  await openFromMenu(user);
  // The calendar has the focus on today: Enter alone picks it.
  await waitFor(() => expect(document.activeElement?.closest('[role="grid"]')).not.toBeNull());
  await user.keyboard("{Enter}");

  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Date" })).toBeNull());
  expect(editor.getHTML()).toBe(`<p>Due${mention("2026-10-18", "Oct 18, 2026")}</p>`);
});

test("a day picked in the calendar is inserted at the caret as one undo step", async () => {
  today();
  const user = userEvent.setup({ advanceTimers: () => {} });
  const { editor } = renderEditor({ defaultValue: "<p>Due</p>" });
  caretIn(editor, "Due");

  const popover = await openFromMenu(user);
  await user.click(dayCell(popover, /October 25, 2026/));

  expect(editor.getHTML()).toBe(`<p>Due${mention("2026-10-25", "Oct 25, 2026")}</p>`);
  act(() => void editor.commands.undo());
  expect(editor.getHTML()).toBe("<p>Due</p>");
});

test("with the Time switch on, a date and a time are inserted together with the author's offset", async () => {
  today();
  inMoscow();
  const user = userEvent.setup({ advanceTimers: () => {} });
  const { editor } = renderEditor({ defaultValue: "<p>Due</p>" });
  caretIn(editor, "Due");

  const popover = await openFromMenu(user);
  await user.click(within(popover).getByRole("checkbox", { name: "Time" }));
  const field = within(popover).getByRole("textbox", { name: "Time, hours and minutes" });
  // Turning the switch on offers the current time.
  expect((field as HTMLInputElement).value).toBe("09:00");
  await user.clear(field);
  await user.type(field, "1500");
  expect((field as HTMLInputElement).value).toBe("15:00");
  // A day picked now does not insert: the time still has to be confirmed.
  await user.click(dayCell(popover, /October 25, 2026/));
  expect(editor.getHTML()).toBe("<p>Due</p>");
  await user.click(within(popover).getByRole("button", { name: "Insert" }));

  expect(editor.getHTML()).toBe(
    `<p>Due${mention("2026-10-25T15:00+03:00", "Oct 25, 2026, 3:00 PM")}</p>`
  );
});

test("Enter in the time field inserts, and a time typed short is completed", async () => {
  today();
  inMoscow();
  const user = userEvent.setup({ advanceTimers: () => {} });
  const { editor } = renderEditor({ defaultValue: "<p>Due</p>" });
  caretIn(editor, "Due");

  const popover = await openFromMenu(user);
  await user.click(within(popover).getByRole("checkbox", { name: "Time" }));
  const field = within(popover).getByRole("textbox", { name: "Time, hours and minutes" });
  await user.clear(field);
  await user.type(field, "7{Enter}");

  // Today, as nothing else was picked; "7" is 07:00.
  expect(editor.getHTML()).toBe(
    `<p>Due${mention("2026-10-18T07:00+03:00", "Oct 18, 2026, 7:00 AM")}</p>`
  );
});

test("the text is written in the author's locale: Russian and a 24-hour clock", async () => {
  today();
  inMoscow();
  const user = userEvent.setup({ advanceTimers: () => {} });
  const { editor } = renderEditor({ defaultValue: "<p>Due</p>" }, "ru-RU");
  caretIn(editor, "Due");

  await user.click(screen.getByRole("button", { name: ru.editor.insertMenu }));
  await user.click(itemNamed(await screen.findByRole("menu"), ru.editor.date));
  const popover = await screen.findByRole("dialog", { name: ru.editor.date });
  await user.click(within(popover).getByRole("checkbox", { name: ru.editor.dateTime }));
  const field = within(popover).getByRole("textbox", { name: ru.editor.dateTimeField });
  await user.clear(field);
  await user.type(field, "1500{Enter}");

  expect(editor.getHTML()).toBe(`<p>Due${mention("2026-10-18T15:00+03:00", RU_TEXT_15)}</p>`);
});

// ── Editing: a click or Enter on a mention ───────────────────────────────────────────────

const DUE = `<p>Due ${mention("2026-10-18", "Oct 18, 2026")} end</p>`;

test("a click on a mention selects it and opens the popover on its day", async () => {
  today();
  const { editor } = renderEditor({ defaultValue: DUE });

  clickOn(time(editor));
  const popover = await screen.findByRole("dialog", { name: "Date" });

  expect(editor.state.selection).toBeInstanceOf(NodeSelection);
  // The day of the mention is the selected one; the time switch is off.
  const selected = await within(popover).findByRole("button", { name: /October 18, 2026/ });
  expect(selected.closest("[data-selected]")).not.toBeNull();
  expect(within(popover).getByRole("checkbox", { name: "Time" })).toHaveProperty("checked", false);
  // A date without a time has nothing to "remove", but it can be deleted.
  expect(within(popover).queryByRole("button", { name: "Remove time" })).toBeNull();
  expect(within(popover).getByRole("button", { name: "Delete date" })).toBeTruthy();
});

test("another day replaces the value and the words in one edit", async () => {
  today();
  const user = userEvent.setup({ advanceTimers: () => {} });
  const { editor } = renderEditor({ defaultValue: DUE });

  clickOn(time(editor));
  const popover = await screen.findByRole("dialog", { name: "Date" });
  await user.click(await within(popover).findByRole("button", { name: /October 20, 2026/ }));

  expect(editor.getHTML()).toBe(`<p>Due ${mention("2026-10-20", "Oct 20, 2026")} end</p>`);
  // One edit: one undo returns the old date.
  act(() => void editor.commands.undo());
  expect(editor.getHTML()).toBe(DUE);
});

test("Enter on a selected mention opens the popover, and Shift+Arrow selects it from the caret", async () => {
  today();
  const { editor } = renderEditor({ defaultValue: DUE });

  caretIn(editor, "Due ");
  expect(press(editor, "ArrowRight", { shiftKey: true })).toBe(true);
  expect(press(editor, "Enter")).toBe(true);

  expect(await screen.findByRole("dialog", { name: "Date" })).toBeTruthy();
  // The paragraph was not split by that Enter.
  expect(editor.getHTML()).toBe(DUE);
});

test("Enter next to a mention, with nothing selected, still splits the paragraph", () => {
  const { editor } = renderEditor({ defaultValue: DUE });

  caretIn(editor, "Due ");
  press(editor, "Enter");

  expect(screen.queryByRole("dialog")).toBeNull();
});

test("a mention with a time shows it, can lose it in one edit, and keeps the day", async () => {
  today();
  inMoscow();
  const user = userEvent.setup({ advanceTimers: () => {} });
  const html = `<p>Due ${mention("2026-10-18T15:00+03:00", "Oct 18, 2026, 3:00 PM")}</p>`;
  const { editor } = renderEditor({ defaultValue: html });

  clickOn(time(editor));
  const popover = await screen.findByRole("dialog", { name: "Date" });
  expect(within(popover).getByRole("checkbox", { name: "Time" })).toHaveProperty("checked", true);
  expect(
    (within(popover).getByRole("textbox", { name: "Time, hours and minutes" }) as HTMLInputElement)
      .value
  ).toBe("15:00");

  await user.click(within(popover).getByRole("button", { name: "Remove time" }));

  expect(editor.getHTML()).toBe(`<p>Due ${mention("2026-10-18", "Oct 18, 2026")}</p>`);
  act(() => void editor.commands.undo());
  expect(editor.getHTML()).toBe(html);
});

test("a time can be added to a date and changed with Apply, and the words follow the current locale", async () => {
  today();
  inMoscow();
  const user = userEvent.setup({ advanceTimers: () => {} });
  // Written once in English; the author's locale is Russian now, so editing re-writes the words.
  const { editor } = renderEditor({ defaultValue: DUE }, "ru-RU");

  clickOn(time(editor));
  const popover = await screen.findByRole("dialog", { name: ru.editor.date });
  await user.click(within(popover).getByRole("checkbox", { name: ru.editor.dateTime }));
  const field = within(popover).getByRole("textbox", { name: ru.editor.dateTimeField });
  await user.clear(field);
  await user.type(field, "0930");
  await user.click(within(popover).getByRole("button", { name: ru.editor.dateApply }));

  expect(editor.getHTML()).toBe(
    `<p>Due ${mention("2026-10-18T09:30+03:00", RU_TEXT_0930)} end</p>`
  );
});

test("Delete removes the mention in one edit", async () => {
  today();
  const user = userEvent.setup({ advanceTimers: () => {} });
  const { editor } = renderEditor({ defaultValue: DUE });

  clickOn(time(editor));
  const popover = await screen.findByRole("dialog", { name: "Date" });
  await user.click(within(popover).getByRole("button", { name: "Delete date" }));

  expect(editor.getHTML()).toBe("<p>Due  end</p>");
  act(() => void editor.commands.undo());
  expect(editor.getHTML()).toBe(DUE);
});

test("a read-only field shows the mention and opens nothing", () => {
  const { editor } = renderEditor({ defaultValue: DUE, readOnly: true });

  clickOn(time(editor));
  press(editor, "Enter");

  expect(screen.queryByRole("dialog")).toBeNull();
  expect(editor.getHTML()).toBe(DUE);
});

// ── API: the `format` option and the `insert` command ──────────────────────────────────

test("tool('date', { format }) sets how the date is written, and the value stays", async () => {
  today();
  const user = userEvent.setup({ advanceTimers: () => {} });
  const { editor } = renderEditor({
    tools: ["insertMenu", tool("date", { format: { dateStyle: "long" } })],
    defaultValue: "<p>Due</p>",
  });
  caretIn(editor, "Due");

  await openFromMenu(user);
  await waitFor(() => expect(document.activeElement?.closest('[role="grid"]')).not.toBeNull());
  await user.keyboard("{Enter}");
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Date" })).toBeNull());

  expect(editor.getHTML()).toBe(`<p>Due${mention("2026-10-18", "October 18, 2026")}</p>`);
});

test("a format with a time field or a bad combination falls back to the default, with one console.error", () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  const { handle } = renderEditor({
    // From plain JS without types: a time field, and the combination Intl rejects.
    tools: [tool("date", { format: { hour: "numeric" } })],
    defaultValue: "<p></p>",
  });
  expect(handle.tool("date")?.insert("2026-10-18")).toBe(true);
  expect(handle.editor!.getHTML()).toBe(`<p>${mention("2026-10-18", "Oct 18, 2026")}</p>`);
  expect(error).toHaveBeenCalledTimes(1);
  expect(error).toHaveBeenCalledWith(
    expect.stringContaining('tool "date": ignored invalid options: format')
  );
  cleanup();

  const mixed = renderEditor({
    tools: [tool("date", { format: { dateStyle: "long", month: "short" } })],
    defaultValue: "<p></p>",
  });
  expect(mixed.handle.tool("date")?.insert("2026-10-18")).toBe(true);
  expect(mixed.editor.getHTML()).toBe(`<p>${mention("2026-10-18", "Oct 18, 2026")}</p>`);
});

test("insert(value) puts a mention at the caret in one edit and says whether it did", () => {
  inMoscow();
  const { editor, handle } = renderEditor({ defaultValue: "<p>Due</p>" });
  caretIn(editor, "Due");
  const date = handle.tool("date")!;

  expect(date.insert("2026-10-18")).toBe(true);
  expect(editor.getHTML()).toBe(`<p>Due${mention("2026-10-18", "Oct 18, 2026")}</p>`);
  expect(date.insert("2026-10-19T15:00+03:00")).toBe(true);
  expect(editor.getHTML()).toContain(mention("2026-10-19T15:00+03:00", "Oct 19, 2026, 3:00 PM"));
  // Not our forms: no change, and `false`.
  expect(date.insert("2026-02-29")).toBe(false);
  expect(date.insert("2026-10-19T15:00")).toBe(false);
  expect(date.insert("tomorrow")).toBe(false);
  // Both calls are one undo group (the history merges edits made in quick succession): one undo.
  act(() => void editor.commands.undo());
  expect(editor.getHTML()).toBe("<p>Due</p>");
});

test("insert() without a value opens the popover, and a read-only field refuses", async () => {
  const { handle } = renderEditor({ defaultValue: "<p>Due</p>" });

  expect(handle.tool("date")?.insert()).toBe(true);
  expect(await screen.findByRole("dialog", { name: "Date" })).toBeTruthy();
  cleanup();

  const readOnly = renderEditor({ defaultValue: "<p>Due</p>", readOnly: true });
  expect(readOnly.handle.tool("date")?.insert("2026-10-18")).toBe(false);
  expect(readOnly.handle.tool("date")?.insert()).toBe(false);
});

test("the Tool is in full and not in basic, and a Tool set without it has no Date item", () => {
  const full = renderEditor({ tools: undefined, preset: "full" });
  expect(full.handle.tool("date")).not.toBeNull();
  cleanup();
  const basic = renderEditor({ tools: undefined, preset: "basic" });
  expect(basic.handle.tool("date")).toBeNull();
});
