/**
 * Проверка собранного пакета: директивы `"use client"` пережили сборку.
 *
 * Почему отдельно от `tests/rsc-gate.test.ts`, а не там же. Тот тест смотрит
 * исходники и отвечает за раскладку, которую пишет автор. Здесь проверяется
 * другое и другим: **что директива уцелела в `dist`**. Терять её умеет сборщик,
 * а не человек — Next.js прямо предупреждает авторов библиотек, что конфигурация
 * сборки не должна срезать директиву. Сегодня `tsc` её сохраняет; проверка
 * существует ровно на тот день, когда сборщик сменится.
 *
 * Почему скриптом, а не тестом. `dist/` лежит в `.gitignore`, и на свежей копии
 * его нет. Тест, который в этом случае «проходит», был бы зелёным ровно тогда,
 * когда проверять нечего, — то есть бесполезным. Скрипт вместо этого падает с
 * внятным сообщением и ставится сразу после `npm run build`: в джобе CI и в
 * `release:check`.
 *
 * Соответствие исходнику проверяется по факту: у каждого `.js` в `dist`
 * ищется парный `.ts`/`.tsx` в `src`, и директивы обязаны совпадать. Свой
 * список здесь не заводится намеренно — два списка разошлись бы молча.
 */

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const DIST = join(ROOT, "dist");
const SRC = join(ROOT, "src");

const DIRECTIVE = '"use client"';

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

if (!existsSync(DIST)) {
  fail("The dist directory is missing. Run `npm run build` — there is nothing to check.");
}

function jsFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return jsFiles(full);
    return entry.name.endsWith(".js") ? [full] : [];
  });
}

/** Первая значащая строка файла: директива обязана стоять до импортов. */
function hasDirective(file) {
  return readFileSync(file, "utf8").trimStart().startsWith(DIRECTIVE);
}

const built = jsFiles(DIST);

if (built.length === 0) {
  fail("dist has no .js at all. The build did not happen — there is nothing to check.");
}

const lost = [];
const orphans = [];

for (const file of built) {
  const stem = relative(DIST, file).replace(/\.js$/, "");
  const source = [".tsx", ".ts"].map((ext) => join(SRC, `${stem}${ext}`)).find(existsSync);

  if (!source) {
    orphans.push(`${stem}.js`);
    continue;
  }

  if (hasDirective(source) && !hasDirective(file)) {
    lost.push(`${stem}.js`);
  }
}

if (orphans.length > 0) {
  fail(
    `dist has a file with no counterpart in src — the build produced something unexpected:\n` +
      orphans.map((name) => `  ${name}`).join("\n")
  );
}

if (lost.length > 0) {
  fail(
    `The build lost "use client" — these files will fail for the consumer in a server ` +
      `component:\n${lost.map((name) => `  ${name}`).join("\n")}`
  );
}

const withDirective = built.filter(hasDirective).length;
console.log(`✓ dist: ${built.length} files, "use client" present in ${withDirective} of them`);
