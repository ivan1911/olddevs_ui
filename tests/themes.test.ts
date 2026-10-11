// @vitest-environment jsdom
//
// Половина файла обходится без DOM (сверка реестра со `styles.css`), но
// `applyTheme` и скрипт раннего применения без него не проверить, а держать
// два файла ради одной прагмы дороже, чем поднять jsdom один раз.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeEach, describe, expect, test, vi } from "vitest";
import {
  applyTheme,
  DEFAULT_THEME_PREFS,
  normalizeAccent,
  normalizeBrand,
  normalizeTheme,
  themeInitScript,
  UI_ACCENTS,
  UI_BRANDS,
  UI_THEMES,
} from "../src/lib/themes.js";

const css = readFileSync(resolve(import.meta.dirname, "..", "styles.css"), "utf8");

/** Значения оси, у которых в CSS есть свой блок. Умолчание блока не имеет. */
const declaredIn = (attr: string) =>
  new Set([...css.matchAll(new RegExp(`\\[${attr}="([\\w-]+)"\\]`, "g"))].map((m) => m[1] ?? ""));

/**
 * Реестр против `styles.css` — ровно тот дефект, ради которого реестр заведён.
 *
 * Проверяется в обе стороны, и это не педантизм. Лишнее значение в реестре —
 * пункт переключателя, который ничего не меняет; недостающее — тема, которая в
 * CSS есть, а через кит недоступна. Обе поломки молчаливые.
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
  });

  test("a valid value passes through as is", () => {
    expect(normalizeTheme("light")).toBe("light");
    expect(normalizeAccent("violet")).toBe("violet");
    expect(normalizeBrand("teal")).toBe("teal");
  });
});

describe("applyTheme", () => {
  let root: HTMLElement;

  beforeEach(() => {
    root = document.createElement("div");
  });

  test("sets all three axes", () => {
    applyTheme(root, { theme: "light", accent: "violet", brand: "teal" });
    expect(root.getAttribute("data-theme")).toBe("light");
    expect(root.getAttribute("data-accent")).toBe("violet");
    expect(root.getAttribute("data-brand")).toBe("teal");
  });

  test("the base brand removes the attribute instead of writing it as a value", () => {
    applyTheme(root, { brand: "teal" });
    applyTheme(root, { brand: "base" });
    expect(root.hasAttribute("data-brand")).toBe(false);
  });

  test("an omitted axis returns to the default instead of keeping the previous value", () => {
    // Иначе бренд остался бы от прошлого экрана, и никто не понял бы почему.
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
 * Скрипт обязан быть ИСПОЛНИМЫМ, а не выглядеть исполнимым: он уезжает к
 * потребителю строкой, и опечатка в нём не ловится ни компилятором, ни линтером.
 */
describe("themeInitScript", () => {
  const KEY = "ui-prefs";

  /**
   * Хранилище подставляется своё, а не берётся у окружения: `localStorage` в
   * jsdom этой версии есть по имени, но без методов `Storage`, и тест падал бы
   * на инфраструктуре, а не на проверяемом коде. Скрипт при этом остаётся
   * ровно тем, что уедет к потребителю, — обращается к голому `localStorage`,
   * как и положено коду в браузере.
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
  });

  test("applies the stored preferences before rendering", () => {
    store.set(KEY, JSON.stringify({ theme: "light", accent: "violet", brand: "teal" }));
    run(themeInitScript({ storageKey: KEY }));
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(document.documentElement.getAttribute("data-accent")).toBe("violet");
    expect(document.documentElement.getAttribute("data-brand")).toBe("teal");
  });

  test("empty storage yields defaults, not a crash", () => {
    run(themeInitScript({ storageKey: KEY }));
    expect(document.documentElement.getAttribute("data-theme")).toBe(DEFAULT_THEME_PREFS.theme);
    expect(document.documentElement.hasAttribute("data-brand")).toBe(false);
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
   * Регрессия: `JSON.stringify` закрывает кавычки, но не `<`. Ключ с
   * `</script>` закрывал тег на месте, и остаток кода вываливался в разметку
   * текстом. Прежний тест проверял только кавычки и давал ложную уверенность.
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
    // Ключ приходит от потребителя и попадает в ТЕКСТ кода. Незакавыченная
    // кавычка сломала бы скрипт синтаксически — молча, на проде.
    const nasty = 'a"; alert(1); var b="';
    store.set(nasty, JSON.stringify({ theme: "dim" }));
    run(themeInitScript({ storageKey: nasty }));
    expect(document.documentElement.getAttribute("data-theme")).toBe("dim");
  });
});
