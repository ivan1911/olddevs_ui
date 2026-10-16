"use client";

import { Extension } from "@tiptap/core";
import type { JSONContent } from "@tiptap/core";
import { DOMParser as ProseMirrorParser, type ParseOptions, type Schema } from "@tiptap/pm/model";

/*
  ФОРМУЛА БЕЗ ИНСТРУМЕНТА `mathematics` — ТЕКСТОМ (ADR-0070, «поведение без
  Инструмента»).

  Формула лежит в HTML пустым элементом, а исходник — в `data-latex`. В Схеме без
  Инструмента узла для неё нет, и обычный разбор выбросил бы пустой `span` вместе
  с формулой: Редактор без `mathematics`, открывший чужой Документ, при
  сохранении стёр бы её молча. Поэтому такой Редактор читает формулу текстом
  `$…$` (в строке) и абзацем `$$…$$` (Блок): LaTeX не пропадает, виден автору и
  при включённом Инструменте вставляется обратно формулой.

  КАК. Разбор HTML в Документ — один `DOMParser` ProseMirror, закэшированный на
  Схеме, и им идут все пути: `value`, вставка, HTML-режим, Скелет. Подменяется он,
  а не каждая точка входа: формулы в DOM заменяются текстом перед разбором, дальше
  всё как обычно. Кэш — `schema.cached.domParser`, штатное место
  `DOMParser.fromSchema`; тест `rich-text-editor-mathematics.test.tsx` держит
  поведение, если ProseMirror переедет.
*/

const FORMULAS = "span[data-type=inline-math], div[data-type=block-math]";

/**
 * Формула в дереве JSON (`inlineMath`, `blockMath`) — текстом: тот же путь для
 * конверта Документа (`jsonDocument.ts`), что `formulasToText` для HTML. `null` —
 * это не формула или исходника нет. Зовёт `conformToSchema`, когда узла в Схеме нет.
 */
export function formulaJsonAsText(node: JSONContent): JSONContent[] | null {
  const latex = node.attrs?.latex;
  if (typeof latex !== "string" || (node.type !== "inlineMath" && node.type !== "blockMath")) {
    return null;
  }
  if (!latex.trim()) return [];
  if (node.type === "inlineMath") return [{ type: "text", text: `$${latex}$` }];
  return [{ type: "paragraph", content: [{ type: "text", text: `$$${latex}$$` }] }];
}

/** Формулы поддерева — текстом. Меняет `dom` на месте: разбор получает свежий DOM. */
function formulasToText(dom: Node): Node {
  const root = dom as Partial<ParentNode>;
  for (const element of [...(root.querySelectorAll?.(FORMULAS) ?? [])]) {
    const latex = element.getAttribute("data-latex") ?? "";
    const owner = element.ownerDocument;
    if (!latex.trim()) {
      element.remove();
    } else if (element.localName === "span") {
      element.replaceWith(owner.createTextNode(`$${latex}$`));
    } else {
      const paragraph = owner.createElement("p");
      paragraph.textContent = `$$${latex}$$`;
      element.replaceWith(paragraph);
    }
  }
  return dom;
}

class FormulaTextParser extends ProseMirrorParser {
  override parse(dom: Node, options?: ParseOptions) {
    return super.parse(formulasToText(dom), options);
  }
  override parseSlice(dom: Node, options?: ParseOptions) {
    return super.parseSlice(formulasToText(dom), options);
  }
}

/** Схема читает формулы текстом: ставится на Схему набора без `mathematics`. */
export function readFormulasAsText(schema: Schema): void {
  if (schema.cached.domParser instanceof FormulaTextParser) return;
  schema.cached.domParser = new FormulaTextParser(
    schema,
    ProseMirrorParser.fromSchema(schema).rules
  );
}

/**
 * Расширение набора без `mathematics`: Схема читает формулы текстом. Без разметки
 * и без узлов — Схема набора от него не меняется. `onBeforeCreate` идёт раньше
 * первого разбора `value` (Tiptap разбирает его в конце сборки движка).
 */
export const FormulasAsText = Extension.create({
  name: "formulasAsText",

  onBeforeCreate() {
    readFormulasAsText(this.editor.schema);
  },
});
