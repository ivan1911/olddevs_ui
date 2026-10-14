import { expect, expectTypeOf, test } from "vitest";
import type { RichTextEditorHandle, RichTextTools } from "../src/editor/index.js";

/**
 * Типы Команд Инструмента (OLDSUI-268): `handle.tool(name)` на публичном входе.
 * Проверяет `npm run typecheck`, а не Vitest: `expectTypeOf` и
 * `@ts-expect-error` во время работы ничего не делают. Настоящего Хэндла здесь
 * нет, поэтому проверки лежат в функциях, которые тест не зовёт: `tsc` читает их
 * тела так же, как исполняемый код.
 *
 * Свой Инструмент `acme_note` дописан в карту в `editor-tool-options-types.test.ts`:
 * объявление модуля общее на всю программу `tsc`.
 */

function nameInTheMap(handle: RichTextEditorHandle) {
  expectTypeOf(handle.tool("search")).toEqualTypeOf<RichTextTools["search"]["commands"] | null>();
  expectTypeOf(handle.tool("toc")).toEqualTypeOf<RichTextTools["toc"]["commands"] | null>();
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
}

function mistakes(handle: RichTextEditorHandle) {
  // @ts-expect-error `jumpTo` — Команда Оглавления, а не Поиска
  handle.tool("search")?.jumpTo(1);
  // @ts-expect-error `open` — Команда Поиска, а не Оглавления
  handle.tool("toc")?.open();
  // @ts-expect-error такой Команды нет ни у кого
  handle.tool("search")?.highlight("TODO");
  // @ts-expect-error индекс — число
  handle.tool("toc")?.jumpTo("2");
  // @ts-expect-error запрос — строка
  handle.tool("search")?.setQuery(1);
  // @ts-expect-error неизвестный флажок
  handle.tool("search")?.setQuery("TODO", { fuzzy: true });
  // @ts-expect-error замена — строка
  handle.tool("search")?.replace();
}

function outsideTheMap(handle: RichTextEditorHandle) {
  // Имя вне карты не ломает сборку: типизация добровольна.
  expectTypeOf(handle.tool("some_other")).toEqualTypeOf<unknown>();
  // Свой Инструмент, дописанный в карту, получает свои Команды.
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
