/**
 * Ворота открытого пакета: в том, что уезжает на npmjs и в публичный
 * репозиторий, не должно быть ссылок внутрь — внутренних адресов, прежнего реестра, путей с машины разработчика, следов
 * продукта, от которого кит отпочковался, и относительных ссылок в закрытый
 * репозиторий решений.
 *
 * ПОЧЕМУ ДВА РЕЖИМА. Пакет — это то, что получает потребитель (`npm pack`), а
 * публичный репозиторий шире: истории, тесты, корневые файлы в пакет не едут,
 * но видны всем. Поэтому один и тот же набор правил прогоняется и по списку
 * файлов пакета, и по `git ls-files`.
 *
 *   npm run check:public                — файлы пакета (сначала `npm run build`: иначе `dist` пуст)
 *   npm run check:public -- --repo      — все файлы репозитория
 *   npm run check:public -- --summary   — только счётчики по правилам и папкам
 *
 * Выход с кодом 1, если есть хотя бы одно нарушение.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");

/**
 * Сам скрипт обязан произнести всё, что ищет, — читать его бессмысленно. Тест
 * ворот этого исключения не получает: его образцы склеены из кусков.
 */
const SELF = "scripts/check-public.mjs";

/*
 * Ключи задач трекера (`OLDSUI-N`) ворота не ищут: владелец разрешил их в
 * коммитах, коде и документации (решение 2026-10-11, подтверждено 2026-10-15) —
 * они связывают правку с задачей в Bitbucket и Jira.
 */

/** Публичен у домена только сайт документации; трекер, вики и Bitbucket — нет. */
const PUBLIC_HOST = "ui.olddevs.ru";
const DOMAIN_HOST = /(?:[\w-]+\.)*olddevs\.ru\b/g;

const RULES = [
  {
    name: "internal-host",
    test: (line) => (line.match(DOMAIN_HOST) ?? []).some((host) => host !== PUBLIC_HOST),
  },
  {
    // Прежний реестр пакета: группа на GitLab и id её проекта в адресе API.
    name: "private-registry",
    test: (line) => /gitlab\.com\/olddevs-ui\b|\b86141926\b/.test(line),
  },
  { name: "local-path", test: (line) => /\/Users\/[\w.-]+/.test(line) },
  {
    // Кит заведён форком чужого продукта; в открытом коде, примерах и тестах
    // его имени и области пакетов быть не должно — включая тесты: они тоже
    // лежат в публичном репозитории. Голое слово ловится намеренно: доменные
    // примеры прежнего продукта — это обои, и нейтральный пример их не берёт.
    name: "forked-product",
    test: (line) => /wallpaper|@wpp\/|\bwpp-ui\b/i.test(line),
  },
  {
    // Репозиторий решений закрыт: путь в него — относительная ссылка или имя
    // файла `olddevs_ui_docs/…` — битый и с GitHub, и из `node_modules`. Само
    // название в тексте — не путь, его не трогаем.
    name: "private-docs-link",
    test: (line) => /(?:\.\.\/)+olddevs_ui_docs\b|\bolddevs_ui_docs\//.test(line),
  },
];

const BINARY = /\.(png|jpe?g|gif|webp|avif|ico|woff2?|ttf|otf|eot|pdf|zip|tgz|gz)$/i;

/** Читать ли файл как текст: картинки, шрифты и архивы — нет. */
export function isTextFile(path) {
  return !BINARY.test(path);
}

/** Пути файлов пакета из JSON, который печатает `npm pack --dry-run --json`. */
export function packedPaths(json) {
  return JSON.parse(json).flatMap((pack) => pack.files.map((file) => file.path));
}

/**
 * Пакет без `dist` не собран: типы с JSDoc, которые получает потребитель, не
 * прочитаны, и «чисто» было бы неправдой.
 */
export function isUnbuilt(paths) {
  return !paths.some((path) => path.startsWith("dist/"));
}

/** Нарушения по файлам: `files` — путь → текст. */
export function findViolations(files) {
  const found = [];
  for (const [path, text] of files) {
    if (path === SELF) continue;
    const rules = RULES.filter((rule) => !rule.allowed?.(path));
    text.split("\n").forEach((content, index) => {
      for (const rule of rules) {
        if (rule.test(content)) found.push({ path, line: index + 1, rule: rule.name });
      }
    });
  }
  return found;
}

function listPaths(repo) {
  if (repo) {
    return execFileSync("git", ["ls-files", "-z"], { cwd: ROOT, encoding: "utf8" })
      .split("\0")
      .filter(Boolean);
  }
  // `--ignore-scripts`: список файлов не зависит от хуков, а сборку пакета
  // делает `release:check` до этого шага. Поток ошибок забираем, а не
  // выбрасываем: при удаче там только уведомления npm, при сбое — причина.
  try {
    const json = execFileSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return packedPaths(json);
  } catch (error) {
    console.error(`✗ check:public — npm pack failed:\n${error.stderr || error.message}`);
    process.exit(1);
  }
}

function readFiles(paths) {
  const files = new Map();
  for (const path of paths) {
    const full = join(ROOT, path);
    // Файл из индекса может быть удалён в рабочей копии — его просто нет.
    if (!isTextFile(path) || !existsSync(full)) continue;
    files.set(path, readFileSync(full, "utf8"));
  }
  return files;
}

function countBy(items, key) {
  const counts = new Map();
  for (const item of items) counts.set(key(item), (counts.get(key(item)) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1]);
}

function report(found, { repo, summary }) {
  const scope = repo ? "repository" : "package";
  if (found.length === 0) {
    console.log(`✓ check:public — the ${scope} is clean.`);
    return;
  }
  for (const [rule, total] of countBy(found, (v) => v.rule)) {
    const hits = found.filter((v) => v.rule === rule);
    const files = new Set(hits.map((v) => v.path)).size;
    console.log(`\n${rule}: ${total} lines in ${files} files`);
    if (summary) {
      for (const [folder, count] of countBy(hits, (v) => v.path.split("/").slice(0, 2).join("/"))) {
        console.log(`  ${String(count).padStart(5)}  ${folder}`);
      }
    } else {
      for (const v of hits) console.log(`  ${v.path}:${v.line}`);
    }
  }
  console.error(`\n✗ check:public — ${found.length} violations in the ${scope}.`);
}

if (import.meta.main) {
  const repo = process.argv.includes("--repo");
  const summary = process.argv.includes("--summary");
  const paths = listPaths(repo);
  if (!repo && isUnbuilt(paths)) {
    console.error("✗ check:public — the package has no dist: run `npm run build` first.");
    process.exit(1);
  }
  const found = findViolations(readFiles(paths));
  report(found, { repo, summary });
  if (found.length > 0) process.exit(1);
}
