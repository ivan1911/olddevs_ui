import { RICH_TEXT_PRESETS, RichTextEditor, tool } from "@olddevs/ui/editor";

/**
 * `RichTextEditor` с пресетом `full` прямо из серверного компонента (ADR-0058, п. 11.7): директиву несёт сам компонент, обёртки потребителю не нужно.
 *
 * Страница проверяет, что ленивые чанки `codeBlock` и `table` собираются
 * сборщиком Next.js из `dist` пакета (динамический `import()` внутри кита), а
 * `First Load JS` держит свой бюджет: чанки едут после загрузки страницы, до них
 * Редактор показывает Скелет. Блок кода и таблица в документе — затем, чтобы
 * Скелету и движку было что разбирать.
 *
 * Второй Редактор — с формулами (OLDSUI-280, ADR-0070): `mathematics` не входит в
 * пресеты, его называют в `tools`, а опции `tool("mathematics", …)` — данные и
 * проходят границу RSC. Чанк с KaTeX и его CSS собирается Next.js из `dist` и
 * шрифты берёт из пакета `katex` фикстуры: `scripts/check-consumer.mjs` ищет их
 * в `.next`.
 */
const DOCUMENT =
  "<h2>Release notes</h2><p>Text with <strong>bold</strong>.</p>" +
  '<pre><code class="language-python">def greet(name):\n    return f"hi {name}"</code></pre>' +
  "<table><tbody><tr><th><p>Name</p></th><th><p>Role</p></th></tr>" +
  "<tr><td><p>Ada</p></td><td><p>Author</p></td></tr></tbody></table>";

/**
 * Набор `tools`, собранный в серверном модуле (OLDSUI-285): пресет разворачивается
 * в массив прямо здесь, а `tool()` добавляет Настроенный Инструмент. Если бы
 * `RICH_TEXT_PRESETS` лежал в файле с "use client", сервер получил бы вместо массива
 * клиентскую ссылку, и `next build` упал бы на `is not iterable`.
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
