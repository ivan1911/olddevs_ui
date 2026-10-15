// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { Node } from "@tiptap/core";
import { createRef } from "react";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import {
  RichTextEditor,
  type CustomTool,
  type RichTextEditorHandle,
  type Tool,
} from "../src/editor/index.js";
import { TOOLS } from "../src/editor/core/tools.js";
import { resetDevWarnings } from "../src/lib/dev-warn.js";
import { TEST_TOOLS, testAsideTool } from "./editor-test-tools.js";
import { loadLazyBuiltins } from "./editor-lazy-builtins.js";

// Ленивые `codeBlock` и `table` (OLDSUI-111): `full` готов в `render` после загрузки чанков.
beforeAll(loadLazyBuiltins);

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  resetDevWarnings();
});

/**
 * Свой Инструмент в Markdown (OLDSUI-104, ADR-0058, п. 3.1).
 *
 * Свои правила Markdown — в Extensions (`renderMarkdown`, токенайзер
 * Tiptap), отдельного поля нет. Без них `getMarkdown` не теряет текст: Блок
 * выгружается своим содержимым, атом — Текстом атома (`renderText`), Метка —
 * своим текстом; пропадает только атом без текста. В разработке — одно
 * предупреждение на Инструмент.
 */
function renderEditor(defaultValue: string, tools: readonly Tool[] = [...TOOLS, ...TEST_TOOLS]) {
  const ref = createRef<RichTextEditorHandle>();
  render(<RichTextEditor ref={ref} aria-label="Body" tools={tools} defaultValue={defaultValue} />);
  if (!ref.current?.editor) throw new Error("the editor was not created inside render()");
  return ref.current;
}

const tag = '<span data-block="test_mergeTag" data-test_key="first_name"></span>';
const box = (...blocks: string[]) => `<div data-block="test_box">${blocks.join("")}</div>`;
const card = '<div data-block="test_card" data-test_size="m">Card <em>text</em></div>';
const note = '<span data-mark="test_note" data-test_author="Ann">noted</span>';

test("without Markdown rules a block is written as its content, an atom as its text", () => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const handle = renderEditor(
    `<p>Hi ${tag} and ${note}</p>${box("<p>a</p>", "<h2>b</h2>")}${card}`
  );

  // Текст атома — Markdown-текст: подчёркивание экранируется, как в любом тексте.
  expect(handle.getMarkdown()).toBe("Hi {{first\\_name}} and noted\n\na\n\n## b\n\nCard *text*");
});

test("the text survives a trip through Markdown even though the blocks do not", () => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const handle = renderEditor(`<p>Hi ${tag}</p>${box("<p>a</p>")}${card}`);

  act(() => handle.setMarkdown(handle.getMarkdown()));

  expect(handle.getHTML()).toBe("<p>Hi {{first_name}}</p><p>a</p><p>Card <em>text</em></p>");
});

/*
  Листовой атом без `renderText` — без текста: в Markdown ему нечем быть, и он
  пропадает. Это единственная потеря, и о ней предупреждение тоже говорит.
*/
test("an atom without text is the only thing that disappears", () => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const pin: CustomTool = {
    name: "test_pin",
    engine: [Node.create({ name: "test_pin", atom: true })],
    blocks: { test_pin: { kind: "inline" } },
  };
  const handle = renderEditor('<p>a<span data-block="test_pin"></span>b</p>', [...TOOLS, pin]);

  expect(handle.getHTML()).toBe('<p>a<span data-block="test_pin"></span>b</p>');
  expect(handle.getMarkdown()).toBe("ab");
});

test("development warns once per tool without Markdown rules, however often it is written", () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const handle = renderEditor(
    `<p>${tag} ${tag} ${note}</p>${box("<p>a</p>")}${box("<p>b</p>")}${card}`
  );

  handle.getMarkdown();
  handle.getMarkdown();

  const messages = warn.mock.calls.map(([message]) => String(message));
  expect(messages).toHaveLength(4);
  for (const name of ["test_mergeTag", "test_note", "test_box", "test_card"]) {
    expect(messages.filter((message) => message.includes(`"${name}"`))).toHaveLength(1);
  }
  expect(messages[0]).toMatch(/no Markdown rules/);
});

test("a tool whose blocks are not in the document does not warn", () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const handle = renderEditor("<p>plain</p>");

  expect(handle.getMarkdown()).toBe("plain");
  expect(warn).not.toHaveBeenCalled();
});

test("with its own Markdown rules a custom block makes the round trip", () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const aside = '<div data-block="test_aside">Note <strong>here</strong></div>';
  const handle = renderEditor(`<p>before</p>${aside}<p>after</p>`, [...TOOLS, testAsideTool]);

  const markdown = handle.getMarkdown();
  expect(markdown).toBe("before\n\n::: Note **here**\n\nafter");

  act(() => handle.setMarkdown(markdown));
  expect(handle.getHTML()).toBe(`<p>before</p>${aside}<p>after</p>`);
  expect(warn).not.toHaveBeenCalled();
});
