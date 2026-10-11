import go from "highlight.js/lib/languages/go";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import markdown from "highlight.js/lib/languages/markdown";
import python from "highlight.js/lib/languages/python";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import yaml from "highlight.js/lib/languages/yaml";
import { createLowlight } from "lowlight";
import { CODE_LANGUAGES, type CodeLanguageGrammar, type CodeLanguageId } from "./codeLanguages.js";

/**
 * Подсветчик блока кода — lowlight с грамматиками highlight.js (ADR-0051).
 * Один на Редактор и на серверный хелпер `highlightCodeBlocks`: токены в правке
 * и на странице показа режет одна и та же грамматика.
 *
 * ГРАММАТИКИ ПО ОДНОЙ, А НЕ `common` lowlight. `common` — 37 языков, и каждый
 * ехал бы потребителю, хотя Редактор умеет восемь. `Record` по
 * `CodeLanguageGrammar` не даст добавить язык в `codeLanguages.ts` без
 * грамматики: сборка упадёт на типе, а не у потребителя на пустой подсветке.
 *
 * Модуль серверно-безопасен: lowlight и грамматики — чистый JS без DOM и без
 * React; движка Редактора здесь нет.
 */
const GRAMMARS: Record<CodeLanguageGrammar, typeof python> = {
  go,
  javascript,
  json,
  markdown,
  python,
  typescript,
  xml,
  yaml,
};

export const codeLowlight = createLowlight(GRAMMARS);

/** Дерево токенов lowlight (hast): корень, `span` с `className` и текст. */
export type HighlightTree = ReturnType<typeof codeLowlight.highlight>;

/** Токены кода на языке Документа. Язык обязан быть из `CODE_LANGUAGES`. */
export function highlightCode(language: CodeLanguageId, code: string): HighlightTree {
  const { grammar } = CODE_LANGUAGES.find(({ id }) => id === language)!;
  return codeLowlight.highlight(grammar, code);
}
