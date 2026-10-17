import { expect, expectTypeOf, test } from "vitest";
import type { RefObject } from "react";
import {
  useRichTextToolState,
  type RichTextEditorHandle,
  type RichTextToolState,
  type InvisibleCharactersToolState,
  type SearchToolState,
  type TocToolState,
} from "../src/editor/index.js";

/**
 * Tool state types (OLDSUI-268): `useRichTextToolState` on the public entry point.
 * Checked by `npm run typecheck`, not by Vitest: `expectTypeOf` and `@ts-expect-error`
 * do nothing at run time, and hooks outside a render are not called, so the functions
 * below are only compiled.
 */

declare module "@olddevs/ui/editor" {
  interface RichTextTools {
    acme_counter: {
      options: { step: number };
      state: { count: number; labels: readonly string[] };
      commands: { reset(): boolean };
    };
  }
}

type Ref = RefObject<RichTextEditorHandle | null>;

test("the type of the snapshot comes from the name of the tool", () => {
  function Screen(ref: Ref) {
    const search = useRichTextToolState(ref, "search");
    const toc = useRichTextToolState(ref, "toc");
    expectTypeOf(search).toEqualTypeOf<SearchToolState | null>();
    expectTypeOf(toc).toEqualTypeOf<TocToolState | null>();
    expectTypeOf(search?.total).toEqualTypeOf<number | undefined>();
    expectTypeOf(toc?.headings[0]?.level).toEqualTypeOf<1 | 2 | 3 | 4 | undefined>();
    expectTypeOf<RichTextToolState<"search">>().toEqualTypeOf<SearchToolState>();
    const invisible = useRichTextToolState(ref, "invisibleCharacters");
    expectTypeOf(invisible).toEqualTypeOf<InvisibleCharactersToolState | null>();
    expectTypeOf(invisible?.visible).toEqualTypeOf<boolean | undefined>();
  }
  expect(Screen).toBeTypeOf("function");
});

test("the type of the selector's slice comes from the name too", () => {
  function Screen(ref: Ref) {
    const total = useRichTextToolState(ref, "search", (state) => state.total);
    const flags = useRichTextToolState(ref, "search", (state) => state.flags);
    const texts = useRichTextToolState(ref, "toc", (state) =>
      state.headings.map((heading) => heading.text)
    );
    expectTypeOf(total).toEqualTypeOf<number | null>();
    expectTypeOf(flags).toEqualTypeOf<Readonly<{
      matchCase: boolean;
      wholeWord: boolean;
      regex: boolean;
    }> | null>();
    expectTypeOf(texts).toEqualTypeOf<string[] | null>();
  }
  expect(Screen).toBeTypeOf("function");
});

test("a field that the snapshot does not have does not compile", () => {
  function Screen(ref: Ref) {
    // @ts-expect-error the Find state has no match positions
    useRichTextToolState(ref, "search", (state) => state.matches);
    // @ts-expect-error headings belong to the Table of contents, not to Find
    useRichTextToolState(ref, "search", (state) => state.headings);
    // @ts-expect-error the query belongs to Find, not to the Table of contents
    useRichTextToolState(ref, "toc", (state) => state.query);
  }
  expect(Screen).toBeTypeOf("function");
});

test("a tool added to the map is typed, one that is not is unknown", () => {
  function Screen(ref: Ref) {
    const counter = useRichTextToolState(ref, "acme_counter");
    const count = useRichTextToolState(ref, "acme_counter", (state) => state.count);
    const other = useRichTextToolState(ref, "acme_other");
    expectTypeOf(counter).toEqualTypeOf<{ count: number; labels: readonly string[] } | null>();
    expectTypeOf(count).toEqualTypeOf<number | null>();
    expectTypeOf(other).toBeUnknown();
    // @ts-expect-error the snapshot of an unknown Tool is `unknown`, it has no fields
    useRichTextToolState(ref, "acme_other", (state) => state.count);
  }
  expect(Screen).toBeTypeOf("function");
});

test("the snapshot carries no DOM nodes or functions", () => {
  expectTypeOf<SearchToolState>().not.toHaveProperty("matches");
  expectTypeOf<TocToolState["headings"][number]>().toEqualTypeOf<{
    level: 1 | 2 | 3 | 4;
    text: string;
    index: number;
  }>();
});
