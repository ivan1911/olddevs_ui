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
 * A table is content, even when empty (OLDSUI-119). Tiptap counts a Document made of
 * a single table with empty cells as empty (`editor.isEmpty`), and the kit followed
 * it: `isEmpty()` returned `true`, the value went out as an empty string, and the table
 * disappeared on save. The kit's emptiness rule: an atom and a table are content, and an
 * empty paragraph is not: one rule for `isEmpty()`, `required` and the value.
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
  Without the `table` Tool, the Schema drops the table on parsing, and an empty
  table is an empty field. Before mounting, the answer must match the answer after:
  the string is not parsed yet, but the Handle knows whether the table is in the Schema.
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
