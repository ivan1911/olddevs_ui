"use client";

import {
  Extension,
  getExtensionField,
  getTextBetween,
  getTextSerializersFromSchema,
  type Editor,
  type JSONContent,
  type TextSerializer,
} from "@tiptap/core";
import type { Node as ProseMirrorNode, Schema } from "@tiptap/pm/model";
import { MARKDOWN_FALLBACK, warnNoMarkdown } from "./customMarkdown.js";

/*
  Текст атома (ADR-0058, раздел 4). Одно правило для встроенных и
  своих атомов, и всё, что выдаёт текст Документа, читает его отсюда:

  - Текст атома даёт `renderText` из Части для движка. Листовой атом без него —
    пустая строка, атом с содержимым (картинка с подписью) — текст своих детей;
  - вес атома в `maxLength` — длина этого текста (`countCharacters`);
  - `getText`, `getSelectedText`, копирование текстом и Markdown отдают тот же
    текст.

  Отдельного поля веса нет: оно разошлось бы с текстом, а счётчик — с `getText`.
*/

/** Сериализаторы текста Схемы — `renderText` узлов. Схема не меняется, а набор берётся на каждой правке. */
const SERIALIZERS = new WeakMap<Schema, Record<string, TextSerializer>>();

export function textSerializers(schema: Schema): Record<string, TextSerializer> {
  let found = SERIALIZERS.get(schema);
  if (!found) SERIALIZERS.set(schema, (found = getTextSerializersFromSchema(schema)));
  return found;
}

/** `renderText` самого узла; `undefined` — у его типа сериализатора нет. */
function ownText(node: ProseMirrorNode): string | undefined {
  return textSerializers(node.type.schema)[node.type.name]?.({
    node,
    pos: 0,
    parent: node,
    index: 0,
    range: { from: 0, to: node.nodeSize },
  });
}

/**
 * `leafText` Схемы из `renderText`: так читают Текст атома и ProseMirror
 * (`textContent`, `textBetween`, текст при копировании), и Tiptap, у которого
 * `renderText` сам становится только `toText`.
 *
 * У `leafText` нет позиции и родителя — их нет и у вызова ProseMirror, — поэтому
 * сериализатор получает лишь узел: `renderText` атома по документации читает
 * его атрибуты. Поле лежит на каждом узле Схемы, а читает `toText` лениво: на
 * сборке Схемы функция `renderText` у узла ещё не видна.
 */
export const AtomText = Extension.create({
  name: "atomText",

  extendNodeSchema() {
    return { leafText: (node: ProseMirrorNode): string => ownText(node) ?? "" };
  },
});

/** Текст Документа между позициями: Блоки разделены `blockSeparator`, атом — своим Текстом атома. */
export function textBetween(
  doc: ProseMirrorNode,
  from: number,
  to: number,
  blockSeparator: string
): string {
  return getTextBetween(
    doc,
    { from, to },
    { blockSeparator, textSerializers: textSerializers(doc.type.schema) }
  );
}

/** Текст атома: его `renderText`, а без него — текст детей (у листа — пустая строка). */
export function atomText(node: ProseMirrorNode): string {
  return ownText(node) ?? textBetween(node, 0, node.content.size, "");
}

/*
  Markdown. Узел без `renderMarkdown` менеджер Markdown Tiptap выгружает
  пустой строкой, и свой атом пропал бы из `getMarkdown`, хотя `getText` его
  видит. Поэтому перед выгрузкой такой атом заменяется своим Текстом атома
  (в абзаце, если он Блок); пропадает только атом без текста.
*/

/**
 * Узлы по выгрузке в Markdown: `true` — Часть для движка умеет сама, строка —
 * атом своего Инструмента без правил (имя Инструмента — для предупреждения).
 */
function markdownHandled(editor: Editor): Map<string, true | string> {
  const names = new Map<string, true | string>();
  for (const extension of editor.extensionManager.extensions) {
    if (extension.type !== "node") continue;
    if (getExtensionField(extension, "renderMarkdown")) names.set(extension.name, true);
    const tool = getExtensionField<string>(extension, MARKDOWN_FALLBACK as never);
    if (typeof tool === "string") names.set(extension.name, tool);
  }
  return names;
}

function markdownJson(
  node: ProseMirrorNode,
  handled: ReadonlyMap<string, true | string>
): JSONContent[] {
  if (node.isText) return [node.toJSON()];
  const rule = handled.get(node.type.name);
  if (node.isAtom && rule !== true) {
    if (typeof rule === "string") warnNoMarkdown(rule);
    const text = atomText(node);
    if (!text) return [];
    const run: JSONContent = {
      type: "text",
      text,
      ...(node.marks.length > 0 && { marks: node.marks.map((mark) => mark.toJSON()) }),
    };
    return [node.isBlock ? { type: "paragraph", content: [run] } : run];
  }
  const content: JSONContent[] = [];
  node.forEach((child) => void content.push(...markdownJson(child, handled)));
  return [
    {
      type: node.type.name,
      ...(Object.keys(node.attrs).length > 0 && { attrs: node.attrs }),
      ...(node.marks.length > 0 && { marks: node.marks.map((mark) => mark.toJSON()) }),
      ...(content.length > 0 && { content }),
    },
  ];
}

/** Markdown Документа: `getMarkdown` Tiptap, где атом без своей выгрузки идёт его Текстом атома. */
export function markdownOf(editor: Editor): string {
  const [doc] = markdownJson(editor.state.doc, markdownHandled(editor));
  return editor.markdown?.serialize(doc as JSONContent) ?? "";
}
