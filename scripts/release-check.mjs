/**
 * Один вход, который прогоняет всё обязательное до тега.
 *
 * ЗАЧЕМ. Версия 1.6.0 упала в CI на `format:check` и axe — не потому, что
 * версию поставили руками, а потому, что перед тегом прогнали не всё. Список из
 * восьми команд в документации эту дыру не закрывает: пропустить одну из восьми
 * легко, пропустить одну из одной — нет.
 *
 * ЧЕГО ЗДЕСЬ НЕТ И ПОЧЕМУ. Браузерных проверок (`test:a11y`,
 * `test:interactions`, `test:visual`). Они ручные по ADR-0013, а снимки вообще
 * локальные и зависят от платформы. Молчаливо добавить их сюда значило бы
 * сделать preflight неисполнимым на чистой машине — то есть необязательным, а
 * необязательные ворота не ворота. Их прогоняют отдельно; скрипт об этом
 * напоминает в конце.
 *
 * Порядок шагов — от дешёвого к дорогому: незачем собирать потребителя, если не
 * сходятся типы.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");

const STEPS = [
  { name: "types", command: "npm", args: ["run", "typecheck"] },
  { name: "linter", command: "npm", args: ["run", "lint"] },
  { name: "formatting", command: "npm", args: ["run", "format:check"] },
  // Рядом с форматированием, а не рядом с документацией: проверка такая же
  // текстовая и такая же дешёвая, а роняет по той же причине — файл в
  // репозитории разошёлся с тем, что выводит генератор.
  { name: "docs index", command: "npm", args: ["run", "llms:check"] },
  { name: "tests", command: "npm", args: ["test"] },
  { name: "package build", command: "npm", args: ["run", "build"] },
  // Сразу после сборки: проверка пакета читает `dist`. Ссылки внутрь —
  // закрытый трекер, внутренние адреса, следы прежнего продукта — не должны
  // уехать ни в пакет, ни в публичный репозиторий.
  { name: "public package", command: "npm", args: ["run", "check:public"] },
  { name: "public repository", command: "npm", args: ["run", "check:public", "--", "--repo"] },
  { name: "directives in dist", command: "npm", args: ["run", "check:dist"] },
  { name: "token contrast", command: "npm", args: ["run", "contrast"] },
  { name: "size budget", command: "npm", args: ["run", "size"] },
  { name: "consumer build", command: "npm", args: ["run", "check:consumer"] },
];

function fail(step, detail) {
  console.error(`\n✗ Step “${step}” failed.${detail ? `\n${detail}` : ""}`);
  console.error("\nThe release is not ready. Fix the step and run release:check again.");
  process.exit(1);
}

for (const [index, step] of STEPS.entries()) {
  console.log(`\n━━ ${index + 1}/${STEPS.length + 1}: ${step.name} ━━`);
  const result = spawnSync(step.command, step.args, { cwd: ROOT, stdio: "inherit" });
  if (result.status !== 0) fail(step.name);
}

console.log(`\n━━ ${STEPS.length + 1}/${STEPS.length + 1}: release readiness ━━`);

const manifest = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
const version = manifest.version;
const tag = `v${version}`;

// 1. Непринятые changeset'ы означают, что версия ещё не поднята: тег ушёл бы на
//    код, о котором CHANGELOG молчит.
const pending = readdirSync(join(ROOT, ".changeset")).filter(
  (name) => name.endsWith(".md") && name !== "README.md"
);
if (pending.length > 0) {
  fail(
    "release readiness",
    `There are unreleased entries in .changeset: ${pending.join(", ")}.\n` +
      `Run \`npm run release:version\` — it bumps the version and appends to the CHANGELOG.`
  );
}

// 2. Запись о версии в CHANGELOG — то, что прочтёт потребитель.
const changelog = readFileSync(join(ROOT, "CHANGELOG.md"), "utf8");
if (!changelog.includes(`## ${version}`)) {
  fail("release readiness", `CHANGELOG.md has no “## ${version}” section.`);
}

// 3. Тег не должен существовать: повторный тег молча ничего не опубликует.
const tags = spawnSync("git", ["tag", "--list", tag], { cwd: ROOT, encoding: "utf8" });
if (tags.stdout.trim() === tag) {
  fail("release readiness", `Tag ${tag} already exists. Was the version not bumped?`);
}

// 4. Мажор без заметки о миграции — это выпуск, после которого потребитель
//    остаётся один на один со сломанным приложением.
const isMajor = version.endsWith(".0.0");
if (isMajor) {
  const notes = join(ROOT, "docs", "api", "migration-notes.md");
  if (!existsSync(notes) || !readFileSync(notes, "utf8").includes(version)) {
    fail(
      "release readiness",
      `A major release ${version} without an entry in docs/api/migration-notes.md. ` +
        `A breaking change is recorded by the action it demands of the consumer, not by a number.`
    );
  }
}

console.log(`\n✓ All green. Version ${version}, tag ${tag} is free.`);
console.log(
  "\nBrowser checks are NOT part of this run (ADR-0013) — run them separately:\n" +
    "  npm run test:a11y\n" +
    "  npm run test:interactions\n" +
    "  npm run test:visual        # locally, the darwin baseline\n" +
    "\nTag and publish only after these pass."
);
