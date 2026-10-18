// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import type { Editor } from "@tiptap/react";
import { createRef } from "react";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { UiProvider } from "../src/i18n/UiProvider.js";
import { messages as ru } from "../src/locales/ru.js";
import { WrapperIcon } from "../src/icons.js";
import {
  RichTextEditor,
  type CustomTool,
  type RichTextEditorHandle,
  type RichTextEditorProps,
} from "../src/editor/index.js";
import { resetDevWarnings } from "../src/lib/dev-warn.js";
import { TOOLS } from "../src/editor/core/tools.js";
import { TEST_TOOLS, testBoxTool, testCardTool, testNoteTool } from "./editor-test-tools.js";
import { loadLazyBuiltins } from "./editor-lazy-builtins.js";

// Lazy `codeBlock` and `table` (OLDSUI-111): `full` is ready in `render` after the chunks load.
beforeAll(loadLazyBuiltins);

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  resetDevWarnings();
});

/**
 * Insert item and Block action of a custom Tool (OLDSUI-106,
 * ADR-0058, sections 5 and 6).
 *
 * Through the public `RichTextEditor`: the description of a custom Tool goes into
 * `tools`, and what is checked is the Slash menu ('/', '+'), 'Add ›' and 'Format ›'
 * of the Block handle, the Block action in its menu, the shortcuts and the reference, by roles and names,
 * the way the author sees them. The test Tools come from the shared helper
 * `editor-test-tools.ts`: a box (an 'Add' item and the 'Unbox' action),
 * a card (a 'Turn into' item and an action with the 'Enlarge' predicate).
 */
function renderEditor(props: Partial<RichTextEditorProps> = {}, locale?: "ru") {
  const ref = createRef<RichTextEditorHandle>();
  const field = (
    <RichTextEditor ref={ref} aria-label="Body" tools={[...TOOLS, ...TEST_TOOLS]} {...props} />
  );
  const view = render(
    locale ? (
      <UiProvider locale={locale} messages={ru}>
        {field}
      </UiProvider>
    ) : (
      field
    )
  );
  const editor = ref.current?.editor;
  if (!editor) throw new Error("the editor was not created inside render()");
  return { ...view, editor };
}

/** Focus the Document and move the caret to the end of the `text` text. */
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

/** Types text at the caret position as a transaction, the way real input would. */
function type(editor: Editor, text: string) {
  act(() => void editor.commands.insertContent(text));
}

/** A key press on the field is a real `keydown`, the way both ProseMirror and the menus receive it. */
function press(editor: Editor, key: string, modifiers: KeyboardEventInit = {}) {
  const event = new KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true,
    ...modifiers,
  });
  Object.defineProperty(event, "keyCode", { value: key.toUpperCase().charCodeAt(0) });
  act(() => void editor.view.dom.dispatchEvent(event));
  return event.defaultPrevented;
}

const HANDLE = "Block actions";
const box = (...blocks: string[]) => `<div data-block="test_box">${blocks.join("")}</div>`;
const card = (text: string, size?: string) =>
  `<div data-block="test_card"${size ? ` data-test_size="${size}"` : ""}>${text}</div>`;

/** Items of any `menuitem*` role: the name without the shortcut label, and the label itself. */
function itemsOf(menu: HTMLElement) {
  return Array.from(menu.querySelectorAll<HTMLElement>('[role^="menuitem"]')).map((item) => {
    const shortcut = item.querySelector("kbd")?.textContent ?? null;
    return { name: (item.textContent ?? "").replace(shortcut ?? "", ""), shortcut, item };
  });
}

type User = ReturnType<typeof userEvent.setup>;

async function openHandleMenu(user: User) {
  await user.click(screen.getByRole("button", { name: HANDLE }));
  return screen.findByRole("menu", { name: HANDLE });
}

async function openSubmenu(user: User, menu: HTMLElement, name: string) {
  await user.click(within(menu).getByRole("menuitem", { name }));
  return screen.findByRole("menu", { name });
}

/** Select the `name` item in the Block handle menu; `path` is the submenu path. */
async function choose(user: User, ...path: string[]) {
  let menu = await openHandleMenu(user);
  for (const step of path.slice(0, -1)) menu = await openSubmenu(user, menu, step);
  const name = path.at(-1)!;
  const found = itemsOf(menu).find((entry) => entry.name === name);
  if (!found) throw new Error(`no item "${name}" in the menu`);
  await user.click(found.item);
}

const undo = (editor: Editor) => act(() => void editor.commands.undo());

// ── Slash menu: '/' ──────────────────────────────────────────────────────

/** Rows of the '/' list by section. */
function slashRows() {
  const rows = (section: string) =>
    Array.from(
      screen.getByRole("group", { name: section }).querySelectorAll('[role="option"]')
    ).map((option) => option.textContent?.trim());
  return { insert: rows("Insert"), turnInto: rows("Turn into") };
}

test("own items stand at the end of their section, after the kit's, with the shortcut hint", () => {
  const { editor } = renderEditor({ defaultValue: "<p>One</p>" });
  caretIn(editor, "One");
  type(editor, " /");

  const { insert, turnInto } = slashRows();
  expect(insert.at(-1)).toMatch(/^Box en-US/);
  expect(insert.at(-8)).toMatch(/^Wrapper/);
  expect(insert.at(-7)).toMatch(/^Collapsible block/);
  // The inline Footnote (OLDSUI-306) follows the Details Block.
  expect(insert.at(-6)).toMatch(/^Footnote/);
  // Formulas (OLDSUI-280) and videos (OLDSUI-281) are in the `TOOLS` set but outside the presets: after
  // the Footnote, before the custom ones. The date mention (OLDSUI-309) stands between them.
  expect(insert.at(-5)).toMatch(/^Formula/);
  expect(insert.at(-4)).toMatch(/^Block formula/);
  expect(insert.at(-3)).toMatch(/^Date/);
  expect(insert.at(-2)).toMatch(/^Video/);
  expect(turnInto.at(-1)).toMatch(/^Card/);
  expect(turnInto.at(-2)).toMatch(/^Code block/);
  // The hint is the shortcut from the item: Ctrl on non-Apple platforms (jsdom).
  expect(insert.at(-1)).toBe("Box en-USCtrl+Alt+B");
});

test("own items follow the order of tools", () => {
  const second: CustomTool = {
    ...testNoteTool,
    name: "test_second",
    marks: undefined,
    engine: [],
    insertItems: [{ section: "insert", label: "Second", icon: WrapperIcon, run: (chain) => chain }],
  };
  const first: CustomTool = {
    ...second,
    name: "test_first",
    insertItems: [{ section: "insert", label: "First", icon: WrapperIcon, run: (chain) => chain }],
  };
  const { editor } = renderEditor({
    defaultValue: "<p>One</p>",
    tools: [...TOOLS, second, first, testBoxTool],
  });
  caretIn(editor, "One");
  type(editor, " /");

  expect(slashRows().insert.slice(-3)).toEqual(["Second", "First", "Box en-USCtrl+Alt+B"]);
});

test("filtering finds own items by the label, the en-US label and aliases", () => {
  const { editor } = renderEditor({ defaultValue: "<p>One</p>" }, "ru");
  caretIn(editor, "One");
  const query = (text: string) => {
    act(() => void editor.commands.setContent("<p>One</p>"));
    caretIn(editor, "One");
    type(editor, ` /${text}`);
    return Array.from(screen.queryAllByRole("option")).map((option) => option.textContent);
  };

  // The label in the current locale ('Box ru'), the label with `en-US`, and `aliases`.
  expect(query("ru")).toEqual(["Box ruCtrl+Alt+B"]);
  expect(query("en-us")).toEqual(["Box ruCtrl+Alt+B"]);
  expect(query("crate")).toEqual(["Box ruCtrl+Alt+B"]);
  expect(query("tile")).toEqual(["CardCtrl+Alt+K"]);
});

test("Enter on own Insert item adds its block in place of the empty paragraph, one undo step", () => {
  const { editor } = renderEditor({ defaultValue: "<p>Intro</p>" });
  caretIn(editor, "Intro");
  act(() => void editor.commands.splitBlock());
  type(editor, "/crate");
  press(editor, "Enter");

  expect(editor.getHTML()).toBe(`<p>Intro</p>${box("<p></p>")}`);
  expect(screen.queryByRole("listbox")).toBeNull();
  // Typing `/query` and the insert are one history step together with the edit before them: a single undo removes the Block.
  undo(editor);
  expect(editor.getHTML()).not.toContain("test_box");
});

test("own Insert item after text adds the block after the current one", () => {
  const { editor } = renderEditor({ defaultValue: "<p>Intro</p>" });
  caretIn(editor, "Intro");
  type(editor, " /box");
  press(editor, "Enter");

  expect(editor.getHTML()).toBe(`<p>Intro </p>${box("<p></p>")}`);
});

test("Enter on own Turn into item changes the current block and keeps its text, one undo step", () => {
  const { editor } = renderEditor({ defaultValue: "<ul><li><p>Point</p></li></ul>" });
  caretIn(editor, "Point");
  type(editor, " /tile");
  press(editor, "Enter");

  expect(editor.getHTML()).toBe(card("Point "));
  undo(editor);
  expect(editor.getHTML()).toBe("<ul><li><p>Point</p></li></ul>");
});

// ── Slash menu: '+' ──────────────────────────────────────────────────────

test("the Insert menu button lists own items with hints and applies them", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: "<p>One</p>" });
  caretIn(editor, "One");

  await user.click(screen.getByRole("button", { name: "Insert block" }));
  const menu = await screen.findByRole("menu", { name: "Insert block" });
  const items = itemsOf(menu);
  const names = items.map((entry) => entry.name);
  expect(names.indexOf("Box en-US")).toBeGreaterThan(names.indexOf("Wrapper"));
  expect(names.at(-1)).toBe("Card");
  expect(items.find((entry) => entry.name === "Box en-US")?.shortcut).toBe("Ctrl+Alt+B");

  await user.click(items.find((entry) => entry.name === "Box en-US")!.item);
  expect(editor.getHTML()).toBe(`<p>One</p>${box("<p></p>")}`);
  undo(editor);
  expect(editor.getHTML()).toBe("<p>One</p>");
});

// ── Block handle: 'Add ›' and 'Format ›' ─────────────────────────────────

test("Add lists own items and puts a new block under the current one, one undo step", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: "<p>One</p><p>Two</p>" });
  caretIn(editor, "One");

  const add = await openSubmenu(user, await openHandleMenu(user), "Add");
  const names = itemsOf(add).map((entry) => entry.name);
  // The inline Footnote and Date are not offered: "Add" means a new Block below.
  expect(names.slice(-7)).toEqual([
    "Wrapper",
    "Collapsible block",
    "Formula",
    "Block formula",
    "Video",
    "Box en-US",
    "Card",
  ]);
  // The 'Add' items have no shortcut hints, as for the built-in ones.
  expect(itemsOf(add).every((entry) => entry.shortcut === null)).toBe(true);

  await user.click(itemsOf(add).find((entry) => entry.name === "Box en-US")!.item);
  expect(editor.getHTML()).toBe(`<p>One</p>${box("<p></p>")}<p>Two</p>`);
  undo(editor);
  expect(editor.getHTML()).toBe("<p>One</p><p>Two</p>");
});

test("Format lists own Turn into items and takes the block out of the list, one undo step", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: "<ul><li><p>a</p></li><li><p>b</p></li></ul>" });
  caretIn(editor, "a");

  const format = await openSubmenu(user, await openHandleMenu(user), "Format");
  const names = itemsOf(format).map((entry) => entry.name);
  expect(names.at(-1)).toBe("Card");
  // Items from 'Add' do not appear in 'Format'.
  expect(names).not.toContain("Box en-US");

  await user.click(itemsOf(format).find((entry) => entry.name === "Card")!.item);
  // The list leaves its wrappers; each of its paragraphs becomes a card, as with 'Heading'.
  expect(editor.getHTML()).toBe(card("a") + card("b"));
  undo(editor);
  expect(editor.getHTML()).toBe("<ul><li><p>a</p></li><li><p>b</p></li></ul>");
});

test("Format shows the shortcut of an own item where it works, and turns a paragraph", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: "<p>One</p>" });
  caretIn(editor, "One");

  const format = await openSubmenu(user, await openHandleMenu(user), "Format");
  expect(itemsOf(format).find((entry) => entry.name === "Card")?.shortcut).toBe("Ctrl+Alt+K");
  await user.click(itemsOf(format).find((entry) => entry.name === "Card")!.item);
  expect(editor.getHTML()).toBe(card("One"));
});

// ── Labels from the locale ──────────────────────────────────────────────────────

test("a label function gets the locale of the provider", async () => {
  const user = userEvent.setup();
  const view = renderEditor({ defaultValue: "<p>One</p>" }, "ru");
  caretIn(view.editor, "One");

  await user.click(screen.getByRole("button", { name: ru.editor.insertMenu }));
  expect(
    itemsOf(await screen.findByRole("menu", { name: ru.editor.insertMenu })).map(
      (entry) => entry.name
    )
  ).toContain("Box ru");
});

test("an empty label is a developer error and the tool name stands in for it", () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  const silent: CustomTool = {
    ...testBoxTool,
    insertItems: [
      { section: "insert", label: () => "  ", icon: WrapperIcon, run: (chain) => chain },
    ],
  };
  const { editor } = renderEditor({
    defaultValue: "<p>One</p>",
    tools: [...TOOLS, silent],
  });
  caretIn(editor, "One");
  type(editor, " /");

  expect(slashRows().insert.at(-1)).toBe("test_box");
  expect(error).toHaveBeenCalledWith(expect.stringContaining('custom tool "test_box"'));
});

// ── Block action ────────────────────────────────────────────────────

test("an own action stands in its section right before Delete, with its shortcut", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: `<p>Plain</p>${box("<p>in</p>")}` });
  // A Block right inside the box: the action is visible on it too (`blocks` names the container as well).
  caretIn(editor, "in");

  const items = itemsOf(await openHandleMenu(user));
  expect(items.slice(-2).map((entry) => entry.name)).toEqual(["Unbox", "Delete"]);
  expect(items.find((entry) => entry.name === "Unbox")?.shortcut).toBe("Ctrl+Alt+U");
  expect(items.map((entry) => entry.name)).not.toContain("Enlarge");
});

test("blocks of other tools and of the kit have no own action", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: `<p>Plain</p>${box("<p>in</p>")}` });
  caretIn(editor, "Plain");

  const names = itemsOf(await openHandleMenu(user)).map((entry) => entry.name);
  expect(names).not.toContain("Unbox");
  expect(names).not.toContain("Enlarge");
});

test("Unbox gets the position of the block, one undo step", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: box("<p>a</p>", "<p>b</p>") });
  caretIn(editor, "b");

  await choose(user, "Unbox");
  expect(editor.getHTML()).toBe("<p>a</p><p>b</p>");
  undo(editor);
  expect(editor.getHTML()).toBe(box("<p>a</p>", "<p>b</p>"));
});

test("the visibility predicate hides the action once it no longer applies", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: `${card("Card")}<p>After</p>` });
  caretIn(editor, "Card");

  let menu = await openHandleMenu(user);
  expect(itemsOf(menu).map((entry) => entry.name)).toContain("Enlarge");
  await user.click(itemsOf(menu).find((entry) => entry.name === "Enlarge")!.item);
  expect(editor.getHTML()).toBe(`${card("Card", "l")}<p>After</p>`);

  caretIn(editor, "Card");
  menu = await openHandleMenu(user);
  expect(itemsOf(menu).map((entry) => entry.name)).not.toContain("Enlarge");
});

// ── Disabled Tool ─────────────────────────────────────────────────

test("a tool left out of tools takes its items and actions away everywhere", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({
    defaultValue: `<p>One</p>`,
    tools: [...TOOLS, testNoteTool],
  });
  caretIn(editor, "One");
  type(editor, " /");
  expect(slashRows().insert.join()).not.toContain("Box");
  expect(slashRows().turnInto.join()).not.toContain("Card");
  press(editor, "Escape");

  const menu = await openHandleMenu(user);
  const add = await openSubmenu(user, menu, "Add");
  expect(itemsOf(add).map((entry) => entry.name)).not.toContain("Box en-US");
});

test("without the insert menu tool own items are not offered", () => {
  const { editor } = renderEditor({
    defaultValue: "<p>One</p>",
    tools: ["bold", testBoxTool],
  });
  caretIn(editor, "One");
  type(editor, " /");

  expect(screen.queryByRole("listbox")).toBeNull();
  expect(screen.queryByRole("button", { name: "Insert block" })).toBeNull();
});

// ── Shortcuts ──────────────────────────────────────────────────────────────

const CTRL_ALT = { ctrlKey: true, altKey: true };

test("the shortcut of an own Insert item does what the hint promises", () => {
  const { editor } = renderEditor({ defaultValue: "<p>One</p>" });
  caretIn(editor, "One");

  expect(press(editor, "b", CTRL_ALT)).toBe(true);
  expect(editor.getHTML()).toBe(`<p>One</p>${box("<p></p>")}`);
  undo(editor);
  expect(editor.getHTML()).toBe("<p>One</p>");
});

test("the shortcut of an own Turn into item changes the current block", () => {
  const { editor } = renderEditor({ defaultValue: "<p>One</p>" });
  caretIn(editor, "One");

  press(editor, "k", CTRL_ALT);
  expect(editor.getHTML()).toBe(card("One"));
});

test("the shortcut of an own action works only where the action is visible", () => {
  const { editor } = renderEditor({ defaultValue: `<p>Plain</p>${box("<p>in</p>")}` });
  caretIn(editor, "Plain");
  expect(press(editor, "u", CTRL_ALT)).toBe(false);
  expect(editor.getHTML()).toBe(`<p>Plain</p>${box("<p>in</p>")}`);

  caretIn(editor, "in");
  expect(press(editor, "u", CTRL_ALT)).toBe(true);
  expect(editor.getHTML()).toBe("<p>Plain</p><p>in</p>");
});

test("the shortcuts are not bound in a read-only field", () => {
  const { editor } = renderEditor({ defaultValue: "<p>One</p>", readOnly: true });
  act(() => editor.view.focus());
  press(editor, "b", CTRL_ALT);
  expect(editor.getHTML()).toBe("<p>One</p>");
});

test("the shortcut reference lists them in a group of the tool, after the kit's groups", async () => {
  const user = userEvent.setup();
  renderEditor({ defaultValue: "<p>One</p>" });

  await user.click(screen.getByRole("button", { name: "Keyboard shortcuts" }));
  const table = await screen.findByRole("table");
  const rows = within(table)
    .getAllByRole("row")
    .map((row) => row.textContent);
  const at = (text: string) => rows.findIndex((row) => row?.startsWith(text));
  expect(rows[at("Box en-US")]).toBe("Box en-USCtrl+Alt+B");
  expect(rows[at("Card")]).toBe("CardCtrl+Alt+K");
  expect(rows[at("Unbox")]).toBe("UnboxCtrl+Alt+U");
  // The group of a custom Tool comes after the kit's groups: the kit's last row comes earlier.
  expect(at("Box en-US")).toBeGreaterThan(at("Bold"));
});

// ── Definition error ──────────────────────────────────────────────────────────

/** A definition with an error: a field error, without an engine. */
function expectFieldError(tool: unknown, reason: RegExp) {
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  const ref = createRef<RichTextEditorHandle>();
  render(
    <RichTextEditor
      ref={ref}
      aria-label="Body"
      defaultValue="<p>One</p>"
      tools={[...TOOLS, tool as CustomTool]}
    />
  );
  expect(screen.getByRole("alert").textContent).toBe(
    "The editor couldn't start. The document is unchanged."
  );
  expect(ref.current?.editor).toBeNull();
  expect(error).toHaveBeenCalledWith(expect.stringMatching(reason));
}

const item = {
  section: "insert",
  label: "Item",
  icon: WrapperIcon,
  run: (chain: unknown) => chain,
};
const action = { label: "Act", icon: WrapperIcon, blocks: ["test_box"], run: () => {} };

test.each([
  ["insertItems is not an array", { insertItems: item }, /insertItems must be an array/],
  [
    "an insert item without run",
    { insertItems: [{ ...item, run: undefined }] },
    /insertItems\[0\] needs exactly one of run and popover/,
  ],
  [
    "an insert item without an icon",
    { insertItems: [{ ...item, icon: undefined }] },
    /insertItems\[0\] needs a label/,
  ],
  [
    "an insert item with an unknown section",
    { insertItems: [{ ...item, section: "format" }] },
    /insertItems\[0\]: section is "insert" or "turnInto"/,
  ],
  [
    "aliases that are not strings",
    { insertItems: [{ ...item, aliases: ["ok", 1] }] },
    /insertItems\[0\]: aliases is a list of strings/,
  ],
  [
    "a shortcut of one key",
    { insertItems: [{ ...item, shortcut: ["B"] }] },
    /insertItems\[0\]: shortcut is a list of keys/,
  ],
  [
    "an action without block names",
    { blockActions: [{ ...action, blocks: [] }] },
    /blockActions\[0\]: blocks is a list of block names/,
  ],
  [
    "an action with a predicate that is not a function",
    { blockActions: [{ ...action, isVisible: true }] },
    /blockActions\[0\]: isVisible is a function/,
  ],
  [
    "an action that is not an object",
    { blockActions: [null] },
    /blockActions\[0\] must be an object/,
  ],
  ["textCards is not an array", { textCards: {} }, /textCards must be an array/],
  ["a text card that is not an object", { textCards: [null] }, /textCards\[0\] must be an object/],
  [
    "a text card with a label that is neither a string nor a function",
    { textCards: [{ label: 1, rangeAt: () => null, render: () => null }] },
    /textCards\[0\] needs a label \(string or function\) and rangeAt/,
  ],
])("%s is a field error", (_, fields, reason) => {
  expectFieldError({ ...testCardTool, name: "test_card", ...fields }, reason);
});
