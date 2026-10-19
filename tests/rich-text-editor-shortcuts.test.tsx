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
import { BlockSelection } from "../src/editor/core/blockSelection.js";
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

// Lazy `codeBlock` and `table` (OLDSUI-111): `full` is ready in `render` after the chunks load.
beforeAll(loadLazyBuiltins);

/*
  All the kit's shortcuts with all Tools: the `SHORTCUTS` table and the shortcuts from the
  descriptions of Tools (quote — OLDSUI-100, link button — OLDSUI-101). This is exactly what
  the full set's shortcuts popover shows.
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
 * The Editor's keyboard shortcuts popover (OLDSUI-67) and the table it is built from.
 *
 * Through the public `RichTextEditor`: roles, names, the table text and, most important,
 * real presses of the shortcuts from the table. A popover that promises ⌘⇧D where the engine
 * does not listen to it is worse than no popover at all. Real presses in the browser and the
 * open popover in the snapshots are in `tests-visual`.
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

/** Command labels in the popover's table, in row order. */
function commandNames(popover: HTMLElement) {
  return within(popover)
    .getAllByRole("rowheader")
    .map((cell) => cell.textContent);
}

/** The shortcut of a popover row, by command name. */
function keysOf(popover: HTMLElement, command: string) {
  const row = within(popover)
    .getAllByRole("row")
    .find((candidate) => within(candidate).queryByRole("rowheader", { name: command }));
  if (!row) throw new Error(`no row "${command}" in the reference`);
  return row.querySelector("kbd")?.textContent;
}

// --- Button ----------------------------------------------------------------

test("the reference button is the last one on the toolbar, with a tooltip", async () => {
  const user = userEvent.setup();
  renderEditor();

  const toolbar = screen.getByRole("toolbar", { name: "Formatting" });
  const buttons = Array.from(toolbar.querySelectorAll("button"));
  const button = screen.getByRole("button", { name: BUTTON });
  expect(buttons.at(-1)).toBe(button);
  // The kit's `Popover`: a popover, not a menu and not a dialog.
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

/** Touch screen: `matchMedia("(pointer: coarse)")` matches. */
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

  // On a touch screen, the fixed Toolbar is shown instead of the floating one, and the popover is on it.
  stubPointer(true);
  renderEditor({ toolbar: "floating" });
  expect(screen.getByRole("button", { name: BUTTON })).toBeDefined();
});

// --- Shortcuts popover ------------------------------------------------------------

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
  // A shortcut is the kit's `<kbd>`, not plain text.
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
    "Select block",
    "Extend selection",
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
    "Fullscreen",
    "Focus mode",
    "Go to the toolbar",
  ]);
});

test("the reference lists only the commands of the enabled tools", async () => {
  const user = userEvent.setup();
  renderEditor({ preset: "basic" });
  const popover = await openReference(user);
  const names = commandNames(popover);

  // The Block commands, the selection, and moving into the Toolbar are always there.
  for (const always of [
    "Select block text",
    "Duplicate block",
    "Move block up",
    "Go to the toolbar",
  ]) {
    expect(names, always).toContain(always);
  }
  // `basic` has no headings, underline, sub- and superscript, alignment, checklist,
  // code block, or clear styles, and so no rows for them either.
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
  // The item shift applies to any list, not to all of them at once.
  expect(rows(["taskList"])).toContain("indentListItem");
  expect(rows(["bold"])).not.toContain("indentListItem");
  // Without the Tools, only the commands that have no Tool of their own remain.
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

  // A fixed 384px column left an empty gap between the command and the shortcut (OLDSUI-117);
  // the screen edge still limits the width.
  expect(popover.className).toContain("w-max");
  expect(popover.className).not.toContain("w-96");
  expect(popover.className).toContain("max-w-[calc(100vw-2rem)]");
});

test("labels follow the platform: symbols on Apple, names elsewhere", async () => {
  // jsdom is not Apple: this is the same choice that `prosemirror-keymap` makes by `navigator.platform`.
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

// --- Focus and layers ----------------------------------------------------------

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
  // Focus returned to the button.
  await waitFor(() =>
    expect(document.activeElement).toBe(screen.getByRole("button", { name: BUTTON }))
  );

  // Control check: without the open popover, the same Escape closes the window. Focus is moved
  // into the Document, because on the button Escape would first close its tooltip. The first Escape
  // in the text selects the Block (the `blockSelection` Tool is in `full`, ADR-0077); the second
  // closes the window.
  act(() => ref.current!.editor!.view.focus());
  await user.keyboard("{Escape}");
  expect(onClose).not.toHaveBeenCalled();
  await user.keyboard("{Escape}");
  expect(onClose).toHaveBeenCalledTimes(1);
});

// --- Table against the engine -------------------------------------------------

/**
 * A `keydown` for a table entry, the way the keyboard sends it. `keyCode` is as in a real
 * browser: ProseMirror recognizes the key under Shift and Alt by it.
 * jsdom is not Apple, so `mod` here is `Ctrl`.
 */
const KEY_CODES: Record<string, number> = {
  Esc: 27,
  "↑": 38,
  "↓": 40,
  "↑/↓": 40,
  F10: 121,
  "]": 221,
  "[": 219,
  "\\": 220,
  ".": 190,
  ",": 188,
  "/": 191,
};
const KEY_NAMES: Record<string, string> = {
  "↑": "ArrowUp",
  "↓": "ArrowDown",
  // One row stands for both arrows; the press goes with the down one.
  "↑/↓": "ArrowDown",
  Esc: "Escape",
};

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

/** The caret goes to the end of the text `text`; the selection is the whole text if `to` is given. */
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
  /** The Document before the press. */
  value: string;
  /** What to select; by default the caret is at the end of the first text. */
  select: string;
  whole?: boolean;
  /** A check after pressing a shortcut from the table. */
  then: (editor: Editor, pressed: () => boolean) => void | Promise<void>;
}

const html =
  (expected: string): Scenario["then"] =>
  (editor, pressed) => {
    pressed();
    expect(editor.getHTML()).toBe(expected);
  };

const WORD = { value: "<p>word</p>", select: "word", whole: true } as const;

/** What each shortcut in the table must do in a live Editor. */
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
  // Search (OLDSUI-151): the panel opens with the selected word in the search field.
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
  // Block selection (OLDSUI-307): `Esc` selects the Block, `Shift+↓` grows the selection.
  blockSelect: {
    value: "<p>one</p><p>two</p>",
    select: "one",
    then: (editor, pressed) => {
      pressed();
      expect(editor.state.selection).toBeInstanceOf(BlockSelection);
    },
  },
  blockExtend: {
    value: "<p>one</p><p>two</p>",
    select: "one",
    then: (editor) => {
      press(editor, shortcutKeys("blockSelect"));
      expect((editor.state.selection as BlockSelection).count).toBe(1);
      press(editor, shortcutKeys("blockExtend"));
      expect((editor.state.selection as BlockSelection).count).toBe(2);
    },
  },
  // The view modes (OLDSUI-316): the same key turns the mode on and off.
  fullscreen: {
    value: "<p>word</p>",
    select: "word",
    then: async (editor, pressed) => {
      pressed();
      expect(await screen.findByRole("dialog", { name: "Fullscreen" })).toBeDefined();
      pressed();
      await waitFor(() => expect(screen.queryByRole("dialog", { name: "Fullscreen" })).toBeNull());
      expect(editor.isDestroyed).toBe(false);
    },
  },
  focusMode: {
    value: "<p>one</p><p>two</p>",
    select: "one",
    then: (editor, pressed) => {
      const dimmed = () => editor.view.dom.querySelectorAll(".rte-focus-dim").length;
      expect(dimmed()).toBe(0);
      pressed();
      expect(dimmed()).toBe(1);
      pressed();
      expect(dimmed()).toBe(0);
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

    // What the table promises is what gets pressed: the keys are taken from the table itself.
    await scenario.then(editor, () => press(editor, command.keys));
  }
);

test("a command whose tool is off does nothing: the label promises only enabled tools", () => {
  // Reverse check: a disabled Tool is not in the popover, and not in the engine.
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

// --- One table for all --------------------------------------------------

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
  // Guard against a check that passes on nothing: bold, italic, link, history and search.
  // The marker has no shortcut in the table; rare marks, strikethrough, the Code block
  // (OLDSUI-76) and clear styles are in "…" (OLDSUI-65, OLDSUI-60), and alignment and
  // lists are in their own menus (OLDSUI-66); their labels are checked by
  // `rich-text-editor-more-menu.test.tsx` and
  // `rich-text-editor-align-list-menus.test.tsx`.
  expect(checked).toBe(6);
});

test("the table has no repeated id and no shared keys except the two-step select", () => {
  const ids = SHORTCUTS.map((command) => command.id);
  expect(new Set(ids).size).toBe(ids.length);

  // One shortcut for two commands is allowed only for the two-step ⌘A.
  const seen = new Map<string, string>();
  for (const command of SHORTCUTS) {
    const signature = command.keys.join("+");
    const other = seen.get(signature);
    if (other) expect([other, command.id].sort()).toEqual(["selectBlock", "selectDocument"]);
    seen.set(signature, command.id);
  }
});
