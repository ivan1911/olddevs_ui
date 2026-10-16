import { RICH_TEXT_PRESETS, RichTextEditor, tool } from "@olddevs/ui/editor";

/**
 * `RichTextEditor` с пресетом `full` прямо из серверного компонента (ADR-0058, п. 11.7): директиву несёт сам компонент, обёртки потребителю не нужно.
 *
 * Страница проверяет, что ленивые чанки `codeBlock` и `table` собираются
 * сборщиком Next.js из `dist` пакета (динамический `import()` внутри кита), а
 * `First Load JS` держит свой бюджет: чанки едут после загрузки страницы, до них
 * Редактор показывает Скелет. Блок кода и таблица в документе — затем, чтобы
 * Скелету и движку было что разбирать.
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

export default function RichTextEditorPage() {
  return (
    <main className="p-6">
      <RichTextEditor aria-label="Release notes" preset="full" defaultValue={DOCUMENT} />
      <RichTextEditor aria-label="Comment" tools={SERVER_TOOLS} defaultValue="<p>Short note.</p>" />
    </main>
  );
}
