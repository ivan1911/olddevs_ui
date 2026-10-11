import { readFileSync } from "node:fs";
import { join } from "node:path";

const DOCS = join(import.meta.dirname, "..", "docs");

/**
 * Packages of the first `npm install` block of a Reference page, sorted.
 * The command itself (`npm install`) is dropped, line continuations are joined.
 */
export function installCommand(page: string): string[] {
  const text = readFileSync(join(DOCS, page), "utf8");
  const block = /```bash\n(npm install [\s\S]*?)```/.exec(text)?.[1];
  if (block === undefined) throw new Error(`${page}: no npm install block`);
  return block.replace(/\\\n/g, " ").split(/\s+/).filter(Boolean).slice(2);
}
