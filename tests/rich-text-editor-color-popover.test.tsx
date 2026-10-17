// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { createRef } from "react";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { ModalOverlay } from "../src/components/overlays/ModalOverlay.js";
import {
  RichTextEditor,
  type RichTextEditorHandle,
  type RichTextEditorProps,
} from "../src/editor/index.js";
import { loadLazyBuiltins } from "./editor-lazy-builtins.js";

beforeAll(loadLazyBuiltins);
afterEach(cleanup);

/**
 * The colour popovers (OLDSUI-153): the "Color" button with the text colour and highlight
 * colour grids, and the "Highlight" button with the row of markers and "Remove highlight".
 * The model is Tiptap's Notion-like template: a colour is chosen by eye, from the dots,
 * with one click.
 *
 * The buttons are split with no duplicates (OLDSUI-154): "Highlight" is on the Toolbar,
 * "Color" is in the Bubble menu. That is why the Bubble menu is on here: "Color" exists
 * only there.
 */
function renderEditor(props: Partial<RichTextEditorProps> = {}) {
  const ref = createRef<RichTextEditorHandle>();
  render(
    <RichTextEditor ref={ref} aria-label="Body" defaultValue="<p>alpha beta</p>" {...props} />
  );
  const editor = ref.current?.editor;
  if (!editor) throw new Error("the editor was not created inside render()");
  return { editor };
}

/** Selects "alpha" — the first word of the paragraph. */
function selectFirstWord(editor: ReturnType<typeof renderEditor>["editor"]) {
  act(() => {
    editor.view.focus();
    editor.commands.setTextSelection({ from: 1, to: 6 });
  });
}

const toolbar = () => screen.getByRole("toolbar", { name: "Formatting" });
/** The Bubble menu: it pops up above a non-empty selection while the Document has focus. */
const bubble = () => screen.findByRole("toolbar", { name: "Selection formatting" });
/** "Color" — only in the Bubble menu (OLDSUI-154). */
const colorButton = async () => within(await bubble()).getByRole("button", { name: /^Color:/ });
/** "Highlight" — only on the Toolbar (OLDSUI-154). */
const highlightButton = () => within(toolbar()).getByRole("button", { name: /^Highlight:/ });
/** The grid's dots by name; "Custom color…" is an option too, but without a dot. */
const radios = (menu: HTMLElement) =>
  within(menu)
    .getAllByRole("menuitemradio")
    .map((item) => item.getAttribute("aria-label"))
    .filter((name) => name !== null);

test("the Color button opens two grids: text colour and highlight colour", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor();
  selectFirstWord(editor);
  expect((await colorButton()).getAttribute("aria-haspopup")).toBe("menu");
  await user.click(await colorButton());
  const menu = await screen.findByRole("menu", { name: "Color" });
  const text = within(menu).getByRole("group", { name: "Text color" });
  const highlight = within(menu).getByRole("group", { name: "Highlight color" });
  // Removal is the icon in the last cell, as in "Highlight", not a white dot first (OLDSUI-160).
  expect(radios(text)).toEqual(["Accent", "Green", "Amber", "Red", "Lime", "Gray"]);
  expect(within(text).getByRole("menuitem", { name: "Remove color" })).toBeDefined();
  expect(within(highlight).getByRole("menuitem", { name: "Remove highlight" })).toBeDefined();
  expect(radios(highlight)).toEqual([
    "Gray",
    "Brown",
    "Orange",
    "Yellow",
    "Green",
    "Blue",
    "Purple",
    "Pink",
    "Red",
  ]);
  // "Custom color…" — each section has its own.
  expect(within(text).getByRole("menuitemradio", { name: "Custom color…" })).toBeDefined();
  expect(within(highlight).getByRole("menuitemradio", { name: "Custom color…" })).toBeDefined();
});

test("picking a text colour applies it, closes the popover and returns focus to the text", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor();
  selectFirstWord(editor);
  await user.click(await colorButton());
  const menu = await screen.findByRole("menu", { name: "Color" });
  const text = within(menu).getByRole("group", { name: "Text color" });
  await user.click(within(text).getByRole("menuitemradio", { name: "Red" }));
  expect(editor.getHTML()).toBe('<p><span data-color="danger">alpha</span> beta</p>');
  expect(screen.queryByRole("menu", { name: "Color" })).toBeNull();
  await waitFor(() => expect(editor.isFocused).toBe(true));
  // One edit — one undo step.
  act(() => void editor.commands.undo());
  expect(editor.getHTML()).toBe("<p>alpha beta</p>");
});

test("the current colours are checked; Remove color and Remove highlight take them off", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({
    defaultValue:
      '<p><mark data-color="blue"><span data-color="success">alpha</span></mark> beta</p>',
  });
  selectFirstWord(editor);
  await user.click(await colorButton());
  let menu = await screen.findByRole("menu", { name: "Color" });
  const checked = within(menu)
    .getAllByRole("menuitemradio")
    .filter((item) => item.getAttribute("aria-checked") === "true")
    .map((item) => item.getAttribute("aria-label"));
  expect(checked).toEqual(["Green", "Blue"]);
  await user.click(within(menu).getByRole("menuitem", { name: "Remove highlight" }));
  await user.click(await colorButton());
  menu = await screen.findByRole("menu", { name: "Color" });
  await user.click(within(menu).getByRole("menuitem", { name: "Remove color" }));
  expect(editor.getHTML()).toBe("<p>alpha beta</p>");
});

test("the arrows walk the grid: → next, ↓ the same column a row lower, Enter applies", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor();
  selectFirstWord(editor);
  await user.click(await colorButton());
  const menu = await screen.findByRole("menu", { name: "Color" });
  // No colour — nothing is checked, and focus is on the first dot, not on "Custom color…".
  expect(
    within(menu)
      .getAllByRole("menuitemradio")
      .filter((item) => item.getAttribute("aria-checked") === "true")
  ).toHaveLength(0);
  await waitFor(() =>
    expect(document.activeElement).toBe(within(menu).getByRole("menuitemradio", { name: "Accent" }))
  );
  await user.keyboard("{ArrowRight}");
  expect(document.activeElement?.getAttribute("aria-label")).toBe("Green");
  await user.keyboard("{ArrowLeft}");
  // One row lower, the same column: Accent Green Amber Red Lime | Gray "Remove color".
  await user.keyboard("{ArrowDown}");
  expect(document.activeElement?.getAttribute("aria-label")).toBe("Gray");
  await user.keyboard("{Enter}");
  expect(editor.getHTML()).toBe('<p><span data-color="muted">alpha</span> beta</p>');
});

test("Escape closes the popover and returns focus to its button", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor();
  selectFirstWord(editor);
  await user.click(await colorButton());
  await screen.findByRole("menu", { name: "Color" });
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("menu", { name: "Color" })).toBeNull();
  const button = await colorButton();
  await waitFor(() => expect(document.activeElement).toBe(button));
  expect(editor.getHTML()).toBe("<p>alpha beta</p>");
});

test("Custom color… opens the colour picker of its kind", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor();
  selectFirstWord(editor);
  await user.click(await colorButton());
  const menu = await screen.findByRole("menu", { name: "Color" });
  const highlight = within(menu).getByRole("group", { name: "Highlight color" });
  await user.click(within(highlight).getByRole("menuitemradio", { name: "Custom color…" }));
  expect(await screen.findByRole("dialog", { name: "Custom highlight color" })).toBeDefined();
});

test("the Highlight button opens nine markers and Remove highlight — no more one-click yellow", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor();
  selectFirstWord(editor);
  expect(highlightButton().getAttribute("aria-label")).toBe("Highlight: None");
  expect(highlightButton().getAttribute("aria-haspopup")).toBe("menu");
  await user.click(highlightButton());
  expect(editor.getHTML()).toBe("<p>alpha beta</p>");
  const menu = await screen.findByRole("menu", { name: "Highlight" });
  expect(radios(menu)).toEqual([
    "Gray",
    "Brown",
    "Orange",
    "Yellow",
    "Green",
    "Blue",
    "Purple",
    "Pink",
    "Red",
  ]);
  await user.click(within(menu).getByRole("menuitemradio", { name: "Pink" }));
  expect(editor.getHTML()).toBe('<p><mark data-color="pink">alpha</mark> beta</p>');
  expect(highlightButton().getAttribute("aria-label")).toBe("Highlight: Pink");

  await user.click(highlightButton());
  const again = await screen.findByRole("menu", { name: "Highlight" });
  await user.click(within(again).getByRole("menuitem", { name: "Remove highlight" }));
  expect(editor.getHTML()).toBe("<p>alpha beta</p>");
});

test("without the highlight tool the Color popover has only the text grid and there is no Highlight button", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ tools: ["bold", "color"] });
  selectFirstWord(editor);
  expect(within(toolbar()).queryByRole("button", { name: /^Highlight/ })).toBeNull();
  expect(within(await bubble()).queryByRole("button", { name: /^Highlight/ })).toBeNull();
  await user.click(await colorButton());
  const menu = await screen.findByRole("menu", { name: "Color" });
  expect(within(menu).queryByRole("group", { name: "Highlight color" })).toBeNull();
  expect(within(menu).getByRole("group", { name: "Text color" })).toBeDefined();
});

test("without the color tool there is no Color button, and the bubble carries Highlight; basic has neither", async () => {
  const { editor } = renderEditor({ tools: ["bold", "highlight"] });
  selectFirstWord(editor);
  expect(within(toolbar()).queryByRole("button", { name: /^Color:/ })).toBeNull();
  expect(highlightButton()).toBeDefined();
  // Without "Color" the highlight in the pill is set by "Highlight" (OLDSUI-154): otherwise
  // it could not be set there.
  const withoutColor = await bubble();
  expect(within(withoutColor).queryByRole("button", { name: /^Color:/ })).toBeNull();
  expect(within(withoutColor).getByRole("button", { name: "Highlight: None" })).toBeDefined();
  cleanup();

  const basic = renderEditor({ preset: "basic" });
  selectFirstWord(basic.editor);
  for (const where of [toolbar(), await bubble()]) {
    expect(within(where).queryByRole("button", { name: /^Color:/ })).toBeNull();
    expect(within(where).queryByRole("button", { name: /^Highlight/ })).toBeNull();
  }
});

test("«…» no longer holds colour submenus", async () => {
  const user = userEvent.setup();
  renderEditor();
  await user.click(within(toolbar()).getByRole("button", { name: "More formatting" }));
  const menu = await screen.findByRole("menu");
  expect(within(menu).queryByRole("menuitem", { name: /^Highlight|^Text color/ })).toBeNull();
});

test("in the HTML mode the colour buttons are unavailable and open nothing", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor();
  selectFirstWord(editor);
  expect(await colorButton()).toBeDefined();
  await user.click(within(toolbar()).getByRole("button", { name: "HTML" }));
  // "Color" lives in the Bubble menu (OLDSUI-154), and that is above the Document: in HTML
  // mode there is no Document on screen, and the pill goes away together with "Color".
  await waitFor(() =>
    expect(screen.queryByRole("toolbar", { name: "Selection formatting" })).toBeNull()
  );
  expect(screen.queryByRole("button", { name: /^Color:/ })).toBeNull();
  expect(highlightButton().getAttribute("aria-disabled")).toBe("true");
  await user.click(highlightButton());
  expect(screen.queryByRole("menu")).toBeNull();
});

test("the selection menu carries Color, the toolbar Highlight — no duplicates", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor();
  selectFirstWord(editor);
  const selection = await bubble();
  // No duplicates (OLDSUI-154): "Color" with both grids is in the pill, "Highlight" is on the Toolbar.
  expect(within(selection).queryByRole("button", { name: /^Highlight/ })).toBeNull();
  expect(within(toolbar()).queryByRole("button", { name: /^Color:/ })).toBeNull();
  expect(highlightButton()).toBeDefined();
  await user.click(within(selection).getByRole("button", { name: /^Color:/ }));
  const menu = await screen.findByRole("menu", { name: "Color" });
  // The pill does not hide while the popover is open.
  expect(screen.getByRole("toolbar", { name: "Selection formatting" })).toBeDefined();
  await user.click(within(menu).getByRole("menuitemradio", { name: "Accent" }));
  expect(editor.getHTML()).toBe('<p><span data-color="accent">alpha</span> beta</p>');
});

test("Escape in a colour popover inside a modal layer closes the popover, not the layer", async () => {
  const user = userEvent.setup();
  const onClose = vi.fn();
  const ref = createRef<RichTextEditorHandle>();
  render(
    <ModalOverlay onClose={onClose}>
      <RichTextEditor ref={ref} aria-label="Body" defaultValue="<p>alpha beta</p>" />
    </ModalOverlay>
  );
  // "Color" is in the Bubble menu (OLDSUI-154): it needs focus in the Document and a selection.
  selectFirstWord(ref.current!.editor!);
  await user.click(await colorButton());
  await screen.findByRole("menu", { name: "Color" });
  await user.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("menu", { name: "Color" })).toBeNull());
  expect(onClose).not.toHaveBeenCalled();

  // Control: without the popover the same Escape closes the layer. Focus goes to the
  // Document: the button it returned to has its tooltip open, and the first Escape along
  // the stack of layers would close that.
  const button = await colorButton();
  await waitFor(() => expect(document.activeElement).toBe(button));
  act(() => screen.getByRole("textbox", { name: "Body" }).focus());
  await user.keyboard("{Escape}");
  expect(onClose).toHaveBeenCalledTimes(1);
});

test("the Color button names the current text colour; author colours tint its icon", async () => {
  const { editor } = renderEditor({
    defaultValue:
      '<p><span data-color="danger">alpha</span> <span style="color:#00aa55">beta</span></p>',
  });
  selectFirstWord(editor);
  expect((await colorButton()).getAttribute("aria-label")).toBe("Color: Red");
  act(() => void editor.commands.setTextSelection({ from: 7, to: 11 }));
  await waitFor(async () =>
    expect((await colorButton()).getAttribute("aria-label")).toBe("Color: Custom #00aa55")
  );
  const icon = (await colorButton()).querySelector("svg") as SVGElement;
  expect(icon.style.color).toBe("rgb(0, 170, 85)");
});

test("in a code block colours have nothing to do: both buttons are unavailable", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: "<pre><code>const x = 1;</code></pre>" });
  selectFirstWord(editor);
  // The pill pops up above the code, but "Color" in it is unavailable, as is the Toolbar's "Highlight".
  expect((await colorButton()).getAttribute("aria-disabled")).toBe("true");
  expect(highlightButton().getAttribute("aria-disabled")).toBe("true");
  await user.click(await colorButton());
  await user.click(highlightButton());
  expect(screen.queryByRole("menu")).toBeNull();
});
