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
 * Code block highlighter: lowlight with the highlight.js grammars (ADR-0051). One instance serves
 * both the Editor and the server helper `highlightCodeBlocks`, so the tokens in an edit and on the
 * view page are tokenized by the same grammar.
 *
 * GRAMMARS ONE BY ONE, NOT lowlight's `common`. `common` has 37 languages, and each of them would
 * ship to the consumer, although the Editor supports eight. A `Record` keyed by
 * `CodeLanguageGrammar` does not let a language be added to `codeLanguages.ts` without a grammar:
 * the build fails on the type, not in the consumer's app with an empty highlight.
 *
 * The module is safe on the server: lowlight and the grammars are plain JS with no DOM and no
 * React, and the Editor engine is not here.
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

/** lowlight token tree (hast): a root, `span`s with `className`, and text. */
export type HighlightTree = ReturnType<typeof codeLowlight.highlight>;

/** Tokens of code in a Document's code block language. The language must come from `CODE_LANGUAGES`. */
export function highlightCode(language: CodeLanguageId, code: string): HighlightTree {
  const { grammar } = CODE_LANGUAGES.find(({ id }) => id === language)!;
  return codeLowlight.highlight(grammar, code);
}
