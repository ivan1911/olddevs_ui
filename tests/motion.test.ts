import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, test } from "vitest";

/**
 * Движение кита и `prefers-reduced-motion` — ADR-0043.
 *
 * Почему тест текстовый: по тем же причинам, что и `token-layers.test.ts` —
 * jsdom не разрешает `var()` и не считает каскад, а поднимать ради четырёх
 * инвариантов настоящий браузер дороже, чем они стоят. Живой каскад под обеими
 * системными настройками сторожит `tests-visual/interactions.spec.ts`.
 *
 * Что здесь ломается молча и ради чего тест заведён: токен анимации, добавленный
 * без пары в блоке `reduce`. Он не роняет ни типы, ни линтер, ни снимки —
 * снимки гоняются с `reducedMotion: "reduce"`, но `animations: "disabled"`
 * замораживает анимацию в конечном кадре, и разница между «погашено» и «не
 * погашено» на них не видна вовсе.
 */
const css = readFileSync(resolve(import.meta.dirname, "..", "styles.css"), "utf8");

/** Тело блока по его началу. Скобки считаются: внутри лежат вложенные правила. */
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

/** Пары «токен → значение» — когда важно не имя, а из чего оно собрано. */
const animationValues = (body: string) =>
  new Map(
    [...body.matchAll(/--(animate-[\w-]+)\s*:\s*([^;]+);/g)].map(
      (m) => [m[1] as string, (m[2] as string).trim()] as const
    )
  );

/**
 * Цикл — не переход. `shimmer`, `spin`, `pulse` и `progressIndeterminate`
 * сохраняют литеральный период: подставить туда ступень значило бы сказать, что
 * блик скелетона и появление подсказки — величины одного рода (ADR-0047).
 *
 * Признак формальный намеренно: «это же цикл» человек определяет верно, а тест
 * обязан определять однозначно.
 */
const isCycle = (value: string) => value.includes("infinite");

const THEME = blockBody("@theme");

/** Токены кита: всё, что объявлено в `@theme`. */
const DECLARED = animationTokens(THEME);

/**
 * Шкала движения: ступени длительности и кривые.
 *
 * Объявление ищется по имени с двоеточием, ссылка — по `var()`. Разделять их
 * обязательно: `--default-transition-duration: var(--duration-base)` содержит
 * и то и другое, и жадный поиск посчитал бы ссылку объявлением.
 */
const scaleDecls = (body: string, family: "duration" | "ease") =>
  [...body.matchAll(new RegExp(`(?:^|[\\s;{])--(${family}-[\\w-]+)\\s*:`, "g"))].map(
    (m) => m[1] as string
  );

const scaleRefs = (body: string, family: "duration" | "ease") =>
  [...body.matchAll(new RegExp(`var\\(--(${family}-[\\w-]+)\\)`, "g"))].map((m) => m[1] as string);

/**
 * Обе шкалы закрыты числом, как и белый список исключений: пятая ступень или
 * четвёртая кривая обязаны потребовать разбора в ADR, а не правки этого теста.
 */
const DURATIONS = scaleDecls(THEME, "duration");
const EASES = scaleDecls(THEME, "ease");

/**
 * Переопределения при `reduce`. Ищется `:root` ВНУТРИ медиазапроса, а не первый
 * в файле: первый — это словарь ролей, и спутать их означало бы зелёный тест на
 * пустом месте.
 */
const REDUCE_BLOCK = blockBody("@media (prefers-reduced-motion: reduce)");
const REDUCED = animationTokens(REDUCE_BLOCK);

/**
 * Исключения: движение, которое НЕ гасится, потому что само является
 * сообщением. Обе записи разобраны в ADR-0043.
 *
 * Список закрыт числом. Третья запись обязана потребовать разбора, а не правки
 * этого числа — приём взят у белого списка `i18n-gate` (ADR-0034).
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
    // Ступень — число со временем, кривая — функция. Перепутать их местами
    // легко: обе живут в одном соседстве и обе читаются одним `var()`.
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
     * Литерал внутри токена — это ступень, которой нет в шкале, и найти её
     * можно только прочитав все десять значений подряд. Ровно так и появились
     * 0.14s против 0.16s у подсказки и якорной панели.
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
     * ADR-0043 обещает «та же длительность, та же кривая, только прозрачность».
     * До шкалы обещание держалось на комментарии и на том, что автор аккуратно
     * скопировал число в обе строки; теперь оно проверяется.
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
     * Без этой пары шкала осталась бы половинчатой: `transition-colors` без
     * явного класса длительности продолжал бы идти дефолтные 150ms Tailwind —
     * число, совпадающее со ступенью случайно, а не по ссылке. Потребитель,
     * переопределивший `--duration-base`, не сдвинул бы ни один такой переход.
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
     * Ловит дефект, найденный волной 27: `.skeleton` зашивала
     * `animation: shimmer 1.6s linear infinite` мимо токена, и переопределение
     * `--animate-shimmer` в блоке `reduce` было мёртвым кодом — правило,
     * которое не читает переменную, продолжает бежать.
     *
     * `@keyframes` из проверки исключены: там `animation` не объявляют, а
     * `@theme` объявляет сами токены.
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
    // ADR-0043, п. 2: пакет не вправе гасить анимации страницы, на которой стоит.
    expect(REDUCE_BLOCK).not.toMatch(/!important/);
    expect(
      REDUCE_BLOCK,
      "a `*` selector in the reduce block resets animations the kit does not own"
    ).not.toMatch(/(^|[\s,}])\*\s*[,{]/);
  });
});

/**
 * Темп компонента берётся из шкалы, а не из числа в `className` — ADR-0047.
 *
 * ЧТО ЛОМАЕТСЯ МОЛЧА. `duration-150`, написанное в новом компоненте, не роняет
 * ни типы, ни линтер, ни снимки, и выглядит ровно как соседние шестнадцать,
 * которые эта же волна убрала. Через полгода их снова шестнадцать, и шкала
 * остаётся в `styles.css` сама по себе.
 *
 * Гейт по исходникам, а не по собранному CSS: в сборке утилита `duration-150`
 * неотличима от `duration-base` — обе дают 150ms. Разница вся в намерении,
 * а намерение записано именно в исходнике.
 */
const COMPONENTS = resolve(import.meta.dirname, "..", "src");

/**
 * Запрещено — числовая длительность и задержка, чужие имена кривых и
 * произвольные значения. Разрешено — ступени и кривые шкалы, они проверяются
 * отдельно тем, что объявлены в `@theme`.
 *
 * `transition-[left]` и подобные НЕ запрещены: это выбор свойства, а не темпа.
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

/** Комментарии русские и объясняют в том числе прежние числа — гейт их не смотрит. */
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
