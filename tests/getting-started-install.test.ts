import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { installCommand } from "./docs-install-command.js";

/**
 * The install command in getting-started is the kit plus its required peers
 * (since ADR-0072 that is React alone): whatever it misses breaks the consumer's
 * build, whatever it adds the consumer keeps for nothing. It is written by
 * hand, so it drifts from `package.json` silently — OLDSUI-196 was exactly
 * that: the changelog said `@internationalized/date` was no longer needed
 * while the manifest still required it. The Editor engine (ADR-0050) is not
 * on this list: the Editor page has its own command.
 */

const ROOT = join(import.meta.dirname, "..");
const manifest = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
  peerDependencies: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
};

const requiredPeers = Object.keys(manifest.peerDependencies)
  .filter((name) => !manifest.peerDependenciesMeta?.[name]?.optional)
  .sort();

/** Packages of the page's install command, without the kit itself. */
function installedBy(page: string) {
  const [kit, ...peers] = installCommand(page);
  expect(kit, `${page}: the command starts with the kit`).toBe("@olddevs/ui");
  return peers.sort();
}

describe("getting-started install command", () => {
  test("getting-started.md lists exactly the required peers", () => {
    expect(installedBy("getting-started.md")).toEqual(requiredPeers);
  });
});
