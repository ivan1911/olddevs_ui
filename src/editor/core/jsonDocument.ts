"use client";

import { createDocument, getHTMLFromFragment, type Editor, type JSONContent } from "@tiptap/core";
import { Fragment, type Node as PmNode } from "@tiptap/pm/model";
import { devError } from "../../lib/dev-warn.js";
import { replaceDocument } from "./maxLength.js";
import { conformToSchema, headingLevels } from "./schemaConform.js";

/*
  JSON-конверт Документа (ADR-0061): формат обмена рядом с HTML, а
  не вместо него. Значение Редактора остаётся HTML (ADR-0050, п. 3); конверт —
  для файлов, шаблонов и переноса без потерь, которых Markdown не выражает.

  Внутри — дерево Документа в форме движка. Имена его узлов и атрибутов с этого
  момента — контракт формата: переименование в Схеме поднимает `version`, а
  старые файлы мигрирует кит, а не экран.
*/

/** Имя формата в конверте: отличает файл Редактора от любого другого JSON. */
const FORMAT = "olddevs-rich-text";
/** Версия дерева. Других пока нет — и миграций тоже. */
const VERSION = 1;

/**
 * Документ Редактора как JSON: `getJSON()` отдаёт его, `setJSON()` и
 * `defaultValue` принимают. `doc` — дерево Документа, верхний узел `"doc"`.
 */
export interface RichTextDocument {
  format: typeof FORMAT;
  version: typeof VERSION;
  doc: JSONContent;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Форма конверта — без Схемы: формат, версия и верхний узел `doc`. */
export function isRichTextDocument(value: unknown): value is RichTextDocument {
  return (
    isObject(value) &&
    value.format === FORMAT &&
    value.version === VERSION &&
    isObject(value.doc) &&
    value.doc.type === "doc" &&
    (value.doc.content === undefined || Array.isArray(value.doc.content))
  );
}

/** Документ движка — конвертом. */
export function documentToJSON(editor: Editor): RichTextDocument {
  return { format: FORMAT, version: VERSION, doc: editor.getJSON() };
}

/**
 * Документ из конверта — через Схему, а не мимо неё. `null` — конверт
 * отвергнут: не та форма, или из дерева не собрать узлы.
 *
 * ДВА ПРОХОДА. Сначала дерево приводится к Схеме (`schemaConform.ts`): без
 * этого `nodeFromJSON` бросил бы на Блоке выключенного Инструмента. Но
 * `nodeFromJSON` не знает правил разбора HTML, а на них держится вся политика
 * атрибутов: адрес ссылки и картинки, цвет автора, `data-*`, правила своих
 * Инструментов. Поэтому собранный Документ выводится в HTML и разбирается Схемой
 * заново — тем же `createDocument`, что входящий `value`. Одна политика на все
 * входы, и второй копии проверок атрибутов нет. Заодно разбор достраивает
 * вложенность, которую `nodeFromJSON` не сверяет. Пробелы при этом не
 * схлопываются: круг `getJSON()` → `setJSON()` текст не меняет.
 */
export function documentFromJSON(editor: Editor, value: unknown): PmNode | null {
  if (!isRichTextDocument(value)) return null;
  const { schema } = editor;
  try {
    const options = { levels: headingLevels(editor) };
    const blocks = (value.doc.content ?? []).flatMap((node) =>
      conformToSchema(node, schema, options)
    );
    const fragment = Fragment.fromArray(blocks.map((block) => schema.nodeFromJSON(block)));
    // Пробелы — как в дереве: HTML здесь пишет сам движок, слитно и без
    // отступов, и схлопывать в нём нечего, кроме двойных пробелов автора.
    return createDocument(getHTMLFromFragment(fragment, schema), schema, {
      preserveWhitespace: "full",
    });
  } catch (error) {
    // Кривой файл — обычный отказ, но бросить могут и Extensions своего
    // Инструмента: причина уходит в консоль разработки, иначе её не найти.
    devError("RichTextEditor: a JSON document could not be built from its tree", error);
    return null;
  }
}

/**
 * Документ целиком — из конверта, Заменой снаружи (`EXTERNAL_CHANGE`), как
 * `replaceWithMarkdown`: предел символов её не режет. `false` — конверт
 * отвергнут, Документ не тронут.
 */
export function replaceWithJSON(editor: Editor, value: unknown): boolean {
  const next = documentFromJSON(editor, value);
  if (next) replaceDocument(editor, next.content);
  return next !== null;
}
