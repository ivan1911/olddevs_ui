import { expect, expectTypeOf, test } from "vitest";
import {
  RICH_TEXT_PRESETS,
  tool,
  type ConfiguredTool,
  type RichTextEditorProps,
  type RichTextTools,
  type Tool,
  type VideoToolOptions,
} from "../src/editor/index.js";

/**
 * Types of built-in Tool options (OLDSUI-268): `tool()` and the `RichTextTools` map
 * on the public entry point. Checked by `npm run typecheck`, not by Vitest:
 * `expectTypeOf` and `@ts-expect-error` do nothing at run time.
 */

// A consumer adds its own Tool to the map the same way Tiptap adds to `Commands`.
// The package name resolves to the source via `paths` in tsconfig.json.
declare module "@olddevs/ui/editor" {
  interface RichTextTools {
    acme_note: {
      options: { tone: "info" | "warning" };
      state: { count: number };
      commands: { clear(): boolean };
    };
  }
}

test("tool() takes the options of the tool it names and returns a Configured Tool", () => {
  const toc = tool("toc", { offsetVar: "--header-h", levels: [2, 3], listWidth: "20rem" });
  const search = tool("search", { matchCase: true });

  expectTypeOf(toc).toEqualTypeOf<ConfiguredTool<"toc">>();
  expectTypeOf(search).toEqualTypeOf<ConfiguredTool<"search">>();
  // The options are optional: an entry without options only switches the Tool on.
  expectTypeOf(tool("toc")).toEqualTypeOf<ConfiguredTool<"toc">>();
  expectTypeOf(tool("invisibleCharacters", { visible: true })).toEqualTypeOf<
    ConfiguredTool<"invisibleCharacters">
  >();
  expect(toc).toBeDefined();
});

test("a Configured Tool is an element of tools next to names and presets", () => {
  const tools: RichTextEditorProps["tools"] = [
    ...RICH_TEXT_PRESETS.full,
    tool("toc", { levels: [2, 3] }),
    tool("search", { matchCase: true }),
  ];
  expectTypeOf(tool("toc")).toExtend<Tool>();
  expectTypeOf<"bold">().toExtend<Tool>();
  expect(tools).toHaveLength(RICH_TEXT_PRESETS.full.length + 2);
});

test("the options of another tool, an unknown option and a wrong value do not compile", () => {
  // @ts-expect-error `matchCase` is a Find option, not a Table of contents one
  tool("toc", { matchCase: true });
  // @ts-expect-error `offsetVar` is a Table of contents option, not a Find one
  tool("search", { offsetVar: "--header-h" });
  // @ts-expect-error no Tool has such an option
  tool("toc", { color: "red" });
  // @ts-expect-error Table of contents levels are 1–4
  tool("toc", { levels: [5] });
  // @ts-expect-error the flag is a boolean
  tool("search", { regex: "yes" });
  // @ts-expect-error `visible` is a boolean
  tool("invisibleCharacters", { visible: "yes" });
  // @ts-expect-error `persist` is an option of the Details Block, not of invisible characters
  tool("invisibleCharacters", { persist: true });
  // @ts-expect-error `fullWidth` is a boolean
  tool("fullscreen", { fullWidth: "yes" });
});

test("typography takes the quote set and a rule as false or a string (OLDSUI-279)", () => {
  const typography = tool("typography", {
    quotes: "ru",
    emDash: false,
    ellipsis: "...",
    openDoubleQuote: "[",
  });
  expectTypeOf(typography).toEqualTypeOf<ConfiguredTool<"typography">>();
  expectTypeOf(tool("typography")).toExtend<Tool>();
  // @ts-expect-error the quote set is "auto", "ru" or "en"
  tool("typography", { quotes: "de" });
  // @ts-expect-error a rule is false or a string, not true
  tool("typography", { emDash: true });
  // @ts-expect-error Typography has no such rule
  tool("typography", { semicolon: ";" });
  expect(typography).toBeDefined();
});

test("tool() does not take a name that has no options", () => {
  // @ts-expect-error `bold` has no options
  tool("bold", {});
  // @ts-expect-error and so does a name without options
  tool("history");
  // @ts-expect-error a name outside the kit's set
  tool("nope", {});
});

test("a Tool with only state and commands is not configurable by name (OLDSUI-307), one with options is", () => {
  // @ts-expect-error `blockSelection` has state and commands, and no options
  tool("blockSelection");
  // @ts-expect-error `blockSelection` has no options to pass
  tool("blockSelection", {});
  // `language` has options (OLDSUI-308), and stays configurable next to it.
  expect(tool("language", {})).toBeDefined();
});

test("the map reads the options of a tool by its name", () => {
  expectTypeOf<RichTextTools["toc"]["options"]>().toEqualTypeOf<{
    offsetVar: string;
    levels: readonly (1 | 2 | 3 | 4)[];
    listWidth: number | string;
  }>();
  expectTypeOf<RichTextTools["search"]["options"]>().toEqualTypeOf<{
    matchCase: boolean;
    wholeWord: boolean;
    regex: boolean;
  }>();
});

test("a consumer extends the map through declare module with the package name", () => {
  expectTypeOf<RichTextTools["acme_note"]["options"]>().toEqualTypeOf<{
    tone: "info" | "warning";
  }>();
  expectTypeOf<RichTextTools["acme_note"]["state"]>().toEqualTypeOf<{ count: number }>();
  expectTypeOf<RichTextTools["acme_note"]["commands"]>().toEqualTypeOf<{ clear(): boolean }>();
  // A Tool added to the map does not break the built-in `tool()` calls.
  expectTypeOf(tool("toc", { levels: [2] })).toEqualTypeOf<ConfiguredTool<"toc">>();
});

test("youtube and twitch take autoload as a boolean and nothing else (OLDSUI-287)", () => {
  const youtube = tool("youtube", { autoload: false });
  const twitch = tool("twitch", { autoload: true });
  expectTypeOf(youtube).toEqualTypeOf<ConfiguredTool<"youtube">>();
  expectTypeOf(twitch).toEqualTypeOf<ConfiguredTool<"twitch">>();
  // The options are optional: an entry without options only switches the Tool on.
  expectTypeOf(tool("youtube")).toEqualTypeOf<ConfiguredTool<"youtube">>();
  expectTypeOf(tool("twitch")).toExtend<Tool>();
  expectTypeOf<RichTextTools["youtube"]["options"]>().toEqualTypeOf<VideoToolOptions>();
  expectTypeOf<RichTextTools["twitch"]["options"]>().toEqualTypeOf<{ autoload: boolean }>();
  expectTypeOf<VideoToolOptions>().toEqualTypeOf<{ autoload: boolean }>();
  // @ts-expect-error `autoload` is a boolean
  tool("youtube", { autoload: "no" });
  // @ts-expect-error videos have no such option
  tool("twitch", { autoplay: true });
  // @ts-expect-error `matchCase` is a Find option, not a video one
  tool("youtube", { matchCase: true });
  expect([youtube, twitch]).toHaveLength(2);
});
