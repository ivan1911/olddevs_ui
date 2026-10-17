import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { expect, test } from "vitest";
import * as barrel from "../src/index.js";

const ROOT = resolve(import.meta.dirname, "..");

/**
 * The gate of the separate `@olddevs/ui/color` entry point.
 *
 * WHY. The react-aria color subsystem costs 61 kB gzip, and ADR-0038 keeps it outside
 * the barrel for exactly this reason. But one forgotten `export` line in `src/index.ts`
 * would add those kilobytes to every consumer, and **nothing would turn red**:
 * `npm run size` declares react-aria external together with the kit's other third-party
 * libraries, and the fixture page does not import color. The ADR itself calls this a
 * tracked risk; here it is tracked.
 */

test("the barrel does not export the colour picker", () => {
  expect(Object.keys(barrel)).not.toContain("ColorPicker");
});

test("the colour component is imported only by its own entry", () => {
  const entry = readFileSync(join(ROOT, "src", "color.ts"), "utf8");
  expect(entry).toContain("./components/inputs/ColorPicker.js");

  const barrelSource = readFileSync(join(ROOT, "src", "index.ts"), "utf8");
  expect(barrelSource).not.toContain("ColorPicker");
});
