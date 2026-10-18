// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import type { Editor } from "@tiptap/react";
import { createRef } from "react";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import {
  RichTextEditor,
  type RichTextEditorHandle,
  type RichTextEditorProps,
} from "../src/editor/index.js";
import { BlockSelection } from "../src/editor/core/blockSelection.js";
import { TOOLS } from "../src/editor/core/tools.js";
import { loadLazyBuiltins } from "./editor-lazy-builtins.js";

beforeAll(loadLazyBuiltins);

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/**
 * The Block handle over several Blocks (ADR-0077, OLDSUI-307): a text selection across Blocks keeps
 * the "⋮", and its menu acts on every Block the selection touches. This layer is in the core, so
 * it works in every Editor, with or without the `blockSelection` Tool.
 *
 * Through the public `RichTextEditor`: the handle and its items by roles and names, the result by
 * the output HTML, one undo step and the live region. The handle's position needs layout, which
 * jsdom does not have: it is checked in the browser.
 */
function renderEditor(props: Partial<RichTextEditorProps> = {}) {
  const ref = createRef<RichTextEditorHandle>();
  const view = render(<RichTextEditor ref={ref} aria-label="Body" tools={[...TOOLS]} {...props} />);
  const editor = ref.current?.editor;
  if (!editor) throw new Error("the editor was not created inside render()");
  return { ...view, ref, editor };
}

/** Focus in the Document and a text selection from the text `from` to the end of the text `to`. */
function selectAcross(editor: Editor, from: string, to: string) {
  let start = -1;
  let end = -1;
  editor.state.doc.descendants((node, pos) => {
    if (!node.isText) return;
    if (start < 0 && node.text === from) start = pos + 1;
    if (node.text === to) end = pos + node.nodeSize - 1;
  });
  if (start < 0 || end < 0) throw new Error(`no texts "${from}" and "${to}" in the document`);
  act(() => {
    editor.view.focus();
    editor.commands.setTextSelection({ from: start, to: end });
  });
}

const HANDLE = "Block actions";
const handle = () => screen.getByRole("button", { name: HANDLE });
const announced = () => document.querySelector('[role="status"].sr-only')?.textContent ?? "";

async function openMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(handle());
  return screen.findByRole("menu", { name: HANDLE });
}

const menuItems = (menu: HTMLElement) =>
  Array.from(menu.querySelectorAll<HTMLElement>('[role^="menuitem"]'));

const names = (menu: HTMLElement) =>
  menuItems(menu).map((item) =>
    (item.textContent ?? "").replace(item.querySelector("kbd")?.textContent ?? "", "")
  );

/** Choose item `name` of the handle's menu (a submenu is `path`). */
async function choose(user: ReturnType<typeof userEvent.setup>, ...path: string[]) {
  let menu = await openMenu(user);
  for (const step of path.slice(0, -1)) {
    await user.click(within(menu).getByRole("menuitem", { name: step }));
    menu = await screen.findByRole("menu", { name: step });
  }
  const name = path.at(-1)!;
  const item = menuItems(menu).find((candidate) => candidate.textContent?.startsWith(name));
  if (!item) throw new Error(`no item "${name}" in the menu`);
  await user.click(item);
}

const undo = (editor: Editor) => act(() => void editor.commands.undo());

const THREE = "<p>One</p><p>Two</p><p>Three</p>";
const TABLE =
  "<table><tbody><tr><th><p>h1</p></th></tr><tr><td><p>c1</p></td></tr></tbody></table>";

test("a selection across Blocks keeps the handle, and its menu is for a group", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: THREE });
  selectAcross(editor, "One", "Two");

  const menu = await openMenu(user);

  // No "Add" and no tool actions: those are written for one Block. "Format" and "Wrap in" take the group.
  expect(names(menu)).toEqual([
    "Select",
    "Format",
    "Wrap in",
    "Move up",
    "Move down",
    "Duplicate",
    "Delete",
  ]);
  // The keys do the same as the items now, so they are signed.
  const keyOf = (name: string) =>
    menuItems(menu)
      .find((item) => item.textContent?.startsWith(name))
      ?.querySelector("kbd")?.textContent;
  expect(keyOf("Duplicate")).toBe("Ctrl+Shift+D");
  expect(keyOf("Move down")).toBe("Alt+Shift+↓");
});

test("the layer is in the core: the basic preset gets the group menu, with only the containers it has", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ preset: "basic", tools: undefined, defaultValue: THREE });
  selectAcross(editor, "One", "Two");

  const menu = await openMenu(user);

  // No "Select": the `blockSelection` Tool is not in `basic`. A quote is, so it is the only container to wrap in.
  expect(names(menu)).toEqual(["Format", "Wrap in", "Move up", "Move down", "Duplicate", "Delete"]);
  await user.click(within(menu).getByRole("menuitem", { name: "Wrap in" }));
  const submenu = await screen.findByRole("menu", { name: "Wrap in" });
  expect(names(submenu)).toEqual(["Quote"]);
});

test("Delete removes every touched Block as one edit and announces the count", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: THREE });
  selectAcross(editor, "One", "Two");

  await choose(user, "Delete");

  expect(editor.getHTML()).toBe("<p>Three</p>");
  expect(announced()).toBe("Blocks deleted: 2");
  undo(editor);
  expect(editor.getHTML()).toBe(THREE);
});

test("Duplicate copies the group, Move down swaps it with the neighbour", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: THREE });
  selectAcross(editor, "One", "Two");

  await choose(user, "Move down");
  expect(editor.getHTML()).toBe("<p>Three</p><p>One</p><p>Two</p>");
  expect(announced()).toBe("Blocks moved: 2");

  await choose(user, "Duplicate");
  expect(editor.getHTML()).toBe("<p>Three</p><p>One</p><p>Two</p><p>One</p><p>Two</p>");
  expect(announced()).toBe("Blocks duplicated: 2");
});

test("a list touched at one item is one Block for the handle, and the group takes it whole", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({
    defaultValue: "<p>One</p><ul><li><p>a</p><p>a2</p></li><li><p>b</p></li></ul><p>Tail</p>",
  });
  selectAcross(editor, "One", "a");

  await choose(user, "Delete");

  expect(editor.getHTML()).toBe("<p>Tail</p>");
});

// --- Format ---------------------------------------------------------------------

test("Format turns every text Block of the group and leaves the table alone", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: `<p>One</p>${TABLE}<p>Two</p><p>Three</p>` });
  selectAcross(editor, "One", "Three");

  await choose(user, "Format", "Heading 2");

  expect(editor.getHTML()).toBe(`<h2>One</h2>${TABLE}<h2>Two</h2><h2>Three</h2>`);
  expect(announced()).toBe("Blocks changed: 4");
  undo(editor);
  expect(editor.getHTML()).toBe(`<p>One</p>${TABLE}<p>Two</p><p>Three</p>`);
});

test("Format into a list makes one list of N items, and a run ends at a Block that stays", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: `<p>One</p><p>Two</p>${TABLE}<p>Three</p>` });
  selectAcross(editor, "One", "Three");

  await choose(user, "Format", "Bulleted list");

  expect(editor.getHTML()).toBe(
    `<ul><li><p>One</p></li><li><p>Two</p></li></ul>${TABLE}<ul><li><p>Three</p></li></ul>`
  );
});

test("Format into Text breaks a list into paragraphs", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({
    defaultValue: "<ul><li><p>a</p></li><li><p>b</p></li></ul><p>c</p>",
  });
  selectAcross(editor, "a", "c");

  await choose(user, "Format", "Text");

  expect(editor.getHTML()).toBe("<p>a</p><p>b</p><p>c</p>");
});

test("Format into a quote gives every Block its own quote", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: THREE });
  selectAcross(editor, "One", "Two");

  await choose(user, "Format", "Quote");

  expect(editor.getHTML()).toBe(
    "<blockquote><p>One</p></blockquote><blockquote><p>Two</p></blockquote><p>Three</p>"
  );
});

test("Format is unavailable when nothing in the group can change", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: `${TABLE}<hr>` });
  selectAcross(editor, "h1", "c1");
  act(
    () => void editor.commands.setTextSelection({ from: 2, to: editor.state.doc.content.size - 2 })
  );

  const menu = await openMenu(user);

  expect(within(menu).getByRole("menuitem", { name: "Format" }).getAttribute("aria-disabled")).toBe(
    "true"
  );
});

// --- Wrap in ----------------------------------------------------------------------

test("Wrap in puts the group into ONE Wrapper, in one edit", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: THREE });
  selectAcross(editor, "One", "Two");

  await choose(user, "Wrap in", "Wrapper");

  expect(editor.getHTML()).toBe('<div data-block="wrapper"><p>One</p><p>Two</p></div><p>Three</p>');
  expect(announced()).toBe("Blocks wrapped: 2");
  undo(editor);
  expect(editor.getHTML()).toBe(THREE);
});

test("Wrap in a quote gives one quote with the Blocks inside", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: THREE });
  selectAcross(editor, "Two", "Three");

  await choose(user, "Wrap in", "Quote");

  expect(editor.getHTML()).toBe("<p>One</p><blockquote><p>Two</p><p>Three</p></blockquote>");
});

test("Wrap in a collapsible Block puts the Blocks into its content and the caret into the empty title", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: THREE });
  selectAcross(editor, "One", "Two");

  await choose(user, "Wrap in", "Collapsible block");

  expect(editor.getHTML()).toBe(
    '<details><summary></summary><div data-type="detailsContent"><p>One</p><p>Two</p></div></details><p>Three</p>'
  );
  const { $from } = editor.state.selection;
  expect($from.parent.type.name).toBe("detailsSummary");
});

test("where the Schema does not allow the container, its item is unavailable", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({
    defaultValue: '<div data-block="wrapper"><p>One</p><p>Two</p></div>',
  });
  selectAcross(editor, "One", "Two");

  const menu = await openMenu(user);
  await user.click(within(menu).getByRole("menuitem", { name: "Wrap in" }));
  const submenu = await screen.findByRole("menu", { name: "Wrap in" });

  const disabled = (name: string) =>
    within(submenu).getByRole("menuitem", { name }).getAttribute("aria-disabled") === "true";
  // A Wrapper does not hold a Wrapper; a quote and a collapsible Block do.
  expect(disabled("Wrapper")).toBe(true);
  expect(disabled("Quote")).toBe(false);
  expect(disabled("Collapsible block")).toBe(false);
});

test("Blocks that hold a container do not go into a quote, a Wrapper or a collapsible Block", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({
    defaultValue: '<p>One</p><div data-block="wrapper"><p>Two</p></div>',
  });
  selectAcross(editor, "One", "Two");

  const menu = await openMenu(user);

  // A Wrapper is not a Block of the `block` group: neither a quote nor a Wrapper can hold it. The
  // collapsible Block cannot either, so the whole item is unavailable.
  expect(
    within(menu).getByRole("menuitem", { name: "Wrap in" }).getAttribute("aria-disabled")
  ).toBe("true");
});

// --- The way into Block selection --------------------------------------------------------

test("Select in the menu selects the Blocks under the selection (the way in on a touch screen)", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: THREE });
  selectAcross(editor, "One", "Two");

  await choose(user, "Select");

  expect(editor.state.selection).toBeInstanceOf(BlockSelection);
  expect((editor.state.selection as BlockSelection).count).toBe(2);
  expect(announced()).toBe("Blocks selected: 2");
});

// --- One Block selected whole ----------------------------------------------------------

test("a selected Block has the single-Block menu plus Wrap in, and no Select", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: THREE });
  act(() => {
    editor.view.focus();
    editor.commands.setTextSelection(3);
    editor.commands.selectBlocks();
  });
  expect(editor.state.selection).toBeInstanceOf(BlockSelection);

  const menu = await openMenu(user);

  expect(names(menu)).toEqual([
    "Add",
    "Format",
    "Wrap in",
    "Move up",
    "Move down",
    "Duplicate",
    "Delete",
  ]);
  await waitFor(() => expect(editor.state.selection).toBeInstanceOf(BlockSelection));
});

// --- Block selection through the handle ----------------------------------------------------------

/** A `keydown` on the Document; `keyCode` is set for ProseMirror. */
function press(editor: Editor, key: string, init: KeyboardEventInit & { keyCode?: number } = {}) {
  const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init });
  Object.defineProperty(event, "keyCode", {
    value: init.keyCode ?? key.toUpperCase().charCodeAt(0),
  });
  act(() => void editor.view.dom.dispatchEvent(event));
  return event;
}

test("Mod+/ opens the menu over the selected Blocks, and Wrap in selects the new container", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: THREE });
  selectAcross(editor, "One", "One");
  press(editor, "Escape", { keyCode: 27 });
  press(editor, "ArrowDown", { shiftKey: true, keyCode: 40 });
  expect((editor.state.selection as BlockSelection).count).toBe(2);

  press(editor, "/", { ctrlKey: true, code: "Slash", keyCode: 191 });
  const menu = await screen.findByRole("menu", { name: HANDLE });
  await user.click(within(menu).getByRole("menuitem", { name: "Wrap in" }));
  const submenu = await screen.findByRole("menu", { name: "Wrap in" });
  await user.click(within(submenu).getByRole("menuitem", { name: "Wrapper" }));

  expect(editor.getHTML()).toBe('<div data-block="wrapper"><p>One</p><p>Two</p></div><p>Three</p>');
  // The group became one Block, and it stays selected.
  const block = editor.state.selection as BlockSelection;
  expect(block).toBeInstanceOf(BlockSelection);
  expect(block.count).toBe(1);
});

test("Move up moves the selected group above its neighbour and keeps it selected", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: THREE });
  selectAcross(editor, "Two", "Two");
  press(editor, "Escape", { keyCode: 27 });
  press(editor, "ArrowDown", { shiftKey: true, keyCode: 40 });

  await choose(user, "Move up");

  expect(editor.getHTML()).toBe("<p>Two</p><p>Three</p><p>One</p>");
  const block = editor.state.selection as BlockSelection;
  expect(block.count).toBe(2);
  expect(editor.state.doc.textBetween(block.from, block.to, "|")).toBe("Two|Three");
});

test("Format over a selected list item turns that item only: the list splits around it", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({
    defaultValue: "<ul><li><p>a</p></li><li><p>b</p></li><li><p>c</p></li></ul>",
  });
  selectAcross(editor, "b", "b");
  press(editor, "Escape", { keyCode: 27 });

  await choose(user, "Format", "Text");

  expect(editor.getHTML()).toBe("<ul><li><p>a</p></li></ul><p>b</p><ul><li><p>c</p></li></ul>");
});

test("Delete over a whole list's items removes the list, not an empty item", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({
    defaultValue: "<p>Before</p><ul><li><p>a</p></li><li><p>b</p></li></ul>",
  });
  selectAcross(editor, "a", "a");
  press(editor, "Escape", { keyCode: 27 });
  press(editor, "ArrowDown", { shiftKey: true, keyCode: 40 });

  await choose(user, "Delete");

  expect(editor.getHTML()).toBe("<p>Before</p>");
});
