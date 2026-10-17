import { expect, expectTypeOf, test } from "vitest";
import type { RichTextEditorHandle, RichTextTools } from "../src/editor/index.js";

/**
 * Tool commands types (OLDSUI-268): `handle.tool(name)` on the public entry point.
 * Checked by `npm run typecheck`, not by Vitest: `expectTypeOf` and `@ts-expect-error`
 * do nothing at run time. There is no real Handle here, so the checks live in functions
 * that the test does not call: `tsc` reads their bodies the same way as executable code.
 *
 * The custom Tool `acme_note` is added to the map in `editor-tool-options-types.test.ts`:
 * a module declaration is shared by the whole `tsc` program.
 */

function nameInTheMap(handle: RichTextEditorHandle) {
  expectTypeOf(handle.tool("search")).toEqualTypeOf<RichTextTools["search"]["commands"] | null>();
  expectTypeOf(handle.tool("toc")).toEqualTypeOf<RichTextTools["toc"]["commands"] | null>();
  expectTypeOf(handle.tool("invisibleCharacters")).toEqualTypeOf<
    RichTextTools["invisibleCharacters"]["commands"] | null
  >();
}

function booleanAnswers(handle: RichTextEditorHandle) {
  const search = handle.tool("search")!;
  const toc = handle.tool("toc")!;

  expectTypeOf(search.open()).toEqualTypeOf<boolean>();
  expectTypeOf(search.open({ replace: true, query: "TODO" })).toEqualTypeOf<boolean>();
  expectTypeOf(search.close()).toEqualTypeOf<boolean>();
  expectTypeOf(search.setQuery("TODO", { matchCase: true })).toEqualTypeOf<boolean>();
  expectTypeOf(search.next()).toEqualTypeOf<boolean>();
  expectTypeOf(search.previous()).toEqualTypeOf<boolean>();
  expectTypeOf(search.replace("DONE")).toEqualTypeOf<boolean>();
  expectTypeOf(search.replaceAll("DONE")).toEqualTypeOf<boolean>();
  expectTypeOf(toc.jumpTo(2)).toEqualTypeOf<boolean>();
  expectTypeOf(handle.tool("invisibleCharacters")!.toggle()).toEqualTypeOf<boolean>();
}

function mistakes(handle: RichTextEditorHandle) {
  // @ts-expect-error `jumpTo` is a Table of contents command, not a Find one
  handle.tool("search")?.jumpTo(1);
  // @ts-expect-error `open` is a Find command, not a Table of contents one
  handle.tool("toc")?.open();
  // @ts-expect-error invisible characters have one command, `toggle`: `show` and `hide` are not defined
  handle.tool("invisibleCharacters")?.show();
  // @ts-expect-error no Tool has such a command
  handle.tool("search")?.highlight("TODO");
  // @ts-expect-error the index is a number
  handle.tool("toc")?.jumpTo("2");
  // @ts-expect-error the query is a string
  handle.tool("search")?.setQuery(1);
  // @ts-expect-error an unknown flag
  handle.tool("search")?.setQuery("TODO", { fuzzy: true });
  // @ts-expect-error the replacement is a string
  handle.tool("search")?.replace();
}

function outsideTheMap(handle: RichTextEditorHandle) {
  // A name outside the map does not break the build: typing is optional.
  expectTypeOf(handle.tool("some_other")).toEqualTypeOf<unknown>();
  // A custom Tool added to the map gets its own commands.
  expectTypeOf(handle.tool("acme_note")).toEqualTypeOf<{ clear(): boolean } | null>();
  expectTypeOf(handle.tool("acme_note")?.clear()).toEqualTypeOf<boolean | undefined>();
}

function deprecatedMethod(handle: RichTextEditorHandle) {
  expectTypeOf(handle.openSearch).parameter(0).toEqualTypeOf<{ replace?: boolean } | undefined>();
}

test("the type checks compile (npm run typecheck reads their bodies)", () => {
  for (const check of [nameInTheMap, booleanAnswers, mistakes, outsideTheMap, deprecatedMethod]) {
    expect(check).toBeTypeOf("function");
  }
});
