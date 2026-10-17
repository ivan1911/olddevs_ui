/**
 * Types for the highlight.js grammars, one module per language: the package exposes
 * `lib/languages/*` through `exports`, but without a `.d.ts` next to them, and in
 * strict mode the import would fail with TS7016. Each grammar is a `LanguageFn`
 * function as its default export; that is how highlight.js's own types describe it.
 * The declaration is not needed in `dist`: grammar types never reach the consumer
 * (`lowlight.ts` does not export them).
 */
declare module "highlight.js/lib/languages/*" {
  import type { LanguageFn } from "highlight.js";
  const grammar: LanguageFn;
  export default grammar;
}
