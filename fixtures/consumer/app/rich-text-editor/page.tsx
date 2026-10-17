import { RICH_TEXT_PRESETS, RichTextEditor, tool } from "@olddevs/ui/editor";

/**
 * `RichTextEditor` with the `full` preset right from a Server Component (ADR-0058,
 * item 11.7). The component carries the directive itself, so the consumer needs no wrapper.
 *
 * The page checks that the lazy chunks `codeBlock` and `table` are bundled by the Next.js
 * bundler from the package's `dist` (a dynamic `import()` inside the kit), and that the
 * `First Load JS` holds its budget. The chunks load after the page loads, and until then
 * the Editor shows the Skeleton. A code Block and a table in the Document are there so
 * that the Skeleton and the engine have something to process.
 *
 * The second Editor carries Formulas (OLDSUI-280, ADR-0070). `mathematics` is not in the
 * presets: it is named in `tools`, and the options of `tool("mathematics", …)` are data
 * that cross the RSC boundary. Next.js bundles the chunk with KaTeX and its CSS from
 * `dist`, and takes the fonts from the fixture's `katex` package. `scripts/check-consumer.mjs`
 * looks for them in `.next`.
 */
const DOCUMENT =
  "<h2>Release notes</h2><p>Text with <strong>bold</strong>.</p>" +
  '<pre><code class="language-python">def greet(name):\n    return f"hi {name}"</code></pre>' +
  "<table><tbody><tr><th><p>Name</p></th><th><p>Role</p></th></tr>" +
  "<tr><td><p>Ada</p></td><td><p>Author</p></td></tr></tbody></table>";

/**
 * The `tools` set assembled in the server module (OLDSUI-285). The preset is expanded
 * into an array right here, and `tool()` adds a Configured Tool. If `RICH_TEXT_PRESETS`
 * lived in a file with "use client", the server would get a client reference instead of
 * an array, and `next build` would fail with `is not iterable`.
 */
const SERVER_TOOLS = [...RICH_TEXT_PRESETS.basic, tool("search", { matchCase: true })];

const MATH_TOOLS = [
  ...RICH_TEXT_PRESETS.basic,
  "insertMenu",
  tool("mathematics", { macros: { "\\RR": "\\mathbb{R}" } }),
] as const;

const FORMULAS =
  '<p>Inline <span data-type="inline-math" data-latex="x \\in \\RR"></span> and a block:</p>' +
  '<div data-type="block-math" data-latex="\\int_0^1 x\\,dx"></div>';

export default function RichTextEditorPage() {
  return (
    <main className="p-6">
      <RichTextEditor aria-label="Release notes" preset="full" defaultValue={DOCUMENT} />
      <RichTextEditor aria-label="Comment" tools={SERVER_TOOLS} defaultValue="<p>Short note.</p>" />
      <RichTextEditor aria-label="Formulas" tools={MATH_TOOLS} defaultValue={FORMULAS} />
    </main>
  );
}
