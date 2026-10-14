// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { createRef } from "react";
import { afterEach, beforeAll, beforeEach, expect, test, vi } from "vitest";
import {
  RICH_TEXT_PRESETS,
  RichTextEditor,
  type RichTextEditorHandle,
  type RichTextEditorProps,
} from "../src/editor/index.js";
import { loadLazyBuiltins } from "./editor-lazy-builtins.js";

/**
 * Инструмент `toc` (OLDSUI-271, ADR-0068): Оглавление в левом поле Редактора.
 * Проверки — через публичный `RichTextEditor` с `tools`, как его включит экран.
 */

beforeAll(loadLazyBuiltins);

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const ARTICLE =
  "<h2>Palette</h2><p>Intro</p><h3>How to read</h3><p>Text</p><h2>What's next</h2><p>Outro</p>";

const WITH_TOC: RichTextEditorProps["tools"] = [...RICH_TEXT_PRESETS.full, "toc"];

function renderEditor(props: Partial<RichTextEditorProps> = {}) {
  const ref = createRef<RichTextEditorHandle>();
  const { container } = render(
    <RichTextEditor ref={ref} aria-label="Body" tools={WITH_TOC} {...props} />
  );
  return { ref, root: container.firstElementChild! };
}

const strip = () => screen.queryByRole("button", { name: "Table of contents" });

async function openList(user: ReturnType<typeof userEvent.setup>) {
  await user.click(strip()!);
  return within(screen.getByRole("navigation", { name: "Table of contents" })).getAllByRole(
    "button"
  );
}

test("the presets do not contain toc: the tool is switched on only by name", () => {
  expect(RICH_TEXT_PRESETS.full).not.toContain("toc");
  expect(RICH_TEXT_PRESETS.basic).not.toContain("toc");
});

test("with toc the Editor draws the table of contents inside its own frame", async () => {
  const { root } = renderEditor({ defaultValue: ARTICLE });
  await waitFor(() => expect(strip()).not.toBeNull());
  expect(root.contains(strip())).toBe(true);
  expect(strip()!.querySelectorAll("[data-toc-stroke]")).toHaveLength(3);
});

test("without toc there is no table of contents", async () => {
  renderEditor({ defaultValue: ARTICLE, tools: RICH_TEXT_PRESETS.full });
  await act(async () => {});
  expect(strip()).toBeNull();
});

test("the gutter appears with the second heading and goes away with it", async () => {
  const { ref } = renderEditor({ defaultValue: "<h2>Only</h2><p>Text</p>" });
  await act(async () => {});
  expect(strip()).toBeNull();
  expect(document.querySelector("[data-toc-gutter]")).toBeNull();

  act(() => ref.current!.editor!.commands.setContent("<h2>One</h2><p>Text</p><h2>Two</h2>"));
  await waitFor(() => expect(strip()).not.toBeNull());
  expect(document.querySelector("[data-toc-gutter]")).not.toBeNull();

  act(() => ref.current!.editor!.commands.setContent("<p>No headings</p>"));
  await waitFor(() => expect(strip()).toBeNull());
  expect(document.querySelector("[data-toc-gutter]")).toBeNull();
});

test("in an editable Editor a jump puts the caret at the end of the heading", async () => {
  const user = userEvent.setup();
  const { ref } = renderEditor({ defaultValue: ARTICLE });
  await waitFor(() => expect(strip()).not.toBeNull());

  const items = await openList(user);
  await user.click(items[1]!);

  const editor = ref.current!.editor!;
  expect(editor.isFocused).toBe(true);
  const { $from, empty } = editor.state.selection;
  expect(empty).toBe(true);
  expect($from.parent.type.name).toBe("heading");
  expect($from.parent.textContent).toBe("How to read");
  expect($from.parentOffset).toBe("How to read".length);
});

test("in a read-only Editor a jump focuses the heading", async () => {
  const user = userEvent.setup();
  renderEditor({ defaultValue: ARTICLE, readOnly: true });
  await waitFor(() => expect(strip()).not.toBeNull());

  const items = await openList(user);
  await user.click(items[2]!);

  expect(document.activeElement?.tagName).toBe("H2");
  expect(document.activeElement?.textContent).toBe("What's next");
});
