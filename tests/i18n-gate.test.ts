import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { DEFAULT_MESSAGES } from "../src/i18n/defaults.js";
import { messages as ru } from "../src/locales/ru.js";

/**
 * Ворота i18n: две проверки, каждая ловит свою молчаливую поломку.
 *
 * Первая — литерал, добавленный в компонент мимо каталога. Он не роняет ни
 * компилятор, ни линтер, и обнаруживается только когда кто-то переключает язык
 * и видит русское слово посреди английского интерфейса.
 *
 * Вторая — ключ, заведённый в фолбэке и забытый в русской локали. Тип ловит
 * отсутствие ключа, но не ловит пустую строку и не ловит расхождение формы:
 * строка вместо функции читается как `[object Object]` на экране.
 */

const ROOT = resolve(import.meta.dirname, "..");

/**
 * Что сторожим. Волна 23 расширила гейт с одного `src/` на всё, что кит
 * показывает наружу.
 *
 * `docs/` в этот список НЕ входит: у справочника свои ворота ниже («the Reference is
 * English», ADR-0073), потому что `.ts`-обход и правила белого списка ему не подходят.
 *
 * `scripts/` тоже НЕ входит, и это осознанно. `bundle-size.mjs` разбирает
 * `docs/getting-started.md` — русский заголовок раздела и единица «кБ» лежат в
 * нём как ключи сверки, а не как текст. Гейт, вынужденный внести половину
 * `scripts/` в белый список, не сторожил бы ничего; вывод скриптов переведён
 * волной 23 и держится ревью.
 */
const ROOTS = ["src", "tests", "tests-visual", ".storybook"];

/**
 * Белый список — ПЕРЕЧИСЛЕНИЕ С ОБОСНОВАНИЕМ, а не regexp «пропускать
 * кириллицу». Regexp снял бы гейт целиком: он не отличает данные ввода от
 * забытой подписи, то есть разрешал бы ровно то, что ищет.
 */
const ALLOWED = [
  {
    files: ["src/components/content/Keyboard.tsx", "tests/keyboard.test.tsx"],
    why:
      "The layout is input DATA, not a translation. The letter rows say which characters " +
      "the keyboard types; they stay Cyrillic under an English interface because `layout` " +
      "and the interface language are independent. The same holds for the label of the key " +
      "that returns to letters, and for the test that drives that layout end to end.",
  },
  {
    files: ["src/locales/ru.ts"],
    why: "The Russian catalog. Cyrillic here is its content, not a leak from a component.",
  },
  {
    files: [
      "tests/locale-ru.test.tsx",
      "tests/rich-text-editor-table-size-grid.test.tsx",
      "tests/rich-text-editor-table-menu.test.tsx",
      "tests/editor-search.test.tsx",
      "tests-visual/interactions.spec.ts",
    ],
    why:
      "Here a Russian word is the SUBJECT of the check, not the language of writing. " +
      '`[11, "11 dney"]` pins Intl.PluralRules, and the SortableList scenario pins the ' +
      "announcements react-aria localises itself — in English both would be " +
      "indistinguishable from no localisation at all. The table size grid test pins the " +
      "one/few/many forms of `3 stolbca, 5 stolbcov`, which the catalog writes itself. " +
      "The table menu test sorts Russian cell text and Russian number formats: the order " +
      "of `yo` after `e`, not after `ya`, and `1 234,5` read as a number are the check. " +
      "The search test pins whole-word matching in Cyrillic: `\\b` of JS knows only Latin, " +
      "so a Russian word inside a longer one is the case the Unicode boundary exists for.",
  },
];

/**
 * Детектор кириллицы escape-последовательностями, а не литералом.
 *
 * После волны 23 гейт сканирует и `tests/`, то есть самого себя: класс
 * `[а-яА-ЯёЁ]`, записанный буквами, поймал бы эту строку и сделал файл вечно
 * красным. Диапазоны те же — а-я, А-Я и обе ё.
 */
const CYRILLIC = /[\u0430-\u044f\u0410-\u042f\u0451\u0401]/;

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(full));
    // Исключений по имени файла больше нет: волна 23 перевела и витрину, и
    // шаблоны Code Connect (последние заодно удалены, ADR-0037), поэтому
    // истории гейт сторожит наравне с компонентами.
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

/** Комментарии в этом репозитории русские по решению — гейт их не смотрит. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, lead: string) => lead + " ".repeat(m.length - lead.length));
}

describe("no user-visible literals bypass the catalog", () => {
  test("no Cyrillic occurs outside the locale catalog and the allow list", () => {
    const found: string[] = [];
    const allowed = new Set(ALLOWED.flatMap((a) => a.files));
    for (const file of ROOTS.flatMap((root) => sourceFiles(resolve(ROOT, root)))) {
      const rel = relative(ROOT, file).split("\\").join("/");
      if (allowed.has(rel)) continue;
      const lines = stripComments(readFileSync(file, "utf8")).split("\n");
      lines.forEach((line, i) => {
        if (CYRILLIC.test(line)) found.push(`${rel}:${i + 1}: ${line.trim()}`);
      });
    }
    expect(
      found,
      "A user-visible string must go through the message catalog.\n" +
        "Add the key to `src/i18n/messages.ts` and the value to `defaults.ts` and `locales/ru.ts`.\n" +
        found.join("\n")
    ).toEqual([]);
  });

  test("no allow-list entry has outlived its file", () => {
    // Тот же сторож, что у ворот RSC: запись, пережившая файл, молча разрешает
    // то, чего нет, — и следующий файл с таким именем окажется вне проверки.
    // Волна 23 растянула список с двух путей до пяти по четырём корням, и
    // держать его в голове стало нельзя.
    const stale = ALLOWED.flatMap((a) => a.files).filter(
      (file) => !existsSync(resolve(ROOT, file))
    );
    expect(
      stale,
      `An allow-list entry points at a file that no longer exists:\n${stale.join("\n")}`
    ).toEqual([]);
  });

  test("the allow list stays short and explained", () => {
    // Растущий белый список — это гейт, который выключают по одной строке.
    // Потолок считает ПРИЧИНЫ, а не пути: одна причина вправе покрыть два файла,
    // но четвёртая причина — это разбор, а не правка числа.
    expect(ALLOWED.length).toBeLessThanOrEqual(3);
    for (const entry of ALLOWED) expect(entry.why.length).toBeGreaterThan(40);
  });
});

/** Форма значения: строка остаётся строкой, функция — функцией. */
function shapeOf(value: unknown): string {
  if (typeof value === "function") return "function";
  if (value && typeof value === "object") return "object";
  return typeof value;
}

function walk(
  reference: Record<string, unknown>,
  candidate: Record<string, unknown>,
  path: string[],
  problems: string[]
) {
  for (const [key, refValue] of Object.entries(reference)) {
    const here = [...path, key].join(".");
    const value = candidate?.[key];
    if (value === undefined) {
      problems.push(`${here} — key is missing from the locale`);
      continue;
    }
    if (shapeOf(value) !== shapeOf(refValue)) {
      problems.push(`${here} — shape ${shapeOf(value)}, expected ${shapeOf(refValue)}`);
      continue;
    }
    if (shapeOf(refValue) === "object") {
      walk(
        refValue as Record<string, unknown>,
        value as Record<string, unknown>,
        [...path, key],
        problems
      );
    }
    if (typeof value === "string" && value.trim() === "") problems.push(`${here} — empty string`);
  }
}

describe("locale completeness", () => {
  test("the Russian catalog covers every fallback key", () => {
    const problems: string[] = [];
    walk(
      DEFAULT_MESSAGES as unknown as Record<string, unknown>,
      ru as unknown as Record<string, unknown>,
      [],
      problems
    );
    expect(
      problems,
      `The Russian locale diverges from the fallback:\n${problems.join("\n")}`
    ).toEqual([]);
  });

  test("the locale carries no extra keys absent from the fallback", () => {
    // Лишний ключ — это либо опечатка, либо строка, которую компонент никогда
    // не прочитает. И то и другое лучше узнать здесь.
    const extra: string[] = [];
    walk(
      ru as unknown as Record<string, unknown>,
      DEFAULT_MESSAGES as unknown as Record<string, unknown>,
      [],
      extra
    );
    expect(extra.filter((p) => p.endsWith("key is missing from the locale"))).toEqual([]);
  });
});

/**
 * Ворота справочника (ADR-0073, английский Оригинал). Раньше `docs/` был исключён из
 * гейта: справочник был русским по ADR-0034. Теперь Оригинал английский, русский
 * Перевод живёт на сайте, и кириллица в `docs/**` и `README.md` — дефект.
 *
 * Перечень ниже — страницы, где русские строки являются ДАННЫМИ: значения русского
 * каталога сообщений, русский пример ввода, русская подпись в примере кода. Страница
 * без них в список не попадает. Поэтому он проверяется и в обратную сторону: запись
 * для страницы без кириллицы устарела и роняет тест, иначе список только растёт.
 */
const DOCS_ALLOWED_PAGES = new Set([
  "api/editor-extension.md",
  "api/messages.md",
  "api/utilities.md",
  "components/actions/feedback.md",
  "components/actions/split-button.md",
  "components/app-shell/mobile-tab-bar.md",
  "components/app-shell/split-panel.md",
  "components/content/carousel.md",
  "components/content/data-display.md",
  "components/content/empty-and-loading.md",
  "components/content/keyboard.md",
  "components/content/media-card.md",
  "components/content/rich-text-toc.md",
  "components/date-time/time-picker.md",
  "components/inputs/rich-text-editor.md",
  "components/inputs/upload-queue.md",
  "components/navigation/mega-menu.md",
  "components/overlays/command-palette.md",
  "components/overlays/confirm-dialog.md",
  "components/overlays/shortcuts-help.md",
  "conventions.md",
  "i18n.md",
  "theming.md",
]);

/** README.md carries the link to its Translation; that is the only Cyrillic word it may have. */
const README_SWITCHER = /\(README\.ru\.md\)/;

function docsFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? docsFiles(full) : [full];
  });
}

describe("the Reference is English (ADR-0073)", () => {
  const docs = docsFiles(resolve(ROOT, "docs")).map((file) =>
    relative(resolve(ROOT, "docs"), file).split("\\").join("/")
  );

  test("docs/ holds no *.en.md files: one file per page, in English", () => {
    expect(docs.filter((file) => file.endsWith(".en.md"))).toEqual([]);
  });

  test("no Cyrillic in docs/**/*.md outside the pages that quote Russian as data", () => {
    const found = docs
      .filter((file) => file.endsWith(".md") && !DOCS_ALLOWED_PAGES.has(file))
      .filter((file) => CYRILLIC.test(readFileSync(resolve(ROOT, "docs", file), "utf8")));
    expect(
      found,
      "The Reference is written in English; the Russian Translation lives on the site " +
        `(ADR-0073).\n${found.join("\n")}`
    ).toEqual([]);
  });

  test("every allowed page exists and still quotes Russian", () => {
    const stale = [...DOCS_ALLOWED_PAGES].filter(
      (file) =>
        !docs.includes(file) || !CYRILLIC.test(readFileSync(resolve(ROOT, "docs", file), "utf8"))
    );
    expect(stale, `These pages no longer need an allowance:\n${stale.join("\n")}`).toEqual([]);
  });

  test("no Cyrillic in README.md except the link to README.ru.md", () => {
    const found = readFileSync(resolve(ROOT, "README.md"), "utf8")
      .split("\n")
      .map((line, i) => ({ line, number: i + 1 }))
      .filter(({ line }) => CYRILLIC.test(line) && !README_SWITCHER.test(line));
    expect(found.map(({ line, number }) => `README.md:${number}: ${line}`)).toEqual([]);
  });
});
