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
import { PRESETS } from "../src/editor/core/tools.js";

afterEach(cleanup);

/**
 * `mathematics` is lazy and outside the presets (OLDSUI-280, ADR-0070, ADR-0058, item 11.1).
 *
 * The chunk's modules and KaTeX are replaced by wrappers that only record the
 * import, so it is visible whether they were called. The replacement sits at the
 * network boundary, not in the internals: the modules' content is real. The
 * loader's cache lives on the module, so the order of the tests matters: `basic`
 * and `full` go first, before anyone has loaded the chunk.
 */
const imported = vi.hoisted(() => [] as string[]);

vi.mock("../src/editor/features/mathematics/mathChunk.js", async (original) => {
  imported.push("chunk");
  return original();
});

vi.mock("../src/editor/features/mathematics/katexEngine.js", async (original) => {
  imported.push("katex");
  return original();
});

const VALUE =
  '<p>Euler <span data-type="inline-math" data-latex="e^{i\\pi}+1=0"></span> done</p>' +
  '<div data-type="block-math" data-latex="\\int_0^1 x\\,dx"></div>';

function renderEditor(props: Partial<RichTextEditorProps>) {
  const ref = createRef<RichTextEditorHandle>();
  const onReady = vi.fn();
  const view = render(<RichTextEditor ref={ref} aria-label="Body" onReady={onReady} {...props} />);
  return { ...view, ref, onReady };
}

/** The timers and the Editor's effects have run. */
const settle = () =>
  act(async () => void (await new Promise((resolve) => setTimeout(resolve, 30))));

test("neither preset names the tool, and basic and full never load the chunk or KaTeX", async () => {
  expect(PRESETS.full).not.toContain("mathematics");
  expect(PRESETS.basic).not.toContain("mathematics");
  expect(RICH_TEXT_PRESETS.full).not.toContain("mathematics");
  expect(RICH_TEXT_PRESETS.basic).not.toContain("mathematics");

  // `full` waits for its chunks (the code block, the table); `basic` is ready at once.
  const basic = renderEditor({ preset: "basic", value: VALUE });
  expect(basic.ref.current?.editor).not.toBeNull();
  const full = renderEditor({ preset: "full", value: VALUE });
  // The `full` Skeleton reads formulas as text, as the engine does: the LaTeX survives in both.
  expect(full.container.textContent).toContain("Euler $e^{i\\pi}+1=0$ done");
  await waitFor(() => expect(full.onReady).toHaveBeenCalledTimes(1), { timeout: 10_000 });
  await settle();

  expect(full.ref.current?.editor).not.toBeNull();
  expect(imported).toEqual([]);
  // Formulas without the Tool come out as text, not lost (`mathAsText.ts`).
  expect(full.ref.current?.getHTML()).toContain("<p>Euler $e^{i\\pi}+1=0$ done</p>");
});

test("with the tool the Skeleton shows the LaTeX source, then the chunk brings KaTeX and the field is ready", async () => {
  const { ref, onReady, container } = renderEditor({
    tools: ["bold", "insertMenu", "mathematics"],
    value: VALUE,
  });

  // Skeleton while the chunk is on the way: the Document as static HTML, no input, no Readiness.
  expect(container.querySelector("[contenteditable]")).toBeNull();
  expect(ref.current?.editor).toBeNull();
  expect(onReady).not.toHaveBeenCalled();
  // The formulas show their own shape with the source LaTeX text (CSS makes it
  // monospace), not as empty places: the same `data-latex` parsing as in the engine.
  const inline = container.querySelector('span[data-type="inline-math"]');
  expect(inline?.textContent).toBe("e^{i\\pi}+1=0");
  expect(inline?.getAttribute("data-latex")).toBe("e^{i\\pi}+1=0");
  expect(container.querySelector('div[data-type="block-math"]')?.textContent).toBe(
    "\\int_0^1 x\\,dx"
  );
  expect(container.querySelector(".katex")).toBeNull();

  expect(await screen.findByRole("textbox", { name: "Body" }, { timeout: 10_000 })).toBeTruthy();
  expect(imported).toContain("chunk");
  expect(onReady).toHaveBeenCalledTimes(1);
  // KaTeX and CSS came with the chunk; the formulas are rendered, and the HTML is the old one, without KaTeX markup.
  expect(imported).toContain("katex");
  expect(container.querySelectorAll(".katex").length).toBeGreaterThanOrEqual(2);
  expect(ref.current?.getHTML()).toBe(
    '<p>Euler <span data-latex="e^{i\\pi}+1=0" data-type="inline-math"></span> done</p>' +
      '<div data-latex="\\int_0^1 x\\,dx" data-type="block-math"></div>'
  );
});

test("a second editor with the tool finds the chunk loaded and is ready inside render", () => {
  const { ref, onReady } = renderEditor({ tools: ["mathematics"], value: VALUE });

  expect(ref.current?.editor).not.toBeNull();
  expect(onReady).toHaveBeenCalledTimes(1);
});
