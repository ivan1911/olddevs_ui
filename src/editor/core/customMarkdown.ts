"use client";

import {
  getExtensionField,
  type AnyExtension,
  type Editor,
  type JSONContent,
  type MarkdownRendererHelpers,
} from "@tiptap/core";
import { devWarn } from "../../lib/dev-warn.js";

/*
  Markdown своего Инструмента по умолчанию (ADR-0058, п. 3.1).

  Свои правила Markdown — в Части для движка: `renderMarkdown` и токенайзер
  Tiptap, отдельного поля в описании нет. Без них `@tiptap/markdown` молча
  выгрузил бы узел пустой строкой — вместе со всем текстом внутри. Поэтому
  Node и Mark без `renderMarkdown` кит дописывает сам: Блок выгружается своим
  содержимым (как `conform` при разборе Markdown разворачивает чужой узел),
  атом — Текстом атома (`renderText`, ADR-0058, п. 4), Метка — своим текстом.
  Пропадает только атом без текста. Обратно такой Блок из Markdown не
  создаётся: правил разбора у него нет, его текст встаёт абзацами.

  Предупреждение — одно на Инструмент и только когда умолчание сработало:
  потребителю, который Markdown не выгружает, оно ни к чему.
*/

/** Поле конфигурации атома своего Инструмента без правил Markdown: имя Инструмента. */
export const MARKDOWN_FALLBACK = "kitMarkdownFallback";

/** Предупреждение о Markdown по умолчанию — одно на Инструмент (`devWarn` помнит текст). */
export function warnNoMarkdown(tool: string): void {
  devWarn(
    `custom tool "${tool}" has no Markdown rules (renderMarkdown in its engine part): ` +
      "getMarkdown() writes its blocks as their content and its atoms as their text"
  );
}

/** Поля Node или Mark, дописывающие Markdown по умолчанию; `{}`, если свои правила есть. */
export function markdownFallback(extension: AnyExtension, tool: string): object {
  if (getExtensionField(extension, "renderMarkdown") !== undefined) return {};
  // Атом (лист или `atom: true`) выгружает `markdownOf` (`atomText.ts`) — тем же
  // Текстом атома, что у встроенных, и без пустого Блока на месте атома без
  // текста. Здесь — только метка, чтобы `markdownOf` предупредил о нём сам.
  if (
    extension.type === "node" &&
    (getExtensionField(extension, "atom") === true ||
      getExtensionField(extension, "content") === undefined)
  ) {
    return { [MARKDOWN_FALLBACK]: tool };
  }
  // Редактор, в чьей Схеме живёт узел: Markdown получает JSON, а Текст атома
  // считает `renderText` по узлу ProseMirror. Описание своего Инструмента
  // разворачивается на каждый Редактор (`expandTools`), поэтому Редактор один.
  let editor: Editor | null = null;
  return {
    onBeforeCreate(
      this: { editor: Editor; parent?: ((...args: unknown[]) => void) | null },
      ...args: unknown[]
    ) {
      editor = this.editor;
      this.parent?.(...args);
    },
    renderMarkdown(node: JSONContent, helpers: MarkdownRendererHelpers): string {
      warnNoMarkdown(tool);
      // Метка: Tiptap вызывает это ради открывающей и закрывающей разметки
      // вокруг заглушки — их нет, остаётся текст.
      if (extension.type === "mark") return helpers.renderChildren(node);
      const type = editor?.schema.nodes[node.type ?? ""];
      if (!node.content) return "";
      return helpers.renderChildren(node.content, type && !type.inlineContent ? "\n\n" : "");
    },
  };
}
