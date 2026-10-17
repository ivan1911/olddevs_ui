import { LucideProvider as lucideProvider } from "lucide-react";
import { expect, test } from "vitest";
import * as icons from "../src/icons.js";

/**
 * Checks that EVERY dictionary name resolves to a real component and follows the
 * naming convention.
 *
 * AN HONEST NOTE ON THE LIMITS OF THIS TEST. `tsc` also catches a missing lucide name:
 * `export { PendingCw as … } from "lucide-react"` gives `TS2305`, verified.
 * So a typo in a name is guarded first of all by the typecheck, not by this file.
 *
 * There are two things unique to this file:
 *  1. The convention "every dictionary name ends with `Icon`": it cannot be expressed
 *     in types, and without it the dictionary would quickly sprawl.
 *  2. A RUNTIME check, not only a types check: the test executes the module and makes
 *     sure the values exist. This guards the case where lucide's types and its built
 *     bundles diverge.
 *
 * Why names are checked against the installed package at all, rather than against the
 * documentation: `pending-cw` is listed in the lucide 1.27.0 release notes, but the
 * published package does not export it at all.
 */

/**
 * Besides the dictionary, the entry point exports `LucideProvider` (ADR-0072): lucide
 * ships with the kit, and the provider must come from the same copy as the dictionary's
 * icons. Otherwise, with two copies, the consumer's stroke width silently stops reaching
 * the kit's icons. It is not an icon, so the naming convention does not apply to it.
 */
const NOT_ICONS = new Set(["LucideProvider"]);

const names = Object.keys(icons).filter((name) => !NOT_ICONS.has(name));

test("the dictionary is not empty", () => {
  expect(names.length).toBeGreaterThan(40);
});

test.each(names)("%s resolves to a component", (name) => {
  const icon = (icons as Record<string, unknown>)[name];
  expect(icon, `${name} is not exported`).toBeDefined();
  // lucide icons are forwardRef results, that is, objects, not functions.
  expect(["function", "object"]).toContain(typeof icon);
});

test("every dictionary name ends with Icon", () => {
  const bad = names.filter((n) => !n.endsWith("Icon"));
  expect(bad, `without the Icon suffix: ${bad.join(", ")}`).toEqual([]);
});

test("LucideProvider comes from the same lucide copy as the icons", () => {
  expect((icons as Record<string, unknown>).LucideProvider).toBe(lucideProvider);
});
