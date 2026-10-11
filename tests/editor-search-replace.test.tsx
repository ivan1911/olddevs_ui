// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, beforeAll, expect, test } from "vitest";
import {
  RICH_TEXT_PRESETS,
  RichTextEditor,
  type RichTextEditorHandle,
  type RichTextEditorProps,
} from "../src/editor/index.js";
import { searchState } from "../src/editor/features/search/searchPlugin.js";
import { loadLazyBuiltins } from "./editor-lazy-builtins.js";

beforeAll(loadLazyBuiltins);
afterEach(cleanup);

/**
 * Состояние поиска в движке, подсветка, переходы и замена (OLDSUI-151). Панель
 * — отдельно; здесь — команды, которыми она пользуется.
 */
function renderEditor(props: Partial<RichTextEditorProps> = {}) {
  const ref = createRef<RichTextEditorHandle>();
  const view = render(<RichTextEditor ref={ref} aria-label="Body" {...props} />);
  const editor = ref.current?.editor;
  if (!editor) throw new Error("the editor was not created inside render()");
  return { ...view, editor, handle: ref.current! };
}

const OPTIONS = { matchCase: false, wholeWord: false, regex: false };

test("search is a tool of both presets", () => {
  expect(RICH_TEXT_PRESETS.full).toContain("search");
  expect(RICH_TEXT_PRESETS.basic).toContain("search");
});

test("highlights every match and the current one stronger", () => {
  const { editor } = renderEditor({ defaultValue: "<p>cat dog cat</p>" });
  act(() => void editor.commands.setSearch("cat", OPTIONS));
  expect(editor.view.dom.querySelectorAll(".rte-search-match")).toHaveLength(2);
  expect(editor.view.dom.querySelectorAll(".rte-search-current")).toHaveLength(1);
  expect(searchState(editor.state)).toMatchObject({ current: 0, total: 2 });
});

test("next and previous walk the matches, wrap around and select the current one", () => {
  const { editor } = renderEditor({ defaultValue: "<p>cat dog cat</p>" });
  act(() => void editor.commands.setSearch("cat", OPTIONS));
  act(() => void editor.commands.searchStep(1));
  expect(searchState(editor.state)?.current).toBe(1);
  const { from, to } = editor.state.selection;
  expect(editor.state.doc.textBetween(from, to)).toBe("cat");
  expect(from).toBe(9);
  act(() => void editor.commands.searchStep(1));
  expect(searchState(editor.state)?.current).toBe(0);
  act(() => void editor.commands.searchStep(-1));
  expect(searchState(editor.state)?.current).toBe(1);
});

test("the matches follow edits of the document", () => {
  const { editor } = renderEditor({ defaultValue: "<p>cat dog</p>" });
  act(() => void editor.commands.setSearch("cat", OPTIONS));
  act(() => void editor.commands.insertContentAt(editor.state.doc.content.size - 1, " cat"));
  expect(searchState(editor.state)?.total).toBe(2);
});

test("replace changes the current match in one undo step and moves to the next", () => {
  const { editor } = renderEditor({ defaultValue: "<p>cat dog cat</p>" });
  act(() => void editor.commands.setSearch("cat", OPTIONS));
  act(() => void editor.commands.replaceMatch("cow"));
  expect(editor.getText()).toBe("cow dog cat");
  expect(searchState(editor.state)).toMatchObject({ current: 0, total: 1 });
  act(() => void editor.commands.undo());
  expect(editor.getText()).toBe("cat dog cat");
});

test("replace all changes every match in one undo step", () => {
  const { editor } = renderEditor({ defaultValue: "<p>cat dog cat</p><p>Cat</p>" });
  act(() => void editor.commands.setSearch("cat", OPTIONS));
  act(() => void editor.commands.replaceAllMatches("cow"));
  expect(editor.getHTML()).toBe("<p>cow dog cow</p><p>cow</p>");
  expect(searchState(editor.state)?.total).toBe(0);
  act(() => void editor.commands.undo());
  expect(editor.getHTML()).toBe("<p>cat dog cat</p><p>Cat</p>");
});

test("the replacement keeps the marks at the start of the match", () => {
  const { editor } = renderEditor({ defaultValue: "<p><strong>cat</strong> dog</p>" });
  act(() => void editor.commands.setSearch("cat", OPTIONS));
  act(() => void editor.commands.replaceMatch("cow"));
  expect(editor.getHTML()).toBe("<p><strong>cow</strong> dog</p>");
});

test("with a regex the replacement understands $1…$9; without it $ is literal", () => {
  const regex = renderEditor({ defaultValue: "<p>a1 b2</p>" });
  act(() => void regex.editor.commands.setSearch("(\\w)(\\d)", { ...OPTIONS, regex: true }));
  act(() => void regex.editor.commands.replaceAllMatches("$2$1"));
  expect(regex.editor.getText()).toBe("1a 2b");
  cleanup();

  const plain = renderEditor({ defaultValue: "<p>price</p>" });
  act(() => void plain.editor.commands.setSearch("price", OPTIONS));
  act(() => void plain.editor.commands.replaceAllMatches("$1"));
  expect(plain.editor.getText()).toBe("$1");
});

test("a regex replacement keeps its context: lookbehind and lookahead still replace", () => {
  const { editor } = renderEditor({ defaultValue: "<p>ab cb abc</p>" });
  act(() => void editor.commands.setSearch("(?<=a)b(?=c)", { ...OPTIONS, regex: true }));
  expect(searchState(editor.state)?.total).toBe(1);
  act(() => void editor.commands.replaceAllMatches("[$&]"));
  expect(editor.getText()).toBe("ab cb a[b]c");
});

test("an empty replacement deletes the match", () => {
  const { editor } = renderEditor({ defaultValue: "<p>a cat b</p>" });
  act(() => void editor.commands.setSearch(" cat", OPTIONS));
  act(() => void editor.commands.replaceAllMatches(""));
  expect(editor.getText()).toBe("a b");
});

test("a read-only field highlights but does not replace", () => {
  const { editor } = renderEditor({ defaultValue: "<p>cat</p>", readOnly: true });
  act(() => void editor.commands.setSearch("cat", OPTIONS));
  expect(searchState(editor.state)?.total).toBe(1);
  let replaced = true;
  act(() => void (replaced = editor.commands.replaceAllMatches("cow")));
  expect(replaced).toBe(false);
  expect(editor.getText()).toBe("cat");
});

test("clearing the search removes the highlight", () => {
  const { editor } = renderEditor({ defaultValue: "<p>cat</p>" });
  act(() => void editor.commands.setSearch("cat", OPTIONS));
  act(() => void editor.commands.clearSearch());
  expect(editor.view.dom.querySelectorAll(".rte-search-match")).toHaveLength(0);
  expect(searchState(editor.state)?.total).toBe(0);
});

test("without the search tool the editor has no search state", () => {
  const { editor } = renderEditor({ tools: ["bold", "italic"], defaultValue: "<p>cat</p>" });
  expect(searchState(editor.state)).toBeUndefined();
});
