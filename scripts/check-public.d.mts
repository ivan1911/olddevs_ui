/** Типы `check-public.mjs` для тестов: сам скрипт — простой JS, как остальные скрипты кита. */
export interface Violation {
  path: string;
  line: number;
  rule: string;
}
export function findViolations(files: ReadonlyMap<string, string>): Violation[];
export function isTextFile(path: string): boolean;
export function packedPaths(json: string): string[];
export function isUnbuilt(paths: readonly string[]): boolean;
