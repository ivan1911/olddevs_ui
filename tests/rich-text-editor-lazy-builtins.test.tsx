// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, expect, test, vi } from "vitest";
import {
  RichTextEditor,
  type RichTextEditorHandle,
  type RichTextEditorProps,
} from "../src/editor/index.js";

afterEach(cleanup);

/**
 * Lazy built-in `codeBlock` and `table` (OLDSUI-111, ADR-0058, item 11.1): their
 * Extensions load through the same loader as those of a custom Tool. `basic`,
 * where they are absent, does not load them at all and is ready at once; `full`
 * shows the Skeleton until both chunks load, and reaches Readiness after them.
 *
 * The chunk module is replaced by a wrapper that only records the import, so it
 * is visible whether it was called. The replacement sits at the network boundary,
 * not in the internals: the chunk's content is real.
 */
const imported = vi.hoisted(() => [] as string[]);

vi.mock("../src/editor/features/code/codeBlock.js", async (original) => {
  imported.push("codeBlock");
  return original();
});

vi.mock("../src/editor/features/table/tables.js", async (original) => {
  imported.push("table");
  return original();
});

const VALUE =
  '<p>Intro</p><pre><code class="language-python">print(1)</code></pre>' +
  "<table><tbody><tr><th><p>Name</p></th></tr><tr><td><p>Ada</p></td></tr></tbody></table>";

function renderEditor(props: Partial<RichTextEditorProps>) {
  const ref = createRef<RichTextEditorHandle>();
  const onReady = vi.fn();
  const view = render(<RichTextEditor ref={ref} aria-label="Body" onReady={onReady} {...props} />);
  return { ...view, ref, onReady };
}

/** The timers and the Editor's effects have run. */
const settle = () =>
  act(async () => void (await new Promise((resolve) => setTimeout(resolve, 20))));

// The order of the tests matters: the loader's cache lives on the module, and the first `full` warms it up.

test("basic loads neither chunk and is ready inside render", async () => {
  const { ref, onReady } = renderEditor({ preset: "basic", value: "<p>Comment</p>" });

  expect(ref.current?.editor).not.toBeNull();
  expect(onReady).toHaveBeenCalledTimes(1);
  await settle();
  expect(imported).toEqual([]);
});

test("full shows the Skeleton until both chunks load, then reaches Readiness without losing blocks", async () => {
  const { ref, onReady, container } = renderEditor({ value: VALUE });

  // Skeleton while the chunks are on the way: the Document as static HTML, no input, no Readiness.
  expect(screen.getByText("print(1)")).toBeTruthy();
  expect(screen.getByText("Ada")).toBeTruthy();
  expect(container.querySelector("[contenteditable]")).toBeNull();
  expect(ref.current?.editor).toBeNull();
  expect(onReady).not.toHaveBeenCalled();
  // The Blocks show their own shape, not plain text: a code Block with its language
  // and header, and a table with its header row, so the field does not jump when
  // the chunks arrive.
  expect(container.querySelector("pre > code.language-python")?.textContent).toBe("print(1)");
  expect(container.querySelector("[data-code-header]")?.textContent).toBe("Python");
  expect(container.querySelector("table > tbody > tr > th")?.textContent).toBe("Name");

  expect(await screen.findByRole("textbox", { name: "Body" }, { timeout: 10_000 })).toBeTruthy();
  expect([...imported].sort()).toEqual(["codeBlock", "table"]);
  expect(onReady).toHaveBeenCalledTimes(1);
  // The Schema is built with the Extensions of both Tools: the code Block with its language and the table from `value` are in place.
  expect(ref.current?.getHTML()).toBe(VALUE);
  // The Table menu and the insert dialog come from the same chunk.
  expect(screen.getByRole("button", { name: "Table" })).toBeTruthy();
});

test("a second full editor finds the chunks loaded and is ready inside render", () => {
  const { ref, onReady } = renderEditor({ value: VALUE });

  expect(ref.current?.editor).not.toBeNull();
  expect(onReady).toHaveBeenCalledTimes(1);
  expect(ref.current?.getHTML()).toBe(VALUE);
});
