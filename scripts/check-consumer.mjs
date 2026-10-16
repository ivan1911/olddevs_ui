/**
 * Сборка приложения-потребителя: доказательство, что пакет годен снаружи.
 *
 * ЧТО ИМЕННО ЗДЕСЬ ПРОВЕРЯЕТСЯ И ЧЕГО НЕ ВИДЯТ ОСТАЛЬНЫЕ ВОРОТА.
 *
 * `npm test` и `npm run build` смотрят на пакет изнутри: там весь код
 * клиентский, резолвинг идёт по путям репозитория, а Tailwind сканирует
 * исходники. Ни одна из этих проверок не может увидеть, что у потребителя
 * компонент не импортируется в серверный файл, что `exports` закрыл нужный
 * путь или что классы не доехали до CSS.
 *
 * ПОЧЕМУ ТАРБОЛ, А НЕ АЛИАС НА `src`. Алиас проверял бы исходники, то есть не
 * то, что уезжает в реестр: он не заметит ни забытого файла в `files`, ни
 * закрытого `exports`, ни потерянной при сборке директивы. Гейт, который
 * зелёный независимо от содержимого пакета, — это гейт, который проходит
 * всегда. Поэтому: `npm pack`, установка `.tgz`, сборка.
 *
 * Пакет ставится с `--no-save`: `package.json` фикстуры о ките не знает вовсе,
 * поэтому её lock-файл не переписывается на каждый выпуск и кеш CI остаётся
 * пригодным. Peer-зависимости кита фикстура объявляет сама — ровно как
 * настоящий потребитель.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { BUDGETS } from "./bundle-size.budgets.mjs";
import { EDITOR_ENGINE } from "./editor-engine.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const FIXTURE = join(ROOT, "fixtures", "consumer");
const TARBALL = join(FIXTURE, "olddevs-ui.tgz");

/**
 * Классы-пробы для итогового CSS.
 *
 * Взяты из `lib/button.ts`: их нет в разметке самой фикстуры, поэтому попасть в
 * CSS они могут только через `@source` на `dist` пакета. `rounded-control` вдобавок
 * определён в `styles.css` кита — то есть проба заодно доказывает, что
 * `@import "@olddevs/ui/styles.css"` сработал.
 */
const CSS_PROBES = ["rounded-control", "outline-accent-strong"];

function step(name) {
  console.log(`\n→ ${name}`);
}

function run(command, args, cwd) {
  execFileSync(command, args, { cwd, stdio: "inherit" });
}

/** То же самое, но с перехватом вывода: из него читается таблица маршрутов. */
function runCaptured(command, args, cwd) {
  const output = execFileSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: ["inherit", "pipe", "inherit"],
  });
  process.stdout.write(output);
  return output;
}

/**
 * `First Load JS` маршрута из таблицы `next build`.
 *
 * Разбор вывода — способ хрупкий, и потому он обязан ПАДАТЬ, когда формат
 * изменится: молча вернуть «ноль килобайт» значило бы отчитаться об успехе
 * ровно тогда, когда проверять перестали.
 */
function firstLoadKb(output, route) {
  const line = output
    .split("\n")
    .find((row) => new RegExp(`[○●λƒ]\\s+${route.replace("/", "\\/")}\\s`).test(row));

  if (!line) {
    fail(
      `The next build output has no line for route ${route}. The table format ` +
        `has changed — fix the parsing instead of switching the check off.`
    );
  }

  const sizes = [...line.matchAll(/([\d.]+)\s*(kB|MB|B)\b/g)];
  const last = sizes.at(-1);
  if (!last) fail(`The line for route ${route} carries no size at all: ${line.trim()}`);

  const value = Number(last[1]);
  const unit = last[2];
  return unit === "MB" ? value * 1024 : unit === "B" ? value / 1024 : value;
}

function fail(message) {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

step("building the package");
run("npm", ["run", "build"], ROOT);
run("node", [join(ROOT, "scripts", "check-dist.mjs")], ROOT);

step("packing the tarball");
rmSync(TARBALL, { force: true });
const packed = execFileSync("npm", ["pack", "--json", "--pack-destination", FIXTURE], {
  cwd: ROOT,
  encoding: "utf8",
});
const packedName = JSON.parse(packed)[0].filename;
// Имя тарбола несёт версию; фикстура ставит его под постоянным именем, иначе
// команда установки менялась бы каждый выпуск.
const versioned = join(FIXTURE, packedName);
if (!existsSync(versioned)) fail(`npm pack did not create ${packedName}`);
writeFileSync(TARBALL, readFileSync(versioned));
rmSync(versioned, { force: true });

/**
 * Манифест тарбола глазами реестра GitLab (OLDSUI-195): реестр отдаёт npm
 * зависимости, но не `peerDependenciesMeta`, поэтому опциональный peer у
 * потребителя становится обязательным. Проверка читает манифест так же — без
 * этого поля — и требует, чтобы движка Редактора в нём не было: иначе
 * потребитель без Редактора снова получит весь Tiptap в lock-файл. Сама
 * установка тарбола этого не покажет: из `.tgz` npm читает полный манифест.
 */
step("the published manifest does not make the Editor engine a dependency");
const packedManifest = JSON.parse(
  execFileSync("tar", ["-xzOf", TARBALL, "package/package.json"], { encoding: "utf8" })
);
const asGitlabServes = {
  ...packedManifest.dependencies,
  ...packedManifest.peerDependencies,
  ...packedManifest.optionalDependencies,
};
const engineDeclared = EDITOR_ENGINE.filter((name) => name in asGitlabServes);
if (engineDeclared.length > 0) {
  fail(
    `The packed manifest declares the Editor engine: ${engineDeclared.join(", ")}.\n` +
      `The GitLab registry drops peerDependenciesMeta, so every consumer would install ` +
      `these packages, Editor or not. Keep them in devDependencies and on the Editor page.`
  );
}

/*
 * Фикстура ставит движок так же, как потребитель по команде со страницы
 * Редактора: каждый пакет `EDITOR_ENGINE` — в её зависимостях. Пропуск не
 * роняет сборку: Next.js находит пакет в `node_modules` кита выше по дереву, и
 * с ним приезжает вторая копия `@tiptap/core` и `@tiptap/pm` — страница
 * Редактора молча тяжелеет на десятки килобайт (OLDSUI-277: +93 кБ из-за
 * `@tiptap/extension-details`).
 */
step("the fixture installs every Editor engine package");
const fixtureManifest = JSON.parse(readFileSync(join(FIXTURE, "package.json"), "utf8"));
const fixtureDeclared = { ...fixtureManifest.dependencies, ...fixtureManifest.devDependencies };
const engineMissing = EDITOR_ENGINE.filter((name) => !(name in fixtureDeclared));
if (engineMissing.length > 0) {
  fail(
    `fixtures/consumer/package.json lacks Editor engine packages: ${engineMissing.join(", ")}.\n` +
      `A consumer installs them by the command on the Editor page; add them with the same range.`
  );
}

step("installing consumer dependencies");
run("npm", ["install", "--no-audit", "--no-fund"], FIXTURE);
run("npm", ["install", "--no-save", "--no-audit", "--no-fund", "./olddevs-ui.tgz"], FIXTURE);

step("building the consumer");
rmSync(join(FIXTURE, ".next"), { recursive: true, force: true });
const buildOutput = runCaptured("npx", ["next", "build"], FIXTURE);

step("kit classes reached the consumer CSS");
const cssDir = join(FIXTURE, ".next", "static", "css");
if (!existsSync(cssDir)) {
  fail("Next.js emitted no CSS file — Tailwind did not build for the consumer");
}
const css = readdirSync(cssDir)
  .filter((name) => name.endsWith(".css"))
  .map((name) => readFileSync(join(cssDir, name), "utf8"))
  .join("\n");

const missing = CSS_PROBES.filter((probe) => !css.includes(probe));
if (missing.length > 0) {
  fail(
    `The consumer CSS has no package classes: ${missing.join(", ")}.\n` +
      `This is what a lost @source or @import "@olddevs/ui/styles.css" looks like: ` +
      `the build succeeds and the consumer components come out unstyled.`
  );
}

/**
 * CSS и шрифты KaTeX доехали до потребителя (OLDSUI-280, ADR-0070, п. 9).
 *
 * Кит собирается голым `tsc`, и стили KaTeX у него не файл, а импорт
 * `katex/dist/katex.min.css` в ленивом модуле формул: сборщик потребителя выпускает
 * CSS ленивого чанка и переписывает `url(fonts/…)` на шрифты из пакета `katex`
 * потребителя. Сборка зелёная и тогда, когда импорт потерялся, — формулы бы
 * отрисовались без стилей и шрифтов, поэтому читается результат: правила `.katex`
 * в CSS и файлы шрифтов в `static/media`.
 */
step("KaTeX styles and fonts reached the consumer build");
const katexCssLost = [".katex", "KaTeX_Main"].filter((probe) => !css.includes(probe));
if (katexCssLost.length > 0) {
  fail(
    `The consumer CSS lacks the KaTeX stylesheet (${katexCssLost.join(", ")}).\n` +
      `The lazy formula module imports katex/dist/katex.min.css; if the bundler dropped it, ` +
      `check the import in dist/editor/features/mathematics/katexEngine.js and the ` +
      `sideEffects of the packages involved.`
  );
}
const mediaDir = join(FIXTURE, ".next", "static", "media");
const katexFonts = existsSync(mediaDir)
  ? readdirSync(mediaDir).filter((name) => name.startsWith("KaTeX_"))
  : [];
if (katexFonts.length === 0) {
  fail(
    "No KaTeX_* font files in .next/static/media: the bundler did not resolve url(fonts/…) " +
      "of katex.min.css from the consumer's katex package."
  );
}

/**
 * Исключение Редактора из `@source` (OLDSUI-197): строка из getting-started
 * снимает его классы, а классы основного входа оставляет.
 *
 * Фикстура Редактор импортирует, поэтому её собранный CSS классы Редактора
 * обязан содержать — это заодно доказывает, что проба вообще что-то ловит:
 * проба, которой нет и в полном CSS, прошла бы и при сломанном исключении.
 * Вторая сборка Next ради одной строки CSS дорога, поэтому вариант
 * «потребитель без Редактора» — это тот же `globals.css` с четвёртой строкой,
 * прогнанный через PostCSS и Tailwind фикстуры. Строка берётся из
 * getting-started дословно (путь — от `app/` фикстуры, как у её `@source`):
 * проверка своей копии строки пропустила бы опечатку в справочнике.
 *
 * Автопоиск источников Tailwind (`base`) сужен до `app/`: в корне фикстуры
 * после сборки лежит `.next` с Редактором внутри, и проверка зависела бы от
 * того, игнорирует ли его `.gitignore`.
 */
const EDITOR_CSS_PROBE = "ProseMirror";
const documented = /^@source not "\.\/node_modules\/@olddevs\/ui\/dist\/editor";$/m.exec(
  readFileSync(join(ROOT, "docs", "getting-started.md"), "utf8")
)?.[0];
if (!documented) {
  fail(
    `docs/getting-started.md has no line @source not "./node_modules/@olddevs/ui/dist/editor"; — ` +
      `the exclusion for apps without the Editor is gone or its path changed.`
  );
}
const EDITOR_EXCLUSION = documented.replace('"./node_modules', '"../node_modules');

step("the editor exclusion from @source drops only the editor classes");
if (!css.includes(EDITOR_CSS_PROBE)) {
  fail(
    `The consumer CSS has no ${EDITOR_CSS_PROBE} classes although the fixture imports ` +
      `the Editor: the probe no longer matches what the Editor emits — fix the probe.`
  );
}
const fixtureRequire = createRequire(join(FIXTURE, "package.json"));
const { default: postcss } = await import(pathToFileURL(fixtureRequire.resolve("postcss")).href);
const { default: tailwind } = await import(
  pathToFileURL(fixtureRequire.resolve("@tailwindcss/postcss")).href
);
const globalsPath = join(FIXTURE, "app", "globals.css");
const withoutEditor = await postcss([tailwind({ base: join(FIXTURE, "app") })]).process(
  `${readFileSync(globalsPath, "utf8")}\n${EDITOR_EXCLUSION}\n`,
  { from: globalsPath }
);
if (withoutEditor.css.includes(EDITOR_CSS_PROBE)) {
  fail(
    `With ${EDITOR_EXCLUSION} the CSS still has ${EDITOR_CSS_PROBE} classes: the line ` +
      `from getting-started no longer removes the Editor (did dist/editor move?).`
  );
}
const lost = CSS_PROBES.filter((probe) => !withoutEditor.css.includes(probe));
if (lost.length > 0) {
  fail(`The editor exclusion also removed the kit classes: ${lost.join(", ")}`);
}

/**
 * Страница редактора, отрисованная на сервере: конвейер показа дошёл до HTML.
 *
 * Сборка зелёная и тогда, когда очистка ничего не сняла или подсветка не
 * сработала, — поэтому читается сам пререндер `/editor`. В нём обязаны быть
 * токены подсветки (`highlightCodeBlocks` на сервере), гнездо кнопки и метка
 * острова «Копировать» (`RichTextView` с блоком кода) — и не должно быть ни
 * одной подделки из документа страницы: `sanitizeRichText` с DOMPurify
 * потребителя их снял.
 */
const EDITOR_PROBES = [
  '<span class="hljs-keyword">def</span>',
  "data-code-copy=",
  "<template data-code-copy-island",
  // Остров своего Блока (OLDSUI-114): метку ставит клиентский остров, и ссылка на
  // компонент потребителя прошла границу RSC; серверный HTML Блока — на месте.
  "<template data-block-island",
  "Server badge",
  // Формула (OLDSUI-280, ADR-0070): сервер кладёт в пустой элемент исходный LaTeX,
  // метка острова формул стоит в разметке; отрисованного KaTeX на сервере нет.
  "<template data-math-island",
  'data-latex="e^{i\\pi}+1=0">e^{i\\pi}+1=0</span>',
];
const EDITOR_LEAKS = [
  "fixed inset-0",
  "position:fixed",
  "javascript:alert",
  "data:image/png",
  'class="katex"',
];

step("the editor page is sanitised, highlighted and has its copy island");
const editorHtmlPath = join(FIXTURE, ".next", "server", "app", "editor.html");
if (!existsSync(editorHtmlPath)) {
  fail("Next.js prerendered no /editor page — the editor route did not build as static");
}
const editorHtml = readFileSync(editorHtmlPath, "utf8");
const absent = EDITOR_PROBES.filter((probe) => !editorHtml.includes(probe));
if (absent.length > 0) {
  fail(`The /editor page lacks what the server pipeline must produce: ${absent.join(", ")}`);
}
const leaked = EDITOR_LEAKS.filter((leak) => editorHtml.includes(leak));
if (leaked.length > 0) {
  fail(`sanitizeRichText let through what it must remove: ${leaked.join(", ")}`);
}

step("consumer pages within budget");
const pages = [BUDGETS.consumer, BUDGETS.consumerEditor, BUDGETS.consumerEditorFull];
const measured = pages.map(({ route, firstLoadKb: budgetKb }) => {
  const actualKb = firstLoadKb(buildOutput, route);
  if (actualKb > budgetKb) {
    fail(
      `First Load JS for route ${route}: ${actualKb} kB against a budget of ${budgetKb} kB.\n` +
        `The usual cause is the client-graph boundary: without optimizePackageImports ` +
        `the root page weighs 408 kB instead of 114 and the editor page 435 instead of 137 ` +
        `(ADR-0029; the editor subpath needs its own line). If the growth is justified, ` +
        `raise the budget in scripts/bundle-size.budgets.mjs as a separate line in the MR.`
    );
  }
  return `${route} ${actualKb} kB against ${budgetKb} kB`;
});

console.log(
  `\n✓ the consumer is built; package classes are present in the CSS; ` +
    `the editor page is sanitised and highlighted; First Load JS ${measured.join(", ")}`
);
