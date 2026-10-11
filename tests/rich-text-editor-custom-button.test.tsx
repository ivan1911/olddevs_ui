// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { createRef } from "react";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { Dialog } from "../src/components/overlays/Dialog.js";
import {
  RICH_TEXT_PRESETS,
  RichTextEditor,
  type CustomTool,
  type RichTextEditorHandle,
  type RichTextEditorProps,
} from "../src/editor/index.js";
import { UiProvider } from "../src/i18n/UiProvider.js";
import { resetDevWarnings } from "../src/lib/dev-warn.js";
import { PinIcon } from "../src/icons.js";
import {
  testContextTool,
  testLocaleTool,
  testPickerTool,
  testPinTool,
  testStampTool,
} from "./editor-test-tools.js";
import { loadLazyBuiltins } from "./editor-lazy-builtins.js";

// Ленивые `codeBlock` и `table` (OLDSUI-111): `full` готов в `render` после загрузки чанков.
beforeAll(loadLazyBuiltins);

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  resetDevWarnings();
});

/**
 * Кнопка своего Инструмента (OLDSUI-105, ADR-0058, разделы 5 и 6).
 *
 * Через публичный `RichTextEditor` со своими Инструментами из общего помощника
 * тестов: роли, имена и `aria-*` кнопок, выходной HTML, справочник сочетаний.
 * Выделение и фокус ставятся командами движка: jsdom не умеет ввода. Положение
 * поповера у каретки меряет браузер (`tests-visual`), jsdom раскладки не знает.
 */
function renderEditor(props: Partial<RichTextEditorProps> = {}) {
  const ref = createRef<RichTextEditorHandle>();
  const view = render(
    <RichTextEditor
      ref={ref}
      aria-label="Body"
      defaultValue="<p>Hello world</p>"
      tools={[...RICH_TEXT_PRESETS.full, testStampTool]}
      {...props}
    />
  );
  const editor = ref.current?.editor;
  if (!editor) throw new Error("the editor was not created inside render()");
  return { ...view, ref, editor };
}

const TOOLBAR = { name: "Formatting" } as const;
const BUBBLE = { name: "Selection formatting" } as const;

/** Имена кнопок Панели по порядку — так их обходят стрелки. */
const names = (toolbar: HTMLElement) =>
  within(toolbar)
    .getAllByRole("button")
    .map((button) => button.getAttribute("aria-label"));

/** Сочетание в документе — так, как его слышит движок: `keydown` на редактируемой области. */
function press(editor: RichTextEditorHandle["editor"], init: KeyboardEventInit) {
  act(() => {
    editor!.view.dom.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init })
    );
  });
}

/** Фокус в Документ и каретка в позицию. */
function caretAt(editor: NonNullable<RichTextEditorHandle["editor"]>, pos: number) {
  act(() => {
    editor.view.focus();
    editor.commands.setTextSelection(pos);
  });
}

// ── Место на Панели ───────────────────────────────────────────────────────

test("own buttons stand in one group before Undo and Redo, in the order of tools", () => {
  renderEditor({ tools: [...RICH_TEXT_PRESETS.full, testPickerTool, testStampTool] });
  const list = names(screen.getByRole("toolbar", TOOLBAR));

  expect(list.slice(-6)).toEqual(["Picker", "Stamp", "Undo", "Redo", "Find", "Keyboard shortcuts"]);
  // Свои — после кнопок кита, а не между ними.
  expect(list.indexOf("Picker")).toBeGreaterThan(list.indexOf("Emoji"));

  cleanup();
  renderEditor({ tools: [...RICH_TEXT_PRESETS.full, testStampTool, testPickerTool] });
  expect(names(screen.getByRole("toolbar", TOOLBAR)).slice(-6, -4)).toEqual(["Stamp", "Picker"]);
});

test("the group is separated from the kit groups like any other", () => {
  renderEditor();
  const stamp = screen.getByRole("button", { name: "Stamp" });
  const undo = screen.getByRole("button", { name: "Undo" });
  const separators = within(screen.getByRole("toolbar", TOOLBAR)).getAllByRole("separator");

  const before = separators.filter(
    (separator) => stamp.compareDocumentPosition(separator) & Node.DOCUMENT_POSITION_PRECEDING
  );
  const between = separators.filter(
    (separator) =>
      stamp.compareDocumentPosition(separator) & Node.DOCUMENT_POSITION_FOLLOWING &&
      undo.compareDocumentPosition(separator) & Node.DOCUMENT_POSITION_PRECEDING
  );
  expect(before.length).toBeGreaterThan(0);
  expect(between).toHaveLength(1);
});

test("a tool left out of tools takes its button and its shortcut with it", () => {
  const { editor } = renderEditor({ tools: [...RICH_TEXT_PRESETS.full] });
  expect(screen.queryByRole("button", { name: "Stamp" })).toBeNull();

  caretAt(editor, 3);
  press(editor, { key: "y", ctrlKey: true, shiftKey: true });
  expect(editor.getHTML()).toBe("<p>Hello world</p>");
});

test("a short list of tools gives a short toolbar with the own button only", () => {
  renderEditor({ tools: ["bold", "history", testStampTool] });
  expect(names(screen.getByRole("toolbar", TOOLBAR))).toEqual([
    "Bold",
    "Stamp",
    "Undo",
    "Redo",
    "Keyboard shortcuts",
  ]);
});

test("the floating toolbar shows the same own buttons as the fixed one", async () => {
  const fixed = renderEditor({ tools: [...RICH_TEXT_PRESETS.full, testStampTool, testPinTool] });
  const fixedNames = names(screen.getByRole("toolbar", TOOLBAR));
  fixed.unmount();

  const floating = renderEditor({
    toolbar: "floating",
    tools: [...RICH_TEXT_PRESETS.full, testStampTool, testPinTool],
  });
  act(() => floating.editor.view.focus());
  act(() => void floating.editor.commands.setTextSelection({ from: 1, to: 6 }));
  const toolbar = await screen.findByRole("toolbar", TOOLBAR);

  expect(names(toolbar).filter((name) => ["Stamp", "Pin"].includes(name ?? ""))).toEqual(
    fixedNames.filter((name) => ["Stamp", "Pin"].includes(name ?? ""))
  );
});

test("the selection menu carries only the own buttons with the flag", async () => {
  const { editor } = renderEditor({
    toolbar: "bubble",
    tools: [...RICH_TEXT_PRESETS.full, testStampTool, testPinTool],
  });
  act(() => editor.view.focus());
  act(() => void editor.commands.setTextSelection({ from: 1, to: 6 }));
  const bubble = await screen.findByRole("toolbar", BUBBLE);

  expect(within(bubble).getByRole("button", { name: "Pin" })).toBeDefined();
  expect(within(bubble).queryByRole("button", { name: "Stamp" })).toBeNull();
});

test("no toolbar at all: the own button is gone, its shortcut still works", () => {
  const { editor } = renderEditor({ toolbar: "none" });
  expect(screen.queryByRole("toolbar")).toBeNull();

  caretAt(editor, 3);
  press(editor, { key: "y", ctrlKey: true, shiftKey: true });
  expect(editor.getHTML()).toBe("<p>He★llo world</p>");
});

// ── Клавиатура и состояние ────────────────────────────────────────────────

test("the toolbar with own buttons is one Tab stop and arrows reach them", async () => {
  const user = userEvent.setup();
  render(
    <>
      <button type="button">Before</button>
      <RichTextEditor
        aria-label="Body"
        tools={[...RICH_TEXT_PRESETS.full, testStampTool, testPinTool]}
      />
    </>
  );
  const toolbar = screen.getByRole("toolbar", TOOLBAR);
  screen.getByRole("button", { name: "Before" }).focus();

  await user.tab();
  expect(toolbar.contains(document.activeElement)).toBe(true);
  await user.tab();
  expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Body" }));

  // Назад в Панель, к концу ряда: справочник ← Поиск ← Повтор ← Отмена ← последняя своя.
  await user.tab({ shift: true });
  await user.keyboard("{End}{ArrowLeft}{ArrowLeft}{ArrowLeft}{ArrowLeft}");
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Pin" }));
  await user.keyboard("{ArrowLeft}");
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Stamp" }));
});

test("aria-pressed appears only on a button with isActive", () => {
  const { editor } = renderEditor({
    tools: [...RICH_TEXT_PRESETS.full, testStampTool, testPinTool],
  });
  const stamp = screen.getByRole("button", { name: "Stamp" });
  const pin = screen.getByRole("button", { name: "Pin" });
  expect(stamp.hasAttribute("aria-pressed")).toBe(false);

  act(() => void editor.commands.setTextSelection({ from: 1, to: 6 }));
  expect(pin.getAttribute("aria-pressed")).toBe("false");
  act(() => void editor.chain().toggleMark("test_pin").run());
  expect(pin.getAttribute("aria-pressed")).toBe("true");
  expect(stamp.hasAttribute("aria-pressed")).toBe(false);
});

test("a click runs the button on the document", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ tools: [...RICH_TEXT_PRESETS.full, testPinTool] });
  act(() => void editor.commands.setTextSelection({ from: 1, to: 6 }));

  await user.click(screen.getByRole("button", { name: "Pin" }));

  expect(editor.getHTML()).toBe('<p><span data-mark="test_pin">Hello</span> world</p>');
});

test("can switches the button off: aria-disabled, and a click runs nothing", async () => {
  const user = userEvent.setup();
  const run = vi.fn();
  const locked: CustomTool = {
    name: "test_locked",
    engine: [],
    buttons: [{ id: "lock", label: "Lock", icon: PinIcon, can: () => false, run }],
  };
  renderEditor({ tools: [...RICH_TEXT_PRESETS.full, locked] });
  const lock = screen.getByRole("button", { name: "Lock" });

  expect(lock.getAttribute("aria-disabled")).toBe("true");
  await user.click(lock);
  expect(run).not.toHaveBeenCalled();
});

test("a visibility predicate hides the button in its context and shows it in another", () => {
  const { editor } = renderEditor({ tools: [...RICH_TEXT_PRESETS.full, testContextTool] });

  act(() => void editor.commands.setTextSelection(3));
  expect(screen.queryByRole("button", { name: "Count" })).toBeNull();
  // Скрытая кнопка не мешает остальным своего Инструмента.
  expect(screen.getByRole("button", { name: "Lock" })).toBeDefined();

  act(() => void editor.commands.setTextSelection({ from: 1, to: 6 }));
  expect(screen.getByRole("button", { name: "Count" })).toBeDefined();
});

test("a disabled field keeps the button visible and off", () => {
  renderEditor({ disabled: true });
  const stamp = screen.getByRole("button", { name: "Stamp" }) as HTMLButtonElement;
  expect(stamp.disabled).toBe(true);
});

// ── Сочетание ─────────────────────────────────────────────────────────────

test("the shortcut runs the button and shows in the tooltip and aria-keyshortcuts", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor();
  const stamp = screen.getByRole("button", { name: "Stamp" });

  // jsdom — не Apple: `mod` — это Ctrl.
  expect(stamp.getAttribute("aria-keyshortcuts")).toBe("Control+Shift+Y");

  caretAt(editor, 3);
  press(editor, { key: "y", ctrlKey: true, shiftKey: true });
  expect(editor.getHTML()).toBe("<p>He★llo world</p>");

  await user.hover(stamp);
  const tip = await screen.findByRole("tooltip");
  expect(tip.textContent).toContain("Stamp");
  expect(tip.querySelector("kbd")?.textContent).toBe("Ctrl+Shift+Y");
});

test("an unavailable button does not take its shortcut: the key goes on to the document", () => {
  const taken = vi.fn(() => true);
  const tool: CustomTool = {
    name: "test_taken",
    engine: [],
    buttons: [
      {
        id: "taken",
        label: "Taken",
        icon: PinIcon,
        can: () => false,
        run: taken,
        shortcut: ["mod", "shift", "Y"],
      },
    ],
  };
  const { editor } = renderEditor({ tools: [...RICH_TEXT_PRESETS.full, tool] });

  caretAt(editor, 3);
  press(editor, { key: "y", ctrlKey: true, shiftKey: true });
  expect(taken).not.toHaveBeenCalled();
});

/** Справочник сочетаний: строки таблицы по порядку, с именем группы по `tbody`. */
async function openReference(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Keyboard shortcuts" }));
  const popover = await screen.findByRole("dialog", { name: "Keyboard shortcuts" });
  const rows = within(popover)
    .getAllByRole("rowheader")
    .map((cell) => cell.textContent);
  return { popover, rows };
}

test("the reference lists own shortcuts in a group without a heading after the kit groups", async () => {
  const user = userEvent.setup();
  renderEditor({
    tools: [...RICH_TEXT_PRESETS.full, testPickerTool, testStampTool, testPinTool],
  });
  const { popover, rows } = await openReference(user);

  // Свои — в порядке `tools`, в конце таблицы, после всех групп кита.
  expect(rows.slice(-3)).toEqual(["Picker", "Stamp", "Pin"]);
  const kit = within(popover).getByText("Bold").closest("tbody")!;
  const own = within(popover).getByText("Stamp").closest("tbody")!;
  expect(own).not.toBe(kit);
  expect(kit.compareDocumentPosition(own) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  // Без заголовка группы: в таблице одни строки команд.
  expect(popover.querySelectorAll("tbody th:not([scope=row])")).toHaveLength(0);
  expect(within(own).getByText("Ctrl+Shift+Y").tagName).toBe("KBD");
});

test("the reference does not list the keys of the engine part", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor();
  // Часть для движка слушает `Mod-Shift-K` на деле — и это не строка справочника.
  expect(testStampTool.engine).toHaveLength(1);
  caretAt(editor, 3);
  const { popover } = await openReference(user);

  const keysOfStamp = within(popover.querySelector("tbody:last-of-type")!).getAllByRole("cell");
  expect(keysOfStamp.map((cell) => cell.textContent)).toEqual(["Ctrl+Shift+Y"]);
  expect(popover.textContent).not.toContain("Ctrl+Shift+K");
});

test("a tool with no shortcut adds no group to the reference", async () => {
  const user = userEvent.setup();
  renderEditor({ tools: [...RICH_TEXT_PRESETS.full, testContextTool] });
  const { rows } = await openReference(user);
  expect(rows).not.toContain("Count");
  expect(rows).not.toContain("Lock");
});

// ── Подпись ───────────────────────────────────────────────────────────────

test("a label function reads the locale of UiProvider and redraws when it changes", () => {
  const tools = [...RICH_TEXT_PRESETS.full, testLocaleTool];
  const view = render(
    <UiProvider locale="en-US">
      <RichTextEditor aria-label="Body" tools={tools} />
    </UiProvider>
  );
  expect(screen.getByRole("button", { name: "Stamp" })).toBeDefined();

  view.rerender(
    <UiProvider locale="de">
      <RichTextEditor aria-label="Body" tools={tools} />
    </UiProvider>
  );
  expect(screen.getByRole("button", { name: "Stempel" })).toBeDefined();
  expect(screen.queryByRole("button", { name: "Stamp" })).toBeNull();
});

test("the shortcut row of a label function follows the locale too", async () => {
  const user = userEvent.setup();
  render(
    <UiProvider locale="de">
      <RichTextEditor aria-label="Body" tools={[...RICH_TEXT_PRESETS.full, testLocaleTool]} />
    </UiProvider>
  );
  await user.click(screen.getByRole("button", { name: "Keyboard shortcuts" }));
  const popover = await screen.findByRole("dialog", { name: "Keyboard shortcuts" });
  expect(within(popover).getByText("Stempel")).toBeDefined();
});

test("an empty label is a console.error with the tool and the button, and the tool name stands in", () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  const nameless: CustomTool = {
    name: "test_nameless",
    engine: [],
    buttons: [{ id: "blank", label: "  ", icon: PinIcon, can: () => true, run: () => {} }],
  };
  renderEditor({ tools: [...RICH_TEXT_PRESETS.full, nameless] });

  expect(screen.getByRole("button", { name: "test_nameless" })).toBeDefined();
  expect(error).toHaveBeenCalledTimes(1);
  expect(error).toHaveBeenCalledWith(expect.stringMatching(/test_nameless.*blank.*empty label/));
});

// ── Поповер ───────────────────────────────────────────────────────────────

const POPOVER_TOOLS = [...RICH_TEXT_PRESETS.full, testPickerTool];

test("a click opens the popover at the button with the content of the button and closes it on pick", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ tools: POPOVER_TOOLS });
  caretAt(editor, 3);
  const button = screen.getByRole("button", { name: "Picker" });
  expect(button.getAttribute("aria-haspopup")).toBe("dialog");

  await user.click(button);
  const popover = await screen.findByRole("dialog", { name: "Picker" });
  await user.click(within(popover).getByRole("button", { name: "Choose Alpha" }));

  expect(screen.queryByRole("dialog", { name: "Picker" })).toBeNull();
  expect(editor.getHTML()).toBe("<p>HeAlphallo world</p>");
  // Фокус — в Документ, а не на кнопку: человек продолжает писать.
  await waitFor(() => expect(document.activeElement).toBe(editor.view.dom));
});

test("Escape closes the popover and returns focus and the selection to the text", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ tools: POPOVER_TOOLS });
  act(() => editor.view.focus());
  act(() => void editor.commands.setTextSelection({ from: 1, to: 6 }));

  await user.click(screen.getByRole("button", { name: "Picker" }));
  await screen.findByRole("dialog", { name: "Picker" });
  await user.keyboard("{Escape}");

  expect(screen.queryByRole("dialog", { name: "Picker" })).toBeNull();
  await waitFor(() => expect(document.activeElement).toBe(editor.view.dom));
  expect(editor.state.selection.from).toBe(1);
  expect(editor.state.selection.to).toBe(6);
  expect(editor.getHTML()).toBe("<p>Hello world</p>");
});

test("the shortcut opens the popover at the caret, with no button on screen", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ tools: POPOVER_TOOLS, toolbar: "none" });
  caretAt(editor, 3);

  press(editor, { key: "j", ctrlKey: true, shiftKey: true });
  const popover = await screen.findByRole("dialog", { name: "Picker" });
  await user.click(within(popover).getByRole("button", { name: "Choose Alpha" }));

  expect(screen.queryByRole("dialog", { name: "Picker" })).toBeNull();
  expect(editor.getHTML()).toBe("<p>HeAlphallo world</p>");
  await waitFor(() => expect(document.activeElement).toBe(editor.view.dom));
});

test("the shortcut with the fixed toolbar opens the popover at the caret as well", async () => {
  const { editor } = renderEditor({ tools: POPOVER_TOOLS });
  caretAt(editor, 3);

  press(editor, { key: "j", ctrlKey: true, shiftKey: true });

  expect(await screen.findByRole("dialog", { name: "Picker" })).toBeDefined();
});

test("Escape in the popover inside a Dialog closes the popover, not the window", async () => {
  const user = userEvent.setup();
  const onClose = vi.fn();
  const ref = createRef<RichTextEditorHandle>();
  render(
    <Dialog open onClose={onClose} title="Edit article">
      <RichTextEditor
        ref={ref}
        aria-label="Body"
        defaultValue="<p>Hello world</p>"
        tools={POPOVER_TOOLS}
      />
    </Dialog>
  );
  const editor = ref.current!.editor!;
  act(() => editor.view.focus());
  act(() => void editor.commands.setTextSelection(3));

  await user.click(screen.getByRole("button", { name: "Picker" }));
  await screen.findByRole("dialog", { name: "Picker" });
  await user.keyboard("{Escape}");

  expect(screen.queryByRole("dialog", { name: "Picker" })).toBeNull();
  expect(screen.getByRole("dialog", { name: "Edit article" })).toBeDefined();
  expect(onClose).not.toHaveBeenCalled();
});

test("a button whose can is off does not open its popover by the shortcut", async () => {
  const { editor } = renderEditor({ tools: POPOVER_TOOLS });
  // Нередактируемое поле: `can` кнопки выполнен, но кит не открывает поповер.
  act(() => editor.setEditable(false));
  caretAt(editor, 3);

  press(editor, { key: "j", ctrlKey: true, shiftKey: true });
  await new Promise((resolve) => setTimeout(resolve, 20));

  expect(screen.queryByRole("dialog", { name: "Picker" })).toBeNull();
});

// ── Ошибка набора ─────────────────────────────────────────────────────────

/** Набор с ошибкой: поле с ошибкой, без движка. */
function expectFieldError(tool: CustomTool, reason: RegExp) {
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  const ref = createRef<RichTextEditorHandle>();
  render(
    <RichTextEditor
      ref={ref}
      aria-label="Body"
      defaultValue="<p>x</p>"
      tools={[...RICH_TEXT_PRESETS.full, tool]}
    />
  );
  expect(screen.getByRole("alert").textContent).toBe(
    "The editor couldn't start. The document is unchanged."
  );
  expect(ref.current?.editor).toBeNull();
  expect(error).toHaveBeenCalledWith(expect.stringMatching(reason));
}

const button = (extra: object = {}) => ({
  id: "one",
  label: "One",
  icon: PinIcon,
  can: () => true,
  run: () => {},
  ...extra,
});

test("two buttons of one tool with one id are a field error", () => {
  expectFieldError(
    { name: "test_twins", engine: [], buttons: [button(), button()] },
    /custom tool "test_twins": two buttons share the id "one"/
  );
});

test("the same button id in two tools is fine: the id belongs to its tool", () => {
  renderEditor({
    tools: [
      ...RICH_TEXT_PRESETS.full,
      { name: "test_first", engine: [], buttons: [button({ label: "First" })] },
      { name: "test_second", engine: [], buttons: [button({ label: "Second" })] },
    ],
  });
  expect(screen.getByRole("button", { name: "First" })).toBeDefined();
  expect(screen.getByRole("button", { name: "Second" })).toBeDefined();
});

test("a button id may repeat a kit id: the own button stays its own", () => {
  renderEditor({
    tools: [
      ...RICH_TEXT_PRESETS.full,
      { name: "test_clash", engine: [], buttons: [button({ id: "bold", label: "Mine" })] },
    ],
  });
  expect(screen.getByRole("button", { name: "Mine" })).toBeDefined();
  expect(screen.getByRole("button", { name: "Bold" })).toBeDefined();
});

test("a button without an icon is a field error", () => {
  expectFieldError(
    { name: "test_bare", engine: [], buttons: [button({ icon: undefined })] },
    /custom tool "test_bare": button "one" needs an icon/
  );
});

test("a button with both run and popover, or with neither, is a field error", () => {
  expectFieldError(
    { name: "test_both", engine: [], buttons: [button({ popover: () => null })] },
    /custom tool "test_both": button "one" needs exactly one of run and popover/
  );
  cleanup();
  expectFieldError(
    { name: "test_none", engine: [], buttons: [button({ run: undefined })] },
    /custom tool "test_none": button "one" needs exactly one of run and popover/
  );
});

test("a button without an id is a field error", () => {
  expectFieldError(
    { name: "test_anon", engine: [], buttons: [button({ id: "" })] },
    /custom tool "test_anon": a button needs an id/
  );
});

// Потребитель на JS: форма `buttons` не та, что в типах, — ошибка поля, а не падение страницы.
test.each([
  ["buttons that are not an array", { buttons: button() }, /buttons must be an array/],
  ["a button that is not an object", { buttons: [null] }, /buttons\[0\] must be an object/],
  [
    "a button with a label that is neither a string nor a function",
    { buttons: [button({ label: 42 })] },
    /button "one" needs a label \(string or function\)/,
  ],
])("%s is a field error, not a crash", (_, fields, reason) => {
  expectFieldError({ name: "test_odd", engine: [], ...fields } as never, reason);
});
