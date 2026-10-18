// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, beforeAll, expect, test } from "vitest";
import {
  RichTextEditor,
  type RichTextEditorHandle,
  type RichTextEditorProps,
} from "../src/editor/index.js";
import { loadLazyBuiltins } from "./editor-lazy-builtins.js";

beforeAll(loadLazyBuiltins);
afterEach(cleanup);

/**
 * The language Mark in Markdown and in the JSON envelope (OLDSUI-308, ADR-0078, decision 8):
 * Markdown has no language, so the text stays and the mark is lost, like the color; JSON keeps the
 * whole Document and checks the tag by the same rules as HTML.
 */

function renderEditor(props: Partial<RichTextEditorProps> = {}) {
  const ref = createRef<RichTextEditorHandle>();
  render(<RichTextEditor ref={ref} aria-label="Body" {...props} />);
  return ref.current!;
}

const DOCUMENT =
  '<p>one <span lang="de">two <strong>three</strong></span> <span lang="en-US">four</span></p>';

test("getMarkdown keeps the text and drops the mark: no span, no lang in the file", () => {
  const handle = renderEditor({ defaultValue: DOCUMENT });
  const markdown = handle.getMarkdown()!;
  expect(markdown).toBe("one two **three** four");
  expect(markdown).not.toMatch(/span|lang/);
});

test("setMarkdown(getMarkdown()) returns the Document without the language", () => {
  const handle = renderEditor({ defaultValue: DOCUMENT });
  const markdown = handle.getMarkdown()!;
  act(() => void handle.setMarkdown(markdown));
  expect(handle.getHTML()).toBe("<p>one two <strong>three</strong> four</p>");
});

test("JSON keeps the language: getJSON then setJSON brings the marks back", () => {
  const source = renderEditor({ defaultValue: DOCUMENT });
  const exported = source.getJSON()!;
  expect(JSON.stringify(exported)).toContain('"lang":"de"');
  cleanup();

  const target = renderEditor({ defaultValue: "<p>empty</p>" });
  let accepted = false;
  act(() => void (accepted = target.setJSON(JSON.parse(JSON.stringify(exported)))));
  expect(accepted).toBe(true);
  expect(target.getHTML()).toBe(DOCUMENT);
});

test("JSON is checked as HTML is: a lang that is not a tag is dropped, a case is fixed", () => {
  const handle = renderEditor();
  const text = (value: string, lang: unknown) => ({
    type: "text",
    text: value,
    marks: [{ type: "language", attrs: { lang } }],
  });
  const envelope = {
    format: "olddevs-rich-text",
    version: 1,
    doc: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [text("a", "FR-ca"), { type: "text", text: " " }, text("b", "<script>")],
        },
      ],
    },
  };
  act(() => void handle.setJSON(envelope));
  expect(handle.getHTML()).toBe('<p><span lang="fr-CA">a</span> b</p>');
});
