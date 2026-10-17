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
import { loadLazyBuiltins } from "./editor-lazy-builtins.js";

/**
 * Options of the built-in Tools (OLDSUI-268): `tool("toc", …)` and
 * `tool("search", …)` in `tools`. The checks go through the public
 * `RichTextEditor`, the way a screen will write them.
 */

beforeAll(loadLazyBuiltins);
// The Search panel is a lazy chunk: warm it up so `findBy` does not wait on the network.
beforeAll(() => import("../src/editor/features/search/SearchPanel.js"));

let error: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  resetDevWarnings();
  error = vi.spyOn(console, "error").mockImplementation(() => {});
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  document.documentElement.removeAttribute("style");
});

const ARTICLE =
  "<h1>Title</h1><p>Intro</p><h2>Palette</h2><p>Text</p><h3>How to read</h3><p>Text</p>" +
  "<h4>Neutrals</h4><p>Text</p><h2>What's next</h2><p>Outro</p>";

function renderEditor(props: Partial<RichTextEditorProps> = {}) {
  const ref = createRef<RichTextEditorHandle>();
  const view = render(<RichTextEditor ref={ref} aria-label="Body" {...props} />);
  return { ...view, ref };
}

const strip = () => screen.queryByRole("button", { name: "Table of contents" });
const strokes = () => strip()?.querySelectorAll("[data-toc-stroke]").length;

async function openList(user: ReturnType<typeof userEvent.setup>) {
  await user.click(strip()!);
  return within(screen.getByRole("navigation", { name: "Table of contents" })).getAllByRole(
    "button"
  );
}

/** Loader promises and Editor effects have settled. */
const settle = () =>
  act(async () => void (await new Promise((resolve) => setTimeout(resolve, 10))));

// ---------------------------------------------------------------- toc

test('tool("toc") switches the table of contents on without the name in tools', async () => {
  renderEditor({ defaultValue: ARTICLE, tools: [...RICH_TEXT_PRESETS.full, tool("toc")] });
  await waitFor(() => expect(strip()).not.toBeNull());
  expect(strokes()).toBe(5);

  cleanup();
  // Exact list: there is no `"toc"` name in it, and a single `tool()` entry enables the Tool.
  renderEditor({ defaultValue: ARTICLE, tools: ["heading", "heading1", tool("toc")] });
  await waitFor(() => expect(strip()).not.toBeNull());
  expect(strokes()).toBe(5);
});

test("levels cuts the other levels off the strip and the list", async () => {
  const user = userEvent.setup();
  renderEditor({
    defaultValue: ARTICLE,
    tools: [...RICH_TEXT_PRESETS.full, tool("toc", { levels: [2, 3] })],
  });
  await waitFor(() => expect(strip()).not.toBeNull());

  expect(strokes()).toBe(3);
  const items = await openList(user);
  expect(items.map((item) => item.textContent)).toEqual(["Palette", "How to read", "What's next"]);
});

test("without levels the table of contents shows all four levels", async () => {
  const user = userEvent.setup();
  renderEditor({ defaultValue: ARTICLE, tools: [...RICH_TEXT_PRESETS.full, tool("toc", {})] });
  await waitFor(() => expect(strip()).not.toBeNull());

  const items = await openList(user);
  expect(items.map((item) => item.textContent)).toEqual([
    "Title",
    "Palette",
    "How to read",
    "Neutrals",
    "What's next",
  ]);
});

test("the gutter is gone when levels leave fewer than two headings", async () => {
  renderEditor({
    defaultValue: ARTICLE,
    tools: [...RICH_TEXT_PRESETS.full, tool("toc", { levels: [3] })],
  });
  await settle();
  expect(strip()).toBeNull();
  expect(document.querySelector("[data-toc-gutter]")).toBeNull();
});

test("listWidth sets the width of the list, 240px by default", async () => {
  const user = userEvent.setup();
  renderEditor({
    defaultValue: ARTICLE,
    tools: [...RICH_TEXT_PRESETS.full, tool("toc", { listWidth: "20rem" })],
  });
  await waitFor(() => expect(strip()).not.toBeNull());
  await openList(user);
  const panel = screen.getByRole("navigation", { name: "Table of contents" }).parentElement!;
  expect(panel.style.width).toBe("20rem");

  cleanup();
  renderEditor({ defaultValue: ARTICLE, tools: [...RICH_TEXT_PRESETS.full, tool("toc")] });
  await waitFor(() => expect(strip()).not.toBeNull());
  await openList(user);
  expect(
    screen.getByRole("navigation", { name: "Table of contents" }).parentElement!.style.width
  ).toBe("240px");
});

test("offsetVar is the sticky edge a jump scrolls under, --topbar-h by default", async () => {
  const user = userEvent.setup();
  const scrollTo = vi.fn();
  window.scrollTo = scrollTo as unknown as typeof window.scrollTo;
  document.documentElement.style.setProperty("--header-h", "80px");
  document.documentElement.style.setProperty("--topbar-h", "30px");

  const jump = async (tools: RichTextEditorProps["tools"]) => {
    const { ref, unmount } = renderEditor({ defaultValue: ARTICLE, tools });
    await waitFor(() => expect(strip()).not.toBeNull());
    const heading = [...ref.current!.editor!.view.dom.querySelectorAll("h3")][0]!;
    heading.getBoundingClientRect = () => ({ top: 500 }) as DOMRect;
    scrollTo.mockClear();
    await user.click((await openList(user))[2]!);
    unmount();
    return scrollTo.mock.calls.at(-1)?.[0] as { top: number };
  };

  const custom = await jump([...RICH_TEXT_PRESETS.full, tool("toc", { offsetVar: "--header-h" })]);
  expect(custom.top).toBe(500 - 80);
  const standard = await jump([...RICH_TEXT_PRESETS.full, tool("toc")]);
  expect(standard.top).toBe(500 - 30);
});

test("a Configured Tool beats the bare name of the same tool in tools", async () => {
  renderEditor({
    defaultValue: ARTICLE,
    tools: [...RICH_TEXT_PRESETS.full, "toc", tool("toc", { levels: [2] })],
  });
  await waitFor(() => expect(strip()).not.toBeNull());
  expect(strokes()).toBe(2);
  expect(error).not.toHaveBeenCalled();
});

// ---------------------------------------------------------------- search

/** Checkbox or switch is on: in RAC this is `aria-checked`, or a `checked` property inside. */
const isOn = (control: HTMLElement) =>
  control.getAttribute("aria-checked") === "true" || (control as HTMLInputElement).checked === true;

const findButton = () => screen.getByRole("button", { name: "Find" });

test("search options set the starting flags of the panel; they stay switchable", async () => {
  const user = userEvent.setup();
  const { ref } = renderEditor({
    defaultValue: "<p>Cat cat</p>",
    tools: [...RICH_TEXT_PRESETS.full, tool("search", { matchCase: true })],
  });
  await user.click(findButton());
  await screen.findByRole("search", { name: "Find and replace" });

  const matchCase = screen.getByRole("checkbox", { name: "Match case" });
  expect(isOn(matchCase)).toBe(true);
  expect(isOn(screen.getByRole("checkbox", { name: "Whole words" }))).toBe(false);

  // "Match case" works from the first character.
  await user.keyboard("cat");
  expect(searchState(ref.current!.editor!.state)).toMatchObject({ total: 1 });

  // And it stays toggleable.
  await user.click(matchCase);
  expect(searchState(ref.current!.editor!.state)).toMatchObject({ total: 2 });
});

test("wholeWord and regex start switched on too, and all flags are off by default", async () => {
  const user = userEvent.setup();
  renderEditor({
    tools: [tool("search", { wholeWord: true, regex: true })],
  });
  await user.click(findButton());
  await screen.findByRole("search", { name: "Find and replace" });
  expect(isOn(screen.getByRole("checkbox", { name: "Whole words" }))).toBe(true);
  expect(isOn(screen.getByRole("switch", { name: "Regular expression" }))).toBe(true);
  expect(isOn(screen.getByRole("checkbox", { name: "Match case" }))).toBe(false);

  cleanup();
  renderEditor({ tools: [tool("search")] });
  await user.click(findButton());
  await screen.findByRole("search", { name: "Find and replace" });
  expect(isOn(screen.getByRole("checkbox", { name: "Match case" }))).toBe(false);
  expect(isOn(screen.getByRole("switch", { name: "Regular expression" }))).toBe(false);
});

test("the starting flags reach the panel opened by the handle too", async () => {
  const { ref } = renderEditor({
    defaultValue: "<p>Cat cat</p>",
    tools: [tool("search", { matchCase: true })],
  });
  act(() => ref.current!.openSearch());
  await screen.findByRole("search", { name: "Find and replace" });
  expect(isOn(screen.getByRole("checkbox", { name: "Match case" }))).toBe(true);
});

test("a preset with a Configured search has one Find button and one panel", async () => {
  const user = userEvent.setup();
  renderEditor({ tools: [...RICH_TEXT_PRESETS.full, tool("search", { matchCase: true })] });
  expect(screen.getAllByRole("button", { name: "Find" })).toHaveLength(1);
  await user.click(findButton());
  expect(await screen.findAllByRole("search", { name: "Find and replace" })).toHaveLength(1);
  expect(error).not.toHaveBeenCalled();
});

test("a Configured Tool takes the place of the bare name on the surface", () => {
  const { unmount } = renderEditor({ tools: [...RICH_TEXT_PRESETS.basic] });
  const bare = screen.getAllByRole("button").map((button) => button.getAttribute("aria-label"));
  unmount();
  renderEditor({ tools: [...RICH_TEXT_PRESETS.basic, tool("search", { matchCase: true })] });
  const configured = screen
    .getAllByRole("button")
    .map((button) => button.getAttribute("aria-label"));
  expect(configured).toEqual(bare);
});

// ---------------------------------------------------------------- tool set

test("two tool() entries with one name are a tool set error: the field and the console", async () => {
  renderEditor({
    tools: [...RICH_TEXT_PRESETS.full, tool("search", { matchCase: true }), tool("search")],
  });
  await settle();
  expect(screen.getByRole("alert").textContent).toMatch(/couldn't start/);
  expect(error).toHaveBeenCalledTimes(1);
  expect(error.mock.calls[0]![0]).toMatch(/^RichTextEditor: tool "search": /);
});

test("a wrong value of a built-in option is replaced by the default with one console.error", async () => {
  const user = userEvent.setup();
  renderEditor({
    defaultValue: ARTICLE,
    tools: [
      ...RICH_TEXT_PRESETS.full,
      // From JS without types: level 7, and width is an object.
      tool("toc", { levels: [2, 7], listWidth: {} } as never),
    ],
  });
  await waitFor(() => expect(strip()).not.toBeNull());

  // The field works, and the values are the defaults.
  expect(strokes()).toBe(5);
  const items = await openList(user);
  expect(items).toHaveLength(5);
  expect(
    screen.getByRole("navigation", { name: "Table of contents" }).parentElement!.style.width
  ).toBe("240px");
  expect(screen.queryByRole("alert")).toBeNull();
  expect(error).toHaveBeenCalledTimes(1);
  expect(error.mock.calls[0]![0]).toMatch(/^RichTextEditor: tool "toc": /);
});

test("a wrong flag of search is replaced by the default too", async () => {
  const user = userEvent.setup();
  renderEditor({ tools: [tool("search", { matchCase: "yes" } as never)] });
  await user.click(findButton());
  await screen.findByRole("search", { name: "Find and replace" });
  expect(isOn(screen.getByRole("checkbox", { name: "Match case" }))).toBe(false);
  expect(error).toHaveBeenCalledTimes(1);
});

test("options are read once, together with the set: a new tool() does not change a mounted Editor", async () => {
  const { rerender } = render(
    <RichTextEditor
      aria-label="Body"
      defaultValue={ARTICLE}
      tools={[...RICH_TEXT_PRESETS.full, tool("toc", { levels: [2] })]}
    />
  );
  await waitFor(() => expect(strip()).not.toBeNull());
  expect(strokes()).toBe(2);
  rerender(
    <RichTextEditor
      aria-label="Body"
      defaultValue={ARTICLE}
      tools={[...RICH_TEXT_PRESETS.full, tool("toc", { levels: [2, 3, 4] })]}
    />
  );
  await settle();
  expect(strokes()).toBe(2);
});
