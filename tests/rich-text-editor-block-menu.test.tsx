// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import type { Editor } from "@tiptap/react";
import { createRef } from "react";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { ModalOverlay } from "../src/components/overlays/ModalOverlay.js";
import { UiProvider } from "../src/i18n/UiProvider.js";
import { messages as ru } from "../src/locales/ru.js";
import {
  RichTextEditor,
  type RichTextEditorHandle,
  type RichTextEditorProps,
} from "../src/editor/index.js";
import { TOOLS } from "../src/editor/core/tools.js";
import { loadLazyBuiltins } from "./editor-lazy-builtins.js";

// Lazy `codeBlock` and `table` (OLDSUI-111): `full` is ready in `render` after the chunks load.
beforeAll(loadLazyBuiltins);

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/**
 * The "¶" menu on the Toolbar: the Block type (OLDSUI-64).
 *
 * Through the public `RichTextEditor`: the button and items by roles and names, as a
 * screen reader hears them; the result by the output HTML. The caret is set with engine
 * commands: jsdom cannot type into `contenteditable`.
 */
function renderEditor(props: Partial<RichTextEditorProps> = {}) {
  const ref = createRef<RichTextEditorHandle>();
  const view = render(<RichTextEditor ref={ref} aria-label="Body" {...props} />);
  const editor = ref.current?.editor;
  if (!editor) throw new Error("the editor was not created inside render()");
  return { ...view, ref, editor };
}

/** Moves the caret to the end of the text `text`. */
function caretIn(editor: Editor, text: string) {
  let found = -1;
  editor.state.doc.descendants((node, pos) => {
    if (found < 0 && node.isText && node.text === text) found = pos + node.nodeSize;
  });
  if (found < 0) throw new Error(`no text "${text}" in the document`);
  act(() => void editor.commands.setTextSelection(found));
}

const blockButton = () => screen.getByRole("button", { name: /^Block type/ });
const textbox = () => screen.getByRole("textbox", { name: "Body" });

/** The items of the open menu: the name without the shortcut label, the checked state, the shortcut. */
function items() {
  // The menu is named by its own button (`aria-labelledby`), as in the APG pattern.
  const menu = screen.getByRole("menu", { name: /^Block type/ });
  return within(menu)
    .getAllByRole("menuitemradio")
    .map((item) => {
      const shortcut = item.querySelector("kbd")?.textContent ?? null;
      return {
        name: (item.textContent ?? "").replace(shortcut ?? "", ""),
        checked: item.getAttribute("aria-checked") === "true",
        shortcut,
      };
    });
}

const checked = () => items().find((item) => item.checked)?.name ?? null;

test("the full preset offers Text and headings with their shortcuts, Text checked in a paragraph", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: "<p>Title</p>" });
  caretIn(editor, "Title");

  expect(blockButton().getAttribute("aria-label")).toBe("Block type: Text");
  expect(blockButton().getAttribute("aria-haspopup")).toBe("menu");
  await user.click(blockButton());

  // jsdom is not Apple: `mod` is labelled as Ctrl.
  expect(items()).toEqual([
    { name: "Text", checked: true, shortcut: "Ctrl+Alt+0" },
    { name: "Heading 1", checked: false, shortcut: "Ctrl+Alt+1" },
    { name: "Heading 2", checked: false, shortcut: "Ctrl+Alt+2" },
    { name: "Heading 3", checked: false, shortcut: "Ctrl+Alt+3" },
    { name: "Heading 4", checked: false, shortcut: "Ctrl+Alt+4" },
  ]);
  // Lists are under "Lists ▾", the quote is a "…" checkbox (OLDSUI-154).
});

test("on Apple the shortcuts are signed with ⌘ ⌥ ⇧", async () => {
  vi.spyOn(navigator, "platform", "get").mockReturnValue("MacIntel");
  const user = userEvent.setup();
  renderEditor({ defaultValue: "<p>Title</p>" });

  await user.click(blockButton());

  const shortcuts = items().map((item) => item.shortcut);
  expect(shortcuts).toEqual(["⌘+⌥+0", "⌘+⌥+1", "⌘+⌥+2", "⌘+⌥+3", "⌘+⌥+4"]);
});

test("items come from the enabled tools; Heading 1 only with heading1", async () => {
  const user = userEvent.setup();
  const { unmount } = renderEditor({ tools: TOOLS.filter((tool) => tool !== "heading1") });
  await user.click(blockButton());
  expect(items().map((item) => item.name)).toEqual(["Text", "Heading 2", "Heading 3", "Heading 4"]);
  unmount();

  // There are no headings in `basic`: "¶" would be left with a single "Text", and so
  // there is no button — the quote is a "…" checkbox there, the lists are "Lists ▾" (OLDSUI-154).
  renderEditor({ preset: "basic" });
  expect(screen.queryByRole("button", { name: /^Block type/ })).toBeNull();
});

test("without a single block tool there is no menu at all", () => {
  renderEditor({ tools: ["bold", "italic", "history", "codeBlock"] });

  expect(screen.queryByRole("button", { name: /^Block type/ })).toBeNull();
});

test("the check and the button name follow the line under the caret, inside lists and quotes too", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({
    defaultValue:
      "<h2>Heading</h2><blockquote><p>Quoted</p></blockquote><ul><li><p>Bullet</p></li></ul>" +
      "<ol><li><p>Step</p></li></ol>" +
      '<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>Task</p></li></ul>' +
      "<blockquote><h3>Quoted heading</h3></blockquote>",
  });

  // The line under the caret decides (OLDSUI-154): a list and a quote show their own buttons.
  const cases = [
    ["Heading", "Heading 2"],
    ["Quoted", "Text"],
    ["Bullet", "Text"],
    ["Step", "Text"],
    ["Task", "Text"],
    ["Quoted heading", "Heading 3"],
  ] as const;
  for (const [text, type] of cases) {
    caretIn(editor, text);
    expect(blockButton().getAttribute("aria-label"), text).toBe(`Block type: ${type}`);
    await user.click(blockButton());
    expect(checked(), text).toBe(type);
    await user.keyboard("{Escape}");
  }
});

test("a code block is named on the button, and no item is checked", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: "<pre><code>let x = 1;</code></pre>" });
  caretIn(editor, "let x = 1;");

  expect(blockButton().getAttribute("aria-label")).toBe("Block type: Code block");
  await user.click(blockButton());
  expect(checked()).toBeNull();
});

test("choosing an item turns the block into it, keeps the text, undoes in one step and returns focus", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: "<p>Title</p>" });
  caretIn(editor, "Title");

  await user.click(blockButton());
  await user.click(screen.getByRole("menuitemradio", { name: /Heading 3/ }));

  expect(editor.getHTML()).toBe("<h3>Title</h3>");
  expect(screen.queryByRole("menu")).toBeNull();
  expect(blockButton().getAttribute("aria-label")).toBe("Block type: Heading 3");
  await waitFor(() => expect(document.activeElement).toBe(textbox()));

  act(() => void editor.commands.undo());
  expect(editor.getHTML()).toBe("<p>Title</p>");
});

test("a heading stays inside a quote; in a list item, where the schema has no heading, it unwraps the list", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({
    defaultValue: "<blockquote><p>Quoted</p></blockquote><ul><li><p>Item</p></li></ul>",
  });

  // The type of the line changes in place (OLDSUI-154).
  caretIn(editor, "Quoted");
  await user.click(blockButton());
  await user.click(screen.getByRole("menuitemradio", { name: /Heading 2/ }));
  expect(editor.getHTML()).toBe(
    "<blockquote><h2>Quoted</h2></blockquote><ul><li><p>Item</p></li></ul>"
  );

  // A heading cannot come first in a list item — that is the "Turn into" path.
  caretIn(editor, "Item");
  await user.click(blockButton());
  await user.click(screen.getByRole("menuitemradio", { name: /Heading 2/ }));
  expect(editor.getHTML()).toBe("<blockquote><h2>Quoted</h2></blockquote><h2>Item</h2>");

  act(() => void editor.commands.undo());
  expect(editor.getHTML()).toBe(
    "<blockquote><h2>Quoted</h2></blockquote><ul><li><p>Item</p></li></ul>"
  );
});

test("choosing the current type changes nothing and adds no undo step", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({
    defaultValue: "<ul><li><p>One</p><ul><li><p>Two</p></li></ul></li></ul>",
  });
  const before = editor.getHTML();
  caretIn(editor, "One");

  await user.click(blockButton());
  // A paragraph in a list item is "Text" (OLDSUI-154).
  await user.click(screen.getByRole("menuitemradio", { name: /^Text/ }));

  expect(editor.getHTML()).toBe(before);
  expect(editor.can().undo()).toBe(false);
});

test("Enter, Space and ArrowDown open the menu; Escape closes it and returns focus to the button", async () => {
  const user = userEvent.setup();
  renderEditor({ defaultValue: "<p>Title</p>" });

  for (const key of ["{Enter}", " ", "{ArrowDown}"]) {
    act(() => blockButton().focus());
    await user.keyboard(key);
    expect(screen.getByRole("menu", { name: "Block type: Text" }), key).toBeDefined();
    expect(document.activeElement?.closest('[role="menu"]'), key).not.toBeNull();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu"), key).toBeNull();
    // react-aria returns focus after the popover closes — one frame later.
    await waitFor(() => expect(document.activeElement, key).toBe(blockButton()));
  }
});

/**
 * Escape in the menu belongs to the menu, not to the layer under it (ADR-0041). The layer
 * is `ModalOverlay`, not `Dialog`: a react-aria menu inside a Radix modal does not open in
 * jsdom (the analysis is in `tests/overlay-layers.test.tsx`). With a real `Dialog` the same
 * thing is checked by `tests-visual/interactions.spec.ts`.
 */
test("Escape in the menu closes the menu, not the layer under it", async () => {
  const user = userEvent.setup();
  const onClose = vi.fn();
  render(
    <ModalOverlay onClose={onClose}>
      <RichTextEditor aria-label="Body" />
    </ModalOverlay>
  );

  await user.click(blockButton());
  // The react-aria menu opens and closes over the following frames: under the load of a
  // full run, an instant check caught the intermediate state.
  expect(await screen.findByRole("menu")).toBeDefined();
  await user.keyboard("{Escape}");

  await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  expect(onClose).not.toHaveBeenCalled();

  // Control: without an open menu, the same Escape closes the layer.
  await user.keyboard("{Escape}");
  expect(onClose).toHaveBeenCalledTimes(1);
});

test("the menu speaks the provider's language", async () => {
  const user = userEvent.setup();
  render(
    <UiProvider messages={ru}>
      <RichTextEditor aria-label="Body" defaultValue="<h2>Title</h2>" />
    </UiProvider>
  );

  // The expectations come from the Russian catalog: the i18n gate keeps Cyrillic inside the catalog.
  const t = ru.editor;
  const button = screen.getByRole("button", {
    name: t.blockType({ current: t.heading({ level: 2 }) }),
  });
  await user.click(button);
  const menu = screen.getByRole("menu", { name: button.getAttribute("aria-label")! });
  expect(within(menu).getByRole("menuitemradio", { name: new RegExp(t.textBlock) })).toBeDefined();
  expect(
    within(menu).getByRole("menuitemradio", { name: new RegExp(t.heading({ level: 3 })) })
  ).toBeDefined();
});
