// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { createRef, type ReactNode } from "react";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { UiProvider } from "../src/i18n/UiProvider.js";
import { messages as ru } from "../src/locales/ru.js";
import {
  RICH_TEXT_PRESETS,
  RichTextEditor,
  tool,
  useRichTextToolState,
  type RichTextEditorHandle,
  type RichTextEditorProps,
} from "../src/editor/index.js";
import { PRESETS } from "../src/editor/core/tools.js";
import { resetDevWarnings } from "../src/lib/dev-warn.js";
import { loadLazyBuiltins } from "./editor-lazy-builtins.js";

// Lazy `codeBlock` and `table`: `full` is ready in `render` once the chunks load.
beforeAll(loadLazyBuiltins);

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  document.documentElement.removeAttribute("lang");
  resetDevWarnings();
});

/**
 * Text part language (OLDSUI-308, ADR-0078): the `language` Tool, a `span[lang]` Mark, through the
 * public `RichTextEditor` and its Handle. The texts are Latin: the i18n gate keeps Cyrillic out of
 * the tests, and the rules do not depend on the alphabet.
 */

const TOOLS = ["bold", "italic", "link", "color", "highlight", "language", "history"] as const;

function renderEditor(
  props: Partial<RichTextEditorProps> = {},
  wrap: (children: ReactNode) => ReactNode = (children) => children
) {
  const ref = createRef<RichTextEditorHandle>();
  const element = (next: Partial<RichTextEditorProps>) =>
    wrap(<RichTextEditor ref={ref} aria-label="Body" tools={[...TOOLS]} {...props} {...next} />);
  const view = render(element({}));
  const editor = ref.current?.editor;
  if (!editor) throw new Error("the editor was not created inside render()");
  return { ...view, editor, handle: ref.current! };
}

const paste = (editor: NonNullable<RichTextEditorHandle["editor"]>, html: string) =>
  act(() => void editor.view.pasteHTML(html, new Event("paste") as ClipboardEvent));

// ---------------------------------------------------------------- the Tool and the presets

test("language is in full and not in basic", () => {
  expect(PRESETS.full).toContain("language");
  expect(RICH_TEXT_PRESETS.full).toContain("language");
  expect(PRESETS.basic).not.toContain("language");
});

test("the Document keeps a span[lang] it was given, in its canonical case", () => {
  const { handle } = renderEditor({
    defaultValue: '<p>one <span lang="EN-us">two</span> <span lang="de">three</span></p>',
  });
  expect(handle.getHTML()).toBe(
    '<p>one <span lang="en-US">two</span> <span lang="de">three</span></p>'
  );
});

test("a value that is not a language tag loses the wrapper, and the text stays", () => {
  const { handle } = renderEditor({
    defaultValue: '<p>one <span lang="x-none">two</span> <span lang="">three</span></p>',
  });
  expect(handle.getHTML()).toBe("<p>one two three</p>");
});

test("without the language tool a span[lang] is plain text, not a loss of the words", () => {
  const { handle } = renderEditor({
    tools: ["bold"],
    defaultValue: '<p>one <span lang="en">two</span></p>',
  });
  expect(handle.getHTML()).toBe("<p>one two</p>");
});

test("the language Mark is the outermost: it wraps the color, the highlight, the link and bold", () => {
  const { handle } = renderEditor({
    defaultValue:
      '<p><strong><a href="https://example.com"><mark data-color="yellow"><span data-color="danger"><span lang="en">x</span></span></mark></a></strong></p>',
  });
  expect(handle.getHTML()).toBe(
    '<p><span lang="en"><span data-color="danger"><mark data-color="yellow">' +
      '<a href="https://example.com" rel="noopener noreferrer"><strong>x</strong></a></mark></span></span></p>'
  );
});

test("a language and a text color on the same element are both read", () => {
  const { handle } = renderEditor({
    defaultValue: '<p><span lang="en" data-color="danger">x</span></p>',
  });
  expect(handle.getHTML()).toBe('<p><span lang="en"><span data-color="danger">x</span></span></p>');
});

// ---------------------------------------------------------------- commands and state

function select(editor: NonNullable<RichTextEditorHandle["editor"]>, from: number, to = from) {
  act(() => void editor.commands.setTextSelection({ from, to }));
}

test("set() marks the selection, and the Document comes out as span[lang]", () => {
  const { editor, handle } = renderEditor({ defaultValue: "<p>one two three</p>" });
  select(editor, 5, 8);
  let done = false;
  act(() => void (done = handle.tool("language")!.set("de")));
  expect(done).toBe(true);
  expect(handle.getHTML()).toBe('<p>one <span lang="de">two</span> three</p>');
});

test("set() writes the tag in its canonical case, and rejects what is not a tag", () => {
  const { editor, handle } = renderEditor({ defaultValue: "<p>one two</p>" });
  select(editor, 1, 4);
  let done = true;
  act(() => void (done = handle.tool("language")!.set("not a tag")));
  expect(done).toBe(false);
  expect(handle.getHTML()).toBe("<p>one two</p>");
  act(() => void handle.tool("language")!.set("PT-br"));
  expect(handle.getHTML()).toBe('<p><span lang="pt-BR">one</span> two</p>');
});

test("set() with another language replaces the mark; unset() removes it", () => {
  const { editor, handle } = renderEditor({
    defaultValue: '<p>one <span lang="de">two</span> three</p>',
  });
  select(editor, 5, 8);
  act(() => void handle.tool("language")!.set("fr"));
  expect(handle.getHTML()).toBe('<p>one <span lang="fr">two</span> three</p>');
  let done = false;
  act(() => void (done = handle.tool("language")!.unset()));
  expect(done).toBe(true);
  expect(handle.getHTML()).toBe("<p>one two three</p>");
});

test("a caret inside a marked word changes and removes the whole word", () => {
  const { editor, handle } = renderEditor({
    defaultValue: '<p>one <span lang="de">two</span> three</p>',
  });
  select(editor, 6);
  act(() => void handle.tool("language")!.set("fr"));
  expect(handle.getHTML()).toBe('<p>one <span lang="fr">two</span> three</p>');
  select(editor, 7);
  act(() => void handle.tool("language")!.unset());
  expect(handle.getHTML()).toBe("<p>one two three</p>");
});

test("the primary language is never a mark: set() with it clears the mark", () => {
  document.documentElement.setAttribute("lang", "en-US");
  const { editor, handle } = renderEditor({
    defaultValue: '<p>one <span lang="de">two</span> three</p>',
  });
  select(editor, 1, 4);
  let done = false;
  act(() => void (done = handle.tool("language")!.set("en")));
  expect(done).toBe(true);
  expect(handle.getHTML()).toBe('<p>one <span lang="de">two</span> three</p>');
  select(editor, 5, 8);
  act(() => void handle.tool("language")!.set("EN-us"));
  expect(handle.getHTML()).toBe("<p>one two three</p>");
});

test("the commands give false in readOnly", () => {
  const { editor, handle } = renderEditor({ defaultValue: "<p>one two</p>", readOnly: true });
  select(editor, 1, 4);
  let done = true;
  act(() => void (done = handle.tool("language")!.set("de")));
  expect(done).toBe(false);
  expect(handle.getHTML()).toBe("<p>one two</p>");
});

function StateProbe({
  handleRef,
  onState,
}: {
  handleRef: React.RefObject<RichTextEditorHandle | null>;
  onState: (state: { current: string | null; primary: string } | null) => void;
}) {
  onState(useRichTextToolState(handleRef, "language"));
  return null;
}

test("the state is { current, primary }: the language under the cursor and the page's", () => {
  document.documentElement.setAttribute("lang", "ru");
  const ref = createRef<RichTextEditorHandle>();
  const seen: ({ current: string | null; primary: string } | null)[] = [];
  render(
    <>
      <RichTextEditor
        ref={ref}
        aria-label="Body"
        tools={[...TOOLS]}
        defaultValue='<p>one <span lang="de">two</span> three <span lang="fr">four</span></p>'
      />
      <StateProbe handleRef={ref} onState={(state) => seen.push(state)} />
    </>
  );
  const editor = ref.current!.editor!;
  const last = () => seen.at(-1);

  select(editor, 1);
  expect(last()).toEqual({ current: null, primary: "ru" });
  select(editor, 6);
  expect(last()).toEqual({ current: "de", primary: "ru" });
  // A selection that spans two languages, or a language and plain text, has no single language.
  select(editor, 6, 14);
  expect(last()).toEqual({ current: null, primary: "ru" });
  select(editor, 5, 8);
  expect(last()).toEqual({ current: "de", primary: "ru" });
});

test("without any lang on the page the primary language is the interface locale", () => {
  const ref = createRef<RichTextEditorHandle>();
  const seen: ({ current: string | null; primary: string } | null)[] = [];
  render(
    <UiProvider locale="ru-RU" messages={ru}>
      <RichTextEditor ref={ref} aria-label="Body" tools={[...TOOLS]} defaultValue="<p>one</p>" />
      <StateProbe handleRef={ref} onState={(state) => seen.push(state)} />
    </UiProvider>
  );
  expect(seen.at(-1)?.primary).toBe("ru-RU");
});

test("the nearest lang above the field wins over the interface locale", () => {
  const ref = createRef<RichTextEditorHandle>();
  const seen: ({ current: string | null; primary: string } | null)[] = [];
  document.documentElement.setAttribute("lang", "en");
  render(
    <UiProvider locale="ru-RU" messages={ru}>
      <section lang="de-ch">
        <RichTextEditor ref={ref} aria-label="Body" tools={[...TOOLS]} defaultValue="<p>one</p>" />
      </section>
      <StateProbe handleRef={ref} onState={(state) => seen.push(state)} />
    </UiProvider>
  );
  expect(seen.at(-1)?.primary).toBe("de-CH");
});

// ---------------------------------------------------------------- options

test("the languages option has a default, and a bad value falls back with one console.error", () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  renderEditor({ tools: ["bold", tool("language", { languages: ["not a tag"] })] });
  expect(error).toHaveBeenCalledTimes(1);
  expect(String(error.mock.calls[0]?.[0])).toContain('tool "language"');
  expect(String(error.mock.calls[0]?.[0])).toContain("languages");
});

// ---------------------------------------------------------------- paste

test("paste keeps Word's lang, in its canonical case", () => {
  document.documentElement.setAttribute("lang", "ru");
  const { editor, handle } = renderEditor({ defaultValue: "<p></p>" });
  paste(
    editor,
    "<html><body><p class=MsoNormal><span lang=EN-US style='mso-ansi-language:EN-US'>Hello</span>" +
      " <span lang=DE>Welt</span></p></body></html>"
  );
  expect(handle.getHTML()).toBe(
    '<p><span lang="en-US">Hello</span> <span lang="de">Welt</span></p>'
  );
});

test("paste drops the mark that repeats the page's language, and keeps the text", () => {
  document.documentElement.setAttribute("lang", "ru-RU");
  const { editor, handle } = renderEditor({ defaultValue: "<p></p>" });
  paste(
    editor,
    '<p><span lang="RU">own</span> <span lang="ru-RU">same</span> <span lang="en">other</span></p>'
  );
  expect(handle.getHTML()).toBe('<p>own same <span lang="en">other</span></p>');
});

test("Word's lang=EN-US on a page in bare en gives no marks; another language keeps its mark", () => {
  document.documentElement.setAttribute("lang", "en");
  const { editor, handle } = renderEditor({ defaultValue: "<p></p>" });
  paste(
    editor,
    "<html><body><p class=MsoNormal><span lang=EN-US>Hello</span> <span lang=EN-GB>there</span> " +
      "<span lang=en>again</span> <span lang=DE>Welt</span></p></body></html>"
  );
  expect(handle.getHTML()).toBe('<p>Hello there again <span lang="de">Welt</span></p>');
});

test("a paste keeps a regional English mark on a page in another language", () => {
  document.documentElement.setAttribute("lang", "ru");
  const { editor, handle } = renderEditor({ defaultValue: "<p></p>" });
  paste(editor, '<p><span lang="EN-GB">colour</span> <span lang="ru-RU">own</span></p>');
  expect(handle.getHTML()).toBe('<p><span lang="en-GB">colour</span> own</p>');
});

test("the author's own set() and a value stay strict: en-GB on an en page is a real mark", () => {
  document.documentElement.setAttribute("lang", "en");
  const { editor, handle } = renderEditor({
    defaultValue: '<p>one two <span lang="en-US">kept</span></p>',
  });
  expect(handle.getHTML()).toBe('<p>one two <span lang="en-US">kept</span></p>');
  select(editor, 1, 4);
  act(() => void handle.tool("language")!.set("en-GB"));
  expect(handle.getHTML()).toBe(
    '<p><span lang="en-GB">one</span> two <span lang="en-US">kept</span></p>'
  );
});

test("a span with lang and data-type (an inline formula) makes no language mark", () => {
  const { handle } = renderEditor({
    tools: [...TOOLS, "mathematics"],
    defaultValue: '<p>a <span data-type="inline-math" data-latex="x^2" lang="en"></span> b</p>',
  });
  const html = handle.getHTML();
  // The formula survives as it is written, and nothing is marked around it.
  expect(html).toContain('data-type="inline-math"');
  expect(html).toContain('data-latex="x^2"');
  expect(html).not.toContain("lang");
});

test("Google Docs and browsers: a plain span[lang] survives the paste", () => {
  const { editor, handle } = renderEditor({ defaultValue: "<p></p>" });
  paste(editor, '<meta charset="utf-8"><p>a <span lang="fr">b</span></p>');
  expect(handle.getHTML()).toBe('<p>a <span lang="fr">b</span></p>');
});

test("without the tool a pasted lang is dropped, and the words stay", () => {
  const { editor, handle } = renderEditor({ tools: ["bold"], defaultValue: "<p></p>" });
  paste(editor, '<p>a <span lang="fr">b</span></p>');
  expect(handle.getHTML()).toBe("<p>a b</p>");
});

// ---------------------------------------------------------------- Clear formatting

test("Clear formatting (the command behind the item and the shortcut) leaves the language and removes the looks", () => {
  const { editor, handle } = renderEditor({
    defaultValue: '<p><span lang="de"><strong>one</strong> two</span></p>',
  });
  select(editor, 1, 8);
  act(() => void editor.commands.unsetAllMarks());
  expect(handle.getHTML()).toBe('<p><span lang="de">one two</span></p>');
});

test("⌘\\ does not remove the language either", () => {
  const { editor, handle } = renderEditor({
    tools: [...TOOLS, "clearFormatting"],
    defaultValue: '<p><span lang="de"><strong>one</strong> two</span></p>',
  });
  select(editor, 1, 8);
  // Real `keyCode`, as in a browser: ProseMirror's keymap reads it.
  const event = new KeyboardEvent("keydown", {
    key: "\\",
    ctrlKey: true,
    bubbles: true,
    cancelable: true,
  });
  Object.defineProperty(event, "keyCode", { value: 220 });
  act(() => void editor.view.dom.dispatchEvent(event));
  expect(event.defaultPrevented).toBe(true);
  expect(handle.getHTML()).toBe('<p><span lang="de">one two</span></p>');
});
