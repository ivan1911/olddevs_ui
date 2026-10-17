// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import type { Editor } from "@tiptap/react";
import createDOMPurify from "dompurify";
import { NodeSelection } from "@tiptap/pm/state";
import { createRef } from "react";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { UiProvider } from "../src/i18n/UiProvider.js";
import { messages as ru } from "../src/locales/ru.js";
import {
  RICH_TEXT_PRESETS,
  RichTextEditor,
  tool,
  type RichTextEditorHandle,
  type RichTextEditorProps,
} from "../src/editor/index.js";
import { sanitizeRichText } from "../src/editor/schema-entry.js";
import { resetDevWarnings } from "../src/lib/dev-warn.js";
import { loadLazyBuiltins } from "./editor-lazy-builtins.js";

// The formula chunk and the lazy `codeBlock` and `table`: the Editor with them is ready in `render`.
// The Skeleton path before the load is covered by `rich-text-editor-mathematics-lazy.test.tsx`.
beforeAll(loadLazyBuiltins);

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  resetDevWarnings();
});

/**
 * The `mathematics` Tool (OLDSUI-280, ADR-0070): LaTeX formulas on the Mathematics extension
 * from Tiptap and KaTeX.
 *
 * Through the public `RichTextEditor` with a concrete `tools`: the insert menu, the popover,
 * real `keydown` events and clicks; the result is the output HTML, Markdown and an undo step.
 * The caret is placed with engine commands: jsdom cannot type into `contenteditable`.
 */
const TOOLS_WITH_MATH = ["bold", "history", "insertMenu", "search", "mathematics"] as const;

function renderEditor(props: Partial<RichTextEditorProps> = {}) {
  const ref = createRef<RichTextEditorHandle>();
  const view = render(
    <RichTextEditor ref={ref} aria-label="Body" tools={TOOLS_WITH_MATH} {...props} />
  );
  const editor = ref.current?.editor;
  if (!editor) throw new Error("the editor was not created inside render()");
  return { ...view, editor, handle: ref.current! };
}

/** A formula as the Editor writes it. */
const inline = (latex: string) => `<span data-latex="${latex}" data-type="inline-math"></span>`;
const block = (latex: string) => `<div data-latex="${latex}" data-type="block-math"></div>`;

/** Moves the caret to the end of the text `text`. */
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

function press(editor: Editor, key: string, modifiers: KeyboardEventInit = {}) {
  const event = new KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true,
    ...modifiers,
  });
  Object.defineProperty(event, "keyCode", { value: key === "Enter" ? 13 : key.charCodeAt(0) });
  act(() => void editor.view.dom.dispatchEvent(event));
  return event.defaultPrevented;
}

type User = ReturnType<typeof userEvent.setup>;

/** Finds a menu item by its name, without the shortcut label. */
function itemNamed(menu: HTMLElement, name: string) {
  const found = Array.from(menu.querySelectorAll<HTMLElement>('[role^="menuitem"]')).find(
    (item) =>
      (item.textContent ?? "").replace(item.querySelector("kbd")?.textContent ?? "", "") === name
  );
  if (!found) throw new Error(`no item "${name}" in the menu`);
  return found;
}

/** Selects the item in the Toolbar's "+" menu and waits for the formula popover. */
async function openFromMenu(user: User, item: string, dialog = item) {
  await user.click(screen.getByRole("button", { name: "Insert block" }));
  await user.click(itemNamed(await screen.findByRole("menu", { name: "Insert block" }), item));
  return screen.findByRole("dialog", { name: dialog });
}

/** Enters LaTeX into the popover field with `paste`, not by typing: typed brackets are control characters. */
async function enterLatex(user: User, popover: HTMLElement, latex: string) {
  const field = within(popover).getByRole("textbox", { name: "LaTeX" });
  await user.clear(field);
  await user.click(field);
  await user.paste(latex);
  return field;
}

/**
 * Clicks a formula. Only `click`: the full mouse sequence reaches `elementFromPoint`, which jsdom
 * does not have, and the formula handler listens for `click` specifically.
 */
function clickOn(element: HTMLElement) {
  act(() => void fireEvent.click(element));
}

/** Position of the first node with this name. */
function positionOf(editor: Editor, name: string): number {
  let found = -1;
  editor.state.doc.descendants((node, pos) => {
    if (found < 0 && node.type.name === name) found = pos;
  });
  if (found < 0) throw new Error(`no ${name} in the document`);
  return found;
}

const formula = (editor: Editor, selector: string) =>
  editor.view.dom.querySelector<HTMLElement>(selector)!;

// ── Schema, HTML and the round trip ──────────────────────────────────────────────────────

test("a formula is a node whose HTML holds only the LaTeX source, never the KaTeX markup", () => {
  const html = `<p>a ${inline("x^2")} b</p>${block("\\frac{a}{b}")}<p>end</p>`;
  const { editor } = renderEditor({ defaultValue: html });

  expect(editor.getHTML()).toBe(html);
  // KaTeX draws the node's view (HTML and MathML), and its markup does not get into the Document.
  expect(editor.view.dom.querySelectorAll(".katex")).toHaveLength(2);
  expect(editor.view.dom.querySelector("annotation")?.textContent).toBe("x^2");
  expect(editor.getHTML()).not.toMatch(/katex|<math|class=/);
});

test("value, engine, HTML, sanitizer and value again lose nothing", () => {
  const purify = createDOMPurify(window);
  const tools = ["bold", "mathematics"] as const;
  const html =
    `<p>Text ${inline("a&lt;b &amp; c&gt;d")} and ${inline("\\text{say &quot;hi&quot;}")} end</p>` +
    block("\\begin{aligned}\nx &amp;= 1 \\\\\ny &amp;&lt; 2\n\\end{aligned}") +
    `<ul><li><p>item ${inline("\\alpha")}</p></li></ul>` +
    `<blockquote><p>${inline("\\beta")}</p></blockquote>`;

  const first = renderEditor({ tools, defaultValue: html });
  const saved = first.editor.getHTML();
  const sanitized = sanitizeRichText(saved, purify, tools);

  // The sanitizer removed no character, and the engine's second pass returns the same bytes.
  expect(sanitized).toBe(saved);
  cleanup();
  const second = renderEditor({ tools, defaultValue: sanitized });
  expect(second.editor.getHTML()).toBe(saved);
  // The source in the Document is literally what the author typed, not an escaped form.
  const attributes = [...second.editor.view.dom.querySelectorAll("[data-latex]")].map((element) =>
    element.getAttribute("data-latex")
  );
  expect(attributes).toEqual([
    "a<b & c>d",
    '\\text{say "hi"}',
    "\\begin{aligned}\nx &= 1 \\\\\ny &< 2\n\\end{aligned}",
    "\\alpha",
    "\\beta",
  ]);
});

test("the Editor writes data-latex that DOMPurify keeps: ]>, -->, --!> and </ get a space", () => {
  const purify = createDOMPurify(window);
  const tools = ["bold", "mathematics"] as const;
  const html = `<p>${inline("\\left[0,1\\right]>x")} ${inline("a-->b")} ${inline("a--!>b")}</p>${block("p</style>q")}`;

  const first = renderEditor({ tools, defaultValue: html });
  const saved = first.editor.getHTML();

  expect(saved).toBe(
    `<p>${inline("\\left[0,1\\right] >x")} ${inline("a-- >b")} ${inline("a--! >b")}</p>${block("p< /style>q")}`
  );
  // The sanitizer leaves already-safe HTML unchanged, and the engine's second pass returns the same bytes.
  const sanitized = sanitizeRichText(saved, purify, tools);
  expect(sanitized).toBe(saved);
  cleanup();
  expect(renderEditor({ tools, defaultValue: sanitized }).editor.getHTML()).toBe(saved);
});

test("a formula inserted by the popover is written with the safe source too", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: "<p>One</p>" });
  caretIn(editor, "One");

  const popover = await openFromMenu(user, "Formula");
  await enterLatex(user, popover, "[0,1]>x");
  await user.click(within(popover).getByRole("button", { name: "Insert" }));

  expect(editor.getHTML()).toContain('data-latex="[0,1] >x"');
});

test("the text of a formula is its LaTeX: getText, the counter and the selected text", () => {
  const { editor, handle } = renderEditor({
    maxLength: 12,
    defaultValue: `<p>a ${inline("x^2")} b</p>${block("\\pi")}`,
  });

  expect(handle.getText()).toBe("a x^2 b\n\n\\pi");
  // "a x^2 b" is 7 characters and "\pi" is 3: the counter counts what `getText` returns.
  expect(screen.getByText("2 characters left")).toBeTruthy();
  act(() => void editor.commands.selectAll());
  expect(handle.getSelectedText()).toContain("x^2");
});

test("search finds the LaTeX of a formula as a whole formula, and the text around it as text", () => {
  const { handle } = renderEditor({ defaultValue: `<p>see ${inline("\\sqrt{2}")} and see</p>` });

  // Details (highlighting, navigation, replace) are in `editor-search-formulas.test.tsx`.
  const search = handle.tool("search");
  expect(search?.setQuery("sqrt")).toBe(true);
  expect(search?.next()).toBe(true);
  expect(search?.setQuery("see")).toBe(true);
  expect(search?.next()).toBe(true);
});

test("a formula without the source or with a hostile one stays a leaf", () => {
  const { editor } = renderEditor({
    defaultValue:
      '<p>a<span data-type="inline-math"></span>b</p>' +
      '<p><span data-type="inline-math" data-latex="x" onclick="steal()"><b>no</b></span></p>',
  });

  expect(editor.getHTML()).not.toMatch(/onclick|<b>/);
  expect(editor.view.dom.querySelectorAll('[data-type="inline-math"]').length).toBeGreaterThan(0);
});

// ── KaTeX error in the Document ────────────────────────────────────────────────

test("a formula KaTeX cannot read stays in the document as source with an error mark", () => {
  const html = `<p>${inline("\\frac{1")}</p>${block("\\badcommand")}`;
  const { editor } = renderEditor({ defaultValue: html });

  expect(editor.getHTML()).toBe(html);
  const bad = formula(editor, '[data-type="inline-math"]');
  expect(bad.classList.contains("inline-math-error")).toBe(true);
  expect(bad.textContent).toBe("\\frac{1");
  expect(formula(editor, '[data-type="block-math"]').classList.contains("block-math-error")).toBe(
    true
  );
});

// ── Options ───────────────────────────────────────────────────────────────────

test("tool('mathematics') macros apply, and a wrong value falls back to the default", () => {
  const macros = { "\\RR": "\\mathbb{R}" };
  const html = `<p>${inline("x \\in \\RR")}</p>`;

  const withMacro = renderEditor({ tools: [tool("mathematics", { macros })], defaultValue: html });
  expect(formula(withMacro.editor, '[data-type="inline-math"]').classList).not.toContain(
    "inline-math-error"
  );
  cleanup();

  const without = renderEditor({ tools: ["mathematics"], defaultValue: html });
  expect(formula(without.editor, '[data-type="inline-math"]').classList).toContain(
    "inline-math-error"
  );
  cleanup();

  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  const wrong = renderEditor({
    // From plain JS without types: a macro without a backslash, and a strictness value not in the list.
    tools: [tool("mathematics", { macros: { RR: "x" }, strict: "loud" as never })],
    defaultValue: html,
  });
  expect(formula(wrong.editor, '[data-type="inline-math"]').classList).toContain(
    "inline-math-error"
  );
  expect(error).toHaveBeenCalledWith(
    expect.stringContaining('tool "mathematics": ignored invalid options: macros, strict')
  );
});

// ── Markdown ────────────────────────────────────────────────────────────────

test("a \\gdef in one formula does not reach the next: the Editor agrees with the View", () => {
  const macros = { "\\RR": "\\mathbb{R}" };
  const html = `<p>${inline("\\gdef\\foo{x}\\foo")}</p><p>${inline("\\foo")}</p>${block("\\foo")}`;
  const { editor } = renderEditor({ tools: [tool("mathematics", { macros })], defaultValue: html });

  const [defining, inlineUser] = [...editor.view.dom.querySelectorAll('[data-type="inline-math"]')];
  expect(defining!.classList.contains("inline-math-error")).toBe(false);
  // The second formula does not know the macro from the first one: `\foo` is an error, as in the View.
  expect(inlineUser!.classList.contains("inline-math-error")).toBe(true);
  expect(formula(editor, '[data-type="block-math"]').classList.contains("block-math-error")).toBe(
    true
  );
  // Macros from `tool("mathematics")` still work.
  act(
    () =>
      void editor.commands.updateInlineMath({
        latex: "\\RR",
        pos: positionOf(editor, "inlineMath"),
      })
  );
  expect(
    editor.view.dom
      .querySelector('[data-type="inline-math"]')!
      .classList.contains("inline-math-error")
  ).toBe(false);
});

test("a \\gdef typed in the popover does not leak into the next preview of the popover", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: "<p>One</p>" });
  caretIn(editor, "One");

  const popover = await openFromMenu(user, "Formula");
  await enterLatex(user, popover, "\\gdef\\foo{x}\\foo");
  expect(
    within(popover).getByRole("group", { name: "Preview" }).querySelector(".katex")
  ).not.toBeNull();
  // The next parse in the same popover starts with clean macros: `\foo` is no longer defined.
  await enterLatex(user, popover, "\\foo");
  expect(within(popover).getByRole("textbox", { name: "LaTeX" }).getAttribute("aria-invalid")).toBe(
    "true"
  );
  expect(within(popover).getByRole("button", { name: "Insert" })).toHaveProperty("disabled", true);
});

test("$…$ and $$…$$ round trip through setMarkdown and getMarkdown", () => {
  const { editor, handle } = renderEditor();
  const markdown = "Euler: $e^{i\\pi}+1=0$ and $x$.\n\n$$\n\\int_0^1 x\\,dx\n$$\n\nLast line.";

  act(() => handle.setMarkdown(markdown));

  expect(editor.getHTML()).toBe(
    `<p>Euler: ${inline("e^{i\\pi}+1=0")} and ${inline("x")}.</p>${block("\\int_0^1 x\\,dx")}<p>Last line.</p>`
  );
  expect(handle.getMarkdown().trim()).toBe(markdown);
  // The round trip is stable: Markdown → Document → Markdown → Document.
  const html = editor.getHTML();
  act(() => handle.setMarkdown(handle.getMarkdown()));
  expect(editor.getHTML()).toBe(html);
});

test("money in the text is not a formula: the Pandoc rules for the dollar sign", () => {
  const { editor, handle } = renderEditor();

  act(() => handle.setMarkdown("It costs $5 and $6, or $ 7 and 8 $; also $9$."));

  // `$5 and $` ends with a space, and `$ 7 and 8 $` starts with one; `$9$` looks like money, but the closing dollar is followed by a period, so Pandoc reads it as a formula.
  expect(editor.getHTML()).toBe(`<p>It costs $5 and $6, or $ 7 and 8 $; also ${inline("9")}.</p>`);
});

test("an escaped dollar sign inside a formula does not end it", () => {
  const { editor, handle } = renderEditor();

  act(() => handle.setMarkdown("Price $\\text{\\$5}$ ok"));

  expect(editor.getHTML()).toBe(`<p>Price ${inline("\\text{\\$5}")} ok</p>`);
  expect(handle.getMarkdown().trim()).toBe("Price $\\text{\\$5}$ ok");
});

test("a block formula needs its own lines, a line with text around it stays text", () => {
  const { editor, handle } = renderEditor();

  act(() => handle.setMarkdown("$$a$$ and more"));

  expect(editor.getHTML()).not.toContain("block-math");
});

// ── JSON and typing ────────────────────────────────────────────────────────────

test("the JSON envelope carries the LaTeX and goes back through the schema", () => {
  const html = `<p>a ${inline("x^2")}</p>${block("\\pi")}`;
  const { handle } = renderEditor({ defaultValue: html });

  const envelope = handle.getJSON();
  expect(JSON.stringify(envelope)).toContain('"inlineMath"');
  cleanup();
  const again = renderEditor({ defaultValue: envelope as never });
  expect(again.editor.getHTML()).toBe(html);
});

test("the typing rules of the extension still work: $$x$$ in a line, $$$x$$$ as a block", () => {
  const { editor } = renderEditor({ defaultValue: "<p></p>" });
  // The same path as keyboard input: the input rule listens to `handleTextInput`.
  const type = (text: string) => {
    for (const char of text) {
      const { from, to } = editor.state.selection;
      const handled = editor.view.someProp("handleTextInput", (handler) =>
        handler(editor.view, from, to, char, () => editor.state.tr.insertText(char, from, to))
      );
      if (!handled) editor.view.dispatch(editor.state.tr.insertText(char, from, to));
    }
  };

  act(() => {
    editor.commands.focus();
    type("a $$x^2$$");
  });
  expect(editor.getHTML()).toBe(`<p>a ${inline("x^2")}</p>`);

  act(() => {
    editor.commands.setContent("<p></p>");
    editor.commands.focus();
    type("$$$\\pi$$$");
  });
  expect(editor.getHTML()).toBe(block("\\pi"));
});

// ── Insert menu and popover ─────────────────────────────────────────────────

test("the insert menu lists the inline and the block formula with their icons", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: "<p>One</p>" });
  caretIn(editor, "One");

  await user.click(screen.getByRole("button", { name: "Insert block" }));
  const menu = await screen.findByRole("menu", { name: "Insert block" });
  const labels = Array.from(menu.querySelectorAll('[role^="menuitem"]')).map((item) =>
    (item.textContent ?? "").trim()
  );

  expect(labels).toEqual(expect.arrayContaining(["Formula", "Block formula"]));
  expect(itemNamed(menu, "Formula").querySelector("svg")).not.toBeNull();
  expect(itemNamed(menu, "Block formula").querySelector("svg")).not.toBeNull();
});

test("the inline formula: the popover previews the LaTeX and inserts it at the caret in one undo step", async () => {
  const user = userEvent.setup();
  const { editor, handle } = renderEditor({ defaultValue: "<p>One</p>" });
  caretIn(editor, "One");

  const popover = await openFromMenu(user, "Formula");
  // While there is no field, a hint is shown instead of the preview, and there is nothing to insert.
  expect(within(popover).getByText("The formula appears here")).toBeTruthy();
  expect(within(popover).getByRole("button", { name: "Insert" })).toHaveProperty("disabled", true);

  await enterLatex(user, popover, "x^2 + y^2");
  const preview = within(popover).getByRole("group", { name: "Preview" });
  expect(preview.querySelector(".katex")).not.toBeNull();
  expect(preview.querySelector("annotation")?.textContent).toBe("x^2 + y^2");

  await user.click(within(popover).getByRole("button", { name: "Insert" }));

  expect(screen.queryByRole("dialog", { name: "Formula" })).toBeNull();
  expect(editor.getHTML()).toBe(`<p>One${inline("x^2 + y^2")}</p>`);
  await waitFor(() => expect(document.activeElement).toBe(editor.view.dom));
  act(() => handle.undo());
  expect(editor.getHTML()).toBe("<p>One</p>");
});

test("the block formula lands after the block with the caret and leaves a paragraph to type in", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: "<p>One</p><p>Two</p>" });
  caretIn(editor, "One");

  const popover = await openFromMenu(user, "Block formula");
  await enterLatex(user, popover, "\\sum_{i=1}^n i");
  await user.click(within(popover).getByRole("button", { name: "Insert" }));

  expect(editor.getHTML()).toBe(`<p>One</p>${block("\\sum_{i=1}^n i")}<p>Two</p>`);
  // The caret moved to the paragraph after the formula.
  expect(editor.state.selection.$from.parent.textContent).toBe("Two");
});

test("the block formula in an empty paragraph replaces it and appends one when it is the last block", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: "<p>One</p><p></p>" });
  act(() => {
    editor.view.focus();
    editor.commands.setTextSelection(editor.state.doc.content.size - 1);
  });

  const popover = await openFromMenu(user, "Block formula");
  await enterLatex(user, popover, "\\pi");
  await user.click(within(popover).getByRole("button", { name: "Insert" }));

  expect(editor.getHTML()).toBe(`<p>One</p>${block("\\pi")}<p></p>`);
});

test("LaTeX KaTeX cannot read shows the error in the field and never reaches the document", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: "<p>One</p>" });
  caretIn(editor, "One");

  const popover = await openFromMenu(user, "Formula");
  const field = await enterLatex(user, popover, "\\frac{1");

  // The error is in the field itself: `aria-invalid` and the text a screen reader reads.
  await waitFor(() => expect(field.getAttribute("aria-invalid")).toBe("true"));
  expect(within(popover).getByText(/^Invalid LaTeX: /)).toBeTruthy();
  const insert = within(popover).getByRole("button", { name: "Insert" });
  expect(insert).toHaveProperty("disabled", true);
  // Enter in the field does not insert anything either.
  await user.keyboard("{Enter}");
  expect(editor.getHTML()).toBe("<p>One</p>");
  expect(screen.getByRole("dialog", { name: "Formula" })).toBeTruthy();

  // Fixed: the error is gone, and the formula can be inserted.
  await enterLatex(user, popover, "\\frac{1}{2}");
  expect(field.getAttribute("aria-invalid")).not.toBe("true");
  await user.keyboard("{Enter}");
  expect(editor.getHTML()).toBe(`<p>One${inline("\\frac{1}{2}")}</p>`);
});

test("Escape closes the popover without touching the document and returns focus", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: "<p>One</p>" });
  caretIn(editor, "One");

  const popover = await openFromMenu(user, "Formula");
  await enterLatex(user, popover, "x");
  await user.keyboard("{Escape}");

  expect(screen.queryByRole("dialog", { name: "Formula" })).toBeNull();
  expect(editor.getHTML()).toBe("<p>One</p>");
  await waitFor(() => expect(document.activeElement).toBe(editor.view.dom));
});

test("from the keyboard alone: / formula Enter, type, Enter", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: "<p>One</p>" });
  caretIn(editor, "One");
  act(() => void editor.commands.insertContent(" /form"));

  press(editor, "Enter");
  const popover = await screen.findByRole("dialog", { name: "Formula" });
  // Focus goes straight to the LaTeX field: no mouse needed.
  await waitFor(() =>
    expect(document.activeElement).toBe(within(popover).getByRole("textbox", { name: "LaTeX" }))
  );
  await user.keyboard("e=mc^2{Enter}");

  expect(editor.getHTML()).toBe(`<p>One ${inline("e=mc^2")}</p>`);
});

test("in the block field Enter breaks the line and Ctrl+Enter applies", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: "<p>One</p>" });
  caretIn(editor, "One");

  const popover = await openFromMenu(user, "Block formula");
  const field = within(popover).getByRole("textbox", { name: "LaTeX" });
  await user.click(field);
  await user.keyboard("a{Enter}b");
  expect((field as HTMLTextAreaElement).value).toBe("a\nb");
  expect(editor.getHTML()).toBe("<p>One</p>");

  await user.keyboard("{Control>}{Enter}{/Control}");
  expect(editor.getHTML()).toBe(`<p>One</p>${block("a\nb")}<p></p>`);
});

// ── Editing an existing formula ─────────────────────────────────────────────

test("a click on a formula opens the popover with its LaTeX; Apply updates it in place in one undo step", async () => {
  const user = userEvent.setup();
  const { editor, handle } = renderEditor({
    defaultValue: `<p>a ${inline("x^2")} b ${inline("y")}</p>`,
  });

  clickOn(formula(editor, '[data-type="inline-math"]'));
  const popover = await screen.findByRole("dialog", { name: "Formula" });
  const field = within(popover).getByRole("textbox", { name: "LaTeX" });
  expect((field as HTMLInputElement).value).toBe("x^2");
  // Editing: "Apply" instead of "Insert", and "Remove formula".
  expect(within(popover).queryByRole("button", { name: "Insert" })).toBeNull();
  expect(within(popover).getByRole("button", { name: "Remove formula" })).toBeTruthy();

  await enterLatex(user, popover, "x^3");
  await user.click(within(popover).getByRole("button", { name: "Apply" }));

  expect(editor.getHTML()).toBe(`<p>a ${inline("x^3")} b ${inline("y")}</p>`);
  act(() => handle.undo());
  expect(editor.getHTML()).toBe(`<p>a ${inline("x^2")} b ${inline("y")}</p>`);
});

test("invalid LaTeX in the edit popover leaves the document as it was", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: `<p>${inline("x")}</p>${block("y")}` });

  clickOn(formula(editor, '[data-type="block-math"]'));
  const popover = await screen.findByRole("dialog", { name: "Block formula" });
  await enterLatex(user, popover, "\\frac{");

  await waitFor(() =>
    expect(within(popover).getByRole("button", { name: "Apply" })).toHaveProperty("disabled", true)
  );
  await user.keyboard("{Control>}{Enter}{/Control}");
  expect(editor.getHTML()).toBe(`<p>${inline("x")}</p>${block("y")}`);
  await user.keyboard("{Escape}");
  expect(editor.getHTML()).toBe(`<p>${inline("x")}</p>${block("y")}`);
});

test("Remove formula deletes it from the document", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({
    defaultValue: `<p>a ${inline("x")} b</p>${block("y")}<p>c</p>`,
  });

  clickOn(formula(editor, '[data-type="block-math"]'));
  const popover = await screen.findByRole("dialog", { name: "Block formula" });
  await user.click(within(popover).getByRole("button", { name: "Remove formula" }));

  expect(editor.getHTML()).toBe(`<p>a ${inline("x")} b</p><p>c</p>`);
});

test("Enter on a formula selected with the keyboard opens its popover", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: `<p>a ${inline("x^2")} b</p>` });
  act(() => {
    editor.view.focus();
    editor.commands.setNodeSelection(positionOf(editor, "inlineMath"));
  });
  expect(editor.state.selection.constructor.name).toBe("NodeSelection");

  expect(press(editor, "Enter")).toBe(true);

  const popover = await screen.findByRole("dialog", { name: "Formula" });
  expect(within(popover).getByRole("textbox", { name: "LaTeX" })).toHaveProperty("value", "x^2");
  await user.keyboard("{Escape}");
  // Enter did not split the paragraph.
  expect(editor.getHTML()).toBe(`<p>a ${inline("x^2")} b</p>`);
});

test("a range that is exactly one formula (Shift+Right from before it) counts as selected for Enter", async () => {
  const { editor } = renderEditor({ defaultValue: `<p>a ${inline("x^2")} b</p>` });
  const pos = positionOf(editor, "inlineMath");
  act(() => {
    editor.view.focus();
    editor.commands.setTextSelection({ from: pos, to: pos + 1 });
  });
  expect(editor.state.selection instanceof NodeSelection).toBe(false);

  expect(press(editor, "Enter")).toBe(true);

  expect(await screen.findByRole("dialog", { name: "Formula" })).toBeTruthy();
  expect(editor.getHTML()).toBe(`<p>a ${inline("x^2")} b</p>`);
});

test("Shift+Right before a formula and Shift+Left after it select exactly the formula", () => {
  const { editor } = renderEditor({ defaultValue: `<p>a ${inline("x^2")} b</p>` });
  const pos = positionOf(editor, "inlineMath");
  const caret = (at: number) =>
    act(() => {
      editor.view.focus();
      editor.commands.setTextSelection(at);
    });

  caret(pos);
  expect(press(editor, "ArrowRight", { shiftKey: true })).toBe(true);
  expect([editor.state.selection.anchor, editor.state.selection.head]).toEqual([pos, pos + 1]);

  caret(pos + 1);
  expect(press(editor, "ArrowLeft", { shiftKey: true })).toBe(true);
  expect([editor.state.selection.anchor, editor.state.selection.head]).toEqual([pos + 1, pos]);

  // Not at a formula: the browser extends the selection as usual.
  caret(pos - 1);
  expect(press(editor, "ArrowLeft", { shiftKey: true })).toBe(false);
});

test("a read-only field shows formulas and opens no popover", async () => {
  const { editor } = renderEditor({ readOnly: true, defaultValue: `<p>${inline("x")}</p>` });

  clickOn(formula(editor, '[data-type="inline-math"]'));
  press(editor, "Enter");
  await new Promise((resolve) => setTimeout(resolve, 20));

  expect(screen.queryByRole("dialog")).toBeNull();
  expect(editor.view.dom.querySelector(".katex")).not.toBeNull();
});

test("the selection menu stays off a selected formula, over text it is there", async () => {
  const BUBBLE = { name: "Selection formatting" } as const;
  const { editor } = renderEditor({
    toolbar: "bubble",
    defaultValue: `<p>Hi ${inline("x")}</p>`,
  });
  act(() => {
    editor.view.focus();
    editor.commands.setTextSelection({ from: 1, to: 3 });
  });
  await screen.findByRole("toolbar", BUBBLE);

  act(() => void editor.commands.setNodeSelection(positionOf(editor, "inlineMath")));

  await waitFor(() => expect(screen.queryByRole("toolbar", BUBBLE)).toBeNull());
});

// ── Labels in ru ──────────────────────────────────────────────────────────────

test("the labels and the popover speak Russian under the ru catalog", async () => {
  const user = userEvent.setup();
  const ref = createRef<RichTextEditorHandle>();
  render(
    <UiProvider locale="ru-RU" messages={ru}>
      <RichTextEditor
        ref={ref}
        aria-label="Body"
        tools={TOOLS_WITH_MATH}
        defaultValue={`<p>One ${inline("\\frac{1")}</p>`}
      />
    </UiProvider>
  );
  const editor = ref.current!.editor!;
  caretIn(editor, "One ");

  await user.click(screen.getByRole("button", { name: ru.editor.insertMenu }));
  const menu = await screen.findByRole("menu", { name: ru.editor.insertMenu });
  await user.click(itemNamed(menu, ru.editor.mathBlock));
  const popover = await screen.findByRole("dialog", { name: ru.editor.mathBlock });

  expect(within(popover).getByRole("textbox", { name: "LaTeX" })).toBeTruthy();
  expect(within(popover).getByRole("group", { name: ru.editor.mathPreview })).toBeTruthy();
  expect(within(popover).getByText(ru.editor.mathEmpty)).toBeTruthy();
  await enterLatex(user, popover, "\\frac{");
  expect(
    within(popover).getByText((text) => text.startsWith(ru.editor.mathInvalid({ detail: "" })))
  ).toBeTruthy();
  expect(within(popover).getByRole("button", { name: ru.editor.mathInsert })).toBeTruthy();
});

// ── Without the Tool ─────────────────────────────────────────────────────────

test("without the tool a formula from value stays as text and survives a save", () => {
  const html =
    `<p>Euler ${inline("e^{i\\pi}+1=0")} done</p>${block("a&lt;b")}` +
    `<ul><li><p>${inline("\\alpha")}</p></li></ul>`;
  const { editor, handle } = renderEditor({
    tools: ["bold", "bulletList", "insertMenu"],
    defaultValue: html,
  });

  // Inline becomes text in `$…$`, and a Block becomes a paragraph in `$$…$$`; the LaTeX is neither lost nor escaped twice.
  expect(editor.getHTML()).toBe(
    "<p>Euler $e^{i\\pi}+1=0$ done</p><p>$$a&lt;b$$</p><ul><li><p>$\\alpha$</p></li></ul>"
  );
  expect(editor.view.dom.querySelector('[data-type="inline-math"]')).toBeNull();
  expect(handle.getText()).toContain("$e^{i\\pi}+1=0$");
  // The same Document again through an engine with the Tool: the text stays text and does not become a formula.
  cleanup();
  const again = renderEditor({ defaultValue: editor.getHTML() });
  expect(again.editor.view.dom.querySelector('[data-type="inline-math"]')).toBeNull();
});

test("without the tool a formula in the JSON envelope becomes text as well", () => {
  const withTool = renderEditor({
    defaultValue: `<p>a ${inline("x^2")}</p>${block("\\pi")}`,
  });
  const envelope = withTool.handle.getJSON();
  cleanup();

  const { editor } = renderEditor({ tools: ["bold"], defaultValue: envelope as never });

  expect(editor.getHTML()).toBe("<p>a $x^2$</p><p>$$\\pi$$</p>");
});

test("without the tool a pasted formula and HTML mode do the same", () => {
  const { editor, handle } = renderEditor({ tools: ["bold"] });

  act(
    () =>
      void editor.view.pasteHTML(`<p>p ${inline("x^2")}</p>`, new Event("paste") as ClipboardEvent)
  );
  expect(editor.getHTML()).toBe("<p>p $x^2$</p>");
  expect(handle.insertHTML(`<p>${inline("y")}</p>`)).toBe(true);
  expect(editor.getHTML()).toContain("$y$");
  // An empty formula with no source inserts nothing, not `$$`.
  act(() => handle.setMarkdown(""));
  expect(handle.insertHTML('<span data-type="inline-math" data-latex=" "></span>')).toBe(false);
});

// ── Presets ─────────────────────────────────────────────────────────────────

test("the tool is enabled by a plain name in tools, next to a preset", () => {
  const { editor } = renderEditor({
    tools: [...RICH_TEXT_PRESETS.basic, "mathematics"],
    defaultValue: `<p>${inline("x")}</p>`,
  });

  expect(editor.view.dom.querySelector(".katex")).not.toBeNull();
});
