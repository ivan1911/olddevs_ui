// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import type { Editor } from "@tiptap/react";
import createDOMPurify from "dompurify";
import { NodeSelection } from "@tiptap/pm/state";
import { createRef } from "react";
import { afterAll, afterEach, beforeAll, expect, test, vi } from "vitest";
import { UiProvider } from "../src/i18n/UiProvider.js";
import { messages as ru } from "../src/locales/ru.js";
import {
  RichTextEditor,
  RichTextView,
  tool,
  type RichTextEditorHandle,
  type RichTextEditorProps,
} from "../src/editor/index.js";
import { sanitizeRichText } from "../src/editor/schema-entry.js";
import { PRESETS, TOOLS } from "../src/editor/core/tools.js";
import { loadLazyBuiltins } from "./editor-lazy-builtins.js";

// Ленивые `codeBlock` и `table` (OLDSUI-111): `full` готов в `render` после загрузки чанков.
beforeAll(loadLazyBuiltins);

/*
  jsdom не считает раскладку: `offsetParent` у него всегда `null`, и Tiptap
  (`isNodeVisible`) принимает всё содержимое Блока за скрытое. Здесь «видим»
  всё, что не лежит внутри `[hidden]`, — так же решает браузер для содержимого
  свёрнутого Блока.
*/
const realOffsetParent = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetParent");
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "offsetParent", {
    configurable: true,
    get(this: HTMLElement) {
      return this.closest("[hidden]") ? null : this.parentElement;
    },
  });
});
afterAll(() => {
  if (realOffsetParent)
    Object.defineProperty(HTMLElement.prototype, "offsetParent", realOffsetParent);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/**
 * Сворачиваемый Блок (OLDSUI-277): Инструмент `details` на расширении Details из
 * Tiptap.
 *
 * Через публичный `RichTextEditor`, `RichTextView` и `sanitizeRichText`, как тесты
 * Обёртки: вставка — Меню вставки и меню ручки, клавиши — настоящие `keydown`,
 * результат — выходной HTML, Markdown и шаг отмены. Каретка ставится командами
 * движка: jsdom не умеет ввода в `contenteditable`.
 */
function renderEditor(props: Partial<RichTextEditorProps> = {}) {
  const ref = createRef<RichTextEditorHandle>();
  const view = render(<RichTextEditor ref={ref} aria-label="Body" {...props} />);
  const editor = ref.current?.editor;
  if (!editor) throw new Error("the editor was not created inside render()");
  return { ...view, editor, handle: ref.current! };
}

/** Блок так, как его пишет Редактор (без `persist`). */
const details = (title: string, ...blocks: string[]) =>
  `<details><summary>${title}</summary><div data-type="detailsContent">${blocks.join("")}</div></details>`;
const openDetails = (title: string, ...blocks: string[]) =>
  `<details open=""><summary>${title}</summary><div data-type="detailsContent">${blocks.join("")}</div></details>`;

const PERSIST = [...TOOLS.filter((name) => name !== "details"), tool("details", { persist: true })];

// ── Схема и HTML ─────────────────────────────────────────────────────────

test("a details block of any content survives a round trip with no other attributes", () => {
  const html = details(
    "Title <strong>bold</strong>",
    "<p>Text</p>",
    "<h2>Heading</h2>",
    "<ul><li><p>Item</p></li></ul>",
    "<blockquote><p>Quote</p></blockquote>",
    '<pre><code class="language-typescript">const a = 1;</code></pre>',
    "<hr>",
    details("Nested", "<p>Deep</p>")
  );
  const { editor } = renderEditor({ defaultValue: `<p>Before</p>${html}<p>After</p>` });
  expect(editor.getHTML()).toBe(`<p>Before</p>${html}<p>After</p>`);
});

test("without persist the open attribute is read as nothing and never written", () => {
  const { editor } = renderEditor({ defaultValue: openDetails("Title", "<p>Body</p>") });
  expect(editor.getHTML()).toBe(details("Title", "<p>Body</p>"));
});

test("with persist the open attribute is read and written", () => {
  const { editor } = renderEditor({
    tools: PERSIST,
    defaultValue: openDetails("Open", "<p>a</p>") + details("Closed", "<p>b</p>"),
  });
  expect(editor.getHTML()).toBe(openDetails("Open", "<p>a</p>") + details("Closed", "<p>b</p>"));
});

test("a value that is not a boolean falls back to the default persist", () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  const { editor } = renderEditor({
    // Из JS без типов: строка вместо булева значения.
    tools: [
      ...TOOLS.filter((name) => name !== "details"),
      tool("details", { persist: "yes" as never }),
    ],
    defaultValue: openDetails("Title", "<p>Body</p>"),
  });
  expect(editor.getHTML()).toBe(details("Title", "<p>Body</p>"));
  expect(error).toHaveBeenCalledWith(
    expect.stringContaining('tool "details": ignored invalid options: persist')
  );
});

test("HTML of GitHub and browsers, without the content wrapper, reads as a details block", () => {
  const { editor } = renderEditor({
    defaultValue:
      "<details open><summary>Title</summary><p>One</p><ul><li>Two</li></ul>Three</details>",
  });
  expect(editor.getHTML()).toBe(
    details("Title", "<p>One</p>", "<ul><li><p>Two</p></li></ul>", "<p>Three</p>")
  );
});

test("a block with no content or no title is completed by the schema", () => {
  const { editor } = renderEditor({
    defaultValue: "<details><summary>Only title</summary></details><details></details>",
  });
  expect(editor.getHTML()).toBe(details("Only title", "<p></p>") + details("", "<p></p>"));
});

test("a stray summary or content wrapper outside a details block is just its text", () => {
  const { editor } = renderEditor({
    defaultValue: '<summary>Alone</summary><div data-type="detailsContent"><p>Loose</p></div>',
  });
  expect(editor.getHTML()).toBe("<p>Alone</p><p>Loose</p>");
});

test("foreign attributes on a details block are dropped", () => {
  const { editor } = renderEditor({
    defaultValue:
      '<details class="x" style="color:red" onclick="x()"><summary id="a">T</summary><p>b</p></details>',
  });
  expect(editor.getHTML()).toBe(details("T", "<p>b</p>"));
});

test("a details block sits in a layout column, a wrapper, a quote and a cell", () => {
  const inner = details("T", "<p>b</p>");
  const html =
    `<div data-block="layout" data-layout="100"><div data-block="column">${inner}</div></div>` +
    `<div data-block="wrapper">${inner}</div>` +
    `<blockquote>${inner}</blockquote>` +
    `<table><tbody><tr><td>${inner}</td></tr></tbody></table>`;
  const { editor } = renderEditor({ defaultValue: html });
  expect(editor.getHTML()).toBe(html);
});

test("a layout or a wrapper inside a details block unfolds into its blocks", () => {
  const { editor } = renderEditor({
    defaultValue: details(
      "T",
      '<div data-block="wrapper"><p>a</p></div>',
      '<div data-block="layout" data-layout="50-50"><div data-block="column"><p>b</p></div><div data-block="column"><p>c</p></div></div>'
    ),
  });
  expect(editor.getHTML()).toBe(details("T", "<p>a</p>", "<p>b</p>", "<p>c</p>"));
});

// ── Без Инструмента и пресеты ────────────────────────────────────────────

test("without the details tool the title becomes a paragraph and the content follows", () => {
  const { editor } = renderEditor({
    defaultValue: `<p>Before</p>${details("Title <strong>b</strong>", "<p>One</p>", "<h2>Two</h2>")}<p>After</p>`,
    tools: TOOLS.filter((name) => name !== "details"),
  });
  expect(editor.getHTML()).toBe(
    "<p>Before</p><p>Title <strong>b</strong></p><p>One</p><h2>Two</h2><p>After</p>"
  );
});

test("the full preset has the details tool and basic has not", () => {
  expect(PRESETS.full).toContain("details");
  expect(PRESETS.basic).not.toContain("details");
  const { editor } = renderEditor({ preset: "basic", defaultValue: details("T", "<p>b</p>") });
  expect(editor.getHTML()).toBe("<p>T</p><p>b</p>");
  cleanup();
  const full = renderEditor({ defaultValue: details("T", "<p>b</p>") });
  expect(full.editor.getHTML()).toBe(details("T", "<p>b</p>"));
});

test("an unknown option of the details tool is ignored", () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  const { editor } = renderEditor({
    tools: [tool("details", { open: true } as never)],
    defaultValue: openDetails("T", "<p>b</p>"),
  });
  expect(editor.getHTML()).toBe(details("T", "<p>b</p>"));
  expect(error).toHaveBeenCalled();
});

// ── Санитайзер ───────────────────────────────────────────────────────────

test("a value goes through the engine, the sanitizer and back without loss", () => {
  const purify = createDOMPurify(window);
  for (const tools of [undefined, PERSIST]) {
    const first = renderEditor({
      tools,
      defaultValue:
        openDetails(
          "A <em>b</em>",
          "<p>x</p>",
          "<ul><li><p>y</p></li></ul>",
          details("In", "<p>z</p>")
        ) + details("Closed", "<p>w</p>"),
    });
    const saved = first.editor.getHTML();
    const clean = sanitizeRichText(saved, purify, tools);
    expect(clean).toBe(saved);
    cleanup();
    const second = renderEditor({ tools, defaultValue: clean });
    expect(second.editor.getHTML()).toBe(saved);
  }
});

test("sanitizeRichText keeps the details markup only in the shape the schema produces", () => {
  const purify = createDOMPurify(window);
  for (const [input, output] of [
    // Каноническая форма и пустой `open`.
    [openDetails("T", "<p>a</p>"), openDetails("T", "<p>a</p>")],
    // Чужие атрибуты и обработчики снимаются.
    [
      '<details class="c" style="color:red" onclick="x()"><summary id="s" onclick="x()">T</summary><div data-type="detailsContent" class="k"><p>a</p></div></details>',
      details("T", "<p>a</p>"),
    ],
    // `open` с чужим значением не проходит: пишется только пустой.
    [
      '<details open="open"><summary>T</summary><p>a</p></details>',
      "<details><summary>T</summary><p>a</p></details>",
    ],
    // `open` — только на `details`.
    ['<p open="">a</p>', "<p>a</p>"],
    // `summary` вне `details` и обёртка содержимого вне него теряют тег.
    ["<summary>T</summary><p>a</p>", "T<p>a</p>"],
    ['<div data-type="detailsContent"><p>a</p></div>', "<p>a</p>"],
    [
      '<blockquote><div data-type="detailsContent"><p>a</p></div></blockquote>',
      "<blockquote><p>a</p></blockquote>",
    ],
    // `data-type` обёртки — только это значение и только прямо в `details`.
    [
      `<details><summary>T</summary><div data-type="other"><p>a</p></div></details>`,
      "<details><summary>T</summary><p>a</p></details>",
    ],
    [
      '<details><summary>T</summary><blockquote><div data-type="detailsContent"><p>a</p></div></blockquote></details>',
      "<details><summary>T</summary><blockquote><p>a</p></blockquote></details>",
    ],
    // `div` без метки — не обёртка содержимого.
    [
      "<details><summary>T</summary><div><p>a</p></div></details>",
      "<details><summary>T</summary><p>a</p></details>",
    ],
    // Опасное в заголовке и содержимом срезается, как везде.
    [
      '<details><summary>T<img src="x" onerror="x()"><script>x()</script></summary><iframe src="https://example.com"></iframe><p>a</p></details>',
      "<details><summary>T</summary><p>a</p></details>",
    ],
    // `data-type` вне Блока остаётся только у чек-листа.
    ['<div data-type="taskList"><p>a</p></div>', "<p>a</p>"],
  ] as [string, string][]) {
    expect(sanitizeRichText(input, purify), input).toBe(output);
  }
});

test("the bare sanitize config opens only the details tags, never iframe", async () => {
  const { richTextSanitizeConfig } = await import("../src/editor/schema-entry.js");
  const config = richTextSanitizeConfig();
  expect(config.ALLOWED_TAGS).toEqual(expect.arrayContaining(["details", "summary"]));
  expect(config.ALLOWED_TAGS).not.toContain("iframe");
  expect(config.ALLOWED_ATTR).toEqual(expect.arrayContaining(["open", "data-type"]));
});

// ── Markdown ─────────────────────────────────────────────────────────────

test("getMarkdown writes a details block as raw HTML with Markdown inside", () => {
  const { handle } = renderEditor({
    defaultValue:
      "<p>Intro</p>" +
      details("Title <strong>b</strong>", "<p>One</p>", "<ul><li><p>Two</p></li></ul>") +
      "<p>Outro</p>",
  });
  expect(handle.getMarkdown()).toBe(
    "Intro\n\n<details>\n<summary>Title **b**</summary>\n\nOne\n\n- Two\n\n</details>\n\nOutro"
  );
});

test("a details block round-trips through Markdown with nesting, code and lists", () => {
  const html =
    details(
      "Title",
      "<p>One <em>two</em></p>",
      '<pre><code class="language-typescript">const a = 1;</code></pre>',
      details("Nested", "<ol><li><p>deep</p></li></ol>"),
      "<blockquote><p>Quote</p></blockquote>"
    ) + "<p>After</p>";
  const first = renderEditor({ defaultValue: html });
  const markdown = first.handle.getMarkdown();
  cleanup();
  const second = renderEditor();
  act(() => second.handle.setMarkdown(markdown));
  expect(second.editor.getHTML()).toBe(html);
  expect(second.handle.getMarkdown()).toBe(markdown);
});

test("persist writes open into Markdown and reads it back", () => {
  const html = openDetails("Open", "<p>a</p>") + details("Closed", "<p>b</p>");
  const first = renderEditor({ tools: PERSIST, defaultValue: html });
  const markdown = first.handle.getMarkdown();
  expect(markdown).toBe(
    "<details open>\n<summary>Open</summary>\n\na\n\n</details>\n\n<details>\n<summary>Closed</summary>\n\nb\n\n</details>"
  );
  cleanup();
  const second = renderEditor({ tools: PERSIST });
  act(() => second.handle.setMarkdown(markdown));
  expect(second.editor.getHTML()).toBe(html);
});

test("without persist an open tag in Markdown gives a closed block", () => {
  const { editor, handle } = renderEditor();
  act(() => handle.setMarkdown("<details open>\n<summary>T</summary>\n\nBody\n\n</details>"));
  expect(editor.getHTML()).toBe(details("T", "<p>Body</p>"));
});

test("the GitHub form of the block reads from Markdown, one-line form too", () => {
  const { editor, handle } = renderEditor();
  act(() =>
    handle.setMarkdown(
      "<details>\n<summary>Spoiler</summary>\n\n**Hidden** text\n\n```\ncode with </details> inside\n```\n\n</details>\n\n" +
        "<details><summary>One line</summary>content</details>\n\ntail"
    )
  );
  expect(editor.getHTML()).toBe(
    details(
      "Spoiler",
      "<p><strong>Hidden</strong> text</p>",
      "<pre><code>code with &lt;/details&gt; inside</code></pre>"
    ) +
      details("One line", "<p>content</p>") +
      "<p>tail</p>"
  );
});

test("an unclosed details tag in Markdown is just text, not a lost document", () => {
  const { editor, handle } = renderEditor();
  act(() => handle.setMarkdown("<details>\n<summary>T</summary>\n\nBody"));
  expect(editor.getText()).toContain("Body");
});

test("a less-than sign in a title survives Markdown", () => {
  const first = renderEditor({ defaultValue: details("a &lt; b &lt;/summary&gt; c", "<p>x</p>") });
  const markdown = first.handle.getMarkdown();
  expect(markdown).toContain("<summary>a &lt; b &lt;/summary&gt; c</summary>");
  cleanup();
  const second = renderEditor();
  act(() => second.handle.setMarkdown(markdown));
  expect(second.editor.getHTML()).toBe(details("a &lt; b &lt;/summary&gt; c", "<p>x</p>"));
});

test("without the details tool Markdown with a details block unfolds into blocks", () => {
  const { editor, handle } = renderEditor({ tools: TOOLS.filter((name) => name !== "details") });
  act(() => handle.setMarkdown("<details>\n<summary>Title</summary>\n\nBody\n\n</details>"));
  const html = editor.getHTML();
  expect(html).toContain("<p>Title</p><p>Body</p>");
  expect(html).not.toContain("details");
});

// ── Просмотр ─────────────────────────────────────────────────────────────

test("RichTextView shows the block as native details and summary, closed unless open is saved", () => {
  const { container } = render(
    <RichTextView html={details("Closed", "<p>a</p>") + openDetails("Open", "<p>b</p>")} />
  );
  const blocks = container.querySelectorAll("details");
  expect(blocks).toHaveLength(2);
  expect(blocks[0]!.hasAttribute("open")).toBe(false);
  expect(blocks[1]!.hasAttribute("open")).toBe(true);
  expect(blocks[0]!.querySelector(":scope > summary")?.textContent).toBe("Closed");
  expect(blocks[0]!.querySelector(':scope > div[data-type="detailsContent"]')?.textContent).toBe(
    "a"
  );
  // Без движка и без роли: родной элемент отдаёт скринридеру сам браузер.
  expect(container.querySelector("button")).toBeNull();
  expect(blocks[0]!.getAttribute("role")).toBeNull();
});

// ── Вставка и набор ──────────────────────────────────────────────────────

function focusField() {
  act(() => screen.getByRole("textbox", { name: "Body" }).focus());
}

/** Каретка — в конец текста `text` (или в его начало). */
function caretIn(editor: Editor, text: string, at: "end" | "start" = "end") {
  let found = -1;
  editor.state.doc.descendants((node, pos) => {
    if (found < 0 && node.isText && node.text === text) {
      found = at === "end" ? pos + node.nodeSize : pos;
    }
  });
  if (found < 0) throw new Error(`no text "${text}" in the document`);
  act(() => void editor.commands.setTextSelection(found));
}

function type(editor: Editor, text: string) {
  act(() => void editor.commands.insertContent(text));
}

/** `keydown` на документе; `true` — Редактор отпустил клавишу браузеру. */
function press(editor: Editor, key: string, init: KeyboardEventInit = {}) {
  const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init });
  act(() => void editor.view.dom.dispatchEvent(event));
  return !event.defaultPrevented;
}

/** Раскрыть все закрытые Блоки щелчком по кнопке — так, как это делает автор. */
function openAll() {
  for (const button of screen.getAllByRole("button", { name: /^Details:/ })) {
    if (button.getAttribute("aria-expanded") === "false") act(() => button.click());
  }
}

const nodeName = (editor: Editor) => editor.state.selection.$from.parent.type.name;
const here = (editor: Editor) => editor.state.selection.$from.parent.textContent;
const blockDom = (editor: Editor) =>
  editor.view.dom.querySelector<HTMLElement>('div[data-type="details"]')!;

test("the Details item of the insert menu adds an empty block below, caret in the title, block open", async () => {
  const { editor } = renderEditor({ defaultValue: "<p>Intro</p>" });
  focusField();
  caretIn(editor, "Intro");

  type(editor, " /collapsible");
  press(editor, "Enter");

  expect(editor.getHTML()).toBe("<p>Intro </p>" + details("", "<p></p>"));
  expect(nodeName(editor)).toBe("detailsSummary");
  // Открытость без `persist` живёт в представлении: после вставки Блок раскрыт.
  await waitFor(() => expect(blockDom(editor).classList.contains("is-open")).toBe(true));
  expect(
    blockDom(editor).querySelector('div[data-type="detailsContent"]')?.hasAttribute("hidden")
  ).toBe(false);

  type(editor, "Title");
  expect(editor.getHTML()).toBe("<p>Intro </p>" + details("Title", "<p></p>"));
});

test("the item is found by its English words and aliases", () => {
  const { editor } = renderEditor();
  focusField();
  for (const word of ["details", "toggle", "accordion", "spoiler"]) {
    type(editor, `/${word}`);
    expect(screen.getByRole("option", { name: /Collapsible block/ })).toBeTruthy();
    act(() => void editor.commands.clearContent());
  }
});

test("with persist the inserted block is open in the document", () => {
  const { editor } = renderEditor({ tools: PERSIST, defaultValue: "<p>Intro</p>" });
  focusField();
  caretIn(editor, "Intro");
  type(editor, " /collapsible");
  press(editor, "Enter");
  expect(editor.getHTML()).toBe("<p>Intro </p>" + openDetails("", "<p></p>"));
});

test("the Details item of the toolbar insert menu is one undo step", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: "<p>Intro</p><p>Outro</p>" });
  caretIn(editor, "Intro", "start");

  await user.click(screen.getByRole("button", { name: "Insert block" }));
  await user.click(screen.getByRole("menuitem", { name: "Collapsible block" }));
  expect(editor.getHTML()).toBe("<p>Intro</p>" + details("", "<p></p>") + "<p>Outro</p>");

  act(() => void editor.commands.undo());
  expect(editor.getHTML()).toBe("<p>Intro</p><p>Outro</p>");
});

test("an empty paragraph is replaced by the block", () => {
  const { editor } = renderEditor({ defaultValue: "<p>Intro</p><p></p>" });
  focusField();
  act(() => void editor.commands.setTextSelection(editor.state.doc.content.size - 1));
  type(editor, "/collapsible");
  press(editor, "Enter");
  expect(editor.getHTML()).toBe("<p>Intro</p>" + details("", "<p></p>"));
});

test("from a list or a quote the block goes below the whole block, from a wrapper inside it", () => {
  const { editor } = renderEditor({
    defaultValue:
      "<ul><li><p>Item</p></li></ul>" +
      '<div data-block="wrapper"><p>Wrapped</p></div>' +
      "<blockquote><p>Quoted</p></blockquote>",
  });
  focusField();

  caretIn(editor, "Item");
  type(editor, " /collapsible");
  press(editor, "Enter");
  expect(
    editor.getHTML().startsWith("<ul><li><p>Item </p></li></ul>" + details("", "<p></p>"))
  ).toBe(true);

  caretIn(editor, "Wrapped");
  type(editor, " /collapsible");
  press(editor, "Enter");
  expect(editor.getHTML()).toContain(
    '<div data-block="wrapper"><p>Wrapped </p>' + details("", "<p></p>") + "</div>"
  );

  caretIn(editor, "Quoted");
  type(editor, " /collapsible");
  press(editor, "Enter");
  // Цитата — не контейнер Блоков: новый Блок встаёт под ней целиком, как Разделитель.
  expect(editor.getHTML()).toContain(
    "<blockquote><p>Quoted </p></blockquote>" + details("", "<p></p>")
  );
});

test("from a title of another block the new one goes below it, not into it", () => {
  const { editor } = renderEditor({ defaultValue: details("Outer", "<p>Body</p>") });
  focusField();
  caretIn(editor, "Outer");
  type(editor, " /collapsible");
  press(editor, "Enter");
  expect(editor.getHTML()).toBe(details("Outer ", "<p>Body</p>") + details("", "<p></p>"));
});

test("the insert menu has no Details without the tool", () => {
  const { editor } = renderEditor({ tools: TOOLS.filter((name) => name !== "details") });
  focusField();
  type(editor, "/collapsible");
  expect(screen.queryByRole("option", { name: /Collapsible/ })).toBeNull();
});

test("a block is filled like a document: title first, then lines and a list in the content", async () => {
  const { editor } = renderEditor({ defaultValue: "<p>Intro</p>" });
  focusField();
  caretIn(editor, "Intro");
  type(editor, " /collapsible");
  press(editor, "Enter");
  await waitFor(() => expect(blockDom(editor).classList.contains("is-open")).toBe(true));

  type(editor, "Heading");
  // Блок раскрыт: Enter в заголовке уходит в содержимое.
  press(editor, "Enter");
  expect(nodeName(editor)).toBe("paragraph");
  expect(editor.state.selection.$from.node(-1).type.name).toBe("detailsContent");
  type(editor, "Text");
  press(editor, "Enter");
  act(() => void editor.chain().focus().toggleBulletList().run());
  type(editor, "Item");

  const html = editor.getHTML();
  // Enter из заголовка встал в пустой абзац содержимого, а не добавил второй.
  expect(html).not.toContain("<p></p>");
  expect(html).toContain("<summary>Heading</summary>");
  expect(html).toContain("<p>Text</p><ul><li><p>Item</p></li></ul>");
  // Всё это — в содержимом Блока, а не рядом с ним.
  expect(html.indexOf('<div data-type="detailsContent">')).toBeLessThan(
    html.indexOf("<p>Text</p>")
  );
  expect(html.indexOf("</details>")).toBeGreaterThan(html.indexOf("<li>"));
});

test("other blocks from the insert menu stay inside the content: a divider and a code block", () => {
  const { editor } = renderEditor({ defaultValue: openDetails("Title", "<p>One</p>") });
  openAll();
  focusField();
  caretIn(editor, "One");

  type(editor, " /divider");
  press(editor, "Enter");
  expect(editor.getHTML()).toBe(details("Title", "<p>One </p>", "<hr>", "<p></p>"));

  type(editor, "/code");
  press(editor, "Enter");
  const html = editor.getHTML();
  expect(html).toContain("<pre><code></code></pre>");
  expect(html.indexOf("<pre>")).toBeLessThan(html.indexOf("</details>"));
  expect(editor.state.doc.childCount).toBe(1);
});

// ── Раскрытие ────────────────────────────────────────────────────────────

test("the toggle button is named by the title, expands and collapses the content", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: details("Title", "<p>Body</p>") });
  const button = screen.getByRole("button", { name: "Details: Title" });
  const content = () =>
    editor.view.dom.querySelector<HTMLElement>('div[data-type="detailsContent"]')!;

  // Закрыт: содержимое спрятано, кнопка это говорит.
  expect(button.getAttribute("aria-expanded")).toBe("false");
  expect(content().hasAttribute("hidden")).toBe(true);

  await user.click(button);
  expect(button.getAttribute("aria-expanded")).toBe("true");
  expect(content().hasAttribute("hidden")).toBe(false);
  expect(blockDom(editor).classList.contains("is-open")).toBe(true);

  await user.click(button);
  expect(button.getAttribute("aria-expanded")).toBe("false");
  expect(content().hasAttribute("hidden")).toBe(true);
});

test("without persist toggling leaves the document and the undo history alone", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: details("Title", "<p>Body</p>") });
  const before = editor.getHTML();
  await user.click(screen.getByRole("button", { name: "Details: Title" }));
  expect(editor.getHTML()).toBe(before);
  expect(editor.can().undo()).toBe(false);
});

test("with persist toggling writes open into the document, undo takes it back", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({
    tools: PERSIST,
    defaultValue: details("Title", "<p>Body</p>"),
  });
  const button = screen.getByRole("button", { name: "Details: Title" });

  await user.click(button);
  expect(editor.getHTML()).toBe(openDetails("Title", "<p>Body</p>"));
  await user.click(button);
  expect(editor.getHTML()).toBe(details("Title", "<p>Body</p>"));
});

test("a read-only editor still opens and closes the block", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({
    readOnly: true,
    defaultValue: details("Title", "<p>Body</p>"),
  });
  const button = screen.getByRole("button", { name: "Details: Title" });
  await user.click(button);
  expect(button.getAttribute("aria-expanded")).toBe("true");
  expect(editor.getHTML()).toBe(details("Title", "<p>Body</p>"));
});

test("the toggle button name follows the title and the locale", () => {
  const { editor } = renderEditor({ defaultValue: details("Title", "<p>Body</p>") });
  caretIn(editor, "Title");
  type(editor, " two");
  expect(screen.getByRole("button", { name: "Details: Title two" })).toBeTruthy();
  cleanup();

  const ref = createRef<RichTextEditorHandle>();
  render(
    <UiProvider locale="ru-RU" messages={ru}>
      <RichTextEditor
        ref={ref}
        aria-label="Body"
        defaultValue={details("Title", "<p>a</p>") + details("", "<p>b</p>")}
      />
    </UiProvider>
  );
  expect(
    screen.getByRole("button", { name: ru.editor.detailsToggle({ text: "Title" }) })
  ).toBeTruthy();
  expect(screen.getByRole("button", { name: ru.editor.detailsToggle({ text: "" }) })).toBeTruthy();
});

// ── Клавиатура ───────────────────────────────────────────────────────────

test("the toggle button is reachable by Tab and works with Enter and Space", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({
    defaultValue: details("First", "<p>a</p>") + details("Second", "<p>b</p>"),
  });
  const first = screen.getByRole("button", { name: "Details: First" });
  const second = screen.getByRole("button", { name: "Details: Second" });
  // Не `tabindex="-1"`: кнопка в порядке обхода Документа.
  expect(first.tabIndex).toBe(0);

  first.focus();
  await user.keyboard("{Enter}");
  expect(first.getAttribute("aria-expanded")).toBe("true");
  await user.keyboard(" ");
  expect(first.getAttribute("aria-expanded")).toBe("false");

  second.focus();
  await user.keyboard(" ");
  expect(second.getAttribute("aria-expanded")).toBe("true");
  expect(editor.getHTML()).toBe(details("First", "<p>a</p>") + details("Second", "<p>b</p>"));
});

test("Tab in the title and in the content is left to the browser", () => {
  const { editor } = renderEditor({ defaultValue: openDetails("Title", "<p>Body</p>") });
  openAll();
  focusField();
  caretIn(editor, "Title");
  expect(press(editor, "Tab")).toBe(true);
  caretIn(editor, "Body");
  expect(press(editor, "Tab")).toBe(true);
  expect(press(editor, "Tab", { shiftKey: true })).toBe(true);
});

test("Enter in the title of an open block moves the caret into the content", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: details("Title", "<p>Body</p>") });
  await user.click(screen.getByRole("button", { name: "Details: Title" }));
  focusField();
  caretIn(editor, "Title");

  press(editor, "Enter");
  expect(editor.getHTML()).toBe(details("Title", "<p></p>", "<p>Body</p>"));
  expect(nodeName(editor)).toBe("paragraph");
  expect(editor.state.selection.$from.node(-1).type.name).toBe("detailsContent");
});

test("Enter in the title of a closed block adds a paragraph below the block", () => {
  const { editor } = renderEditor({ defaultValue: details("Title", "<p>Body</p>") });
  focusField();
  caretIn(editor, "Title");
  press(editor, "Enter");
  expect(editor.getHTML()).toBe(details("Title", "<p>Body</p>") + "<p></p>");
});

test("Backspace at the start of the title unwraps the block into paragraphs", () => {
  const { editor } = renderEditor({
    defaultValue: `<p>Above</p>${details("Title", "<p>a</p>", "<p>b</p>")}`,
  });
  focusField();
  caretIn(editor, "Title", "start");

  expect(press(editor, "Backspace")).toBe(false);
  expect(editor.getHTML()).toBe("<p>Above</p><p>Title</p><p>a</p><p>b</p>");
  expect(here(editor)).toBe("Title");
});

test("Backspace in the title deletes one character, an emoji whole", () => {
  const { editor } = renderEditor({ defaultValue: details("ab\u{1F600}", "<p>x</p>") });
  focusField();
  caretIn(editor, "ab\u{1F600}");

  press(editor, "Backspace");
  expect(editor.getHTML()).toBe(details("ab", "<p>x</p>"));
  press(editor, "Backspace");
  expect(editor.getHTML()).toBe(details("a", "<p>x</p>"));
});

test("Backspace at the start of the first block of the content keeps the text inside", () => {
  const html = details("Title", "<p>First</p>");
  const { editor } = renderEditor({ defaultValue: `<p>Above</p>${html}` });
  openAll();
  focusField();
  caretIn(editor, "First", "start");
  press(editor, "Backspace");
  expect(editor.getText()).toContain("First");
  expect(editor.getHTML()).toContain("<summary>Title</summary>");
});

test("Enter on the empty last line of the content leaves the block", () => {
  const { editor } = renderEditor({ defaultValue: openDetails("Title", "<p>Body</p>", "<p></p>") });
  openAll();
  focusField();
  act(() => void editor.commands.setTextSelection(editor.state.doc.content.size - 3));
  expect(here(editor)).toBe("");

  press(editor, "Enter");
  expect(editor.getHTML()).toBe(details("Title", "<p>Body</p>") + "<p></p>");
  expect(editor.state.selection.$from.parent.type.name).toBe("paragraph");
  expect(editor.state.selection.$from.depth).toBe(1);
});

test("moving and duplicating a block inside the content stay inside it", () => {
  const { editor } = renderEditor({
    defaultValue: `<p>Above</p>${details("Title", "<p>One</p>", "<p>Two</p>")}`,
  });
  openAll();
  focusField();
  caretIn(editor, "Two");

  press(editor, "ArrowUp", { altKey: true, shiftKey: true });
  expect(editor.getHTML()).toBe(`<p>Above</p>${details("Title", "<p>Two</p>", "<p>One</p>")}`);

  press(editor, "ArrowUp", { altKey: true, shiftKey: true });
  expect(editor.getHTML()).toBe(`<p>Above</p>${details("Title", "<p>Two</p>", "<p>One</p>")}`);
});

// ── Ручка Блока ──────────────────────────────────────────────────────────

const HANDLE = "Block actions";

function focusAt(editor: Editor, text: string) {
  caretIn(editor, text);
  act(() => editor.view.focus());
}

async function openHandleMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: HANDLE }));
  return screen.findByRole("menu", { name: HANDLE });
}

async function openSubmenu(
  user: ReturnType<typeof userEvent.setup>,
  menu: HTMLElement,
  name: string
) {
  await user.click(within(menu).getByRole("menuitem", { name }));
  return screen.findByRole("menu", { name });
}

test("Add › Collapsible block puts an empty block below the block, one undo step", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: "<p>One</p><p>Two</p>" });
  focusAt(editor, "One");

  const add = await openSubmenu(user, await openHandleMenu(user), "Add");
  await user.click(within(add).getByRole("menuitem", { name: "Collapsible block" }));
  expect(editor.getHTML()).toBe("<p>One</p>" + details("", "<p></p>") + "<p>Two</p>");

  act(() => void editor.commands.undo());
  expect(editor.getHTML()).toBe("<p>One</p><p>Two</p>");
});

test("a block in the content has its own handle: Add puts a block below it inside the content", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: details("Title", "<p>One</p>", "<p>Two</p>") });
  openAll();
  focusAt(editor, "One");

  const add = await openSubmenu(user, await openHandleMenu(user), "Add");
  await user.click(within(add).getByRole("menuitem", { name: "Divider" }));
  expect(editor.getHTML()).toBe(details("Title", "<p>One</p>", "<hr>", "<p>Two</p>"));
});

test("the handle of the title is the handle of the whole block: it moves, duplicates and deletes it", async () => {
  const user = userEvent.setup();
  const box = details("Title", "<p>One</p>");
  const { editor } = renderEditor({ defaultValue: `<p>Above</p>${box}<p>Below</p>` });
  focusAt(editor, "Title");

  await user.click(within(await openHandleMenu(user)).getByRole("menuitem", { name: /Move down/ }));
  expect(editor.getHTML()).toBe(`<p>Above</p><p>Below</p>${box}`);

  focusAt(editor, "Title");
  await user.click(within(await openHandleMenu(user)).getByRole("menuitem", { name: /Duplicate/ }));
  expect(editor.getHTML()).toBe(`<p>Above</p><p>Below</p>${box}${box}`);

  focusAt(editor, "Title");
  await user.click(within(await openHandleMenu(user)).getByRole("menuitem", { name: "Delete" }));
  expect(editor.getHTML()).toBe(`<p>Above</p><p>Below</p>${box}`);
});

test("Remove collapsing from the handle of the title unfolds the block, one undo step", async () => {
  const user = userEvent.setup();
  const html = `<p>Above</p>${details("Title <strong>b</strong>", "<p>One</p>", "<h2>Two</h2>")}<p>Below</p>`;
  const { editor } = renderEditor({ defaultValue: html });
  focusAt(editor, "Title ");

  await user.click(
    within(await openHandleMenu(user)).getByRole("menuitem", { name: "Remove collapsing" })
  );
  expect(editor.getHTML()).toBe(
    "<p>Above</p><p>Title <strong>b</strong></p><p>One</p><h2>Two</h2><p>Below</p>"
  );
  act(() => void editor.commands.undo());
  expect(editor.getHTML()).toBe(html);
});

test("Remove collapsing from the handle of a block in the content keeps the caret in its text", async () => {
  const user = userEvent.setup();
  const html = details("Title", "<p>One</p>", "<h2>Two</h2>");
  const { editor } = renderEditor({ defaultValue: html });
  openAll();
  focusAt(editor, "Two");

  await user.click(
    within(await openHandleMenu(user)).getByRole("menuitem", { name: "Remove collapsing" })
  );
  expect(editor.getHTML()).toBe("<p>Title</p><p>One</p><h2>Two</h2>");
  expect(here(editor)).toBe("Two");
  expect(editor.state.selection.$from.parentOffset).toBe(3);
});

test("the handle of a block outside a details block has no Remove collapsing", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: `<p>Plain</p>${details("T", "<p>One</p>")}` });
  focusAt(editor, "Plain");
  expect(
    within(await openHandleMenu(user)).queryByRole("menuitem", { name: "Remove collapsing" })
  ).toBeNull();
});

test("Remove collapsing stands in the section of tool actions right before Delete", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: details("T", "<p>One</p>") });
  focusAt(editor, "One");
  const items = within(await openHandleMenu(user)).getAllByRole("menuitem");
  expect(items.slice(-2).map((item) => item.textContent)).toEqual(["Remove collapsing", "Delete"]);
});

test("a details block has no Wrapper-style tone submenu", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: details("T", "<p>One</p>") });
  focusAt(editor, "One");
  expect(within(await openHandleMenu(user)).queryByRole("menuitem", { name: /Tone/ })).toBeNull();
});

// ── Вставка из буфера ────────────────────────────────────────────────────

function paste(editor: Editor, html: string) {
  act(() => void editor.view.pasteHTML(html, new Event("paste") as ClipboardEvent));
}

test("pasted details HTML becomes a details block", () => {
  const { editor } = renderEditor({ defaultValue: "<p>Intro</p>" });
  caretIn(editor, "Intro");
  paste(editor, "<details><summary>T</summary><p>a</p></details>");
  expect(editor.getHTML()).toBe("<p>Intro</p>" + details("T", "<p>a</p>"));
});

test("pasted details HTML unfolds without the tool", () => {
  const { editor } = renderEditor({
    defaultValue: "<p>Intro</p>",
    tools: TOOLS.filter((name) => name !== "details"),
  });
  caretIn(editor, "Intro");
  paste(editor, "<details><summary>T</summary><p>a</p></details>");
  expect(editor.getHTML()).toBe("<p>IntroT</p><p>a</p>");
});

test("a whole block copied inside the editor and pasted keeps being a block", () => {
  const box = details("T", "<p>a</p>");
  const { editor } = renderEditor({ defaultValue: `${box}<p>Tail</p>` });
  const slice = NodeSelection.create(editor.state.doc, 0).content();
  const { dom } = editor.view.serializeForClipboard(slice);
  caretIn(editor, "Tail");
  paste(editor, dom.innerHTML);
  expect(editor.getHTML()).toBe(box + "<p>Tail</p>" + box);
});
