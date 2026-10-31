import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { DEFAULT_MESSAGES } from "../src/i18n/defaults.js";
import { messages as ru } from "../src/locales/ru.js";

/**
 * The i18n gate: two checks, each catching its own silent breakage.
 *
 * The first is a literal added to a component outside the catalog. It breaks
 * neither the compiler nor the linter, and it is found only when someone switches
 * the language and sees a Russian word in the middle of the English interface.
 *
 * The second is a key added to the fallback and forgotten in the Russian locale.
 * The type catches a missing key, but not an empty string, and not a mismatch of
 * shape: a string where a function belongs is rendered as `[object Object]` on screen.
 */

const ROOT = resolve(import.meta.dirname, "..");

/**
 * What we guard. Wave 23 widened the gate from `src/` alone to everything the kit
 * shows to the outside.
 *
 * `docs/` is NOT in this list: the Reference has its own gate below («the Reference is
 * English», ADR-0073), because the `.ts` walk and the allow-list rules do not suit it.
 *
 * `scripts/` is NOT in this list either, and that is deliberate. `bundle-size.mjs` parses
 * `docs/getting-started.md`: the Russian section heading and the Russian unit for
 * kilobytes are there as reconciliation keys, not as text. A gate that was forced to put
 * half of `scripts/` on the allow list would guard nothing; the scripts' output was
 * translated in wave 23 and is held by review.
 */
const ROOTS = ["src", "tests", "tests-visual", ".storybook"];

/**
 * The allow list is an ENUMERATION WITH REASONS, not a regexp that "skips Cyrillic".
 * A regexp would drop the gate entirely: it does not tell input DATA from a forgotten
 * label, so it would allow exactly what the gate is looking for.
 */
const ALLOWED = [
  {
    files: [
      "src/components/content/Keyboard.tsx",
      "tests/keyboard.test.tsx",
      "src/editor/features/pasteCleanup/wordLists.ts",
    ],
    why:
      "The layout is input DATA, not a translation. The letter rows say which characters " +
      "the keyboard types; they stay Cyrillic under an English interface because `layout` " +
      "and the interface language are independent. The same holds for the label of the key " +
      "that returns to letters, and for the test that drives that layout end to end. The " +
      "paste cleanup reads the letters Word numbers a Russian list with: a marker from the " +
      "clipboard, input data again.",
  },
  {
    files: ["src/locales/ru.ts"],
    why: "The Russian catalog. Cyrillic here is its content, not a leak from a component.",
  },
  {
    files: [
      "tests/locale-ru.test.tsx",
      "tests/rich-text-editor-table-size-grid.test.tsx",
      "tests/rich-text-editor-table-menu.test.tsx",
      "tests/editor-search.test.tsx",
      "tests/rich-text-editor-paste-cleanup.test.tsx",
      "tests-visual/interactions.spec.ts",
      ".storybook/recipes/integratedFixtures.ts",
    ],
    why:
      "Here a Russian word is the SUBJECT of the check, not the language of writing. " +
      '`[11, "11 dney"]` pins Intl.PluralRules, and the SortableList scenario pins the ' +
      "announcements react-aria localises itself — in English both would be " +
      "indistinguishable from no localisation at all. The table size grid test pins the " +
      "one/few/many forms of `3 stolbca, 5 stolbcov`, which the catalog writes itself. " +
      "The table menu test sorts Russian cell text and Russian number formats: the order " +
      "of `yo` after `e`, not after `ya`, and `1 234,5` read as a number are the check. " +
      "The search test pins whole-word matching in Cyrillic: `\\b` of JS knows only Latin, " +
      "so a Russian word inside a longer one is the case the Unicode boundary exists for. " +
      "The paste cleanup test pins a Word list lettered in Russian, which must stay numbered. " +
      "The integrated chat fixture supplies long Russian message/draft data to verify wrapping " +
      "and narrow-screen reading, not translated controls or public Reference prose.",
  },
];

/**
 * The Cyrillic detector uses escape sequences, not a literal.
 *
 * After wave 23 the gate scans `tests/` too, that is, itself: a character class with
 * the letters written out literally would catch this very line and make the file
 * permanently red. The ranges are the same: lowercase and uppercase Russian letters,
 * plus both yo.
 */
const CYRILLIC = /[\u0430-\u044f\u0410-\u042f\u0451\u0401]/;

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(full));
    // There are no exceptions by file name any more: wave 23 translated both the
    // showcase and the Code Connect templates (the latter were also deleted, ADR-0037),
    // so the gate guards the stories on a par with the components.
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

/** The string gate does not read comments; the comment ratchet below does (ADR-0073). */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, lead: string) => lead + " ".repeat(m.length - lead.length));
}

describe("no user-visible literals bypass the catalog", () => {
  test("no Cyrillic occurs outside the locale catalog and the allow list", () => {
    const found: string[] = [];
    const allowed = new Set(ALLOWED.flatMap((a) => a.files));
    for (const file of ROOTS.flatMap((root) => sourceFiles(resolve(ROOT, root)))) {
      const rel = relative(ROOT, file).split("\\").join("/");
      if (allowed.has(rel)) continue;
      const lines = stripComments(readFileSync(file, "utf8")).split("\n");
      lines.forEach((line, i) => {
        if (CYRILLIC.test(line)) found.push(`${rel}:${i + 1}: ${line.trim()}`);
      });
    }
    expect(
      found,
      "A user-visible string must go through the message catalog.\n" +
        "Add the key to `src/i18n/messages.ts` and the value to `defaults.ts` and `locales/ru.ts`.\n" +
        found.join("\n")
    ).toEqual([]);
  });

  test("no allow-list entry has outlived its file", () => {
    // The same guard as the RSC gate: an entry that outlives its file silently allows
    // something that no longer exists, and the next file with that name ends up
    // outside the check. Wave 23 stretched the list from two paths to five across
    // four roots, and it became impossible to keep in one's head.
    const stale = ALLOWED.flatMap((a) => a.files).filter(
      (file) => !existsSync(resolve(ROOT, file))
    );
    expect(
      stale,
      `An allow-list entry points at a file that no longer exists:\n${stale.join("\n")}`
    ).toEqual([]);
  });

  test("the allow list stays short and explained", () => {
    // A growing allow list is a gate that gets switched off one line at a time.
    // The ceiling counts REASONS, not paths: one reason may cover two files, but a
    // fourth reason calls for a review, not an edit of the number.
    expect(ALLOWED.length).toBeLessThanOrEqual(3);
    for (const entry of ALLOWED) expect(entry.why.length).toBeGreaterThan(40);
  });
});

/** The shape of a value: a string stays a string, a function stays a function. */
function shapeOf(value: unknown): string {
  if (typeof value === "function") return "function";
  if (value && typeof value === "object") return "object";
  return typeof value;
}

function walk(
  reference: Record<string, unknown>,
  candidate: Record<string, unknown>,
  path: string[],
  problems: string[]
) {
  for (const [key, refValue] of Object.entries(reference)) {
    const here = [...path, key].join(".");
    const value = candidate?.[key];
    if (value === undefined) {
      problems.push(`${here} — key is missing from the locale`);
      continue;
    }
    if (shapeOf(value) !== shapeOf(refValue)) {
      problems.push(`${here} — shape ${shapeOf(value)}, expected ${shapeOf(refValue)}`);
      continue;
    }
    if (shapeOf(refValue) === "object") {
      walk(
        refValue as Record<string, unknown>,
        value as Record<string, unknown>,
        [...path, key],
        problems
      );
    }
    if (typeof value === "string" && value.trim() === "") problems.push(`${here} — empty string`);
  }
}

describe("locale completeness", () => {
  test("the Russian catalog covers every fallback key", () => {
    const problems: string[] = [];
    walk(
      DEFAULT_MESSAGES as unknown as Record<string, unknown>,
      ru as unknown as Record<string, unknown>,
      [],
      problems
    );
    expect(
      problems,
      `The Russian locale diverges from the fallback:\n${problems.join("\n")}`
    ).toEqual([]);
  });

  test("the locale carries no extra keys absent from the fallback", () => {
    // An extra key is either a typo or a string the component never reads.
    // It is better to find out which here.
    const extra: string[] = [];
    walk(
      ru as unknown as Record<string, unknown>,
      DEFAULT_MESSAGES as unknown as Record<string, unknown>,
      [],
      extra
    );
    expect(extra.filter((p) => p.endsWith("key is missing from the locale"))).toEqual([]);
  });
});

/**
 * The gate for the Reference (ADR-0073, English Original). `docs/` used to be excluded
 * from the gate: the Reference was Russian under ADR-0034. Now the Original is English,
 * the Russian Translation lives on the site, and Cyrillic in `docs/**` and `README.md`
 * is a defect.
 *
 * The list below holds the pages where Russian strings are DATA: values of the Russian
 * message catalog, a Russian input example, a Russian caption in a code example. A page
 * without them does not get on the list. So the list is also checked in reverse: an entry
 * for a page without Cyrillic is stale and fails the test, or the list would only grow.
 */
const DOCS_ALLOWED_PAGES = new Set([
  "api/editor-extension.md",
  "api/messages.md",
  "api/utilities.md",
  "components/actions/feedback.md",
  "components/actions/split-button.md",
  "components/app-shell/mobile-tab-bar.md",
  "components/app-shell/split-panel.md",
  "components/content/carousel.md",
  "components/content/data-display.md",
  "components/content/empty-and-loading.md",
  "components/content/keyboard.md",
  "components/content/media-card.md",
  "components/content/rich-text-toc.md",
  "components/date-time/time-picker.md",
  "components/inputs/rich-text-editor.md",
  "components/inputs/upload-queue.md",
  "components/navigation/mega-menu.md",
  "components/overlays/command-palette.md",
  "components/overlays/confirm-dialog.md",
  "components/overlays/shortcuts-help.md",
  "conventions.md",
  "i18n.md",
  "theming.md",
]);

/** README.md carries the link to its Translation; that is the only Cyrillic word it may have. */
const README_SWITCHER = /\(README\.ru\.md\)/;

function docsFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? docsFiles(full) : [full];
  });
}

describe("the Reference is English (ADR-0073)", () => {
  const docs = docsFiles(resolve(ROOT, "docs")).map((file) =>
    relative(resolve(ROOT, "docs"), file).split("\\").join("/")
  );

  test("docs/ holds no *.en.md files: one file per page, in English", () => {
    expect(docs.filter((file) => file.endsWith(".en.md"))).toEqual([]);
  });

  test("no Cyrillic in docs/**/*.md outside the pages that quote Russian as data", () => {
    const found = docs
      .filter((file) => file.endsWith(".md") && !DOCS_ALLOWED_PAGES.has(file))
      .filter((file) => CYRILLIC.test(readFileSync(resolve(ROOT, "docs", file), "utf8")));
    expect(
      found,
      "The Reference is written in English; the Russian Translation lives on the site " +
        `(ADR-0073).\n${found.join("\n")}`
    ).toEqual([]);
  });

  test("every allowed page exists and still quotes Russian", () => {
    const stale = [...DOCS_ALLOWED_PAGES].filter(
      (file) =>
        !docs.includes(file) || !CYRILLIC.test(readFileSync(resolve(ROOT, "docs", file), "utf8"))
    );
    expect(stale, `These pages no longer need an allowance:\n${stale.join("\n")}`).toEqual([]);
  });

  test("no Cyrillic in README.md except the link to README.ru.md", () => {
    const found = readFileSync(resolve(ROOT, "README.md"), "utf8")
      .split("\n")
      .map((line, i) => ({ line, number: i + 1 }))
      .filter(({ line }) => CYRILLIC.test(line) && !README_SWITCHER.test(line));
    expect(found.map(({ line, number }) => `README.md:${number}: ${line}`)).toEqual([]);
  });
});

/** Scripts, the consumer fixture and the root configs carry comments too (not the string gate's concern). */
const COMMENT_ROOTS = ["scripts", "fixtures"];
const COMMENT_ROOT_FILES = [
  "eslint.config.mjs",
  "vitest.config.ts",
  "vite.config.ts",
  "playwright.config.ts",
  "styles.css",
];

function walkFiles(dir: string, pattern: RegExp): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "node_modules" ? [] : walkFiles(full, pattern);
    return pattern.test(entry.name) ? [full] : [];
  });
}

function commentFiles(): string[] {
  return [
    ...ROOTS.flatMap((root) => sourceFiles(resolve(ROOT, root))),
    ...COMMENT_ROOTS.flatMap((root) => walkFiles(resolve(ROOT, root), /\.(tsx?|mjs|mts|css)$/)),
    ...COMMENT_ROOT_FILES.map((file) => resolve(ROOT, file)),
  ];
}

/**
 * Comment ratchet (ADR-0073, OLDSUI-297). Comments are written in English; the Russian
 * ones that remain are counted per file in `tests/comment-debt.json` and can only go
 * down. A file not listed there has a debt of zero, so `src/**` (shipped code) stays clean
 * and a new Russian comment anywhere fails the build. Translating a file means lowering or
 * removing its line in the JSON; the test asks for that, so the number never lies.
 */
function commentLinesWithCyrillic(source: string): number {
  const code = stripComments(source).split("\n");
  return source.split("\n").filter((line, i) => {
    const comment = [...line].map((ch, j) => (ch !== code[i]![j] ? ch : " ")).join("");
    return CYRILLIC.test(comment);
  }).length;
}

describe("the comment ratchet", () => {
  const debt: Record<string, number> = JSON.parse(
    readFileSync(join(ROOT, "tests/comment-debt.json"), "utf8")
  );
  const actual: Record<string, number> = {};
  for (const file of commentFiles()) {
    const n = commentLinesWithCyrillic(readFileSync(file, "utf8"));
    if (n > 0) actual[relative(ROOT, file).split("\\").join("/")] = n;
  }

  test("no file has more Russian comment lines than its baseline", () => {
    const grew = Object.entries(actual)
      .filter(([file, n]) => n > (debt[file] ?? 0))
      .map(([file, n]) => `${file}: ${n} Russian comment lines, baseline ${debt[file] ?? 0}`);
    expect(
      grew,
      "Write comments in English (ADR-0073). Do not raise the baseline in tests/comment-debt.json.\n" +
        grew.join("\n")
    ).toEqual([]);
  });

  test("a translated file lowers its baseline", () => {
    const stale = Object.entries(debt)
      .filter(([file, n]) => (actual[file] ?? 0) < n)
      .map(([file, n]) => `${file}: baseline ${n}, now ${actual[file] ?? 0}`);
    expect(
      stale,
      "Lower or remove these lines in tests/comment-debt.json so the ratchet keeps its grip.\n" +
        stale.join("\n")
    ).toEqual([]);
  });

  test("the debt lives only in tests, stories and the showcase", () => {
    const shipped = Object.keys(debt).filter(
      (file) => file.startsWith("src/") && !file.includes(".stories.")
    );
    expect(shipped, "Shipped source must have no Russian comments at all.").toEqual([]);
  });
});
