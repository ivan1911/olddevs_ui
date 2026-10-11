// @vitest-environment jsdom
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import {
  RichTextEditor,
  type RichTextEditorHandle,
  type RichTextEditorProps,
} from "../src/editor/index.js";
import { loadLazyBuiltins } from "./editor-lazy-builtins.js";

beforeAll(loadLazyBuiltins);
afterEach(cleanup);

/**
 * Таблица — содержимое, даже пустая (OLDSUI-119). Tiptap считает Документ из
 * одной таблицы с пустыми ячейками пустым (`editor.isEmpty`), и кит повторял
 * за ним: `isEmpty()` давал `true`, значение уходило пустой строкой, и таблица
 * пропадала при сохранении. Правило пустоты кита — атом и таблица содержимое,
 * пустой абзац нет — одно для `isEmpty()`, `required` и значения.
 */
const EMPTY_TABLE =
  "<table><tbody><tr><th><p></p></th><th><p></p></th></tr>" +
  "<tr><td><p></p></td><td><p></p></td></tr></tbody></table>";

function renderForm(props: Partial<RichTextEditorProps> = {}) {
  const submitted: FormData[] = [];
  const ref = createRef<RichTextEditorHandle>();
  const view = render(
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submitted.push(new FormData(event.currentTarget));
      }}
    >
      <RichTextEditor ref={ref} aria-label="Body" name="body" {...props} />
    </form>
  );
  const form = view.container.querySelector("form")!;
  return { ...view, form, submitted, handle: () => ref.current! };
}

test("a document of one empty table is not empty, and getHTML keeps the table", () => {
  const { handle } = renderForm({ defaultValue: EMPTY_TABLE });

  expect(handle().isEmpty()).toBe(false);
  expect(handle().getHTML()).toContain("<table");
});

test("a required field with only an empty table submits, and the table reaches FormData", () => {
  const { form, submitted } = renderForm({ defaultValue: EMPTY_TABLE, required: true });

  expect(form.checkValidity()).toBe(true);
  act(() => form.requestSubmit());

  expect(submitted).toHaveLength(1);
  expect(submitted[0]?.get("body")).toContain("<table");
});

test("inserting a table into an empty document reports the table, not an empty string", async () => {
  const onChange = vi.fn();
  const { handle, container } = renderForm({ defaultValue: "<p></p>", onChange });

  act(() => void handle().insertHTML(EMPTY_TABLE));

  await waitFor(() => expect(onChange).toHaveBeenCalled());
  expect(onChange.mock.lastCall?.[0]).toContain("<table");
  expect(container.querySelector<HTMLInputElement>('input[name="body"]')?.value).toContain(
    "<table"
  );
});

test("an empty paragraph is still an empty document", () => {
  const { handle, form } = renderForm({ defaultValue: "<p></p>", required: true });

  expect(handle().isEmpty()).toBe(true);
  expect(handle().getHTML()).toBe("");
  expect(form.checkValidity()).toBe(false);
});

test("before mount a table is content too", () => {
  let empty: boolean | undefined;
  render(
    <RichTextEditor
      aria-label="Body"
      value={EMPTY_TABLE}
      ref={(handle) => {
        if (handle && empty === undefined) empty = handle.isEmpty();
      }}
    />
  );

  expect(empty).toBe(false);
});

/*
  Без инструмента `table` Схема выбрасывает таблицу при разборе, и пустая
  таблица — пустое поле. До монтажа ответ обязан совпасть с ответом после:
  строка ещё не разобрана, но Хэндл знает, есть ли таблица в Схеме.
*/
test("with the table tool off an empty table is an empty field, before and after mount", () => {
  let before: boolean | undefined;
  let handle: RichTextEditorHandle | null = null;
  render(
    <RichTextEditor
      aria-label="Body"
      preset="basic"
      defaultValue={EMPTY_TABLE}
      ref={(current) => {
        handle = current;
        if (current && before === undefined) before = current.isEmpty();
      }}
    />
  );

  expect(before).toBe(true);
  expect(handle!.isEmpty()).toBe(true);
});
