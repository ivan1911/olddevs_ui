import { expect, expectTypeOf, test } from "vitest";
import {
  RICH_TEXT_PRESETS,
  tool,
  type ConfiguredTool,
  type DateToolCommands,
  type DateToolOptions,
  type RichTextTools,
} from "../src/editor/index.js";

/**
 * Types of the `date` Tool (OLDSUI-309): its options and commands on the public entry point.
 * Checked by `npm run typecheck`, not by Vitest: `expectTypeOf` and `@ts-expect-error` do
 * nothing at run time.
 */

test("tool('date') takes an Intl.DateTimeFormatOptions object as `format`", () => {
  const long = tool("date", { format: { dateStyle: "long" } });
  const parts = tool("date", { format: { day: "numeric", month: "long", year: "numeric" } });

  expectTypeOf(long).toEqualTypeOf<ConfiguredTool<"date">>();
  expectTypeOf(parts).toEqualTypeOf<ConfiguredTool<"date">>();
  expectTypeOf(tool("date")).toEqualTypeOf<ConfiguredTool<"date">>();
  expectTypeOf<RichTextTools["date"]["options"]>().toEqualTypeOf<DateToolOptions>();
  expectTypeOf<DateToolOptions["format"]>().toEqualTypeOf<Intl.DateTimeFormatOptions | undefined>();
  // @ts-expect-error `format` is data (an object), not a function.
  tool("date", { format: () => "x" });
  expect(long.name).toBe("date");
});

test("the commands are `insert(value?)` returning a boolean, and there is no state", () => {
  expectTypeOf<RichTextTools["date"]["commands"]>().toEqualTypeOf<DateToolCommands>();
  expectTypeOf<DateToolCommands["insert"]>().toEqualTypeOf<(value?: string) => boolean>();
  expectTypeOf<RichTextTools["date"]>().not.toHaveProperty("state");
});

test("the Tool is in the full preset and not in basic", () => {
  expect(RICH_TEXT_PRESETS.full).toContain("date");
  expect(RICH_TEXT_PRESETS.basic).not.toContain("date");
});
