// The `radius` axis (ADR-0074): the preset table in `styles.css` and the guard that keeps radii on the scale.
//
// The registry test (`themes.test.ts`) only checks that the preset names exist. This file checks what
// the presets hold, because a preset with a missing step does not fail anywhere: the step silently
// inherits the `medium` value, and one family of components keeps its old shape.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { UI_RADII } from "../src/lib/themes.js";

const root = resolve(import.meta.dirname, "..");
const css = readFileSync(join(root, "styles.css"), "utf8");

const STEPS = ["2xs", "xs", "sm", "control", "md", "lg", "xl", "pill"] as const;
type Step = (typeof STEPS)[number];

/** The table from ADR-0074, plus the `2xs` step added on OLDSUI-300. The `full` preset was dropped after the pilot. */
const PILL = "9999px";
const EXPECTED: Record<(typeof UI_RADII)[number], Record<Step, string>> = {
  none: { "2xs": "0", xs: "0", sm: "0", control: "0", md: "0", lg: "0", xl: "0", pill: "0" },
  small: {
    "2xs": "2px",
    xs: "3px",
    sm: "4px",
    control: "5px",
    md: "6px",
    lg: "8px",
    xl: "10px",
    pill: "4px",
  },
  medium: {
    "2xs": "4px",
    xs: "6px",
    sm: "8px",
    control: "10px",
    md: "12px",
    lg: "16px",
    xl: "20px",
    pill: PILL,
  },
  large: {
    "2xs": "6px",
    xs: "8px",
    sm: "12px",
    control: "14px",
    md: "18px",
    lg: "24px",
    xl: "28px",
    pill: PILL,
  },
};

/** The declarations of the first rule whose selector list contains `selector` exactly. */
function block(selector: string): Record<string, string> {
  const re = /([^{}]+)\{([^{}]*)\}/g;
  for (const m of css.matchAll(re)) {
    const selectors = (m[1] ?? "")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split(",")
      .map((s) => s.trim());
    if (!selectors.includes(selector)) continue;
    const decls: Record<string, string> = {};
    for (const d of (m[2] ?? "")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
      decls[d[1] ?? ""] = (d[2] ?? "").trim();
    }
    return decls;
  }
  return {};
}

/** `:root` is split over several rules; the radius steps live in the one that declares `--r-xs`. */
function rootScale(): Record<string, string> {
  const re = /:root\s*\{([^{}]*)\}/g;
  for (const m of css.matchAll(re)) {
    if ((m[1] ?? "").includes("--r-xs:")) {
      const decls: Record<string, string> = {};
      for (const d of (m[1] ?? "")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
        decls[d[1] ?? ""] = (d[2] ?? "").trim();
      }
      return decls;
    }
  }
  return {};
}

describe("radius presets", () => {
  test("medium is the :root scale and has no block of its own", () => {
    const scale = rootScale();
    for (const step of STEPS)
      expect(scale[`--r-${step}`], `--r-${step}`).toBe(EXPECTED.medium[step]);
    expect(block('[data-radius="medium"]')).toEqual({});
  });

  test.each(UI_RADII.filter((r) => r !== "medium"))("preset %s declares every step", (preset) => {
    const decls = block(`[data-radius="${preset}"]`);
    for (const step of STEPS)
      expect(decls[`--r-${step}`], `${preset} --r-${step}`).toBe(EXPECTED[preset][step]);
  });

  test("the Tailwind bridge is re-bound on any [data-radius], so a subtree preset works", () => {
    // `@theme` declares `--radius-xs: var(--r-xs)` on :root, and a custom property is resolved where
    // it is declared: a descendant inherits 6px, not the reference. Without re-binding, a preset on a
    // subtree would change only the CSS that reads `--r-*` directly, and none of the utilities.
    const decls = block("[data-radius]");
    for (const step of STEPS)
      expect(decls[`--radius-${step}`], `--radius-${step}`).toBe(`var(--r-${step})`);
  });

  test("the @theme bridge exposes every step as a utility", () => {
    for (const step of STEPS) expect(css).toContain(`--radius-${step}: var(--r-${step});`);
  });
});

/**
 * The guard against radii outside the scale. A radius written as a number does not follow the
 * axis, so the kit changes shape by half again — the defect ADR-0074 starts from.
 *
 * Circles (`rounded-full`) are allowed: they stay circles in every preset. Exceptions are marks on
 * text, which are not a shape of the component; each one is named here with its reason.
 */
const EXCEPTIONS: { file: string; text: string; why: string }[] = [
  {
    file: "src/editor/RichTextEditor.tsx",
    text: "rounded-[2px]",
    why: "search match: a mark on text",
  },
  {
    file: "src/editor/features/toc/RichTextToc.tsx",
    text: 'borderRadius: "4px"',
    why: "TOC stroke: a mark, not a shape",
  },
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !/\.(stories|test)\.tsx?$/.test(name) ? [path] : [];
  });
}

/**
 * The code of a file with comments blanked out, line count kept. The scan looks at class strings,
 * and prose may say "rounded" or quote `rounded` in backticks.
 */
const codeOnly = (text: string) =>
  text
    .replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

/** The string literals of a line: quotes, apostrophes and backticks. */
const literals = (line: string) =>
  [...line.matchAll(/(["'`])((?:(?!\1).)*)\1/g)].map((m) => m[2] ?? "");

const OFF_SCALE: { name: string; hit: (line: string) => boolean }[] = [
  {
    // `rounded-[10px]`, but not `rounded-[inherit]` or `rounded-[calc(var(--radius-control)-1px)]`
    name: "arbitrary rounded value",
    hit: (line) =>
      /rounded(?:-[a-z]{1,2})?-\[(?!inherit\]|calc\(var\(--|var\(--)[^\]]*\]/.test(line),
  },
  {
    // bare `rounded`: Tailwind's own 4px, outside the kit scale
    name: "bare rounded",
    hit: (line) =>
      literals(line).some((l) => /(?:^|\s|:)rounded(?:-[tblrse]{1,2})?(?=\s|$)/.test(l)),
  },
  {
    // Tailwind's own steps the kit does not redefine: `rounded-2xl` is a stock 16px, not a token
    name: "stock Tailwind step",
    hit: (line) => /rounded(?:-[a-z]{1,2})?-[234]xl\b/.test(line),
  },
  {
    // `borderRadius: 8`, `borderRadius: "8px"`, `borderRadius: stuck ? "0 0 14px 14px" : "14px"`
    name: "numeric borderRadius",
    hit: (line) =>
      /borderRadius:\s*\d/.test(line) || (/borderRadius:/.test(line) && /\d+px/.test(line)),
  },
];

describe("radii stay on the scale", () => {
  const files = sourceFiles(join(root, "src"));

  test.each(OFF_SCALE)("no $name in the sources", ({ hit }) => {
    const hits: string[] = [];
    for (const path of files) {
      const rel = relative(root, path);
      for (const line of codeOnly(readFileSync(path, "utf8")).split("\n")) {
        if (!hit(line)) continue;
        if (EXCEPTIONS.some((e) => e.file === rel && line.includes(e.text))) continue;
        hits.push(`${rel}: ${line.trim()}`);
      }
    }
    expect(hits).toEqual([]);
  });

  test("no literal border-radius in styles.css", () => {
    const hits = [...css.matchAll(/border-radius:\s*([^;]+);/g)]
      .map((m) => (m[1] ?? "").trim())
      .filter((v) => /\d+px/.test(v) && !/^var\(--/.test(v));
    expect(hits).toEqual([]);
  });

  test("every exception still exists, so the list does not rot", () => {
    for (const e of EXCEPTIONS) {
      expect(readFileSync(join(root, e.file), "utf8"), `${e.file}: ${e.why}`).toContain(e.text);
    }
  });
});

/**
 * `cn` must know the role steps as radii, or it stops resolving conflicts: `cn("rounded-pill",
 * "rounded-full")` would keep both classes, and the one later in the CSS would win, not the last one
 * passed. `2xs` is a t-shirt size `twMerge` parses itself; `control` and `pill` are names by role.
 */
describe("cn knows the radius steps", () => {
  test.each(["2xs", "control", "pill"])("rounded-%s conflicts with rounded-full", async (step) => {
    const { cn } = await import("../src/lib/cn.js");
    expect(cn(`rounded-${step}`, "rounded-full")).toBe("rounded-full");
    expect(cn("rounded-full", `rounded-${step}`)).toBe(`rounded-${step}`);
  });
});
