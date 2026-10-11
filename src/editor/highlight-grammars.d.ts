/**
 * Типы грамматик highlight.js по одной: пакет отдаёт `lib/languages/*` через
 * `exports`, но без `.d.ts` рядом, и в строгом режиме импорт падал бы с TS7016.
 * Каждая грамматика — функция `LanguageFn` по умолчанию; так её и описывают
 * типы самого highlight.js. В `dist` объявление не нужно: наружу типы
 * грамматик не выходят (`lowlight.ts` их не экспортирует).
 */
declare module "highlight.js/lib/languages/*" {
  import type { LanguageFn } from "highlight.js";
  const grammar: LanguageFn;
  export default grammar;
}
