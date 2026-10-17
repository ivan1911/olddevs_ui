/**
 * The gate for the open package. Nothing that goes to npmjs or the public repository may
 * link inward: no internal addresses, no former registry, no paths from a developer's
 * machine, no traces of the product the kit was forked from, and no relative links into the
 * closed repository of decisions.
 *
 * WHY TWO MODES. The package is what the consumer gets (`npm pack`), while the public
 * repository is wider: histories and tests are visible to everyone, and the root files do
 * not go into the package. So the same rules run both over the package's file list and over
 * `git ls-files`.
 *
 *   npm run check:public                — package files (run `npm run build` first, or `dist` is empty)
 *   npm run check:public -- --repo      — all files in the repository
 *   npm run check:public -- --summary   — counts by rule and folder only
 *
 * Exits with code 1 if there is at least one violation.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");

/**
 * The script itself has to spell out everything it searches for, so reading it would be
 * pointless. The gate's test does not get this exemption: its samples are assembled from
 * fragments.
 */
const SELF = "scripts/check-public.mjs";

/*
 * The gate does not search for tracker keys (`OLDSUI-N`): the owner allowed them in commits,
 * code and documentation (decision of 2026-10-11, confirmed 2026-10-15). They tie a change
 * to its task in Bitbucket and Jira.
 */

/** Only the documentation site is public under the domain; the tracker, the wiki and Bitbucket are not. */
const PUBLIC_HOST = "ui.olddevs.ru";
const DOMAIN_HOST = /(?:[\w-]+\.)*olddevs\.ru\b/g;

const RULES = [
  {
    name: "internal-host",
    test: (line) => (line.match(DOMAIN_HOST) ?? []).some((host) => host !== PUBLIC_HOST),
  },
  {
    // The package's former registry: the GitLab group and its project id in the API address.
    name: "private-registry",
    test: (line) => /gitlab\.com\/olddevs-ui\b|\b86141926\b/.test(line),
  },
  { name: "local-path", test: (line) => /\/Users\/[\w.-]+/.test(line) },
  {
    // The kit was started as a fork of someone else's product. Its name and package scope must
    // not appear in open code, examples or tests, and that includes the tests, since they are
    // in the public repository too. The bare word is matched on purpose: the former product's
    // domain examples are its wallpapers, and a neutral example does not pick them up.
    name: "forked-product",
    test: (line) => /wallpaper|@wpp\/|\bwpp-ui\b/i.test(line),
  },
  {
    // The decisions repository is closed: a path into it, a relative link or a file name
    // `olddevs_ui_docs/…`, is broken both on GitHub and from `node_modules`. The name itself
    // in plain text is not a path, so it is left alone.
    name: "private-docs-link",
    test: (line) => /(?:\.\.\/)+olddevs_ui_docs\b|\bolddevs_ui_docs\//.test(line),
  },
];

const BINARY = /\.(png|jpe?g|gif|webp|avif|ico|woff2?|ttf|otf|eot|pdf|zip|tgz|gz)$/i;

/** Whether to read the file as text: images, fonts and archives are not read. */
export function isTextFile(path) {
  return !BINARY.test(path);
}

/** The package's file paths, from the JSON that `npm pack --dry-run --json` prints. */
export function packedPaths(json) {
  return JSON.parse(json).flatMap((pack) => pack.files.map((file) => file.path));
}

/**
 * A package without `dist` is not built: the JSDoc types the consumer gets were never read,
 * so "clean" would be a lie.
 */
export function isUnbuilt(paths) {
  return !paths.some((path) => path.startsWith("dist/"));
}

/** Violations by file: `files` maps a path to its text. */
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
  // `--ignore-scripts`: the file list does not depend on hooks, and `release:check` builds
  // the package before this step. The error stream is captured, not discarded: on success it
  // holds only npm notices, on failure it holds the reason.
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
    // A file from the index may be deleted in the working copy; if so, it is simply absent.
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
