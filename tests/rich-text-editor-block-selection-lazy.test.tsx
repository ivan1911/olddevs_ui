// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, expect, test, vi } from "vitest";
import {
  RichTextEditor,
  useRichTextToolState,
  type RichTextEditorHandle,
  type RichTextEditorProps,
} from "../src/editor/index.js";
import { BlockSelection } from "../src/editor/core/blockSelection.js";

afterEach(cleanup);

/**
 * `blockSelection` is a lazy built-in (OLDSUI-307, ADR-0058, item 11.1, ADR-0077): the extension with
 * its keys and moves is a separate chunk behind a Loader, and the core part (the `BlockSelection`
 * class, the Block unit) is static. Until the chunk arrives the Editor is the Skeleton, so nothing
 * of the Tool is live: `Esc` does nothing extra, the Tool's Commands have no engine to run on.
 *
 * The chunk module is replaced by a wrapper that only records the import, so it is visible whether
 * it was requested. The replacement sits at the network boundary: the chunk's content is real. The
 * loader's cache lives on the module, so the order of the tests matters.
 */
const imported = vi.hoisted(() => [] as string[]);

vi.mock("../src/editor/features/blockSelection/blockSelectionChunk.js", async (original) => {
  imported.push("chunk");
  return original();
});

const VALUE = "<p>One</p><p>Two</p>";

function renderEditor(props: Partial<RichTextEditorProps>) {
  const ref = createRef<RichTextEditorHandle>();
  const onReady = vi.fn();
  const view = render(
    <>
      <RichTextEditor ref={ref} aria-label="Body" onReady={onReady} {...props} />
      <State editorRef={ref} />
    </>
  );
  return { ...view, ref, onReady };
}

/** The timers and the Editor's effects have run. */
const settle = () =>
  act(async () => void (await new Promise((resolve) => setTimeout(resolve, 30))));

function State({ editorRef }: { editorRef: React.RefObject<RichTextEditorHandle | null> }) {
  const state = useRichTextToolState(editorRef, "blockSelection");
  return <output aria-label="state">{state === null ? "none" : String(state.count)}</output>;
}

test("basic never requests the chunk and is ready inside render", async () => {
  const { ref, onReady } = renderEditor({ preset: "basic", value: VALUE });

  expect(ref.current?.editor).not.toBeNull();
  expect(onReady).toHaveBeenCalledTimes(1);
  expect(ref.current?.tool("blockSelection")).toBeNull();
  await settle();
  expect(imported).toEqual([]);

  // Without the Tool `Esc` selects nothing: the Block handle and the core are all there is.
  const root = ref.current!.editor!.view.dom;
  act(() => {
    ref.current!.editor!.commands.setTextSelection(3);
  });
  fireEvent.keyDown(root, { key: "Escape", keyCode: 27 });
  expect(ref.current!.editor!.state.selection).not.toBeInstanceOf(BlockSelection);
});

test("the chunk is requested at mount; until it arrives the Editor is the Skeleton, then Esc selects a Block", async () => {
  const { ref, onReady, container } = renderEditor({
    tools: ["bold", "blockSelection"],
    value: VALUE,
  });

  // Skeleton while the chunk is on the way: the Document as static HTML, no input, no engine.
  expect(container.querySelector("[contenteditable]")).toBeNull();
  expect(ref.current?.editor).toBeNull();
  expect(onReady).not.toHaveBeenCalled();
  expect(screen.getByText("Two")).toBeTruthy();
  expect(screen.getByLabelText("state").textContent).toBe("none");
  // Nothing of the Tool is live: the Commands have no engine behind them.
  expect(ref.current?.tool("blockSelection")?.selectCurrent() ?? false).toBe(false);
  expect(ref.current?.tool("blockSelection")?.clear() ?? false).toBe(false);

  expect(await screen.findByRole("textbox", { name: "Body" }, { timeout: 10_000 })).toBeTruthy();
  expect(imported).toEqual(["chunk"]);
  expect(onReady).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText("state").textContent).toBe("0");

  const editor = ref.current!.editor!;
  act(() => {
    editor.view.focus();
    editor.commands.setTextSelection(7);
  });
  const event = new KeyboardEvent("keydown", {
    key: "Escape",
    keyCode: 27,
    bubbles: true,
    cancelable: true,
  });
  act(() => void editor.view.dom.dispatchEvent(event));
  expect(event.defaultPrevented).toBe(true);
  const { selection } = editor.state;
  expect(selection).toBeInstanceOf(BlockSelection);
  expect((selection as BlockSelection).count).toBe(1);
  expect(ref.current?.tool("blockSelection")?.clear()).toBe(true);
  expect(editor.state.selection).not.toBeInstanceOf(BlockSelection);
});

test("a second Editor finds the chunk loaded and is ready inside render", () => {
  const { ref, onReady } = renderEditor({ tools: ["blockSelection"], value: VALUE });

  expect(ref.current?.editor).not.toBeNull();
  expect(onReady).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText("state").textContent).toBe("0");
});
