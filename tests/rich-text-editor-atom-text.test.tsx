// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import type { Editor } from "@tiptap/react";
import { createRef } from "react";
import { afterEach, beforeAll, expect, test } from "vitest";
import {
  RichTextEditor,
  type RichTextEditorHandle,
  type RichTextEditorProps,
} from "../src/editor/index.js";
import { TOOLS } from "../src/editor/core/tools.js";
import { TEST_TOOLS } from "./editor-test-tools.js";
import { loadLazyBuiltins } from "./editor-lazy-builtins.js";

// Ленивые `codeBlock` и `table` (OLDSUI-111): `full` готов в `render` после загрузки чанков.
beforeAll(loadLazyBuiltins);

afterEach(cleanup);

/**
 * Текст атома (OLDSUI-109, ADR-0058, раздел 4): вес в `maxLength`, `getText`,
 * Markdown, пустота и срез вставки.
 *
 * Через публичный `RichTextEditor` со своими тестовыми Инструментами
 * (`editor-test-tools.ts`): Merge Tag — строчный атом с `renderText`
 * (`{{ключ}}`), видео — Блок-атом без текста, вставка (embed) — Блок-атом с
 * содержимым. Из встроенных — разделитель, мягкий перенос и картинка с подписью.
 * Каретка и выделение ставятся командами движка: jsdom не умеет ввода.
 */
function renderEditor(props: Partial<RichTextEditorProps> = {}) {
  const ref = createRef<RichTextEditorHandle>();
  const view = render(
    <RichTextEditor ref={ref} aria-label="Body" tools={[...TOOLS, ...TEST_TOOLS]} {...props} />
  );
  const editor = ref.current?.editor;
  if (!editor) throw new Error("the editor was not created inside render()");
  return { ...view, ref, editor, handle: ref.current! };
}

/** Вставка HTML из буфера: разбор Схемой и транзакция с меткой `paste`. */
function paste(editor: Editor, html: string) {
  act(() => void editor.view.pasteHTML(html, new Event("paste") as ClipboardEvent));
}

/** Каретка в конец документа. */
function caretAtEnd(editor: Editor) {
  act(() => void editor.commands.setTextSelection(editor.state.doc.content.size - 1));
}

/** Текст без разделителей Блоков — то, что считает счётчик. */
const counted = (editor: Editor) => editor.getText({ blockSeparator: "" });

const PHOTO = "https://cdn.example.com/photo.png";
/** Merge Tag с ключом `x`: `{{x}}`, вес 5. */
const tag = '<span data-block="test_mergeTag" data-test_key="x"></span>';
const video = '<div data-block="test_video"></div>';
const embed = (text: string) => `<div data-block="test_embed">${text}</div>`;

// ── Вес атома ──────────────────────────────────────────────────────────────

test("the counter matches the text of a document with every kind of atom", () => {
  const { editor, handle } = renderEditor({
    maxLength: 19,
    defaultValue:
      "<p>a<br>b</p><hr>" +
      `<figure><img src="${PHOTO}" alt=""><figcaption>cap</figcaption></figure>` +
      `<p>Hi ${tag}</p>${video}${embed("emb")}`,
  });

  // a, перенос, b — 3; разделитель — 0; подпись — 3; «Hi » и `{{x}}` — 8; видео — 0; вставка — 3.
  expect(counted(editor)).toHaveLength(17);
  expect(counted(editor)).toBe("a\nb" + "cap" + "Hi {{x}}" + "emb");
  expect(screen.getByText("2 characters left")).toBeTruthy();
  expect(handle.getText().replace(/\n\n/g, "")).toBe(counted(editor));
});

test("a divider takes no character from the limit", () => {
  renderEditor({ maxLength: 5, defaultValue: "<p>1234</p><hr><hr>" });

  expect(screen.getByText("1 character left")).toBeTruthy();
});

test("a soft break weighs one character", () => {
  renderEditor({ maxLength: 3, defaultValue: "<p>a<br>b</p>" });

  expect(screen.getByText("0 characters left")).toBeTruthy();
});

test("an image weighs the length of its caption", () => {
  renderEditor({
    maxLength: 5,
    defaultValue: `<figure><img src="${PHOTO}" alt="x"><figcaption>Lake</figcaption></figure>`,
  });
  expect(screen.getByText("1 character left")).toBeTruthy();

  cleanup();
  renderEditor({ maxLength: 4, defaultValue: `<img src="${PHOTO}" alt="x">` });
  expect(screen.queryByText(/characters? left/)).toBeNull();
});

test("a custom atom weighs its text; without text it weighs nothing", () => {
  renderEditor({ maxLength: 6, defaultValue: `<p>${tag}</p>` });
  expect(screen.getByText("1 character left")).toBeTruthy();

  cleanup();
  renderEditor({ maxLength: 4, defaultValue: video });
  expect(screen.queryByText(/characters? left/)).toBeNull();
  cleanup();

  // Атом с содержимым без `renderText` — текст своих детей.
  renderEditor({ maxLength: 4, defaultValue: `${embed("abc")}${video}` });
  expect(screen.queryByText(/characters? left/)).toBeNull();
  cleanup();
  renderEditor({ maxLength: 3, defaultValue: embed("abc") });
  expect(screen.getByText("0 characters left")).toBeTruthy();
});

test("typing is blocked at the limit counted with atoms", () => {
  const { editor } = renderEditor({ maxLength: 7, defaultValue: `<p>${tag}</p>` });
  caretAtEnd(editor);

  act(() => void editor.commands.insertContent("ab"));
  expect(counted(editor)).toBe("{{x}}ab");
  act(() => void editor.commands.insertContent("c"));

  expect(counted(editor)).toBe("{{x}}ab");
});

// ── Три вывода одного текста ───────────────────────────────────────────────

test("getText, getSelectedText and getMarkdown give the same atom text", () => {
  const { editor, handle } = renderEditor({
    defaultValue: `<p>Hi ${tag} there</p>${video}${embed("emb")}`,
  });

  expect(handle.getText()).toBe("Hi {{x}} there\n\n\n\nemb");
  expect(handle.getMarkdown()).toBe("Hi {{x}} there\n\nemb");

  act(() => void editor.commands.setTextSelection({ from: 2, to: 9 }));
  expect(handle.getSelectedText()).toBe("i {{x}} the");
});

test("an atom enters the selected text whole, never in part", () => {
  const { editor, handle } = renderEditor({ defaultValue: `<p>ab${tag}cd</p>` });

  // Выделение «b», атом, «c»: от позиции 2 до 5; атом — одна позиция.
  act(() => void editor.commands.setTextSelection({ from: 2, to: 5 }));
  expect(handle.getSelectedText()).toBe("b{{x}}c");

  act(() => void editor.commands.setTextSelection({ from: 3, to: 4 }));
  expect(handle.getSelectedText()).toBe("{{x}}");

  act(() => void editor.commands.setTextSelection({ from: 3, to: 3 }));
  expect(handle.getSelectedText()).toBe("");
});

test("the text of a custom atom reaches plain-text copy through the schema", () => {
  const { editor } = renderEditor({ defaultValue: `<p>a${tag}b</p>` });

  expect(editor.state.doc.textBetween(0, editor.state.doc.content.size, "\n\n")).toBe("a{{x}}b");
  expect(editor.state.doc.textContent).toBe("a{{x}}b");
});

test("Markdown writes a block atom with content by its children and drops one without text", () => {
  const { handle } = renderEditor({ defaultValue: `<p>One</p>${video}${embed("two")}` });

  expect(handle.getMarkdown()).toBe("One\n\ntwo");
});

// ── Пустота ────────────────────────────────────────────────────────────────

test("any atom makes the field non-empty; an empty paragraph does not", () => {
  const { handle } = renderEditor({ defaultValue: video });
  expect(handle.isEmpty()).toBe(false);
  expect(handle.getHTML()).toBe(video);
  expect(handle.getText()).toBe("");
  cleanup();

  const inline = renderEditor({ defaultValue: `<p>${tag}</p>` });
  expect(inline.handle.isEmpty()).toBe(false);
  cleanup();

  const empty = renderEditor({ defaultValue: "<p></p><p></p>" });
  expect(empty.handle.isEmpty()).toBe(true);
  expect(empty.handle.getHTML()).toBe("");
});

test("a required field with only a custom atom without text passes the check", () => {
  const view = render(
    <form>
      <RichTextEditor
        aria-label="Body"
        name="body"
        required
        tools={[...TOOLS, ...TEST_TOOLS]}
        defaultValue={video}
      />
    </form>
  );

  expect(view.container.querySelector("input:invalid")).toBeNull();
  cleanup();

  const empty = render(
    <form>
      <RichTextEditor
        aria-label="Body"
        name="body"
        required
        tools={[...TOOLS, ...TEST_TOOLS]}
        defaultValue="<p></p>"
      />
    </form>
  );
  expect(empty.container.querySelector("input:invalid")).not.toBeNull();
});

// ── Срез вставки ───────────────────────────────────────────────────────────

test("a paste over the limit cuts the tail by characters", () => {
  const { editor } = renderEditor({ maxLength: 7, defaultValue: "<p>ab</p>" });
  caretAtEnd(editor);

  paste(editor, "<p>cd <em>efgh</em> ij</p>");

  expect(editor.getHTML()).toBe("<p>abcd <em>ef</em></p>");
});

test("an atom that does not fit leaves whole together with everything after it", () => {
  const { editor } = renderEditor({ maxLength: 8, defaultValue: "<p>ab</p>" });
  caretAtEnd(editor);

  // «cd », `{{x}}` (5), « ef»: лишних 5 символов — хвост « ef» уходит, а атому
  // не хватает места, и он уходит целиком, а не наполовину.
  paste(editor, `<p>cd ${tag} ef</p>`);

  expect(editor.getHTML()).toBe("<p>abcd </p>");
  expect(counted(editor)).toBe("abcd ");
});

test("an atom that fits stays, and only the text after it is cut", () => {
  const { editor } = renderEditor({ maxLength: 11, defaultValue: "<p>ab</p>" });
  caretAtEnd(editor);

  paste(editor, `<p>cd ${tag} ef</p>`);

  expect(editor.getHTML()).toBe(`<p>abcd ${tag} </p>`);
  expect(counted(editor)).toBe("abcd {{x}} ");
});

test("a paste cuts across blocks, dropping what comes after the cut", () => {
  const { editor } = renderEditor({ maxLength: 6, defaultValue: "<p>ab</p>" });
  caretAtEnd(editor);

  paste(editor, "<p>cd</p><p>efgh</p><p>ijkl</p>");

  expect(counted(editor)).toBe("abcdef");
  expect(editor.getHTML()).toBe("<p>abcd</p><p>ef</p>");
});

test("a paste with a divider counts the divider as nothing", () => {
  const { editor } = renderEditor({ maxLength: 6, defaultValue: "<p>ab</p>" });
  caretAtEnd(editor);

  paste(editor, "<p>cd</p><hr><p>ef</p>");

  expect(counted(editor)).toBe("abcdef");
  expect(editor.getHTML()).toBe("<p>abcd</p><hr><p>ef</p>");
});

test("a paste into a full field is refused", () => {
  const { editor } = renderEditor({ maxLength: 4, defaultValue: "<p>abcd</p>" });
  caretAtEnd(editor);

  paste(editor, "<p>e</p>");

  expect(editor.getHTML()).toBe("<p>abcd</p>");
});
