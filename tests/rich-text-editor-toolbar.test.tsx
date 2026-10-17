// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { createRef } from "react";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { UiProvider } from "../src/i18n/UiProvider.js";
import { messages as ru } from "../src/locales/ru.js";
import {
  RichTextEditor,
  type RichTextEditorHandle,
  type RichTextEditorProps,
} from "../src/editor/index.js";
import { loadLazyBuiltins } from "./editor-lazy-builtins.js";

// Lazy `codeBlock` and `table` (OLDSUI-111): `full` is ready in `render` once the chunks load.
beforeAll(loadLazyBuiltins);

afterEach(cleanup);

/**
 * The Editor's Toolbar: fixed, above the field (OLDSUI-41).
 *
 * It is checked from the outside, by roles and names, the way a screen reader sees it, and
 * by the result in HTML. `ref.editor` gives access to the engine only where jsdom cannot
 * handle input: selection and typing go through commands, as in the other Editor tests.
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

test("the toolbar is one Tab stop between the outside and the document", async () => {
  const user = userEvent.setup();
  renderEditor();

  const toolbar = screen.getByRole("toolbar", { name: "Formatting" });
  screen.getByRole("button", { name: "Before" }).focus();

  await user.tab();
  expect(toolbar.contains(document.activeElement)).toBe(true);
  await user.tab();
  expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Body" }));
});

test("arrows, Home and End move between the toolbar actions", async () => {
  const user = userEvent.setup();
  renderEditor({ preset: "basic" });
  screen.getByRole("button", { name: "Before" }).focus();
  await user.tab();

  // The first stop is the Toolbar's first button: in `basic` it is "Bold"; "¶" from a single
  // "Text" is not rendered (OLDSUI-154).
  const first = screen.getByRole("button", { name: "Bold" });
  expect(document.activeElement).toBe(first);
  await user.keyboard("{ArrowRight}");
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Italic" }));
  await user.keyboard("{End}");
  // The last stop is the keyboard shortcuts popover at the right edge (OLDSUI-67).
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Keyboard shortcuts" }));
  await user.keyboard("{Home}");
  expect(document.activeElement).toBe(first);
});

test("toggle buttons report the marks and blocks under the caret with aria-pressed", () => {
  const { editor } = renderEditor({
    defaultValue: "<p><strong>bold</strong> plain</p><ul><li><p>listed</p></li></ul>",
  });
  const bold = screen.getByRole("button", { name: "Bold" });
  const italic = screen.getByRole("button", { name: "Italic" });

  act(() => void editor.commands.setTextSelection(3));
  expect(bold.getAttribute("aria-pressed")).toBe("true");
  expect(italic.getAttribute("aria-pressed")).toBe("false");

  // The list under the caret is announced not by a button but by the "Lists" menu name (OLDSUI-66).
  act(() => void editor.commands.setTextSelection(editor.state.doc.content.size - 4));
  expect(bold.getAttribute("aria-pressed")).toBe("false");
  expect(screen.getByRole("button", { name: "List: bulleted" })).toBeDefined();
});

test("one-shot actions are plain buttons, not toggles", () => {
  renderEditor();

  for (const name of ["Undo", "Redo"]) {
    expect(screen.getByRole("button", { name }).hasAttribute("aria-pressed"), name).toBe(false);
  }
});

test("a button applies its formatting to the selection", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: "<p>Hello world</p>" });
  act(() => void editor.commands.setTextSelection({ from: 1, to: 6 }));

  await user.click(screen.getByRole("button", { name: "Italic" }));
  expect(editor.getHTML()).toBe("<p><em>Hello</em> world</p>");

  await user.click(screen.getByRole("button", { name: "Undo" }));
  expect(editor.getHTML()).toBe("<p>Hello world</p>");
});

test("the tooltip names the action together with its shortcut", async () => {
  const user = userEvent.setup();
  renderEditor();
  const bold = screen.getByRole("button", { name: "Bold" });

  // jsdom is not Apple: `mod` is labeled as Ctrl.
  expect(bold.getAttribute("aria-keyshortcuts")).toBe("Control+B");
  await user.hover(bold);
  expect((await screen.findByRole("tooltip")).textContent).toBe("BoldCtrl+B");
});

/**
 * The Toolbar button names in order, which is what a screen reader announces, and `|` at the
 * place of the group separator. The keyboard shortcuts popover at the right edge is not counted:
 * it does not depend on `tools`, and its place and contents are checked by
 * `rich-text-editor-shortcuts.test.tsx`.
 */
function toolbarLayout() {
  const toolbar = screen.getByRole("toolbar", { name: "Formatting" });
  return (
    Array.from(toolbar.querySelectorAll('button, [role="separator"]'))
      .map((node) =>
        node.getAttribute("role") === "separator"
          ? "|"
          : (node.getAttribute("aria-label") ?? node.textContent)
      )
      // The right edge holds "Find" (OLDSUI-151) and the shortcuts popover: they are not a
      // kit group, and they have their own tests.
      .filter((name) => name !== "Keyboard shortcuts" && name !== "Find")
  );
}

/** Buttons only, without separators. */
const toolbarButtons = () => toolbarLayout().filter((name) => name !== "|");

/*
  The layout of the compact Toolbar (OLDSUI-66), in the kit's order: "+" · HTML (OLDSUI-76) ·
  "¶" · Alignment ▾ | Bold · Italic · Highlight · "…" | Lists ▾ |
  Link · Image · Table ▾ · Emoji | Undo · Redo. There are no separate buttons
  for alignment, lists, the separator, or the code block: the first two are menus,
  the separator is in the Slash menu, and the code block is an item under "…" (OLDSUI-76).
*/
test("the full preset lays the toolbar out in the kit's order, groups split by separators", () => {
  renderEditor();

  expect(toolbarLayout()).toEqual([
    "Insert block",
    "HTML",
    "Block type: Text",
    "Alignment: left",
    "|",
    "Bold",
    "Italic",
    // "Color" is in the selection menu; the Toolbar has only "Highlight" (OLDSUI-154).
    "Highlight: None",
    "More formatting",
    "|",
    "Lists",
    "|",
    "Link",
    "Image",
    "Table",
    "Emoji",
    "|",
    "Undo",
    "Redo",
  ]);
  for (const name of [
    "Align left",
    "Bulleted list",
    "Numbered list",
    "Checklist",
    "Divider",
    "Code block",
  ]) {
    expect(screen.queryByRole("button", { name }), name).toBeNull();
  }
});

test("the basic preset keeps only its tools' buttons and menus, without empty groups", () => {
  renderEditor({ preset: "basic" });

  // Quote, inline code, and strikethrough are items under "…"; "¶" from a single "Text" is not
  // rendered (OLDSUI-154); there is no highlight or alignment menu in basic.
  expect(toolbarLayout()).toEqual([
    "Bold",
    "Italic",
    "More formatting",
    "|",
    "Lists",
    "|",
    "Link",
    "|",
    "Undo",
    "Redo",
  ]);
});

test("the shortcuts reference is the last button of the fixed toolbar", () => {
  renderEditor();

  const toolbar = screen.getByRole("toolbar", { name: "Formatting" });
  expect(Array.from(toolbar.querySelectorAll("button")).at(-1)?.getAttribute("aria-label")).toBe(
    "Keyboard shortcuts"
  );
});

test("tools is an exact list and wins over the preset, in the kit's order", () => {
  renderEditor({ preset: "basic", tools: ["taskList", "bold", "underline", "align"] });

  // Task list is under "Lists ▾", not under "¶": without headings there is no "¶" (OLDSUI-154).
  expect(toolbarButtons()).toEqual(["Alignment: left", "Bold", "More formatting", "Lists"]);
});

/*
  A name from JS without types, or from a newer kit version: the Editor does not know it and
  silently drops it (the owner's decision, OLDSUI-98), instead of failing or losing the rest
  of the set.
*/
test("an unknown name in tools is dropped silently, the rest of the set works", () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  const { editor } = renderEditor({
    tools: ["bold", "acme_unknown", "italic"] as unknown as RichTextEditorProps["tools"],
    defaultValue: "<p><strong>b</strong> <em>i</em> <u>u</u></p>",
  });

  expect(toolbarButtons()).toEqual(["Bold", "Italic"]);
  expect(editor.getHTML()).toBe("<p><strong>b</strong> <em>i</em> u</p>");
  expect(error).not.toHaveBeenCalled();
  error.mockRestore();
});

const EVERYTHING =
  "<h2>Title</h2><p><strong>b</strong> <em>i</em> <u>u</u> <s>s</s> <code>c</code> " +
  "<sup>sup</sup> <sub>sub</sub></p><ul><li><p>bullet</p></li></ul>" +
  '<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><p>task</p></li></ul>' +
  '<blockquote><p>quote</p></blockquote><pre><code class="language-js">code()</code></pre><hr>';

test("a disabled tool drops its markup from loaded and pasted content", () => {
  const { editor } = renderEditor({ preset: "basic", defaultValue: EVERYTHING });
  const loaded = editor.getHTML();
  act(() => void editor.commands.clearContent());
  act(() => void editor.view.pasteHTML(EVERYTHING, new Event("paste") as ClipboardEvent));
  const pasted = editor.getHTML();

  for (const html of [loaded, pasted]) {
    expect(html).toMatch(/<strong>b<\/strong>/);
    expect(html).toMatch(/<ul><li><p>bullet/);
    expect(html).toMatch(/<blockquote>/);
    // What is turned off in `basic` (heading, underline, sub/superscript, task list,
    // code block, and separator) disappears, but the text from them stays.
    expect(html).not.toMatch(/<h2|<u>|<sup>|<sub>|taskList|<pre|<hr/);
    expect(html).toContain("Title");
    expect(html).toContain("code()");
  }
});

test("a disabled tool's shortcut does nothing", () => {
  const pressCtrlU = (editor: RichTextEditorHandle["editor"]) =>
    act(() => {
      editor!.view.dom.dispatchEvent(
        new KeyboardEvent("keydown", { key: "u", ctrlKey: true, bubbles: true, cancelable: true })
      );
    });

  const withUnderline = renderEditor({ tools: ["underline"], defaultValue: "<p>word</p>" });
  act(() => void withUnderline.editor.commands.setTextSelection({ from: 1, to: 5 }));
  pressCtrlU(withUnderline.editor);
  // Control: the shortcut does reach the engine in jsdom at all.
  expect(withUnderline.editor.getHTML()).toBe("<p><u>word</u></p>");
  cleanup();

  const without = renderEditor({ tools: ["bold"], defaultValue: "<p>word</p>" });
  act(() => void without.editor.commands.setTextSelection({ from: 1, to: 5 }));
  pressCtrlU(without.editor);
  expect(without.editor.getHTML()).toBe("<p>word</p>");
});

test("toolbar none keeps the schema of the preset but shows no toolbar", () => {
  const { editor } = renderEditor({ toolbar: "none", defaultValue: "<p><u>u</u></p>" });

  expect(screen.queryByRole("toolbar")).toBeNull();
  expect(editor.getHTML()).toBe("<p><u>u</u></p>");
});

test("read-only mode has no toolbar", () => {
  renderEditor({ readOnly: true });

  expect(screen.queryByRole("toolbar")).toBeNull();
});

test("a disabled field shows the toolbar with every action switched off", () => {
  renderEditor({ disabled: true, preset: "basic" });

  const toolbar = screen.getByRole("toolbar", { name: "Formatting" });
  for (const button of toolbar.querySelectorAll("button")) {
    expect(button.disabled, button.getAttribute("aria-label") ?? "").toBe(true);
  }
});

test("the toolbar speaks the provider's language", () => {
  render(
    <UiProvider messages={ru}>
      <RichTextEditor aria-label="Body" defaultValue="<h2>Title</h2>" />
    </UiProvider>
  );

  // The expectations come from the Russian catalog, not from literals: the i18n gate keeps
  // Cyrillic in the catalog, and what is checked here is that the Toolbar takes its strings
  // from the provider, not from the fallback.
  const t = ru.editor;
  expect(screen.getByRole("toolbar", { name: t.toolbar })).toBeDefined();
  expect(screen.getByRole("button", { name: t.bold })).toBeDefined();
  expect(
    screen.getByRole("button", { name: t.blockType({ current: t.heading({ level: 2 }) }) })
  ).toBeDefined();
  expect(screen.queryByRole("button", { name: "Bold" })).toBeNull();
});

test("the checklist checkbox is named from the catalog", () => {
  render(
    <UiProvider messages={ru}>
      <RichTextEditor
        aria-label="Body"
        defaultValue='<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><p>Buy milk</p></li></ul>'
      />
    </UiProvider>
  );

  const checkbox = screen.getByRole("checkbox", {
    name: ru.editor.taskCheckbox({ text: "Buy milk" }),
  });
  expect(ru.editor.taskCheckbox({ text: "Buy milk" })).not.toMatch(/^Done/);
  expect((checkbox as HTMLInputElement).checked).toBe(true);
});
