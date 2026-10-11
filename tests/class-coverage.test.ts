import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, expect, test } from "vitest";
import {
  GLASS_INVERSE_CLASS,
  GLASS_MENU_CLASS,
  GLASS_PANEL_CLASS,
} from "../src/editor/styles/glass.js";
import { renderMatrix } from "./matrix.js";

/**
 * Проверяет, что КАЖДЫЙ класс, который примитивы реально выдают в разметку,
 * присутствует в собранном Tailwind CSS.
 *
 * Зачем: Tailwind сканирует исходники как текст и не исполняет код. Класс,
 * собранный конкатенацией (`hover:${t.bg}`), сканер не увидит — он не попадёт
 * в CSS, и при этом **сборка пройдёт успешно, без единого предупреждения**.
 * Компонент просто окажется без стилей. Ни компилятор, ни линтер этого не ловят.
 *
 * Ключевая деталь: `@source` здесь указывает на ИСХОДНИКИ пакета, а не на
 * отрендеренную разметку. Если бы сканировалась разметка, тест находил бы там
 * же, откуда взял список, и проходил бы всегда — не доказывая ничего.
 */

const ROOT = resolve(import.meta.dirname, "..");

// Временная папка обязана лежать ВНУТРИ пакета: Tailwind резолвит
// `@import "tailwindcss"` относительно входного файла, а в системном tmp
// никакого node_modules нет.
const tmp = mkdtempSync(join(ROOT, ".tmp-coverage-"));

afterAll(() => rmSync(tmp, { recursive: true, force: true }));

/**
 * Обратная задача экранированию: убираем из CSS обратные слэши и ищем класс
 * как он написан в разметке.
 *
 * Раньше здесь был список экранируемых символов, и он оказался неполным:
 * Tailwind пишет `.transition-\[border-color\,box-shadow\]`, а запятой в списке
 * не было — класс объявлялся пропавшим, хотя лежал в CSS. Ловить полный
 * перечень спецсимволов вручную бессмысленно: он растёт с каждым новым
 * произвольным значением. Снять экранирование один раз надёжнее, чем повторить
 * его правила.
 */
const unescapeCss = (css: string) => css.replace(/\\/g, "");

function buildCss(): string {
  const input = join(tmp, "input.css");
  const output = join(tmp, "output.css");
  writeFileSync(
    input,
    [
      // `source(none)` обязателен. Без него Tailwind сам добавляет в источники
      // папку входного файла — то есть весь пакет, включая `storybook-static/`
      // и `dist/`. В них лежит РАНЕЕ собранный CSS, и класс, только что
      // пропавший из исходников, находится там: проверка молча зеленеет.
      // Проверено: с подложенной конкатенацией `bg-accent${"-soft"}` тест
      // проходил, хотя `.bg-accent-soft` в свежем CSS отсутствовал.
      '@import "tailwindcss" source(none);',
      `@import "${join(ROOT, "styles.css")}";`,
      `@source "${join(ROOT, "src")}";`,
      "",
    ].join("\n")
  );
  execFileSync("npx", ["@tailwindcss/cli", "-i", input, "-o", output], {
    cwd: ROOT,
    stdio: "pipe",
  });
  return readFileSync(output, "utf8");
}

/** Сборка CSS — секунды; оба теста читают один результат. */
let css: string | undefined;
const builtCss = () => (css ??= unescapeCss(buildCss()));

/** Классы, которых в CSS нет. */
function missingFrom(css: string, classes: Iterable<string>): string[] {
  // После селектора обязан идти разделитель, иначе `.bg-bg-1` совпадёт
  // с началом `.bg-bg-10` и тест пропустит настоящую пропажу.
  //
  // `[` в списке — из-за вариантов `data-[…]:`, которые пришли с датапикерами:
  // Tailwind дописывает к такому классу сам атрибут, и селектор выглядит как
  // `.data-[selected]:bg-accent[data-selected]`. Без квадратной скобки среди
  // разделителей каждый такой класс объявлялся бы пропавшим, хотя он в CSS есть.
  const BOUNDARY = [" ", ",", ":", ">", "+", "~", "\n", "{", "["];
  return [...classes].filter((c) => {
    const sel = "." + c;
    let from = 0;
    for (;;) {
      const i = css.indexOf(sel, from);
      if (i < 0) return true;
      if (BOUNDARY.includes(css[i + sel.length] ?? "")) return false;
      from = i + 1;
    }
  });
}

test("every class from primitive markup is present in the built CSS", () => {
  const html = renderToStaticMarkup(renderMatrix());

  // Разметка приходит с HTML-экранированием: класс `after:content-['']`
  // выглядит в ней как `after:content-[&#x27;&#x27;]` и не совпал бы с CSS.
  // Обратная замена нужна для любого произвольного значения с кавычками.
  const unescapeHtml = (s: string) =>
    s
      .replace(/&#x27;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&");

  /**
   * Классы, которые ставит не Tailwind, а сторонний компонент, и которых в нашем
   * CSS быть НЕ должно. lucide вешает на каждую свою `<svg>` пару
   * `lucide lucide-<имя>` — это её собственные хуки для стилизации на стороне
   * потребителя, а не утилиты Tailwind. Без этого исключения тест ловил бы их
   * как «пропавшие» и падал бы на любом компоненте с иконкой.
   *
   * Исключение намеренно узкое — по конкретному префиксу, а не «игнорировать
   * незнакомое»: смысл теста в том, чтобы незнакомое как раз ронять.
   */
  const isThirdParty = (c: string) =>
    c === "lucide" ||
    c.startsWith("lucide-") ||
    // `react-aria-components` вешает на свои элементы `react-aria-CalendarGrid`
    // и подобные — те же собственные хуки для стилизации, что у lucide.
    c.startsWith("react-aria-") ||
    /*
      `group` и `peer` — МАРКЕРЫ Tailwind, а не утилиты: своего правила они не
      порождают вовсе, а только дают якорь вариантам `group-hover:` и
      `peer-checked:`. В CSS их поэтому нет и быть не должно.

      Исключение узкое — ровно два имени, без префиксов: именованные варианты
      (`group/item`) сюда не попадают и продолжают проверяться.
    */
    c === "group" ||
    c === "peer";

  const classes = new Set<string>();
  for (const m of html.matchAll(/class="([^"]+)"/g))
    for (const c of unescapeHtml(m[1] ?? "").split(/\s+/))
      if (c && !isThirdParty(c)) classes.add(c);

  expect(classes.size).toBeGreaterThan(50); // защита от «матрица отрендерилась пустой»

  const missing = missingFrom(builtCss(), classes);

  expect(
    missing,
    `Classes present in the markup but missing from the CSS:\n${missing.join("\n")}`
  ).toEqual([]);
});

/**
 * Стекло Редактора (OLDSUI-118) в матрицу не входит: Редактор — отдельная
 * точка входа. А поймано на нём ровно то, ради чего тест заведён: подложка,
 * собранная шаблонной строкой из имени токена, в CSS не попала, и меню
 * осталось с одним размытием на прозрачном фоне.
 */
test("every class of the editor glass surfaces is present in the built CSS", () => {
  const classes = [GLASS_PANEL_CLASS, GLASS_MENU_CLASS, GLASS_INVERSE_CLASS].flatMap((surface) =>
    surface.split(/\s+/)
  );
  const missing = missingFrom(builtCss(), new Set(classes));

  expect(missing, `Glass classes missing from the CSS:\n${missing.join("\n")}`).toEqual([]);
});
