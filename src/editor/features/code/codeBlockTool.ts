"use client";

import { Node } from "@tiptap/core";
import { CodeBlockIcon } from "../../../icons.js";
// Только тип: статический импорт модуля втянул бы чанк в «старт».
import type * as CodeBlockChunk from "./codeBlock.js";
import { normalizeCodeLanguage, type CodeLanguageId } from "./codeLanguages.js";
import { shortcutKeys } from "../../core/shortcuts.js";
import type { ToolDescriptor } from "../../core/toolDescriptor.js";
import { loaded } from "../../core/toolLoader.js";

/*
  Чанк блока кода: расширение с языком и подсветкой, представление узла с
  шапкой (`CodeBlockView`), lowlight и грамматики highlight.js — около 30 кБ
  gzip, которые `basic` не платит (ADR-0058, п. 11.1).
*/
const loadCodeBlock = () => import("./codeBlock.js");

/**
 * Язык блока кода из разметки `<pre><code class="…">`: первый класс
 * `language-*`, который знает Редактор. `evil language-js` даёт JavaScript,
 * `language-rust` — «Обычный текст». Один разбор у движка (`codeBlock.ts`) и у
 * формы блока в Скелете (здесь). Не в `codeLanguages.ts`: тот едет и в
 * `RichTextView`, и в серверный вход Схемы, а им разбор DOM не нужен.
 */
export function codeLanguageOf(pre: Element): CodeLanguageId | null {
  for (const name of pre.firstElementChild?.classList ?? []) {
    if (!name.startsWith("language-")) continue;
    const language = normalizeCodeLanguage(name.slice("language-".length));
    if (language) return language;
  }
  return null;
}

/**
 * Форма блока кода для Скелета: тот же узел `codeBlock` с тем же разбором языка
 * и той же разметкой `<pre><code class="language-…">`, но без подсветки,
 * представления узла и lowlight. Шапку над ним Скелет дописывает сам
 * (`withCodeHeaders`, `skeleton.ts`).
 */
const CodeBlockShape = Node.create({
  name: "codeBlock",
  group: "block",
  content: "text*",
  marks: "",
  code: true,
  defining: true,
  addAttributes: () => ({
    language: { default: null, parseHTML: codeLanguageOf, rendered: false },
  }),
  parseHTML: () => [{ tag: "pre", preserveWhitespace: "full" }],
  renderHTML: ({ node }) => [
    "pre",
    ["code", node.attrs.language ? { class: `language-${node.attrs.language}` } : {}, 0],
  ],
});

/**
 * Блок кода на описании Инструмента (ADR-0058, п. 11.1): его нет в
 * `basic`, а Часть для движка тяжелее 10 кБ, поэтому она грузится тем же
 * загрузчиком, что у своего Инструмента. До загрузки Редактор с блоком кода —
 * Скелет (`RichTextEditor.tsx`).
 *
 * Переехали Часть для движка и пункты Меню вставки. Сочетание `Mod+Alt+C`
 * вешает расширение, и его строка справочника осталась в `SHORTCUTS`: на неё
 * ссылаются пункты меню (`shortcutKeys`), «Формат ›» и место строки цитаты
 * (`MOVED_BEFORE`). Кнопка «Блок кода» меню «…» и «¶» — виджеты Панели, они
 * переезжают позже (ADR-0058, «Последствия»).
 */
export const CODE_BLOCK_TOOL: ToolDescriptor = {
  name: "codeBlock",
  load: loadCodeBlock,
  /*
    `Alt+F10` блока кода (в кнопку языка) обязан сработать раньше общего
    `ToolbarFocus`: Части для движка описаний регистрируются после него
    (`extensions.ts`), а из равных по приоритету Tiptap первым опрашивает
    зарегистрированное последним.
  */
  engine: ({ focusToolbar }) => [
    (loaded(loadCodeBlock) as typeof CodeBlockChunk).RichCodeBlock.configure({
      focusToolbar,
    }),
  ],
  skeleton: () => [CodeBlockShape],
  kitTags: ["pre", "code"],
  insertItems: [
    {
      id: "codeBlock",
      section: "insert",
      label: (m) => m.codeBlock,
      icon: CodeBlockIcon,
      aliases: ["```", "pre"],
      markdown: "```",
      keys: shortcutKeys("codeBlock"),
      run: (chain) => chain.setCodeBlock(),
    },
    {
      id: "codeBlockFromText",
      section: "turnInto",
      label: (m) => m.codeBlock,
      icon: CodeBlockIcon,
      aliases: ["```", "pre"],
      keys: shortcutKeys("codeBlock"),
      run: (chain) => chain.setCodeBlock(),
    },
  ],
};
