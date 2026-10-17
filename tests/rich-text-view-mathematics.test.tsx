// @vitest-environment jsdom
import { cleanup, render, waitFor } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, test, vi } from "vitest";
import { RichTextView, tool } from "../src/editor/index.js";
import { hasMath, withMathSource } from "../src/editor/features/mathematics/mathHtml.js";
import { mathOptionsOf } from "../src/editor/features/mathematics/mathOptions.js";
import { resetDevWarnings } from "../src/lib/dev-warn.js";

afterEach(cleanup);

/**
 * Formulas in `RichTextView` (OLDSUI-280, ADR-0070, section 6): the server puts the LaTeX
 * source into an empty formula element, and the lazy Island loads KaTeX after mounting and
 * draws the formulas from `data-latex`. A Document without formulas does not mount the
 * Island and does not load KaTeX. No engine: Tiptap is not in the View's graph
 * (`rich-text-view.test.tsx`).
 */
const imported = vi.hoisted(() => [] as string[]);

vi.mock("../src/editor/features/mathematics/katexEngine.js", async (original) => {
  imported.push("katex");
  return original();
});

const inline = (latex: string) => `<span data-latex="${latex}" data-type="inline-math"></span>`;
const block = (latex: string) => `<div data-latex="${latex}" data-type="block-math"></div>`;

const DOCUMENT =
  `<p>Euler ${inline("e^{i\\pi}+1=0")} done</p>` + block("\\int_0^1 x\\,dx") + "<p>Last</p>";

// ── Document without formulas ───────────────────────────────────────────────

test("a document without formulas mounts no island and loads no KaTeX", async () => {
  const { container } = render(<RichTextView html="<p>Plain</p><p>Text $5 and $6</p>" />);
  await new Promise((resolve) => setTimeout(resolve, 30));

  expect(container.querySelector("template[data-math-island]")).toBeNull();
  expect(imported).toEqual([]);
  expect(hasMath("<p>Plain</p>")).toBe(false);
  // A string without formulas comes back as is: not a copy and not a re-parse.
  const plain = "<p>Plain</p>";
  expect(withMathSource(plain)).toBe(plain);
});

// ── Server and "no JS" ──────────────────────────────────────────────────────

test("the server markup shows the LaTeX source in the formula elements, no KaTeX", () => {
  const markup = renderToStaticMarkup(<RichTextView html={DOCUMENT} />);
  const host = document.createElement("div");
  host.innerHTML = markup;

  expect(host.querySelector('span[data-type="inline-math"]')?.textContent).toBe("e^{i\\pi}+1=0");
  expect(host.querySelector('div[data-type="block-math"]')?.textContent).toBe("\\int_0^1 x\\,dx");
  // The source is read and searched like ordinary page text.
  expect(host.textContent).toContain("Euler e^{i\\pi}+1=0 done");
  expect(host.querySelector(".katex")).toBeNull();
  // The Island's marker is there, its code is not: the client loads KaTeX after mounting.
  expect(host.querySelector("template[data-math-island]")).not.toBeNull();
  expect(imported).toEqual([]);
});

test("withMathSource escapes the source as text and ignores what is not a formula", () => {
  const withGreater = '<span data-type="inline-math" data-latex="a>b &amp; c&lt;d"></span>';

  // A `>` in an attribute value does not stop the search for the end of the tag;
  // `<` and `>` in the text are escaped.
  expect(withMathSource(`<p>${withGreater}</p>`)).toBe(
    '<p><span data-type="inline-math" data-latex="a>b &amp; c&lt;d">a&gt;b &amp; c&lt;d</span></p>'
  );
  // Any attribute order, a block formula, several formulas in one line.
  expect(withMathSource(`${inline("x")}${block("y")}`)).toBe(
    '<span data-latex="x" data-type="inline-math">x</span><div data-latex="y" data-type="block-math">y</div>'
  );
  // An element with content, a foreign tag and a mismatched pair are left alone.
  const untouched =
    '<span data-type="inline-math" data-latex="x">already</span>' +
    '<div data-type="inline-math" data-latex="x"></div>' +
    '<span data-type="block-math" data-latex="x"></span>' +
    '<span data-latex="x"></span><p data-type="inline-math" data-latex="x"></p>' +
    '<span data-type="inline-math"></span>';
  expect(withMathSource(untouched)).toBe(untouched);
});

// ── Island ──────────────────────────────────────────────────────────────────

test("the island renders every formula from data-latex, with HTML and MathML", async () => {
  const { container } = render(<RichTextView html={DOCUMENT} />);

  await waitFor(() => expect(container.querySelectorAll(".katex")).toHaveLength(2));
  expect(imported).toEqual(["katex"]);
  const [first, second] = [...container.querySelectorAll(".katex")];
  // MathML for the screen reader and an annotation with the source; the HTML view
  // is hidden from it.
  expect(first!.querySelector("math annotation")?.textContent).toBe("e^{i\\pi}+1=0");
  expect(first!.querySelector(".katex-html")?.getAttribute("aria-hidden")).toBe("true");
  expect(second!.closest(".katex-display")).not.toBeNull();
  // A block formula gets `display`, an inline one does not.
  expect(first!.closest(".katex-display")).toBeNull();
  // The rest of the Document is the same, and the formula elements stay in their
  // places with `data-latex`.
  expect(container.querySelector("p")?.textContent).toContain("Euler");
  expect(container.querySelectorAll("[data-latex]")).toHaveLength(2);
});

test("a formula KaTeX cannot read stays as source and is marked, the others render", async () => {
  const { container } = render(
    <RichTextView html={`<p>${inline("\\frac{1")} and ${inline("x")}</p>`} />
  );

  await waitFor(() => expect(container.querySelectorAll(".katex")).toHaveLength(1));
  const bad = container.querySelector("[data-math-error]")!;
  expect(bad.getAttribute("data-latex")).toBe("\\frac{1");
  expect(bad.textContent).toBe("\\frac{1");
  expect(bad.hasAttribute("data-math-error")).toBe(true);
});

test("a new document renders again; the same document keeps its markup on a parent re-render", async () => {
  const { container, rerender } = render(<RichTextView html={`<p>${inline("a")}</p>`} />);
  await waitFor(() => expect(container.querySelector(".katex")).not.toBeNull());
  const rendered = container.querySelector(".katex");

  rerender(<RichTextView html={`<p>${inline("a")}</p>`} className="other" />);
  expect(container.querySelector(".katex")).toBe(rendered);

  rerender(<RichTextView html={`<p>${inline("b")}</p>`} />);
  await waitFor(() => expect(container.querySelector(".katex annotation")?.textContent).toBe("b"));
});

// ── Options ─────────────────────────────────────────────────────────────────

test("tool('mathematics') macros reach the island, a wrong option falls back", async () => {
  const html = `<p>${inline("x \\in \\RR")}</p>`;

  const withMacro = render(
    <RichTextView
      html={html}
      tools={[tool("mathematics", { macros: { "\\RR": "\\mathbb{R}" } })]}
    />
  );
  await waitFor(() => expect(withMacro.container.querySelector(".katex")).not.toBeNull());
  expect(withMacro.container.querySelector("[data-math-error]")).toBeNull();
  cleanup();

  const without = render(<RichTextView html={html} />);
  await waitFor(() => expect(without.container.querySelector("[data-math-error]")).not.toBeNull());

  expect(mathOptionsOf(undefined)).toEqual({ macros: {}, strict: "ignore" });
  expect(
    mathOptionsOf(["bold", tool("mathematics", { macros: { RR: "x" }, strict: "warn" })])
  ).toEqual({ macros: {}, strict: "warn" });
});

test("the View resolves the options like the Editor: the same dev error, and two entries are an error", () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  resetDevWarnings();

  expect(
    mathOptionsOf([tool("mathematics", { macros: { RR: "x" } as never, strict: "warn" })])
  ).toEqual({ macros: {}, strict: "warn" });
  expect(error).toHaveBeenCalledTimes(1);
  expect(error.mock.calls[0]![0]).toMatch(
    /^RichTextView: tool "mathematics": ignored invalid options: macros$/
  );

  // Two `tool("mathematics")` entries are a configuration error, as in the Editor (it does not
  // start): the View does not select the "first" one, it takes the defaults and reports it.
  error.mockClear();
  expect(
    mathOptionsOf([
      tool("mathematics", { strict: "warn", macros: { "\\RR": "x" } }),
      tool("mathematics", { strict: "error" }),
    ])
  ).toEqual({ macros: {}, strict: "ignore" });
  expect(error).toHaveBeenCalledTimes(1);
  expect(error.mock.calls[0]![0]).toMatch(
    /^RichTextView: tool "mathematics": two tool\(\) entries share this name$/
  );
  error.mockRestore();
});
