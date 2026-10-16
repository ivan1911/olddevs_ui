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
 * ЯКОРЯ ССЫЛОК. Ссылки в Переводе — как в Оригинале: путь `.md` и русский якорь
 * (ADR-0062). Английский якорь выводит сайт; латинский якорь по английскому
 * заголовку сайт не найдёт, и ссылка молча ведёт в начало страницы. Поэтому
 * якорь каждой ссылки Перевода обязан быть среди якорей заголовков Оригинала.
 *
 *   npm run docs:translations          — состояние каждого Оригинала
 *   npm run docs:translations -- --check — выход с ошибкой при нарушенной структуре
 */

import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, posix, relative, resolve } from "node:path";

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

/**
 * Строки вне frontmatter и вне кода — с номером строки в файле — и число
 * блоков кода.
 */
function prose(text) {
  const frontmatter = FRONTMATTER.exec(text)?.[0] ?? "";
  const offset = frontmatter.split("\n").length - 1;
  const lines = [];
  let blocks = 0;
  let fence = null;
  text
    .slice(frontmatter.length)
    .split("\n")
    .forEach((line, index) => {
      const opener = /^ {0,3}(`{3,}|~{3,})/.exec(line)?.[1];
      if (fence) {
        if (
          opener &&
          opener[0] === fence[0] &&
          opener.length >= fence.length &&
          line.trim() === opener
        )
          fence = null;
        return;
      }
      if (opener) {
        fence = opener;
        blocks++;
        return;
      }
      lines.push({ line, number: offset + index + 1 });
    });
  return { lines, blocks };
}

const HEADING = /^ {0,3}(#{1,6})\s+(.*?)(?:\s+#+)?\s*$/;

/** Уровни заголовков и число блоков кода — вне frontmatter и вне кода. */
function shape(text) {
  const { lines, blocks } = prose(text);
  const levels = lines.flatMap(({ line }) => {
    const heading = /^ {0,3}(#{1,6})\s/.exec(line);
    return heading ? [heading[1].length] : [];
  });
  return { levels, blocks };
}

/**
 * Якорь заголовка по правилам GitHub — как `github-slugger` на сайте: текст
 * без разметки в нижнем регистре, без знаков препинания и символов, пробел —
 * дефис. Кириллица остаётся: якорь «## Частые проблемы» — `частые-проблемы`.
 */
export function headingSlug(heading) {
  return heading
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[`*]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, "")
    .replace(/ /g, "-");
}

/** Якоря всех заголовков страницы; повтор получает `-1`, `-2`, как у GitHub. */
export function headingSlugs(text) {
  const seen = new Map();
  for (const { line } of prose(text).lines) {
    const heading = HEADING.exec(line);
    if (!heading) continue;
    const base = headingSlug(heading[2]);
    let slug = base;
    while (seen.has(slug)) {
      seen.set(base, seen.get(base) + 1);
      slug = `${base}-${seen.get(base)}`;
    }
    seen.set(slug, 0);
  }
  return new Set(seen.keys());
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

/**
 * Ссылки Перевода на страницы кита, `[текст](страница.md#якорь)` и `(#якорь)`
 * (ADR-0062): якорь написан по заголовку Оригинала целевой страницы, русский, а
 * английский выводит сайт. Латинский якорь по английскому заголовку Перевода
 * сайт не найдёт — ссылка молча ведёт в начало страницы. Внешние ссылки и
 * ссылки без якоря не проверяются.
 */
export function translationLinkProblems(path, text, files) {
  const { lines } = prose(text);
  // Инлайн-код — пробелами той же длины: ссылка в нём не ссылка, смещения целы.
  const stripped = lines.map(({ line, number }) => ({
    number,
    line: line.replace(/(`+)[^`]*?\1/g, (code) => " ".repeat(code.length)),
  }));
  const joined = stripped.map(({ line }) => line).join("\n");
  const starts = [];
  let at = 0;
  for (const { number, line } of stripped) {
    starts.push({ at, number });
    at += line.length + 1;
  }
  const slugs = new Map();
  const problems = [];
  for (const match of joined.matchAll(/\]\(([^)\s]*)\)/g)) {
    const target = match[1];
    if (/^[a-z][a-z0-9+.-]*:/i.test(target) || !target.includes("#")) continue;
    const [file, anchor] = [
      target.slice(0, target.indexOf("#")),
      target.slice(target.indexOf("#") + 1),
    ];
    if (anchor === "") continue;
    const page = file === "" ? originalOf(path) : posix.join(dirname(path), file);
    const number = starts.findLast((start) => start.at <= match.index).number;
    const where = `${path}:${number}: link ${target}`;
    const original = files.get(page);
    if (original === undefined) {
      problems.push(`${where}: no page ${page}`);
      continue;
    }
    if (!slugs.has(page)) slugs.set(page, headingSlugs(original));
    let decoded = anchor;
    try {
      decoded = decodeURIComponent(anchor);
    } catch {
      // Не процентная запись — якорь как есть.
    }
    if (!slugs.get(page).has(decoded))
      problems.push(
        `${where}: no heading with this anchor in the Original ${page}; ` +
          "write the anchor as the Original's heading slug (ADR-0062)"
      );
  }
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
      else {
        for (const problem of translationProblems(text, original))
          problems.push(`${path}: ${problem}`);
        problems.push(...translationLinkProblems(path, text, files));
      }
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
