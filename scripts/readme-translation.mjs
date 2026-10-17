/**
 * README.ru.md is the Translation of README.md (ADR-0073). Its first line carries
 * `<!-- sourceHash: <12 hex> -->`: the first 12 hex digits of the sha256 of the
 * README.md bytes. A lagging Translation is a report, never a gate: `release:check`
 * prints it and goes on.
 */

import { createHash } from "node:crypto";

const MARKER = /^<!--\s*sourceHash:\s*([0-9a-f]{12})\s*-->/;

/** Hash of the Original: the first 12 hex digits of the sha256 of its text. */
export function hashOriginal(text) {
  return createHash("sha256").update(text).digest("hex").slice(0, 12);
}

/**
 * What the Translation says about the Original, as one line, or `null` when it is current.
 * `translation` is the text of README.ru.md, `original` the text of README.md.
 */
export function readmeTranslationLag(original, translation) {
  const recorded = MARKER.exec(translation)?.[1];
  if (recorded === undefined) return "README.ru.md has no `<!-- sourceHash: … -->` first line";
  const actual = hashOriginal(original);
  return recorded === actual
    ? null
    : `README.ru.md is behind README.md (sourceHash ${recorded}, README.md is ${actual})`;
}
