import { createElement, type ReactNode } from "react";
import { normalizeCodeLanguage } from "./codeLanguages.js";
import { CODE_THEME_CLASS } from "../../styles/codeTheme.js";
import { highlightCode, type HighlightTree } from "./lowlight.js";

type HighlightNode = HighlightTree["children"][number];

/**
 * Дерево lowlight в узлы React: текст — текстом, токен — `span` с его
 * классами `hljs-…` и больше ничем. Свойства узла, кроме класса, не
 * переносятся, как и в сериализаторе `highlightCodeBlocks` (`highlight.ts`).
 *
 * Дети уходят в `createElement` списком аргументов, а не массивом: так React
 * не просит ключей, а порядок токенов не меняется никогда.
 */
function toNodes(nodes: readonly HighlightNode[]): ReactNode[] {
  return nodes.map((node) => {
    if (node.type === "text") return node.value;
    if (node.type !== "element") return null;
    const className = node.properties.className;
    const classes = Array.isArray(className) ? className.join(" ") : undefined;
    return createElement("span", { className: classes }, ...toNodes(node.children));
  });
}

/**
 * Подсветить код для `CodeView` (ADR-0052) — той же грамматикой и
 * той же темой, что блок кода Редактора и `RichTextView`.
 *
 * ```tsx
 * <CodeView code={source} title="main.py" copyable>
 *   {highlightCodeNodes(source, "python")}
 * </CodeView>
 * ```
 *
 * УЗЛЫ, А НЕ СТРОКА HTML. Код у `CodeView` обычно недоверенный — ответ API,
 * тело вебхука, — и строка вела бы потребителя к `dangerouslySetInnerHTML`.
 * Здесь текст кода становится текстовым узлом React и экранируется им же.
 *
 * Язык — по правилам Редактора (`codeLanguages.ts`): регистр, пробелы и
 * псевдонимы не важны. Неизвестный язык и пустой код дают `null`, а не код
 * строкой: тогда `children` у `CodeView` пуст, и он рисует код как есть — с
 * нумерацией строк, которой при разметке нет.
 *
 * КОРЕНЬ С МАРКЕРОМ И ТЕМОЙ. Токены завёрнуты в один `span` с атрибутом
 * `data-code-highlight` и классами темы (`codeTheme.ts`). Тема стоит на корне,
 * а не на `CodeView`: разметку чужого подсветчика — даже с теми же классами
 * `hljs-…` — она не перекрашивает. Маркер читает `CodeView`, чтобы взять фон
 * темы подсветки: цвета GitHub не держат контраста на подложке кода кита.
 *
 * Хуков и `"use client"` нет: хелпер зовут и в серверном компоненте, и в
 * клиентском.
 */
export function highlightCodeNodes(code: string, language: string): ReactNode {
  const id = normalizeCodeLanguage(language);
  if (!id || code === "") return null;
  return createElement(
    "span",
    {
      "data-code-highlight": "",
      className: `${CODE_THEME_CLASS.trim()} text-(--rte-code-block-foreground)`,
    },
    ...toNodes(highlightCode(id, code).children)
  );
}
