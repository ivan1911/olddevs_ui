// @vitest-environment jsdom
import createDOMPurify from "dompurify";
import katex from "katex";
import { expect, test } from "vitest";
import { tool, type CustomTool } from "../src/editor/index.js";
import {
  RICH_TEXT_SCHEMA,
  richTextSanitizeConfig,
  sanitizeRichText,
} from "../src/editor/schema-entry.js";

/**
 * Формулы в санитайзере (OLDSUI-280, ADR-0070): `span[data-type="inline-math"]` и
 * `div[data-type="block-math"]` с `data-latex`, настоящий DOMPurify на jsdom, как на
 * сервере потребителя. Главное — граница `<`: в `data-latex` он допустим (это текст
 * LaTeX), в любом другом значении атрибута Схемы по-прежнему нет.
 */

const purify = createDOMPurify(window);
const clean = (html: string, tools?: Parameters<typeof sanitizeRichText>[2]) =>
  sanitizeRichText(html, purify, tools);

const inline = (latex: string) => `<span data-type="inline-math" data-latex="${latex}"></span>`;
const block = (latex: string) => `<div data-type="block-math" data-latex="${latex}"></div>`;

test("a formula the Editor writes passes unchanged, whatever the attribute order", () => {
  const html = `<p>a ${inline("x^2")} b</p>${block("\\frac{a}{b}")}`;

  expect(clean(html)).toBe(html);
  expect(clean('<p><span data-latex="x" data-type="inline-math"></span></p>')).toBe(
    '<p><span data-latex="x" data-type="inline-math"></span></p>'
  );
});

test("a less-than sign survives in data-latex, and only there", () => {
  // `<` и `>` в тексте LaTeX: DOMPurify экранирует их при выводе, разметкой они не становятся.
  const survived = clean(`<p>${inline("a<b")}</p>${block("1 &lt; 2 > 0 \\text{<b>x</b>}")}`);
  const probe = document.createElement("div");
  probe.innerHTML = survived;

  expect(probe.querySelector("span")?.getAttribute("data-latex")).toBe("a<b");
  expect(probe.querySelector("div")?.getAttribute("data-latex")).toBe(
    "1 < 2 > 0 \\text{<b>x< /b>}"
  );
  // Разметки из атрибута не выросло: ни `b`, ни лишних элементов.
  expect(probe.querySelector("b")).toBeNull();
  expect(probe.querySelectorAll("span, div")).toHaveLength(2);

  // Тот же `<` в других атрибутах Схемы не проходит: свой атрибут по правилу «без разметки»…
  const note: CustomTool = {
    name: "test_note",
    engine: [],
    blocks: {
      test_note: { kind: "block", attributes: { test_text: { kind: "pattern", pattern: ".*" } } },
    },
  };
  expect(clean('<div data-block="test_note" data-test_text="a<b">x</div>', [note])).toBe(
    '<div data-block="test_note">x</div>'
  );
  // …`data-latex` на другом теге или рядом с чужим `data-type` — тоже нет.
  expect(clean('<p data-latex="a<b">x</p>')).toBe("<p>x</p>");
  expect(clean('<span data-latex="a<b">x</span>')).toBe("x");
  expect(clean('<div data-type="inline-math" data-latex="a<b">x</div>')).toBe("x");
  expect(clean('<span data-type="block-math" data-latex="a<b">x</span>')).toBe("x");
  // Значения других атрибутов формулы, кроме пары, не появляются.
  expect(clean('<span data-type="inline-math" data-latex="x" title="a<b" id="i"></span>')).toBe(
    '<span data-type="inline-math" data-latex="x"></span>'
  );
});

test("data-type admits exactly the two formula values, each on its own tag", () => {
  expect(clean(`<p>${inline("x")}</p>`)).toContain('data-type="inline-math"');
  expect(clean(block("x"))).toContain('data-type="block-math"');
  // Чужое значение и чужой тег теряют обёртку, текст внутри остаётся.
  expect(clean('<span data-type="detailsContent">t</span>')).toBe("t");
  expect(clean('<span data-type="evil" data-latex="x">t</span>')).toBe("t");
  expect(clean('<p data-type="inline-math" data-latex="x">t</p>')).toBe("<p>t</p>");
  expect(clean('<a href="https://example.com" data-type="inline-math">l</a>')).toBe(
    '<a href="https://example.com" rel="noopener noreferrer">l</a>'
  );
});

test("a formula is a leaf: rendered KaTeX markup inside is dropped, a missing source unwraps it", () => {
  const rendered =
    '<span data-type="inline-math" data-latex="x"><span class="katex"><span style="color:red">x</span></span></span>';

  expect(clean(rendered)).toBe(inline("x"));
  expect(clean('<span data-type="inline-math"><strong>kept</strong></span>')).toBe(
    "<strong>kept</strong>"
  );
  expect(clean('<div data-type="block-math"><p>kept</p></div>')).toBe("<p>kept</p>");
});

test("a formula does not open the doors of other attributes or tags", () => {
  const html =
    `<p>${inline("x")}<iframe src="https://example.com"></iframe></p>` +
    '<span data-type="inline-math" data-latex="x" onclick="steal()" style="position:fixed"></span>';
  const out = clean(html);

  expect(out).not.toMatch(/iframe|onclick|style=|position/);
  expect(out).toContain(inline("x"));
});

test("data-latex is in the bare config and in the schema data, the value checks are the hooks'", () => {
  expect(RICH_TEXT_SCHEMA.attributes.span).toEqual([
    "data-color",
    "style",
    "data-type",
    "data-latex",
  ]);
  expect(RICH_TEXT_SCHEMA.attributes.div).toContain("data-latex");
  expect(richTextSanitizeConfig().ALLOWED_ATTR).toContain("data-latex");
});

test("the formula rules do not depend on tools, and tool() entries change nothing", () => {
  const html = `<p>${inline("a<b")}</p>`;

  expect(clean(html, [tool("mathematics", { macros: { "\\RR": "\\mathbb{R}" } })])).toBe(html);
  expect(clean(html, ["bold"])).toBe(html);
});

/*
  SAFE_FOR_XML у DOMPurify 3 срезает атрибут, значение которого содержит `]>`, `-->`,
  `--!>` или `</style|script|title|…`, — раньше хуков кита. LaTeX такое законно содержит
  (`\left[0,1\right]>x`), поэтому кит ставит пробел внутрь пары (`] >`, `-- >`, `< /`):
  в математическом режиме пробел не рисуется, и формула выглядит так же.
*/
const HOSTILE_TO_DOMPURIFY = [
  ["\\left[0,1\\right]>x", "\\left[0,1\\right] >x"],
  ["a]>b", "a] >b"],
  ["a-->b", "a-- >b"],
  ["a--!>b", "a--! >b"],
  ["a</b", "a< /b"],
  ["x</style>y", "x< /style>y"],
  ["]]>", "]] >"],
  ["--->", "--- >"],
  ["<</", "<< /"],
] as const;

/** Значение атрибута как в HTML: без `"` и `&`, а `<` и `>` остаются голыми, как пишет сериализатор. */
const attribute = (latex: string) => latex.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

test.each(HOSTILE_TO_DOMPURIFY)(
  "DOMPurify keeps %j as a formula and spaces it as %j, the rendering stays the same",
  (source, spaced) => {
    const probe = document.createElement("div");

    for (const [html, tag] of [
      [inline(attribute(source)), "span"],
      [block(attribute(source)), "div"],
    ] as const) {
      probe.innerHTML = clean(html);
      const element = probe.querySelector(tag);
      // Формула осталась, и исходник в ней — тот же, но с пробелом в паре, которую DOMPurify режет.
      expect(element?.getAttribute("data-type")).toMatch(/-math$/);
      expect(element?.getAttribute("data-latex")).toBe(spaced);
      // Пробел в математическом режиме не рисуется: видимая разметка KaTeX та же, что у исходника
      // без него; в MathML отличается только `annotation` — там лежит сам исходник с пробелом.
      const visual = { throwOnError: false, strict: "ignore", output: "html" } as const;
      expect(katex.renderToString(spaced, visual)).toBe(katex.renderToString(source, visual));
      const mathml = { ...visual, output: "mathml" } as const;
      const withoutSource = (latex: string) =>
        katex.renderToString(latex, mathml).replace(/<annotation[\s\S]*?<\/annotation>/, "");
      expect(withoutSource(spaced)).toBe(withoutSource(source));
    }
  }
);

test("a source that is already safe, and a second pass over a spaced one, change nothing", () => {
  for (const latex of ["x^2", "a < b", "a > b", "\\left[0,1\\right] >x", "a< /b", "[a]", "-->"]) {
    const once = clean(inline(attribute(latex)));
    expect(clean(once)).toBe(once);
  }
  expect(clean(inline("a < b"))).toBe(inline("a < b"));
});

test("only the formula source is rewritten: other attributes with the same text are still dropped", () => {
  expect(clean('<p title="a]>b">x</p>')).toBe("<p>x</p>");
  expect(clean('<span data-latex="a]>b">x</span>')).toBe("x");
});

test("the limit: inside \\text{…} the added space is visible, but the formula still survives", () => {
  const probe = document.createElement("div");
  probe.innerHTML = clean(inline("\\text{</script>}"));

  expect(probe.querySelector("span")?.getAttribute("data-latex")).toBe("\\text{< /script>}");
  const visual = { throwOnError: false, strict: "ignore", output: "html" } as const;
  expect(katex.renderToString("\\text{< /script>}", visual)).not.toBe(
    katex.renderToString("\\text{</script>}", visual)
  );
});
