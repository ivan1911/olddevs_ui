// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import type { Editor } from "@tiptap/react";
import { AllSelection } from "@tiptap/pm/state";
import { createRef } from "react";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { Dialog } from "../src/components/overlays/Dialog.js";
import { UiProvider } from "../src/i18n/UiProvider.js";
import { messages as ru } from "../src/locales/ru.js";
import {
  RichTextEditor,
  type RichTextEditorHandle,
  type RichTextEditorProps,
} from "../src/editor/index.js";
import { expandTools } from "../src/editor/features/builtins.js";
import {
  ariaShortcut,
  shortcutGroupsFor,
  shortcutKeys,
  shortcutLabel,
} from "../src/editor/core/shortcuts.js";
import { DEFAULT_MESSAGES } from "../src/i18n/defaults.js";
import { TOOLS } from "../src/editor/core/tools.js";
import { loadLazyBuiltins } from "./editor-lazy-builtins.js";

// Ленивые `codeBlock` и `table` (OLDSUI-111): `full` готов в `render` после загрузки чанков.
beforeAll(loadLazyBuiltins);

/*
  Все сочетания кита при всех Инструментах: таблица `SHORTCUTS` и сочетания из
  описаний Инструментов (цитата — OLDSUI-100, кнопка ссылки — OLDSUI-101). Это ровно то, что
  показывает справочник полного набора.
*/
const SHORTCUTS = shortcutGroupsFor(expandTools("full", [...TOOLS])).flatMap(
  (entry) => entry.commands
);

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/**
 * Справочник сочетаний клавиш Редактора (OLDSUI-67) и таблица, из которой он
 * строится.
 *
 * Через публичный `RichTextEditor`: роли, имена, текст таблицы и — главное —
 * настоящие нажатия сочетаний из таблицы. Справочник, который обещает ⌘⇧D там,
 * где движок его не слушает, хуже справочника, которого нет. Реальные нажатия в
 * браузере и открытый справочник на снимках — `tests-visual`.
 */
function renderEditor(props: Partial<RichTextEditorProps> = {}) {
  const ref = createRef<RichTextEditorHandle>();
  const view = render(
    <>
      <button type="button">Before</button>
      <RichTextEditor ref={ref} aria-label="Body" {...props} />
    </>
  );
  const editor = ref.current?.editor;
  if (!editor) throw new Error("the editor was not created inside render()");
  return { ...view, ref, editor };
}

const BUTTON = "Keyboard shortcuts";

async function openReference(user: ReturnType<typeof userEvent.setup>, name = BUTTON) {
  await user.click(screen.getByRole("button", { name }));
  return screen.findByRole("dialog", { name });
}

/** Подписи команд в таблице справочника, по порядку строк. */
function commandNames(popover: HTMLElement) {
  return within(popover)
    .getAllByRole("rowheader")
    .map((cell) => cell.textContent);
}

/** Сочетание строки справочника по имени команды. */
function keysOf(popover: HTMLElement, command: string) {
  const row = within(popover)
    .getAllByRole("row")
    .find((candidate) => within(candidate).queryByRole("rowheader", { name: command }));
  if (!row) throw new Error(`no row "${command}" in the reference`);
  return row.querySelector("kbd")?.textContent;
}

// --- Кнопка ----------------------------------------------------------------

test("the reference button is the last one on the toolbar, with a tooltip", async () => {
  const user = userEvent.setup();
  renderEditor();

  const toolbar = screen.getByRole("toolbar", { name: "Formatting" });
  const buttons = Array.from(toolbar.querySelectorAll("button"));
  const button = screen.getByRole("button", { name: BUTTON });
  expect(buttons.at(-1)).toBe(button);
  // `Popover` кита: поповер, а не меню и не окно.
  expect(button.getAttribute("aria-haspopup")).toBe("dialog");

  await user.hover(button);
  expect((await screen.findByRole("tooltip")).textContent).toBe(BUTTON);
});

test("the reference button is absent in read-only mode and without a toolbar", () => {
  renderEditor({ readOnly: true });
  expect(screen.queryByRole("button", { name: BUTTON })).toBeNull();
  cleanup();

  renderEditor({ toolbar: "none" });
  expect(screen.queryByRole("button", { name: BUTTON })).toBeNull();
});

/** Сенсорный экран: `matchMedia("(pointer: coarse)")` совпадает. */
function stubPointer(coarse: boolean) {
  vi.stubGlobal(
    "matchMedia",
    (query: string) =>
      ({
        matches: query === "(pointer: coarse)" && coarse,
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }) as unknown as MediaQueryList
  );
}

test("the floating toolbar has no reference button, the touch fallback to the fixed one has", async () => {
  stubPointer(false);
  const { editor, unmount } = renderEditor({ toolbar: "floating" });
  act(() => void editor.commands.setTextSelection({ from: 1, to: 1 }));
  expect(screen.queryByRole("button", { name: BUTTON })).toBeNull();
  unmount();
  cleanup();

  // На сенсорном экране вместо плавающей — фиксированная Панель, и справочник на ней.
  stubPointer(true);
  renderEditor({ toolbar: "floating" });
  expect(screen.getByRole("button", { name: BUTTON })).toBeDefined();
});

// --- Справочник ------------------------------------------------------------

test("the reference is a table of commands and shortcuts with column headers", async () => {
  const user = userEvent.setup();
  renderEditor();
  const popover = await openReference(user);

  const table = within(popover).getByRole("table", { name: BUTTON });
  expect(
    within(table)
      .getAllByRole("columnheader")
      .map((cell) => cell.textContent)
  ).toEqual(["Command", "Shortcut"]);
  // Сочетание — `<kbd>` кита, а не обычный текст.
  expect(table.querySelectorAll("tbody kbd").length).toBe(
    within(table).getAllByRole("row").length - 1
  );
  expect(keysOf(popover, "Bold")).toBe("Ctrl+B");
});

test("the full preset lists every command in the documented order of groups", async () => {
  const user = userEvent.setup();
  renderEditor({ tools: [...TOOLS] });
  const popover = await openReference(user);

  expect(commandNames(popover)).toEqual([
    "Select block text",
    "Select all (second press)",
    "Undo",
    "Redo",
    "Duplicate block",
    "Move block up",
    "Move block down",
    "Block actions",
    "Clear formatting",
    "Bold",
    "Italic",
    "Strikethrough",
    "Underline",
    "Inline code",
    "Superscript",
    "Subscript",
    "Text",
    "Heading 1",
    "Heading 2",
    "Heading 3",
    "Heading 4",
    "Quote",
    "Code block",
    "Bulleted list",
    "Numbered list",
    "Checklist",
    "Indent list item",
    "Outdent list item",
    "Align left",
    "Align center",
    "Align right",
    "Link",
    "Find",
    "Find and replace",
    "Go to the toolbar",
  ]);
});

test("the reference lists only the commands of the enabled tools", async () => {
  const user = userEvent.setup();
  renderEditor({ preset: "basic" });
  const popover = await openReference(user);
  const names = commandNames(popover);

  // Команды Блоков, выделение и переход в Панель — всегда.
  for (const always of [
    "Select block text",
    "Duplicate block",
    "Move block up",
    "Go to the toolbar",
  ]) {
    expect(names, always).toContain(always);
  }
  // В `basic` нет заголовков, подчёркивания, индексов, выравнивания, чек-листа,
  // блока кода и очистки стилей — а значит, и их строк.
  for (const absent of [
    "Heading 2",
    "Text",
    "Underline",
    "Superscript",
    "Align center",
    "Checklist",
    "Code block",
    "Clear formatting",
  ]) {
    expect(names, absent).not.toContain(absent);
  }
  expect(names).toContain("Bold");
  expect(names).toContain("Indent list item");
});

test("heading 1 is listed only when both heading and heading1 are on", () => {
  const rows = (tools: readonly (typeof TOOLS)[number][]) =>
    shortcutGroupsFor(expandTools("full", tools))
      .flatMap((entry) => entry.commands)
      .map((command) => command.id);

  expect(rows(["heading", "heading1"])).toContain("h1");
  expect(rows(["heading"])).not.toContain("h1");
  expect(rows(["heading1"])).not.toContain("h1");
  // Сдвиг пункта — при любом списке, а не при всех сразу.
  expect(rows(["taskList"])).toContain("indentListItem");
  expect(rows(["bold"])).not.toContain("indentListItem");
  // Без инструментов остаются только команды без своего инструмента.
  expect(rows([])).toEqual([
    "selectBlock",
    "selectDocument",
    "duplicateBlock",
    "moveBlockUp",
    "moveBlockDown",
    "blockActions",
    "focusToolbar",
  ]);
});

test("the reference is as wide as its longest row, not a fixed column", async () => {
  const user = userEvent.setup();
  renderEditor();
  const popover = await openReference(user);

  // Фиксированная колонка в 384px оставляла пустое поле между командой и
  // сочетанием (OLDSUI-117); край экрана по-прежнему ограничивает ширину.
  expect(popover.className).toContain("w-max");
  expect(popover.className).not.toContain("w-96");
  expect(popover.className).toContain("max-w-[calc(100vw-2rem)]");
});

test("labels follow the platform: symbols on Apple, names elsewhere", async () => {
  // jsdom — не Apple: то же, что `prosemirror-keymap` решает по `navigator.platform`.
  const user = userEvent.setup();
  renderEditor();
  let popover = await openReference(user);
  expect(keysOf(popover, "Redo")).toBe("Ctrl+Shift+Z");
  expect(keysOf(popover, "Move block up")).toBe("Alt+Shift+↑");
  expect(keysOf(popover, "Heading 2")).toBe("Ctrl+Alt+2");
  expect(keysOf(popover, "Go to the toolbar")).toBe("Alt+F10");
  expect(screen.getByRole("button", { name: "Bold" }).getAttribute("aria-keyshortcuts")).toBe(
    "Control+B"
  );
  cleanup();

  vi.spyOn(navigator, "platform", "get").mockReturnValue("MacIntel");
  renderEditor();
  popover = await openReference(user);
  expect(keysOf(popover, "Redo")).toBe("⌘+⇧+Z");
  expect(keysOf(popover, "Move block up")).toBe("⌥+⇧+↑");
  expect(keysOf(popover, "Duplicate block")).toBe("⌘+⇧+D");
  expect(keysOf(popover, "Heading 2")).toBe("⌘+⌥+2");
  expect(keysOf(popover, "Indent list item")).toBe("⌘+]");
  expect(keysOf(popover, "Go to the toolbar")).toBe("⌥+F10");
  expect(screen.getByRole("button", { name: "Bold" }).getAttribute("aria-keyshortcuts")).toBe(
    "Meta+B"
  );
});

test("the label function and the ARIA names agree on every modifier", () => {
  expect(shortcutLabel(["mod", "alt", "shift", "X"], true)).toBe("⌘+⌥+⇧+X");
  expect(shortcutLabel(["mod", "alt", "shift", "X"], false)).toBe("Ctrl+Alt+Shift+X");
  expect(ariaShortcut(["alt", "shift", "↑"], false)).toBe("Alt+Shift+ArrowUp");
  expect(ariaShortcut(["mod", "K"], true)).toBe("Meta+K");
});

test("the reference speaks the provider's language", async () => {
  const user = userEvent.setup();
  render(
    <UiProvider messages={ru}>
      <RichTextEditor aria-label="Body" />
    </UiProvider>
  );
  const popover = await openReference(user, ru.editor.shortcuts);

  expect(
    within(popover)
      .getAllByRole("columnheader")
      .map((cell) => cell.textContent)
  ).toEqual([ru.editor.shortcutsCommand, ru.editor.shortcutsKeys]);
  expect(commandNames(popover)).toContain(ru.editor.duplicateBlock);
  expect(commandNames(popover)).toContain(ru.editor.bold);
});

// --- Фокус и слои ----------------------------------------------------------

test("Escape closes the reference and returns focus to its button", async () => {
  const user = userEvent.setup();
  renderEditor();
  await openReference(user);

  await user.keyboard("{Escape}");

  await waitFor(() => expect(screen.queryByRole("dialog", { name: BUTTON })).toBeNull());
  await waitFor(() =>
    expect(document.activeElement).toBe(screen.getByRole("button", { name: BUTTON }))
  );
});

test("a click outside closes the reference and returns focus to its button", async () => {
  const user = userEvent.setup();
  renderEditor();
  await openReference(user);

  await user.click(document.body);

  await waitFor(() => expect(screen.queryByRole("dialog", { name: BUTTON })).toBeNull());
  await waitFor(() =>
    expect(document.activeElement).toBe(screen.getByRole("button", { name: BUTTON }))
  );
});

test("a click on another control closes the reference and leaves the focus where it landed", async () => {
  const user = userEvent.setup();
  renderEditor();
  await openReference(user);

  await user.click(screen.getByRole("button", { name: "Before" }));

  await waitFor(() => expect(screen.queryByRole("dialog", { name: BUTTON })).toBeNull());
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Before" }));
});

test("Escape in the reference inside a Dialog closes the reference, not the window", async () => {
  const user = userEvent.setup();
  const onClose = vi.fn();
  const ref = createRef<RichTextEditorHandle>();
  render(
    <Dialog open onClose={onClose} title="Edit article">
      <RichTextEditor ref={ref} aria-label="Body" />
    </Dialog>
  );
  await openReference(user);
  await user.keyboard("{Escape}");

  await waitFor(() => expect(screen.queryByRole("dialog", { name: BUTTON })).toBeNull());
  expect(screen.getByRole("dialog", { name: "Edit article" })).toBeDefined();
  expect(onClose).not.toHaveBeenCalled();
  // Фокус вернулся на кнопку.
  await waitFor(() =>
    expect(document.activeElement).toBe(screen.getByRole("button", { name: BUTTON }))
  );

  // Контроль: без открытого справочника тот же Escape закрывает окно. Фокус
  // уводится в документ — на кнопке Escape сперва закрыл бы её подсказку.
  act(() => ref.current!.editor!.view.focus());
  await user.keyboard("{Escape}");
  expect(onClose).toHaveBeenCalledTimes(1);
});

// --- Таблица против движка -------------------------------------------------

/**
 * `keydown` по записи таблицы — так, как его шлёт клавиатура. `keyCode` — как у
 * настоящего браузера: по нему ProseMirror узнаёт клавишу под Shift и Alt.
 * jsdom — не Apple, поэтому `mod` здесь — `Ctrl`.
 */
const KEY_CODES: Record<string, number> = {
  "↑": 38,
  "↓": 40,
  F10: 121,
  "]": 221,
  "[": 219,
  "\\": 220,
  ".": 190,
  ",": 188,
  "/": 191,
};
const KEY_NAMES: Record<string, string> = { "↑": "ArrowUp", "↓": "ArrowDown" };

function press(editor: Editor, keys: readonly string[]): boolean {
  const key = keys.at(-1)!;
  const shift = keys.includes("shift");
  const name =
    KEY_NAMES[key] ?? (key.length === 1 && /[A-Z]/.test(key) && !shift ? key.toLowerCase() : key);
  const event = new KeyboardEvent("keydown", {
    key: name,
    ctrlKey: keys.includes("mod"),
    altKey: keys.includes("alt"),
    shiftKey: shift,
    bubbles: true,
    cancelable: true,
  });
  const code = KEY_CODES[key] ?? key.toUpperCase().charCodeAt(0);
  Object.defineProperty(event, "keyCode", { value: code });
  act(() => void editor.view.dom.dispatchEvent(event));
  return event.defaultPrevented;
}

/** Каретка — в конец текста `text`; выделение — весь текст, если дан `to`. */
function selectText(editor: Editor, text: string, whole = false) {
  let from = -1;
  editor.state.doc.descendants((node, pos) => {
    if (from < 0 && node.isText && node.text === text) from = pos;
  });
  if (from < 0) throw new Error(`no text "${text}" in the document`);
  act(
    () =>
      void editor.commands.setTextSelection(
        whole ? { from, to: from + text.length } : from + text.length
      )
  );
}

interface Scenario {
  /** Документ до нажатия. */
  value: string;
  /** Что выделить; по умолчанию каретка в конце первого текста. */
  select: string;
  whole?: boolean;
  /** Проверка после нажатия сочетания из таблицы. */
  then: (editor: Editor, pressed: () => boolean) => void | Promise<void>;
}

const html =
  (expected: string): Scenario["then"] =>
  (editor, pressed) => {
    pressed();
    expect(editor.getHTML()).toBe(expected);
  };

const WORD = { value: "<p>word</p>", select: "word", whole: true } as const;

/** Что каждое сочетание таблицы обязано сделать в живом Редакторе. */
const SCENARIOS: Record<string, Scenario> = {
  selectBlock: {
    value: "<p>one two</p><p>three</p>",
    select: "one two",
    then: (editor, pressed) => {
      pressed();
      expect(
        editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to)
      ).toBe("one two");
    },
  },
  selectDocument: {
    value: "<p>one two</p><p>three</p>",
    select: "one two",
    then: (editor, pressed) => {
      pressed();
      pressed();
      expect(editor.state.selection).toBeInstanceOf(AllSelection);
    },
  },
  undo: {
    ...WORD,
    then: (editor, pressed) => {
      act(() => void editor.commands.toggleBold());
      expect(editor.getHTML()).toBe("<p><strong>word</strong></p>");
      pressed();
      expect(editor.getHTML()).toBe("<p>word</p>");
    },
  },
  redo: {
    ...WORD,
    then: (editor, pressed) => {
      act(() => void editor.commands.toggleBold());
      act(() => void editor.commands.undo());
      pressed();
      expect(editor.getHTML()).toBe("<p><strong>word</strong></p>");
    },
  },
  duplicateBlock: {
    value: "<p>a</p><p>b</p>",
    select: "a",
    then: html("<p>a</p><p>a</p><p>b</p>"),
  },
  moveBlockUp: { value: "<p>a</p><p>b</p>", select: "b", then: html("<p>b</p><p>a</p>") },
  moveBlockDown: { value: "<p>a</p><p>b</p>", select: "a", then: html("<p>b</p><p>a</p>") },
  blockActions: {
    value: "<p>word</p>",
    select: "word",
    then: async (_editor, pressed) => {
      pressed();
      expect(await screen.findByRole("menu", { name: "Block actions" })).toBeDefined();
    },
  },
  clearFormatting: {
    value: "<p><strong>word</strong></p>",
    select: "word",
    whole: true,
    then: html("<p>word</p>"),
  },
  bold: { ...WORD, then: html("<p><strong>word</strong></p>") },
  italic: { ...WORD, then: html("<p><em>word</em></p>") },
  strike: { ...WORD, then: html("<p><s>word</s></p>") },
  underline: { ...WORD, then: html("<p><u>word</u></p>") },
  code: { ...WORD, then: html("<p><code>word</code></p>") },
  superscript: { ...WORD, then: html("<p><sup>word</sup></p>") },
  subscript: { ...WORD, then: html("<p><sub>word</sub></p>") },
  paragraph: { value: "<h2>word</h2>", select: "word", then: html("<p>word</p>") },
  h1: { value: "<p>word</p>", select: "word", then: html("<h1>word</h1>") },
  h2: { value: "<p>word</p>", select: "word", then: html("<h2>word</h2>") },
  h3: { value: "<p>word</p>", select: "word", then: html("<h3>word</h3>") },
  h4: { value: "<p>word</p>", select: "word", then: html("<h4>word</h4>") },
  blockquote: {
    value: "<p>word</p>",
    select: "word",
    then: html("<blockquote><p>word</p></blockquote>"),
  },
  codeBlock: {
    value: "<p>word</p>",
    select: "word",
    then: (editor, pressed) => {
      pressed();
      expect(editor.getHTML()).toMatch(/^<pre><code[^>]*>word<\/code><\/pre>$/);
    },
  },
  bulletList: {
    value: "<p>word</p>",
    select: "word",
    then: html("<ul><li><p>word</p></li></ul>"),
  },
  orderedList: {
    value: "<p>word</p>",
    select: "word",
    then: html("<ol><li><p>word</p></li></ol>"),
  },
  taskList: {
    value: "<p>word</p>",
    select: "word",
    then: (editor, pressed) => {
      pressed();
      expect(editor.getHTML()).toContain('data-type="taskList"');
    },
  },
  indentListItem: {
    value: "<ul><li><p>a</p></li><li><p>b</p></li></ul>",
    select: "b",
    then: html("<ul><li><p>a</p><ul><li><p>b</p></li></ul></li></ul>"),
  },
  outdentListItem: {
    value: "<ul><li><p>a</p><ul><li><p>b</p></li></ul></li></ul>",
    select: "b",
    then: html("<ul><li><p>a</p></li><li><p>b</p></li></ul>"),
  },
  alignLeft: {
    value: '<p data-align="center">word</p>',
    select: "word",
    then: (editor, pressed) => {
      expect(editor.isActive({ textAlign: "center" })).toBe(true);
      pressed();
      expect(editor.isActive({ textAlign: "center" })).toBe(false);
    },
  },
  alignCenter: {
    value: "<p>word</p>",
    select: "word",
    then: (editor, pressed) => {
      pressed();
      expect(editor.isActive({ textAlign: "center" })).toBe(true);
    },
  },
  alignRight: {
    value: "<p>word</p>",
    select: "word",
    then: (editor, pressed) => {
      pressed();
      expect(editor.isActive({ textAlign: "right" })).toBe(true);
    },
  },
  link: {
    ...WORD,
    then: async (_editor, pressed) => {
      pressed();
      expect(await screen.findByRole("textbox", { name: "Address" })).toBeDefined();
    },
  },
  // Поиск (OLDSUI-151): панель открывается с выделенным словом в поле поиска.
  search: {
    ...WORD,
    then: async (_editor, pressed) => {
      pressed();
      const panel = await screen.findByRole("search", { name: "Find and replace" });
      const field = within(panel).getByRole("textbox", { name: "Find" }) as HTMLInputElement;
      expect(field.value).toBe("word");
    },
  },
  searchReplace: {
    ...WORD,
    then: async (_editor, pressed) => {
      pressed();
      const panel = await screen.findByRole("search", { name: "Find and replace" });
      const field = within(panel).getByRole("textbox", { name: "Replace with" });
      await waitFor(() => expect(document.activeElement).toBe(field));
    },
  },
  focusToolbar: {
    value: "<p>word</p>",
    select: "word",
    then: (_editor, pressed) => {
      pressed();
      const toolbar = screen.getByRole("toolbar", { name: "Formatting" });
      expect(toolbar.contains(document.activeElement)).toBe(true);
    },
  },
};

test("every command of the table has a scenario, and no scenario outlives its command", () => {
  expect(Object.keys(SCENARIOS).sort()).toEqual(SHORTCUTS.map((command) => command.id).sort());
});

test.each(SHORTCUTS.map((command) => [command.id, command] as const))(
  "the shortcut of %s does what its label promises",
  async (id, command) => {
    const scenario = SCENARIOS[id]!;
    const { editor } = renderEditor({ tools: [...TOOLS], defaultValue: scenario.value });
    act(() => editor.view.focus());
    selectText(editor, scenario.select, scenario.whole);

    // Что таблица обещает, то и нажимается: клавиши берутся из неё самой.
    await scenario.then(editor, () => press(editor, command.keys));
  }
);

test("a command whose tool is off does nothing: the label promises only enabled tools", () => {
  // Контроль обратной стороны: выключенный инструмент не в справочнике — и не в движке.
  const { editor } = renderEditor({ tools: ["bold"], defaultValue: "<p>word</p>" });
  selectText(editor, "word", true);

  press(editor, shortcutKeys("italic"));
  expect(editor.getHTML()).toBe("<p>word</p>");
  press(editor, shortcutKeys("bold"));
  expect(editor.getHTML()).toBe("<p><strong>word</strong></p>");
});

test("clear formatting without its tool is not in the reference and does not fire", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({
    tools: ["bold", "underline"],
    defaultValue: "<p><strong>word</strong></p>",
  });
  selectText(editor, "word", true);

  press(editor, shortcutKeys("clearFormatting"));
  expect(editor.getHTML()).toBe("<p><strong>word</strong></p>");
  const popover = await openReference(user);
  expect(commandNames(popover)).not.toContain("Clear formatting");
});

// --- Одна таблица на всех --------------------------------------------------

test("the toolbar buttons take their shortcuts from the table, name for name", () => {
  renderEditor({ tools: [...TOOLS] });
  const byLabel = new Map(
    SHORTCUTS.map((command) => [command.label(DEFAULT_MESSAGES.editor), command])
  );
  const toolbar = screen.getByRole("toolbar", { name: "Formatting" });

  let checked = 0;
  for (const button of toolbar.querySelectorAll<HTMLElement>("button[aria-keyshortcuts]")) {
    const label = button.getAttribute("aria-label")!;
    const command = byLabel.get(label);
    expect(command, `"${label}" has a shortcut on the toolbar but none in the table`).toBeDefined();
    expect(button.getAttribute("aria-keyshortcuts")).toBe(ariaShortcut(command!.keys, false));
    checked += 1;
  }
  // Недоверие к пустой проверке: жирный, курсив, ссылка, история и поиск.
  // Маркер в ряду сочетания не имеет; редкие метки, зачёркнутый, Блок кода
  // (OLDSUI-76) и очистка — в «…» (OLDSUI-65, OLDSUI-60), выравнивание и
  // списки — в своих меню (OLDSUI-66); их подписи сверяют
  // `rich-text-editor-more-menu.test.tsx` и
  // `rich-text-editor-align-list-menus.test.tsx`.
  expect(checked).toBe(6);
});

test("the table has no repeated id and no shared keys except the two-step select", () => {
  const ids = SHORTCUTS.map((command) => command.id);
  expect(new Set(ids).size).toBe(ids.length);

  // Одно сочетание на две команды допустимо только для двухступенчатого ⌘A.
  const seen = new Map<string, string>();
  for (const command of SHORTCUTS) {
    const signature = command.keys.join("+");
    const other = seen.get(signature);
    if (other) expect([other, command.id].sort()).toEqual(["selectBlock", "selectDocument"]);
    seen.set(signature, command.id);
  }
});
