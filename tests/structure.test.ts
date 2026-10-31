import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, test } from "vitest";

/**
 * Source layout gate (ADR-0060, item 18).
 *
 * WHY. The layout of `src/components/` rests on one promise: a module folder has
 * the same name as the folder of its page in `docs/components/`. While the promise
 * holds, the Reference and the code share one taxonomy, and a dispute about a
 * component's category is settled by moving its page and its code together.
 * Breaking it is easy and silent: a file placed "where it feels more natural"
 * builds, passes types and tests, and the Reference and the code quietly drift onto
 * two schemes, which is exactly what the move was meant to prevent. Just as silently,
 * a loose file in the root of `components/`, a barrel inside a category (an extra
 * layer of re-exports and a risk of cycles, item 15) and a dump of files in the root
 * of `src/editor/` come back.
 *
 * The test walks the file system and imports no kit module: it runs in the `node`
 * environment like the other gates, and reads only file names, `src/index.ts`,
 * `src/color.ts` and the `docs/components/index.md` catalog.
 *
 * The messages say WHAT to do, not "does not match": the gate is read by an author
 * whose CI is red and who has no ADR in mind.
 */

const ROOT = resolve(import.meta.dirname, "..");
const SRC = join(ROOT, "src");
const COMPONENTS = join(SRC, "components");
const DOCS = join(ROOT, "docs", "components");
const EDITOR = join(SRC, "editor");

/** Path relative to the package root, with forward slashes. */
function rel(full: string): string {
  return relative(ROOT, full).split("\\").join("/");
}

/** All files under a folder, recursively. No folder means no files. */
function filesUnder(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? filesUnder(full) : [full];
  });
}

/** Names of the subfolders of a folder. */
function dirsIn(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

/**
 * Categories are the subfolders of the Reference, not a list in this file. A second
 * list would drift away from the first in exactly the way the gate exists to catch.
 * A new category starts with a page in the Reference, and the code gets a folder of
 * the same name automatically.
 */
const CATEGORIES = dirsIn(DOCS);

/** Component modules: `components/<category>/X.ts(x)`, without stories. */
const MODULE = /^[^.]+\.tsx?$/;

function categoryModules(): { category: string; name: string; ext: string }[] {
  return CATEGORIES.flatMap((category) => {
    const dir = join(COMPONENTS, category);
    if (!existsSync(dir)) return [];
    return readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && MODULE.test(entry.name))
      .map((entry) => ({
        category,
        name: entry.name.replace(/\.tsx?$/, ""),
        ext: entry.name.replace(/^[^.]+/, ""),
      }));
  });
}

/** Comments must not leak into the export parsing. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

/**
 * Public VALUES that the package exports from the `components/` modules: module →
 * the names under which consumers see them. Types are skipped: the catalog, per its
 * own first line, lists the runtime exports.
 */
function publicExportsByModule(): Map<string, string[]> {
  const byModule = new Map<string, string[]>();
  for (const entry of ["index.ts", "color.ts", "markdown.ts"]) {
    const source = stripComments(readFileSync(join(SRC, entry), "utf8"));
    for (const match of source.matchAll(/export\s*(type\s*)?\{([^}]*)\}\s*from\s*"([^"]+)"/g)) {
      const [, typeOnly, list, from] = match;
      if (typeOnly) continue;
      const module = /^\.\/components\/([^/]+\/[^/]+?)\.js$/.exec(from!)?.[1];
      if (!module) continue;
      const names = list!
        .split(",")
        .map((item) => item.trim())
        .filter((item) => item && !item.startsWith("type "))
        .map((item) => item.split(/\s+as\s+/).pop()!);
      byModule.set(module, [...(byModule.get(module) ?? []), ...names]);
    }
  }
  return byModule;
}

/**
 * Catalog: export name → the page folders it points to. An entry is a list item with
 * a link of the form `[Dialog](overlays/dialog.md): \`Dialog\``; its continuation on
 * the following lines belongs to the same item. Links outside `docs/components/<folder>/`
 * (for example, to `../api/`) do not pin any exports.
 */
function catalog(): Map<string, { folders: Set<string>; pages: Set<string> }> {
  const source = readFileSync(join(DOCS, "index.md"), "utf8");
  const byName = new Map<string, { folders: Set<string>; pages: Set<string> }>();
  for (const item of source.split(/^- /m).slice(1)) {
    const link = /^\[[^\]]*\]\(([a-z0-9-]+)\/([^/)]+\.md)\)/.exec(item);
    if (!link) continue;
    const [, folder, page] = link;
    for (const [, name] of item.matchAll(/`([A-Za-z_$][\w$]*)`/g)) {
      const entry = byName.get(name!) ?? { folders: new Set(), pages: new Set() };
      entry.folders.add(folder!);
      entry.pages.add(`${folder}/${page}`);
      byName.set(name!, entry);
    }
  }
  return byName;
}

describe("the source tree follows the docs taxonomy (ADR-0060)", () => {
  test("every public component module lives in the folder of its docs page", () => {
    const exportsByModule = publicExportsByModule();
    const entries = catalog();
    const problems: string[] = [];

    for (const { category, name, ext } of categoryModules()) {
      const names = exportsByModule.get(`${category}/${name}`);
      // Internal module (CheckboxCard, ChoiceCardBody, keyboardEditing): it is not part
      // of the public API, so it has no page and must not have one. A file moved into
      // another folder without editing `src/index.ts` also lands here, but
      // `npm run typecheck` catches it: the import stops resolving.
      if (!names) continue;

      const file = `src/components/${category}/${name}${ext}`;
      const known = names.filter((exported) => entries.has(exported));

      if (known.length === 0) {
        problems.push(
          `${file}: none of its public exports (${names.join(", ")}) is listed in ` +
            `docs/components/index.md. Add an entry for it to the catalog and write its page ` +
            `in docs/components/${category}/.`
        );
        continue;
      }

      for (const exported of known) {
        const { folders, pages } = entries.get(exported)!;
        if (!folders.has(category)) {
          const home = [...folders][0];
          problems.push(
            `${file}: \`${exported}\` has its page in docs/components/${[...pages].join(", ")}, ` +
              `not in docs/components/${category}/. Move ${name}${ext} to src/components/${home}/ ` +
              `(next to its page), or move the page and the code together.`
          );
        }
        for (const page of pages) {
          if (!existsSync(join(DOCS, page))) {
            problems.push(
              `docs/components/index.md links \`${exported}\` to ${page}, which does not exist. ` +
                `Create the page or fix the link.`
            );
          }
        }
      }
    }

    expect(
      [...new Set(problems)],
      "A component file must sit in src/components/<category>/ where its page " +
        "docs/components/<category>/<page>.md lives (ADR-0060, item 1):\n" +
        [...new Set(problems)].join("\n")
    ).toEqual([]);
  });

  test("src/components holds only the category folders, no loose files", () => {
    const entries = readdirSync(COMPONENTS, { withFileTypes: true });
    const loose = entries.filter((entry) => !entry.isDirectory()).map((entry) => entry.name);
    const extra = entries
      .filter((entry) => entry.isDirectory() && !CATEGORIES.includes(entry.name))
      .map((entry) => entry.name);

    expect(
      loose.map((name) => `src/components/${name}`),
      "The root of src/components holds no files (ADR-0060, item 1). Put each one into the " +
        "folder of its docs page: src/components/<category>/ matches docs/components/<category>/. " +
        `Categories: ${CATEGORIES.join(", ")}.\n` +
        loose.map((name) => `src/components/${name}`).join("\n")
    ).toEqual([]);
    expect(
      extra.map((name) => `src/components/${name}`),
      "There is no docs page folder for this directory, so it is not a category (ADR-0060, " +
        `item 1). Move its files into one of: ${CATEGORIES.join(", ")} — or add the category ` +
        "to docs/components/ together with its pages.\n" +
        extra.map((name) => `src/components/${name}`).join("\n")
    ).toEqual([]);
  });

  test("no barrels inside categories, editor layers and features", () => {
    // A barrel is only an entry point of the package: src/index.ts, src/editor/index.ts,
    // src/color.ts, src/icons.ts. Inside the tree it adds a layer of re-exports and a
    // risk of a cycle through the barrel itself (ADR-0060, item 15).
    const barrelRoots = [
      COMPONENTS,
      ...["core", "ui", "styles", "hooks", "features"].map((dir) => join(EDITOR, dir)),
    ];
    const barrels = barrelRoots
      .flatMap(filesUnder)
      .filter((file) => /(^|[\\/])index\.tsx?$/.test(file))
      .map(rel);

    expect(
      barrels,
      "Barrels in categories and features are forbidden (ADR-0060, item 15): import the file " +
        "directly, e.g. ../overlays/Dialog.js. Delete the index file and fix the imports:\n" +
        barrels.join("\n")
    ).toEqual([]);
  });

  test("the root of src/editor holds only entry points and the two main components", () => {
    const ALLOWED_FILES = new Set([
      "index.ts",
      "schema-entry.ts",
      "highlight-entry.ts",
      "highlight-grammars.d.ts",
      "RichTextEditor.tsx",
      "RichTextView.tsx",
      "RichTextEditor.stories.tsx",
      "RichTextView.stories.tsx",
      "CodeViewHighlighting.stories.tsx",
    ]);
    const LAYERS = new Set(["core", "ui", "styles", "hooks", "features"]);

    const stray = readdirSync(EDITOR, { withFileTypes: true })
      .filter((entry) =>
        entry.isDirectory() ? !LAYERS.has(entry.name) : !ALLOWED_FILES.has(entry.name)
      )
      .map((entry) => `src/editor/${entry.name}`);

    expect(
      stray,
      "Only entry points, RichTextEditor, RichTextView and their stories stay in the root of " +
        "src/editor. Sort the rest into core/ (engine, schema, tool registry), ui/ (shared " +
        "chrome), styles/ (palette, tokens, classes), hooks/ or features/<feature>/ " +
        "(ADR-0060, items 7-13):\n" +
        stray.join("\n")
    ).toEqual([]);
  });
});
