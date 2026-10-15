"use client";

import type {
  JSONContent,
  MarkdownLexerConfiguration,
  MarkdownParseHelpers,
  MarkdownRendererHelpers,
  MarkdownToken,
  MarkdownTokenizer,
} from "@tiptap/core";

/**
 * Сворачиваемый Блок в Markdown — СЫРЫМ HTML, как на GitHub:
 *
 * ```
 * <details>
 * <summary>Заголовок</summary>
 *
 * Содержимое — Markdown.
 *
 * </details>
 * ```
 *
 * ПОЧЕМУ СВОЙ РАЗБОР. Расширение Tiptap пишет Блок синтаксисом `:::details`
 * (Pandoc), которого не знает ни GitHub, ни другой Markdown. А общий разбор
 * сырого HTML в `@tiptap/markdown` режет Блок на куски по пустым строкам: HTML-блок
 * CommonMark кончается на первой пустой строке, и открывающий тег, Markdown
 * внутри и закрывающий тег приходят тремя токенами, которые обратно не
 * склеиваются. Поэтому Блок разбирает отдельный токенизатор: от `<details>` до
 * парного `</details>` с учётом вложенных Блоков, а содержимое между ними — снова
 * Markdown. Заголовок (`summary`) — строчный Markdown одной строкой; GitHub его
 * как Markdown не читает (звёздочки останутся звёздочками), но круг через
 * `setMarkdown` и `getMarkdown` от этого без потерь.
 *
 * Модуль без Tiptap-значений: только типы и чистые функции над строкой.
 */

/** Открывающий тег Блока с любыми атрибутами. */
const OPEN_TAG = /^<details(?:\s[^<>]*)?>/i;
/** Любой тег Блока — для подсчёта вложенности. */
const ANY_TAG = /<(\/?)details(?:\s[^<>]*)?>/gi;
/** `summary` сразу после открывающего тега, пробелы и переводы строк до него не в счёт. */
const SUMMARY = /^\s*<summary(?:\s[^<>]*)?>([\s\S]*?)<\/summary>[ \t]*/i;

/**
 * Копия строки, где всё, что тегами Блока быть не может, заменено пробелами:
 * кодовые заборы и строчный код. Длина и позиции те же, поэтому найденные в
 * копии теги указывают в исходную строку. Иначе `<details>` в примере кода внутри
 * Блока сдвинул бы вложенность и Блок закрылся бы не там.
 */
function maskCode(src: string): string {
  let fence: string | null = null;
  const lines = src.split("\n").map((line) => {
    const marker = /^ {0,3}(`{3,}|~{3,})/.exec(line)?.[1];
    if (fence === null && marker) {
      fence = marker[0]!.repeat(3);
      return " ".repeat(line.length);
    }
    if (fence !== null) {
      if (marker && marker.startsWith(fence)) fence = null;
      return " ".repeat(line.length);
    }
    return line.replace(/(`+)[^`\n]*?\1/g, (span) => " ".repeat(span.length));
  });
  return lines.join("\n");
}

/** Позиция конца парного `</details>` (после тега) для Блока, открытого в начале `src`. */
function closingEnd(src: string, afterOpen: number): number {
  const masked = maskCode(src);
  let level = 1;
  ANY_TAG.lastIndex = afterOpen;
  for (let match = ANY_TAG.exec(masked); match; match = ANY_TAG.exec(masked)) {
    level += match[1] ? -1 : 1;
    if (level === 0) return match.index + match[0].length;
  }
  return -1;
}

/** Заголовок одной строкой: переводы строк и повторы пробелов — в один пробел. */
function oneLine(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Токенизатор Блока `details` для `marked` (`markdownTokenizer` расширения). */
export const detailsTokenizer: MarkdownTokenizer = {
  name: "details",
  level: "block",
  start: (src) => src.search(/^<details[\s>]/im),
  tokenize(src, _tokens, lexer: MarkdownLexerConfiguration) {
    const open = OPEN_TAG.exec(src);
    if (!open) return undefined;
    const end = closingEnd(src, open[0].length);
    if (end < 0) return undefined;
    // Конец Блока — строка целиком: хвост после `</details>` не наше дело.
    const raw = src.slice(0, end);
    const closeTag = /<\/details(?:\s[^<>]*)?>$/i.exec(raw)?.[0] ?? "";
    const inner = raw.slice(open[0].length, raw.length - closeTag.length);
    const summary = SUMMARY.exec(inner);
    const body = summary ? inner.slice(summary[0].length) : inner;
    const tokens: MarkdownToken[] = body.trim() ? lexer.blockTokens(body) : [];
    // Строчные токены блоков без своих `tokens` (абзац, заголовок) разбирает
    // сам `marked` внутри `blockTokens`; здесь дозаполняется только то, что он
    // оставил текстом, как в `createBlockMarkdownSpec` Tiptap.
    for (const token of tokens) {
      if (token.text && (!token.tokens || token.tokens.length === 0)) {
        token.tokens = lexer.inlineTokens(token.text);
      }
    }
    return {
      type: "details",
      raw,
      // `open` — если он в открывающем теге: `<details open>`.
      open: /^<details(?:\s[^<>]*)?\sopen(?:[\s=>/]|$)/i.test(open[0]),
      summary: summary ? lexer.inlineTokens(oneLine(summary[1] ?? "")) : [],
      tokens,
    } as MarkdownToken;
  },
};

/**
 * Токен — в узел Блока: заголовок из текста с Метками, содержимое Блоками (пустое
 * — одним пустым абзацем). Атрибут `open` — только когда он в Схеме (`persist`).
 */
export function parseDetails(
  token: MarkdownToken,
  helpers: MarkdownParseHelpers,
  persist: boolean
): JSONContent {
  const title = helpers
    .parseInline((token.summary as MarkdownToken[] | undefined) ?? [])
    // Заголовок — только текст с Метками: перенос и картинка в нём не живут.
    .filter((node) => node.type === "text");
  const blocks = helpers.parseChildren(token.tokens ?? []);
  return helpers.createNode("details", persist && token.open === true ? { open: true } : {}, [
    helpers.createNode("detailsSummary", {}, title),
    helpers.createNode("detailsContent", {}, blocks.length > 0 ? blocks : [{ type: "paragraph" }]),
  ]);
}

/**
 * Узел — в Markdown: открывающий тег с `summary` на своей строке, пустая строка,
 * Блоки через пустую строку, пустая строка, закрывающий тег. Пустая строка после
 * `summary` — то, что заставляет GitHub читать содержимое как Markdown.
 * `<` в заголовке пишется как `&lt;`: иначе текст «a </summary> b» закрыл бы
 * заголовок раньше времени.
 */
export function renderDetails(
  node: JSONContent,
  helpers: MarkdownRendererHelpers,
  persist: boolean
): string {
  const [summary, content] = node.content ?? [];
  const title = summary?.content ? helpers.renderChildren(summary.content) : "";
  const body = content?.content ? helpers.renderChildren(content.content, "\n\n") : "";
  const open = persist && node.attrs?.open ? " open" : "";
  return `<details${open}>\n<summary>${title.replace(/</g, "&lt;")}</summary>\n\n${body}\n\n</details>`;
}
