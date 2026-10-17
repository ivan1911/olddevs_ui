// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, beforeAll, describe, expect, test } from "vitest";
import {
  RICH_TEXT_PRESETS,
  RichTextEditor,
  type RichTextEditorHandle,
} from "../src/editor/index.js";
import { findMatches, type SearchOptions } from "../src/editor/features/search/searchMatch.js";
import { loadLazyBuiltins } from "./editor-lazy-builtins.js";

// The code Block and the table are lazy (OLDSUI-111): `full` is ready in `render` after the chunks load.
beforeAll(loadLazyBuiltins);
afterEach(cleanup);

/**
 * Find in the Document (OLDSUI-151): a pure function "Document + query + options →
 * matches". The Document is real, built from the Editor Schema: matches are measured in
 * ProseMirror positions, and the check "text between positions equals the found text"
 * catches a shift by one that is not visible to the eye.
 */
function docOf(html: string) {
  const ref = createRef<RichTextEditorHandle>();
  render(
    <RichTextEditor
      ref={ref}
      aria-label="Body"
      tools={RICH_TEXT_PRESETS.full}
      defaultValue={html}
    />
  );
  const editor = ref.current?.editor;
  if (!editor) throw new Error("the editor was not created inside render()");
  return editor.state.doc;
}

const NONE: SearchOptions = { matchCase: false, wholeWord: false, regex: false };

function texts(html: string, query: string, options: Partial<SearchOptions> = {}) {
  const doc = docOf(html);
  const result = findMatches(doc, query, { ...NONE, ...options });
  return { ...result, texts: result.matches.map(({ from, to }) => doc.textBetween(from, to)) };
}

describe("findMatches", () => {
  test("ignores case by default and respects it on request", () => {
    expect(texts("<p>Cat cat CAT</p>", "cat").texts).toEqual(["Cat", "cat", "CAT"]);
    expect(texts("<p>Cat cat CAT</p>", "cat", { matchCase: true }).texts).toEqual(["cat"]);
  });

  test("finds text across a mark boundary", () => {
    expect(texts("<p>bo<strong>ld</strong> text</p>", "bold").texts).toEqual(["bold"]);
  });

  test("does not match across blocks or across an inline atom", () => {
    expect(texts("<p>ab</p><p>cd</p>", "bc").matches).toEqual([]);
    expect(texts("<p>ab<br>cd</p>", "bc").matches).toEqual([]);
  });

  test("searches table cells and code blocks", () => {
    expect(
      texts(
        "<table><tbody><tr><td><p>plan</p></td></tr></tbody></table><pre><code>let plan</code></pre>",
        "plan"
      ).texts
    ).toEqual(["plan", "plan"]);
  });

  test("whole words: Latin and Cyrillic", () => {
    expect(texts("<p>cat category cat.</p>", "cat", { wholeWord: true }).texts).toEqual([
      "cat",
      "cat",
    ]);
    expect(texts("<p>кот котик кот</p>", "кот", { wholeWord: true }).texts).toEqual(["кот", "кот"]);
  });

  test("treats the query as text, not a pattern, without regex", () => {
    expect(texts("<p>1+1=2 and 11</p>", "1+1").texts).toEqual(["1+1"]);
  });

  test("regex: finds the pattern, reports an invalid one as an error", () => {
    expect(texts("<p>a1 b22 c</p>", "\\d+", { regex: true }).texts).toEqual(["1", "22"]);
    const broken = texts("<p>a1</p>", "(", { regex: true });
    expect(broken.matches).toEqual([]);
    expect(broken.error).toBeTruthy();
  });

  test("a regex that is valid only without the unicode flag still works", () => {
    expect(texts("<p>a-b</p>", "a\\-b", { regex: true }).texts).toEqual(["a-b"]);
  });

  test("skips empty matches a regex can produce", () => {
    expect(texts("<p>abc</p>", "x*", { regex: true }).matches).toEqual([]);
  });

  test("an empty query finds nothing and is not an error", () => {
    const empty = texts("<p>abc</p>", "");
    expect(empty.matches).toEqual([]);
    expect(empty.error).toBeUndefined();
  });
});
