// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import type { Editor } from "@tiptap/react";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createRef } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import {
  RICH_TEXT_PRESETS,
  RichTextEditor,
  type RichTextEditorHandle,
  type RichTextEditorProps,
} from "../src/editor/index.js";
import {
  cleanPastedHtml,
  type PasteCleanupStep,
} from "../src/editor/features/pasteCleanup/cleanPastedHtml.js";
import { resetDevWarnings } from "../src/lib/dev-warn.js";
import { loadLazyBuiltins } from "./editor-lazy-builtins.js";

/*
  Paste cleanup (OLDSUI-274): clipboard HTML from Word, Excel, Google Docs and SharePoint is turned
  into markup the Schema understands before the Schema parses it. The fixtures are real clipboard
  captures (`fixtures/paste/`, their origin is in `fixtures/paste/NOTICE`): what each browser put
  on the clipboard, not HTML written by hand.
*/

beforeAll(loadLazyBuiltins);
beforeEach(resetDevWarnings);
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const FIXTURES = resolve(import.meta.dirname, "..", "fixtures", "paste");

interface Fixture {
  "text/html": string;
  "text/plain": string;
}

function fixture(name: string): Fixture {
  return JSON.parse(readFileSync(join(FIXTURES, `${name}.json`), "utf8")) as Fixture;
}

function renderEditor(props: Partial<RichTextEditorProps> = {}) {
  const ref = createRef<RichTextEditorHandle>();
  render(<RichTextEditor ref={ref} aria-label="Body" {...props} />);
  const handle = ref.current;
  if (!handle?.editor) throw new Error("the editor was not created inside render()");
  return { handle, editor: handle.editor };
}

function paste(editor: Editor, payload: { text?: string; html?: string }) {
  const event = new Event("paste", { bubbles: true, cancelable: true });
  Object.assign(event, {
    clipboardData: {
      getData: (type: string) =>
        (type === "text/plain" ? payload.text : type === "text/html" ? payload.html : "") ?? "",
      types: Object.keys(payload).map((key) => (key === "text" ? "text/plain" : "text/html")),
    },
  });
  act(() => void editor.view.dom.dispatchEvent(event));
}

/** Paste a fixture into an empty Editor and return the saved HTML. */
function pasted(name: string, props: Partial<RichTextEditorProps> = {}): string {
  const { editor, handle } = renderEditor(props);
  const { "text/html": html, "text/plain": text } = fixture(name);
  paste(editor, { html, text });
  return handle.getHTML();
}

const NUMBERED =
  "<ol><li><p>First step</p><ol><li><p>Sub-step a</p><ol><li><p>Detail i</p></li>" +
  "<li><p>Detail ii</p></li></ol></li><li><p>Sub-step b</p></li></ol></li>" +
  "<li><p>Second step</p><ul><li><p>A bullet inside a numbered list</p></li></ul></li>" +
  "<li><p>Third step</p></li></ol>";
const FROM_THREE = '<ol start="3"><li><p>Item three</p></li><li><p>Item four</p></li></ol>';
const ROMAN = "<ol><li><p>Part one</p></li><li><p>Part two</p></li></ol>";
const BULLETS =
  "<ul><li><p>Apples</p><ul><li><p>Green apples</p><ul><li><p>Granny Smith</p></li>" +
  "<li><p>Golden Delicious</p></li></ul></li><li><p>Red apples</p></li></ul></li>" +
  "<li><p>Pears with <strong>bold</strong> inside</p></li><li><p>Plums</p></li></ul>";

describe("Word lists", () => {
  test.each(["chrome", "safari", "firefox"])(
    "a numbered list from Word for Mac in %s keeps its nesting and its start",
    (browser) => {
      const html = pasted(`word-mac-${browser}-lists-numbered`);

      expect(html).toContain(NUMBERED);
      expect(html).toContain(FROM_THREE);
      expect(html).toContain(ROMAN);
      // The list markers Word writes into the text are gone.
      expect(html).not.toMatch(/<p>(?:\d+|[a-z]|[ivx]+)\.(?:&nbsp;|\s)/);
    }
  );

  test.each(["chrome", "safari", "firefox"])(
    "a bullet list from Word for Mac in %s keeps its three levels",
    (browser) => {
      const html = pasted(`word-mac-${browser}-lists-bullet`);

      expect(html).toContain(BULLETS);
      expect(html).not.toMatch(/[•◦▪·]/);
    }
  );

  test("a list from Word 2007 on Windows without mso-list still becomes a list", () => {
    const html = pasted("word-win-firefox-lists");

    const items = Array.from({ length: 6 }, (_, i) => `<li><p>Item ${i + 1}</p></li>`).join("");
    expect(html).toContain(`<ul>${items}</ul>`);
    expect(html).not.toContain("·");
  });

  test("without pasteCleanup in tools, a Word list stays paragraphs, as before", () => {
    const html = pasted("word-mac-chrome-lists-bullet", {
      tools: RICH_TEXT_PRESETS.full.filter((tool) => tool !== "pasteCleanup"),
    });

    expect(html).not.toContain("<ul>");
  });
});

describe("the cleanup function", () => {
  test("HTML from other sources passes through byte-identical", () => {
    const browserPage =
      `<meta charset='utf-8'><span style="color: rgb(31, 35, 40);">See </span>` +
      `<a href="https://example.com/docs">the docs</a><p style="background: yellow">Note</p>`;
    const vscode =
      '<meta charset="utf-8"><div style="color: #cccccc;background-color: #1f1f1f;">' +
      '<div><span style="color: #569cd6;">const</span> a = 1;</div></div>';

    expect(cleanPastedHtml(browserPage)).toBe(browserPage);
    expect(cleanPastedHtml(vscode)).toBe(vscode);
  });

  test("a step that throws leaves the original HTML and warns in development", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const broken: PasteCleanupStep = {
      name: "broken",
      applies: () => true,
      run: () => {
        throw new Error("boom");
      },
    };
    const html = fixture("word-mac-chrome-lists-bullet")["text/html"];

    expect(cleanPastedHtml(html, [broken])).toBe(html);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"broken"'));
  });
});

test("pasteCleanup is in both presets", () => {
  expect(RICH_TEXT_PRESETS.full).toContain("pasteCleanup");
  expect(RICH_TEXT_PRESETS.basic).toContain("pasteCleanup");
});
