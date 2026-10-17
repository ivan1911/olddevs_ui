/** Types of `check-public.mjs` for the tests. The script itself is plain JS, like the kit's other scripts. */
export interface Violation {
  path: string;
  line: number;
  rule: string;
}
export function findViolations(files: ReadonlyMap<string, string>): Violation[];
export function isTextFile(path: string): boolean;
export function packedPaths(json: string): string[];
export function isUnbuilt(paths: readonly string[]): boolean;
