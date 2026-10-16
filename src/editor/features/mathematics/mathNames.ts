/**
 * Имена формул — ЛЁГКАЯ ЧАСТЬ ДАННЫХ (ADR-0070): всё, что очистке на сервере
 * (`schema.ts`), `RichTextView` и описанию Инструмента в «старте» нужно знать о
 * том, как формула называется. Раньше те же строки стояли в шести файлах, а
 * `INLINE_MATH` значило в двух из них разное (значение `data-type` и имя узла).
 *
 * Имён два вида, и путать их нельзя:
 *
 * - **значение `data-type`** в HTML Документа (`*_FORMULA_TYPE`): так формулу
 *   пишет расширение Mathematics из Tiptap, и так её читают санитайзер, Просмотр
 *   и Остров;
 * - **имя узла** Tiptap (`*_FORMULA_NODE`): так её зовут Схема движка, команды
 *   (`insertInlineMath`, …), JSON-конверт Документа и Markdown-токенизаторы.
 *
 * Модуль серверно-безопасен: только строки, без React, Tiptap и KaTeX.
 */

/** Значение `data-type` строчной формулы: `span[data-type="inline-math"]`. */
export const INLINE_FORMULA_TYPE = "inline-math";
/** Значение `data-type` блочной формулы: `div[data-type="block-math"]`. */
export const BLOCK_FORMULA_TYPE = "block-math";

/** Имя узла строчной формулы в Схеме движка. */
export const INLINE_FORMULA_NODE = "inlineMath";
/** Имя узла блочной формулы в Схеме движка. */
export const BLOCK_FORMULA_NODE = "blockMath";

/** Атрибут с исходным LaTeX: единственное содержимое формулы в HTML. */
export const FORMULA_SOURCE_ATTRIBUTE = "data-latex";

/** Селектор строчной формулы в HTML: тег и `data-type` из пары. */
export const INLINE_FORMULA_SELECTOR = `span[data-type=${INLINE_FORMULA_TYPE}]`;
/** Селектор блочной формулы в HTML. */
export const BLOCK_FORMULA_SELECTOR = `div[data-type=${BLOCK_FORMULA_TYPE}]`;
/** Селектор любой формулы в HTML. */
export const FORMULA_SELECTOR = `${INLINE_FORMULA_SELECTOR}, ${BLOCK_FORMULA_SELECTOR}`;

/** Узел с таким именем — формула, строчная или блочная. */
export function isFormulaNodeName(name: string): boolean {
  return name === INLINE_FORMULA_NODE || name === BLOCK_FORMULA_NODE;
}
