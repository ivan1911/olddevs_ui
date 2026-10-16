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

// Чанк формул и ленивые `codeBlock`, `table`: Редактор с ними готов в `render`.
// Сам путь Скелета до загрузки сторожит `rich-text-editor-mathematics-lazy.test.tsx`.
beforeAll(loadLazyBuiltins);

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  resetDevWarnings();
});

/**
 * Инструмент `mathematics` (OLDSUI-280, ADR-0070): формулы LaTeX на расширении
 * Mathematics из Tiptap и KaTeX.
 *
 * Через публичный `RichTextEditor` с конкретным `tools`: Меню вставки, Поповер,
 * настоящие `keydown` и щелчки, результат — выходной HTML, Markdown и шаг отмены.
 * Каретка ставится командами движка: jsdom не умеет ввода в `contenteditable`.
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

/** Формула так, как её пишет Редактор. */
const inline = (latex: string) => `<span data-latex="${latex}" data-type="inline-math"></span>`;
const block = (latex: string) => `<div data-latex="${latex}" data-type="block-math"></div>`;

/** Каретка в конец текста `text`. */
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

/** Пункт меню по имени без подписи сочетания. */
function itemNamed(menu: HTMLElement, name: string) {
  const found = Array.from(menu.querySelectorAll<HTMLElement>('[role^="menuitem"]')).find(
    (item) =>
      (item.textContent ?? "").replace(item.querySelector("kbd")?.textContent ?? "", "") === name
  );
  if (!found) throw new Error(`no item "${name}" in the menu`);
  return found;
}

/** Выбрать пункт «+» Панели и дождаться Поповера формулы. */
async function openFromMenu(user: User, item: string, dialog = item) {
  await user.click(screen.getByRole("button", { name: "Insert block" }));
  await user.click(itemNamed(await screen.findByRole("menu", { name: "Insert block" }), item));
  return screen.findByRole("dialog", { name: dialog });
}

/** Вписать LaTeX в поле Поповера: `paste`, а не набор — в наборе скобки это управляющие символы. */
async function enterLatex(user: User, popover: HTMLElement, latex: string) {
  const field = within(popover).getByRole("textbox", { name: "LaTeX" });
  await user.clear(field);
  await user.click(field);
  await user.paste(latex);
  return field;
}

/**
 * Щелчок по формуле. Только `click`: полная последовательность мыши доходит до
 * `elementFromPoint`, которого в jsdom нет, а обработчик формулы слушает именно `click`.
 */
function clickOn(element: HTMLElement) {
  act(() => void fireEvent.click(element));
}

/** Позиция первого узла с таким именем. */
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

// ── Схема, HTML и круг ──────────────────────────────────────────────────────

test("a formula is a node whose HTML holds only the LaTeX source, never the KaTeX markup", () => {
  const html = `<p>a ${inline("x^2")} b</p>${block("\\frac{a}{b}")}<p>end</p>`;
  const { editor } = renderEditor({ defaultValue: html });

  expect(editor.getHTML()).toBe(html);
  // Вид узла рисует KaTeX (HTML и MathML), а в Документ его разметка не попадает.
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

  // Санитайзер не снял ни символа, и второй проход движка отдаёт те же байты.
  expect(sanitized).toBe(saved);
  cleanup();
  const second = renderEditor({ tools, defaultValue: sanitized });
  expect(second.editor.getHTML()).toBe(saved);
  // Исходник в Документе — буквально то, что набрал автор, а не экранированное.
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

test("the text of a formula is its LaTeX: getText, the counter and the selected text", () => {
  const { editor, handle } = renderEditor({
    maxLength: 12,
    defaultValue: `<p>a ${inline("x^2")} b</p>${block("\\pi")}`,
  });

  expect(handle.getText()).toBe("a x^2 b\n\n\\pi");
  // «a x^2 b» — 7, «\pi» — 3: счётчик считает то, что отдаёт `getText`.
  expect(screen.getByText("2 characters left")).toBeTruthy();
  act(() => void editor.commands.selectAll());
  expect(handle.getSelectedText()).toContain("x^2");
});

test("search treats a formula as any inline atom: its LaTeX is not searched, the text around it is", () => {
  const { handle } = renderEditor({ defaultValue: `<p>see ${inline("\\sqrt{2}")} and see</p>` });

  const search = handle.tool("search");
  expect(search?.setQuery("sqrt")).toBe(true);
  expect(search?.next()).toBe(false);
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

// ── Ошибка KaTeX в Документе ────────────────────────────────────────────────

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

// ── Опции ───────────────────────────────────────────────────────────────────

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
    // Из JS без типов: макрос без обратной косой черты и строгость не из списка.
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

test("$…$ and $$…$$ round trip through setMarkdown and getMarkdown", () => {
  const { editor, handle } = renderEditor();
  const markdown = "Euler: $e^{i\\pi}+1=0$ and $x$.\n\n$$\n\\int_0^1 x\\,dx\n$$\n\nLast line.";

  act(() => handle.setMarkdown(markdown));

  expect(editor.getHTML()).toBe(
    `<p>Euler: ${inline("e^{i\\pi}+1=0")} and ${inline("x")}.</p>${block("\\int_0^1 x\\,dx")}<p>Last line.</p>`
  );
  expect(handle.getMarkdown().trim()).toBe(markdown);
  // Круг устойчив: Markdown → Документ → Markdown → Документ.
  const html = editor.getHTML();
  act(() => handle.setMarkdown(handle.getMarkdown()));
  expect(editor.getHTML()).toBe(html);
});

test("money in the text is not a formula: the Pandoc rules for the dollar sign", () => {
  const { editor, handle } = renderEditor();

  act(() => handle.setMarkdown("It costs $5 and $6, or $ 7 and 8 $; also $9$."));

  // `$5 and $` кончается пробелом, `$ 7 and 8 $` — начинается с него; `$9$` — деньги: за закрывающим идёт точка, но внутри цифра — формула по Pandoc.
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

// ── JSON и набор ────────────────────────────────────────────────────────────

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
  // Тот же путь, что у ввода с клавиатуры: правило ввода слушает `handleTextInput`.
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

// ── Меню вставки и Поповер ─────────────────────────────────────────────────

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
  // Пока поля нет — подсказка вместо предпросмотра, вставлять нечего.
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
  // Каретка ушла в абзац за формулой.
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

  // Ошибка — в самом поле: `aria-invalid` и текст, который читает скринридер.
  await waitFor(() => expect(field.getAttribute("aria-invalid")).toBe("true"));
  expect(within(popover).getByText(/^Invalid LaTeX: /)).toBeTruthy();
  const insert = within(popover).getByRole("button", { name: "Insert" });
  expect(insert).toHaveProperty("disabled", true);
  // Enter в поле тоже ничего не вставляет.
  await user.keyboard("{Enter}");
  expect(editor.getHTML()).toBe("<p>One</p>");
  expect(screen.getByRole("dialog", { name: "Formula" })).toBeTruthy();

  // Исправил — ошибка ушла, формулу можно вставить.
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
  // Фокус сразу в поле LaTeX: мышь не нужна.
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

// ── Правка существующей формулы ─────────────────────────────────────────────

test("a click on a formula opens the popover with its LaTeX; Apply updates it in place in one undo step", async () => {
  const user = userEvent.setup();
  const { editor, handle } = renderEditor({
    defaultValue: `<p>a ${inline("x^2")} b ${inline("y")}</p>`,
  });

  clickOn(formula(editor, '[data-type="inline-math"]'));
  const popover = await screen.findByRole("dialog", { name: "Formula" });
  const field = within(popover).getByRole("textbox", { name: "LaTeX" });
  expect((field as HTMLInputElement).value).toBe("x^2");
  // Правка: «Применить» вместо «Вставить» и «Убрать формулу».
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
  // Enter не расщепил абзац.
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

// ── Подписи ru ──────────────────────────────────────────────────────────────

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

// ── Без Инструмента ─────────────────────────────────────────────────────────

test("without the tool a formula from value stays as text and survives a save", () => {
  const html =
    `<p>Euler ${inline("e^{i\\pi}+1=0")} done</p>${block("a&lt;b")}` +
    `<ul><li><p>${inline("\\alpha")}</p></li></ul>`;
  const { editor, handle } = renderEditor({
    tools: ["bold", "bulletList", "insertMenu"],
    defaultValue: html,
  });

  // Инлайн — текстом `$…$`, Блок — абзацем `$$…$$`; LaTeX не потерян и не экранирован дважды.
  expect(editor.getHTML()).toBe(
    "<p>Euler $e^{i\\pi}+1=0$ done</p><p>$$a&lt;b$$</p><ul><li><p>$\\alpha$</p></li></ul>"
  );
  expect(editor.view.dom.querySelector('[data-type="inline-math"]')).toBeNull();
  expect(handle.getText()).toContain("$e^{i\\pi}+1=0$");
  // Тот же Документ снова через движок с Инструментом: текст остаётся текстом, формулой он не становится.
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
  // Пустая формула без исходника — ничего, а не `$$`.
  act(() => handle.setMarkdown(""));
  expect(handle.insertHTML('<span data-type="inline-math" data-latex=" "></span>')).toBe(false);
});

// ── Пресеты ─────────────────────────────────────────────────────────────────

test("the tool is enabled by a plain name in tools, next to a preset", () => {
  const { editor } = renderEditor({
    tools: [...RICH_TEXT_PRESETS.basic, "mathematics"],
    defaultValue: `<p>${inline("x")}</p>`,
  });

  expect(editor.view.dom.querySelector(".katex")).not.toBeNull();
});
