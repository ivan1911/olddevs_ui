import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

/**
 * Token layers: palette primitives → roles → component tokens → brand.
 *
 * Why the test is textual rather than based on `getComputedStyle`: jsdom does not resolve
 * `var()` and does not compute the cascade over a linked stylesheet, and standing up a real browser
 * for four invariants costs more than they are worth. The test checks what can really be checked
 * from the file, and exactly what breaks silently.
 *
 * The live cascade in a browser is guarded by `tests-visual/interactions.spec.ts`.
 */
const css = readFileSync(resolve(import.meta.dirname, "..", "styles.css"), "utf8");

/** The body of a block for a selector. Braces are counted: the block contains nested rules. */
function blockBody(selector: string): string {
  const at = css.indexOf(selector + " {");
  if (at === -1) throw new Error(`styles.css has no block ${selector}`);
  let i = css.indexOf("{", at) + 1;
  const start = i;
  for (let depth = 1; depth > 0; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}") depth--;
  }
  return css.slice(start, i - 1);
}

const declsOf = (body: string) =>
  Object.fromEntries(
    [...body.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1] ?? "", (m[2] ?? "").trim()])
  ) as Record<string, string>;

const ROOT = declsOf(blockBody(":root"));
const THEME_BLOCKS = ['[data-theme="light"]', '[data-theme="dim"]'].map((sel) =>
  declsOf(blockBody(":root" + sel))
);
const BRAND_SELECTORS: string[] = [
  ...css.matchAll(/(:root(?:\[[\w-]+="[\w-]+"\])*\[data-brand="[\w-]+"\])\s*\{/g),
].map((m) => m[1] ?? "");

describe("the primitive layer", () => {
  test("every var(--od-*) reference points to a declared primitive", () => {
    const declared = new Set([...css.matchAll(/--(od-[\w-]+)\s*:/g)].map((m) => m[1] ?? ""));
    const referenced = [...css.matchAll(/var\(--(od-[\w-]+)\)/g)].map((m) => m[1] ?? "");
    const orphans = [...new Set(referenced.filter((n) => !declared.has(n)))];
    expect(orphans, `references to undeclared primitives: ${orphans.join(", ")}`).toEqual([]);
  });

  test("semantics and themes hold no raw colours — only references to primitives", () => {
    // Shadows and gradients are compositions of geometry and color, not palette entries:
    // their color is inlined in the value and cannot be expressed as a primitive. See layer 1.
    const isComposite = (token: string) => token.includes("shadow");
    const raw: string[] = [];
    const scopes: [string, Record<string, string>][] = [
      [":root", ROOT],
      ...THEME_BLOCKS.map((d, i): [string, Record<string, string>] => [`theme ${i + 1}`, d]),
    ];
    for (const [where, decls] of scopes) {
      for (const [token, value] of Object.entries(decls)) {
        if (token.startsWith("od-") || isComposite(token)) continue;
        if (/#[0-9a-f]{3,8}\b|\brgba?\(/i.test(value)) raw.push(`${where}: --${token}: ${value}`);
      }
    }
    expect(raw, `raw colours outside the primitive layer:\n${raw.join("\n")}`).toEqual([]);
  });
});

describe("the brand overlay", () => {
  test("at least one brand is declared — the mechanism is proven, not described", () => {
    expect(BRAND_SELECTORS.length).toBeGreaterThan(0);
  });

  test("brand blocks come after accent blocks", () => {
    // With equal specificity the later one wins. Reorder the blocks and the brand stops
    // overriding the accent axis, silently.
    const lastAccent = Math.max(
      css.lastIndexOf(':root[data-accent="violet"] {'),
      css.lastIndexOf(':root[data-theme="light"][data-accent="violet"] {')
    );
    for (const sel of BRAND_SELECTORS) {
      expect(css.indexOf(sel + " {"), `${sel} must come after the accent blocks`).toBeGreaterThan(
        lastAccent
      );
    }
  });

  test("the “theme + brand” block comes after the brand-only block", () => {
    const plain = BRAND_SELECTORS.filter((sel) => sel.split("[").length === 2);
    const paired = BRAND_SELECTORS.filter((sel) => sel.split("[").length > 2);
    for (const pairedSel of paired) {
      const brand = pairedSel.match(/data-brand="([\w-]+)"/)?.[1] ?? "";
      const base = plain.find((sel) => sel.includes(`data-brand="${brand}"`));
      expect(base, `for ${pairedSel} there is no standalone brand block`).toBeDefined();
      expect(css.indexOf(pairedSel + " {")).toBeGreaterThan(css.indexOf(String(base) + " {"));
    }
  });

  test("a brand overrides only the roles declared in the base", () => {
    for (const sel of BRAND_SELECTORS) {
      for (const token of Object.keys(declsOf(blockBody(sel)))) {
        if (token.startsWith("od-")) continue; // the brand's own primitives
        expect(ROOT[token], `${sel}: role --${token} is not declared in :root`).toBeDefined();
      }
    }
  });

  test("a brand declares its own primitives instead of overriding the kit palette", () => {
    const kitPrimitives = new Set(Object.keys(ROOT).filter((t) => t.startsWith("od-")));
    for (const sel of BRAND_SELECTORS) {
      const clashes = Object.keys(declsOf(blockBody(sel))).filter((t) => kitPrimitives.has(t));
      expect(clashes, `${sel} overrides kit primitives: ${clashes.join(", ")}`).toEqual([]);
    }
  });
});

/*
  A token that references itself (`--font-mono: var(--font-mono), …`) is invalid as a whole
  under the CSS spec: its value is empty, and a Tailwind class built on it silently falls back to
  the inherited value. That is how `font-mono` was drawn in Inter across the whole kit for years.
  The guard catches any such reference, not just this one.
*/
test("no custom property refers only to itself", () => {
  const decls = [...css.matchAll(/(--[\w-]+)\s*:\s*([^;{}]*);/g)].map(([, name, value]) => ({
    name: name!,
    self: new RegExp(`var\\(\\s*${name}\\s*[,)]`).test(value!),
  }));
  // An `@theme` bridge such as `--shadow-1: var(--shadow-1)` is legal as long as the token has a
  // real declaration in the theme: it comes later in the cascade and breaks the loop. The error
  // is a token whose EVERY declaration references itself.
  const onlySelf = [...new Set(decls.filter((d) => d.self).map((d) => d.name))].filter((name) =>
    decls.filter((d) => d.name === name).every((d) => d.self)
  );

  expect(onlySelf).toEqual([]);
});

/*
  A variable the kit does not declare itself (`--font-inter`, `--font-code`) is set by the
  consumer, or not set at all. A reference to it without a fallback value makes the whole token
  invalid: `--font-sans: var(--font-inter), …` is empty without `--font-inter`, and `font-sans`
  silently inherits the ancestor's font. In `Kbd` and in the code block header that is the
  monospace font (OLDSUI-117). Such a reference must have a fallback value.
*/
test("a token never reads a variable the kit leaves undeclared without a fallback", () => {
  // Comments are stripped first: inside them, `var(--x)` is an example, not a reference.
  const code = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const tokens = [...code.matchAll(/(--[\w-]+)\s*:\s*([^;{}]*);/g)];
  const declared = new Set(tokens.map(([, name]) => name!));
  // Token values only. A plain property may legitimately read a variable that a component's
  // inline style sets (`height: var(--row-exit-h)`).
  const bare = tokens.flatMap(([, , value]) =>
    [...value!.matchAll(/var\(\s*(--[\w-]+)\s*\)/g)]
      .map(([, name]) => name!)
      .filter((name) => !declared.has(name))
  );

  expect([...new Set(bare)]).toEqual([]);
});
