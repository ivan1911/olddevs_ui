// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeAll, expect, test } from "vitest";
import { RichTextEditor, RichTextView, type RichTextEditorHandle } from "../src/editor/index.js";
import { PAPER_PROSE_CLASS, PROSE_CLASS } from "../src/editor/styles/prose.js";
import { loadLazyBuiltins } from "./editor-lazy-builtins.js";

beforeAll(loadLazyBuiltins);
afterEach(cleanup);

/**
 * The language Mark in the View and in the Editor's look (OLDSUI-308, ADR-0078, decision 6): the
 * View carries `span[lang]` untouched and draws nothing; the Editor draws a thin dotted line, on the
 * `.ProseMirror` content only, in the secondary text color of its surface.
 */

const HTML = '<p>one <span lang="de">two</span> <span lang="en-US">three</span></p>';

test("RichTextView passes span[lang] through as it is, with the server render too", () => {
  const { container } = render(<RichTextView html={HTML} />);
  expect(container.querySelector("div")!.innerHTML).toBe(HTML);
  expect(renderToStaticMarkup(<RichTextView html={HTML} />)).toContain(
    '<span lang="de">two</span> <span lang="en-US">three</span>'
  );
});

const LANGUAGE_RULES = (classes: string) =>
  classes.split(/\s+/).filter((token) => token.includes("span[lang]"));

test.each([
  ["the app theme", PROSE_CLASS],
  ["the paper surface", PAPER_PROSE_CLASS],
])("on %s the line is drawn only under .ProseMirror, never for the View", (_, classes) => {
  const rules = LANGUAGE_RULES(classes);
  expect(rules.length).toBeGreaterThan(0);
  // Every rule for the mark needs the Editor's content class: the View has none.
  expect(rules.every((token) => token.startsWith("[&.ProseMirror_span[lang]]:"))).toBe(true);
  const rule = (suffix: string) => rules.includes(`[&.ProseMirror_span[lang]]:${suffix}`);
  expect(rule("underline")).toBe(true);
  expect(rule("decoration-dotted")).toBe(true);
  expect(rule("decoration-1")).toBe(true);
  // The secondary text role: the theme and the paper sheet each redefine it (`tokens.ts`).
  expect(rule("decoration-(--rte-secondary)")).toBe(true);
});

test("the Editor's content element carries the class the rule needs", () => {
  const ref = createRef<RichTextEditorHandle>();
  render(<RichTextEditor ref={ref} aria-label="Body" defaultValue={HTML} tools={["language"]} />);
  const content = screen.getByRole("textbox", { name: "Body" });
  expect(content.classList.contains("ProseMirror")).toBe(true);
  expect(content.className).toContain("[&.ProseMirror_span[lang]]:underline");
  expect(content.querySelectorAll("span[lang]")).toHaveLength(2);
});
