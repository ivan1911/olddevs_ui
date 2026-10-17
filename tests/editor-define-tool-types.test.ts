import { expect, expectTypeOf, test } from "vitest";
import type { RefObject } from "react";
import {
  defineTool,
  RICH_TEXT_PRESETS,
  tool,
  useRichTextToolState,
  type ConfiguredTool,
  type RichTextEditorHandle,
  type RichTextEditorProps,
  type Tool,
  type ToolDefinition,
} from "../src/editor/index.js";

/**
 * Types of `defineTool` (OLDSUI-268): options are inferred from `defaults`, and a Tool added to
 * the tools map is typed in `tool()`, the hook and `handle.tool()`; one not added
 * is `unknown`. Checked by `npm run typecheck`, not by Vitest.
 */

declare module "@olddevs/ui/editor" {
  interface RichTextTools {
    acme_mention: {
      options: { labels: { insert: string }; limit: number };
      state: { mentions: number };
      commands: { insert(name: string): boolean };
    };
  }
}

const mention = defineTool({
  name: "acme_mention",
  defaults: { labels: { insert: "Mention", remove: "Remove" }, limit: 5, tags: ["a"] },
  create: (options) => {
    expectTypeOf(options).toEqualTypeOf<{
      labels: { insert: string; remove: string };
      limit: number;
      tags: string[];
    }>();
    return { engine: [] };
  },
  state: ({ options }) => ({ mentions: options.limit }),
  commands: ({ options }) => ({ insert: (name: string) => name.length < options.limit }),
});

// A definition without a map: the Tool is not added, so its state and command types are `unknown`.
const plain = defineTool({
  name: "acme_plain",
  defaults: { size: 1 },
  create: () => ({ engine: [] }),
});

type Ref = RefObject<RichTextEditorHandle | null>;

test("defineTool returns a definition, and the options type comes from defaults", () => {
  expectTypeOf(mention).toExtend<ToolDefinition>();
  expectTypeOf(mention.defaults).toEqualTypeOf<{
    labels: { insert: string; remove: string };
    limit: number;
    tags: string[];
  }>();
  expect(mention.name).toBe("acme_mention");
});

test("tool(definition, options) takes a partial of the defaults, nested ones too", () => {
  const labels = tool(mention, { labels: { insert: "Tag a colleague" } });
  const limit = tool(mention, { limit: 10, tags: ["x", "y"] });
  expectTypeOf(labels).toEqualTypeOf<ConfiguredTool<"acme_mention">>();
  expectTypeOf(tool(plain)).toEqualTypeOf<ConfiguredTool<"acme_plain">>();
  expect([labels, limit]).toHaveLength(2);
});

test("a wrong option of a definition does not compile", () => {
  // @ts-expect-error there is no such option in `defaults`
  tool(mention, { colour: "red" });
  // @ts-expect-error the limit is a number
  tool(mention, { limit: "ten" });
  // @ts-expect-error the nested option is a string
  tool(mention, { labels: { insert: 1 } });
  // @ts-expect-error there is no nested option in `defaults`
  tool(mention, { labels: { insert2: "x" } });
});

test("a definition and a Configured Tool of a definition are elements of tools", () => {
  const tools: RichTextEditorProps["tools"] = [
    ...RICH_TEXT_PRESETS.full,
    mention,
    tool(plain, { size: 2 }),
    tool("toc", { levels: [2] }),
    { name: "acme_old", engine: [] },
  ];
  expectTypeOf(mention).toExtend<Tool>();
  expectTypeOf(tool(mention)).toExtend<Tool>();
  expect(tools).toHaveLength(RICH_TEXT_PRESETS.full.length + 4);
});

test("the name of a definition needs a consumer prefix in the type", () => {
  // @ts-expect-error a name without the consumer prefix
  defineTool({ name: "mention", defaults: {}, create: () => ({ engine: [] }) });
});

test("the body of create() is the shape of CustomTool without the name", () => {
  defineTool({
    name: "acme_body",
    defaults: {},
    // @ts-expect-error Extensions are required
    create: () => ({}),
  });
});

test("a tool added to the map is typed in the hook and in handle.tool(), one that is not is unknown", () => {
  function Screen(ref: Ref) {
    const mentions = useRichTextToolState(ref, "acme_mention", (state) => state.mentions);
    const other = useRichTextToolState(ref, "acme_plain");
    expectTypeOf(mentions).toEqualTypeOf<number | null>();
    expectTypeOf(other).toBeUnknown();

    const commands = ref.current?.tool("acme_mention");
    expectTypeOf(commands).toEqualTypeOf<{ insert(name: string): boolean } | null | undefined>();
    expectTypeOf(ref.current?.tool("acme_plain")).toBeUnknown();
  }
  expect(Screen).toBeTypeOf("function");
});
