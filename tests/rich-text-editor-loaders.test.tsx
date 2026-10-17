// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { createRef } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, expect, test, vi } from "vitest";
import {
  RICH_TEXT_PRESETS,
  RichTextEditor,
  type RichTextEditorHandle,
  type RichTextEditorProps,
} from "../src/editor/index.js";
import { resetDevWarnings } from "../src/lib/dev-warn.js";
import { testLazyTool } from "./editor-test-tools.js";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  resetDevWarnings();
});

/**
 * Loaders of custom Tools, Readiness, the Skeleton and "Retry" (OLDSUI-110,
 * ADR-0058, items 11.3–11.6). Through the public `RichTextEditor`: what the author
 * sees (the Document, roles, the field error) and what the screen gets (the
 * Handle, `onReady`). The Skeleton's height is checked in the browser
 * (`tests-visual/rich-text-editor-skeleton.spec.ts`).
 */

const VALUE = '<p>Before</p><div data-block="test_lazy">Lazy text</div>';

function renderEditor(props: Partial<RichTextEditorProps>) {
  const ref = createRef<RichTextEditorHandle>();
  const onReady = vi.fn();
  const view = render(
    <RichTextEditor ref={ref} aria-label="Body" value={VALUE} onReady={onReady} {...props} />
  );
  return { ...view, ref, onReady };
}

/** The loader promises and the Editor's effects have run. */
const settle = () =>
  act(async () => void (await new Promise((resolve) => setTimeout(resolve, 10))));

test("until the loader settles: the Skeleton shows the Document, no input, a quiet Handle, no onReady", async () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  const lazy = testLazyTool();
  const { ref, onReady, container } = renderEditor({
    tools: [...RICH_TEXT_PRESETS.basic, lazy.tool],
  });
  await settle();

  expect(lazy.loader.calls).toBe(1);
  // The Document is visible as static HTML, and so is the Block of its Tool; there is no input.
  expect(screen.getByText("Before")).toBeTruthy();
  expect(screen.getByText("Lazy text")).toBeTruthy();
  expect(screen.queryByRole("textbox")).toBeNull();
  expect(container.querySelector("[contenteditable]")).toBeNull();
  // The Handle is quiet: there is no engine, a write does not go through, and a read returns the incoming value.
  expect(ref.current?.editor).toBeNull();
  expect(ref.current?.insertHTML("<p>Template</p>")).toBe(false);
  expect(ref.current?.getHTML()).toBe(VALUE);
  expect(onReady).not.toHaveBeenCalled();
  expect(error).not.toHaveBeenCalled();

  lazy.resolve();
  await settle();

  expect(screen.getByRole("textbox", { name: "Body" })).toBeTruthy();
  expect(onReady).toHaveBeenCalledTimes(1);
  expect(ref.current?.editor).not.toBeNull();
  // The Schema is built with the Extensions already: the Block from `value` was not lost.
  expect(ref.current?.getHTML()).toBe(VALUE);
  expect(ref.current?.insertHTML("<p>Template</p>")).toBe(true);
  // The Skeleton is gone: one Document is on screen.
  expect(screen.getAllByText("Lazy text")).toHaveLength(1);
});

test("two editors with one loader call it once", async () => {
  const lazy = testLazyTool();
  const first = renderEditor({ tools: [lazy.tool] });
  const second = renderEditor({ tools: [lazy.tool] });
  lazy.resolve();
  await settle();

  expect(lazy.loader.calls).toBe(1);
  expect(first.onReady).toHaveBeenCalledTimes(1);
  expect(second.onReady).toHaveBeenCalledTimes(1);
  expect(screen.getAllByRole("textbox")).toHaveLength(2);
});

test("a failed loader: a field error with Retry, the Document stays; Retry reaches Readiness", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const lazy = testLazyTool();
  const { ref, onReady } = renderEditor({ tools: [lazy.tool] });
  lazy.reject();
  await settle();

  expect(screen.getByRole("alert").textContent).toBe(
    "The editor couldn't start. The document is unchanged."
  );
  expect(screen.getByText("Lazy text")).toBeTruthy();
  expect(screen.queryByRole("textbox")).toBeNull();
  expect(ref.current?.editor).toBeNull();
  expect(onReady).not.toHaveBeenCalled();

  await userEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(lazy.loader.calls).toBe(2);
  // While the retry runs, it is the Skeleton again, without an error.
  expect(screen.queryByRole("alert")).toBeNull();
  lazy.resolve();
  await settle();

  expect(screen.getByRole("textbox", { name: "Body" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
  expect(onReady).toHaveBeenCalledTimes(1);
  expect(ref.current?.getHTML()).toBe(VALUE);
});

test("Retry calls only the loaders that failed", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const fine = testLazyTool();
  const broken = testLazyTool("test_broken");
  renderEditor({ tools: [fine.tool, broken.tool] });
  fine.resolve();
  broken.reject();
  await settle();

  await userEvent.click(screen.getByRole("button", { name: "Retry" }));
  broken.resolve();
  await settle();

  expect(fine.loader.calls).toBe(1);
  expect(broken.loader.calls).toBe(2);
  expect(screen.getByRole("textbox", { name: "Body" })).toBeTruthy();
});

test("the loaded engine is checked like an immediate one: a broken set is a field error without Retry", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  // The loader returned Extensions with no Node for the Block in the rules.
  const lazy = testLazyTool("test_lazy", []);
  const { ref, onReady } = renderEditor({ tools: [lazy.tool] });
  lazy.resolve();
  await settle();

  expect(screen.getByRole("alert").textContent).toBe(
    "The editor couldn't start. The document is unchanged."
  );
  // Retry will not help: the set will not change.
  expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
  expect(screen.getByText("Lazy text")).toBeTruthy();
  expect(ref.current?.editor).toBeNull();
  expect(onReady).not.toHaveBeenCalled();
});

test("the server renders the Skeleton without the Document; hydration matches, then the Document shows", async () => {
  const onRecoverableError = vi.fn();
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  const lazy = testLazyTool();
  const ui = <RichTextEditor aria-label="Body" value={VALUE} tools={[lazy.tool]} />;

  const html = renderToString(ui);
  expect(html).not.toContain("Lazy text");
  expect(html).not.toMatch(/ contenteditable="/);

  const container = document.createElement("div");
  container.innerHTML = html;
  document.body.append(container);
  await act(async () => void hydrateRoot(container, ui, { onRecoverableError }));
  // After hydration the Skeleton shows the Document, cleaned by the Schema.
  expect(container.textContent).toContain("Lazy text");
  lazy.resolve();
  await settle();

  expect(onRecoverableError).not.toHaveBeenCalled();
  expect(error).not.toHaveBeenCalled();
  expect(container.querySelector("[contenteditable=true]")).not.toBeNull();
  container.remove();
});

test("without loaders the Skeleton is there too: the server renders the frame, not the Document", () => {
  const html = renderToString(<RichTextEditor aria-label="Body" value="<p>Static text</p>" />);

  expect(html).not.toContain("Static text");
  // The frame with room for the Toolbar is there on the server too: the Toolbar appearing does not shift the field.
  expect(html).toContain("h-[30px]");
});
