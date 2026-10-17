// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { CodeView } from "../src/components/content/CodeView.js";
import { highlightCodeNodes } from "../src/editor/highlight-entry.js";

afterEach(cleanup);

/**
 * The kit's highlighting in `CodeView` (OLDSUI-58, ADR-0052): the entry helper
 * `@olddevs/ui/editor/highlight` returns tokens as nodes, the consumer puts them into
 * `children`, while `code` still passes a string.
 *
 * What the reader sees is checked: the text of the code area is the same as `code`,
 * and it is marked up with `hljs-…` tokens, the same ones as in the Document's code block.
 */

const SAMPLES = {
  python: "def greet(name):\n    return f'hi {name}'",
  typescript: "const total: number = 1;",
  javascript: "function sum(a, b) { return a + b; }",
  go: 'func main() { fmt.Println("hi") }',
  html: '<a href="/x">link</a>',
  json: '{ "name": "ui", "version": 3, "private": true }',
  yaml: "name: ui\nversion: 3",
  markdown: "# Title\n\n- item",
} as const;

function renderHighlighted(code: string, language: string) {
  const { container } = render(
    <CodeView code={code} lineNumbers>
      {highlightCodeNodes(code, language)}
    </CodeView>
  );
  return container.querySelector("pre")!;
}

test.each(Object.entries(SAMPLES))(
  "%s code in CodeView gets hljs tokens and keeps its text",
  (language, code) => {
    const pre = renderHighlighted(code, language);

    expect(pre.textContent).toBe(code);
    expect(pre.querySelector('[class^="hljs-"]')).not.toBeNull();
  }
);

/*
  The token root carries the `data-code-highlight` marker: `CodeView` uses it to turn on
  the background of the highlight theme, and the theme paints only what is under it.
  Inside the root there are only `span`s with `hljs-…` classes: no `style` and no other
  attributes.
*/
test("tokens sit under one marked root and carry nothing but hljs classes", () => {
  const pre = renderHighlighted(SAMPLES.python, "python");
  const root = pre.querySelector("code > [data-code-highlight]");

  expect(root).not.toBeNull();
  expect(pre.querySelectorAll("[data-code-highlight]")).toHaveLength(1);
  const tokens = [...root!.querySelectorAll("*")];
  expect(tokens.length).toBeGreaterThan(0);
  for (const token of tokens) {
    expect(token.tagName).toBe("SPAN");
    expect(token.getAttributeNames()).toEqual(["class"]);
    expect(token.getAttribute("class")).toMatch(/^hljs-[\w-]+( [\w-]+)*$/);
  }
});

/*
  Code from an API response or a webhook body is untrusted. Nodes, not an HTML string:
  markup inside the code stays text, and not a single element from it appears.
*/
test("markup inside the code stays text", () => {
  const code = '<script>alert("x")</script> & <b>bold</b>';
  const pre = renderHighlighted(code, "html");

  expect(pre.textContent).toBe(code);
  expect(pre.querySelectorAll("script, b")).toHaveLength(0);
});

/*
  The language follows the Editor's rules: the alias and the case are normalized to the
  Document's name, and `py` is highlighted the same way as `python`.
*/
test("an alias or odd case is highlighted as the canonical language", () => {
  const canonical = renderHighlighted("def f(): pass", "python").innerHTML;
  cleanup();

  for (const language of ["py", "PY", " Python "]) {
    expect(renderHighlighted("def f(): pass", language).innerHTML).toBe(canonical);
    cleanup();
  }
});

/*
  An unknown language and empty code give an empty result, not the code as a string:
  then `children` is empty, and `CodeView` renders the code as is, with the line numbering
  that does not exist when markup is passed.
*/
test("an unknown language or empty code leaves CodeView plain, with line numbers", () => {
  expect(highlightCodeNodes("fn main() {}", "rust")).toBeNull();
  expect(highlightCodeNodes("", "python")).toBeNull();

  const pre = renderHighlighted("a\nb", "rust");
  expect(pre.querySelector("code")!.children).toHaveLength(0);
  expect(document.querySelector("[aria-hidden]")?.textContent).toBe("12");
});

/* Copying takes `code`, not the DOM: the tokens do not end up in the clipboard. */
test("copying highlighted code takes the plain source", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  // The stub goes in after `userEvent.setup()`, the same order as in `code-view.test.tsx`.
  const user = userEvent.setup();
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });

  render(
    <CodeView code={SAMPLES.go} copyable title="main.go">
      {highlightCodeNodes(SAMPLES.go, "go")}
    </CodeView>
  );
  await user.click(screen.getByRole("button", { name: /Copy/i }));

  expect(writeText).toHaveBeenCalledWith(SAMPLES.go);
});
