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
    `<p>Due ${mention("2026-10-18", "18 окт. 2026 г.")} <strong>or ${mention("2026-10-19T09:30-05:00", "Oct 19, 9:30 AM")}</strong></p>` +
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
  const json = withTool.handle.getJSON();
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
