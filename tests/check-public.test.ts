import { describe, expect, test } from "vitest";
import { findViolations, isTextFile, isUnbuilt, packedPaths } from "../scripts/check-public.mjs";

/**
 * The kit is published to npmjs and mirrored to a public repository. What the
 * package and the public tree carry must not point inside: no tracker keys in
 * the code that ships, no internal hosts, no traces of the product the kit was
 * forked from. The gate reads the files and names every hit by file and line.
 *
 * The fixtures below are glued from pieces on purpose: the gate also reads this
 * file in `--repo` mode, and a literal internal address here would trip it.
 */

const files = (entries: Record<string, string>) => new Map(Object.entries(entries));
const key = (n: number) => `OLDSUI-${n}`;
const host = (name: string) => `${name}.olddevs` + ".ru";

describe("tracker keys", () => {
  test("a key in shipped source is reported with its file, line and rule", () => {
    const found = findViolations(
      files({ "src/Button.tsx": `const a = 1;\n// Fixed in ${key(42)}: focus ring.\n` })
    );
    expect(found).toEqual([{ path: "src/Button.tsx", line: 2, rule: "tracker-key" }]);
  });

  test("tests and scripts keep their keys: there a key ties a check to the regression it guards", () => {
    const found = findViolations(
      files({
        "tests/button.test.tsx": `// ${key(42)}`,
        "tests-visual/a11y.spec.ts": `// ${key(43)}`,
        "scripts/llms.mjs": `// ${key(44)}`,
      })
    );
    expect(found).toEqual([]);
  });
});

describe("internal hosts", () => {
  test("the public documentation site is allowed, every other host of the domain is not", () => {
    const found = findViolations(
      files({
        "README.md": [
          `Docs: https://${host("ui")}/components`,
          `Tracker: https://${host("jira")}/browse/X`,
          `Wiki: https://${host("wiki")}/spaces/X`,
          `Code: ssh://git@${host("bitbucket")}:7999/x.git`,
          `Mail: team@olddevs` + ".ru",
        ].join("\n"),
      })
    );
    expect(found.map((v) => [v.line, v.rule])).toEqual([
      [2, "internal-host"],
      [3, "internal-host"],
      [4, "internal-host"],
      [5, "internal-host"],
    ]);
  });

  test("tests are not exempt: an address in a test is as public as one in the code", () => {
    const found = findViolations(files({ "tests/x.test.ts": `fetch("https://${host("jira")}")` }));
    expect(found).toEqual([{ path: "tests/x.test.ts", line: 1, rule: "internal-host" }]);
  });
});

describe("private registry and local paths", () => {
  test("the GitLab project of the old registry is reported by its path and by its id", () => {
    const found = findViolations(
      files({
        ".npmrc": `@olddevs:registry=https://gitlab.com/api/v4/projects/${"8614" + "1926"}/packages/npm/`,
        "package.json": `"url": "git+ssh://git@gitlab.com/${"olddevs" + "-ui"}/olddevs_ui.git"`,
      })
    );
    expect(found.map((v) => v.rule)).toEqual(["private-registry", "private-registry"]);
  });

  test("an absolute path from a developer's machine is reported", () => {
    const found = findViolations(files({ "AGENTS.md": `See ${"/Us" + "ers"}/ivan/Projects/x` }));
    expect(found).toEqual([{ path: "AGENTS.md", line: 1, rule: "local-path" }]);
  });
});

describe("the product the kit was forked from", () => {
  const product = "Wall" + "paper";
  test("its name and its package scope are reported in any case and in any folder, tests included", () => {
    const found = findViolations(
      files({
        "src/Card.stories.tsx": `title: "${product} card"`,
        "tests/grid.test.tsx": `const scope = "${"@w" + "pp"}/ui";`,
        "docs/theming.md": `${product.toLowerCase()}-poster-front`,
        "CHANGELOG.md": `migrated from ${"wp" + "p"}-ui`,
      })
    );
    expect(found.map((v) => v.path)).toEqual([
      "src/Card.stories.tsx",
      "tests/grid.test.tsx",
      "docs/theming.md",
      "CHANGELOG.md",
    ]);
    expect(new Set(found.map((v) => v.rule))).toEqual(new Set(["forked-product"]));
  });
});

describe("links into the private documentation repository", () => {
  const docs = "olddevs_ui" + "_docs";
  test("a relative path into it is reported; its name in plain text is not", () => {
    const found = findViolations(
      files({
        "docs/components/button.md": [
          `Decision: [ADR-0013](../../../${docs}/adr/0013-x.md).`,
          `See ../${docs}/agents/domain.md for the vocabulary.`,
          `Decisions live in a separate repository, ${docs}; here they are cited as ADR-0013.`,
        ].join("\n"),
      })
    );
    expect(found.map((v) => [v.line, v.rule])).toEqual([
      [1, "private-docs-link"],
      [2, "private-docs-link"],
    ]);
  });

  test("a path into it is reported even without a link: a file name points nowhere public", () => {
    const found = findViolations(
      files({ "docs/icons.md": `The criterion is in ADR-0049 (\`${docs}/adr/0049-icons.md\`).` })
    );
    expect(found).toEqual([{ path: "docs/icons.md", line: 1, rule: "private-docs-link" }]);
  });
});

describe("what the gate reads", () => {
  test("the gate's own source is skipped: it has to spell out what it looks for", () => {
    const found = findViolations(
      files({ "scripts/check-public.mjs": `const product = /${"wall" + "paper"}/i;` })
    );
    expect(found).toEqual([]);
  });

  test("the package file list comes from the JSON that npm pack prints", () => {
    const json = JSON.stringify([
      { name: "@olddevs/ui", files: [{ path: "LICENSE" }, { path: "dist/index.js" }] },
    ]);
    expect(packedPaths(json)).toEqual(["LICENSE", "dist/index.js"]);
  });

  test("a package list without dist is unbuilt: it cannot be called clean, the types were never read", () => {
    expect(isUnbuilt(["LICENSE", "src/index.ts", "docs/index.md"])).toBe(true);
    expect(isUnbuilt(["LICENSE", "dist/index.js", "dist/index.d.ts"])).toBe(false);
  });

  test("images, fonts and archives are not read as text", () => {
    expect(isTextFile("docs/theming.md")).toBe(true);
    expect(isTextFile("dist/index.d.ts")).toBe(true);
    expect(isTextFile("tests-visual/__snapshots__/button.png")).toBe(false);
    expect(isTextFile("src/fonts/inter.woff2")).toBe(false);
    expect(isTextFile("fixtures/kit.tgz")).toBe(false);
  });
});
