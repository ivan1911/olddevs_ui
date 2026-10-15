// @vitest-environment jsdom
import { Node } from "@tiptap/core";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { createRef, useRef, type ComponentProps, type RefObject } from "react";
import { afterEach, beforeAll, beforeEach, expect, test, vi } from "vitest";
import {
  defineTool,
  RICH_TEXT_PRESETS,
  RichTextEditor,
  tool,
  useRichTextToolState,
  type RichTextEditorHandle,
} from "../src/editor/index.js";
import { resetDevWarnings } from "../src/lib/dev-warn.js";
import { PinIcon } from "../src/icons.js";
import { testLazyTool } from "./editor-test-tools.js";
import { loadLazyBuiltins } from "./editor-lazy-builtins.js";

/**
 * Свой Инструмент через `defineTool` (OLDSUI-268): умолчания и слияние опций,
 * Состояние на транзакции, Команды через Хэндл и правила набора. Проверки идут
 * через публичный `RichTextEditor`, как их увидит экран.
 */

beforeAll(loadLazyBuiltins);

let error: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  resetDevWarnings();
  error = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const noteNode = Node.create({ name: "test_note", group: "block", content: "inline*" });

/** Заметка с вложенными подписями, списком и функцией — все виды значений для правила слияния. */
const note = defineTool({
  name: "test_note",
  defaults: {
    labels: { insert: "Add note", remove: "Remove note" },
    tags: ["draft", "todo"],
    tone: "info",
    format: (text: string) => `[${text}]`,
  },
  create: (options) => ({
    engine: [noteNode],
    blocks: { test_note: { kind: "block" } },
    insertItems: [
      {
        section: "insert",
        label: options.labels.insert,
        icon: PinIcon,
        run: (chain) => chain.insertContent({ type: "test_note" }),
      },
    ],
    buttons: [
      {
        id: "remove",
        label: options.labels.remove,
        icon: PinIcon,
        can: () => true,
        run: () => {},
      },
    ],
  }),
  state: ({ editor, options }) => {
    let notes = 0;
    editor.state.doc.descendants((node) => {
      if (node.type.name === "test_note") notes += 1;
    });
    return { notes, tone: options.tone };
  },
  commands: ({ editor, options }) => ({
    add: (text: string) =>
      editor.commands.insertContent({
        type: "test_note",
        content: [{ type: "text", text: options.format(text) }],
      }),
    options: () => options,
  }),
});

type EditorProps = Partial<ComponentProps<typeof RichTextEditor>>;

function renderEditor(props: EditorProps = {}) {
  const ref = createRef<RichTextEditorHandle>();
  const view = render(
    <RichTextEditor
      ref={ref}
      aria-label="Body"
      defaultValue="<p>Hello</p>"
      tools={[...RICH_TEXT_PRESETS.full, note]}
      {...props}
    />
  );
  return { ...view, ref, handle: () => ref.current! };
}

/** Опции, которые увидели Команды Инструмента: слитые умолчания и `tool()`. */
const optionsOf = (handle: RichTextEditorHandle) =>
  (handle.tool("test_note") as { options(): Record<string, unknown> }).options();

// ---------------------------------------------------------------- умолчания и слияние

test("a definition in tools works with its defaults and no tool()", () => {
  const { handle } = renderEditor();
  expect(screen.getByRole("button", { name: "Remove note" })).toBeDefined();
  expect(optionsOf(handle()).labels).toEqual({ insert: "Add note", remove: "Remove note" });
  expect(optionsOf(handle()).tone).toBe("info");
});

test("tool(definition, options) merges nested objects and replaces arrays and functions", () => {
  const format = (text: string) => `<${text}>`;
  const { handle } = renderEditor({
    tools: [
      ...RICH_TEXT_PRESETS.full,
      tool(note, { labels: { remove: "Delete note" }, tags: ["new"], format }),
    ],
  });

  // Своя подпись видна в UI-записи, нетронутая — осталась умолчанием.
  expect(screen.getByRole("button", { name: "Delete note" })).toBeDefined();
  expect(screen.queryByRole("button", { name: "Remove note" })).toBeNull();
  const options = optionsOf(handle());
  expect(options.labels).toEqual({ insert: "Add note", remove: "Delete note" });
  // Массив и функция — значением целиком.
  expect(options.tags).toEqual(["new"]);
  expect(options.format).toBe(format);
  expect(options.tone).toBe("info");
});

test("an undefined option falls back to the default, and the defaults object stays intact", () => {
  const { handle } = renderEditor({
    tools: [...RICH_TEXT_PRESETS.full, tool(note, { tone: undefined, labels: { insert: "Pin" } })],
  });
  expect(optionsOf(handle()).tone).toBe("info");
  cleanup();

  // Слияние не пишет в умолчания: следующий Редактор видит их прежними.
  const second = renderEditor();
  expect(optionsOf(second.handle()).labels).toEqual({
    insert: "Add note",
    remove: "Remove note",
  });
});

test("built-in options keep their flat behaviour: an array replaces the default whole", () => {
  const headings = mountState((ref) => useRichTextToolState(ref, "toc", (s) => s.headings), {
    defaultValue: "<h1>A</h1><h2>B</h2><h3>C</h3><h4>D</h4>",
    tools: [...RICH_TEXT_PRESETS.full, tool("toc", { levels: [2, 4] })],
  });
  expect(headings.last()?.map((heading) => heading.text)).toEqual(["B", "D"]);
  expect(error).not.toHaveBeenCalled();
});

// ---------------------------------------------------------------- Состояние

/** Экран с хуком: замер всего, что хук отдал, и числа рендеров. */
function mountState<Result>(
  read: (ref: RefObject<RichTextEditorHandle | null>) => Result,
  props: EditorProps = {}
) {
  const seen = { renders: 0, results: [] as Result[] };
  let handle: RefObject<RichTextEditorHandle | null> | undefined;

  function Screen() {
    const ref = useRef<RichTextEditorHandle>(null);
    handle = ref;
    seen.results.push(read(ref));
    seen.renders += 1;
    return (
      <RichTextEditor
        ref={ref}
        aria-label="Body"
        defaultValue="<p>Hello</p>"
        tools={[...RICH_TEXT_PRESETS.full, note]}
        {...props}
      />
    );
  }

  render(<Screen />);
  return { seen, ref: handle!, last: () => seen.results.at(-1) as Result };
}

test("the State of a defined tool follows transactions and is read by useRichTextToolState", async () => {
  const screenResult = mountState((ref) => useRichTextToolState(ref, "test_note"));

  // До монтажа — `null`, затем снимок от `state` с опциями.
  expect(screenResult.seen.results[0]).toBeNull();
  expect(screenResult.last()).toEqual({ notes: 0, tone: "info" });

  act(
    () => void (screenResult.ref.current!.tool("test_note") as { add(t: string): boolean }).add("a")
  );
  await waitFor(() => expect(screenResult.last()).toEqual({ notes: 1, tone: "info" }));
  act(
    () => void (screenResult.ref.current!.tool("test_note") as { add(t: string): boolean }).add("b")
  );
  await waitFor(() => expect(screenResult.last()).toEqual({ notes: 2, tone: "info" }));
});

test("the State sees the options of the Editor, and a slice re-renders only on change", async () => {
  const screenResult = mountState(
    (ref) => useRichTextToolState(ref, "test_note", (state) => (state as { tone: string }).tone),
    {
      tools: [...RICH_TEXT_PRESETS.full, tool(note, { tone: "warning" })],
    }
  );
  expect(screenResult.last()).toBe("warning");

  const rendersBefore = screenResult.seen.renders;
  // Правка, не меняющая срез: экран не перерисовывается.
  act(() => void screenResult.ref.current!.editor!.commands.insertContent("text"));
  expect(screenResult.seen.renders).toBe(rendersBefore);
});

test("the State is null without the tool in the set and is not found for an unknown name", () => {
  const without = mountState((ref) => useRichTextToolState(ref, "test_note"), {
    tools: [...RICH_TEXT_PRESETS.full],
  });
  expect(without.last()).toBeNull();
  cleanup();

  const unknown = mountState((ref) => useRichTextToolState(ref, "test_other"));
  expect(unknown.last()).toBeNull();
});

test("the State compares plain data by value and everything else by reference", async () => {
  // Значения, которые Состояние отдаёт на каждую транзакцию; тест подменяет их между правками.
  const held: { value: unknown } = { value: undefined };
  const stateful = defineTool({
    name: "test_stateful",
    defaults: {},
    create: () => ({ engine: [] }),
    state: () => ({ value: held.value }),
  });
  const screenResult = mountState(
    (ref) =>
      useRichTextToolState(ref, "test_stateful", (state) => (state as { value: unknown }).value),
    { tools: [...RICH_TEXT_PRESETS.full, stateful] }
  );
  const edit = () => act(() => void screenResult.ref.current!.editor!.commands.insertContent("x"));
  const setValue = (value: unknown) => {
    held.value = value;
    edit();
  };

  // Date, Map и Set не имеют своих ключей, но это не «один и тот же»: новый экземпляр — новый снимок.
  for (const make of [
    (n: number) => new Date(2026, 0, n),
    (n: number) => new Map([["key", n]]),
    (n: number) => new Set([n]),
  ]) {
    const first = make(1);
    setValue(first);
    expect(screenResult.last()).toBe(first);
    const second = make(2);
    setValue(second);
    expect(screenResult.last()).toBe(second);
    // Тот же экземпляр — экран не трогается.
    const rendersBefore = screenResult.seen.renders;
    setValue(second);
    expect(screenResult.seen.renders).toBe(rendersBefore);
  }

  // Простые данные — по значению: новые, но равные объекты и массивы снимок не меняют.
  setValue({ list: [1, { deep: "a" }], flag: true });
  const plain = screenResult.last();
  const rendersBefore = screenResult.seen.renders;
  setValue({ list: [1, { deep: "a" }], flag: true });
  expect(screenResult.last()).toBe(plain);
  expect(screenResult.seen.renders).toBe(rendersBefore);
  setValue({ list: [1, { deep: "b" }], flag: true });
  expect(screenResult.last()).not.toBe(plain);

  // Объект без прототипа — тоже простые данные.
  setValue(Object.assign(Object.create(null), { a: 1 }));
  const bare = screenResult.last();
  setValue(Object.assign(Object.create(null), { a: 1 }));
  expect(screenResult.last()).toBe(bare);
});

test("a tool with no state function has a null State and no Commands", () => {
  const bare = defineTool({
    name: "test_bare",
    defaults: {},
    create: () => ({ engine: [] }),
  });
  const screenResult = mountState((ref) => useRichTextToolState(ref, "test_bare"), {
    tools: [...RICH_TEXT_PRESETS.full, bare],
  });
  expect(screenResult.last()).toBeNull();
  expect(screenResult.ref.current!.tool("test_bare")).toBeNull();
});

// ---------------------------------------------------------------- Команды

test("the Commands of a defined tool are called through handle.tool() with the merged options", () => {
  const { handle } = renderEditor({
    tools: [...RICH_TEXT_PRESETS.full, tool(note, { format: (text: string) => `(${text})` })],
  });
  const commands = handle().tool("test_note") as { add(text: string): boolean };

  expect(commands.add("hi")).toBe(true);
  expect(handle().getText()).toContain("(hi)");
  expect(handle().getHTML()).toContain('data-block="test_note"');
});

test("handle.tool() gives null for a defined tool outside the set", () => {
  const { handle } = renderEditor({ tools: [...RICH_TEXT_PRESETS.full] });
  expect(handle().tool("test_note")).toBeNull();
});

// ---------------------------------------------------------------- правила набора

/** Набор с ошибкой: поле с ошибкой и сообщение в консоли. */
function expectFieldError(tools: EditorProps["tools"], reason: RegExp) {
  render(<RichTextEditor aria-label="Body" defaultValue="<p>Hello</p>" tools={tools} />);
  expect(screen.getByRole("alert").textContent).toBe(
    "The editor couldn't start. The document is unchanged."
  );
  expect(error.mock.calls.some(([message]: unknown[]) => reason.test(String(message)))).toBe(true);
  cleanup();
}

test("a defined name without a consumer prefix is a tool set error", () => {
  const unprefixed = defineTool({
    name: "note" as never,
    defaults: {},
    create: () => ({ engine: [] }),
  });
  expectFieldError(
    [...RICH_TEXT_PRESETS.full, unprefixed],
    /custom tool "note": the name needs a consumer prefix/
  );
});

test("one definition twice, with tool() or without, is a tool set error", () => {
  expectFieldError([...RICH_TEXT_PRESETS.full, note, note], /two tools share this name/);
  expectFieldError(
    [...RICH_TEXT_PRESETS.full, note, tool(note, { tone: "warning" })],
    /two tools share this name/
  );
  expectFieldError(
    [...RICH_TEXT_PRESETS.full, tool(note), tool(note, { tone: "warning" })],
    /two tools share this name/
  );
});

test("a definition and a plain CustomTool with one name are a tool set error", () => {
  expectFieldError(
    [...RICH_TEXT_PRESETS.full, note, { name: "test_note", engine: [] }],
    /two tools share this name/
  );
});

test("the checks of a set apply to the body that create() returned", () => {
  // Node без правил Схемы: тело отдало Extensions, но не `blocks`.
  const loose = defineTool({
    name: "test_loose",
    defaults: {},
    create: () => ({ engine: [Node.create({ name: "test_loose", group: "block" })] }),
  });
  expectFieldError(
    [...RICH_TEXT_PRESETS.full, loose],
    /node "test_loose" of engine has no rule in blocks/
  );
});

test("the engine loader of a definition holds the field until it resolves, and is called once", async () => {
  const lazy = testLazyTool();
  const lazyTool = defineTool({
    name: "test_lazy",
    defaults: {},
    // Загрузчик — константа модуля, а не новая функция на каждый `create`: кэш — на ней.
    create: () => ({ engine: lazy.loader, blocks: lazy.tool.blocks }),
    commands: () => ({ ping: () => true }),
  });
  const tools = [...RICH_TEXT_PRESETS.full, lazyTool];

  const first = renderEditor({ tools });
  expect(first.ref.current?.editor).toBeNull();
  expect(lazy.loader.calls).toBe(1);

  await act(async () => lazy.resolve());
  await waitFor(() => expect(first.ref.current?.editor).not.toBeNull());
  expect(first.handle().tool("test_lazy")).not.toBeNull();

  // Второй Редактор с тем же определением загрузчик не зовёт.
  renderEditor({ tools });
  expect(lazy.loader.calls).toBe(1);
});

test("a plain CustomTool object still works next to a definition", () => {
  const { handle } = renderEditor({
    tools: [
      ...RICH_TEXT_PRESETS.full,
      note,
      {
        name: "test_plain",
        engine: [Node.create({ name: "test_plain", group: "block" })],
        blocks: { test_plain: { kind: "block" } },
      },
    ],
  });
  expect(handle().editor).not.toBeNull();
  expect(handle().tool("test_plain")).toBeNull();
  expect(handle().tool("test_note")).not.toBeNull();
  expect(error).not.toHaveBeenCalled();
});
