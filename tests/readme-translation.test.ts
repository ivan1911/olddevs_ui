import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { hashOriginal, readmeTranslationLag } from "../scripts/readme-translation.mjs";

/**
 * README.ru.md is the Translation of README.md (ADR-0073). Lag is a report in
 * `release:check`, never a failure; what is a failure here is a missing or
 * malformed marker, because then the report cannot work at all.
 */
describe("README translation report", () => {
  const original = "# Title\n\nText.\n";
  const marker = (hash: string) => `<!-- sourceHash: ${hash} -->\n# Nazvanie\n`;

  test("a current Translation reports nothing", () => {
    expect(readmeTranslationLag(original, marker(hashOriginal(original)))).toBeNull();
  });

  test("a stale Translation is reported with both hashes", () => {
    const lag = readmeTranslationLag(original, marker("000000000000"));
    expect(lag).toContain("000000000000");
    expect(lag).toContain(hashOriginal(original));
  });

  test("a Translation without the first-line marker is reported", () => {
    expect(readmeTranslationLag(original, "# Nazvanie\n")).toMatch(/no `<!-- sourceHash/);
  });

  test("the hash is 12 hex digits of sha256", () => {
    expect(hashOriginal("abc")).toBe("ba7816bf8f01");
  });

  test("README.ru.md in the repository starts with a well-formed marker", () => {
    const ru = readFileSync(join(import.meta.dirname, "../README.ru.md"), "utf8");
    expect(ru.split("\n")[0]).toMatch(/^<!-- sourceHash: [0-9a-f]{12} -->$/);
  });
});
