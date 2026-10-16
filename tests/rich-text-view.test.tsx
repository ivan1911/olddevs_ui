// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { createRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeAll, expect, test } from "vitest";
import {
  RichTextEditor,
  RichTextView,
  richTextSanitizeConfig,
  type RichTextEditorHandle,
} from "../src/editor/index.js";
import { PROSE_CLASS } from "../src/editor/styles/prose.js";
import { RICH_TEXT_SCHEMA } from "../src/editor/core/schema.js";
import { loadLazyBuiltins } from "./editor-lazy-builtins.js";

// Ленивые `codeBlock` и `table` (OLDSUI-111): `full` готов в `render` после загрузки чанков.
beforeAll(loadLazyBuiltins);

afterEach(cleanup);

/**
 * `RichTextView` — показ сохранённого Документа без движка (спека, «RichTextView»).
 * Обещание одно: текст на странице выглядит так же, как в Редакторе. Поэтому
 * сверяются не классы «вообще», а те самые, что Редактор вешает на содержимое.
 */

const DOCUMENT =
  "<h2>Release notes</h2><p>Text with <strong>bold</strong> and <code>code</code>.</p>" +
  '<ul><li><p>One</p></li></ul><ol start="3"><li><p>Three</p></li></ol>' +
  "<blockquote><p>Quote</p></blockquote><hr>";

/** Классы контейнера как множество: порядок и склейка `cn` не важны. */
function classesOf(element: Element): Set<string> {
  return new Set(element.className.split(/\s+/).filter(Boolean));
}

const PROSE_TOKENS = PROSE_CLASS.split(/\s+/).filter(Boolean);

test("renders the saved html inside a container", () => {
  render(<RichTextView html={DOCUMENT} data-testid="view" />);
  const view = screen.getByTestId("view");

  expect(view.querySelector("h2")?.textContent).toBe("Release notes");
  expect(view.querySelector("strong")?.textContent).toBe("bold");
  expect(view.querySelector("ol")?.getAttribute("start")).toBe("3");
  expect(view.querySelector("blockquote p")?.textContent).toBe("Quote");
  expect(view.querySelector("hr")).not.toBeNull();
});

test("an empty document renders an empty container", () => {
  render(<RichTextView html="" data-testid="view" />);
  expect(screen.getByTestId("view").innerHTML).toBe("");
});

test("wears the same prose classes as the editor content", () => {
  const ref = createRef<RichTextEditorHandle>();
  render(<RichTextEditor ref={ref} aria-label="Body" defaultValue={DOCUMENT} />);
  const content = ref.current!.editor!.view.dom;
  render(<RichTextView html={DOCUMENT} data-testid="view" />);
  const view = screen.getByTestId("view");

  const missingInView = PROSE_TOKENS.filter((token) => !classesOf(view).has(token));
  const missingInEditor = PROSE_TOKENS.filter((token) => !classesOf(content).has(token));
  expect(missingInView).toEqual([]);
  expect(missingInEditor).toEqual([]);
});

/*
  Значение атрибута без кавычек обязано быть CSS-идентификатором, а тот не
  начинается с цифры: `[data-width=50]` — невалидный селектор. Браузер такое
  правило отбрасывает, а оптимизатор Tailwind собирает из него `figure:has()` —
  пресеты ширины картинки так и не работали, пока значения не взяли в кавычки.
*/
test("prose selectors quote attribute values that are not identifiers", () => {
  const unquoted = PROSE_TOKENS.filter((token) => /\[[\w-]+[~|^$*]?=-?\d/.test(token));
  expect(unquoted).toEqual([]);
  expect(PROSE_TOKENS).toContain("[&_figure:has(img[data-width='50'])]:w-1/2");
});

/*
  Tailwind читает исходник как текст. Класс, разорванный склейкой строк, у него
  распадается на два неполных — скобки в них не сходятся, и правила нет. А `\_`
  (подчёркивание в произвольном варианте) попадает в имя класса с обратной
  косой и не совпадает с классом в разметке: так ломалась бы тема подсветки
  (`hljs-built_in`, OLDSUI-50).
*/
test("every prose class is whole: brackets balance and no backslash escapes", () => {
  const count = (token: string, char: string) => token.split(char).length - 1;
  expect(PROSE_TOKENS.filter((token) => count(token, "[") !== count(token, "]"))).toEqual([]);
  expect(PROSE_TOKENS.filter((token) => count(token, "(") !== count(token, ")"))).toEqual([]);
  expect(PROSE_TOKENS.filter((token) => token.includes("\\"))).toEqual([]);
});

/*
  Тема подсветки (OLDSUI-50, ADR-0051) — две половины. Правила `.hljs-*` —
  классами на контейнере, и читают они только переменные: подсвеченный HTML из
  `highlightCodeBlocks` раскрашен в `RichTextView` без единого `style`. Цвета —
  переменные в `styles.css` на элементах с `data-theme`: Документ наследует их от
  БЛИЖАЙШЕГО предка с темой, поэтому вложенная светлая «бумага» внутри тёмного
  приложения получает GitHub Light. Значение темы на самом контейнере перебило
  бы наследование — его здесь быть не должно. Живой каскад вложенной темы
  проверяет `tests-visual/interactions.spec.ts` («code theme»).
*/
const STYLES = readFileSync(resolve(import.meta.dirname, "..", "styles.css"), "utf8");
const HL_VARIABLES = [
  "--rte-code-block-background",
  "--rte-code-block-foreground",
  "--rte-hl-keyword",
  "--rte-hl-title",
  "--rte-hl-constant",
  "--rte-hl-string",
  "--rte-hl-variable",
  "--rte-hl-comment",
  "--rte-hl-tag",
  "--rte-hl-bullet",
];

/** Объявления переменных в блоке `styles.css` с этим селектором. */
function variablesOf(selector: string): Record<string, string> {
  const at = STYLES.indexOf(`${selector} {`);
  expect(at, `styles.css has no block ${selector}`).toBeGreaterThan(-1);
  const body = STYLES.slice(STYLES.indexOf("{", at) + 1, STYLES.indexOf("}", at));
  return Object.fromEntries(
    [...body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1]!, m[2]!.trim()])
  );
}

test("the view carries the highlighting rules, and they read only theme variables", () => {
  expect(PROSE_TOKENS).toContain("[&_.hljs-title]:text-(--rte-hl-title)");
  expect(PROSE_TOKENS).toContain("[&_pre]:bg-(--rte-code-block-background)");
  // Ни одна переменная темы не задаётся на контейнере — иначе она перебила бы
  // значение, унаследованное от ближайшего `data-theme`.
  expect(
    PROSE_TOKENS.filter((token) => HL_VARIABLES.some((name) => token.includes(`${name}:`)))
  ).toEqual([]);
});

test("styles.css sets the highlighting variables on themed elements, light after dark", () => {
  const dark = variablesOf(':where(:root, [data-theme]:not([data-theme="light"]))');
  const light = variablesOf(':where([data-theme="light"])');

  expect(Object.keys(dark).sort()).toEqual([...HL_VARIABLES].sort());
  expect(Object.keys(light).sort()).toEqual([...HL_VARIABLES].sort());
  // GitHub Dark и GitHub Light — сверка по известным значениям тем.
  expect(dark["--rte-hl-keyword"]).toBe("#ff7b72");
  expect(light["--rte-hl-keyword"]).toBe("#d73a49");
  expect(light["--rte-code-block-background"]).toBe("#ffffff");
  // На `<html data-theme="light">` совпадают оба блока с нулевой специфичностью:
  // светлый обязан стоять ниже, иначе светлая тема получила бы тёмные токены.
  expect(STYLES.indexOf(':where([data-theme="light"]) {')).toBeGreaterThan(
    STYLES.indexOf(':where(:root, [data-theme]:not([data-theme="light"])) {')
  );
});

test("className is merged after the prose classes, other div props pass through", () => {
  render(
    <RichTextView
      html="<p>Text</p>"
      className="max-w-prose"
      id="body"
      aria-label="Article"
      data-testid="view"
    />
  );
  const view = screen.getByTestId("view");

  expect(classesOf(view).has("max-w-prose")).toBe(true);
  expect(PROSE_TOKENS.every((token) => classesOf(view).has(token))).toBe(true);
  expect(view.id).toBe("body");
  expect(view.getAttribute("aria-label")).toBe("Article");
});

test("forwards the ref to the container", () => {
  const ref = createRef<HTMLDivElement>();
  render(<RichTextView ref={ref} html="<p>Text</p>" />);
  expect(ref.current?.querySelector("p")?.textContent).toBe("Text");
});

/*
  Серверная безопасность — два взгляда на одно обещание. Первый: компонент
  рендерится без DOM и эффектов, как в серверном компоненте. Второй: в графе
  его модулей нет ни директивы, ни движка. Директивы одним первым взглядом
  `rsc-gate` не покрыть — тот смотрит файлы, а не то, что файл тянет за собой.
*/

test("renders to a string without a DOM, as a server component does", () => {
  const markup = renderToStaticMarkup(<RichTextView html="<p>Server text</p>" className="x" />);

  expect(markup).toContain("<p>Server text</p>");
  expect(markup).toContain("x");
  expect(markup).toContain("[&amp;&gt;*:not(:last-child)]:mb-3");
});

const SRC = resolve(import.meta.dirname, "..", "src");

/** Подключения модуля: `from "…"` и `import "…"`; типовые импорты не в счёт. */
function specifiers(source: string): string[] {
  const found: string[] = [];
  for (const match of source.matchAll(
    /^\s*(?:import|export)\s+(type\s+)?[^"']*?from\s+["']([^"']+)["']/gm
  )) {
    if (!match[1]) found.push(match[2]!);
  }
  for (const match of source.matchAll(/^\s*import\s+["']([^"']+)["']/gm)) found.push(match[1]!);
  return found;
}

/** Все модули кита, до которых доходит `entry` по относительным импортам. */
function moduleGraph(entry: string): { files: string[]; packages: Set<string> } {
  const files: string[] = [];
  const packages = new Set<string>();
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.pop()!;
    if (files.includes(file)) continue;
    files.push(file);
    for (const specifier of specifiers(readFileSync(file, "utf8"))) {
      if (specifier.startsWith(".")) {
        const target = resolve(dirname(file), specifier).replace(/\.js$/, "");
        queue.push(
          [".ts", ".tsx"].map((extension) => target + extension).find((path) => exists(path))!
        );
      } else packages.add(specifier);
    }
  }
  return { files, packages };
}

function exists(path: string): boolean {
  try {
    readFileSync(path);
    return true;
  } catch {
    return false;
  }
}

/*
  Граница клиента в графе просмотра — ровно один файл, остров кнопки «Копировать»
  (OLDSUI-50, ADR-0029). Всё, что он тянет за собой, — кнопка и подсказка кита и
  их зависимости; движок и подсветчик сюда попасть не должны.
*/
const ISLAND = join(SRC, "editor", "features", "code", "CodeCopyIsland.tsx");

test("the module graph of RichTextView has client islands and no engine", () => {
  const { files, packages } = moduleGraph(join(SRC, "editor", "RichTextView.tsx"));

  const clientFiles = files.filter((file) =>
    readFileSync(file, "utf8").trimStart().startsWith('"use client"')
  );
  // Сам просмотр — не граница клиента; граница — остров и то, что он тянет:
  // файлы кита, каждый со своей директивой.
  expect(clientFiles).toContain(ISLAND);
  // Второй остров — своих Блоков (OLDSUI-114): тоже свой файл с директивой.
  expect(clientFiles).toContain(join(SRC, "editor", "ui", "BlockIsland.tsx"));
  expect(clientFiles).not.toContain(join(SRC, "editor", "RichTextView.tsx"));
  expect(
    readFileSync(join(SRC, "editor", "RichTextView.tsx"), "utf8")
      .trimStart()
      .startsWith('"use')
  ).toBe(false);
  // Те же директивы, что у острова, но у файлов самого кита, а не у серверного
  // кода просмотра: серверная часть графа — `RichTextView`, `codeHeader`,
  // `codeLanguages`, `prose` и данные, без директив.
  const serverFiles = files.filter((file) => !clientFiles.includes(file));
  expect(
    serverFiles.map((file) => file.slice(SRC.length + 1)).filter((f) => f.startsWith("editor/"))
  ).toEqual(
    expect.arrayContaining([
      "editor/RichTextView.tsx",
      "editor/features/code/codeHeader.ts",
      "editor/styles/prose.ts",
      "editor/core/viewIsland.ts",
    ])
  );
  // Белый список, а не «нет @tiptap»: новая зависимость view-модуля — решение,
  // а не случайность, и тест должен заставить его принять.
  // Остров приносит кнопку и подсказку кита: Radix (слот и подсказка), иконки,
  // `react-dom` для портала и `react-aria-components` ради `useLocale` в
  // каталоге сообщений — тем же путём, что у любого компонента кита.
  expect([...packages].sort()).toEqual([
    "@radix-ui/react-slot",
    "@radix-ui/react-tooltip",
    "clsx",
    "lucide-react",
    "react",
    "react-aria-components",
    "react-dom",
    "tailwind-merge",
  ]);
  expect(packages.has("lowlight")).toBe(false);
  expect([...packages].filter((name) => /^@tiptap\/|highlight\.js|lowlight/.test(name))).toEqual(
    []
  );
});

/*
  Конфиг для DOMPurify — данные из Схемы, не вторая копия, и ЗАКРЫТЫЙ по
  умолчанию: голый конфиг без хуков не знает атрибутов, которые опасны без
  проверки по тегу и значению. Здесь проверяется его форма; очистка настоящим
  DOMPurify — вместе с хуками `sanitizeRichText` и без них — в
  `tests/editor-sanitize.test.tsx`.
*/

test("the bare sanitise config lists the schema minus what only hooks may admit", () => {
  const config = richTextSanitizeConfig();
  const schemaTags = [...RICH_TEXT_SCHEMA.blocks, ...RICH_TEXT_SCHEMA.marks];

  // `input` без `type` — текстовое поле, `img` без `src` — битая картинка.
  expect([...config.ALLOWED_TAGS].sort()).toEqual(
    schemaTags.filter((tag) => tag !== "input" && tag !== "img").sort()
  );
  // Безвредное на любом теге и с любым значением; `href` сверяет выражение адреса.
  expect([...config.ALLOWED_ATTR].sort()).toEqual([
    "alt",
    "data-align",
    "data-block",
    "data-checked",
    "data-color",
    "data-latex",
    "data-layout",
    "data-tone",
    "data-type",
    "data-width",
    "href",
    "open",
    "rel",
    "start",
  ]);
});

test("the sanitise config closes the attribute families DOMPurify opens by default", () => {
  const config = richTextSanitizeConfig();

  expect(config.ALLOW_DATA_ATTR).toBe(false);
  expect(config.ALLOW_ARIA_ATTR).toBe(false);
  // `style` — узкое исключение для произвольного цвета (OLDSUI-46): в Схеме он
  // назван ровно у `span` и `mark`, а в общий список конфига не попадает —
  // его пускает только хук `sanitizeRichText`, сверив тег и значение. Так же
  // `class`, `src`, слияние ячеек и атрибуты флажка.
  for (const guarded of ["style", "class", "src", "colspan", "rowspan", "type", "checked"]) {
    expect(config.ALLOWED_ATTR, guarded).not.toContain(guarded);
  }
  expect(
    Object.keys(RICH_TEXT_SCHEMA.attributes).filter((tag) =>
      (RICH_TEXT_SCHEMA.attributes as Record<string, readonly string[]>)[tag]!.includes("style")
    )
  ).toEqual(["span", "mark"]);
  // `ALLOWED_ATTR` у DOMPurify общий на все теги, а `ALLOW_DATA_ATTR` выключен:
  // из `data-*` проходят только имена Схемы, названные поимённо.
  expect(config.ALLOWED_ATTR.filter((name) => name.startsWith("data-")).sort()).toEqual([
    "data-align",
    "data-block",
    "data-checked",
    "data-color",
    "data-latex",
    "data-layout",
    "data-tone",
    "data-type",
    "data-width",
  ]);
  expect(config.ALLOWED_ATTR.filter((name) => name.startsWith("aria-"))).toEqual([]);
});

/*
  Адрес ссылки — та же политика, что в Редакторе: только `http`, `https` и
  `mailto`. DOMPurify сверяет с `ALLOWED_URI_REGEXP` КАЖДЫЙ разрешённый атрибут,
  кроме «безопасных для URI», поэтому строгое выражение без `ADD_URI_SAFE_ATTR`
  срезало бы и `start="3"`, и `data-type="taskList"`. Безопасными объявлены все
  атрибуты Схемы, кроме `href`, — проверку адреса проходит ровно он.
*/
test("the sanitise config admits link addresses by the editor's protocol policy", () => {
  const { ALLOWED_URI_REGEXP: uri } = richTextSanitizeConfig();

  for (const href of [
    "https://example.com/a?b=1",
    "http://example.com",
    "mailto:team@example.com",
  ]) {
    expect(uri.test(href), href).toBe(true);
  }
  for (const href of [
    "javascript:alert(1)",
    "data:text/html,x",
    "ftp://example.com",
    "/docs",
    "#top",
    "docs/page",
  ]) {
    expect(uri.test(href), href).toBe(false);
  }
});

test("the schema declares the style exception precisely: one property and one hex pattern per tag", () => {
  const { customColor } = RICH_TEXT_SCHEMA;

  expect(Object.keys(customColor.styles).sort()).toEqual(["mark", "span"]);
  const span = new RegExp(customColor.styles.span);
  const mark = new RegExp(customColor.styles.mark);
  for (const ok of ["color:#ff0000", "color:#0a1B2c".toLowerCase()])
    expect(span.test(ok)).toBe(true);
  expect(mark.test("background-color:#ffee00")).toBe(true);
  for (const bad of [
    "color:#fff",
    "color:#FF0000",
    "color: #ff0000",
    "color:#ff0000;",
    "color:#ff0000;x:y",
    "color:red",
    "background-color:#ff0000",
    "x-color:#ff0000",
  ]) {
    expect(span.test(bad), bad).toBe(false);
  }
  expect(mark.test("color:#ffee00")).toBe(false);
  expect(mark.test("background-color:#ffee0")).toBe(false);
});

test("only href is checked as an address; every other attribute of the bare config is URI-safe", () => {
  const config = richTextSanitizeConfig();

  expect([...config.ADD_URI_SAFE_ATTR].sort()).toEqual(
    config.ALLOWED_ATTR.filter((name) => name !== "href").sort()
  );
  expect(config.ALLOWED_ATTR).toContain("href");
  // `src` у картинки — только с хуком: `data:` DOMPurify пускает в обход выражения.
  expect(config.ALLOWED_ATTR).not.toContain("src");
});

test("every call returns fresh arrays the caller may mutate", () => {
  const first = richTextSanitizeConfig();
  first.ALLOWED_TAGS.push("script");
  first.ALLOWED_ATTR.push("onclick");

  expect(richTextSanitizeConfig().ALLOWED_TAGS).not.toContain("script");
  expect(richTextSanitizeConfig().ALLOWED_ATTR).not.toContain("onclick");
});

/*
  Таблица Схемы в документации ⇔ `RICH_TEXT_SCHEMA`, в обе стороны. Срезы эпика
  будут расширять Схему, и таблица, не поспевающая за ней, стала бы плохим
  конфигом для санитайзера: человек списывает разрешённое со страницы.
*/

/** Маркер в странице: таблица сразу за ним — белый список, остальные таблицы не в счёт. */
const MARKER = "<!-- allow-list -->";
const DOCS = resolve(import.meta.dirname, "..", "docs", "components");

/** Токены в обратных кавычках из строк таблицы после маркера `<!-- allow-list -->`. */
function documentedAllowList(page: string): Set<string> {
  const text = readFileSync(join(DOCS, page), "utf8");
  const start = text.indexOf(MARKER);
  expect(start, `${page}: no ${MARKER} marker`).toBeGreaterThan(-1);
  const rows = text
    .slice(start)
    .split("\n")
    .filter((line) => line.startsWith("|"))
    // Заголовок и разделитель таблицы — не данные; таблица одна, дальше идёт проза.
    .slice(2);
  const tokens = new Set<string>();
  for (const row of rows) {
    // Первая ячейка — название строки («Блоки»), в ней тегов нет.
    const cells = row.split("|").slice(2);
    for (const match of cells.join("|").matchAll(/`([^`]+)`/g)) tokens.add(match[1]!);
  }
  return tokens;
}

const SCHEMA_TOKENS = new Set<string>([
  ...RICH_TEXT_SCHEMA.blocks,
  ...RICH_TEXT_SCHEMA.marks,
  ...Object.entries(RICH_TEXT_SCHEMA.attributes).flatMap(([tag, names]) =>
    names.map((name) => `${tag}[${name}]`)
  ),
]);

for (const page of ["content/rich-text-view.md", "inputs/rich-text-editor.md"]) {
  test(`${page}: the allow-list table mirrors schema.ts`, () => {
    const documented = documentedAllowList(page);

    expect([...SCHEMA_TOKENS].filter((token) => !documented.has(token))).toEqual([]);
    expect([...documented].filter((token) => !SCHEMA_TOKENS.has(token))).toEqual([]);
  });
}
