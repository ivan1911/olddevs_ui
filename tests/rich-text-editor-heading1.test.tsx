// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import type { Editor } from "@tiptap/react";
import { createRef } from "react";
import { afterEach, beforeAll, expect, test } from "vitest";
import {
  RichTextEditor,
  type RichTextEditorHandle,
  type RichTextEditorProps,
} from "../src/editor/index.js";
import { PRESETS, TOOLS } from "../src/editor/core/tools.js";
import { loadLazyBuiltins } from "./editor-lazy-builtins.js";

// Ленивые `codeBlock` и `table` (OLDSUI-111): `full` готов в `render` после загрузки чанков.
beforeAll(loadLazyBuiltins);

afterEach(cleanup);

function renderEditor(props: Partial<RichTextEditorProps> = {}) {
  const ref = createRef<RichTextEditorHandle>();
  render(<RichTextEditor ref={ref} aria-label="Body" {...props} />);
  const handle = ref.current;
  if (!handle?.editor) throw new Error("the editor was not created inside render()");
  return { handle, editor: handle.editor };
}

/** Набор по символам через `handleTextInput`: так срабатывают правила ввода (`# `). */
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

function paste(editor: Editor, html: string) {
  const event = new Event("paste", { bubbles: true, cancelable: true });
  Object.assign(event, {
    clipboardData: {
      getData: (type: string) => (type === "text/html" ? html : ""),
      types: ["text/html"],
    },
  });
  act(() => void editor.view.dom.dispatchEvent(event));
}

/** Ctrl+Alt+цифра — `Mod-Alt-N` движка. Возвращает, перехватил ли Редактор сочетание. */
function pressHeadingShortcut(editor: Editor, digit: string): boolean {
  const event = new KeyboardEvent("keydown", {
    key: digit,
    code: `Digit${digit}`,
    ctrlKey: true,
    altKey: true,
    bubbles: true,
    cancelable: true,
  });
  Object.defineProperty(event, "keyCode", { value: 48 + Number(digit) });
  act(() => void editor.view.dom.dispatchEvent(event));
  return event.defaultPrevented;
}

test("heading1 is in the full preset and not in basic", () => {
  expect(TOOLS).toContain("heading1");
  expect(PRESETS.full).toContain("heading1");
  expect(PRESETS.basic).not.toContain("heading1");
});

test("with heading1 a # and a space makes an H1 while typing", () => {
  const { editor } = renderEditor();

  typeText(editor, "# Top");

  expect(editor.getHTML()).toBe("<h1>Top</h1>");
});

test("with heading1 Ctrl+Alt+1 turns the block into an H1", () => {
  const { editor } = renderEditor({ defaultValue: "<p>Top</p>" });
  act(() => void editor.commands.setTextSelection(2));

  expect(pressHeadingShortcut(editor, "1")).toBe(true);

  expect(editor.getHTML()).toBe("<h1>Top</h1>");
});

test("with heading1 an h1 from the value and from a paste stays an H1", () => {
  const { editor } = renderEditor({ defaultValue: "<h1>Value</h1><p></p>" });
  expect(editor.getHTML()).toBe("<h1>Value</h1><p></p>");

  act(() => void editor.commands.setTextSelection(editor.state.doc.content.size - 1));
  paste(editor, "<h1>Pasted</h1>");
  expect(editor.getHTML()).toBe("<h1>Value</h1><h1>Pasted</h1>");
});

test("with heading1 setMarkdown reads # as H1 and getMarkdown writes #", () => {
  const { handle } = renderEditor();

  act(() => handle.setMarkdown("# One\n\n## Two\n\n##### Deep"));

  expect(handle.getHTML()).toBe("<h1>One</h1><h2>Two</h2><h4>Deep</h4>");
  expect(handle.getMarkdown()).toContain("# One\n");
  expect(handle.getMarkdown()).toContain("## Two");
});

test("without heading1 a # stays text, Ctrl+Alt+1 does nothing and an h1 does not stay an H1", () => {
  const tools = TOOLS.filter((tool) => tool !== "heading1");
  const { editor, handle } = renderEditor({ tools, defaultValue: "<h1>Value</h1>" });
  expect(editor.getHTML()).not.toContain("<h1");
  expect(editor.getHTML()).toContain("Value");

  act(() => void editor.commands.setContent("<p>Top</p>"));
  act(() => void editor.commands.setTextSelection(2));
  pressHeadingShortcut(editor, "1");
  expect(editor.getHTML()).toBe("<p>Top</p>");

  act(() => void editor.commands.setContent(""));
  typeText(editor, "# Top");
  expect(editor.getHTML()).toBe("<p># Top</p>");

  act(() => handle.setMarkdown("# Top"));
  expect(handle.getHTML()).toBe("<h2>Top</h2>");
  expect(handle.getMarkdown()).toContain("## Top");

  act(() => void editor.commands.setContent("<p></p>"));
  paste(editor, "<h1>Pasted</h1>");
  expect(editor.getHTML()).not.toContain("<h1");
  expect(editor.getHTML()).toContain("Pasted");
});

test("without the heading tool there is no H1 even when heading1 is passed", () => {
  const { editor, handle } = renderEditor({
    tools: ["heading1", "bold"],
    defaultValue: "<h1>Value</h1>",
  });
  expect(editor.getHTML()).not.toContain("<h1");

  act(() => handle.setMarkdown("# Top"));
  expect(handle.getHTML()).not.toContain("<h1");
});
