// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { NodeSelection } from "@tiptap/pm/state";
import type { Editor } from "@tiptap/react";
import createDOMPurify from "dompurify";
import { createRef } from "react";
import { afterEach, beforeAll, expect, test } from "vitest";
import {
  RichTextEditor,
  RichTextView,
  type RichTextEditorHandle,
  type RichTextEditorProps,
} from "../src/editor/index.js";
import { EDITOR_WRAPPER_TONE_CLASS } from "../src/editor/styles/prose.js";
import { sanitizeRichText } from "../src/editor/schema-entry.js";
import { EDITOR_TOKENS_CLASS } from "../src/editor/styles/tokens.js";
import { TOOLS } from "../src/editor/core/tools.js";
import { UiProvider } from "../src/i18n/UiProvider.js";
import { messages as ru } from "../src/locales/ru.js";
import { loadLazyBuiltins } from "./editor-lazy-builtins.js";

// Ленивые `codeBlock` и `table` (OLDSUI-111): `full` готов в `render` после загрузки чанков.
beforeAll(loadLazyBuiltins);

afterEach(cleanup);

/**
 * Тон Обёртки (OLDSUI-78): `data-tone` на `div[data-block="wrapper"]` — имя из
 * словаря тонов кита, вид — мягкая подложка и полоса слева, в Markdown — GitHub
 * alert.
 *
 * Через публичный `RichTextEditor`, `RichTextView` и `sanitizeRichText`, как
 * тесты самой Обёртки (`rich-text-editor-wrapper.test.tsx`): результат —
 * выходной HTML, Markdown, меню ручки и шаг отмены.
 */
function renderEditor(props: Partial<RichTextEditorProps> = {}) {
  const ref = createRef<RichTextEditorHandle>();
  const view = render(<RichTextEditor ref={ref} aria-label="Body" {...props} />);
  const editor = ref.current?.editor;
  if (!editor) throw new Error("the editor was not created inside render()");
  return { ...view, editor, handle: ref.current! };
}

const TONES = ["neutral", "accent", "success", "warning", "danger"] as const;

const wrapper = (...blocks: string[]) => `<div data-block="wrapper">${blocks.join("")}</div>`;
const toned = (tone: string, ...blocks: string[]) =>
  `<div data-block="wrapper" data-tone="${tone}">${blocks.join("")}</div>`;

// ── Схема ────────────────────────────────────────────────────────────────

test.each(TONES)("a wrapper with the %s tone survives a round trip", (tone) => {
  const html = `<p>Before</p>${toned(tone, "<p>One</p>", "<h2>Two</h2>")}<p>After</p>`;
  const { editor } = renderEditor({ defaultValue: html });
  expect(editor.getHTML()).toBe(html);
});

test.each(["purple", "Accent", " accent", "info", ""])(
  "an unknown tone %j is dropped and the wrapper stays",
  (tone) => {
    const { editor } = renderEditor({ defaultValue: toned(tone, "<p>One</p>") });
    expect(editor.getHTML()).toBe(wrapper("<p>One</p>"));
  }
);

test("a tone on any other element is dropped", () => {
  const { editor } = renderEditor({
    defaultValue:
      '<p data-tone="accent">One</p><blockquote data-tone="danger"><p>Two</p></blockquote>',
  });
  expect(editor.getHTML()).toBe("<p>One</p><blockquote><p>Two</p></blockquote>");
});

test("without the wrapper tool the tone goes with the wrapper: blocks in a row", () => {
  const { editor } = renderEditor({
    defaultValue: `<p>Before</p>${toned("warning", "<p>One</p>", "<h2>Two</h2>")}`,
    tools: TOOLS.filter((tool) => tool !== "wrapper"),
  });
  expect(editor.getHTML()).toBe("<p>Before</p><p>One</p><h2>Two</h2>");
});

test("a toned wrapper nested in a wrapper unfolds and the outer one keeps its own tone", () => {
  const { editor } = renderEditor({
    defaultValue: toned("accent", "<p>a</p>", toned("danger", "<p>x</p>")),
  });
  expect(editor.getHTML()).toBe(toned("accent", "<p>a</p>", "<p>x</p>"));
});

// ── Санитайзер ───────────────────────────────────────────────────────────

test("sanitizeRichText keeps what the editor writes and drops an unknown or misplaced tone", () => {
  const purify = createDOMPurify(window);
  const saved = renderEditor({
    defaultValue: TONES.map((tone) => toned(tone, `<p>${tone}</p>`)).join(""),
  }).editor.getHTML();
  expect(sanitizeRichText(saved, purify)).toBe(saved);

  for (const [input, output] of [
    [toned("purple", "<p>a</p>"), wrapper("<p>a</p>")],
    [toned("Accent", "<p>a</p>"), wrapper("<p>a</p>")],
    ['<p data-tone="accent">a</p>', "<p>a</p>"],
    ['<div data-tone="accent"><p>a</p></div>', "<p>a</p>"],
    [
      '<div data-block="layout" data-layout="100" data-tone="accent">' +
        '<div data-block="column" data-tone="accent"><p>a</p></div></div>',
      '<div data-block="layout" data-layout="100"><div data-block="column"><p>a</p></div></div>',
    ],
    // Тон уходит вместе со снятой Обёрткой.
    [
      `<blockquote>${toned("danger", "<p>a</p>")}</blockquote>`,
      "<blockquote><p>a</p></blockquote>",
    ],
  ] as [string, string][]) {
    expect(sanitizeRichText(input, purify), input).toBe(output);
  }
});

// ── Меню «Тон ›» ─────────────────────────────────────────────────────────

const HANDLE = "Block actions";

/** Каретка — в конец текста `text`, фокус — в Документ: ручка видна только при нём. */
function focusAt(editor: Editor, text: string) {
  let found = -1;
  editor.state.doc.descendants((node, pos) => {
    if (found < 0 && node.isText && node.text === text) found = pos + node.nodeSize;
  });
  if (found < 0) throw new Error(`no text "${text}" in the document`);
  act(() => {
    editor.commands.setTextSelection(found);
    editor.view.focus();
  });
}

async function openHandleMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: HANDLE }));
  return screen.findByRole("menu", { name: HANDLE });
}

async function openToneMenu(user: ReturnType<typeof userEvent.setup>, current: string) {
  const menu = await openHandleMenu(user);
  const name = `Tone: ${current}`;
  await user.click(within(menu).getByRole("menuitem", { name }));
  return screen.findByRole("menu", { name });
}

const radioNames = (menu: HTMLElement) =>
  within(menu)
    .getAllByRole("menuitemradio")
    .map((item) => item.textContent);
const checkedName = (menu: HTMLElement) =>
  within(menu)
    .getAllByRole("menuitemradio")
    .filter((item) => item.getAttribute("aria-checked") === "true")
    .map((item) => item.textContent);

test("the handle of a block in a wrapper has Tone ›: radio items in words, None checked", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: wrapper("<p>One</p>") });
  focusAt(editor, "One");

  const tone = await openToneMenu(user, "None");
  expect(radioNames(tone)).toEqual(["None", "Note", "Tip", "Important", "Warning", "Caution"]);
  expect(checkedName(tone)).toEqual(["None"]);
});

test("choosing a tone writes it in one undo step and the caret stays in its text", async () => {
  const user = userEvent.setup();
  const html = `<p>Above</p>${wrapper("<p>One</p>", "<p>Two</p>")}`;
  const { editor } = renderEditor({ defaultValue: html });
  focusAt(editor, "Two");

  let tone = await openToneMenu(user, "None");
  await user.click(within(tone).getByRole("menuitemradio", { name: "Note" }));

  expect(editor.getHTML()).toBe(`<p>Above</p>${toned("accent", "<p>One</p>", "<p>Two</p>")}`);
  expect(editor.state.selection.$from.parent.textContent).toBe("Two");
  await waitFor(() => expect(editor.view.hasFocus()).toBe(true));

  // Имя пункта и отметка — уже с новым тоном.
  tone = await openToneMenu(user, "Note");
  expect(checkedName(tone)).toEqual(["Note"]);
  await user.click(within(tone).getByRole("menuitemradio", { name: "Caution" }));
  expect(editor.getHTML()).toBe(`<p>Above</p>${toned("danger", "<p>One</p>", "<p>Two</p>")}`);

  act(() => void editor.commands.undo());
  expect(editor.getHTML()).toBe(`<p>Above</p>${toned("accent", "<p>One</p>", "<p>Two</p>")}`);
  act(() => void editor.commands.undo());
  expect(editor.getHTML()).toBe(html);
});

test("None takes the tone off, and choosing the current tone adds no edit", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: toned("warning", "<p>One</p>") });
  focusAt(editor, "One");

  await user.click(
    within(await openToneMenu(user, "Warning")).getByRole("menuitemradio", { name: "Warning" })
  );
  expect(editor.can().undo()).toBe(false);
  await waitFor(() => expect(editor.view.hasFocus()).toBe(true));

  await user.click(
    within(await openToneMenu(user, "Warning")).getByRole("menuitemradio", { name: "None" })
  );
  expect(editor.getHTML()).toBe(wrapper("<p>One</p>"));
});

test("the handle of a wrapper selected as a whole sets its tone too", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({
    defaultValue: `<p>Above</p>${wrapper("<p>One</p>", "<p>Two</p>")}<p>Below</p>`,
  });
  act(() => {
    editor.view.focus();
    editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, 7)));
  });

  await user.click(
    within(await openToneMenu(user, "None")).getByRole("menuitemradio", { name: "Tip" })
  );
  expect(editor.getHTML()).toBe(
    `<p>Above</p>${toned("success", "<p>One</p>", "<p>Two</p>")}<p>Below</p>`
  );
  // Обёртка осталась выделенной целиком.
  expect((editor.state.selection as NodeSelection).node?.type.name).toBe("wrapper");
});

test("a block in a list inside a wrapper reaches the tone of that wrapper", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({
    defaultValue: toned("neutral", "<ul><li><p>Item</p></li></ul>"),
  });
  focusAt(editor, "Item");
  const tone = await openToneMenu(user, "Important");
  expect(checkedName(tone)).toEqual(["Important"]);
});

test("the handle of a block outside a wrapper has no Tone", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: `<p>Plain</p>${toned("accent", "<p>One</p>")}` });
  focusAt(editor, "Plain");
  const menu = await openHandleMenu(user);
  expect(within(menu).queryByRole("menuitem", { name: /^Tone/ })).toBeNull();
});

test("the tone menu speaks the provider's language", async () => {
  const user = userEvent.setup();
  const ref = createRef<RichTextEditorHandle>();
  render(
    <UiProvider messages={ru}>
      <RichTextEditor ref={ref} aria-label="Body" defaultValue={toned("accent", "<p>One</p>")} />
    </UiProvider>
  );
  focusAt(ref.current!.editor!, "One");
  const { editor: m } = ru;

  await user.click(screen.getByRole("button", { name: m.blockActions }));
  const menu = await screen.findByRole("menu", { name: m.blockActions });
  const name = m.wrapperTone({ current: m.wrapperToneName.accent });
  await user.click(within(menu).getByRole("menuitem", { name }));
  const tone = await screen.findByRole("menu", { name });
  expect(radioNames(tone)).toEqual([
    m.wrapperToneNone,
    ...(["accent", "success", "neutral", "warning", "danger"] as const).map(
      (key) => m.wrapperToneName[key]
    ),
  ]);
});

test("setWrapperTone refuses a name outside the dictionary and a caret outside a wrapper", () => {
  const { editor } = renderEditor({ defaultValue: `<p>Plain</p>${wrapper("<p>One</p>")}` });
  act(() => void editor.commands.setTextSelection(3));
  expect(editor.commands.setWrapperTone("accent")).toBe(false);
  act(() => void editor.commands.setTextSelection(10));
  expect(editor.commands.setWrapperTone("purple" as never)).toBe(false);
  expect(editor.getHTML()).toBe(`<p>Plain</p>${wrapper("<p>One</p>")}`);
});

test("each menu swatch wears the theme's tokens of its tone", () => {
  const role = (name: string) =>
    EDITOR_TOKENS_CLASS.match(new RegExp(`\\[--rte-tone-${name}:var\\((--[\\w-]+)\\)\\]`))?.[1];
  for (const tone of TONES) {
    const swatch = EDITOR_WRAPPER_TONE_CLASS[tone].split(" ");
    expect(swatch, tone).toContain(`bg-(${role(`${tone}-background`)})`);
    expect(swatch, tone).toContain(`border-(${role(`${tone}-border`)})`);
  }
});

// ── Показ ────────────────────────────────────────────────────────────────

test("RichTextView shows the tone as markup only: no role, no aria, no style", () => {
  const { container: root } = render(
    <RichTextView html={toned("warning", "<p>Mind the gap</p>")} />
  );
  const box = root.querySelector('[data-block="wrapper"]')!;
  expect(box.getAttribute("data-tone")).toBe("warning");
  expect(box.getAttribute("role")).toBeNull();
  expect(box.getAttribute("style")).toBeNull();
  expect([...box.attributes].map((attribute) => attribute.name).sort()).toEqual([
    "data-block",
    "data-tone",
  ]);
});

test("the tone has one look in the editor and in the view; the dashed frame is for untoned only", () => {
  const { editor } = renderEditor({ defaultValue: toned("accent", "<p>One</p>") });
  render(<RichTextView html={toned("accent", "<p>One</p>")} data-testid="view" />);
  const viewClasses = screen.getByTestId("view").className.split(/\s+/);
  const editorClasses = new Set((editor.view.dom as HTMLElement).className.split(/\s+/));

  const toneRules = viewClasses.filter((token) => token.includes("[data-tone"));
  expect(toneRules.length).toBeGreaterThan(0);
  expect(toneRules.filter((token) => !editorClasses.has(token))).toEqual([]);
  // Пунктир Редактора — только у Обёртки без тона.
  const dashed = [...editorClasses].filter((token) => token.endsWith(":border-dashed"));
  expect(dashed.filter((token) => token.includes("[data-block=wrapper]"))).toEqual([
    "[&.ProseMirror_[data-block=wrapper]:not([data-tone])]:border-dashed",
  ]);
});

// ── Markdown: GitHub alerts ──────────────────────────────────────────────

const ALERTS = [
  ["accent", "NOTE"],
  ["success", "TIP"],
  ["neutral", "IMPORTANT"],
  ["warning", "WARNING"],
  ["danger", "CAUTION"],
] as const;

test.each(ALERTS)("getMarkdown writes a %s wrapper as a [!%s] alert", (tone, label) => {
  const { handle } = renderEditor({
    defaultValue: `<p>Intro</p>${toned(tone, "<h3>Title</h3>", "<p>One <strong>two</strong></p>", "<ul><li><p>item</p></li></ul>")}<p>Outro</p>`,
  });
  expect(handle.getMarkdown()).toBe(
    `Intro\n\n> [!${label}]\n> ### Title\n>\n> One **two**\n>\n> - item\n\nOutro`
  );
});

test("an untoned wrapper still writes its blocks in a row", () => {
  const { handle } = renderEditor({ defaultValue: wrapper("<p>One</p>", "<p>Two</p>") });
  expect(handle.getMarkdown()).toBe("One\n\nTwo");
});

test.each(ALERTS)("setMarkdown reads a %s wrapper back from its [!%s] alert", (tone, label) => {
  const { editor, handle } = renderEditor();
  act(() => handle.setMarkdown(`Intro\n\n> [!${label}]\n> One **two**\n>\n> - item\n\nOutro`));
  expect(editor.getHTML()).toBe(
    "<p>Intro</p>" +
      toned(tone, "<p>One <strong>two</strong></p>", "<ul><li><p>item</p></li></ul>") +
      "<p>Outro</p>"
  );
});

test("an alert survives getMarkdown then setMarkdown, every tone", () => {
  const html = ALERTS.map(([tone]) => toned(tone, "<h3>Title</h3>", "<p>Body</p>")).join(
    "<p>Gap</p>"
  );
  const { editor, handle } = renderEditor({ defaultValue: html });
  const markdown = handle.getMarkdown();
  act(() => handle.setMarkdown(markdown));
  expect(editor.getHTML()).toBe(html);
});

test("a line first in a toned wrapper survives the round trip, not turning the label into a heading", () => {
  // `---` прямо под строкой метки Markdown читал бы подчёркиванием заголовка.
  const html = toned("accent", "<hr>", "<p>after</p>");
  const { editor, handle } = renderEditor({ defaultValue: html });
  act(() => handle.setMarkdown(handle.getMarkdown()));
  expect(editor.getHTML()).toBe(html);
});

test("whitespace-only lines of a code block in an alert keep their spaces", () => {
  const html = toned("warning", '<pre><code class="language-yaml">a: 1\n    \nb: 2</code></pre>');
  const { editor, handle } = renderEditor({ defaultValue: html });
  act(() => handle.setMarkdown(handle.getMarkdown()));
  expect(editor.getHTML()).toBe(html);
});

test("a hard break right after the label does not lead the first paragraph", () => {
  const { editor, handle } = renderEditor();
  act(() => handle.setMarkdown("> [!NOTE]  \n> text"));
  expect(editor.getHTML()).toBe(toned("accent", "<p>text</p>"));
});

test("the label is read in any case and may be the whole alert", () => {
  const { editor, handle } = renderEditor();
  act(() => handle.setMarkdown("> [!tip]\n> lower\n\n> [!Warning]"));
  expect(editor.getHTML()).toBe(toned("success", "<p>lower</p>") + toned("warning", "<p></p>"));
});

test.each([
  ["a plain quote", "> just a quote", "<blockquote><p>just a quote</p></blockquote>"],
  ["an unknown label", "> [!INFO]\n> text", "<blockquote><p>[!INFO]\ntext</p></blockquote>"],
  [
    "a label with text on its line",
    "> [!NOTE] text",
    "<blockquote><p>[!NOTE] text</p></blockquote>",
  ],
  [
    "an alert inside a list",
    "- item\n\n  > [!NOTE]\n  > text",
    "<ul><li><p>item</p><blockquote><p>[!NOTE]\ntext</p></blockquote></li></ul>",
  ],
])("%s stays a quote", (_, markdown, html) => {
  const { editor, handle } = renderEditor();
  act(() => handle.setMarkdown(markdown));
  expect(editor.getHTML()).toBe(html);
});

test("without the wrapper tool an alert gives its blocks in a row, the label dropped", () => {
  const { editor, handle } = renderEditor({ tools: TOOLS.filter((tool) => tool !== "wrapper") });
  act(() => handle.setMarkdown("> [!CAUTION]\n> One\n>\n> Two"));
  expect(editor.getHTML()).toBe("<p>One</p><p>Two</p>");
});

test("raw wrapper HTML inside Markdown still makes no wrapper", () => {
  const { editor, handle } = renderEditor();
  act(() => handle.setMarkdown(`One\n\n${toned("accent", "<p>Two</p>")}\n\nThree`));
  expect(editor.getHTML()).not.toContain("data-block");
});

/** Вставка обычного текста из буфера событием `paste`, как в тестах Markdown. */
function pasteText(editor: Editor, text: string) {
  const event = new Event("paste", { bubbles: true, cancelable: true });
  Object.assign(event, {
    clipboardData: {
      getData: (type: string) => (type === "text/plain" ? text : ""),
      types: ["text/plain"],
    },
  });
  act(() => void editor.view.dom.dispatchEvent(event));
}

/** Каретка — в конец текста `text`, без фокуса. */
function caretAt(editor: Editor, text: string) {
  let found = -1;
  editor.state.doc.descendants((node, pos) => {
    if (found < 0 && node.isText && node.text === text) found = pos + node.nodeSize;
  });
  act(() => void editor.commands.setTextSelection(found));
}

test("a pasted alert becomes a toned wrapper", () => {
  const { editor } = renderEditor({ defaultValue: "<p>Intro</p>" });
  caretAt(editor, "Intro");
  pasteText(editor, "> [!WARNING]\n> Back up first.\n>\n> Then upgrade.");
  expect(editor.getHTML()).toBe(
    "<p>Intro</p>" + toned("warning", "<p>Back up first.</p>", "<p>Then upgrade.</p>")
  );
});

test("an alert pasted into a column stays a toned wrapper there", () => {
  const { editor } = renderEditor({
    defaultValue:
      '<div data-block="layout" data-layout="50-50"><div data-block="column"><p>Left</p></div>' +
      '<div data-block="column"><p>Right</p></div></div>',
  });
  caretAt(editor, "Left");
  pasteText(editor, "> [!TIP]\n> x");
  expect(editor.getHTML()).toContain(toned("success", "<p>x</p>"));
  expect(editor.state.doc.childCount).toBe(1);
});

test.each([
  ["a wrapper", toned("accent", "<p>One</p>")],
  ["a list item", "<ul><li><p>One</p></li></ul>"],
  ["a quote", "<blockquote><p>One</p></blockquote>"],
])("an alert pasted into %s gives its blocks, the label dropped", (_, html) => {
  const { editor } = renderEditor({ defaultValue: html });
  caretAt(editor, "One");
  pasteText(editor, "> [!CAUTION]\n> x\n>\n> y");
  const out = editor.getHTML();
  expect(out).not.toContain("CAUTION");
  expect(out).not.toContain('data-tone="danger"');
  expect(editor.getText()).toContain("y");
});

// ── HTML-режим ───────────────────────────────────────────────────────────

test("HTML mode shows the tone on the wrapper and applies it through the schema", async () => {
  const user = userEvent.setup();
  const { handle } = renderEditor({ defaultValue: toned("success", "<p>One</p>") });
  await user.click(screen.getByRole("button", { name: "HTML" }));
  const field = screen.getByRole("textbox", { name: "HTML source" }) as HTMLTextAreaElement;
  expect(field.value).toBe('<div data-block="wrapper" data-tone="success">\n  <p>One</p>\n</div>');

  act(
    () =>
      void fireEvent.change(field, {
        target: { value: toned("danger", "<p>a</p>") + toned("purple", "<p>b</p>") },
      })
  );
  await user.click(screen.getByRole("button", { name: "HTML" }));
  expect(handle.getHTML()).toBe(toned("danger", "<p>a</p>") + wrapper("<p>b</p>"));
});
