/*
  ФОРМУЛЫ В HTML ДОКУМЕНТА (ADR-0070). Редактор пишет формулу пустым элементом:
  `<span data-type="inline-math" data-latex="…"></span>` и
  `<div data-type="block-math" data-latex="…"></div>`. Отрисованной разметки KaTeX
  в Документе нет — её рисует вид узла в Редакторе и Остров `RichTextView`.

  Модуль серверный, как `codeHeader.ts`: строки в строки, без DOM и без KaTeX. Его
  читает `RichTextView` — серверный компонент.
*/
import { BLOCK_FORMULA_TYPE, INLINE_FORMULA_TYPE } from "./mathNames.js";

/**
 * Исходный LaTeX, безопасный для атрибута `data-latex`: пробел внутрь пар, которые
 * DOMPurify 3 считает концом разметки.
 *
 * ЗАЧЕМ. `SAFE_FOR_XML` у DOMPurify срезает атрибут целиком, если его значение
 * содержит `]>`, `-->`, `--!>` или `</style|script|title|…`, и делает это раньше
 * хуков кита. LaTeX такое содержит законно: `\left[0,1\right]>x`, стрелки `-->`.
 * Без правки формула пропала бы на сервере потребителя вместе с обёрткой. Пробел
 * рвёт пару: `]>` → `] >`, `-->` → `-- >`, `--!>` → `--! >`, `</` → `< /`. В
 * математическом режиме KaTeX пробелы не рисует, и формула выглядит так же; в
 * `\text{…}` пробел виден — предел, он записан в справочнике.
 *
 * ОДНА ФУНКЦИЯ НА ДВА МЕСТА. Редактор пишет `data-latex` уже такой (сохранённый
 * HTML безопасен и при втором проходе не меняется), а санитайзер применяет её к
 * чужому HTML до проверки DOMPurify. Повторный вызов исходник не меняет.
 */
export function safeLatexSource(latex: string): string {
  return latex.replace(/(--!?|\])>/g, "$1 >").replace(/<\//g, "< /");
}

/** Есть ли в Документе формула: по ней `RichTextView` решает, монтировать ли Остров. */
export function hasMath(html: string): boolean {
  return (
    html.includes(`data-type="${INLINE_FORMULA_TYPE}"`) ||
    html.includes(`data-type="${BLOCK_FORMULA_TYPE}"`)
  );
}

/**
 * Открывающий тег `span` или `div` с атрибутами в двойных кавычках — так пишет
 * сериализатор DOM. Значение атрибута может содержать `>` (LaTeX `a>b`), поэтому
 * тег разбирается по атрибутам, а не по первому `>`.
 */
const FORMULA_ELEMENT = /<(span|div)((?:\s+[\w:-]+(?:="[^"]*")?)*)\s*><\/\1>/g;

/** Исходный LaTeX из атрибутов формулы или `null`, если это не формула. */
function formulaSource(tag: string, attributes: string): string | null {
  const type = /\sdata-type="([^"]*)"/.exec(attributes)?.[1];
  if (type !== (tag === "span" ? INLINE_FORMULA_TYPE : BLOCK_FORMULA_TYPE)) return null;
  return /\sdata-latex="([^"]*)"/.exec(attributes)?.[1] ?? null;
}

/**
 * Исходный LaTeX внутрь пустых элементов формул, строка в строку, на сервере.
 *
 * ЗАЧЕМ. Без JS и до того, как Остров отрисует формулу, читатель видит её
 * исходник (ADR-0070, п. 6), и текст выделяется и ищется как обычный. Пустой
 * элемент без этого был бы пустым местом. Остров потом заменяет содержимое
 * отрисованной формулой.
 *
 * Значение атрибута уже экранировано сериализатором (`&amp;`, `&quot;`), для
 * текста дописывается лишь `<` и `>`, которые в значении бывают голыми. Чужих
 * источников разметки хелпер не открывает: в строку попадает только то, что и так
 * стояло в атрибуте того же элемента. Элемент с содержимым не трогается.
 */
export function withMathSource(html: string): string {
  if (!hasMath(html)) return html;
  return html.replace(FORMULA_ELEMENT, (element, tag: string, attributes: string) => {
    const latex = formulaSource(tag, attributes);
    if (latex === null) return element;
    const text = latex.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return `<${tag}${attributes}>${text}</${tag}>`;
  });
}
