// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { createRef } from "react";
import { afterEach, beforeAll, beforeEach, expect, test, vi } from "vitest";
import {
  RICH_TEXT_PRESETS,
  RichTextEditor,
  tool,
  type RichTextEditorHandle,
  type RichTextEditorProps,
} from "../src/editor/index.js";
import { searchState } from "../src/editor/features/search/searchPlugin.js";
import { resetDevWarnings } from "../src/lib/dev-warn.js";
import { testLazyTool } from "./editor-test-tools.js";
import { loadLazyBuiltins } from "./editor-lazy-builtins.js";

/**
 * Команды Инструмента (OLDSUI-268): `handle.tool("search")` и `handle.tool("toc")`.
 * Проверки идут через публичный `RichTextEditor`, как их вызовет экран.
 */

beforeAll(loadLazyBuiltins);
// Панель Поиска и ядро Оглавления — ленивые чанки: прогреваем, чтобы `findBy` не ждал сеть.
beforeAll(() => import("../src/editor/features/search/SearchPanel.js"));
beforeAll(() => import("../src/editor/features/toc/RichTextToc.js"));

let warn: ReturnType<typeof vi.spyOn>;
let scrollTo: ReturnType<typeof vi.fn>;
let animate: ReturnType<typeof vi.fn>;

beforeEach(() => {
  resetDevWarnings();
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  Element.prototype.scrollIntoView = vi.fn();
  scrollTo = vi.fn();
  window.scrollTo = scrollTo as unknown as typeof window.scrollTo;
  // Подсветка заголовка — Web Animations, которых в jsdom нет.
  animate = vi.fn();
  HTMLElement.prototype.animate = animate as unknown as HTMLElement["animate"];
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  document.documentElement.removeAttribute("style");
});

const CATS = "<p>cat dog cat</p>";
const ARTICLE =
  "<h1>Title</h1><p>Intro</p><h2>Palette</h2><p>Text</p><h3>How to read</h3><p>Text</p>" +
  "<h4>Neutrals</h4><p>Text</p><h2>What's next</h2><p>Outro</p>";

function renderEditor(props: Partial<RichTextEditorProps> = {}) {
  const ref = createRef<RichTextEditorHandle>();
  const view = render(
    <RichTextEditor ref={ref} aria-label="Body" defaultValue={CATS} {...props} />
  );
  const handle = () => ref.current!;
  return { ...view, ref, handle, editor: () => ref.current!.editor! };
}

/** Промисы загрузчиков и эффекты Редактора отработали. */
const settle = () =>
  act(async () => void (await new Promise((resolve) => setTimeout(resolve, 10))));

const panel = () => screen.queryByRole("search", { name: "Find and replace" });
const findField = () => screen.getByRole("textbox", { name: "Find" }) as HTMLInputElement;
const replaceField = () => screen.getByRole("textbox", { name: "Replace with" });
const isOn = (control: HTMLElement) =>
  control.getAttribute("aria-checked") === "true" || (control as HTMLInputElement).checked === true;
const strip = () => screen.queryByRole("button", { name: "Table of contents" });

// ---------------------------------------------------------------- вход handle.tool()

test("handle.tool() gives the Commands of a tool in the set and null for a tool outside it", () => {
  const { handle } = renderEditor({ tools: [...RICH_TEXT_PRESETS.full, "toc"] });
  expect(handle().tool("search")).not.toBeNull();
  expect(handle().tool("toc")).not.toBeNull();

  cleanup();
  const without = renderEditor({ tools: ["bold", "italic"] });
  expect(without.handle().tool("search")).toBeNull();
  expect(without.handle().tool("toc")).toBeNull();
});

test("toc is not in the presets: its Commands appear only with the tool", () => {
  const { handle } = renderEditor({ tools: RICH_TEXT_PRESETS.full });
  expect(handle().tool("search")).not.toBeNull();
  expect(handle().tool("toc")).toBeNull();
});

test("a Configured Tool switches the Commands on as well", () => {
  const { handle } = renderEditor({ tools: ["bold", tool("search"), tool("toc")] });
  expect(handle().tool("search")).not.toBeNull();
  expect(handle().tool("toc")).not.toBeNull();
});

test("a tool without Commands and an unknown name give null", () => {
  const { handle } = renderEditor();
  expect(handle().tool("bold" as never)).toBeNull();
  expect(handle().tool("not_a_tool")).toBeNull();
});

test("before the engine exists handle.tool() is null", async () => {
  const lazy = testLazyTool();
  const { ref } = renderEditor({ tools: [...RICH_TEXT_PRESETS.full, lazy.tool] });
  // Загрузчик ещё не отдал Часть для движка: движка нет, Хэндл тихий.
  expect(ref.current?.editor).toBeNull();
  expect(ref.current?.tool("search")).toBeNull();

  lazy.resolve();
  await waitFor(() => expect(ref.current!.editor).not.toBeNull());
  expect(ref.current!.tool("search")).not.toBeNull();
});

// ---------------------------------------------------------------- search: панель

test("open() opens the panel with focus in the search field", async () => {
  const { handle } = renderEditor();
  let result = false;
  act(() => {
    result = handle().tool("search")!.open();
  });
  expect(result).toBe(true);
  await screen.findByRole("search", { name: "Find and replace" });
  await waitFor(() => expect(document.activeElement).toBe(findField()));
});

test("open({ replace }) puts the focus in the replace field", async () => {
  const { handle } = renderEditor();
  act(() => void handle().tool("search")!.open({ replace: true }));
  await screen.findByRole("search", { name: "Find and replace" });
  await waitFor(() => expect(document.activeElement).toBe(replaceField()));
});

test("open({ query }) puts the query in the field and highlights the matches at once", async () => {
  const { handle, editor } = renderEditor();
  act(() => void handle().tool("search")!.open({ query: "cat" }));
  // Подсветка не ждёт ленивую панель: команды работают сразу после `open`.
  expect(searchState(editor().state)).toMatchObject({ query: "cat", total: 2, current: 0 });

  await screen.findByRole("search", { name: "Find and replace" });
  expect(findField().value).toBe("cat");
  expect(screen.getByText("1 / 2")).toBeDefined();
});

test("an explicit query beats the selected text", async () => {
  const { handle, editor } = renderEditor();
  act(() => void editor().chain().focus().setTextSelection({ from: 5, to: 8 }).run());
  act(() => void handle().tool("search")!.open({ query: "cat" }));
  await screen.findByRole("search", { name: "Find and replace" });
  expect(findField().value).toBe("cat");
});

test("open({ query }) on an open panel replaces the text in its field", async () => {
  const user = userEvent.setup();
  const { handle } = renderEditor();
  act(() => void handle().tool("search")!.open({ query: "cat" }));
  await screen.findByRole("search", { name: "Find and replace" });
  await user.type(findField(), "s");

  act(() => void handle().tool("search")!.open({ query: "dog" }));
  await waitFor(() => expect(findField().value).toBe("dog"));
});

test("open() is false in the HTML mode and does nothing", async () => {
  const user = userEvent.setup();
  const { handle } = renderEditor();
  await user.click(screen.getByRole("button", { name: "HTML" }));
  let result = true;
  act(() => {
    result = handle().tool("search")!.open();
  });
  expect(result).toBe(false);
  await settle();
  expect(panel()).toBeNull();
});

test("close() closes the panel and removes the highlight without taking the focus", async () => {
  const outside = document.createElement("button");
  document.body.append(outside);
  const { handle, editor } = renderEditor();
  act(() => void handle().tool("search")!.open({ query: "cat" }));
  await screen.findByRole("search", { name: "Find and replace" });

  outside.focus();
  let result = false;
  act(() => {
    result = handle().tool("search")!.close();
  });
  expect(result).toBe(true);
  expect(panel()).toBeNull();
  expect(searchState(editor().state)).toMatchObject({ query: "", total: 0 });
  expect(editor().view.dom.querySelectorAll(".rte-search-match")).toHaveLength(0);
  expect(document.activeElement).toBe(outside);
  outside.remove();
});

test("entering the HTML mode clears a query set without the panel", async () => {
  const user = userEvent.setup();
  const { handle, editor } = renderEditor();
  act(() => void handle().tool("search")!.setQuery("cat"));
  expect(searchState(editor().state)?.total).toBe(2);

  await user.click(screen.getByRole("button", { name: "HTML" }));
  expect(searchState(editor().state)?.total).toBe(0);
  // Документ скрыт: переход по совпадениям в нём не может «получиться».
  expect(handle().tool("search")!.next()).toBe(false);
});

// ---------------------------------------------------------------- search: запрос и переходы

test("setQuery() sets the query without the panel: matches, the current one and a result", () => {
  const { handle, editor } = renderEditor();
  let result = false;
  act(() => {
    result = handle().tool("search")!.setQuery("cat");
  });
  expect(result).toBe(true);
  expect(panel()).toBeNull();
  expect(searchState(editor().state)).toMatchObject({ query: "cat", total: 2, current: 0 });
  expect(editor().view.dom.querySelectorAll(".rte-search-match")).toHaveLength(2);
});

test("setQuery() with no matches still applies the query", () => {
  const { handle, editor } = renderEditor();
  let result = false;
  act(() => {
    result = handle().tool("search")!.setQuery("zebra");
  });
  expect(result).toBe(true);
  expect(searchState(editor().state)).toMatchObject({ total: 0, current: -1 });
});

test("setQuery() flags change the search; the unnamed ones keep their value", () => {
  const { handle, editor } = renderEditor({ defaultValue: "<p>Cat cat category</p>" });
  const search = () => handle().tool("search")!;
  act(() => void search().setQuery("cat"));
  expect(searchState(editor().state)?.total).toBe(3);
  act(() => void search().setQuery("cat", { matchCase: true }));
  expect(searchState(editor().state)?.total).toBe(2);
  // `matchCase` не назван — остаётся включённым.
  act(() => void search().setQuery("cat", { wholeWord: true }));
  expect(searchState(editor().state)).toMatchObject({ total: 1, options: { matchCase: true } });
  act(() => void search().setQuery("c.t", { regex: true, wholeWord: false }));
  expect(searchState(editor().state)?.total).toBe(2);
});

test("setQuery() with an undefined flag leaves that flag as it was", () => {
  const { handle, editor } = renderEditor({ defaultValue: "<p>Cat cat</p>" });
  const search = () => handle().tool("search")!;
  act(() => void search().setQuery("cat", { matchCase: true }));
  expect(searchState(editor().state)?.total).toBe(1);

  // Ключ есть, значения нет — «не менять», а не «выключить».
  act(() => void search().setQuery("cat", { matchCase: undefined }));
  expect(searchState(editor().state)).toMatchObject({ total: 1, options: { matchCase: true } });
  act(() => void search().setQuery("cat", { matchCase: undefined, wholeWord: true }));
  expect(searchState(editor().state)).toMatchObject({
    total: 1,
    options: { matchCase: true, wholeWord: true },
  });
});

test("the starting flags of tool('search') are the flags of the Commands until the search is closed", () => {
  const { handle, editor } = renderEditor({
    defaultValue: "<p>Cat cat</p>",
    tools: [...RICH_TEXT_PRESETS.full, tool("search", { matchCase: true })],
  });
  const search = () => handle().tool("search")!;
  act(() => void search().setQuery("cat"));
  expect(searchState(editor().state)?.total).toBe(1);

  act(() => void search().setQuery("cat", { matchCase: false }));
  expect(searchState(editor().state)?.total).toBe(2);
  // После `close()` флажки возвращаются к Опциям Инструмента.
  act(() => void search().close());
  act(() => void search().setQuery("cat"));
  expect(searchState(editor().state)?.total).toBe(1);
});

test("setQuery() is shown by an open panel: the query and the flags", async () => {
  const { handle } = renderEditor({ defaultValue: "<p>Cat cat</p>" });
  act(() => void handle().tool("search")!.open());
  await screen.findByRole("search", { name: "Find and replace" });

  act(() => void handle().tool("search")!.setQuery("cat", { matchCase: true }));
  await waitFor(() => expect(findField().value).toBe("cat"));
  expect(isOn(screen.getByRole("checkbox", { name: "Match case" }))).toBe(true);
  expect(screen.getByText("1 / 1")).toBeDefined();
});

test("typing in an open panel is not undone by the sync with the engine", async () => {
  const user = userEvent.setup();
  const { handle } = renderEditor();
  act(() => void handle().tool("search")!.open());
  await screen.findByRole("search", { name: "Find and replace" });
  await user.type(findField(), "cat dog");
  expect(findField().value).toBe("cat dog");
});

test("setQuery() is false in the HTML mode", async () => {
  const user = userEvent.setup();
  const { handle, editor } = renderEditor();
  await user.click(screen.getByRole("button", { name: "HTML" }));
  let result = true;
  act(() => {
    result = handle().tool("search")!.setQuery("cat");
  });
  expect(result).toBe(false);
  expect(searchState(editor().state)?.total).toBe(0);
});

test("next() and previous() walk the matches in a circle and select the current one", () => {
  const { handle, editor } = renderEditor();
  const search = () => handle().tool("search")!;
  act(() => void search().setQuery("cat"));

  act(() => expect(search().next()).toBe(true));
  expect(searchState(editor().state)?.current).toBe(1);
  const { from, to } = editor().state.selection;
  expect(editor().state.doc.textBetween(from, to)).toBe("cat");
  expect(from).toBe(9);
  act(() => void search().next());
  expect(searchState(editor().state)?.current).toBe(0);
  act(() => expect(search().previous()).toBe(true));
  expect(searchState(editor().state)?.current).toBe(1);
});

test("next() and previous() are false without matches", () => {
  const { handle } = renderEditor();
  const search = handle().tool("search")!;
  expect(search.next()).toBe(false);
  expect(search.previous()).toBe(false);
  act(() => void search.setQuery("zebra"));
  expect(search.next()).toBe(false);
});

// ---------------------------------------------------------------- search: замена

test("replace() replaces the current match in one undoable edit", () => {
  const onChange = vi.fn();
  const { handle, editor } = renderEditor({ onChange, changeDelay: 0 });
  const search = () => handle().tool("search")!;
  act(() => void search().setQuery("cat"));

  let result = false;
  act(() => {
    result = search().replace("cow");
  });
  expect(result).toBe(true);
  expect(editor().getText()).toBe("cow dog cat");
  // Текущим стало следующее совпадение: вторая замена берёт его.
  act(() => void search().replace("cow"));
  expect(editor().getText()).toBe("cow dog cow");
  expect(onChange).toHaveBeenCalled();

  act(() => void editor().commands.undo());
  expect(editor().getText()).toBe("cow dog cat");
});

test("replaceAll() replaces every match in one undoable edit", () => {
  const { handle, editor } = renderEditor();
  const search = () => handle().tool("search")!;
  act(() => void search().setQuery("cat"));

  let result = false;
  act(() => {
    result = search().replaceAll("cow");
  });
  expect(result).toBe(true);
  expect(editor().getText()).toBe("cow dog cow");
  expect(searchState(editor().state)?.total).toBe(0);

  act(() => void editor().commands.undo());
  expect(editor().getText()).toBe("cat dog cat");
});

test("replace() and replaceAll() are false without matches", () => {
  const { handle, editor } = renderEditor();
  const search = handle().tool("search")!;
  expect(search.replace("cow")).toBe(false);
  expect(search.replaceAll("cow")).toBe(false);
  expect(editor().getText()).toBe("cat dog cat");
});

test("replace() and replaceAll() are false in a field the author cannot edit", () => {
  const { handle, editor } = renderEditor({ readOnly: true });
  const search = handle().tool("search")!;
  act(() => void search.setQuery("cat"));
  expect(searchState(editor().state)?.total).toBe(2);

  expect(search.replace("cow")).toBe(false);
  expect(search.replaceAll("cow")).toBe(false);
  expect(editor().getText()).toBe("cat dog cat");
});

test("the panel and the Commands share one search: a replace from code shows in the panel", async () => {
  const user = userEvent.setup();
  const { handle, editor } = renderEditor();
  await user.click(screen.getByRole("button", { name: "Find" }));
  await user.type(await screen.findByRole("textbox", { name: "Find" }), "cat");
  expect(screen.getByText("1 / 2")).toBeDefined();

  act(() => void handle().tool("search")!.replaceAll("cow"));
  expect(editor().getText()).toBe("cow dog cow");
  expect(screen.getByText("0 / 0")).toBeDefined();
  expect(within(panel()!).getByRole("status").textContent).toBe("No matches");
});

// ---------------------------------------------------------------- toc

const WITH_TOC = [...RICH_TEXT_PRESETS.full, "toc"] as const;

async function renderWithToc(props: Partial<RichTextEditorProps> = {}) {
  const view = renderEditor({ defaultValue: ARTICLE, tools: [...WITH_TOC], ...props });
  await waitFor(() => expect(strip()).not.toBeNull());
  return view;
}

test("jumpTo() in an editable Editor puts the caret at the end of the heading", async () => {
  const { handle, editor } = await renderWithToc();

  let result = false;
  act(() => {
    result = handle().tool("toc")!.jumpTo(2);
  });
  expect(result).toBe(true);

  expect(editor().isFocused).toBe(true);
  const { $from, empty } = editor().state.selection;
  expect(empty).toBe(true);
  expect($from.parent.type.name).toBe("heading");
  expect($from.parent.textContent).toBe("How to read");
  expect($from.parentOffset).toBe("How to read".length);
});

test("jumpTo() in a read-only Editor focuses the heading", async () => {
  const { handle } = await renderWithToc({ readOnly: true });
  act(() => void handle().tool("toc")!.jumpTo(4));
  expect(document.activeElement?.tagName).toBe("H2");
  expect(document.activeElement?.textContent).toBe("What's next");
});

test("jumpTo() does what a click on the list item does: scroll, flash, the current section", async () => {
  const user = userEvent.setup();
  const { handle, editor } = await renderWithToc();
  const heading = [...editor().view.dom.querySelectorAll("h3")][0]!;
  heading.getBoundingClientRect = () => ({ top: 500 }) as DOMRect;

  // Клик по пункту — образец.
  await user.click(strip()!);
  const items = within(screen.getByRole("navigation", { name: "Table of contents" })).getAllByRole(
    "button"
  );
  await user.click(items[2]!);
  const byClick = scrollTo.mock.calls.at(-1)![0] as { top: number };
  expect(animate).toHaveBeenCalledTimes(1);
  expect(animate.mock.contexts[0]).toBe(heading);

  scrollTo.mockClear();
  animate.mockClear();
  act(() => void handle().tool("toc")!.jumpTo(2));
  const byCommand = scrollTo.mock.calls.at(-1)![0] as { top: number };
  expect(byCommand).toEqual(byClick);
  expect(animate).toHaveBeenCalledTimes(1);
  expect(animate.mock.contexts[0]).toBe(heading);
  // Пункт «как у клика» подсвечен текущим.
  await waitFor(() =>
    expect(
      screen
        .getAllByRole("button", { name: "How to read" })
        .some((item) => item.getAttribute("aria-current") === "location")
    ).toBe(true)
  );
});

test("jumpTo() scrolls under the header named by offsetVar", async () => {
  document.documentElement.style.setProperty("--header-h", "80px");
  document.documentElement.style.setProperty("--topbar-h", "30px");
  const { handle, editor } = await renderWithToc({
    tools: [...RICH_TEXT_PRESETS.full, tool("toc", { offsetVar: "--header-h" })],
  });
  const heading = [...editor().view.dom.querySelectorAll("h3")][0]!;
  heading.getBoundingClientRect = () => ({ top: 500 }) as DOMRect;

  scrollTo.mockClear();
  act(() => void handle().tool("toc")!.jumpTo(2));
  expect((scrollTo.mock.calls.at(-1)![0] as { top: number }).top).toBe(500 - 80);
});

test("the index counts the list as drawn: levels cut the others off", async () => {
  const { handle, editor } = await renderWithToc({
    tools: [...RICH_TEXT_PRESETS.full, tool("toc", { levels: [2, 3] })],
  });
  const search = () => handle().tool("toc")!;

  act(() => void search().jumpTo(1));
  expect(editor().state.selection.$from.parent.textContent).toBe("How to read");
  act(() => void search().jumpTo(2));
  expect(editor().state.selection.$from.parent.textContent).toBe("What's next");
});

test("jumpTo() is false for an index outside the list", async () => {
  const { handle } = await renderWithToc();
  const toc = handle().tool("toc")!;
  scrollTo.mockClear();
  for (const index of [-1, 5, 1.5, Number.NaN]) expect(toc.jumpTo(index)).toBe(false);
  expect(scrollTo).not.toHaveBeenCalled();
});

test("jumpTo() works with one heading: the threshold of two is about drawing the strip", async () => {
  const { handle, editor } = renderEditor({
    defaultValue: "<h2>Only</h2><p>Text</p>",
    tools: [...WITH_TOC],
  });
  await settle();
  expect(strip()).toBeNull();

  let result = false;
  act(() => {
    result = handle().tool("toc")!.jumpTo(0);
  });
  expect(result).toBe(true);
  expect(editor().state.selection.$from.parent.textContent).toBe("Only");
});

test("jumpTo() follows the Document: a heading added by the author is in the list", async () => {
  const { handle, editor } = await renderWithToc();
  act(() => void editor().commands.setContent("<h2>One</h2><p>Text</p><h2>Two</h2><p>Text</p>"));
  await waitFor(() => expect(strip()!.querySelectorAll("[data-toc-stroke]")).toHaveLength(2));

  act(() => void handle().tool("toc")!.jumpTo(1));
  expect(editor().state.selection.$from.parent.textContent).toBe("Two");
});

test("jumpTo() is false in the HTML mode: the Document is hidden", async () => {
  const user = userEvent.setup();
  const { handle } = await renderWithToc();
  await user.click(screen.getByRole("button", { name: "HTML" }));
  expect(handle().tool("toc")!.jumpTo(0)).toBe(false);
});

// ---------------------------------------------------------------- openSearch (устарел)

test("handle.openSearch() still opens the panel, with the replace focus on request", async () => {
  const { handle } = renderEditor();
  act(() => handle().openSearch({ replace: true }));
  await screen.findByRole("search", { name: "Find and replace" });
  await waitFor(() => expect(document.activeElement).toBe(replaceField()));
});

test("handle.openSearch() warns once in development, however many times it is called", async () => {
  const { handle } = renderEditor();
  act(() => handle().openSearch());
  act(() => handle().openSearch({ replace: true }));
  act(() => handle().openSearch());

  const messages = warn.mock.calls.map((call: unknown[]) => String(call[0]));
  expect(messages).toHaveLength(1);
  expect(messages[0]).toMatch(/openSearch\(\) is deprecated/);
  expect(messages[0]).toContain('handle.tool("search")?.open()');
});

test("handle.openSearch() without the search tool does nothing", async () => {
  const { handle } = renderEditor({ tools: ["bold"] });
  act(() => handle().openSearch());
  await settle();
  expect(panel()).toBeNull();
});

test("the Commands of the search tool do not warn", () => {
  const { handle } = renderEditor();
  act(() => void handle().tool("search")!.setQuery("cat"));
  act(() => void handle().tool("search")!.open());
  expect(warn).not.toHaveBeenCalled();
});
