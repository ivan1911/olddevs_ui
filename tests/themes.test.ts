// @vitest-environment jsdom
//
// Half of the file runs without the DOM (checking the registry against `styles.css`), but
// `applyTheme` and the early-apply script cannot be checked without it, and keeping two
// files for the sake of one pragma costs more than starting jsdom once.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeEach, describe, expect, test, vi } from "vitest";
import {
  applyTheme,
  DEFAULT_THEME_PREFS,
  normalizeAccent,
  normalizeBrand,
  normalizeRadius,
  normalizeTheme,
  themeInitScript,
  UI_ACCENTS,
  UI_BRANDS,
  UI_RADII,
  UI_THEMES,
} from "../src/lib/themes.js";

const css = readFileSync(resolve(import.meta.dirname, "..", "styles.css"), "utf8");

/** Axis values that have their own block in the CSS. The default has no block of its own. */
const declaredIn = (attr: string) =>
  new Set([...css.matchAll(new RegExp(`\\[${attr}="([\\w-]+)"\\]`, "g"))].map((m) => m[1] ?? ""));

/**
 * The registry against `styles.css` — exactly the defect the registry exists to prevent.
 *
 * It is checked in both directions, and that is not pedantry. An extra value in the
 * registry is a switch item that changes nothing; a missing one is a theme that is in
 * the CSS but unavailable through the kit. Both breakages are silent.
 */
describe.each([
  ["data-theme", UI_THEMES, DEFAULT_THEME_PREFS.theme],
  ["data-accent", UI_ACCENTS, DEFAULT_THEME_PREFS.accent],
  ["data-brand", UI_BRANDS, DEFAULT_THEME_PREFS.brand],
] as const)("axis %s", (attr, list, fallback) => {
  test("every block in styles.css is listed in the registry", () => {
    const extra = [...declaredIn(attr)].filter((v) => !list.includes(v as never));
    expect(
      extra,
      `styles.css has blocks that are not in the registry: ${extra.join(", ")}`
    ).toEqual([]);
  });

  test("without a block exactly the axis default remains", () => {
    const withoutBlock = list.filter((v) => !declaredIn(attr).has(v));
    expect(withoutBlock).toEqual([fallback]);
  });
});

/**
 * The radius axis is the exception to "the default has no block": a preset is also set on a
 * subtree, and `data-radius="medium"` inside a `large` page has to RESET the steps. Without its own
 * block it would only inherit the ancestor's preset (found in review).
 */
describe("axis data-radius", () => {
  test("every preset, the default included, has a block and is listed in the registry", () => {
    expect([...declaredIn("data-radius")].sort()).toEqual([...UI_RADII].sort());
  });
});

describe("normalisation", () => {
  test.each([
    ["string outside the list", "solarized"],
    ["empty string", ""],
    ["null", null],
    ["undefined", undefined],
    ["number", 3],
    ["object", {}],
  ])("%s yields the default", (_name, value) => {
    expect(normalizeTheme(value)).toBe(DEFAULT_THEME_PREFS.theme);
    expect(normalizeAccent(value)).toBe(DEFAULT_THEME_PREFS.accent);
    expect(normalizeBrand(value)).toBe(DEFAULT_THEME_PREFS.brand);
    expect(normalizeRadius(value)).toBe(DEFAULT_THEME_PREFS.radius);
  });

  test("a valid value passes through as is", () => {
    expect(normalizeTheme("light")).toBe("light");
    expect(normalizeAccent("violet")).toBe("violet");
    expect(normalizeBrand("teal")).toBe("teal");
    expect(normalizeRadius("large")).toBe("large");
  });
});

describe("applyTheme", () => {
  let root: HTMLElement;

  beforeEach(() => {
    root = document.createElement("div");
  });

  test("sets all four axes", () => {
    applyTheme(root, { theme: "light", accent: "violet", brand: "teal", radius: "none" });
    expect(root.getAttribute("data-theme")).toBe("light");
    expect(root.getAttribute("data-accent")).toBe("violet");
    expect(root.getAttribute("data-brand")).toBe("teal");
    expect(root.getAttribute("data-radius")).toBe("none");
  });

  test("an omitted radius returns to the default", () => {
    applyTheme(root, { radius: "large" });
    applyTheme(root, {});
    expect(root.getAttribute("data-radius")).toBe(DEFAULT_THEME_PREFS.radius);
  });

  test("the base brand removes the attribute instead of writing it as a value", () => {
    applyTheme(root, { brand: "teal" });
    applyTheme(root, { brand: "base" });
    expect(root.hasAttribute("data-brand")).toBe(false);
  });

  test("an omitted axis returns to the default instead of keeping the previous value", () => {
    // Otherwise the brand would stay from the previous screen, and nobody would understand why.
    applyTheme(root, { theme: "dim", brand: "teal" });
    applyTheme(root, { theme: "light" });
    expect(root.getAttribute("data-theme")).toBe("light");
    expect(root.hasAttribute("data-brand")).toBe(false);
  });

  test("junk does not reach the attribute", () => {
    applyTheme(root, { theme: "solarized" as never, brand: "neon" as never });
    expect(root.getAttribute("data-theme")).toBe(DEFAULT_THEME_PREFS.theme);
    expect(root.hasAttribute("data-brand")).toBe(false);
  });
});

/**
 * The script must be EXECUTABLE, not merely look executable: it travels to the consumer
 * as a string, and a typo in it is caught neither by the compiler nor by the linter.
 */
describe("themeInitScript", () => {
  const KEY = "ui-prefs";

  /**
   * The storage is a stub of its own, not taken from the environment: `localStorage` in
   * this version of jsdom exists by name but has no `Storage` methods, and the test would
   * fail on the infrastructure rather than on the code under test. The script itself stays
   * exactly what travels to the consumer: it accesses a bare `localStorage`, as code in a
   * browser should.
   */
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  });
  afterAll(() => vi.unstubAllGlobals());

  const run = (script: string) => new Function(script)();

  beforeEach(() => {
    store.clear();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.removeAttribute("data-accent");
    document.documentElement.removeAttribute("data-brand");
    document.documentElement.removeAttribute("data-radius");
  });

  test("applies the stored preferences before rendering", () => {
    store.set(
      KEY,
      JSON.stringify({ theme: "light", accent: "violet", brand: "teal", radius: "small" })
    );
    run(themeInitScript({ storageKey: KEY }));
    expect(document.documentElement.getAttribute("data-radius")).toBe("small");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(document.documentElement.getAttribute("data-accent")).toBe("violet");
    expect(document.documentElement.getAttribute("data-brand")).toBe("teal");
  });

  test("empty storage yields defaults, not a crash", () => {
    run(themeInitScript({ storageKey: KEY }));
    expect(document.documentElement.getAttribute("data-theme")).toBe(DEFAULT_THEME_PREFS.theme);
    expect(document.documentElement.hasAttribute("data-brand")).toBe(false);
    expect(document.documentElement.getAttribute("data-radius")).toBe(DEFAULT_THEME_PREFS.radius);
  });

  test("a stored preset that no longer exists falls back to medium", () => {
    // `full` was a preset during the pilot of OLDSUI-300 and never shipped, but storage keeps anything.
    store.set(KEY, JSON.stringify({ radius: "full" }));
    run(themeInitScript({ storageKey: KEY }));
    expect(document.documentElement.getAttribute("data-radius")).toBe(DEFAULT_THEME_PREFS.radius);
  });

  test("broken JSON does not break the page", () => {
    store.set(KEY, "{not json");
    expect(() => run(themeInitScript({ storageKey: KEY }))).not.toThrow();
    expect(document.documentElement.getAttribute("data-theme")).toBe(DEFAULT_THEME_PREFS.theme);
  });

  test("a value outside the registry is replaced by the default", () => {
    store.set(KEY, JSON.stringify({ theme: "solarized", brand: "neon" }));
    run(themeInitScript({ storageKey: KEY }));
    expect(document.documentElement.getAttribute("data-theme")).toBe(DEFAULT_THEME_PREFS.theme);
    expect(document.documentElement.hasAttribute("data-brand")).toBe(false);
  });

  /**
   * Regression: `JSON.stringify` escapes quotes but not `<`. A key with `</script>` closed
   * the tag in place, and the rest of the code spilled into the markup as text. The earlier
   * test checked only quotes and gave false confidence.
   */
  test("a key containing </script> does not tear the inline tag", () => {
    const script = themeInitScript({ storageKey: "a</script><script>alert(1)</script>" });
    expect(script).not.toContain("</script>");
    expect(script).toContain("\\u003c");
  });

  test("an escaped key stays working, not merely safe", () => {
    const key = "a</script>b";
    store.set(key, JSON.stringify({ theme: "light" }));
    run(themeInitScript({ storageKey: key }));
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  test("the storage key is escaped, not concatenated", () => {
    // The key comes from the consumer and lands in the TEXT of the code. An unescaped quote
    // would break the script's syntax — silently, in production.
    const nasty = 'a"; alert(1); var b="';
    store.set(nasty, JSON.stringify({ theme: "dim" }));
    run(themeInitScript({ storageKey: nasty }));
    expect(document.documentElement.getAttribute("data-theme")).toBe("dim");
  });
});
