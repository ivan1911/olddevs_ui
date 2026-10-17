// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { createRef } from "react";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import {
  RichTextEditor,
  type RichTextEditorHandle,
  type RichTextEditorProps,
} from "../src/editor/index.js";
import { searchState } from "../src/editor/features/search/searchPlugin.js";
import { loadLazyBuiltins } from "./editor-lazy-builtins.js";

beforeAll(loadLazyBuiltins);
// The panel is a lazy chunk: warm it up so `findBy` does not wait for the network.
beforeAll(() => import("../src/editor/features/search/SearchPanel.js"));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/**
 * The "Find and replace" panel (OLDSUI-151): the Toolbar button that opens it, shortcuts, fields,
 * checkboxes, counter, replace and close.
 */
function renderEditor(props: Partial<RichTextEditorProps> = {}) {
  const ref = createRef<RichTextEditorHandle>();
  const view = render(
    <RichTextEditor ref={ref} aria-label="Body" defaultValue="<p>cat dog cat</p>" {...props} />
  );
  const editor = ref.current?.editor;
  if (!editor) throw new Error("the editor was not created inside render()");
  return { ...view, editor, handle: ref.current! };
}

const panel = () => screen.queryByRole("search", { name: "Find and replace" });
const findField = () => screen.getByRole("textbox", { name: "Find" });
const replaceField = () => screen.getByRole("textbox", { name: "Replace with" });

test("both presets have the Find button on the fixed toolbar", () => {
  renderEditor();
  expect(screen.getByRole("button", { name: "Find" })).toBeDefined();
  cleanup();
  renderEditor({ preset: "basic" });
  expect(screen.getByRole("button", { name: "Find" })).toBeDefined();
  cleanup();
  renderEditor({ tools: ["bold"] });
  expect(screen.queryByRole("button", { name: "Find" })).toBeNull();
});

test("the button opens the panel with focus in the search field; typing highlights and counts", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor();
  await user.click(screen.getByRole("button", { name: "Find" }));
  expect(await screen.findByRole("search", { name: "Find and replace" })).toBeDefined();
  await waitFor(() => expect(document.activeElement).toBe(findField()));

  await user.keyboard("cat");
  expect(searchState(editor.state)).toMatchObject({ total: 2, current: 0 });
  expect(within(panel()!).getByRole("status").textContent).toBe("1 of 2");
  expect(screen.getByText("1 / 2")).toBeDefined();
});

test("Enter goes to the next match, Shift+Enter to the previous", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor();
  await user.click(screen.getByRole("button", { name: "Find" }));
  await user.type(await screen.findByRole("textbox", { name: "Find" }), "cat");
  await user.keyboard("{Enter}");
  expect(searchState(editor.state)?.current).toBe(1);
  await user.keyboard("{Shift>}{Enter}{/Shift}");
  expect(searchState(editor.state)?.current).toBe(0);
  // Focus stays in the search field, so the user can keep pressing.
  expect(document.activeElement).toBe(findField());
});

test("Replace and Replace all are unavailable without matches and replace in the document", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor();
  await user.click(screen.getByRole("button", { name: "Find" }));
  await screen.findByRole("search", { name: "Find and replace" });
  const replaceAll = screen.getByRole("button", { name: "Replace all" });
  expect(replaceAll).toHaveProperty("disabled", true);

  await user.type(findField(), "cat");
  await user.type(replaceField(), "cow");
  await user.click(screen.getByRole("button", { name: "Replace" }));
  expect(editor.getText()).toBe("cow dog cat");
  await user.click(screen.getByRole("button", { name: "Replace all" }));
  expect(editor.getText()).toBe("cow dog cow");
  expect(within(panel()!).getByRole("status").textContent).toBe("No matches");
  expect(screen.getByText("0 / 0")).toBeDefined();
});

test("the options change the search: match case and whole words", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: "<p>Cat cat category</p>" });
  await user.click(screen.getByRole("button", { name: "Find" }));
  await user.type(await screen.findByRole("textbox", { name: "Find" }), "cat");
  expect(searchState(editor.state)?.total).toBe(3);
  await user.click(screen.getByRole("checkbox", { name: "Match case" }));
  expect(searchState(editor.state)?.total).toBe(2);
  await user.click(screen.getByRole("checkbox", { name: "Whole words" }));
  expect(searchState(editor.state)?.total).toBe(1);
});

test("an invalid regular expression is a field error, not a crash", async () => {
  const user = userEvent.setup();
  renderEditor();
  await user.click(screen.getByRole("button", { name: "Find" }));
  await screen.findByRole("search", { name: "Find and replace" });
  await user.click(screen.getByRole("switch", { name: "Regular expression" }));
  await user.type(findField(), "(");
  expect(findField().getAttribute("aria-invalid")).toBe("true");
  expect(screen.getByText("Invalid regular expression")).toBeDefined();
});

test("Escape closes the panel, clears the highlight and puts the caret on the current match", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor();
  await user.click(screen.getByRole("button", { name: "Find" }));
  await user.type(await screen.findByRole("textbox", { name: "Find" }), "cat");
  await user.keyboard("{Enter}");
  await user.keyboard("{Escape}");
  expect(panel()).toBeNull();
  expect(searchState(editor.state)?.total).toBe(0);
  expect(editor.view.dom.querySelectorAll(".rte-search-match")).toHaveLength(0);
  await waitFor(() => expect(editor.isFocused).toBe(true));
  const { from, to } = editor.state.selection;
  expect([from, to]).toEqual([9, 12]);
});

test("Ctrl+F in the document opens the panel with the selected text", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor();
  act(() => void editor.chain().focus().setTextSelection({ from: 5, to: 8 }).run());
  await user.keyboard("{Control>}f{/Control}");
  expect(await screen.findByRole("search", { name: "Find and replace" })).toBeDefined();
  expect((findField() as HTMLInputElement).value).toBe("dog");
  await waitFor(() => expect(document.activeElement).toBe(findField()));
});

test("Ctrl+Alt+F opens the panel with focus in the replace field", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor();
  act(() => void editor.commands.focus());
  await user.keyboard("{Control>}{Alt>}f{/Alt}{/Control}");
  await screen.findByRole("search", { name: "Find and replace" });
  await waitFor(() => expect(document.activeElement).toBe(replaceField()));
});

test("the handle opens the panel from the screen's code", async () => {
  const { handle } = renderEditor();
  act(() => handle.openSearch({ replace: true }));
  await screen.findByRole("search", { name: "Find and replace" });
  await waitFor(() => expect(document.activeElement).toBe(replaceField()));
});

test("a read-only field has no replace controls", async () => {
  const { handle } = renderEditor({ readOnly: true });
  act(() => handle.openSearch());
  await screen.findByRole("search", { name: "Find and replace" });
  expect(screen.queryByRole("textbox", { name: "Replace with" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Replace all" })).toBeNull();
});

test("closing with the toolbar button works like Escape: caret on the current match", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor();
  await user.click(screen.getByRole("button", { name: "Find" }));
  await user.type(await screen.findByRole("textbox", { name: "Find" }), "cat");
  await user.keyboard("{Enter}");
  await user.click(screen.getByRole("button", { name: "Find" }));
  expect(panel()).toBeNull();
  expect(searchState(editor.state)?.total).toBe(0);
  await waitFor(() => expect(editor.isFocused).toBe(true));
  expect([editor.state.selection.from, editor.state.selection.to]).toEqual([9, 12]);
});

test("switching to the HTML mode closes the panel and its highlight", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor();
  await user.click(screen.getByRole("button", { name: "Find" }));
  await user.type(await screen.findByRole("textbox", { name: "Find" }), "cat");
  await user.click(screen.getByRole("button", { name: "HTML" }));
  expect(panel()).toBeNull();
  expect(searchState(editor.state)?.total).toBe(0);
});

test("Ctrl+F again with new selected text puts it in the field selected", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor();
  await user.click(screen.getByRole("button", { name: "Find" }));
  await user.type(await screen.findByRole("textbox", { name: "Find" }), "cat");
  // The author clicks into the Document: focus goes straight into it (Tiptap's `focus()` defers).
  act(() => {
    editor.view.focus();
    editor.commands.setTextSelection({ from: 5, to: 8 });
  });
  await user.keyboard("{Control>}f{/Control}");
  const field = findField() as HTMLInputElement;
  await waitFor(() => expect(field.value).toBe("dog"));
  await waitFor(() => expect([field.selectionStart, field.selectionEnd]).toEqual([0, 3]));
});

/**
 * Scrolling to the current match (OLDSUI-152). On navigation, focus goes to the search field,
 * and ProseMirror does not scroll to the selection: the panel shows it. In jsdom
 * there is no layout, so the match position comes from a stubbed `getBoundingClientRect`,
 * and window scrolling is seen in the `scrollTop` of the page root.
 */
function placeCurrentMatch(top: number) {
  const rect = Element.prototype.getBoundingClientRect;
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    if (!this.classList.contains("rte-search-current")) return rect.call(this);
    return DOMRect.fromRect({ x: 40, y: top, width: 30, height: 20 });
  });
  const scrolled: number[] = [];
  vi.spyOn(Element.prototype, "scrollTop", "set").mockImplementation(function (
    this: Element,
    value: number
  ) {
    if (this === document.documentElement) scrolled.push(value);
  });
  return scrolled;
}

test("going to a match below the visible area scrolls the page to put it in the middle", async () => {
  const user = userEvent.setup();
  renderEditor();
  await user.click(screen.getByRole("button", { name: "Find" }));
  await user.type(await screen.findByRole("textbox", { name: "Find" }), "cat");
  const below = window.innerHeight + 500;
  const scrolled = placeCurrentMatch(below);
  await user.keyboard("{Enter}");
  // The middle of the match goes to the middle of the window: a shift by the difference of centers.
  await waitFor(() => expect(scrolled).toEqual([below + 10 - window.innerHeight / 2]));
});

test("a match already in view is not scrolled", async () => {
  const user = userEvent.setup();
  renderEditor();
  await user.click(screen.getByRole("button", { name: "Find" }));
  await user.type(await screen.findByRole("textbox", { name: "Find" }), "cat");
  const scrolled = placeCurrentMatch(100);
  await user.keyboard("{Enter}");
  await new Promise((resolve) => requestAnimationFrame(resolve));
  await new Promise((resolve) => requestAnimationFrame(resolve));
  expect(scrolled).toEqual([]);
});
