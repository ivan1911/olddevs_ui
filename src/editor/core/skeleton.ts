"use client";

import { createDocument, getSchema } from "@tiptap/core";
import { DOMSerializer } from "@tiptap/pm/model";
import { withCodeHeaders } from "../features/code/codeHeader.js";
import { createEditorExtensions, type EditorExtensionOptions } from "./extensions.js";
import { toolList, type ToolDescriptor, type ToolList } from "./toolDescriptor.js";
import type { ToolLoader } from "./toolLoader.js";

/*
  Документ Скелета (ADR-0058, п. 11.4): `value`, очищенный Схемой
  кита, — тот же разбор, что у движка, только без движка.

  Скелет стоит на месте Документа до Готовности, и до эпика Редактор был
  безопасен и с неочищенным `value`: строка шла только через разбор Схемой.
  Вставить её как есть значило бы исполнить `<img onerror>` из чужого значения.
  Поэтому строка разбирается в инертном документе (`DOMParser` браузера: там не
  исполняются ни скрипты, ни обработчики и не грузятся картинки) по Схеме
  набора и выгружается обратно в HTML — в документ, тоже инертный. Что Схема не
  знает (теги, атрибуты, обработчики, `javascript:`), не доходит до страницы.

  Схема — та, что получит движок, но без Частей для движка, чьи загрузчики ещё
  не отработали: их Блоки видны текстом, обёртку Схема снимает. Ленивый
  встроенный (`codeBlock`, `table`) вместо Части для движка даёт
  форму Блоков (`skeleton` описания) — его Блоки видны своей разметкой, и поле
  не прыгает с приходом чанка. Шапка блока кода — та же, что у `RichTextView`
  (`withCodeHeaders`): в Редакторе она есть, и без неё Скелет был бы ниже. Набор
  расширений собирается ради одной Схемы: движка, плагинов и представлений
  узлов здесь нет, а мосты `RichTextEditor` не нужны — им стоят заглушки.
*/

const quiet = () => {};
const no = () => false;

/** Мосты набора движка: Схема их не читает, а картинке без них нет места в Схеме. */
const SCHEMA_ONLY: Omit<EditorExtensionOptions, "tools"> = {
  placeholder: () => "",
  limit: () => undefined,
  taskCheckbox: (text) => text,
  detailsToggle: (text) => text,
  openPopover: quiet,
  focusToolbar: no,
  openBlockMenu: no,
  onNotice: quiet,
  image: {
    onOpenEditor: quiet,
    captionPlaceholder: () => "",
    uploadingLabel: (name) => name,
    upload: () => undefined,
    describeNotice: () => ({ tone: "status", text: "" }),
  },
};

/**
 * Набор с описаниями, которые оставил `pick` (`undefined` — описание выпадает):
 * имена — те же, Схему решают описания.
 */
function narrowed(
  tools: ToolList,
  pick: (descriptor: ToolDescriptor) => ToolDescriptor | undefined
): ToolList {
  return toolList(
    tools,
    tools.descriptors.flatMap((d) => pick(d) ?? [])
  );
}

/** HTML Документа по Схеме набора; Схема не собралась — `null`. */
function cleaned(html: string, tools: ToolList): string | null {
  try {
    const schema = getSchema(createEditorExtensions({ tools, ...SCHEMA_ONLY }));
    const inert = document.implementation.createHTMLDocument("");
    const box = inert.createElement("div");
    box.append(
      DOMSerializer.fromSchema(schema).serializeFragment(createDocument(html, schema).content, {
        document: inert,
      })
    );
    // Пустое гнездо «Копировать»: острова у Скелета нет, гнездо держит место.
    return withCodeHeaders(box.innerHTML, "");
  } catch {
    return null;
  }
}

/**
 * Документ Скелета: `html`, очищенный Схемой набора без Частей ещё не
 * отработавших загрузчиков (`pending`). Только в браузере.
 *
 * Набор с ошибкой своих Инструментов Схемы не даёт (ошибка поля, ADR-0058,
 * п. 1.5) — тогда Скелет чистит Схемой встроенных: Документ остаётся виден.
 */
export function skeletonHtml(
  html: string,
  tools: ToolList,
  pending: readonly ToolLoader[]
): string {
  // Описание, чей загрузчик ещё не отработал, уступает место форме Блоков — или выпадает.
  const settled = (d: ToolDescriptor): ToolDescriptor | undefined =>
    !d.load || !pending.includes(d.load) ? d : d.skeleton && { name: d.name, engine: d.skeleton };
  return (
    cleaned(html, narrowed(tools, settled)) ??
    cleaned(
      html,
      narrowed(tools, (d) => (d.custom ? undefined : settled(d)))
    ) ??
    ""
  );
}
