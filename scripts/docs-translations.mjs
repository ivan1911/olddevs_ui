/**
 * Переводы справочника (ADR-0062): английский файл-сосед `X.en.md` Оригинала
 * `X.md` с хешем Оригинала во frontmatter (`sourceHash`).
 *
 * ПОЧЕМУ СТРУКТУРА — ОШИБКА, А ОТСТАВАНИЕ — НЕТ. Сайт режет Перевод на Части и
 * разделы по месту заголовков H2 и ведёт русские якоря ссылок на английские по
 * месту заголовка. Перевод с другим набором заголовков ломает это молча, поэтому
 * его роняет тест (`tests/docs-translations.test.ts`). Отставший Перевод
 * честен: сайт покажет его с плашкой «отстаёт», а Оригинал правится чаще, чем
 * переводится, — это отчёт, а не ворота.
 *
 *   npm run docs:translations          — состояние каждого Оригинала
 *   npm run docs:translations -- --check — выход с ошибкой при нарушенной структуре
 */

import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const DOCS = join(ROOT, "docs");
const FRONTMATTER = /^---\n([\s\S]*?)\n---\n/;
const HASH = /^sourceHash:\s*([0-9a-f]{12})\s*$/m;

/** Хеш Оригинала — первые 12 знаков sha256 файла; тот же, что считает сайт. */
export function hashOriginal(text) {
  return createHash("sha256").update(text).digest("hex").slice(0, 12);
}

export function isTranslation(path) {
  return path.endsWith(".en.md");
}

export function originalOf(path) {
  return path.replace(/\.en\.md$/, ".md");
}

/** Уровни заголовков и число блоков кода — вне frontmatter и вне кода. */
function shape(text) {
  const levels = [];
  let blocks = 0;
  let fence = null;
  for (const line of text.replace(FRONTMATTER, "").split("\n")) {
    const opener = /^ {0,3}(`{3,}|~{3,})/.exec(line)?.[1];
    if (fence) {
      if (
        opener &&
        opener[0] === fence[0] &&
        opener.length >= fence.length &&
        line.trim() === opener
      )
        fence = null;
      continue;
    }
    if (opener) {
      fence = opener;
      blocks++;
      continue;
    }
    const heading = /^ {0,3}(#{1,6})\s/.exec(line);
    if (heading) levels.push(heading[1].length);
  }
  return { levels, blocks };
}

/** Что не так с Переводом относительно его Оригинала; пустой список — всё в порядке. */
export function translationProblems(translation, original) {
  const problems = [];
  const own = FRONTMATTER.exec(translation)?.[1] ?? "";
  if (!HASH.test(own)) problems.push("no sourceHash (12 hex chars) in the frontmatter");
  const rest = own
    .split("\n")
    .filter((line) => !line.startsWith("sourceHash:"))
    .join("\n");
  if (rest !== (FRONTMATTER.exec(original)?.[1] ?? ""))
    problems.push("frontmatter differs from the Original's");

  const a = shape(original);
  const b = shape(translation);
  if (a.levels.join() !== b.levels.join())
    problems.push(
      `headings differ from the Original's: ${b.levels.join("")} instead of ${a.levels.join("")}`
    );
  if (a.blocks !== b.blocks)
    problems.push(`${b.blocks} code blocks instead of the Original's ${a.blocks}`);
  return problems;
}

/** Состояние Переводов по дереву `путь → текст`: Оригиналы по состояниям и ошибки Переводов. */
export function translationsState(files) {
  const current = [];
  const stale = [];
  const missing = [];
  const problems = [];
  for (const [path, text] of [...files].sort(([a], [b]) => a.localeCompare(b))) {
    if (isTranslation(path)) {
      const original = files.get(originalOf(path));
      if (original === undefined) problems.push(`${path}: no Original ${originalOf(path)}`);
      else
        for (const problem of translationProblems(text, original))
          problems.push(`${path}: ${problem}`);
      continue;
    }
    const translation = files.get(path.replace(/\.md$/, ".en.md"));
    if (translation === undefined) missing.push(path);
    else if (HASH.exec(translation)?.[1] === hashOriginal(text)) current.push(path);
    else stale.push(path);
  }
  return { current, stale, missing, problems };
}

/** Страницы `docs/`: путь от `docs/` → текст. */
export function readDocs(dir = DOCS) {
  const files = new Map();
  const walk = (at) => {
    for (const name of readdirSync(at)) {
      const full = join(at, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (name.endsWith(".md")) files.set(relative(DOCS, full), readFileSync(full, "utf8"));
    }
  };
  walk(dir);
  return files;
}

if (import.meta.main) {
  const files = readDocs();
  const state = translationsState(files);
  for (const path of state.stale)
    console.log(`stale    ${hashOriginal(files.get(path))}  docs/${path}`);
  for (const path of state.missing)
    console.log(`missing  ${hashOriginal(files.get(path))}  docs/${path}`);
  for (const problem of state.problems) console.error(`✗ docs/${problem}`);
  console.log(
    `${state.current.length} current, ${state.stale.length} stale, ${state.missing.length} missing, ` +
      `${state.problems.length} problems`
  );
  if (process.argv.includes("--check") && state.problems.length > 0) process.exit(1);
}
