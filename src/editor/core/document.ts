"use client";

import { Node } from "@tiptap/core";

/**
 * Документ с контейнерами Блоков верхнего уровня: Раскладкой (`layout.ts`) и
 * Обёрткой (`wrapper.ts`).
 *
 * Оба не входят в группу `block` — так вложить их можно только туда, где их
 * назвали поимённо (ADR-0056, ADR-0057). Документ называет те, чьи
 * инструменты включены: `(block | layout | wrapper)+`. Без обоих Документ —
 * обычный из StarterKit, а content-выражение с узлом, которого нет в Схеме,
 * ProseMirror не собрал бы вовсе.
 *
 * Имя — не `createDocument`: так в `@tiptap/core` зовётся разбор HTML в
 * Документ, которым пользуется HTML-режим (`RichTextEditor.tsx`). Здесь же —
 * фабрика узла Схемы, и одно имя на два смысла путало бы импорты.
 */
export function createDocumentNode(containers: readonly string[]) {
  return Node.create({
    name: "doc",
    topNode: true,
    content: `(${["block", ...containers].join(" | ")})+`,
    renderMarkdown: (node, helpers) =>
      node.content ? helpers.renderChildren(node.content, "\n\n") : "",
  });
}
