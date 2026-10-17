import type { Meta, StoryObj } from "@storybook/react-vite";
import { CodeView } from "../components/content/CodeView.js";
import { highlightCodeNodes } from "./highlight-entry.js";

/*
  The kit's highlighting for `CodeView` (ADR-0052) lives in a separate file in
  `src/editor/`, not in the `CodeView` stories: the helper lives in the subpath
  `@olddevs/ui/editor/highlight`, and the gate `tests/editor-entry.test.ts` does not
  let imports from `editor/` reach any module outside it.
*/
const meta = {
  title: "Content/CodeView highlighting",
  component: CodeView,
  // Periphery, like `CodeView` itself (ADR-0038): no snapshots, and axe runs in all themes.
  tags: ["periphery"],
  parameters: { layout: "padded" },
  args: { code: "" },
} satisfies Meta<typeof CodeView>;

export default meta;
type Story = StoryObj<typeof meta>;

/*
  Kit highlighting (ADR-0052): one sample for each language
  of the Editor. The samples include keywords, strings, numbers, comments, and
  tags, so that axe measures the contrast of every token role in all three themes.
*/
const SAMPLES = [
  [
    "main.py",
    "python",
    '# Greets a user\ndef greet(name: str) -> str:\n    return f"Hello, {name}!" * 2',
  ],
  [
    "sum.ts",
    "typescript",
    "// Sum of a list\nexport function sum(values: number[]): number {\n  return values.reduce((a, b) => a + b, 0);\n}",
  ],
  [
    "user.js",
    "javascript",
    'const user = { name: "Ada", age: 36 };\nconsole.log(`Hi, ${user.name}`, this);',
  ],
  [
    "main.go",
    "go",
    'package main\n\nimport "fmt"\n\nfunc main() {\n\tfmt.Println(len("hi"), true)\n}',
  ],
  [
    "link.html",
    "html",
    '<!DOCTYPE html>\n<a href="/docs" class="link">Docs &amp; guides</a>\n<!-- a comment -->',
  ],
  [
    "response.json",
    "json",
    '{\n  "id": 4821,\n  "status": "assembling",\n  "paid": true,\n  "tags": ["api", null]\n}',
  ],
  [
    "service.yaml",
    "yaml",
    "# Service config\nname: billing\nreplicas: 3\nenabled: true\ntags:\n  - api",
  ],
  [
    "README.md",
    "markdown",
    "# Billing\n\nRun **make test** before you push.\n\n- [Docs](https://example.com)",
  ],
] as const;

/**
 * Kit highlighting: `highlightCodeNodes` from `@olddevs/ui/editor/highlight` in
 * `children`. The theme is the same as for a code Block in the Editor and in `RichTextView`:
 * GitHub Light in `light`, GitHub Dark in `dark` and `dim`; the Block's background comes from the
 * theme. `code` is still a string, because copying works from it.
 */
export const KitHighlighting: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      {SAMPLES.map(([title, language, code]) => (
        <CodeView key={language} code={code} title={title} copyable>
          {highlightCodeNodes(code, language)}
        </CodeView>
      ))}
    </div>
  ),
};

const LONG_JS = `await fetch("https://api.example.com/v1/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: 4821, status: "assembling" }) });`;

const RUST = 'fn main() {\n    println!("hi");\n}';

/**
 * Kit highlighting with long lines wrapped, and a language the kit does not know:
 * for that language the helper returns nothing, and `CodeView` draws the code as is, with
 * line numbers.
 */
export const KitHighlightingEdgeCases: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <CodeView code={LONG_JS} title="request.js" copyable wrap>
        {highlightCodeNodes(LONG_JS, "javascript")}
      </CodeView>
      <CodeView code={RUST} title="main.rs" lineNumbers>
        {highlightCodeNodes(RUST, "rust")}
      </CodeView>
    </div>
  ),
};
