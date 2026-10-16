/** Типы `docs-translations.mjs` для тестов: сам скрипт — простой JS, как остальные скрипты кита. */
export function hashOriginal(text: string): string;
export function isTranslation(path: string): boolean;
export function originalOf(path: string): string;
export function translationProblems(translation: string, original: string): string[];
export function translationsState(files: ReadonlyMap<string, string>): {
  current: string[];
  stale: string[];
  missing: string[];
  problems: string[];
};
export function readDocs(dir?: string): Map<string, string>;
export function headingSlug(heading: string): string;
export function headingSlugs(text: string): Set<string>;
export function translationLinkProblems(
  path: string,
  text: string,
  files: ReadonlyMap<string, string>
): string[];
