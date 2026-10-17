// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { createRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { Dialog } from "../src/components/overlays/Dialog.js";
import { Drawer } from "../src/components/overlays/Drawer.js";
import { RichTextView } from "../src/editor/RichTextView.js";
import {
  RichTextEditor,
  type RichTextEditorHandle,
  type RichTextEditorProps,
} from "../src/editor/index.js";
import { UiProvider } from "../src/i18n/UiProvider.js";
import { messages as ru } from "../src/locales/ru.js";
import { loadLazyBuiltins } from "./editor-lazy-builtins.js";

// Lazy `codeBlock` and `table` (OLDSUI-111): `full` is ready in `render` after the chunks load.
beforeAll(loadLazyBuiltins);

afterEach(cleanup);

/**
 * Emoji: the Toolbar button, a popover with the grid, and insertion as plain text (OLDSUI-68).
 *
 * Everything goes through the public `RichTextEditor`. Selection uses real clicks and
 * `user-event` keys, because those are what both the grid and Radix see.
 */
function renderEditor(props: Partial<RichTextEditorProps> = {}) {
  const ref = createRef<RichTextEditorHandle>();
  const view = render(<RichTextEditor ref={ref} aria-label="Body" {...props} />);
  const editor = ref.current?.editor;
  if (!editor) throw new Error("the editor was not created inside render()");
  return { ...view, ref, editor };
}

const field = () => screen.getByRole("textbox", { name: "Body" });
const button = () => screen.getByRole("button", { name: "Emoji" });
const grid = () => screen.getByRole("grid", { name: "Choose an emoji" });
// 'Favorites' repeats some of the categories: the first cell with that name is taken.
const cell = (name: string) => within(grid()).getAllByRole("gridcell", { name })[0]!;
const activeCell = () => {
  const id = grid().getAttribute("aria-activedescendant");
  return id ? document.getElementById(id) : null;
};

test("the full preset has an Emoji button; basic and a list without emoji do not", () => {
  renderEditor();
  expect(button().getAttribute("aria-haspopup")).toBe("dialog");
  cleanup();

  renderEditor({ preset: "basic" });
  expect(screen.queryByRole("button", { name: "Emoji" })).toBeNull();
  cleanup();

  renderEditor({ tools: ["bold", "history"] });
  expect(screen.queryByRole("button", { name: "Emoji" })).toBeNull();
  cleanup();

  renderEditor({ tools: ["emoji"] });
  expect(button()).toBeDefined();
});

test("the button sits after the table and image buttons", () => {
  renderEditor();
  const names = within(screen.getByRole("toolbar", { name: "Formatting" }))
    .getAllByRole("button")
    .map((item) => item.getAttribute("aria-label"));
  expect(names.indexOf("Emoji")).toBeGreaterThan(names.indexOf("Table"));
  expect(names.indexOf("Emoji")).toBeGreaterThan(names.indexOf("Image"));
});

test("the grid shows Favorites (20) and six categories of ten, each named", async () => {
  const user = userEvent.setup();
  renderEditor();
  await user.click(button());

  const groups = within(grid()).getAllByRole("rowgroup");
  expect(groups.map((group) => group.getAttribute("aria-label"))).toEqual([
    "Favorites",
    "Smileys",
    "Gestures",
    "Animals",
    "Food",
    "Activities",
    "Travel",
  ]);
  expect(groups.map((group) => within(group).getAllByRole("gridcell").length)).toEqual([
    20, 10, 10, 10, 10, 10, 10,
  ]);
  // The cell is named by the emoji name, not by the character.
  expect(within(groups[0]!).getAllByRole("gridcell")[0]?.getAttribute("aria-label")).toBe(
    "Face with tears of joy"
  );
});

test("the names and categories are read in the active locale", async () => {
  const user = userEvent.setup();
  render(
    <UiProvider locale="ru" messages={{ editor: ru.editor }}>
      <RichTextEditor aria-label="Body" />
    </UiProvider>
  );
  await user.click(screen.getByRole("button", { name: ru.editor.emoji }));

  const russianGrid = screen.getByRole("grid", { name: ru.editor.emojiGrid });
  const groups = within(russianGrid).getAllByRole("rowgroup");
  expect(groups[0]?.getAttribute("aria-label")).toBe(ru.editor.emojiCategory.favorites);
  expect(within(russianGrid).getAllByRole("gridcell")[0]?.getAttribute("aria-label")).toBe(
    ru.editor.emojiName.faceWithTearsOfJoy
  );
});

test("a click inserts the emoji as plain text at the caret and puts the caret after it", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: "<p>Hi</p>" });
  act(() => void editor.commands.setTextSelection(3));

  await user.click(button());
  await user.click(cell("Fire"));

  expect(editor.getHTML()).toBe("<p>Hi🔥</p>");
  expect(editor.state.selection.empty).toBe(true);
  expect(editor.state.selection.from).toBe(3 + "🔥".length);
  expect(screen.queryByRole("grid")).toBeNull();
  // Typing continues in the Document.
  await waitFor(() => expect(document.activeElement).toBe(field()));
  act(() => void editor.commands.insertContent("!"));
  expect(editor.getHTML()).toBe("<p>Hi🔥!</p>");
});

test("a non-empty selection keeps its text: the emoji goes after the end of it", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: "<p>Hello world</p>" });
  act(() => void editor.commands.setTextSelection({ from: 1, to: 6 }));

  await user.click(button());
  await user.click(cell("Party popper"));

  expect(editor.getHTML()).toBe("<p>Hello🎉 world</p>");
  expect(editor.state.selection.empty).toBe(true);
  expect(editor.state.selection.from).toBe(6 + "🎉".length);
});

test("one undo takes the emoji back", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: "<p>Hi</p>" });
  act(() => void editor.commands.setTextSelection(3));

  await user.click(button());
  await user.click(cell("Sparkles"));
  expect(editor.getHTML()).toBe("<p>Hi✨</p>");

  act(() => void editor.commands.undo());
  expect(editor.getHTML()).toBe("<p>Hi</p>");
});

test("a variation-selector emoji goes in whole", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: "<p>x</p>" });
  act(() => void editor.commands.setTextSelection(2));

  await user.click(button());
  await user.click(cell("Red heart"));

  expect(editor.getHTML()).toBe("<p>x❤️</p>");
});

test("at maxLength nothing is inserted", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ maxLength: 5, defaultValue: "<p>12345</p>" });
  act(() => void editor.commands.setTextSelection(6));

  await user.click(button());
  await user.click(cell("Fire"));

  expect(editor.getHTML()).toBe("<p>12345</p>");
  expect(editor.state.selection.from).toBe(6);
});

test("an emoji that does not fit into what is left is not inserted either", async () => {
  const user = userEvent.setup();
  // One character is left, and an emoji takes two UTF-16 code units: a half of an emoji is not possible.
  const { editor } = renderEditor({ maxLength: 5, defaultValue: "<p>1234</p>" });
  act(() => void editor.commands.setTextSelection(5));

  await user.click(button());
  await user.click(cell("Fire"));

  expect(editor.getHTML()).toBe("<p>1234</p>");
});

test("the emoji is text in the output HTML, getMarkdown and RichTextView", async () => {
  const user = userEvent.setup();
  const { editor, ref } = renderEditor({ defaultValue: "<p>Done</p>" });
  act(() => void editor.commands.setTextSelection(5));

  await user.click(button());
  await user.click(cell("Thumbs up"));

  expect(ref.current!.getHTML()).toBe("<p>Done👍</p>");
  expect(ref.current!.getMarkdown()).toBe("Done👍");
  expect(renderToStaticMarkup(<RichTextView html={ref.current!.getHTML()} />)).toContain(
    "<p>Done👍</p>"
  );
});

test("the keyboard walks the grid with aria-activedescendant, Enter inserts", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: "<p>x</p>" });
  act(() => void editor.commands.setTextSelection(2));

  await user.click(button());
  // Focus is on the grid, and the first cell is active.
  await waitFor(() => expect(document.activeElement).toBe(grid()));
  expect(grid().getAttribute("tabindex")).toBe("0");
  expect(activeCell()?.getAttribute("aria-label")).toBe("Face with tears of joy");

  await user.keyboard("{ArrowRight}");
  expect(activeCell()?.getAttribute("aria-label")).toBe("Red heart");
  await user.keyboard("{ArrowDown}");
  // The grid is ten cells wide: down moves to the emoji directly below the current one.
  expect(activeCell()?.getAttribute("aria-label")).toBe("Fire");
  await user.keyboard("{ArrowUp}{ArrowLeft}{ArrowLeft}");
  // The grid does not move left of the first cell.
  expect(activeCell()?.getAttribute("aria-label")).toBe("Face with tears of joy");

  await user.keyboard("{End}");
  expect(activeCell()?.getAttribute("aria-label")).toBe("Party popper");
  await user.keyboard("{Home}");
  expect(activeCell()?.getAttribute("aria-label")).toBe("Face with tears of joy");
  await user.keyboard("{Control>}{End}{/Control}");
  expect(activeCell()?.getAttribute("aria-label")).toBe("Luggage");
  await user.keyboard("{Control>}{Home}{/Control}");

  await user.keyboard("{ArrowRight}{ArrowRight}{Enter}");
  expect(editor.getHTML()).toBe("<p>x🤣</p>");
  expect(screen.queryByRole("grid")).toBeNull();
});

test("arrows cross from one category to the next", async () => {
  const user = userEvent.setup();
  renderEditor();
  await user.click(button());
  await waitFor(() => expect(document.activeElement).toBe(grid()));

  // Two rows of 'Favorites', the third is 'Smileys'.
  await user.keyboard("{ArrowDown}{ArrowDown}");
  expect(activeCell()?.getAttribute("aria-label")).toBe("Slightly smiling face");
  await user.keyboard("{ArrowLeft}");
  expect(activeCell()?.getAttribute("aria-label")).toBe("Angry face");
});

test("Escape closes the grid and returns focus to the document", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: "<p>x</p>" });
  act(() => void editor.commands.setTextSelection(2));

  await user.click(button());
  await waitFor(() => expect(document.activeElement).toBe(grid()));
  await user.keyboard("{Escape}");

  expect(screen.queryByRole("grid")).toBeNull();
  await waitFor(() => expect(document.activeElement).toBe(field()));
  expect(editor.getHTML()).toBe("<p>x</p>");
});

test("inside a Dialog Escape closes only the grid and a click still picks", async () => {
  const user = userEvent.setup();
  const onClose = vi.fn();
  const ref = createRef<RichTextEditorHandle>();
  render(
    <Dialog open onClose={onClose} title="Edit">
      <RichTextEditor ref={ref} aria-label="Body" defaultValue="<p>x</p>" />
    </Dialog>
  );
  const editor = ref.current!.editor!;
  act(() => void editor.commands.setTextSelection(2));

  await user.click(button());
  await waitFor(() => expect(document.activeElement).toBe(grid()));
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("grid")).toBeNull();
  expect(onClose).not.toHaveBeenCalled();

  // Mouse selection inside the window: the window's `pointer-events` does not propagate to the grid.
  await user.click(button());
  await user.click(cell("Fire"));
  expect(editor.getHTML()).toBe("<p>x🔥</p>");
});

test("a disabled field cannot open the grid", () => {
  renderEditor({ disabled: true });
  expect((button() as HTMLButtonElement).disabled).toBe(true);
});

test("inside a Drawer a click picks too", async () => {
  const user = userEvent.setup();
  const ref = createRef<RichTextEditorHandle>();
  render(
    <Drawer open onClose={() => undefined} title="Edit">
      <RichTextEditor ref={ref} aria-label="Body" defaultValue="<p>x</p>" />
    </Drawer>
  );
  const editor = ref.current!.editor!;
  act(() => void editor.commands.setTextSelection(2));

  await user.click(button());
  await user.click(cell("Fire"));

  expect(editor.getHTML()).toBe("<p>x🔥</p>");
});

test("the button on the floating toolbar picks and inserts after the selection", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ toolbar: "floating", defaultValue: "<p>Hello world</p>" });
  act(() => editor.view.focus());
  act(() => void editor.commands.setTextSelection({ from: 1, to: 6 }));
  await screen.findByRole("toolbar", { name: "Formatting" });

  await user.click(button());
  await user.click(cell("Fire"));

  expect(editor.getHTML()).toBe("<p>Hello🔥 world</p>");
});
