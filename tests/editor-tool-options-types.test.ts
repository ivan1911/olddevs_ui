import { expect, expectTypeOf, test } from "vitest";
import {
  RICH_TEXT_PRESETS,
  tool,
  type ConfiguredTool,
  type RichTextEditorProps,
  type RichTextTools,
  type Tool,
} from "../src/editor/index.js";

/**
 * Типы Опций встроенного Инструмента (OLDSUI-268): `tool()` и карта
 * `RichTextTools` на публичном входе. Проверяет `npm run typecheck`, а не
 * Vitest: `expectTypeOf` и `@ts-expect-error` во время работы ничего не делают.
 */

// Потребитель дописывает свой Инструмент в карту так же, как Tiptap дописывает
// `Commands`. Имя пакета разрешается на исходник через `paths` в tsconfig.json.
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
  // Параметры необязательны: запись без опций только включает Инструмент.
  expectTypeOf(tool("toc")).toEqualTypeOf<ConfiguredTool<"toc">>();
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
  // @ts-expect-error `matchCase` — опция Поиска, а не Оглавления
  tool("toc", { matchCase: true });
  // @ts-expect-error `offsetVar` — опция Оглавления, а не Поиска
  tool("search", { offsetVar: "--header-h" });
  // @ts-expect-error такой опции нет ни у кого
  tool("toc", { color: "red" });
  // @ts-expect-error уровни Оглавления — 1–4
  tool("toc", { levels: [5] });
  // @ts-expect-error флажок — булево
  tool("search", { regex: "yes" });
});

test("tool() does not take a name that has no options", () => {
  // @ts-expect-error у `bold` опций нет
  tool("bold", {});
  // @ts-expect-error и имени без опций тоже
  tool("history");
  // @ts-expect-error имя вне набора кита
  tool("nope", {});
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
  // Дописанный Инструмент не ломает `tool()` встроенных.
  expectTypeOf(tool("toc", { levels: [2] })).toEqualTypeOf<ConfiguredTool<"toc">>();
});
