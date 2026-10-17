// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import type { Editor } from "@tiptap/react";
import { createRef, type ReactNode } from "react";
import { afterEach, beforeAll, beforeEach, expect, test, vi } from "vitest";
import { UiProvider } from "../src/i18n/UiProvider.js";
import { messages as ru } from "../src/locales/ru.js";
import {
  RICH_TEXT_PRESETS,
  RichTextEditor,
  tool,
  type RichTextEditorHandle,
  type RichTextEditorProps,
} from "../src/editor/index.js";
import { resetDevWarnings } from "../src/lib/dev-warn.js";
import { doubleQuoteFor, openRussianQuotes } from "../src/editor/features/typography/typography.js";
import { loadLazyBuiltins } from "./editor-lazy-builtins.js";

// Lazy `codeBlock` (OLDSUI-111): an Editor with it is ready in `render` once the chunk loads.
beforeAll(loadLazyBuiltins);

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/**
 * The `typography` Tool (OLDSUI-279): autoreplacements while typing, from the Tiptap
 * Typography extension.
 *
 * Through the public `RichTextEditor` with a specific `tools`. Input takes the same path that
 * ProseMirror receives it from the browser (`handleTextInput`), where the input rules hang.
 * The texts in the tests are Latin: the rules do not depend on the alphabet of the words, and
 * the i18n gate does not let Cyrillic into the tests without a reason.
 */

const TYPOGRAPHY = ["typography", "history", "bold", "code", "codeBlock"] as const;

function renderEditor(
  props: Partial<RichTextEditorProps> = {},
  wrap: (children: ReactNode) => ReactNode = (children) => children
) {
  const ref = createRef<RichTextEditorHandle>();
  const element = (next: Partial<RichTextEditorProps>) =>
    wrap(
      <RichTextEditor ref={ref} aria-label="Body" tools={[...TYPOGRAPHY]} {...props} {...next} />
    );
  const view = render(element({}));
  const editor = ref.current?.editor;
  if (!editor) throw new Error("the editor was not created inside render()");
  return { ...view, editor, handle: ref.current! };
}

/** The kit catalog in UiProvider: Russian comes with its locale, as the consumer wires it up. */
const inRussian = (children: ReactNode) => (
  <UiProvider locale="ru-RU" messages={ru}>
    {children}
  </UiProvider>
);

/** Types text the way ProseMirror receives it from the browser. */
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

/** `keydown` on the document; `true` means the Editor let the browser handle the key. */
function press(editor: Editor, key: string, init: KeyboardEventInit & { keyCode?: number } = {}) {
  const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init });
  if (init.keyCode !== undefined) Object.defineProperty(event, "keyCode", { value: init.keyCode });
  act(() => void editor.view.dom.dispatchEvent(event));
  return !event.defaultPrevented;
}

const backspace = (editor: Editor) => press(editor, "Backspace", { keyCode: 8 });
const undo = (editor: Editor) => press(editor, "z", { ctrlKey: true, keyCode: 90 });

/** The Document's text on one line: no tags, and the replacements are visible as characters. */
const text = (editor: Editor) => editor.getText();

// ── Tiptap rules, all enabled ────────────────────────────────────────────

const RULES: readonly (readonly [string, string, string])[] = [
  ["em dash", "a--", "a—"],
  ["ellipsis", "a...", "a…"],
  ["left arrow", "a <-", "a ←"],
  ["right arrow", "a ->", "a →"],
  ["copyright", "(c)", "©"],
  ["trademark", "(tm)", "™"],
  ["servicemark", "(sm)", "℠"],
  ["registered", "(r)", "®"],
  ["one half", "1/2 ", "½ "],
  ["one quarter", "1/4 ", "¼ "],
  ["three quarters", "3/4 ", "¾ "],
  ["plus minus", "+/-", "±"],
  ["not equal", "a !=", "a ≠"],
  ["laquo", "<<", "«"],
  ["raquo", ">>", "»"],
  ["multiplication", "2x3", "2×3"],
  ["superscript two", "m^2", "m²"],
  ["superscript three", "m^3", "m³"],
  ["double quotes", '"a"', "“a”"],
  ["single quotes", "'a'", "‘a’"],
  ["apostrophe", "it's", "it’s"],
];

test.each(RULES)("%s: typed characters are replaced", (_name, typed, expected) => {
  const { editor } = renderEditor();
  typeText(editor, typed);
  expect(text(editor)).toBe(expected);
});

// ── Quotes by catalog language ───────────────────────────────────────────

test("the English catalog types curly double and single quotes", () => {
  const { editor } = renderEditor();
  typeText(editor, `He said "go" and 'stop'`);
  expect(text(editor)).toBe("He said “go” and ‘stop’");
});

test("without a provider the catalog is the English fallback", () => {
  const { editor } = renderEditor({ tools: [tool("typography")] });
  typeText(editor, '"a"');
  expect(text(editor)).toBe("“a”");
});

test("the Russian catalog types guillemets for a double quote", () => {
  const { editor } = renderEditor({}, inRussian);
  typeText(editor, '"word"');
  expect(text(editor)).toBe("«word»");
});

test("the Russian catalog nests low-9 quotes inside guillemets", () => {
  const { editor } = renderEditor({}, inRussian);
  typeText(editor, 'a "b "c" d" e');
  expect(text(editor)).toBe("a «b „c“ d» e");
});

test("a quote after a nested pair closes the outer guillemets", () => {
  const { editor } = renderEditor({}, inRussian);
  typeText(editor, '"a "b""');
  expect(text(editor)).toBe("«a „b“»");
});

test("nesting is counted in the current text block only", () => {
  const { editor } = renderEditor({}, inRussian);
  typeText(editor, '"open');
  act(() => void editor.commands.splitBlock());
  typeText(editor, '"x"');
  expect(text(editor)).toBe("«open\n\n«x»");
});

test("a single quote in the Russian catalog keeps the Tiptap rules", () => {
  const { editor } = renderEditor({}, inRussian);
  typeText(editor, "it's 'q'");
  expect(text(editor)).toBe("it’s ‘q’");
});

test("the other Tiptap rules work the same in the Russian catalog", () => {
  const { editor } = renderEditor({}, inRussian);
  typeText(editor, "a-- b... (c)");
  expect(text(editor)).toBe("a— b… ©");
});

test("auto follows the catalog when it changes while the editor is mounted", () => {
  const ref = createRef<RichTextEditorHandle>();
  const field = <RichTextEditor ref={ref} aria-label="Body" tools={[...TYPOGRAPHY]} />;
  const view = render(<UiProvider locale="en-US">{field}</UiProvider>);
  const editor = ref.current!.editor!;
  typeText(editor, '"a" ');

  view.rerender(
    <UiProvider locale="ru-RU" messages={ru}>
      {field}
    </UiProvider>
  );
  // The same Editor: the engine was not recreated, but the quote set was read again.
  expect(ref.current!.editor).toBe(editor);
  typeText(editor, '"b"');
  expect(text(editor)).toBe("\u201Ca\u201D \u00ABb\u00BB");
});

test("quotes: ru gives guillemets under the English catalog", () => {
  const { editor } = renderEditor({ tools: [tool("typography", { quotes: "ru" })] });
  typeText(editor, '"a "b" c"');
  expect(text(editor)).toBe("«a „b“ c»");
});

test("quotes: en gives curly quotes under the Russian catalog", () => {
  const { editor } = renderEditor({ tools: [tool("typography", { quotes: "en" })] }, inRussian);
  typeText(editor, '"a"');
  expect(text(editor)).toBe("“a”");
});

test("quotes: auto is the same as no option", () => {
  const { editor } = renderEditor({ tools: [tool("typography", { quotes: "auto" })] }, inRussian);
  typeText(editor, '"a"');
  expect(text(editor)).toBe("«a»");
});

test("an explicit double quote beats the set and turns nesting off", () => {
  const { editor } = renderEditor(
    { tools: [tool("typography", { openDoubleQuote: "[", closeDoubleQuote: "]" })] },
    inRussian
  );
  typeText(editor, '"a "b" c"');
  expect(text(editor)).toBe("[a [b] c]");
});

test("one explicit double quote leaves the other from the set", () => {
  const { editor } = renderEditor(
    { tools: [tool("typography", { openDoubleQuote: "<" })] },
    inRussian
  );
  typeText(editor, '"a"');
  expect(text(editor)).toBe("<a»");
});

test("a double quote switched off with false stays straight", () => {
  const { editor } = renderEditor({ tools: [tool("typography", { openDoubleQuote: false })] });
  typeText(editor, '"a"');
  expect(text(editor)).toBe('"a”');
});

test("both double quotes switched off leave every double quote straight", () => {
  const { editor } = renderEditor({
    tools: [tool("typography", { openDoubleQuote: false, closeDoubleQuote: false })],
  });
  typeText(editor, "\"a\" 'b'");
  expect(text(editor)).toBe('"a" ‘b’');
});

// ── Rule options ─────────────────────────────────────────────────────────

test("a rule switched off with false does not fire, the others do", () => {
  const { editor } = renderEditor({ tools: [tool("typography", { emDash: false })] });
  typeText(editor, "a-- b...");
  expect(text(editor)).toBe("a-- b…");
});

test("a rule string replaces the character", () => {
  const { editor } = renderEditor({
    tools: [tool("typography", { emDash: "–", ellipsis: "...", copyright: "(C)" })],
  });
  typeText(editor, "a-- (c)");
  expect(text(editor)).toBe("a– (C)");
});

test("an invalid option value is ignored with one dev error, the default stays", () => {
  resetDevWarnings();
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  const invalid = { emDash: "", quotes: "de" } as unknown as Parameters<
    typeof tool<"typography">
  >[1];
  const { editor } = renderEditor({ tools: [tool("typography", invalid)] });
  typeText(editor, 'a-- "b"');
  expect(text(editor)).toBe("a— “b”");
  expect(error).toHaveBeenCalledTimes(1);
  expect(String(error.mock.calls[0]?.[0])).toContain("emDash, quotes");
});

// ── Code, undo, value ────────────────────────────────────────────────────

test("nothing is replaced inside the code mark", () => {
  const { editor } = renderEditor({ defaultValue: "<p><code>x</code></p>" });
  act(() => void editor.commands.focus("end"));
  typeText(editor, '-- ... "a" (c)');
  expect(editor.getHTML()).toBe('<p><code>x-- ... "a" (c)</code></p>');
});

test("nothing is replaced inside a code block", () => {
  const { editor } = renderEditor({ defaultValue: "<pre><code>x</code></pre>" });
  act(() => void editor.commands.focus("end"));
  typeText(editor, '-- ... "a" (c)');
  expect(editor.getText()).toBe('x-- ... "a" (c)');
});

test("replacements work right after the code mark ends", () => {
  const { editor } = renderEditor({ defaultValue: "<p><code>x</code> y</p>" });
  act(() => void editor.commands.focus("end"));
  typeText(editor, "--");
  expect(editor.getHTML()).toBe("<p><code>x</code> y—</p>");
});

test("Backspace right after a replacement restores the typed characters", () => {
  const { editor } = renderEditor();
  typeText(editor, "a--");
  expect(text(editor)).toBe("a—");
  expect(backspace(editor)).toBe(false);
  expect(text(editor)).toBe("a--");
});

test("Backspace undoes a double quote and a nested Russian quote the same way", () => {
  const { editor } = renderEditor({}, inRussian);
  typeText(editor, '"a "');
  expect(text(editor)).toBe("«a „");
  backspace(editor);
  expect(text(editor)).toBe('«a "');
});

test("the kit keymap does not block the undo in a list item or with every kit tool on", () => {
  const { editor } = renderEditor({
    tools: [...RICH_TEXT_PRESETS.full, "typography"],
    defaultValue: "<ul><li><p>x</p></li></ul>",
  });
  act(() => void editor.commands.focus("end"));
  typeText(editor, " --");
  expect(editor.getHTML()).toBe("<ul><li><p>x \u2014</p></li></ul>");
  expect(backspace(editor)).toBe(false);
  expect(editor.getHTML()).toBe("<ul><li><p>x --</p></li></ul>");
});

test("Backspace after more typing leaves the replacement alone", () => {
  // Undoing a replacement lasts until the next input or caret move: after that, Backspace
  // is an ordinary key, and the browser, not the Document, deletes the text.
  const { editor } = renderEditor();
  typeText(editor, "a-- b");
  backspace(editor);
  expect(text(editor)).toBe("a\u2014 b");
});

test("Mod+Z right after a replacement brings the typed characters back, the next one removes them", () => {
  // The rule closes history before the replacement (`closeHistory`): the replacement is a
  // separate event, and the first undo restores the typed characters, like Backspace; the
  // second one removes them.
  const { editor } = renderEditor();
  vi.useFakeTimers({ toFake: ["Date"] });
  typeText(editor, "ab");
  // After that, history opens a new group, as after a pause in typing.
  vi.setSystemTime(Date.now() + 2000);
  typeText(editor, "--");
  expect(text(editor)).toBe("ab\u2014");
  expect(undo(editor)).toBe(false);
  expect(text(editor)).toBe("ab--");
  undo(editor);
  expect(text(editor)).toBe("ab");
  vi.useRealTimers();
});

test.each([
  ["English", (children: ReactNode) => children, "\u201C"],
  ["Russian", inRussian, "\u00AB"],
] as const)(
  "Mod+Z right after a quote replacement (%s catalog) brings the typed quote back, the next one removes it",
  (_name, wrap, replaced) => {
    // Quotes are inserted by the kit's own rule (`TypographyQuotes`), not by Tiptap, and
    // its undo is the same as for `--`: the replacement is a separate history event.
    const { editor } = renderEditor({}, wrap);
    vi.useFakeTimers({ toFake: ["Date"] });
    // A space before a quote: that quote is an opening one.
    typeText(editor, "ab ");
    // After that, history opens a new group, as after a pause in typing.
    vi.setSystemTime(Date.now() + 2000);
    typeText(editor, '"');
    expect(text(editor)).toBe(`ab ${replaced}`);
    expect(undo(editor)).toBe(false);
    expect(text(editor)).toBe('ab "');
    undo(editor);
    expect(text(editor)).toBe("ab ");
    vi.useRealTimers();
  }
);

test("the saved HTML holds plain characters and no new tags or attributes", () => {
  const onChange = vi.fn();
  const { editor } = renderEditor({ onChange });
  vi.useFakeTimers();
  typeText(editor, 'a -- "b"... (tm)');
  act(() => void vi.advanceTimersByTime(300));
  vi.useRealTimers();
  expect(editor.getHTML()).toBe("<p>a — “b”… ™</p>");
  expect(onChange).toHaveBeenLastCalledWith("<p>a — “b”… ™</p>");
});

test("the replaced characters survive a round trip through value", () => {
  const html = "<p>a — «„b“»</p>";
  const { editor } = renderEditor({ defaultValue: html, tools: [...TYPOGRAPHY.slice(1)] });
  expect(editor.getHTML()).toBe(html);
});

// ── Outside presets ──────────────────────────────────────────────────────

test("no preset enables typography", () => {
  expect(RICH_TEXT_PRESETS.full).not.toContain("typography");
  expect(RICH_TEXT_PRESETS.basic).not.toContain("typography");
});

test.each(["full", "basic"] as const)("the %s preset does not replace anything", (preset) => {
  const { editor } = renderEditor({ tools: undefined, preset });
  typeText(editor, 'a-- "b"...');
  expect(text(editor)).toBe('a-- "b"...');
});

test("the bare name and the configured entry both enable the tool", () => {
  const bare = renderEditor({ tools: ["typography"] });
  typeText(bare.editor, "a--");
  expect(text(bare.editor)).toBe("a—");
  cleanup();
  const configured = renderEditor({ tools: [tool("typography")] });
  typeText(configured.editor, "a--");
  expect(text(configured.editor)).toBe("a—");
});

test("the tool adds no button to the toolbar", () => {
  const buttons = (tools: RichTextEditorProps["tools"]) => {
    const { container } = renderEditor({ tools });
    const count = container.querySelectorAll("[role=toolbar] button").length;
    cleanup();
    return count;
  };
  expect(buttons(["history", "typography"])).toBe(buttons(["history"]));
});

// ── Quote choice ─────────────────────────────────────────────────────────

beforeEach(() => resetDevWarnings());

test("openRussianQuotes counts only pairs closed by their own mark", () => {
  expect(openRussianQuotes("")).toEqual([]);
  expect(openRussianQuotes("«a „b")).toEqual(["«", "„"]);
  expect(openRussianQuotes("«a „b“")).toEqual(["«"]);
  expect(openRussianQuotes("«a» b")).toEqual([]);
  // A closing quote without its own opening one does not throw off the count.
  expect(openRussianQuotes("«a „b»")).toEqual(["«", "„"]);
});

test("doubleQuoteFor opens after a space or a bracket and closes after a word", () => {
  expect(doubleQuoteFor("en", "")).toBe("“");
  expect(doubleQuoteFor("en", "a ")).toBe("“");
  expect(doubleQuoteFor("en", "(")).toBe("“");
  expect(doubleQuoteFor("en", "a")).toBe("”");
  expect(doubleQuoteFor("ru", "a ")).toBe("«");
  expect(doubleQuoteFor("ru", "a")).toBe("»");
  expect(doubleQuoteFor("ru", "«a ")).toBe("„");
  expect(doubleQuoteFor("ru", "«a„b")).toBe("“");
});
