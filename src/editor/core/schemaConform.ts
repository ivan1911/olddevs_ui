"use client";

import type { Editor, JSONContent } from "@tiptap/core";
import type { Schema } from "@tiptap/pm/model";
import { formulaJsonAsText } from "../features/mathematics/mathAsText.js";
import { videoJsonAsLink } from "../features/video/videoAsLink.js";

/**
 * Дерево JSON — к Схеме Редактора, до `Schema.nodeFromJSON`.
 *
 * ПОЧЕМУ ЧИСТИМ JSON САМИ. `nodeFromJSON` не проверяет ни допустимость уровня
 * заголовка, ни порядок вложенности и на неизвестном типе узла бросает — и
 * тогда Tiptap молча подменяет весь документ пустым. Поэтому перед загрузкой
 * JSON сверяется со Схемой: чужие узлы разворачиваются в своё содержимое,
 * чужие метки снимаются, уровень заголовка прижимается к разрешённым. Список
 * узлов здесь не зашит: что в Схеме сейчас, то и пройдёт — выключенный
 * Инструмент убирает узел из Схемы, а этот код менять не придётся.
 *
 * Зовут его импорт Markdown (`markdown.ts`): `@tiptap/markdown` разбирает текст
 * в JSON по набору расширений движка.
 */

/** Разрешённые уровни заголовка: из расширения, а не из константы кита. */
export function headingLevels(editor: Editor): number[] {
  const heading = editor.extensionManager.extensions.find(({ name }) => name === "heading");
  const levels: unknown = heading?.options?.levels;
  return Array.isArray(levels) && levels.length > 0 ? levels.map(Number) : [];
}

/** Ближайший разрешённый уровень: `#` при H2–H4 становится H2, `#####` — H4. */
function clampLevel(level: number, allowed: readonly number[]): number {
  return allowed.reduce((best, candidate) =>
    Math.abs(candidate - level) < Math.abs(best - level) ? candidate : best
  );
}

const isInline = (node: JSONContent, schema: Schema) =>
  node.type === "text" || (!!node.type && !!schema.nodes[node.type]?.isInline);

/**
 * Голый текст в блоке, который держит только блоки, прячется в абзац. Так
 * выглядит пункт списка, когда расширения для его разметки в движке нет:
 * `- [ ] дело` без чек-листа приходит пунктом с текстом без абзаца, и без
 * обёртки вставка потеряла бы его целиком.
 */
function wrapInlineRuns(children: JSONContent[], schema: Schema): JSONContent[] {
  if (!schema.nodes.paragraph) return children;
  const blocks: JSONContent[] = [];
  let run: JSONContent[] = [];
  const flush = () => {
    if (run.length > 0) blocks.push({ type: "paragraph", content: run });
    run = [];
  };
  for (const child of children) {
    if (isInline(child, schema)) {
      run.push(child);
    } else {
      flush();
      blocks.push(child);
    }
  }
  flush();
  return blocks;
}

export interface ConformOptions {
  /** Разрешённые уровни заголовка (`headingLevels`); пусто — уровень как есть. */
  levels: readonly number[];
  /**
   * Узлы, которые разворачиваются в содержимое, даже если они есть в Схеме:
   * так вход говорит, чего из него не создаётся (Markdown — Раскладки и Обёртки).
   */
  excluded?: ReadonlySet<string>;
}

/** Приводит узел JSON к Схеме: чужое разворачивается или снимается. */
export function conformToSchema(
  node: JSONContent,
  schema: Schema,
  options: ConformOptions
): JSONContent[] {
  if (node.type === "text") {
    const marks = node.marks?.filter((mark) => mark.type in schema.marks);
    return [{ ...node, marks: marks?.length ? marks : undefined }];
  }
  const children = (node.content ?? []).flatMap((child) => conformToSchema(child, schema, options));
  const type = node.type && !options.excluded?.has(node.type) ? schema.nodes[node.type] : undefined;
  // Формула без Инструмента `mathematics` — текстом, видео без `youtube` и `twitch` —
  // ссылкой, а не потерей (`mathAsText.ts`, `videoAsLink.ts`).
  if (!type) return formulaJsonAsText(node) ?? videoJsonAsLink(node, schema) ?? children;

  const content = type.inlineContent || type.isLeaf ? children : wrapInlineRuns(children, schema);
  const result: JSONContent = { ...node, content: content.length ? content : undefined };
  const { levels } = options;
  if (type.name === "heading" && levels.length > 0) {
    result.attrs = { ...node.attrs, level: clampLevel(Number(node.attrs?.level), levels) };
  }
  return type.inlineContent ? liftBlocks(result, schema) : [result];
}

/**
 * Блок внутри текстового Блока выносится наружу, а текст вокруг остаётся
 * абзацами по обе стороны. Так приходит картинка посреди строки: в Markdown
 * `![…](…)` — строчный элемент, а в Схеме картинка — Блок (`figure`).
 * `nodeFromJSON` вложенность не проверяет, и без выноса Блок оказался бы
 * внутри абзаца.
 */
function liftBlocks(node: JSONContent, schema: Schema): JSONContent[] {
  const children = node.content ?? [];
  if (children.every((child) => isInline(child, schema))) return [node];
  const parts: JSONContent[] = [];
  let run: JSONContent[] = [];
  const flush = () => {
    if (run.length > 0) parts.push({ ...node, content: run });
    run = [];
  };
  for (const child of children) {
    if (isInline(child, schema)) run.push(child);
    else {
      flush();
      parts.push(child);
    }
  }
  flush();
  return parts;
}
