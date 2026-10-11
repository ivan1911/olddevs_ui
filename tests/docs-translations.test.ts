import { describe, expect, test } from "vitest";
import {
  hashOriginal,
  originalOf,
  readDocs,
  translationProblems,
  translationsState,
} from "../scripts/docs-translations.mjs";

/**
 * An English translation of a Reference page is a sibling `X.en.md` of the
 * Original `X.md` (ADR-0062). The site shows it whole, by Parts and by a single
 * H2 section, and maps anchors from the Original's headings to the
 * translation's headings by position. That only works while the translation
 * keeps the Original's shape: the same headings at the same levels in the same
 * order, the same code blocks, the same frontmatter. A stale translation (the
 * Original changed since) is reported, not failed: Originals change more often
 * than they are translated.
 */

const original =
  "---\ncomponent: Button\n---\n# Button\n\n## When\n\nText.\n\n```tsx\n<Button />\n```\n";
const translation = (text: string, hash = hashOriginal(original)) =>
  text.replace("---\ncomponent: Button\n", `---\ncomponent: Button\nsourceHash: ${hash}\n`);

describe("translation shape", () => {
  test("a translation with the Original's headings, code blocks and frontmatter passes", () => {
    const en = translation(
      "---\ncomponent: Button\n---\n# Button\n\n## When to use\n\nText.\n\n```tsx\n<Button />\n```\n"
    );
    expect(translationProblems(en, original)).toEqual([]);
  });

  test("a heading added, dropped or moved to another level is a problem", () => {
    const extra = translation(original.replace("## When", "## When\n\n### Extra"));
    expect(translationProblems(extra, original).join()).toMatch(/heading/);
    const level = translation(original.replace("## When", "### When"));
    expect(translationProblems(level, original).join()).toMatch(/heading/);
  });

  test("a heading-like line inside a code block is not a heading", () => {
    const fenced = original.replace("<Button />", "# not a heading");
    expect(translationProblems(translation(fenced), fenced)).toEqual([]);
  });

  test("a dropped code block is a problem", () => {
    const en = translation(original.replace(/```tsx[\s\S]*```\n/, ""));
    expect(translationProblems(en, original).join()).toMatch(/code block/);
  });

  test("frontmatter is the Original's plus sourceHash; a missing or malformed hash is a problem", () => {
    expect(translationProblems(original, original).join()).toMatch(/sourceHash/);
    const changed = translation(original).replace("component: Button", "component: Btn");
    expect(translationProblems(changed, original).join()).toMatch(/frontmatter/);
  });

  test("an Original without frontmatter gets a translation with only sourceHash in it", () => {
    const bare = "# Access\n\n## Name\n";
    const en = `---\nsourceHash: ${hashOriginal(bare)}\n---\n# Access\n\n## Name\n`;
    expect(translationProblems(en, bare)).toEqual([]);
  });
});

describe("translations state", () => {
  test("the Original of X.en.md is X.md", () => {
    expect(originalOf("components/actions/button.en.md")).toBe("components/actions/button.md");
  });

  test("current, stale and orphan translations", () => {
    const files = new Map([
      ["a.md", original],
      ["a.en.md", translation(original)],
      ["b.md", original + "\nMore.\n"],
      ["b.en.md", translation(original)],
      ["c.en.md", translation(original)],
      ["d.md", original],
    ]);
    const state = translationsState(files);
    expect(state.current).toEqual(["a.md"]);
    expect(state.stale).toEqual(["b.md"]);
    expect(state.missing).toEqual(["d.md"]);
    expect(state.problems.join()).toMatch(/c\.en\.md.*Original/);
  });
});

test("every translation in docs/ keeps its Original's shape and names its hash", () => {
  expect(translationsState(readDocs()).problems).toEqual([]);
});
