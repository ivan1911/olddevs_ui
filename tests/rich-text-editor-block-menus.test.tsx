// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { createRef } from "react";
import { afterEach, beforeAll, expect, test } from "vitest";
import {
  RichTextEditor,
  type RichTextEditorHandle,
  type RichTextEditorProps,
} from "../src/editor/index.js";
import { loadLazyBuiltins } from "./editor-lazy-builtins.js";

beforeAll(loadLazyBuiltins);
afterEach(cleanup);

/**
 * The contents of the Toolbar and the Bubble menu (OLDSUI-154): "¶" holds text and headings
 * only, with the icon of the line under the caret; "Quote" is an item of the "…" menu;
 * "Lists ▾" is in the Bubble menu; "Highlight" is on the Toolbar, "Color" is in the Bubble menu.
 */
function renderEditor(props: Partial<RichTextEditorProps> = {}) {
  const ref = createRef<RichTextEditorHandle>();
  render(
    <RichTextEditor
      ref={ref}
      aria-label="Body"
      defaultValue="<h2>Title</h2><p>alpha beta</p><ul><li><p>item</p></li></ul><blockquote><p>quoted</p></blockquote>"
      {...props}
    />
  );
  const editor = ref.current?.editor;
  if (!editor) throw new Error("the editor was not created inside render()");
  return { editor };
}

type Editor = ReturnType<typeof renderEditor>["editor"];

/** Caret or selection in the text `text`, with focus in the Document. */
function select(editor: Editor, text: string, whole = false) {
  let from = -1;
  editor.state.doc.descendants((node, pos) => {
    if (from < 0 && node.isText && node.text === text) from = pos;
  });
  act(() => {
    editor.view.focus();
    editor.commands.setTextSelection(whole ? { from, to: from + text.length } : from + 1);
  });
}

const toolbar = () => screen.getByRole("toolbar", { name: "Formatting" });
const bubble = () => screen.findByRole("toolbar", { name: "Selection formatting" });
const blockTypeButton = (host: HTMLElement) =>
  within(host).getByRole("button", { name: /^Block type/ });
/** Item names of any role (`menuitem`, `menuitemradio`, `menuitemcheckbox`) without the shortcut label. */
const itemNames = (menu: HTMLElement) =>
  Array.from(menu.querySelectorAll<HTMLElement>('[role^="menuitem"]')).map((item) =>
    (item.querySelector("kbd")
      ? item.textContent!.replace(item.querySelector("kbd")!.textContent!, "")
      : item.textContent!
    ).trim()
  );

test("«¶» offers text and headings only — lists and quote left it", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ selectionMenu: false });
  select(editor, "alpha beta");
  await user.click(blockTypeButton(toolbar()));
  const menu = await screen.findByRole("menu");
  expect(itemNames(menu)).toEqual(["Text", "Heading 1", "Heading 2", "Heading 3", "Heading 4"]);
});

test("«¶» in the selection menu offers the same; Lists ▾ stands right after it", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor();
  select(editor, "alpha beta", true);
  const host = await bubble();
  const names = within(host)
    .getAllByRole("button")
    .map((button) => button.getAttribute("aria-label"));
  expect(names.slice(0, 2)).toEqual(["Block type: Text", "Lists"]);
  await user.click(blockTypeButton(host));
  const menu = await screen.findByRole("menu");
  expect(itemNames(menu)).toEqual(["Text", "Heading 1", "Heading 2", "Heading 3", "Heading 4"]);
});

test("Lists ▾ in the selection menu sets and removes a list", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: "<p>alpha beta</p>" });
  select(editor, "alpha beta", true);
  const host = await bubble();
  await user.click(within(host).getByRole("button", { name: /^List/ }));
  await user.click(await screen.findByRole("menuitemradio", { name: /Numbered list/ }));
  expect(editor.getHTML()).toBe("<ol><li><p>alpha beta</p></li></ol>");
});

test("the mark and the name of «¶» follow the line under the caret, inside a list and a quote too", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ selectionMenu: false });
  select(editor, "item");
  expect(blockTypeButton(toolbar()).getAttribute("aria-label")).toBe("Block type: Text");
  select(editor, "quoted");
  expect(blockTypeButton(toolbar()).getAttribute("aria-label")).toBe("Block type: Text");
  await user.click(blockTypeButton(toolbar()));
  const checked = within(await screen.findByRole("menu"))
    .getAllByRole("menuitemradio")
    .filter((item) => item.getAttribute("aria-checked") === "true");
  expect(checked.map((item) => item.textContent?.replace(/(Ctrl|⌘).*$/, ""))).toEqual(["Text"]);
});

test("the icon of «¶» is the heading level on a heading and the pilcrow on text", () => {
  const { editor } = renderEditor({ selectionMenu: false });
  select(editor, "Title");
  expect(blockTypeButton(toolbar()).querySelector("svg.lucide-heading-2")).not.toBeNull();
  select(editor, "alpha beta");
  expect(blockTypeButton(toolbar()).querySelector("svg.lucide-pilcrow")).not.toBeNull();
  select(editor, "item");
  expect(blockTypeButton(toolbar()).querySelector("svg.lucide-pilcrow")).not.toBeNull();
});

test("the block handle and the slash menu still offer lists and the quote", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ selectionMenu: false, defaultValue: "<p>alpha beta</p>" });
  select(editor, "alpha beta");
  await user.click(await screen.findByRole("button", { name: "Block actions" }));
  const menu = await screen.findByRole("menu", { name: "Block actions" });
  await user.click(within(menu).getByRole("menuitem", { name: "Format" }));
  const format = await screen.findByRole("menu", { name: "Format" });
  const names = itemNames(format);
  expect(names).toEqual(expect.arrayContaining(["Quote", "Bulleted list", "Checklist"]));
});

test("Quote is a check item of «…» next to Code block, one step to undo", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ selectionMenu: false, defaultValue: "<p>alpha beta</p>" });
  select(editor, "alpha beta");
  await user.click(within(toolbar()).getByRole("button", { name: "More formatting" }));
  const menu = await screen.findByRole("menu", { name: "More formatting" });
  const names = itemNames(menu);
  expect(names.slice(names.indexOf("Code block"), names.indexOf("Code block") + 2)).toEqual([
    "Code block",
    "Quote",
  ]);
  const quote = within(menu).getByRole("menuitemcheckbox", { name: /^Quote/ });
  expect(quote.getAttribute("aria-checked")).toBe("false");
  expect(quote.textContent).toMatch(/Ctrl\+Shift\+B/);
  await user.click(quote);
  expect(editor.getHTML()).toBe("<blockquote><p>alpha beta</p></blockquote>");
  await waitFor(() => expect(editor.isFocused).toBe(true));

  await user.click(within(toolbar()).getByRole("button", { name: "More formatting" }));
  const again = await screen.findByRole("menu", { name: "More formatting" });
  expect(
    within(again)
      .getByRole("menuitemcheckbox", { name: /^Quote/ })
      .getAttribute("aria-checked")
  ).toBe("true");
  await user.click(within(again).getByRole("menuitemcheckbox", { name: /^Quote/ }));
  expect(editor.getHTML()).toBe("<p>alpha beta</p>");
});

test("Highlight stays on the toolbar and Color moves to the selection menu", async () => {
  const { editor } = renderEditor();
  expect(within(toolbar()).getByRole("button", { name: /^Highlight:/ })).toBeDefined();
  expect(within(toolbar()).queryByRole("button", { name: /^Color:/ })).toBeNull();
  select(editor, "alpha beta", true);
  const host = await bubble();
  expect(within(host).getByRole("button", { name: /^Color:/ })).toBeDefined();
  expect(within(host).queryByRole("button", { name: /^Highlight:/ })).toBeNull();
});

test("without the color tool the selection menu keeps Highlight", async () => {
  const { editor } = renderEditor({
    tools: ["bold", "highlight", "history"],
    defaultValue: "<p>alpha beta</p>",
  });
  select(editor, "alpha beta", true);
  const host = await bubble();
  expect(within(host).getByRole("button", { name: /^Highlight:/ })).toBeDefined();
});
