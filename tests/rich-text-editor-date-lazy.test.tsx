// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, expect, test, vi } from "vitest";
import {
  RICH_TEXT_PRESETS,
  RichTextEditor,
  type RichTextEditorHandle,
  type RichTextEditorProps,
} from "../src/editor/index.js";
import { resetDevWarnings } from "../src/lib/dev-warn.js";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  resetDevWarnings();
});

/**
 * The date mention's chunk (OLDSUI-309, ADR-0079, item 4): the popover form with the `Calendar` is
 * a separate module behind `import()`, and the node with its Slash menu item is not. The mock sits on
 * the network boundary of the chunk: the module's content is real, and the test only records when it
 * is requested. The module's cache is per file, so the order of the tests matters.
 */
const imported = vi.hoisted(() => [] as string[]);

vi.mock("../src/editor/features/date/DateForm.js", async (original) => {
  imported.push("form");
  return original();
});

const VALUE = '<p>Due <time datetime="2026-10-18">Oct 18, 2026</time> done</p>';

function renderEditor(props: Partial<RichTextEditorProps>) {
  const ref = createRef<RichTextEditorHandle>();
  const onReady = vi.fn();
  const view = render(<RichTextEditor ref={ref} aria-label="Body" onReady={onReady} {...props} />);
  return { ...view, ref, onReady };
}

test("the Tool has no Loader: the engine is ready inside render and the node is already in the Schema", () => {
  const { ref, onReady, container } = renderEditor({ tools: ["bold", "date"], value: VALUE });

  expect(ref.current?.editor).not.toBeNull();
  expect(onReady).toHaveBeenCalledTimes(1);
  expect(container.querySelector("time[datetime]")?.textContent).toBe("Oct 18, 2026");
  // The Calendar and the form are not requested by an Editor that only shows mentions.
  expect(imported).toEqual([]);
});

test("the `full` Skeleton already shows the mention as a `time` with its words, before the chunks of other Tools", () => {
  const { container } = renderEditor({ preset: "full", value: VALUE });

  // While `codeBlock` and `table` are on the way, the field is a Skeleton: static HTML, no input.
  expect(container.querySelector("[contenteditable]")).toBeNull();
  expect(container.querySelector("time[datetime='2026-10-18']")?.textContent).toBe("Oct 18, 2026");
  expect(imported).toEqual([]);
});

test("the form chunk is requested only when a popover is opened, and then it renders the calendar", async () => {
  const { ref } = renderEditor({
    tools: ["date", "insertMenu"],
    value: VALUE,
  });
  expect(RICH_TEXT_PRESETS.full).toContain("date");
  expect(RICH_TEXT_PRESETS.basic).not.toContain("date");
  expect(imported).toEqual([]);

  act(() => void ref.current?.tool("date")?.insert());
  expect(await screen.findByRole("dialog", { name: "Date" })).toBeTruthy();

  await waitFor(() => expect(imported).toEqual(["form"]));
  expect(await screen.findByRole("grid")).toBeTruthy();
});
