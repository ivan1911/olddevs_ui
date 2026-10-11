// @vitest-environment jsdom
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { expect, test } from "vitest";
import * as highlightEntry from "../src/editor/highlight-entry.js";
import { highlightCodeBlocks } from "../src/editor/highlight-entry.js";
import { EDITOR_ENGINE } from "../scripts/editor-engine.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const SRC = join(ROOT, "src");

/**
 * Серверная подсветка сохранённого Документа — вход `@olddevs/ui/editor/highlight`
 * (OLDSUI-50, ADR-0051).
 *
 * Хелпер получает HTML, уже очищенный санитайзером потребителя, и заменяет
 * содержимое `<pre><code class="language-…">` токенами `span class="hljs-…"`.
 * Сверяется то, что видит читатель страницы: текст кода после подсветки тот
 * же, что до, и ни одна строка кода не становится разметкой.
 */

/** Текст HTML так, как его покажет браузер: разметка снята, сущности раскрыты. */
function textOf(html: string): string {
  const root = document.createElement("div");
  root.innerHTML = html;
  return root.textContent ?? "";
}

/** Блок кода в форме Редактора: текст экранирован так же, как его пишет `getHTML()`. */
function block(language: string | null, code: string): string {
  const escaped = code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<pre><code${language ? ` class="language-${language}"` : ""}>${escaped}</code></pre>`;
}

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

test.each(Object.entries(SAMPLES))(
  "a %s block gets hljs tokens and keeps its text",
  (language, code) => {
    const source = block(language, code);
    const html = highlightCodeBlocks(source);

    expect(html).toMatch(new RegExp(`^<pre><code class="language-${language}"><span class="hljs-`));
    expect(html).toMatch(/<\/code><\/pre>$/);
    expect(textOf(html)).toBe(code);
    // Только классы `hljs-*` — ни `style`, ни других атрибутов.
    expect(html).not.toMatch(/style=/);
    for (const [, attributes] of html.matchAll(/<span([^>]*)>/g)) {
      expect(attributes).toMatch(/^ class="hljs-[\w-]+( [\w-]+)*"$/);
    }
  }
);

test("markup inside code stays text: tags, entities and quotes come out escaped", () => {
  const code = `<script>alert("x & 'y'")</script> &lt;b&gt; ${" "}done`;
  const source =
    '<pre><code class="language-html">' +
    "&lt;script&gt;alert(&quot;x &amp; &#39;y&#39;&quot;)&lt;/script&gt; &amp;lt;b&amp;gt; &nbsp;done" +
    "</code></pre>";

  const html = highlightCodeBlocks(source);

  expect(textOf(html)).toBe(code);
  expect(html).not.toMatch(/<script|<\/script|<b>/i);
  const parsed = document.createElement("div");
  parsed.innerHTML = html;
  expect(parsed.querySelectorAll("script, b")).toHaveLength(0);
});

test("a block with an entity the helper cannot decode is left as it was", () => {
  const source = '<pre><code class="language-python">x = "&copy;"</code></pre>';

  expect(highlightCodeBlocks(source)).toBe(source);
});

test("the rest of the document is left byte for byte", () => {
  const before = "<h2>Title</h2><p>Text with <code>inline()</code> &amp; more.</p>";
  const after = "<blockquote><p>end</p></blockquote>";

  const html = highlightCodeBlocks(before + block("python", "x = 1") + after);

  expect(html.startsWith(before)).toBe(true);
  expect(html.endsWith(after)).toBe(true);
});

test("plain-text blocks and blocks in unknown languages are not touched", () => {
  const source = block(null, "const a = 1;") + block("rust", "fn main() {}");

  expect(highlightCodeBlocks(source)).toBe(source);
});

test("highlighting twice gives the same result as once", () => {
  const once = highlightCodeBlocks(
    Object.entries(SAMPLES)
      .map(([language, code]) => block(language, code))
      .join("")
  );

  expect(highlightCodeBlocks(once)).toBe(once);
});

/*
  Класс на выходе — канонический `language-<имя>` Схемы, а не то, что было в
  строке: `language-js` и `language-PY` из рукописного Документа санитайзер по
  рецепту снял бы (он знает только имена Схемы), а шапка и тема блока читают
  тот же класс. Хелпер, который подсвечивает по псевдониму, обязан и записать
  имя, по которому подсвечивал.
*/
test("an alias or odd case in a hand-written document is highlighted and written canonically", () => {
  expect(highlightCodeBlocks(block("py", "def f(): pass"))).toMatch(
    /^<pre><code class="language-python"><span class="hljs-keyword">def<\/span>/
  );
  expect(highlightCodeBlocks(block("PY", "def f(): pass"))).toMatch(
    /^<pre><code class="language-python"><span class="hljs-keyword">def<\/span>/
  );
  expect(highlightCodeBlocks(block("js", "const a = 1;"))).toMatch(
    /^<pre><code class="language-javascript"><span class="hljs-keyword">const<\/span>/
  );
});

test("an empty document and an empty code block survive", () => {
  expect(highlightCodeBlocks("")).toBe("");
  expect(highlightCodeBlocks(block("go", ""))).toBe(block("go", ""));
});

test("the entry exports only the two helpers", () => {
  expect(Object.keys(highlightEntry).sort()).toEqual(["highlightCodeBlocks", "highlightCodeNodes"]);
});

/** Подключения модуля: `from "…"` и `import "…"`; типовые импорты не в счёт. */
function specifiers(source: string): string[] {
  const found: string[] = [];
  for (const match of source.matchAll(
    /^\s*(?:import|export)\s+(type\s+)?[^"']*?from\s+["']([^"']+)["']/gm
  )) {
    if (!match[1]) found.push(match[2]!);
  }
  for (const match of source.matchAll(/^\s*import\s+["']([^"']+)["']/gm)) found.push(match[1]!);
  return found;
}

function moduleGraph(entry: string): { files: string[]; packages: string[] } {
  const files: string[] = [];
  const packages = new Set<string>();
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.pop()!;
    if (files.includes(file)) continue;
    files.push(file);
    for (const specifier of specifiers(readFileSync(file, "utf8"))) {
      if (!specifier.startsWith(".")) {
        packages.add(specifier);
        continue;
      }
      const target = resolve(dirname(file), specifier).replace(/\.js$/, "");
      const found = [".ts", ".tsx"].map((extension) => target + extension).find(existsSync);
      if (!found) throw new Error(`${file} imports ${specifier}, which has no source`);
      queue.push(found);
    }
  }
  return { files, packages: [...packages].sort() };
}

/*
  Вход серверный: его импортирует серверный компонент или Node-скрипт без
  сборщика. В графе — lowlight, грамматики и `react` (узлы для `CodeView`,
  OLDSUI-58, ADR-0052; это обязательный peer кита) — ни Tiptap, ни директивы
  клиента.
*/
test("the module graph of the entry holds lowlight and the grammars, and nothing else", () => {
  const { files, packages } = moduleGraph(join(SRC, "editor", "highlight-entry.ts"));

  expect(packages).toEqual([
    "highlight.js/lib/languages/go",
    "highlight.js/lib/languages/javascript",
    "highlight.js/lib/languages/json",
    "highlight.js/lib/languages/markdown",
    "highlight.js/lib/languages/python",
    "highlight.js/lib/languages/typescript",
    "highlight.js/lib/languages/xml",
    "highlight.js/lib/languages/yaml",
    "lowlight",
    "react",
  ]);
  expect(
    files.filter((file) => readFileSync(file, "utf8").trimStart().startsWith('"use client"'))
  ).toEqual([]);
});

/*
  Граница ADR-0039 в силе для основного входа (ADR-0052): подсветку для
  `CodeView` приносит потребитель — импортом хелпера, — а не сам кит.
*/
test("the main entry and CodeView keep lowlight out of their graph", () => {
  for (const entry of [join(SRC, "index.ts"), join(SRC, "components", "content", "CodeView.tsx")]) {
    const { packages } = moduleGraph(entry);
    expect(packages.filter((name) => /lowlight|highlight\.js/.test(name))).toEqual([]);
  }
});

test("the view keeps lowlight out of its graph", () => {
  const { packages } = moduleGraph(join(SRC, "editor", "RichTextView.tsx"));

  expect(packages.filter((name) => /lowlight|highlight\.js/.test(name))).toEqual([]);
});

test("the entry is published as a subpath, its packages are the Editor engine", () => {
  const manifest = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));

  expect(manifest.exports["./editor/highlight"]).toEqual({
    types: "./dist/editor/highlight-entry.d.ts",
    default: "./dist/editor/highlight-entry.js",
  });
  for (const name of ["lowlight", "highlight.js", "@tiptap/extension-code-block-lowlight"]) {
    expect(EDITOR_ENGINE, name).toContain(name);
    expect(manifest.devDependencies[name], name).toBeTruthy();
  }
});
