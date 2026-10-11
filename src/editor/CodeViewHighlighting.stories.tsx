import type { Meta, StoryObj } from "@storybook/react-vite";
import { CodeView } from "../components/content/CodeView.js";
import { highlightCodeNodes } from "./highlight-entry.js";

/*
  Подсветка кита для `CodeView` (ADR-0052) — отдельным файлом в
  `src/editor/`, а не в историях `CodeView`: хелпер живёт в подпути
  `@olddevs/ui/editor/highlight`, и ворота `tests/editor-entry.test.ts` не
  пускают импорт из `editor/` ни в один модуль вне него.
*/
const meta = {
  title: "Content/CodeView highlighting",
  component: CodeView,
  // Периферия, как и сам `CodeView` (ADR-0038): снимков нет, axe — во всех темах.
  tags: ["periphery"],
  parameters: { layout: "padded" },
  args: { code: "" },
} satisfies Meta<typeof CodeView>;

export default meta;
type Story = StoryObj<typeof meta>;

/*
  Подсветка кита (ADR-0052): по одному образцу на каждый язык
  Редактора. В образцах есть ключевые слова, строки, числа, комментарии и
  теги — чтобы axe мерил контраст каждой роли токена во всех трёх темах.
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
 * Подсветка кита: `highlightCodeNodes` из `@olddevs/ui/editor/highlight` в
 * `children`. Тема та же, что у блока кода в Редакторе и `RichTextView`, —
 * GitHub Light в `light`, GitHub Dark в `dark` и `dim`; фон блока берётся у
 * темы. `code` по-прежнему строкой: из него копирование.
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
 * Подсветка кита с переносом длинных строк и язык, которого кит не знает:
 * для него хелпер не отдаёт ничего, и `CodeView` рисует код как есть — с
 * нумерацией строк.
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
