import { RichTextView, type CustomTool } from "@olddevs/ui/editor";
import { highlightCodeBlocks } from "@olddevs/ui/editor/highlight";
import { sanitizeRichText } from "@olddevs/ui/editor/schema";
import createDOMPurify from "dompurify";
import { JSDOM } from "jsdom";
import { FixtureBadge } from "../fixture-badge";

/**
 * Серверный компонент со вторым обещанием пакета — подпутём `@olddevs/ui/editor`.
 *
 * Конвейер показа ровно тот, что на странице `RichTextView`: очистка на сервере
 * (`sanitizeRichText` с DOMPurify на jsdom), потом подсветка (`highlightCodeBlocks`),
 * потом `RichTextView` прямо здесь, без обёртки с "use client". Блок кода в
 * документе нужен затем, чтобы просмотр нарисовал свой клиентский остров с
 * кнопкой «Копировать»: граница клиента идёт по файлу острова, и сборка
 * проверяет, что она доезжает до потребителя.
 *
 * Свой Блок с Островом: описание лежит в серверном модуле, а
 * компонент Острова — в модуле с директивой (`../fixture-badge.tsx`), и через
 * границу RSC он проходит ссылкой. Extensions тут пусты: просмотру они не
 * нужны, а Tiptap в графе страницы появляться не должен.
 *
 * Формула (OLDSUI-280, ADR-0070) лежит в документе пустым элементом с `data-latex`:
 * сервер дописывает в него исходный LaTeX, метка острова формул стоит в разметке, а
 * KaTeX и его CSS грузит клиент — в HTML страницы отрисованной формулы нет.
 *
 * Подделки в документе — не для красоты: `scripts/check-consumer.mjs` читает
 * отрисованный HTML и требует, чтобы их там не было, а токены подсветки и
 * гнездо кнопки — были.
 */
const DOMPurify = createDOMPurify(new JSDOM("").window);

const FIXTURE_TOOL: CustomTool = {
  name: "fixture_badge",
  engine: [],
  blocks: {
    fixture_badge: {
      kind: "block",
      attributes: { fixture_label: { kind: "pattern", pattern: "[A-Za-z ]+" } },
      island: FixtureBadge,
    },
  },
};

const SAVED =
  '<h2>Release notes</h2><p class="fixed inset-0" style="position:fixed">Text with ' +
  '<strong>bold</strong> and <a href="javascript:alert(1)">a fake link</a>.</p>' +
  '<pre><code class="language-python">def greet(name):\n    return f"hi {name}"</code></pre>' +
  '<figure><img src="data:image/png;base64,AAAA" alt=""></figure>' +
  '<div data-block="fixture_badge" data-fixture_label="Live badge">Server badge</div>' +
  '<p>Euler: <span data-type="inline-math" data-latex="e^{i\\pi}+1=0"></span></p>';

export default function EditorPage() {
  const html = highlightCodeBlocks(sanitizeRichText(SAVED, DOMPurify, [FIXTURE_TOOL]));
  return (
    <main className="p-6">
      <RichTextView html={html} tools={[FIXTURE_TOOL]} className="max-w-prose" />
    </main>
  );
}
