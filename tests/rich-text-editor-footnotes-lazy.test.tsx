// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, expect, test, vi } from "vitest";
import {
  RichTextEditor,
  type RichTextEditorHandle,
  type RichTextEditorProps,
} from "../src/editor/index.js";
import { UiProvider } from "../src/i18n/UiProvider.js";
import { messages as ru } from "../src/locales/ru.js";

afterEach(cleanup);

/**
 * `footnotes` is a lazy built-in (OLDSUI-306, ADR-0076, ADR-0058, item 11.1): the nodes with their node
 * view, the keys, the list's upkeep and the Markdown rules arrive as a chunk through the Tool's Loader.
 *
 * The chunk module is replaced by a wrapper that only records the import, so it is visible whether it was
 * called. The replacement sits at the network boundary, not in the internals: the chunk's content is real.
 * The loader's cache lives on the module, so the order of the tests matters: the ones that must NOT load
 * the chunk go first.
 */
const imported = vi.hoisted(() => [] as string[]);

vi.mock("../src/editor/features/footnotes/footnotesChunk.js", async (original) => {
  imported.push("chunk");
  return original();
});

const A = "aaaaaaa1";
const B = "bbbbbbb2";

const reference = (key: string, number: number) =>
  `<sup data-footnote-ref="${key}"><a href="#fn-${key}" id="fnref-${key}" role="doc-noteref">${number}</a></sup>`;

const list = (name: string) =>
  `<section data-block="footnotes" role="doc-endnotes" aria-label="${name}"><ol>` +
  `<li id="fn-${A}"><p>First <em>note</em></p><a href="#fnref-${A}" role="doc-backlink">↩</a></li>` +
  `<li id="fn-${B}"><p>Second</p><a href="#fnref-${B}" role="doc-backlink">↩</a></li>` +
  "</ol></section>";

const text = (name = "Footnotes") =>
  `<p>One${reference(A, 1)} and two${reference(B, 2)}.</p>${list(name)}`;

const TOOLS = ["bold", "italic", "insertMenu", "footnotes"] as const;

function renderEditor(props: Partial<RichTextEditorProps>, locale?: "ru") {
  const ref = createRef<RichTextEditorHandle>();
  const onReady = vi.fn();
  const editor = (
    <RichTextEditor ref={ref} aria-label="Body" onReady={onReady} value={text()} {...props} />
  );
  const view = render(locale ? <UiProvider locale={locale}>{editor}</UiProvider> : editor);
  return { ...view, ref, onReady };
}

/** The timers and the Editor's effects have run. */
const settle = () =>
  act(async () => void (await new Promise((resolve) => setTimeout(resolve, 30))));

/** The footnote markup of a piece of HTML: the references and the list, as the DOM serializes them. */
function footnoteMarkup(html: string | Element): string[] {
  const root =
    typeof html === "string"
      ? Object.assign(document.createElement("div"), { innerHTML: html })
      : html;
  return [
    ...root.querySelectorAll("sup[data-footnote-ref]"),
    ...root.querySelectorAll("section[data-block=footnotes]"),
  ].map((element) => element.outerHTML);
}

test("basic never loads the chunk: the footnotes in the value are read as text", async () => {
  const { ref, onReady } = renderEditor({ preset: "basic" });

  // `basic` is ready inside `render`: there is nothing to wait for.
  expect(ref.current?.editor).not.toBeNull();
  expect(onReady).toHaveBeenCalledTimes(1);
  await settle();
  expect(imported).toEqual([]);
  // The markup goes, the words stay; the backlink is dropped (`footnotesAsText.ts`).
  expect(ref.current?.getHTML()).toBe(
    "<p>One1 and two2.</p><ol><li><p>First <em>note</em></p></li><li><p>Second</p></li></ol>"
  );
  expect(ref.current?.tool("footnotes")).toBeNull();
});

test("a tools list without footnotes does not load the chunk either", async () => {
  const { ref } = renderEditor({ tools: ["bold", "insertMenu"] });

  expect(ref.current?.editor).not.toBeNull();
  await settle();
  expect(imported).toEqual([]);
});

test("with the tool the Skeleton draws the reference and the list, then the chunk makes the field ready", async () => {
  const { ref, onReady, container } = renderEditor({ tools: [...TOOLS] });

  // Skeleton while the chunk is on the way: the Document as static HTML, no input, no Readiness.
  expect(container.querySelector("[contenteditable]")).toBeNull();
  expect(ref.current?.editor).toBeNull();
  expect(onReady).not.toHaveBeenCalled();
  // The Commands are silent without an engine, like any other lazy Tool's.
  expect(ref.current?.tool("footnotes")).toBeNull();
  // The reference and the list keep their own shape, so the field does not jump when the chunk arrives.
  expect(container.querySelector("sup[data-footnote-ref] > a[role=doc-noteref]")?.textContent).toBe(
    "1"
  );
  expect(container.querySelectorAll("section[data-block=footnotes] > ol > li")).toHaveLength(2);
  expect(container.querySelector("li > p > em")?.textContent).toBe("note");
  const skeleton = footnoteMarkup(container);
  expect(skeleton).toHaveLength(3);

  expect(await screen.findByRole("textbox", { name: "Body" }, { timeout: 10_000 })).toBeTruthy();
  // The chunk was requested at mount, not on a later interaction.
  expect(imported).toEqual(["chunk"]);
  expect(onReady).toHaveBeenCalledTimes(1);
  // The Document is the same markup as the Skeleton showed: the saved HTML is what the Skeleton drew.
  expect(footnoteMarkup(ref.current!.getHTML())).toEqual(skeleton);
  expect(ref.current?.getHTML()).toBe(text());
  // And the engine works: the Commands are there, the node view is drawn.
  expect(container.querySelectorAll("section[data-block=footnotes] li > button")).toHaveLength(2);
  let inserted = false;
  act(() => {
    ref.current?.editor?.commands.setTextSelection(3);
    inserted = ref.current!.tool("footnotes")!.insert();
  });
  expect(inserted).toBe(true);
  expect(footnoteMarkup(ref.current!.getHTML())).toHaveLength(4);
});

test("a second editor with the tool finds the chunk loaded and is ready inside render", () => {
  const { ref, onReady } = renderEditor({ tools: [...TOOLS] });

  expect(ref.current?.editor).not.toBeNull();
  expect(onReady).toHaveBeenCalledTimes(1);
  expect(ref.current?.tool("footnotes")?.goToFootnote(1)).toBe(true);
});

test("the Skeleton names the list in the interface language, as the engine does", async () => {
  // The chunk is cached by now, so a rendered Editor has no Skeleton: draw it directly, with the
  // Loader still pending, as `RichTextEditor` does while the chunk is on its way.
  const { skeletonHtml } = await import("../src/editor/core/skeleton.js");
  const { expandTools } = await import("../src/editor/features/builtins.js");
  const tools = expandTools("full", [...TOOLS]);
  const loader = tools.descriptors.find((descriptor) => descriptor.name === "footnotes")!.load!;
  const html = skeletonHtml(text(ru.editor.footnotes), tools, [loader], {
    footnoteListName: () => ru.editor.footnotes,
  });

  expect(footnoteMarkup(html)).toEqual(footnoteMarkup(text(ru.editor.footnotes)));
});
