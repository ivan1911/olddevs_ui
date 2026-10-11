// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { CodeView } from "../src/components/content/CodeView.js";
import { highlightCodeNodes } from "../src/editor/highlight-entry.js";

afterEach(cleanup);

/**
 * Подсветка кита в `CodeView` (OLDSUI-58, ADR-0052): хелпер входа
 * `@olddevs/ui/editor/highlight` отдаёт токены узлами, потребитель кладёт их в
 * `children`, а `code` по-прежнему передаёт строкой.
 *
 * Сверяется то, что видит читатель: текст области кода тот же, что `code`,
 * и он размечен токенами `hljs-…` — теми же, что в блоке кода Документа.
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
  Корень токенов несёт маркер `data-code-highlight`: по нему `CodeView`
  включает фон темы подсветки, а тема красит только то, что под ним. Внутри
  корня — только `span` с классами `hljs-…`: ни `style`, ни других атрибутов.
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
  Код из ответа API или тела вебхука — недоверенный. Узлы, а не строка HTML:
  разметка внутри кода остаётся текстом, и ни одного элемента из неё не
  появляется.
*/
test("markup inside the code stays text", () => {
  const code = '<script>alert("x")</script> & <b>bold</b>';
  const pre = renderHighlighted(code, "html");

  expect(pre.textContent).toBe(code);
  expect(pre.querySelectorAll("script, b")).toHaveLength(0);
});

/*
  Язык — по правилам Редактора: псевдоним и регистр приводятся к имени
  Документа, и `py` красится так же, как `python`.
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
  Неизвестный язык и пустой код дают пустой результат, а не код строкой:
  тогда `children` пуст, и `CodeView` рисует код как есть — с нумерацией
  строк, которой при переданной разметке нет.
*/
test("an unknown language or empty code leaves CodeView plain, with line numbers", () => {
  expect(highlightCodeNodes("fn main() {}", "rust")).toBeNull();
  expect(highlightCodeNodes("", "python")).toBeNull();

  const pre = renderHighlighted("a\nb", "rust");
  expect(pre.querySelector("code")!.children).toHaveLength(0);
  expect(document.querySelector("[aria-hidden]")?.textContent).toBe("12");
});

/* Копирование берёт `code`, а не DOM: токены в буфер не попадают. */
test("copying highlighted code takes the plain source", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  // Заглушка — после `userEvent.setup()`, тот же порядок, что в `code-view.test.tsx`.
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
