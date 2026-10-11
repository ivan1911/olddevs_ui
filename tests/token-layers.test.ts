import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

/**
 * Слои токенов: примитивы → семантика → компонентные → бренд.
 *
 * Почему тест текстовый, а не через `getComputedStyle`: jsdom не разрешает
 * `var()` и не считает каскад по подключённой таблице, а поднимать ради четырёх
 * инвариантов настоящий браузер дороже, чем они стоят. Проверяется то, что
 * действительно можно проверить по файлу, — и ровно то, что ломается молча.
 *
 * Живой каскад в браузере сторожит `tests-visual/interactions.spec.ts`.
 */
const css = readFileSync(resolve(import.meta.dirname, "..", "styles.css"), "utf8");

/** Тело блока по селектору. Скобки считаются: внутри лежат вложенные правила. */
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
    // Тени и градиенты — композиции из геометрии и цвета, а не палитра:
    // у них цвет вписан в значение и примитивом не выражается. См. слой 1.
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
    // При равной специфичности побеждает тот, кто ниже. Переставь блоки — и
    // заданный бренд перестанет отменять ось акцента, причём молча.
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
        if (token.startsWith("od-")) continue; // свои примитивы бренда
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
  Токен, ссылающийся на самого себя (`--font-mono: var(--font-mono), …`),
  по спецификации CSS недействителен целиком: значение пустое, а Tailwind-класс
  на нём молча откатывается к унаследованному. Так `font-mono` во всём ките
  годами рисовался Inter. Сторож ловит любую такую ссылку, а не одну эту.
*/
test("no custom property refers only to itself", () => {
  const decls = [...css.matchAll(/(--[\w-]+)\s*:\s*([^;{}]*);/g)].map(([, name, value]) => ({
    name: name!,
    self: new RegExp(`var\\(\\s*${name}\\s*[,)]`).test(value!),
  }));
  // Мост `@theme` вида `--shadow-1: var(--shadow-1)` законен, пока у токена есть
  // настоящее объявление в теме: оно позже в каскаде и перебивает цикл. Ошибка —
  // токен, у которого ВСЕ объявления ссылаются на него самого.
  const onlySelf = [...new Set(decls.filter((d) => d.self).map((d) => d.name))].filter((name) =>
    decls.filter((d) => d.name === name).every((d) => d.self)
  );

  expect(onlySelf).toEqual([]);
});

/*
  Переменная, которую кит сам не объявляет (`--font-inter`, `--font-code`),
  ставится потребителем — или не ставится вовсе. Ссылка на неё без запасного
  значения делает недействительным весь токен: `--font-sans: var(--font-inter), …`
  без `--font-inter` пуст, и `font-sans` молча наследует шрифт предка — в `Kbd`
  и шапке блока кода это моноширинный (OLDSUI-117). Запасное значение у такой
  ссылки обязательно.
*/
test("a token never reads a variable the kit leaves undeclared without a fallback", () => {
  // Комментарии вырезаются: в них `var(--x)` — пример, а не ссылка.
  const code = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const tokens = [...code.matchAll(/(--[\w-]+)\s*:\s*([^;{}]*);/g)];
  const declared = new Set(tokens.map(([, name]) => name!));
  // Только значения токенов: переменную, которую ставит инлайн-стиль компонента
  // (`height: var(--row-exit-h)`), обычное свойство читает законно.
  const bare = tokens.flatMap(([, , value]) =>
    [...value!.matchAll(/var\(\s*(--[\w-]+)\s*\)/g)]
      .map(([, name]) => name!)
      .filter((name) => !declared.has(name))
  );

  expect([...new Set(bare)]).toEqual([]);
});
