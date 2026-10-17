import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

/**
 * The component catalog (`docs/components/index.md`) is the first thing a reader
 * of the Reference sees, and it has to answer "what is this component". A line
 * is a name-link, the list of exports and, after a dash, the description; a note
 * about a separate package entry comes after the description. Without this test
 * new components arrived as a bare list of exports (16 of 85 entries had a
 * description).
 *
 * The catalog is English (ADR-0073); its Russian Translation lives on the site.
 */
const catalog = readFileSync(join(import.meta.dirname, "../docs/components/index.md"), "utf8");

/** "a separate entry point": the start of a package-entry note, which is not a description. */
const ENTRY_NOTE = "a separate entry point";
const CYRILLIC = /[\u0400-\u04FF]/;

interface Entry {
  name: string;
  /** Everything after the dash that separates the list of exports from the description. */
  description: string;
}

function entries(): Entry[] {
  const result: Entry[] = [];
  let current: string[] | null = null;
  const flush = () => {
    if (!current) return;
    const text = current.join(" ").replace(/\s+/g, " ");
    result.push({
      name: /^- \[([^\]]+)\]/.exec(text)![1]!,
      description: text.includes(" — ") ? text.slice(text.indexOf(" — ") + 3) : "",
    });
    current = null;
  };
  for (const line of catalog.split("\n")) {
    if (line.startsWith("- [")) {
      flush();
      current = [line];
    } else if (current && line.startsWith("  ")) current.push(line.trim());
    else flush();
  }
  flush();
  return result;
}

describe("component catalog", () => {
  const all = entries();

  test("entries are parsed: there are well over eighty of them", () => {
    expect(all.length).toBeGreaterThan(80);
  });

  test.each(all.map((entry) => [entry.name, entry] as const))(
    "%s: a description follows the exports",
    (_name, entry) => {
      expect(entry.description, "a phrase is needed after the dash").not.toBe("");
      expect(
        entry.description.startsWith(ENTRY_NOTE),
        "the description comes first, the entry note after it"
      ).toBe(false);
      expect(
        entry.description.split(/\s+/).length,
        "fewer than three words is not a description"
      ).toBeGreaterThanOrEqual(3);
      expect(entry.description, "the catalog is written in English").not.toMatch(CYRILLIC);
    }
  );

  test("group headings are written in English, like the rest of the catalog and the Reference menu", () => {
    const headings = [...catalog.matchAll(/^## (.+)$/gm)].map((match) => match[1]!);
    expect(headings.length).toBeGreaterThanOrEqual(8);
    for (const heading of headings)
      expect(heading, "the heading must be English").not.toMatch(CYRILLIC);
  });

  test("group intros do not carry release history", () => {
    expect(catalog, "version history belongs to the changelog").not.toMatch(
      /^[^\n]*\b(?:Added|Appeared|Introduced) in \d/m
    );
  });

  test("the intro speaks to the reader, not about the implementation", () => {
    const intro = catalog.slice(0, catalog.indexOf("\n## "));
    expect(intro).not.toMatch(/runtime export|compound exports/i);
  });
});
