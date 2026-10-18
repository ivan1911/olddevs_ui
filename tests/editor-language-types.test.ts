import { expect, expectTypeOf, test } from "vitest";
import {
  tool,
  type LanguageToolCommands,
  type LanguageToolOptions,
  type LanguageToolState,
  type RichTextEditorHandle,
  type RichTextTools,
} from "../src/editor/index.js";

/**
 * The `language` Tool's types (OLDSUI-308, ADR-0078): options, state and commands in the
 * `RichTextTools` map, as `tool()`, `useRichTextToolState` and `handle.tool()` see them. Checked
 * by `npm run typecheck`: `expectTypeOf` and `@ts-expect-error` do nothing at run time, so the
 * checks live in functions the test does not call.
 */

function theMap(handle: RichTextEditorHandle) {
  expectTypeOf<RichTextTools["language"]["options"]>().toEqualTypeOf<LanguageToolOptions>();
  expectTypeOf<RichTextTools["language"]["state"]>().toEqualTypeOf<LanguageToolState>();
  expectTypeOf<RichTextTools["language"]["commands"]>().toEqualTypeOf<LanguageToolCommands>();
  expectTypeOf(handle.tool("language")).toEqualTypeOf<LanguageToolCommands | null>();
}

function theShapes(handle: RichTextEditorHandle) {
  expectTypeOf<LanguageToolState>().toEqualTypeOf<{ current: string | null; primary: string }>();
  expectTypeOf(handle.tool("language")!.set("de")).toEqualTypeOf<boolean>();
  expectTypeOf(handle.tool("language")!.unset()).toEqualTypeOf<boolean>();
  tool("language", { languages: ["en", "de"] });
  tool("language");
}

function mistakes(handle: RichTextEditorHandle) {
  // @ts-expect-error the list of languages is strings
  tool("language", { languages: [1] });
  // @ts-expect-error the option is `languages`, not `documentLanguage` (ADR-0078)
  tool("language", { documentLanguage: "en" });
  // @ts-expect-error `set` takes the tag
  handle.tool("language")?.set();
  // @ts-expect-error there is no `toggle` for a language
  handle.tool("language")?.toggle();
}

test("the type checks above are compiled by tsc, not run", () => {
  expect([theMap, theShapes, mistakes]).toHaveLength(3);
});
