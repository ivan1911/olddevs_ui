// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { memo, useRef, useState, type ComponentProps, type RefObject } from "react";
import { afterEach, beforeAll, beforeEach, expect, test, vi } from "vitest";
import {
  RICH_TEXT_PRESETS,
  RichTextEditor,
  tool,
  useRichTextToolState,
  type RichTextEditorHandle,
  type Tool,
} from "../src/editor/index.js";
import { loadLazyBuiltins } from "./editor-lazy-builtins.js";
import { installPageGeometry } from "./editor-toc-geometry.js";

/**
 * Состояние Инструмента (OLDSUI-268): `useRichTextToolState` на публичном входе.
 * Экран читает снимок `search` и `toc`; сдвигают его действия пользователя и
 * Хэндл, как в жизни.
 */

beforeAll(loadLazyBuiltins);
// Панель Поиска — ленивый чанк: прогреваем, чтобы `findBy` не ждал сеть.
beforeAll(() => import("../src/editor/features/search/SearchPanel.js"));

let removeGeometry: () => void;

beforeEach(() => {
  removeGeometry = installPageGeometry();
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  removeGeometry();
});

type EditorProps = Partial<ComponentProps<typeof RichTextEditor>>;

/**
 * Экран с хуком: `read` вызывает хук с `ref` Редактора, а замер собирает всё,
 * что хук отдал экрану, и число рендеров.
 */
function mount<Result>(
  read: (ref: RefObject<RichTextEditorHandle | null>) => Result,
  props: EditorProps = {}
) {
  const seen = { renders: 0, results: [] as Result[] };
  let handle: RefObject<RichTextEditorHandle | null> | undefined;

  function Screen() {
    const ref = useRef<RichTextEditorHandle>(null);
    handle = ref;
    const result = read(ref);
    seen.renders += 1;
    seen.results.push(result);
    return <RichTextEditor ref={ref} aria-label="Body" {...props} />;
  }

  render(<Screen />);
  return {
    seen,
    ref: handle!,
    last: () => seen.results.at(-1) as Result,
    editor: () => handle!.current!.editor!,
  };
}

// --- Поиск --------------------------------------------------------------------------------

const findButton = () => screen.getByRole("button", { name: "Find" });
const findField = () => screen.getByRole("textbox", { name: "Find" });

test("search: null in the first render, then a closed panel and no matches", () => {
  const screenResult = mount((ref) => useRichTextToolState(ref, "search"), {
    defaultValue: "<p>cat dog cat</p>",
  });

  // Документ создан после первого рендера экрана: до того хук молчит.
  expect(screenResult.seen.results[0]).toBeNull();
  expect(screenResult.last()).toEqual({
    open: false,
    query: "",
    flags: { matchCase: false, wholeWord: false, regex: false },
    total: 0,
    current: -1,
    error: null,
  });
});

test("search: the snapshot follows opening, typing, stepping and closing", async () => {
  const user = userEvent.setup();
  const screenResult = mount((ref) => useRichTextToolState(ref, "search"), {
    defaultValue: "<p>cat dog cat</p>",
  });

  await user.click(findButton());
  await screen.findByRole("search", { name: "Find and replace" });
  await waitFor(() => expect(screenResult.last()?.open).toBe(true));

  await user.type(findField(), "cat");
  expect(screenResult.last()).toMatchObject({ open: true, query: "cat", total: 2, current: 0 });

  await user.keyboard("{Enter}");
  expect(screenResult.last()).toMatchObject({ total: 2, current: 1 });

  await user.keyboard("{Escape}");
  await waitFor(() => expect(screenResult.last()?.open).toBe(false));
  expect(screenResult.last()).toMatchObject({ query: "", total: 0, current: -1 });
});

test("search: the flags and the regular expression error are in the snapshot", async () => {
  const user = userEvent.setup();
  const screenResult = mount((ref) => useRichTextToolState(ref, "search"), {
    defaultValue: "<p>Cat cat</p>",
  });

  await user.click(findButton());
  await screen.findByRole("search", { name: "Find and replace" });
  await user.type(findField(), "cat");
  expect(screenResult.last()?.total).toBe(2);

  await user.click(screen.getByRole("checkbox", { name: "Match case" }));
  expect(screenResult.last()).toMatchObject({
    flags: { matchCase: true, wholeWord: false, regex: false },
    total: 1,
  });

  await user.click(screen.getByRole("switch", { name: "Regular expression" }));
  await user.clear(findField());
  await user.type(findField(), "(");
  const state = screenResult.last()!;
  expect(state.flags.regex).toBe(true);
  expect(state.total).toBe(0);
  expect(typeof state.error).toBe("string");
});

test("search: while the panel is closed the flags are the start options of the tool", async () => {
  const screenResult = mount((ref) => useRichTextToolState(ref, "search"), {
    tools: [...RICH_TEXT_PRESETS.full, tool("search", { regex: true })],
    defaultValue: "<p>cat</p>",
  });

  expect(screenResult.last()?.flags).toEqual({ matchCase: false, wholeWord: false, regex: true });
});

test("search: the selector takes a slice and the screen re-renders only when the slice changes", async () => {
  const user = userEvent.setup();
  const screenResult = mount((ref) => useRichTextToolState(ref, "search", (state) => state.total), {
    defaultValue: "<p>cat dog cat</p>",
  });
  expect(screenResult.seen.results[0]).toBeNull();
  expect(screenResult.last()).toBe(0);

  await user.click(findButton());
  await screen.findByRole("search", { name: "Find and replace" });
  await user.type(findField(), "cat");
  expect(screenResult.last()).toBe(2);

  // Переход к следующему совпадению срез `total` не меняет — экран не трогается.
  const before = screenResult.seen.renders;
  await user.keyboard("{Enter}");
  expect(screenResult.seen.renders).toBe(before);
});

test("search: typing that leaves the snapshot as it was does not re-render the screen", async () => {
  const screenResult = mount((ref) => useRichTextToolState(ref, "search"), {
    defaultValue: "<p>cat dog cat</p>",
  });
  const editor = screenResult.editor();

  const before = screenResult.seen.renders;
  act(() => void editor.commands.insertContentAt(9, "x", { updateSelection: false }));
  act(() => void editor.commands.insertContentAt(10, "y", { updateSelection: false }));
  act(() => void editor.commands.setTextSelection(3));
  expect(screenResult.seen.renders).toBe(before);
});

test("search: typing in the Document moves the snapshot when the matches change", async () => {
  const user = userEvent.setup();
  const screenResult = mount((ref) => useRichTextToolState(ref, "search", (state) => state.total), {
    defaultValue: "<p>cat dog</p>",
  });
  await user.click(findButton());
  await screen.findByRole("search", { name: "Find and replace" });
  await user.type(findField(), "cat");
  expect(screenResult.last()).toBe(1);

  act(
    () => void screenResult.editor().commands.insertContentAt(8, " cat", { updateSelection: false })
  );
  expect(screenResult.last()).toBe(2);
});

test("search: the handle's openSearch() moves the snapshot", async () => {
  const screenResult = mount((ref) => useRichTextToolState(ref, "search", (state) => state.open), {
    defaultValue: "<p>cat</p>",
  });
  expect(screenResult.last()).toBe(false);

  act(() => screenResult.ref.current!.openSearch());
  await waitFor(() => expect(screenResult.last()).toBe(true));
});

test("null without the tool in the set", () => {
  const search = mount((ref) => useRichTextToolState(ref, "search"), {
    tools: ["bold", "italic"],
    defaultValue: "<p>cat</p>",
  });
  expect(search.last()).toBeNull();
  cleanup();

  // `toc` не входит в пресеты — без имени в `tools` Инструмента нет.
  const toc = mount((ref) => useRichTextToolState(ref, "toc"), {
    defaultValue: "<h2>One</h2><h2>Two</h2>",
  });
  expect(toc.last()).toBeNull();
});

test("a name outside the map is null: an unknown tool has no state yet", () => {
  const screenResult = mount((ref) => useRichTextToolState(ref, "acme_unknown"), {
    defaultValue: "<p>x</p>",
  });
  expect(screenResult.last()).toBeNull();
});

test("the hook gives null after the Editor unmounts, even in a component that does not re-render", async () => {
  let setShow: (show: boolean) => void = () => {};
  let ref!: RefObject<RichTextEditorHandle | null>;
  // `memo` без пропов: родитель его не перерисует, о размонтировании он узнаёт только от хука.
  const Counter = memo(function Counter({
    source,
  }: {
    source: RefObject<RichTextEditorHandle | null>;
  }) {
    const total = useRichTextToolState(source, "search", (state) => state.total);
    return <output aria-label="Total">{total === null ? "none" : String(total)}</output>;
  });
  function Screen() {
    const [show, set] = useState(true);
    setShow = set;
    ref = useRef<RichTextEditorHandle>(null);
    return (
      <>
        {show && <RichTextEditor ref={ref} aria-label="Body" defaultValue="<p>cat cat</p>" />}
        <Counter source={ref} />
      </>
    );
  }
  render(<Screen />);
  const total = () => screen.getByLabelText("Total").textContent;
  expect(total()).toBe("0");

  act(() => void ref.current!.tool("search")!.setQuery("cat"));
  expect(total()).toBe("2");

  act(() => setShow(false));
  expect(total()).toBe("none");
});

test("a new mount under the same ref starts from its own signals, not the section of the old Editor", async () => {
  const user = userEvent.setup();
  let setShow: (show: boolean) => void = () => {};
  const seen: (number | null)[] = [];
  function Screen() {
    const [show, set] = useState(true);
    setShow = set;
    const ref = useRef<RichTextEditorHandle>(null);
    seen.push(useRichTextToolState(ref, "toc", (state) => state.current));
    return show ? (
      <RichTextEditor ref={ref} aria-label="Body" tools={WITH_TOC} defaultValue={ARTICLE} />
    ) : null;
  }
  render(<Screen />);
  await waitFor(() => expect(strip()).not.toBeNull());
  const items = await openList(user);
  await user.click(items[3]!);
  expect(seen.at(-1)).toBe(3);

  act(() => setShow(false));
  expect(seen.at(-1)).toBeNull();

  // Тот же `ref`, новый Редактор: «текущий раздел» старого в его снимок не попадает.
  const before = seen.length;
  act(() => setShow(true));
  await waitFor(() => expect(strip()).not.toBeNull());
  const fresh = seen.slice(before).filter((value) => value !== null);
  expect(fresh.length).toBeGreaterThan(0);
  expect(fresh).not.toContain(3);
});

// --- Оглавление ---------------------------------------------------------------------------

const ARTICLE =
  "<h1>Palette</h1><p>Intro</p><h2>How to read</h2><p>Text</p><h3>Neutrals</h3><h2>What's next</h2>";

const WITH_TOC: Tool[] = [...RICH_TEXT_PRESETS.full, "toc"];

const strip = () => screen.queryByRole("button", { name: "Table of contents" });

async function openList(user: ReturnType<typeof userEvent.setup>) {
  await user.click(strip()!);
  return within(screen.getByRole("navigation", { name: "Table of contents" })).getAllByRole(
    "button"
  );
}

test("toc: the headings with level, text and index, and the first section as current", () => {
  const screenResult = mount((ref) => useRichTextToolState(ref, "toc"), {
    tools: WITH_TOC,
    defaultValue: ARTICLE,
  });

  expect(screenResult.seen.results[0]).toBeNull();
  expect(screenResult.last()).toEqual({
    headings: [
      { level: 1, text: "Palette", index: 0 },
      { level: 2, text: "How to read", index: 1 },
      { level: 3, text: "Neutrals", index: 2 },
      { level: 2, text: "What's next", index: 3 },
    ],
    current: 0,
  });
});

test("toc: the levels option cuts the levels and the indices count what is left", () => {
  const screenResult = mount((ref) => useRichTextToolState(ref, "toc"), {
    tools: [...RICH_TEXT_PRESETS.full, tool("toc", { levels: [2, 3] })],
    defaultValue: ARTICLE,
  });

  expect(screenResult.last()?.headings).toEqual([
    { level: 2, text: "How to read", index: 0 },
    { level: 3, text: "Neutrals", index: 1 },
    { level: 2, text: "What's next", index: 2 },
  ]);
});

test("toc: the data is given with one heading and with none, before the strip is drawn", () => {
  const one = mount((ref) => useRichTextToolState(ref, "toc"), {
    tools: WITH_TOC,
    defaultValue: "<h2>Only</h2><p>Text</p>",
  });
  expect(one.last()).toEqual({ headings: [{ level: 2, text: "Only", index: 0 }], current: 0 });
  expect(strip()).toBeNull();
  cleanup();

  const none = mount((ref) => useRichTextToolState(ref, "toc"), {
    tools: WITH_TOC,
    defaultValue: "<p>No headings</p>",
  });
  expect(none.last()).toEqual({ headings: [], current: -1 });
});

test("toc: the snapshot and the list items are the same headings in the same order", async () => {
  const user = userEvent.setup();
  const screenResult = mount((ref) => useRichTextToolState(ref, "toc"), {
    tools: WITH_TOC,
    defaultValue:
      "<h1>Top</h1>" +
      '<div data-block="wrapper" data-tone="accent"><h2>In wrapper</h2><p>x</p></div>' +
      '<div data-block="layout" data-layout="50-50"><div data-block="column"><h2>Left</h2></div>' +
      '<div data-block="column"><h2>Right</h2></div></div>' +
      "<h2>   </h2><blockquote><h3>In quote</h3></blockquote><h4>Last</h4>",
  });
  await waitFor(() => expect(strip()).not.toBeNull());

  const items = await openList(user);
  const listed = items.map((item) => item.textContent);
  expect(listed).toEqual(["Top", "In wrapper", "Last"]);
  expect(screenResult.last()?.headings.map((heading) => heading.text)).toEqual(listed);
  expect(screenResult.last()?.headings.map((heading) => heading.index)).toEqual([0, 1, 2]);
});

test("toc: editing the headings moves the snapshot, editing the paragraphs does not", async () => {
  const screenResult = mount((ref) => useRichTextToolState(ref, "toc"), {
    tools: WITH_TOC,
    defaultValue: "<h2>One</h2><p>Text</p><h2>Two</h2>",
  });
  const editor = screenResult.editor();

  const before = screenResult.seen.renders;
  act(() => void editor.commands.insertContentAt(8, "more", { updateSelection: false }));
  act(() => void editor.commands.setTextSelection(3));
  expect(screenResult.seen.renders).toBe(before);

  act(() => void editor.commands.insertContentAt(4, "!", { updateSelection: false }));
  expect(screenResult.last()?.headings.map((heading) => heading.text)).toEqual(["One!", "Two"]);

  act(() => void editor.commands.setContent("<h2>One!</h2><h3>Fresh</h3><h2>Two</h2>"));
  expect(screenResult.last()?.headings).toHaveLength(3);
});

test("toc: a click on a list item makes its section current", async () => {
  const user = userEvent.setup();
  const screenResult = mount((ref) => useRichTextToolState(ref, "toc", (state) => state.current), {
    tools: WITH_TOC,
    defaultValue: ARTICLE,
  });
  await waitFor(() => expect(strip()).not.toBeNull());

  const items = await openList(user);
  await user.click(items[1]!);
  expect(screenResult.last()).toBe(1);
  await user.click(items[2]!);
  expect(screenResult.last()).toBe(2);
});

test("toc: a current section that no longer exists is pulled back into the list", async () => {
  const user = userEvent.setup();
  const screenResult = mount((ref) => useRichTextToolState(ref, "toc", (state) => state.current), {
    tools: WITH_TOC,
    defaultValue: ARTICLE,
  });
  await waitFor(() => expect(strip()).not.toBeNull());
  const items = await openList(user);
  await user.click(items[3]!);
  expect(screenResult.last()).toBe(3);

  act(() => void screenResult.editor().commands.setContent("<h2>Only</h2><p>Text</p>"));
  expect(screenResult.last()).toBe(0);
  act(() => void screenResult.editor().commands.setContent("<p>Nothing</p>"));
  expect(screenResult.last()).toBe(-1);
});
