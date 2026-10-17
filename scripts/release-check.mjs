/**
 * A single entry point that runs everything required before the tag.
 *
 * WHY. Version 1.6.0 failed in CI on `format:check` and axe. The version was not set by hand
 * the problem: the checks before the tag did not all run. A list of eight commands in the
 * docs does not close that gap. It is easy to skip one of eight, and impossible to skip the
 * only one.
 *
 * WHAT IS NOT HERE, AND WHY. The browser checks (`test:a11y`, `test:interactions`,
 * `test:visual`). They are manual under ADR-0013, and the snapshots are local and depend on
 * the platform. Adding them here quietly would make the preflight impossible to run on a
 * clean machine, so it would no longer be required, and a gate that is not required is not
 * a gate. They run separately; the script reminds you of this at the end.
 *
 * The steps run from cheap to expensive: there is no point building the consumer if the
 * types do not agree.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { readmeTranslationLag } from "./readme-translation.mjs";

const ROOT = resolve(import.meta.dirname, "..");

const STEPS = [
  { name: "types", command: "npm", args: ["run", "typecheck"] },
  { name: "linter", command: "npm", args: ["run", "lint"] },
  { name: "formatting", command: "npm", args: ["run", "format:check"] },
  // Next to formatting, not next to the docs: the check is textual and just as cheap,
  // and it fails for the same reason, a file in the repo has drifted from what the
  // generator prints.
  { name: "docs index", command: "npm", args: ["run", "llms:check"] },
  { name: "tests", command: "npm", args: ["test"] },
  { name: "package build", command: "npm", args: ["run", "build"] },
  // Right after the build: the package check reads `dist`. Links inward (the private
  // tracker, internal addresses, traces of the former product) must not leak into the
  // package or the public repository.
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

// 1. Unreleased changesets mean the version has not been bumped yet: the tag would
//    point at code that the CHANGELOG does not describe.
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

// 2. The version entry in the CHANGELOG is what the consumer reads.
const changelog = readFileSync(join(ROOT, "CHANGELOG.md"), "utf8");
if (!changelog.includes(`## ${version}`)) {
  fail("release readiness", `CHANGELOG.md has no “## ${version}” section.`);
}

// 3. The tag must not exist yet: a repeated tag would silently publish nothing.
const tags = spawnSync("git", ["tag", "--list", tag], { cwd: ROOT, encoding: "utf8" });
if (tags.stdout.trim() === tag) {
  fail("release readiness", `Tag ${tag} already exists. Was the version not bumped?`);
}

// 4. A major release without a migration note leaves the consumer alone with a broken
//    application after the release.
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

// 5. A lagging README translation is a report, not a gate (ADR-0073): the release does
//    not wait for the translation.
const lag = readmeTranslationLag(
  readFileSync(join(ROOT, "README.md"), "utf8"),
  readFileSync(join(ROOT, "README.ru.md"), "utf8")
);
if (lag) console.log(`\n⚠ ${lag}. A report only: the release goes on.`);

console.log(`\n✓ All green. Version ${version}, tag ${tag} is free.`);
console.log(
  "\nBrowser checks are NOT part of this run (ADR-0013) — run them separately:\n" +
    "  npm run test:a11y\n" +
    "  npm run test:interactions\n" +
    "  npm run test:visual        # locally, the darwin baseline\n" +
    "\nTag and publish only after these pass."
);
