// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import type { Editor } from "@tiptap/react";
import { createRef } from "react";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { Dialog } from "../src/components/overlays/Dialog.js";
import { TagIcon } from "../src/icons.js";
import {
  RichTextEditor,
  type CustomTool,
  type RichTextEditorHandle,
  type RichTextEditorProps,
} from "../src/editor/index.js";
import { resetDevWarnings } from "../src/lib/dev-warn.js";
import { TOOLS } from "../src/editor/core/tools.js";
import { testAskTool } from "./editor-test-tools.js";
import { loadLazyBuiltins } from "./editor-lazy-builtins.js";

// Lazy `codeBlock` and `table` (OLDSUI-111): `full` is ready in `render` after the chunks load.
beforeAll(loadLazyBuiltins);

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  resetDevWarnings();
});

/**
 * Popover of an insert item and a Block action (story 39, ADR-0058, section 5.6).
 *
 * Through the public `RichTextEditor`: a popover opened from '/', '+', 'Add ›'
 * and 'Format ›' of the Block handle, from the Block handle menu or by a shortcut, has the same kit frame as a
 * button: the name is the item's label, plus Escape, and focus and selection return to the Document.
 * The position at the caret and at the Block is measured by the browser (`tests-visual`); jsdom
 * does not know layout.
 */
function renderEditor(props: Partial<RichTextEditorProps> = {}) {
  const ref = createRef<RichTextEditorHandle>();
  const view = render(
    <RichTextEditor ref={ref} aria-label="Body" tools={[...TOOLS, testAskTool]} {...props} />
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

function type(editor: Editor, text: string) {
  act(() => void editor.commands.insertContent(text));
}

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

const CTRL_ALT = { ctrlKey: true, altKey: true };
const HANDLE = "Block actions";

type User = ReturnType<typeof userEvent.setup>;

/** A menu item by name, without its shortcut label. */
function itemNamed(menu: HTMLElement, name: string) {
  const found = Array.from(menu.querySelectorAll<HTMLElement>('[role^="menuitem"]')).find(
    (item) =>
      (item.textContent ?? "").replace(item.querySelector("kbd")?.textContent ?? "", "") === name
  );
  if (!found) throw new Error(`no item "${name}" in the menu`);
  return found;
}

/** Select an item in the Block handle menu; `path` is the submenu path. */
async function choose(user: User, ...path: string[]) {
  await user.click(screen.getByRole("button", { name: HANDLE }));
  let menu = await screen.findByRole("menu", { name: HANDLE });
  for (const step of path.slice(0, -1)) {
    await user.click(within(menu).getByRole("menuitem", { name: step }));
    menu = await screen.findByRole("menu", { name: step });
  }
  await user.click(itemNamed(menu, path.at(-1)!));
}

/** The item's popover is open, the menus are closed, and opening it does not touch the Document. */
async function expectPopover(name: string) {
  const popover = await screen.findByRole("dialog", { name });
  expect(screen.queryByRole("menu")).toBeNull();
  expect(screen.queryByRole("listbox")).toBeNull();
  return popover;
}

// ── Slash menu ───────────────────────────────────────────────────────────

test("an own item with a popover in / removes the typed command and opens the popover at its place", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: "<p>One</p>" });
  caretIn(editor, "One");
  type(editor, " /ask");
  press(editor, "Enter");

  const popover = await expectPopover("Ask");
  // The typed '/command' is removed, as for a regular item; the kit does not prepare a Block.
  expect(editor.getHTML()).toBe("<p>One </p>");
  expect(editor.state.selection.from).toBe(5);

  await user.click(within(popover).getByRole("button", { name: "Choose Alpha" }));
  expect(screen.queryByRole("dialog", { name: "Ask" })).toBeNull();
  expect(editor.getHTML()).toBe("<p>One Alpha</p>");
  await waitFor(() => expect(document.activeElement).toBe(editor.view.dom));
});

test("the Insert menu button opens the popover; Escape returns focus and the selection", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: "<p>One</p>" });
  caretIn(editor, "One");

  await user.click(screen.getByRole("button", { name: "Insert block" }));
  await user.click(itemNamed(await screen.findByRole("menu", { name: "Insert block" }), "Ask"));
  await expectPopover("Ask");
  await user.keyboard("{Escape}");

  expect(screen.queryByRole("dialog", { name: "Ask" })).toBeNull();
  await waitFor(() => expect(document.activeElement).toBe(editor.view.dom));
  expect(editor.state.selection.from).toBe(4);
  expect(editor.getHTML()).toBe("<p>One</p>");
});

test("Add and Format of the block handle open the popover of the item", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: "<p>One</p><p>Two</p>" });
  caretIn(editor, "One");

  await choose(user, "Add", "Ask");
  await expectPopover("Ask");
  await user.keyboard("{Escape}");
  await waitFor(() => expect(document.activeElement).toBe(editor.view.dom));

  await choose(user, "Format", "Reshape");
  const popover = await expectPopover("Reshape");
  expect(editor.getHTML()).toBe("<p>One</p><p>Two</p>");
  await user.click(within(popover).getByRole("button", { name: "Choose Alpha" }));
  expect(editor.getHTML()).toBe("<p>OneAlpha</p><p>Two</p>");
});

test("the shortcut of an own item opens its popover at the caret", async () => {
  const { editor } = renderEditor({ defaultValue: "<p>One</p>" });
  caretIn(editor, "One");

  expect(press(editor, "q", CTRL_ALT)).toBe(true);
  await expectPopover("Ask");
  expect(editor.getHTML()).toBe("<p>One</p>");
});

// ── Block action ────────────────────────────────────────────────────

test("an own action with a popover opens it for the block of the handle, with its position", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: "<p>One</p><p>Two</p>" });
  caretIn(editor, "Two");

  await choose(user, "Inspect");
  const popover = await expectPopover("Inspect");
  // `pos` is the position of the Block in the Block handle: the second paragraph follows the first (5 positions).
  expect(within(popover).getByText("Block at 5")).toBeDefined();

  await user.click(within(popover).getByRole("button", { name: "Prefix Beta" }));
  expect(screen.queryByRole("dialog", { name: "Inspect" })).toBeNull();
  expect(editor.getHTML()).toBe("<p>One</p><p>BetaTwo</p>");
  await waitFor(() => expect(document.activeElement).toBe(editor.view.dom));
});

test("the shortcut of an own action opens the popover for the block under the caret", async () => {
  const { editor } = renderEditor({ defaultValue: "<p>One</p><p>Two</p>" });
  caretIn(editor, "One");

  expect(press(editor, "i", CTRL_ALT)).toBe(true);
  const popover = await expectPopover("Inspect");
  expect(within(popover).getByText("Block at 0")).toBeDefined();
});

test("the shortcuts open no popover in a read-only field", async () => {
  const { editor } = renderEditor({ defaultValue: "<p>One</p>", readOnly: true });
  act(() => editor.view.focus());

  press(editor, "q", CTRL_ALT);
  press(editor, "i", CTRL_ALT);
  await new Promise((resolve) => setTimeout(resolve, 20));

  expect(screen.queryByRole("dialog")).toBeNull();
});

test("Escape in the popover of an item inside a Dialog closes the popover, not the window", async () => {
  const user = userEvent.setup();
  const onClose = vi.fn();
  const ref = createRef<RichTextEditorHandle>();
  render(
    <Dialog open onClose={onClose} title="Edit article">
      <RichTextEditor
        ref={ref}
        aria-label="Body"
        defaultValue="<p>One</p>"
        tools={[...TOOLS, testAskTool]}
      />
    </Dialog>
  );
  const editor = ref.current!.editor!;
  caretIn(editor, "One");

  press(editor, "i", CTRL_ALT);
  await screen.findByRole("dialog", { name: "Inspect" });
  await user.keyboard("{Escape}");

  expect(screen.queryByRole("dialog", { name: "Inspect" })).toBeNull();
  expect(screen.getByRole("dialog", { name: "Edit article" })).toBeDefined();
  expect(onClose).not.toHaveBeenCalled();
});

// ── Definition check ────────────────────────────────────────────────────────

function expectFieldError(tool: CustomTool, reason: RegExp) {
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  const ref = createRef<RichTextEditorHandle>();
  render(
    <RichTextEditor ref={ref} aria-label="Body" defaultValue="<p>x</p>" tools={[...TOOLS, tool]} />
  );
  expect(screen.getByRole("alert").textContent).toBe(
    "The editor couldn't start. The document is unchanged."
  );
  expect(ref.current?.editor).toBeNull();
  expect(error).toHaveBeenCalledWith(expect.stringMatching(reason));
  // A developer error is logged once per text: the next check starts from a clean slate.
  cleanup();
  vi.restoreAllMocks();
  resetDevWarnings();
}

test("an item or an action with both run and popover, or with neither, is a field error", () => {
  const popover = () => null;
  const item = { section: "insert", label: "Item", icon: TagIcon } as const;
  const action = { label: "Act", icon: TagIcon, blocks: ["paragraph"] } as const;
  const both = (entry: object) => ({ ...entry, run: () => {}, popover });
  const fail = (field: string) =>
    new RegExp(`custom tool "test_bad": ${field}\\[0\\] needs exactly one of run and popover`);

  expectFieldError(
    { name: "test_bad", engine: [], insertItems: [both(item)] as never },
    fail("insertItems")
  );
  expectFieldError(
    { name: "test_bad", engine: [], insertItems: [item] as never },
    fail("insertItems")
  );
  expectFieldError(
    { name: "test_bad", engine: [], blockActions: [both(action)] as never },
    fail("blockActions")
  );
  expectFieldError(
    { name: "test_bad", engine: [], blockActions: [action] as never },
    fail("blockActions")
  );
});
