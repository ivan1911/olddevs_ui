import { normalizeCodeLanguage } from "./codeLanguages.js";
import { highlightCode, type HighlightTree } from "./lowlight.js";

/**
 * Блок кода в форме Редактора: `<pre><code class="language-…">` и внутри —
 * только экранированный текст. Схема не пускает в блок кода ни меток, ни
 * переносов `<br>`, и `getHTML()` пишет его ровно так; DOMPurify при очистке
 * форму не меняет.
 *
 * `[^<]*` — НЕ УПРОЩЕНИЕ, А ЗАСЛОН. Блок, внутри которого уже есть разметка
 * (подсвеченный раньше, написанный руками), под выражение не подходит и
 * остаётся как был. Отсюда идемпотентность: второй проход не находит ни одного
 * блока с голым текстом.
 */
const CODE_BLOCK = /<pre><code class="language-([\w+#-]+)">([^<]*)<\/code><\/pre>/g;

/**
 * Сущности, которые пишут сериализаторы DOM (`innerHTML` браузера, jsdom у
 * DOMPurify, `getHTML()` Tiptap) в тексте: `&amp;`, `&lt;`, `&gt;`, `&nbsp;`,
 * плюс кавычки и числовые — их пишут другие санитайзеры.
 */
const NAMED: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

/**
 * Текст блока из HTML. `null` — встретилась именованная сущность вне списка
 * (`&copy;`): без полной таблицы HTML её не раскрыть так, как раскроет браузер,
 * и блок лучше оставить неподсвеченным, чем показать другой текст.
 */
function decode(html: string): string | null {
  let unknown = false;
  const text = html.replace(/&(#x[\da-f]+|#\d+|[a-z][a-z\d]*);/gi, (entity, body: string) => {
    if (body[0] === "#") {
      const code =
        body[1] === "x" || body[1] === "X" ? parseInt(body.slice(2), 16) : Number(body.slice(1));
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : entity;
    }
    const named = NAMED[body];
    if (named === undefined) unknown = true;
    return named ?? entity;
  });
  return unknown ? null : text;
}

const escapeText = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const escapeAttribute = (value: string) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

type HighlightNode = HighlightTree["children"][number];

/**
 * Дерево lowlight в HTML.
 *
 * ПОЧЕМУ СВОЙ СЕРИАЛИЗАТОР, А НЕ `hast-util-to-html`. Дерево lowlight узкое:
 * текст и `span` с `className` — больше в нём ничего не бывает. Под это хватает
 * десяти строк, а `hast-util-to-html` — ещё одна опциональная зависимость
 * потребителя с полудюжиной своих пакетов ради разметки, которой здесь нет.
 * Текст экранируется всегда (`&`, `<`, `>`), значение класса — в кавычках с
 * экранированием; `style` и прочие свойства узла не пишутся вовсе.
 */
function serialize(nodes: readonly HighlightNode[]): string {
  return nodes
    .map((node) => {
      if (node.type === "text") return escapeText(node.value);
      if (node.type !== "element") return "";
      const className = node.properties.className;
      const classes = Array.isArray(className) ? className.join(" ") : "";
      return `<span class="${escapeAttribute(classes)}">${serialize(node.children)}</span>`;
    })
    .join("");
}

/**
 * Подсветить блоки кода в сохранённом Документе — для `RichTextView` и любой
 * другой страницы показа (ADR-0051).
 *
 * В каждом `<pre><code class="language-…">` на языке Редактора текст
 * заменяется токенами `<span class="hljs-…">`; цвета им даёт тема на
 * контейнере `RichTextView` (`codeTheme.ts`). Остальной HTML не трогается ни
 * на байт. Блок без языка, на неизвестном языке или уже с разметкой внутри
 * остаётся как был — поэтому повторный вызов ничего не меняет.
 *
 * ПОРЯДОК: СНАЧАЛА ОЧИСТКА, ПОТОМ ПОДСВЕТКА. Хелпер ищет блоки выражением, а не
 * разбором HTML, и рассчитан на разметку Схемы, которую отдаёт санитайзер.
 * Токенов `hljs-*` в Схеме нет, и `sanitizeRichText` их снимает: очистка после
 * подсветки вернула бы блок к голому тексту.
 *
 * Модуль серверно-безопасен: строка в строку, без DOM, React и Tiptap. Зовут
 * его на сервере — при выдаче страницы или при сохранении, рядом с очисткой.
 */
export function highlightCodeBlocks(html: string): string {
  return html.replace(CODE_BLOCK, (block, name: string, escaped: string) => {
    const language = normalizeCodeLanguage(name);
    const code = language ? decode(escaped) : null;
    if (!language || code === null || code === "") return block;
    const tokens = serialize(highlightCode(language, code).children);
    // Класс — каноническое имя Схемы, а не строка из Документа: `language-PY`
    // подсвечен как Python и должен им же и называться — иначе очистка `sanitizeRichText`
    // снимет класс, а шапка и тема прочтут блок не так, как его подсветили.
    return `<pre><code class="language-${language}">${tokens}</code></pre>`;
  });
}
