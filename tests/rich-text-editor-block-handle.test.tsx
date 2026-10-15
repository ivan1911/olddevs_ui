// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import type { Editor } from "@tiptap/react";
import { NodeSelection, TextSelection } from "@tiptap/pm/state";
import { createRef } from "react";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { ModalOverlay } from "../src/components/overlays/ModalOverlay.js";
import { UiProvider } from "../src/i18n/UiProvider.js";
import { MENU_ITEM_TONE } from "../src/lib/menu.js";
import { messages as ru } from "../src/locales/ru.js";
import {
  RichTextEditor,
  type RichTextEditorHandle,
  type RichTextEditorProps,
} from "../src/editor/index.js";
import { TOOLS } from "../src/editor/core/tools.js";
import { loadLazyBuiltins } from "./editor-lazy-builtins.js";

// Ленивые `codeBlock` и `table` (OLDSUI-111): `full` готов в `render` после загрузки чанков.
beforeAll(loadLazyBuiltins);

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/**
 * Ручка Блока «⋮» и её меню (OLDSUI-72).
 *
 * Через публичный `RichTextEditor`: ручка и пункты — ролями и именами, как их
 * слышит скринридер, результат — выходным HTML и шагом отмены. Каретка
 * ставится командами движка (jsdom не умеет ввода в `contenteditable`), фокус —
 * `view.focus()`: ручка видна только при фокусе в Документе. Раскладки в jsdom
 * нет, поэтому место ручки здесь не проверяется — его смотрят снимки и
 * `tests-visual/rich-text-editor-block-handle.spec.ts`.
 */
function renderEditor(props: Partial<RichTextEditorProps> = {}) {
  const ref = createRef<RichTextEditorHandle>();
  const view = render(
    <>
      <button type="button">Before</button>
      <RichTextEditor ref={ref} aria-label="Body" tools={[...TOOLS]} {...props} />
    </>
  );
  const editor = ref.current?.editor;
  if (!editor) throw new Error("the editor was not created inside render()");
  return { ...view, editor };
}

/** Фокус в Документ и каретка в конец текста `text`. */
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

/** Фокус в Документ и выделение узлом Блока Документа с номером `index`. */
function selectNode(editor: Editor, index: number) {
  const { doc } = editor.state;
  let pos = 0;
  for (let i = 0; i < index; i++) pos += doc.child(i).nodeSize;
  act(() => {
    editor.view.focus();
    editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(doc, pos)));
  });
}

const HANDLE = "Block actions";
const handle = () => screen.getByRole("button", { name: HANDLE });
const queryHandle = () => screen.queryByRole("button", { name: HANDLE });
const textbox = () => screen.getByRole("textbox", { name: "Body" });

async function openMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(handle());
  return screen.findByRole("menu", { name: HANDLE });
}

/** Пункты меню любой роли: `menuitem`, `menuitemradio`. */
const menuItems = (menu: HTMLElement) =>
  Array.from(menu.querySelectorAll<HTMLElement>('[role^="menuitem"]'));

/** Пункты меню: имя без подписи сочетания, подпись, недоступность. */
function itemsOf(menu: HTMLElement) {
  return menuItems(menu).map((item) => {
    const shortcut = item.querySelector("kbd")?.textContent ?? null;
    return {
      name: (item.textContent ?? "").replace(shortcut ?? "", ""),
      shortcut,
      disabled: item.getAttribute("aria-disabled") === "true",
    };
  });
}

const shortcutOf = (menu: HTMLElement, name: string) =>
  itemsOf(menu).find((item) => item.name === name)?.shortcut ?? null;

/** Открыть подменю пункта `name` и вернуть его. */
async function openSubmenu(
  user: ReturnType<typeof userEvent.setup>,
  menu: HTMLElement,
  name: string
) {
  await user.click(within(menu).getByRole("menuitem", { name }));
  return screen.findByRole("menu", { name });
}

/** Выбрать пункт `name` меню ручки (подменю — `path`). */
async function choose(user: ReturnType<typeof userEvent.setup>, ...path: string[]) {
  let menu = await openMenu(user);
  for (const step of path.slice(0, -1)) menu = await openSubmenu(user, menu, step);
  const name = path.at(-1)!;
  const item = menuItems(menu).find((candidate) => candidate.textContent?.startsWith(name));
  if (!item) throw new Error(`no item "${name}" in the menu`);
  await user.click(item);
}

function undo(editor: Editor) {
  act(() => void editor.commands.undo());
}

const PHOTO = "https://cdn.example.com/photo.png";
const FIGURE = `<figure><img src="${PHOTO}" alt="A lake"><figcaption>Lake</figcaption></figure>`;
const TABLE =
  "<table><tbody><tr><th><p>h1</p></th></tr><tr><td><p>c1</p></td></tr></tbody></table>";
const LIST = "<ul><li><p>a</p></li><li><p>b</p></li></ul>";

// --- Видимость --------------------------------------------------------------

test("the handle shows only with the caret in the document, not before focus and not after it leaves", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: "<p>One</p>" });
  expect(queryHandle()).toBeNull();

  caretIn(editor, "One");
  expect(handle()).toBeDefined();
  expect(handle().getAttribute("aria-haspopup")).toBe("menu");
  expect(handle().getAttribute("aria-keyshortcuts")).toBe("Control+/");

  await user.click(screen.getByRole("button", { name: "Before" }));
  expect(queryHandle()).toBeNull();
});

test.each([
  ["a paragraph", "<p>One</p>", "One"],
  ["a list item", LIST, "b"],
  ["a table cell", TABLE, "c1"],
  ["a quote", "<blockquote><p>Said</p></blockquote>", "Said"],
])("the caret in %s shows the handle", (_, html, text) => {
  const { editor } = renderEditor({ defaultValue: html });
  caretIn(editor, text);
  expect(handle()).toBeDefined();
});

test("a selected image and a selected line show the handle too", () => {
  const { editor } = renderEditor({ defaultValue: `<p>One</p>${FIGURE}<hr>` });
  selectNode(editor, 1);
  expect(handle()).toBeDefined();
  selectNode(editor, 2);
  expect(handle()).toBeDefined();
});

test("a selection across two blocks has no handle: there is no single block to act on", () => {
  const { editor } = renderEditor({ defaultValue: "<p>One</p><p>Two</p>" });
  caretIn(editor, "One");
  act(() => void editor.commands.setTextSelection({ from: 2, to: 8 }));
  expect(queryHandle()).toBeNull();
});

test("read-only and disabled editors have no handle; read-only has no left margin for it", () => {
  const { editor, unmount } = renderEditor({ defaultValue: "<p>One</p>", readOnly: true });
  caretIn(editor, "One");
  expect(queryHandle()).toBeNull();
  expect(textbox().classList.contains("pl-6")).toBe(false);
  unmount();

  const disabled = renderEditor({ defaultValue: "<p>One</p>", disabled: true });
  caretIn(disabled.editor, "One");
  expect(queryHandle()).toBeNull();
});

test("an editable document keeps a left margin for the handle", () => {
  renderEditor({ defaultValue: "<p>One</p>" });
  expect(textbox().classList.contains("pl-6")).toBe(true);
});

test("the handle is out of the Tab order", () => {
  const { editor } = renderEditor({ defaultValue: "<p>One</p>" });
  caretIn(editor, "One");
  expect(handle().tabIndex).toBe(-1);
});

// --- Состав меню ------------------------------------------------------------

test("the menu: Add, Format, Move up, Move down, Duplicate, Delete — Delete in the danger tone", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: "<p>One</p><p>Two</p>" });
  caretIn(editor, "Two");

  const menu = await openMenu(user);
  expect(itemsOf(menu).map((item) => item.name)).toEqual([
    "Add",
    "Format",
    "Move up",
    "Move down",
    "Duplicate",
    "Delete",
  ]);
  const remove = within(menu).getByRole("menuitem", { name: "Delete" });
  for (const token of MENU_ITEM_TONE.danger.split(" ")) expect(remove.className).toContain(token);
  // У последнего Блока ниже некуда.
  expect(itemsOf(menu).find((item) => item.name === "Move down")?.disabled).toBe(true);
  expect(itemsOf(menu).find((item) => item.name === "Move up")?.disabled).toBe(false);
});

test("Add offers the insert menu items once each, without shortcut hints", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: "<p>One</p>" });
  caretIn(editor, "One");

  const add = await openSubmenu(user, await openMenu(user), "Add");
  const items = itemsOf(add);
  expect(items.map((item) => item.name)).toEqual([
    "Paragraph",
    "Heading 1",
    "Heading 2",
    "Heading 3",
    "Heading 4",
    "Bulleted list",
    "Numbered list",
    "Checklist",
    "Quote",
    "Code block",
    "Divider",
    "Table",
    "Image",
    // Раскладка (OLDSUI-74) — подменю шести вариантов: `rich-text-editor-layout.test.tsx`.
    "Layout",
    // Обёртка (OLDSUI-77): `rich-text-editor-wrapper.test.tsx`.
    "Wrapper",
    // Сворачиваемый Блок (OLDSUI-277): `rich-text-editor-details.test.tsx`.
    "Collapsible block",
  ]);
  expect(items.every((item) => item.shortcut === null)).toBe(true);
});

test("without the insert menu tool there is no Add", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({
    defaultValue: "<p>One</p>",
    tools: TOOLS.filter((tool) => tool !== "insertMenu"),
  });
  caretIn(editor, "One");
  const menu = await openMenu(user);
  expect(itemsOf(menu).map((item) => item.name)).not.toContain("Add");
});

// --- Подписи сочетаний ------------------------------------------------------

test("shortcuts are signed when they do the same: a top-level paragraph", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: "<p>One</p><p>Two</p>" });
  caretIn(editor, "Two");

  const menu = await openMenu(user);
  expect(shortcutOf(menu, "Move up")).toBe("Alt+Shift+↑");
  expect(shortcutOf(menu, "Move down")).toBe("Alt+Shift+↓");
  expect(shortcutOf(menu, "Duplicate")).toBe("Ctrl+Shift+D");
  expect(shortcutOf(menu, "Delete")).toBeNull();
  const format = await openSubmenu(user, menu, "Format");
  expect(shortcutOf(format, "Heading 2")).toBe("Ctrl+Alt+2");
});

test("in a list item the keys act on the item, not the list: no shortcut is signed", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: `<p>One</p>${LIST}` });
  caretIn(editor, "b");

  const menu = await openMenu(user);
  expect(shortcutOf(menu, "Move up")).toBeNull();
  expect(shortcutOf(menu, "Duplicate")).toBeNull();
  const format = await openSubmenu(user, menu, "Format");
  expect(itemsOf(format).every((item) => item.shortcut === null)).toBe(true);
});

test("in a table Alt+Shift+arrows belong to rows: Move is unsigned, Duplicate copies the table and is signed", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: `<p>One</p>${TABLE}` });
  caretIn(editor, "c1");

  const menu = await openMenu(user);
  expect(shortcutOf(menu, "Move up")).toBeNull();
  expect(shortcutOf(menu, "Duplicate")).toBe("Ctrl+Shift+D");
});

test("on Apple the shortcuts are signed with symbols", async () => {
  vi.spyOn(navigator, "platform", "get").mockReturnValue("MacIntel");
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: "<p>One</p><p>Two</p>" });
  caretIn(editor, "Two");

  expect(handle().getAttribute("aria-keyshortcuts")).toBe("Meta+/");
  const menu = await openMenu(user);
  expect(shortcutOf(menu, "Move up")).toBe("⌥+⇧+↑");
  expect(shortcutOf(menu, "Duplicate")).toBe("⌘+⇧+D");
});

// --- Действия ---------------------------------------------------------------

/** Действие — одна правка на отмену и фокус в Документе после неё. */
async function expectOneUndoAndFocus(editor: Editor, before: string) {
  await waitFor(() => expect(document.activeElement).toBe(textbox()));
  undo(editor);
  expect(editor.getHTML()).toBe(before);
}

test("Move up and Move down swap the block with its neighbour", async () => {
  const user = userEvent.setup();
  const before = "<p>One</p><p>Two</p><p>Three</p>";
  const { editor } = renderEditor({ defaultValue: before });
  caretIn(editor, "Two");

  await choose(user, "Move up");
  expect(editor.getHTML()).toBe("<p>Two</p><p>One</p><p>Three</p>");
  expect(editor.state.selection.$from.parent.textContent).toBe("Two");
  await expectOneUndoAndFocus(editor, before);

  caretIn(editor, "Two");
  await choose(user, "Move down");
  expect(editor.getHTML()).toBe("<p>One</p><p>Three</p><p>Two</p>");
  await expectOneUndoAndFocus(editor, before);
});

test("a list and a table move as a whole, even from an item or a cell", async () => {
  const user = userEvent.setup();
  const before = `<p>One</p>${LIST}${TABLE}`;
  const { editor } = renderEditor({ defaultValue: before });

  caretIn(editor, "b");
  await choose(user, "Move up");
  expect(editor.getHTML()).toBe(`${LIST}<p>One</p>${TABLE}`);
  await expectOneUndoAndFocus(editor, before);

  caretIn(editor, "c1");
  await choose(user, "Move up");
  expect(editor.getHTML()).toBe(`<p>One</p>${TABLE}${LIST}`);
  await expectOneUndoAndFocus(editor, before);
});

test("Duplicate copies the whole block under it — the whole list from an item", async () => {
  const user = userEvent.setup();
  const before = `${LIST}<p>After</p>`;
  const { editor } = renderEditor({ defaultValue: before });
  caretIn(editor, "a");

  await choose(user, "Duplicate");
  expect(editor.getHTML()).toBe(`${LIST}${LIST}<p>After</p>`);
  // Каретка — в копии.
  expect(editor.state.selection.$from.index(0)).toBe(1);
  await expectOneUndoAndFocus(editor, before);
});

test("Delete removes the whole block and puts the caret into the block above", async () => {
  const user = userEvent.setup();
  const before = `<p>One</p>${TABLE}<p>Two</p>`;
  const { editor } = renderEditor({ defaultValue: before });
  caretIn(editor, "c1");

  await choose(user, "Delete");
  expect(editor.getHTML()).toBe("<p>One</p><p>Two</p>");
  expect(editor.state.selection.$from.parent.textContent).toBe("One");
  expect(editor.state.selection.$from.parentOffset).toBe(3);
  await expectOneUndoAndFocus(editor, before);
});

test("Delete of the first block puts the caret into the next one; the only block leaves an empty paragraph", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: `${FIGURE}<p>Two</p>` });
  selectNode(editor, 0);

  await choose(user, "Delete");
  expect(editor.getHTML()).toBe("<p>Two</p>");
  expect(editor.state.selection.$from.parent.textContent).toBe("Two");

  caretIn(editor, "Two");
  await choose(user, "Delete");
  expect(editor.getHTML()).toBe("<p></p>");
  expect(editor.state.selection).toBeInstanceOf(TextSelection);
});

test("Add inserts the chosen block under the current one and puts the caret into it", async () => {
  const user = userEvent.setup();
  const before = "<p>One</p><p>Two</p>";
  const { editor } = renderEditor({ defaultValue: before });
  caretIn(editor, "One");

  await choose(user, "Add", "Heading 2");
  expect(editor.getHTML()).toBe("<p>One</p><h2></h2><p>Two</p>");
  expect(editor.state.selection.$from.parent.type.name).toBe("heading");
  await expectOneUndoAndFocus(editor, before);
});

test.each([
  ["Paragraph", "paragraph"],
  ["Heading 1", "heading"],
  ["Heading 4", "heading"],
  ["Bulleted list", "bulletList"],
  ["Numbered list", "orderedList"],
  ["Checklist", "taskList"],
  ["Quote", "blockquote"],
  ["Code block", "codeBlock"],
  ["Divider", "horizontalRule"],
  ["Table", "table"],
] as const)("Add › %s puts a new %s under the block in one undo step", async (name, type) => {
  const user = userEvent.setup();
  const before = "<p>One</p><p>Two</p>";
  const { editor } = renderEditor({ defaultValue: before });
  caretIn(editor, "One");

  await choose(user, "Add", name);
  const { doc } = editor.state;
  expect(doc.childCount).toBe(3);
  expect(doc.child(0).textContent).toBe("One");
  expect(doc.child(1).type.name).toBe(type);
  expect(doc.child(2).textContent).toBe("Two");
  await expectOneUndoAndFocus(editor, before);
});

test("Add › Image opens the image popover for a new block under the current one", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: "<p>One</p><p>Two</p>" });
  caretIn(editor, "One");

  await choose(user, "Add", "Image");
  expect(editor.getHTML()).toBe("<p>One</p><p></p><p>Two</p>");
  expect(await screen.findByRole("textbox", { name: "Image address" })).toBeDefined();
});

test("Add puts a new block under the whole list, quote and table, and under an empty paragraph too", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: `${LIST}<p></p>` });

  caretIn(editor, "a");
  await choose(user, "Add", "Divider");
  expect(editor.getHTML()).toBe(`${LIST}<hr><p></p>`);

  act(() => {
    editor.view.focus();
    editor.commands.setTextSelection(editor.state.doc.content.size - 1);
  });
  await choose(user, "Add", "Quote");
  expect(editor.getHTML()).toBe(`${LIST}<hr><p></p><blockquote><p></p></blockquote>`);
});

test("Add under a selected image goes after the image", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: `<p>One</p>${FIGURE}` });
  selectNode(editor, 1);

  await choose(user, "Add", "Paragraph");
  expect(editor.getHTML()).toBe(`<p>One</p>${FIGURE}<p></p>`);
});

test("Format marks the current type and turns the whole block", async () => {
  const user = userEvent.setup();
  const before = `<p>One</p>${LIST}`;
  const { editor } = renderEditor({ defaultValue: before });
  caretIn(editor, "b");

  const format = await openSubmenu(user, await openMenu(user), "Format");
  const checked = within(format)
    .getAllByRole("menuitemradio")
    .filter((item) => item.getAttribute("aria-checked") === "true")
    .map((item) => item.textContent);
  expect(checked).toEqual(["Bulleted list"]);
  await user.click(within(format).getByRole("menuitemradio", { name: "Heading 3" }));

  // Весь список, а не только пункт под кареткой; каретка там же, где была.
  expect(editor.getHTML()).toBe("<p>One</p><h3>a</h3><h3>b</h3>");
  expect(editor.state.selection.$from.parent.textContent).toBe("b");
  await expectOneUndoAndFocus(editor, before);
});

test("Format of a paragraph into a list wraps it", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: "<p>One</p>" });
  caretIn(editor, "One");

  await choose(user, "Format", "Numbered list");
  expect(editor.getHTML()).toBe("<ol><li><p>One</p></li></ol>");
});

test("choosing the current type changes nothing and adds no undo step", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: "<h2>One</h2>" });
  caretIn(editor, "One");

  await choose(user, "Format", "Heading 2");
  expect(editor.getHTML()).toBe("<h2>One</h2>");
  expect(editor.can().undo()).toBe(false);
});

test.each([
  ["a table", TABLE, "c1"],
  ["an image", FIGURE, 1],
  ["a line", "<hr>", 1],
] as const)("Format is unavailable for %s", async (_, html, where) => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: `<p>One</p>${html}` });
  if (typeof where === "string") caretIn(editor, where);
  else selectNode(editor, where);

  const menu = await openMenu(user);
  const format = within(menu).getByRole("menuitem", { name: "Format" });
  expect(format.getAttribute("aria-disabled")).toBe("true");
});

// --- Клавиатура -------------------------------------------------------------

/** `Mod+/` из Документа; jsdom — не Apple, поэтому `Ctrl`. */
function pressOpen(editor: Editor) {
  const event = new KeyboardEvent("keydown", {
    key: "/",
    ctrlKey: true,
    bubbles: true,
    cancelable: true,
  });
  Object.defineProperty(event, "keyCode", { value: 191 });
  act(() => void editor.view.dom.dispatchEvent(event));
  return event.defaultPrevented;
}

test("Mod+/ opens the menu from the document and moves focus into it", async () => {
  const { editor } = renderEditor({ defaultValue: "<p>One</p>" });
  caretIn(editor, "One");

  expect(pressOpen(editor)).toBe(true);
  const menu = await screen.findByRole("menu", { name: HANDLE });
  await waitFor(() => expect(menu.contains(document.activeElement)).toBe(true));
});

test('on a Russian layout the slash key types ".": Mod+/ still opens the menu, not superscript', async () => {
  const { editor } = renderEditor({ defaultValue: "<p>One</p>" });
  caretIn(editor, "One");
  // ЙЦУКЕН: физическая клавиша «/» даёт «.», и по символу это был бы `Mod-.` —
  // верхний индекс. Меню ловит клавишу по месту (`code: "Slash"`).
  const event = new KeyboardEvent("keydown", {
    key: ".",
    code: "Slash",
    ctrlKey: true,
    bubbles: true,
    cancelable: true,
  });
  Object.defineProperty(event, "keyCode", { value: 191 });
  act(() => void editor.view.dom.dispatchEvent(event));

  expect(event.defaultPrevented).toBe(true);
  expect(await screen.findByRole("menu", { name: HANDLE })).toBeDefined();
  expect(editor.getHTML()).toBe("<p>One</p>");
});

test("Mod+/ without a single block under the selection goes on to the browser", () => {
  const { editor } = renderEditor({ defaultValue: "<p>One</p><p>Two</p>" });
  caretIn(editor, "One");
  act(() => void editor.commands.setTextSelection({ from: 2, to: 8 }));

  expect(pressOpen(editor)).toBe(false);
  expect(screen.queryByRole("menu")).toBeNull();
});

test("Escape closes the submenu, then the menu, and returns focus to the document", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: "<p>One</p>" });
  caretIn(editor, "One");

  // Подменю — с клавиатуры: `→` на пункте ставит фокус внутрь подменю.
  const menu = await openMenu(user);
  act(() => within(menu).getByRole("menuitem", { name: "Format" }).focus());
  await user.keyboard("{ArrowRight}");
  const format = await screen.findByRole("menu", { name: "Format" });
  await waitFor(() => expect(format.contains(document.activeElement)).toBe(true));

  await user.keyboard("{Escape}");
  await waitFor(() => expect(screen.getAllByRole("menu")).toHaveLength(1));
  expect(screen.getByRole("menu", { name: HANDLE })).toBeDefined();

  await user.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(textbox()));
  expect(editor.getHTML()).toBe("<p>One</p>");
});

/**
 * Escape в меню принадлежит меню, а не слою под ним (ADR-0041). Слой —
 * `ModalOverlay`, а не `Dialog`: меню react-aria внутри модального окна Radix
 * в jsdom не раскрывается (разбор — `tests/overlay-layers.test.tsx`). С
 * настоящим `Dialog` то же проверяет `tests-visual/rich-text-editor-block-handle.spec.ts`.
 */
test("Escape in the menu closes the menu, not the layer under it", async () => {
  const user = userEvent.setup();
  const onClose = vi.fn();
  const ref = createRef<RichTextEditorHandle>();
  render(
    <ModalOverlay onClose={onClose}>
      <RichTextEditor ref={ref} aria-label="Body" defaultValue="<p>One</p>" />
    </ModalOverlay>
  );
  caretIn(ref.current!.editor!, "One");

  await openMenu(user);
  await user.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  expect(onClose).not.toHaveBeenCalled();
});

test("the handle and its menu speak the provider's language", async () => {
  const user = userEvent.setup();
  const ref = createRef<RichTextEditorHandle>();
  render(
    <UiProvider messages={ru}>
      <RichTextEditor ref={ref} aria-label="Body" defaultValue="<p>One</p><p>Two</p>" />
    </UiProvider>
  );
  caretIn(ref.current!.editor!, "Two");

  // Ожидания — из русского каталога: гейт i18n держит кириллицу в каталоге.
  const t = ru.editor;
  await user.click(screen.getByRole("button", { name: t.blockActions }));
  const menu = await screen.findByRole("menu", { name: t.blockActions });
  expect(itemsOf(menu).map((item) => item.name)).toEqual([
    t.blockAdd,
    t.blockFormat,
    t.blockMoveUp,
    t.blockMoveDown,
    t.blockDuplicate,
    t.blockDelete,
  ]);
});
