// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import type { Editor } from "@tiptap/react";
import { createRef, type ReactNode } from "react";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { UiProvider } from "../src/i18n/UiProvider.js";
import { messages as ru } from "../src/locales/ru.js";
import {
  RichTextEditor,
  tool,
  type RichTextEditorHandle,
  type RichTextEditorProps,
} from "../src/editor/index.js";
import { loadLazyBuiltins } from "./editor-lazy-builtins.js";

beforeAll(loadLazyBuiltins);

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/**
 * Typography by the language of a fragment (OLDSUI-308, ADR-0078, decision 9): inside a mark `en…`
 * the double quote becomes “…”, inside `ru…` it becomes «…», and with another language or none it is
 * as before (the catalog's set or the `quotes` option). Input takes the path ProseMirror receives it
 * by (`handleTextInput`), like `rich-text-editor-typography.test.tsx`.
 */

const TOOLS = ["typography", "language", "history"] as const;

function renderEditor(
  props: Partial<RichTextEditorProps> = {},
  wrap: (children: ReactNode) => ReactNode = (children) => children
) {
  const ref = createRef<RichTextEditorHandle>();
  render(wrap(<RichTextEditor ref={ref} aria-label="Body" tools={[...TOOLS]} {...props} />));
  const editor = ref.current?.editor;
  if (!editor) throw new Error("the editor was not created inside render()");
  return { editor, handle: ref.current! };
}

const inRussian = (children: ReactNode) => (
  <UiProvider locale="ru-RU" messages={ru}>
    {children}
  </UiProvider>
);

function typeText(editor: Editor, text: string) {
  act(() => {
    for (const char of text) {
      const { from, to } = editor.state.selection;
      const handled = editor.view.someProp("handleTextInput", (handler) =>
        handler(editor.view, from, to, char, () => editor.state.tr.insertText(char, from, to))
      );
      if (!handled) editor.view.dispatch(editor.state.tr.insertText(char, from, to));
    }
  });
}

/** The caret at the end of the first paragraph. */
const toEnd = (editor: Editor) =>
  act(() => void editor.commands.setTextSelection(editor.state.doc.firstChild!.nodeSize - 1));

test("inside a ru mark an English interface still gets guillemets", () => {
  const { editor, handle } = renderEditor({ defaultValue: '<p><span lang="ru">a</span></p>' });
  toEnd(editor);
  typeText(editor, ' "b"');
  expect(handle.getHTML()).toBe('<p><span lang="ru">a «b»</span></p>');
});

test("inside an en mark a Russian interface still gets curly quotes", () => {
  const { editor, handle } = renderEditor(
    { defaultValue: '<p><span lang="en-GB">a</span></p>' },
    inRussian
  );
  toEnd(editor);
  typeText(editor, ' "b"');
  expect(handle.getHTML()).toBe('<p><span lang="en-GB">a “b”</span></p>');
});

test("another language, and no mark, keep the catalog's set", () => {
  const de = renderEditor({ defaultValue: '<p><span lang="de">a</span></p>' });
  toEnd(de.editor);
  typeText(de.editor, ' "b"');
  expect(de.handle.getHTML()).toBe('<p><span lang="de">a “b”</span></p>');
  cleanup();

  const plain = renderEditor({ defaultValue: "<p>a</p>" }, inRussian);
  toEnd(plain.editor);
  typeText(plain.editor, ' "b"');
  expect(plain.handle.getHTML()).toBe("<p>a «b»</p>");
});

test("the language of the mark wins over the quotes option too", () => {
  const { editor, handle } = renderEditor({
    tools: ["language", tool("typography", { quotes: "ru" })],
    defaultValue: '<p><span lang="en">a</span></p>',
  });
  toEnd(editor);
  typeText(editor, ' "b"');
  expect(handle.getHTML()).toBe('<p><span lang="en">a “b”</span></p>');
});

test("without the language tool the marks are gone and the set is the catalog's", () => {
  const { editor, handle } = renderEditor({
    tools: ["typography"],
    defaultValue: '<p><span lang="en">a</span></p>',
  });
  toEnd(editor);
  typeText(editor, ' "b"');
  expect(handle.getHTML()).toBe("<p>a “b”</p>");
});
