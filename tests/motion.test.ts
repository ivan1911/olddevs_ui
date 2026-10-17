import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, test } from "vitest";

/**
 * The kit's motion and `prefers-reduced-motion`: ADR-0043.
 *
 * Why the test is text-based: for the same reasons as `token-layers.test.ts`.
 * jsdom does not resolve `var()` and does not compute the cascade, and raising a
 * real browser for four invariants costs more than they are worth. The live
 * cascade under both system settings is guarded by `tests-visual/interactions.spec.ts`.
 *
 * What breaks silently here, and why the test exists: an animation token added
 * without a pair in the `reduce` block. It breaks neither the types, nor the
 * linter, nor the snapshots. The snapshots run with `reducedMotion: "reduce"`, but
 * `animations: "disabled"` freezes the animation at its final frame, so the
 * difference between "damped" and "not damped" is not visible in them at all.
 */
const css = readFileSync(resolve(import.meta.dirname, "..", "styles.css"), "utf8");

/** The body of a block, found by its opening. Braces are counted: nested rules sit inside. */
function bodyAt(from: number): string {
  let i = css.indexOf("{", from) + 1;
  const start = i;
  for (let depth = 1; depth > 0; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}") depth--;
  }
  return css.slice(start, i - 1);
}

function blockBody(opener: string): string {
  const at = css.indexOf(opener);
  if (at === -1) throw new Error(`styles.css has no block ${opener}`);
  return bodyAt(at);
}

const animationTokens = (body: string) =>
  [...body.matchAll(/--(animate-[\w-]+)\s*:\s*([^;]+);/g)].map((m) => m[1] as string);

/** Pairs "token → value", for when what matters is what it is built from, not its name. */
const animationValues = (body: string) =>
  new Map(
    [...body.matchAll(/--(animate-[\w-]+)\s*:\s*([^;]+);/g)].map(
      (m) => [m[1] as string, (m[2] as string).trim()] as const
    )
  );

/**
 * A cycle is not a transition. `shimmer`, `spin`, `pulse` and `progressIndeterminate`
 * keep their literal period: putting a step there would mean saying that the
 * skeleton's glint and the appearance of a tooltip are quantities of one kind
 * (ADR-0047).
 *
 * The criterion is formal on purpose: a person judges "this is a cycle" correctly,
 * but the test must decide unambiguously.
 */
const isCycle = (value: string) => value.includes("infinite");

const THEME = blockBody("@theme");

/** The kit's tokens: everything declared in `@theme`. */
const DECLARED = animationTokens(THEME);

/**
 * The motion scale: the duration steps and the curves.
 *
 * A declaration is found by its name followed by a colon; a reference by `var()`.
 * The two must be told apart: `--default-transition-duration: var(--duration-base)`
 * contains both, and a greedy search would count the reference as a declaration.
 */
const scaleDecls = (body: string, family: "duration" | "ease") =>
  [...body.matchAll(new RegExp(`(?:^|[\\s;{])--(${family}-[\\w-]+)\\s*:`, "g"))].map(
    (m) => m[1] as string
  );

const scaleRefs = (body: string, family: "duration" | "ease") =>
  [...body.matchAll(new RegExp(`var\\(--(${family}-[\\w-]+)\\)`, "g"))].map((m) => m[1] as string);

/**
 * Both scales are closed by a number, like the allowlist of exceptions: a fifth
 * step or a fourth curve must require analysis in an ADR, not an edit to this test.
 */
const DURATIONS = scaleDecls(THEME, "duration");
const EASES = scaleDecls(THEME, "ease");

/**
 * Overrides under `reduce`. `:root` is searched INSIDE the media query, not the
 * first one in the file: the first one is the role dictionary, and confusing the
 * two would mean a green test on an empty spot.
 */
const REDUCE_BLOCK = blockBody("@media (prefers-reduced-motion: reduce)");
const REDUCED = animationTokens(REDUCE_BLOCK);

/**
 * Exceptions: motion that is NOT damped, because it is itself a message. Both
 * entries are analyzed in ADR-0043.
 *
 * The list is closed by a number. A third entry must require analysis, not an edit
 * to this number. The approach is borrowed from the `i18n-gate` allowlist (ADR-0034).
 */
const ESSENTIAL = ["animate-progress-indeterminate", "animate-spin"];

describe("the motion scale", () => {
  test("the duration scale is closed: four steps, named by role", () => {
    expect(DURATIONS).toEqual([
      "duration-fast",
      "duration-base",
      "duration-moderate",
      "duration-slow",
    ]);
  });

  test("the easing scale is closed: three curves, named by role", () => {
    expect(EASES).toEqual(["ease-standard", "ease-enter", "ease-exit"]);
  });

  test("a step carries a value, and the value is not a step of another scale", () => {
    // A step is a number with a time, a curve is a function. They are easy to mix
    // up: both live side by side and both are read by one `var()`.
    for (const [decl, value] of [
      ...THEME.matchAll(/(?:^|[\s;{])--(duration-[\w-]+)\s*:\s*([^;]+);/g),
    ].map((m) => [m[1] as string, (m[2] as string).trim()] as const))
      expect(value, `--${decl} is not a time`).toMatch(/^\d+m?s$/);

    for (const [decl, value] of [
      ...THEME.matchAll(/(?:^|[\s;{])--(ease-[\w-]+)\s*:\s*([^;]+);/g),
    ].map((m) => [m[1] as string, (m[2] as string).trim()] as const))
      expect(value, `--${decl} is not an easing function`).toMatch(
        /^(cubic-bezier|linear|steps)\(/
      );
  });

  test("every reference to the scale points at a declared step", () => {
    for (const family of ["duration", "ease"] as const) {
      const declared = new Set(scaleDecls(THEME, family));
      const orphans = [...new Set(scaleRefs(css, family))].filter((n) => !declared.has(n));
      expect(orphans, `references to undeclared ${family} steps: ${orphans.join(", ")}`).toEqual(
        []
      );
    }
  });

  test("a transition token is built from the scale, never from a literal", () => {
    /*
     * A literal inside a token is a step that is not in the scale, and it can be
     * found only by reading all ten values in a row. That is exactly how 0.14s
     * versus 0.16s appeared on the tooltip and the anchored panel.
     */
    for (const [token, value] of animationValues(THEME)) {
      if (isCycle(value)) continue;
      expect(value, `--${token} names a duration instead of referencing a step`).not.toMatch(
        /\d+\.?\d*m?s\b/
      );
      expect(value, `--${token} does not reference a duration step`).toMatch(/var\(--duration-/);
      expect(value, `--${token} does not reference an easing curve`).toMatch(/var\(--ease-/);
    }
  });

  test("damping keeps the tempo: reduce changes the keyframes and nothing else", () => {
    /*
     * ADR-0043 promises "the same duration, the same curve, only the opacity".
     * Before the scale, the promise rested on a comment and on the author having
     * carefully copied the number into both lines. Now it is checked.
     */
    const theme = animationValues(THEME);
    for (const [token, damped] of animationValues(REDUCE_BLOCK)) {
      const declared = theme.get(token);
      if (declared === undefined || damped.trim() === "none") continue;
      for (const family of ["duration", "ease"] as const)
        expect(
          scaleRefs(damped, family),
          `--${token} is damped with a different ${family} than it is declared with`
        ).toEqual(scaleRefs(declared, family));
    }
  });

  test("Tailwind's transition defaults read the scale", () => {
    /*
     * Without this pair the scale would be half-done: `transition-colors` without
     * an explicit duration class would keep using Tailwind's default 150ms, a number
     * that happens to match a step rather than referencing it. A consumer who
     * overrode `--duration-base` would not shift a single such transition.
     */
    expect(THEME).toMatch(/--default-transition-duration:\s*var\(--duration-[\w-]+\);/);
    expect(THEME).toMatch(/--default-transition-timing-function:\s*var\(--ease-[\w-]+\);/);
  });
});

describe("motion and prefers-reduced-motion", () => {
  test("every animation token is either damped or named as an exception", () => {
    for (const token of DECLARED) {
      if (ESSENTIAL.includes(token)) continue;
      expect(
        REDUCED,
        `--${token} is declared in @theme but is not overridden under prefers-reduced-motion`
      ).toContain(token);
    }
  });

  test("an exception stays an exception: nothing damps it", () => {
    for (const token of ESSENTIAL)
      expect(REDUCED, `--${token} is an ADR-0043 exception and must not be damped`).not.toContain(
        token
      );
  });

  test("there are exactly two exceptions", () => {
    expect(ESSENTIAL).toHaveLength(2);
  });

  test("an exception points at a token that exists", () => {
    for (const token of ESSENTIAL)
      expect(DECLARED, `--${token} is allow-listed but is not declared in @theme`).toContain(token);
  });

  test("the reduce block damps nothing that is gone", () => {
    for (const token of REDUCED)
      expect(DECLARED, `--${token} is damped but is not declared in @theme — renamed?`).toContain(
        token
      );
  });

  test("an animation is set through a token, not a literal", () => {
    /*
     * Catches a defect found in wave 27: `.skeleton` hard-coded
     * `animation: shimmer 1.6s linear infinite` around the token, so overriding
     * `--animate-shimmer` in the `reduce` block was dead code. A rule that does not
     * read the variable keeps running.
     *
     * `@keyframes` are excluded from the check: `animation` is not declared there,
     * while `@theme` declares the tokens themselves.
     */
    const outsideTheme = css.slice(css.indexOf("}", css.indexOf("@theme")));
    for (const [decl, value] of [...outsideTheme.matchAll(/\n\s*animation:\s*([^;]+);/g)].map(
      (m) => [m[0].trim(), (m[1] as string).trim()] as const
    ))
      expect(value, `${decl} is a literal animation; nothing will damp it under reduce`).toMatch(
        /var\(--animate-/
      );
  });

  test("the kit damps nothing of its host: no global reset, no !important", () => {
    // ADR-0043, item 2: the package may not damp the animations of the page it sits on.
    expect(REDUCE_BLOCK).not.toMatch(/!important/);
    expect(
      REDUCE_BLOCK,
      "a `*` selector in the reduce block resets animations the kit does not own"
    ).not.toMatch(/(^|[\s,}])\*\s*[,{]/);
  });
});

/**
 * A component's tempo is taken from the scale, not from a number in `className`
 * (ADR-0047).
 *
 * WHAT BREAKS SILENTLY. `duration-150`, written in a new component, breaks neither
 * the types, nor the linter, nor the snapshots, and it looks exactly like the
 * neighboring sixteen that this same wave removed. In half a year there will be
 * sixteen of them again, and the scale in `styles.css` will stay in place on its own.
 *
 * The gate works on the sources, not on the built CSS: in the build, the utility
 * `duration-150` is indistinguishable from `duration-base`, since both give 150ms.
 * The whole difference is intent, and the intent is written precisely in the source.
 */
const COMPONENTS = resolve(import.meta.dirname, "..", "src");

/**
 * Forbidden: a numeric duration and delay, foreign curve names, and arbitrary
 * values. Allowed: the steps and curves of the scale, which are checked separately
 * by being declared in `@theme`.
 *
 * `transition-[left]` and the like are NOT forbidden: that is a choice of property, not of tempo.
 */
const OFF_SCALE = [
  { pattern: /\b(?:duration|delay)-\d+\b/, why: "a numeric duration instead of a step" },
  { pattern: /\b(?:duration|delay)-\[[^\]]+\]/, why: "an arbitrary duration instead of a step" },
  {
    pattern: /\bease-(?:in-out|in|out|linear)\b/,
    why: "a Tailwind curve instead of a scale curve",
  },
  { pattern: /\bease-\[[^\]]+\]/, why: "an arbitrary curve instead of a scale curve" },
];

function tsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...tsxFiles(full));
    else if (entry.name.endsWith(".tsx") && !entry.name.endsWith(".stories.tsx")) out.push(full);
  }
  return out;
}

/** Comments also explain the old numbers, so the gate does not read them. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, lead: string) => lead + " ".repeat(m.length - lead.length));
}

describe("components take their tempo from the scale", () => {
  test("no component names a duration or an easing off the scale", () => {
    const found: string[] = [];
    for (const file of tsxFiles(COMPONENTS)) {
      const rel = relative(resolve(import.meta.dirname, ".."), file)
        .split("\\")
        .join("/");
      stripComments(readFileSync(file, "utf8"))
        .split("\n")
        .forEach((line, i) => {
          for (const { pattern, why } of OFF_SCALE)
            if (pattern.test(line)) found.push(`${rel}:${i + 1}: ${why} — ${line.trim()}`);
        });
    }
    expect(
      found,
      "Name a duration only where it differs from the default, and name it by a step:\n" +
        "duration-fast | base | moderate | slow, ease-standard | enter | exit (ADR-0047).\n" +
        found.join("\n")
    ).toEqual([]);
  });
});
