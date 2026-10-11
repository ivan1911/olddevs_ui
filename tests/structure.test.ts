import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, test } from "vitest";

/**
 * Ворота раскладки исходников (ADR-0060, п. 18).
 *
 * ЗАЧЕМ. Раскладка `src/components/` держится на одном обещании: папка модуля
 * называется так же, как папка его страницы в `docs/components/`. Пока оно
 * выполняется, у справочника и кода одна таксономия, а спор о категории
 * компонента решается переносом страницы и кода вместе. Нарушить его легко и
 * молча: файл, положенный «куда привычнее», собирается, проходит типы и тесты,
 * а справочник и код тихо разъезжаются на две схемы — ровно то, ради чего
 * делался перенос. Так же молча возвращаются корневой список в `components/`,
 * барель в категории (лишний слой реэкспортов и риск циклов, п. 15) и свалка
 * файлов в корне `src/editor/`.
 *
 * Тест обходит файловую систему и не импортирует ни одного модуля кита: он
 * работает в окружении `node`, как прочие ворота, и читает только имена файлов,
 * `src/index.ts`, `src/color.ts` и каталог `docs/components/index.md`.
 *
 * Сообщения говорят, ЧТО сделать, а не «не совпало»: ворота читает автор, у
 * которого красный CI и нет в голове ADR.
 */

const ROOT = resolve(import.meta.dirname, "..");
const SRC = join(ROOT, "src");
const COMPONENTS = join(SRC, "components");
const DOCS = join(ROOT, "docs", "components");
const EDITOR = join(SRC, "editor");

/** Путь относительно корня пакета, с прямыми слэшами. */
function rel(full: string): string {
  return relative(ROOT, full).split("\\").join("/");
}

/** Все файлы под папкой, рекурсивно. Нет папки — нет файлов. */
function filesUnder(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? filesUnder(full) : [full];
  });
}

/** Подпапки папки, имена. */
function dirsIn(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

/**
 * Категории — подпапки справочника, а не список в этом файле. Второй список
 * разъехался бы с первым ровно тем способом, которым ворота и должны ловить
 * расхождение. Новая категория заводится страницей в справочнике, и код сам
 * получает право на папку с тем же именем.
 */
const CATEGORIES = dirsIn(DOCS);

/** Модули компонентов: `components/<категория>/X.ts(x)` без историй. */
const MODULE = /^[^.]+\.tsx?$/;

function categoryModules(): { category: string; name: string; ext: string }[] {
  return CATEGORIES.flatMap((category) => {
    const dir = join(COMPONENTS, category);
    if (!existsSync(dir)) return [];
    return readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && MODULE.test(entry.name))
      .map((entry) => ({
        category,
        name: entry.name.replace(/\.tsx?$/, ""),
        ext: entry.name.replace(/^[^.]+/, ""),
      }));
  });
}

/** Комментарии не должны попадать в разбор экспортов. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

/**
 * Публичные ЗНАЧЕНИЯ, которые пакет отдаёт из модулей `components/`: модуль →
 * имена, под которыми они видны потребителю. Типы пропускаются: каталог, по
 * его же первой строке, перечисляет runtime exports.
 */
function publicExportsByModule(): Map<string, string[]> {
  const byModule = new Map<string, string[]>();
  for (const entry of ["index.ts", "color.ts"]) {
    const source = stripComments(readFileSync(join(SRC, entry), "utf8"));
    for (const match of source.matchAll(/export\s*(type\s*)?\{([^}]*)\}\s*from\s*"([^"]+)"/g)) {
      const [, typeOnly, list, from] = match;
      if (typeOnly) continue;
      const module = /^\.\/components\/([^/]+\/[^/]+?)\.js$/.exec(from!)?.[1];
      if (!module) continue;
      const names = list!
        .split(",")
        .map((item) => item.trim())
        .filter((item) => item && !item.startsWith("type "))
        .map((item) => item.split(/\s+as\s+/).pop()!);
      byModule.set(module, [...(byModule.get(module) ?? []), ...names]);
    }
  }
  return byModule;
}

/**
 * Каталог: имя экспорта → папки страниц, на которые оно указывает. Запись —
 * пункт списка со ссылкой вида `[Dialog](overlays/dialog.md): \`Dialog\``; её
 * продолжение на следующих строках входит в тот же пункт. Ссылки вне
 * `docs/components/<папка>/` (например, на `../api/`) экспортов не закрепляют.
 */
function catalog(): Map<string, { folders: Set<string>; pages: Set<string> }> {
  const source = readFileSync(join(DOCS, "index.md"), "utf8");
  const byName = new Map<string, { folders: Set<string>; pages: Set<string> }>();
  for (const item of source.split(/^- /m).slice(1)) {
    const link = /^\[[^\]]*\]\(([a-z0-9-]+)\/([^/)]+\.md)\)/.exec(item);
    if (!link) continue;
    const [, folder, page] = link;
    for (const [, name] of item.matchAll(/`([A-Za-z_$][\w$]*)`/g)) {
      const entry = byName.get(name!) ?? { folders: new Set(), pages: new Set() };
      entry.folders.add(folder!);
      entry.pages.add(`${folder}/${page}`);
      byName.set(name!, entry);
    }
  }
  return byName;
}

describe("the source tree follows the docs taxonomy (ADR-0060)", () => {
  test("every public component module lives in the folder of its docs page", () => {
    const exportsByModule = publicExportsByModule();
    const entries = catalog();
    const problems: string[] = [];

    for (const { category, name, ext } of categoryModules()) {
      const names = exportsByModule.get(`${category}/${name}`);
      // Внутренний модуль (CheckboxCard, ChoiceCardBody, keyboardEditing): в
      // публичный API он не входит, значит страницы у него нет и быть не должно.
      // Файл, унесённый в чужую папку без правки `src/index.ts`, тоже попадает
      // сюда, но его ловит `npm run typecheck`: импорт перестаёт разрешаться.
      if (!names) continue;

      const file = `src/components/${category}/${name}${ext}`;
      const known = names.filter((exported) => entries.has(exported));

      if (known.length === 0) {
        problems.push(
          `${file}: none of its public exports (${names.join(", ")}) is listed in ` +
            `docs/components/index.md. Add an entry for it to the catalog and write its page ` +
            `in docs/components/${category}/.`
        );
        continue;
      }

      for (const exported of known) {
        const { folders, pages } = entries.get(exported)!;
        if (!folders.has(category)) {
          const home = [...folders][0];
          problems.push(
            `${file}: \`${exported}\` has its page in docs/components/${[...pages].join(", ")}, ` +
              `not in docs/components/${category}/. Move ${name}${ext} to src/components/${home}/ ` +
              `(next to its page), or move the page and the code together.`
          );
        }
        for (const page of pages) {
          if (!existsSync(join(DOCS, page))) {
            problems.push(
              `docs/components/index.md links \`${exported}\` to ${page}, which does not exist. ` +
                `Create the page or fix the link.`
            );
          }
        }
      }
    }

    expect(
      [...new Set(problems)],
      "A component file must sit in src/components/<category>/ where its page " +
        "docs/components/<category>/<page>.md lives (ADR-0060, item 1):\n" +
        [...new Set(problems)].join("\n")
    ).toEqual([]);
  });

  test("src/components holds only the category folders, no loose files", () => {
    const entries = readdirSync(COMPONENTS, { withFileTypes: true });
    const loose = entries.filter((entry) => !entry.isDirectory()).map((entry) => entry.name);
    const extra = entries
      .filter((entry) => entry.isDirectory() && !CATEGORIES.includes(entry.name))
      .map((entry) => entry.name);

    expect(
      loose.map((name) => `src/components/${name}`),
      "The root of src/components holds no files (ADR-0060, item 1). Put each one into the " +
        "folder of its docs page: src/components/<category>/ matches docs/components/<category>/. " +
        `Categories: ${CATEGORIES.join(", ")}.\n` +
        loose.map((name) => `src/components/${name}`).join("\n")
    ).toEqual([]);
    expect(
      extra.map((name) => `src/components/${name}`),
      "There is no docs page folder for this directory, so it is not a category (ADR-0060, " +
        `item 1). Move its files into one of: ${CATEGORIES.join(", ")} — or add the category ` +
        "to docs/components/ together with its pages.\n" +
        extra.map((name) => `src/components/${name}`).join("\n")
    ).toEqual([]);
  });

  test("no barrels inside categories, editor layers and features", () => {
    // Барель — только точка входа пакета: src/index.ts, src/editor/index.ts,
    // src/color.ts, src/icons.ts. Внутри дерева он добавляет слой реэкспортов и
    // риск цикла через сам барель (ADR-0060, п. 15).
    const barrelRoots = [
      COMPONENTS,
      ...["core", "ui", "styles", "hooks", "features"].map((dir) => join(EDITOR, dir)),
    ];
    const barrels = barrelRoots
      .flatMap(filesUnder)
      .filter((file) => /(^|[\\/])index\.tsx?$/.test(file))
      .map(rel);

    expect(
      barrels,
      "Barrels in categories and features are forbidden (ADR-0060, item 15): import the file " +
        "directly, e.g. ../overlays/Dialog.js. Delete the index file and fix the imports:\n" +
        barrels.join("\n")
    ).toEqual([]);
  });

  test("the root of src/editor holds only entry points and the two main components", () => {
    const ALLOWED_FILES = new Set([
      "index.ts",
      "schema-entry.ts",
      "highlight-entry.ts",
      "highlight-grammars.d.ts",
      "RichTextEditor.tsx",
      "RichTextView.tsx",
      "RichTextEditor.stories.tsx",
      "RichTextView.stories.tsx",
      "CodeViewHighlighting.stories.tsx",
    ]);
    const LAYERS = new Set(["core", "ui", "styles", "hooks", "features"]);

    const stray = readdirSync(EDITOR, { withFileTypes: true })
      .filter((entry) =>
        entry.isDirectory() ? !LAYERS.has(entry.name) : !ALLOWED_FILES.has(entry.name)
      )
      .map((entry) => `src/editor/${entry.name}`);

    expect(
      stray,
      "Only entry points, RichTextEditor, RichTextView and their stories stay in the root of " +
        "src/editor. Sort the rest into core/ (engine, schema, tool registry), ui/ (shared " +
        "chrome), styles/ (palette, tokens, classes), hooks/ or features/<feature>/ " +
        "(ADR-0060, items 7-13):\n" +
        stray.join("\n")
    ).toEqual([]);
  });
});
