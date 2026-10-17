import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { expect, test } from "vitest";

/**
 * Byte gate: source files contain no control characters except newline and tab.
 *
 * Why a separate check for something that looks impossible: one such character already lived in
 * the repository. `FilterBarAdd.tsx` contained three raw NUL bytes, because the separator of a
 * composite key was written as the character itself, not as an escape sequence. The compiler,
 * the linter and the tests do not notice this at all: the string value is correct, and so is the
 * behavior.
 *
 * Tools that treat a file as text do notice. `file` labels such a file `data`, and `grep` treats
 * it as binary and **silently skips it**: it exits with code 1 without printing a line. So any
 * check built on text search walks around the file and reports success. Wave 21 built the
 * `"use client"` directive gate on text scanning, and a skipped file would leave a hole exactly
 * there.
 *
 * Hence the approach: files are read as BYTES and parsed explicitly, with no `grep` and no
 * assumption that the content is text.
 */

const SRC = resolve(import.meta.dirname, "..", "src");

/** Line feed, carriage return and tab are the only allowed control bytes. */
const ALLOWED_CONTROL_BYTES = new Set([0x09, 0x0a, 0x0d]);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx|css)$/.test(entry.name) ? [full] : [];
  });
}

test("sources carry no control bytes except newline and tab", () => {
  const offenders: string[] = [];

  for (const file of sourceFiles(SRC)) {
    const bytes = readFileSync(file);
    for (let i = 0; i < bytes.length; i += 1) {
      const byte = bytes[i]!;
      if (byte < 0x20 && !ALLOWED_CONTROL_BYTES.has(byte)) {
        const hex = `0x${byte.toString(16).padStart(2, "0")}`;
        // Report the byte offset, not a line: such a file may have no lines at all.
        offenders.push(`${relative(SRC, file)}: byte ${hex} at offset ${i}`);
        break;
      }
    }
  }

  expect(
    offenders,
    `A control byte in a source file. Write the character as an escape sequence ` +
      `(for example "\\u0000"): a raw one makes the file binary for grep, and text-based ` +
      `checks silently skip it.\n${offenders.join("\n")}`
  ).toEqual([]);
});
