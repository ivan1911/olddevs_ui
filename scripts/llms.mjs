/**
 * Builds `llms.txt`, the index of the Reference for an agent working in someone
 * else's repository (ADR-0044).
 *
 * WHY AN INDEX WHEN THE PAGES ARE IN THE PACKAGE ANYWAY. An agent does not list
 * files; it reads what it is pointed at. Eighty-five pages without an index are
 * either "read everything" (565 kB of context) or "guess the file name".
 *
 * WHAT IS NOT HERE. `llms-full.txt` concatenates all the text into one file. It
 * is for sites where the files cannot be listed. The kit's pages sit side by
 * side in `node_modules/@olddevs/ui/docs/`, and a concatenation would be a second
 * copy of the same 565 kB, drifting silently away from the first.
 *
 * WHY A GENERATOR AND NOT A HAND-WRITTEN FILE. An index written by hand goes
 * stale with the first page added, and nothing catches it: it neither compiles
 * nor tests itself. Here it is derived from `docs/`, and `llms:check` fails the
 * build if the output differs from the file in the repository.
 *
 * SECTION ORDER is taken from the curated indexes, `docs/index.md` and
 * `docs/components/index.md`: that is the order in which a person reads the
 * pages, so inventing a second one makes no sense. A page that is in neither
 * index is not lost: it goes into the last section. By design, the index cannot
 * lose a page.
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve, dirname, normalize } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const DOCS = join(ROOT, "docs");
const OUT = join(ROOT, "llms.txt");

/** All Reference pages, as paths from the package root: `docs/…`. */
function pages(dir = DOCS) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return pages(full);
    // One file per page, in English (ADR-0073): the Russian Translation is not in the package.
    return name.endsWith(".md") ? [relative(ROOT, full)] : [];
  });
}

/**
 * The title and the first sentence of a page.
 *
 * A missing `# ` heading is a refusal, not a skip: a page without a title would
 * get into the index as a nameless line, and the agent would not understand what
 * it refers to. A silent skip is worse here than a crash: it leaves a hole that
 * nobody looks for.
 */
function describe(page) {
  const text = readFileSync(join(ROOT, page), "utf8");
  const title = /^#\s+(.+)$/m.exec(text);
  if (!title) throw new Error(`${page} has no "# " heading — cannot be indexed`);

  const body = text.slice(text.indexOf(title[0]) + title[0].length);
  const paragraph = body
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    /*
      Headings, quotes, lists, tables and code blocks do not serve as a
      description: the first paragraph of `getting-started.md` is an import
      example, and in the index it looked like a line of code instead of a
      sentence about the page.

      But a SINGLE backtick is the name of a component at the start of a sentence
      ("`TextControl` is the base text field…"), and such a paragraph must not be
      dropped. That is exactly how the "Summary for AI" section opens on half of
      the pages, and in the index they were left without any description. Only
      the code block fence (three backticks in a row) is excluded.
    */
    .find((block) => block && !/^(?:[#>|\-*\d]|```)/.test(block));

  const sentence = (paragraph ?? "")
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ")
    // Links are unwrapped to plain text: inside a description they would resolve
    // relative to the page, while the description is read from the package root.
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .split(/(?<=\.)\s/)[0];

  return { title: title[1].trim(), sentence: sentence.slice(0, 200) };
}

/** Sections of a curated index: `## Heading` and the links under it. */
function sectionsOf(index) {
  const text = readFileSync(join(ROOT, index), "utf8");
  const out = [];
  let current = null;
  for (const line of text.split("\n")) {
    const heading = /^##\s+(.+)$/.exec(line);
    if (heading) {
      current = { title: heading[1].trim(), pages: [] };
      out.push(current);
      continue;
    }
    const link = /\]\(([^)#]+\.md)\)/.exec(line);
    if (link && current) {
      const page = normalize(join(dirname(index), link[1]));
      // Only what ships in the package. `docs/index.md` also links outward: to a
      // mockup in a neighboring repository, to `CLAUDE.md` next to the manifest.
      // The consumer has neither, and the index line would lead nowhere.
      if (page.startsWith("docs/") && !current.pages.includes(page)) current.pages.push(page);
    }
  }
  return out.filter((section) => section.pages.length > 0);
}

const all = pages();
const indexes = ["docs/index.md", "docs/components/index.md"];
const sections = indexes.flatMap(sectionsOf);

// The root index goes first in the first section: it does not list itself, but
// the agent needs it, since the rules for working with the kit live there.
if (sections[0] && !sections[0].pages.includes("docs/index.md"))
  sections[0].pages.unshift("docs/index.md");

const listed = new Set(sections.flatMap((section) => section.pages));
const rest = all.filter((page) => !listed.has(page));
if (rest.length > 0) sections.push({ title: "Other pages", pages: rest });

const entry = (page) => {
  const { title, sentence } = describe(page);
  return `- [${title}](${page})${sentence ? `: ${sentence}` : ""}`;
};

const body = [
  "# @olddevs/ui",
  "",
  "> Design system: tokens, themes and accessible UI primitives for React. This file is",
  "> the index of the Reference that ships with the package.",
  "",
  "The links below are relative and point inside the package: read them from its root,",
  "that is, from `node_modules/@olddevs/ui/`. The Reference there is for exactly the",
  "version you have installed. The documentation site is https://ui.olddevs.ru.",
  "",
  "This file is generated by `scripts/llms.mjs` from `docs/`. Edit the pages, not the",
  "index: a mismatch fails `npm run llms:check`.",
  "",
  ...sections.flatMap((section) => [`## ${section.title}`, "", ...section.pages.map(entry), ""]),
]
  .join("\n")
  .replace(/\n{3,}/g, "\n\n");

const previous = (() => {
  try {
    return readFileSync(OUT, "utf8");
  } catch {
    return null;
  }
})();

if (process.argv.includes("--check")) {
  if (previous !== body) {
    console.error("✗ llms.txt is out of date. Run `npm run llms` and commit the result.");
    process.exit(1);
  }
  console.log(`✓ llms.txt matches docs/ — ${all.length} pages in ${sections.length} sections`);
} else {
  writeFileSync(OUT, body);
  console.log(`✓ llms.txt written — ${all.length} pages in ${sections.length} sections`);
}
