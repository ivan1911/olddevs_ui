"use client";

import { Node } from "@tiptap/core";
import { BlockFormulaIcon, FormulaIcon } from "../../../icons.js";
// Только тип: статический импорт модуля втянул бы чанк в «старт».
import type * as MathChunkModule from "./mathChunk.js";
import type { ToolDescriptor } from "../../core/toolDescriptor.js";
import { loaded } from "../../core/toolLoader.js";
import {
  BLOCK_FORMULA_NODE,
  BLOCK_FORMULA_TYPE,
  INLINE_FORMULA_NODE,
  INLINE_FORMULA_TYPE,
} from "./mathNames.js";
import { MATH_CHECKS, MATH_DEFAULTS, type MathRenderOptions } from "./mathOptions.js";

/*
  Чанк формул: расширение Mathematics из Tiptap, KaTeX с его CSS, Поповер и
  Markdown (ADR-0070, п. 5). Грузит его Загрузчик Инструмента (ADR-0058, п. 11.1),
  и только Редактор с `mathematics` в `tools`: ни `basic`, ни `full` его не звали.
*/
const loadMath = () => import("./mathChunk.js");

/**
 * Чанк формул, если он уже загружен. Движок с формулами создаётся после
 * загрузчика, а пункты Меню вставки видны только при живом движке — поэтому там,
 * где чанк нужен, он уже есть.
 */
const chunk = () => loaded(loadMath) as typeof MathChunkModule;

/*
  Форма формул для Скелета: те же два узла с тем же разбором `data-latex`, но без
  KaTeX, вида узла, плагинов и Markdown. Исходный LaTeX стоит ТЕКСТОМ внутри
  элемента, и CSS показывает его моноширинным (`prose.ts`): до прихода чанка автор
  видит, что в этом месте формула, и поле не прыгает по высоте так, как прыгало бы
  от пустого места. В Документ эта форма не пишет: она живёт только в Скелете.
*/
const latexAttribute = () => ({
  latex: {
    default: "",
    rendered: false,
    parseHTML: (element: HTMLElement) => element.getAttribute("data-latex"),
  },
});

const MATH_SHAPE = [
  Node.create({
    name: INLINE_FORMULA_NODE,
    group: "inline",
    inline: true,
    atom: true,
    addAttributes: latexAttribute,
    parseHTML: () => [{ tag: `span[data-type="${INLINE_FORMULA_TYPE}"]` }],
    renderHTML: ({ node }) => [
      "span",
      { "data-type": INLINE_FORMULA_TYPE, "data-latex": node.attrs.latex },
      String(node.attrs.latex),
    ],
  }),
  Node.create({
    name: BLOCK_FORMULA_NODE,
    group: "block",
    atom: true,
    addAttributes: latexAttribute,
    parseHTML: () => [{ tag: `div[data-type="${BLOCK_FORMULA_TYPE}"]` }],
    renderHTML: ({ node }) => [
      "div",
      { "data-type": BLOCK_FORMULA_TYPE, "data-latex": node.attrs.latex },
      String(node.attrs.latex),
    ],
  }),
];

/**
 * Формулы на описании Инструмента (ADR-0070; ADR-0048: заказчика при выпуске не
 * было, API по расширению Mathematics из Tiptap): строчный и блочный Атом
 * (`mathChunk.tsx`), Поповер правки (`MathForm.tsx`) и два пункта Меню вставки.
 *
 * ЛЕНИВЫЙ. KaTeX и расширение тяжелее 10 кБ gzip, а в `basic` и `full` формул нет
 * (пресеты их не несут), поэтому Extensions грузит Загрузчик, а до его прихода
 * Редактор с формулами — Скелет (`skeleton`).
 *
 * Кнопки Панели нет: две формулы в ряд сдвинули бы `full` во вторую строку. Строчная
 * и блочная — два пункта Меню вставки («+» и «/»); каждый открывает Поповер с полем
 * LaTeX и сам Документ не готовит (`popover`). Правка существующей формулы — щелчок
 * или Enter на ней (`mathChunk.tsx`).
 *
 * Без Инструмента формула из `value` и вставки читается текстом `$…$` (Схема
 * набора знает её только текстом): `mathAsText.ts`, подключается в `extensions.ts`.
 */
export const MATHEMATICS_TOOL: ToolDescriptor = {
  name: "mathematics",
  defaults: MATH_DEFAULTS,
  checks: MATH_CHECKS,
  load: loadMath,
  engine: ({ openPopover }, options) =>
    chunk().mathExtensions({ options: options as MathRenderOptions, openPopover }),
  skeleton: () => MATH_SHAPE,
  // Метки к атому не применимы: выделенную формулу Меню выделения и плавающая Панель не окружают.
  blocks: {
    [INLINE_FORMULA_NODE]: { plainAtom: true },
    [BLOCK_FORMULA_NODE]: { plainAtom: true },
  },
  // `span` и `div` Схемы кита; формула — `data-type="inline-math"` / `"block-math"` с `data-latex`.
  kitTags: ["span", "div"],
  insertItems: [
    {
      id: "mathInline",
      section: "insert",
      label: (m) => m.mathInline,
      icon: FormulaIcon,
      aliases: ["latex", "math", "equation", "formula", "katex", "tex"],
      // Документ не готовится: формулу ставит Поповер на место каретки.
      run: (chain) => chain,
      popover: ({ editor, close }) => chunk().renderMathForm({ editor, kind: "inline", close }),
    },
    {
      id: "mathBlock",
      section: "insert",
      label: (m) => m.mathBlock,
      icon: BlockFormulaIcon,
      aliases: ["latex", "math", "equation", "formula", "katex", "tex", "$$"],
      run: (chain) => chain,
      popover: ({ editor, close }) => chunk().renderMathForm({ editor, kind: "block", close }),
    },
  ],
};
