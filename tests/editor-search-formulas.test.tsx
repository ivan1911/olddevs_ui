// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { NodeSelection } from "@tiptap/pm/state";
import { createRef } from "react";
import { afterEach, beforeAll, expect, test } from "vitest";
import {
  RichTextEditor,
  type RichTextEditorHandle,
  type RichTextEditorProps,
} from "../src/editor/index.js";
import { findMatches, type SearchOptions } from "../src/editor/features/search/searchMatch.js";
import { searchState } from "../src/editor/features/search/searchPlugin.js";
import { loadLazyBuiltins } from "./editor-lazy-builtins.js";

beforeAll(loadLazyBuiltins);
// The panel is a lazy chunk: warm it up so `findBy` does not wait for the network.
beforeAll(() => import("../src/editor/features/search/SearchPanel.js"));
afterEach(cleanup);

/**
 * Find locates formulas and does not replace them (OLDSUI-280, the owner's decision
 * 2026-10-16; ADR-0070, section 8): the formula's source LaTeX is searched, and a match inside
 * highlights the whole formula and is counted as "N of M", while "Replace" and "Replace
 * all" leave formulas alone: a formula is edited only in its Popover. The other atoms
 * (hard break, image, mention) are still gaps for search.
 */
const TOOLS = ["bold", "history", "search", "mathematics"] as const;

function renderEditor(props: Partial<RichTextEditorProps> = {}) {
  const ref = createRef<RichTextEditorHandle>();
  const view = render(<RichTextEditor ref={ref} aria-label="Body" tools={TOOLS} {...props} />);
  const editor = ref.current?.editor;
  if (!editor) throw new Error("the editor was not created inside render()");
  return { ...view, editor, handle: ref.current! };
}

// Attribute order as the Editor writes it (`getHTML`).
const inline = (latex: string) => `<span data-latex="${latex}" data-type="inline-math"></span>`;
const block = (latex: string) => `<div data-latex="${latex}" data-type="block-math"></div>`;

const NONE: SearchOptions = { matchCase: false, wholeWord: false, regex: false };

/** The query's matches: what sits in the Document at each one (a formula as a node, text as a string). */
function found(editor: ReturnType<typeof renderEditor>["editor"], query: string, flags = {}) {
  const { doc } = editor.state;
  const result = findMatches(doc, query, { ...NONE, ...flags });
  return result.matches.map(({ from, to }) => {
    const node = doc.nodeAt(from);
    return node && node.isAtom && !node.isText && to === from + node.nodeSize
      ? `${node.type.name}:${String(node.attrs.latex)}`
      : doc.textBetween(from, to);
  });
}

const DOC =
  `<p>see ${inline("\\sqrt{2}")} and see</p>` +
  block("\\sqrt{x}+\\frac{1}{2}") +
  `<p>${inline("a+b")} plain</p>`;

test("a match inside a formula is the whole formula, in the order of the document", () => {
  const { editor } = renderEditor({ defaultValue: DOC });

  expect(found(editor, "sqrt")).toEqual([
    "inlineMath:\\sqrt{2}",
    "blockMath:\\sqrt{x}+\\frac{1}{2}",
  ]);
  // Text and formulas in Document order, not "texts first".
  expect(found(editor, "s")).toEqual([
    "s",
    "inlineMath:\\sqrt{2}",
    "s",
    "blockMath:\\sqrt{x}+\\frac{1}{2}",
  ]);
});

test("one formula counts once, however many times the query repeats inside it", () => {
  const { editor } = renderEditor({ defaultValue: `<p>${inline("x+x+x")}</p>` });

  expect(found(editor, "x")).toEqual(["inlineMath:x+x+x"]);
});

test("the options work on the LaTeX source: case, whole word, regular expression", () => {
  const { editor } = renderEditor({
    defaultValue: `<p>${inline("\\Alpha")} ${inline("alpha beta")} ${inline("alphabet")}</p>`,
  });

  expect(found(editor, "alpha")).toEqual([
    "inlineMath:\\Alpha",
    "inlineMath:alpha beta",
    "inlineMath:alphabet",
  ]);
  expect(found(editor, "alpha", { matchCase: true })).toEqual([
    "inlineMath:alpha beta",
    "inlineMath:alphabet",
  ]);
  expect(found(editor, "alpha", { wholeWord: true })).toEqual([
    "inlineMath:\\Alpha",
    "inlineMath:alpha beta",
  ]);
  expect(found(editor, "^al.*et$", { regex: true })).toEqual(["inlineMath:alphabet"]);
});

test("a match does not cross the edge of a formula, and other atoms stay holes", () => {
  const { editor } = renderEditor({
    defaultValue: `<p>ab${inline("cd")}ef</p><p>gh<br>ij</p>`,
  });

  // "abcd" and "cdef" are not found across a formula boundary: a formula has its own source.
  expect(found(editor, "abcd")).toEqual([]);
  expect(found(editor, "cdef")).toEqual([]);
  expect(found(editor, "cd")).toEqual(["inlineMath:cd"]);
  expect(found(editor, "hi")).toEqual([]);
});

test("without the mathematics tool a formula is plain text in the document, found as text", () => {
  const { editor } = renderEditor({
    tools: ["bold", "search"],
    defaultValue: `<p>see ${inline("\\sqrt{2}")}</p>`,
  });

  expect(found(editor, "sqrt")).toEqual(["sqrt"]);
});

test("the formula is highlighted whole, the current one stronger, inline and block", () => {
  const { editor } = renderEditor({ defaultValue: DOC });

  act(() => void editor.commands.setSearch("sqrt", NONE));
  const marked = editor.view.dom.querySelectorAll(".rte-search-match");
  expect([...marked].map((element) => element.getAttribute("data-type"))).toEqual([
    "inline-math",
    "block-math",
  ]);
  expect(editor.view.dom.querySelectorAll(".rte-search-current")).toHaveLength(1);
  expect(editor.view.dom.querySelector(".rte-search-current")?.getAttribute("data-type")).toBe(
    "inline-math"
  );
  expect(searchState(editor.state)).toMatchObject({ current: 0, total: 2 });
});

test("next and previous step onto a formula and select it as a node", () => {
  const { editor } = renderEditor({ defaultValue: DOC });

  act(() => void editor.commands.setSearch("sqrt", NONE));
  act(() => void editor.commands.searchStep(1));
  expect(searchState(editor.state)?.current).toBe(1);
  let selection = editor.state.selection;
  expect(selection).toBeInstanceOf(NodeSelection);
  expect((selection as NodeSelection).node.type.name).toBe("blockMath");
  expect(editor.view.dom.querySelector(".rte-search-current")?.getAttribute("data-type")).toBe(
    "block-math"
  );

  act(() => void editor.commands.searchStep(-1));
  selection = editor.state.selection;
  expect(selection).toBeInstanceOf(NodeSelection);
  expect((selection as NodeSelection).node.type.name).toBe("inlineMath");
});

test("the matches follow an edit of the formula source made through the popover command", () => {
  const { editor } = renderEditor({ defaultValue: `<p>${inline("x^2")}</p>` });

  act(() => void editor.commands.setSearch("y", NONE));
  expect(searchState(editor.state)?.total).toBe(0);
  act(() => void editor.commands.updateInlineMath({ latex: "y^2", pos: 1 }));
  expect(searchState(editor.state)).toMatchObject({ total: 1, current: 0 });
});

test("the Tool commands step onto a formula too", () => {
  const { handle } = renderEditor({ defaultValue: DOC });

  const search = handle.tool("search");
  expect(search?.setQuery("frac")).toBe(true);
  expect(search?.next()).toBe(true);
  expect(search?.previous()).toBe(true);
});

test("Replace and Replace all leave formulas alone: only the text around them changes", () => {
  const { editor } = renderEditor({
    defaultValue: `<p>sqrt ${inline("\\sqrt{2}")} and sqrt</p>${block("\\sqrt{x}")}`,
  });
  const before = editor.getHTML();

  act(() => void editor.commands.setSearch("sqrt", NONE));
  expect(searchState(editor.state)?.total).toBe(4);
  expect(editor.commands.replaceAllMatches("root")).toBe(true);

  expect(editor.getHTML()).toBe(
    before.replace("<p>sqrt ", "<p>root ").replace("and sqrt</p>", "and root</p>")
  );
  // The counter says what is left: two formulas, and "sqrt" is still in them.
  expect(searchState(editor.state)).toMatchObject({ total: 2 });
  expect(found(editor, "sqrt")).toEqual(["inlineMath:\\sqrt{2}", "blockMath:\\sqrt{x}"]);
  act(() => void editor.commands.undo());
  expect(editor.getHTML()).toBe(before);
});

test("Replace all with formulas only changes nothing and says so", () => {
  const { editor } = renderEditor({ defaultValue: `<p>${inline("\\sqrt{2}")}</p>` });
  const before = editor.getHTML();

  act(() => void editor.commands.setSearch("sqrt", NONE));
  expect(editor.commands.replaceAllMatches("root")).toBe(false);
  expect(editor.getHTML()).toBe(before);
  expect(searchState(editor.state)?.total).toBe(1);
});

test("Replace skips a formula that is current and replaces the next text match", () => {
  const { editor } = renderEditor({
    defaultValue: `<p>${inline("\\sqrt{2}")} then sqrt and sqrt</p>`,
  });

  act(() => void editor.commands.setSearch("sqrt", NONE));
  expect(searchState(editor.state)?.current).toBe(0);
  expect(editor.commands.replaceMatch("root")).toBe(true);

  expect(editor.getHTML()).toBe(`<p>${inline("\\sqrt{2}")} then root and sqrt</p>`);
  expect(searchState(editor.state)).toMatchObject({ total: 2 });
  // The current match is now the one after the replaced one: Replace does not stall in place.
  expect(editor.commands.replaceMatch("root")).toBe(true);
  expect(editor.getHTML()).toBe(`<p>${inline("\\sqrt{2}")} then root and root</p>`);
  // Only formulas are left: there is nothing to replace.
  expect(searchState(editor.state)).toMatchObject({ total: 1 });
  expect(editor.commands.replaceMatch("root")).toBe(false);
});

test("the panel counts formulas, Replace all leaves them and the counter says what remains", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({
    defaultValue: `<p>sqrt ${inline("\\sqrt{2}")} sqrt</p>`,
  });

  await user.click(screen.getByRole("button", { name: "Find" }));
  const panel = await screen.findByRole("search", { name: "Find and replace" });
  await user.type(screen.getByRole("textbox", { name: "Find" }), "sqrt");
  await user.type(screen.getByRole("textbox", { name: "Replace with" }), "root");
  expect(within(panel).getByRole("status").textContent).toBe("1 of 3");

  await user.click(screen.getByRole("button", { name: "Replace all" }));
  expect(editor.getHTML()).toBe(`<p>root ${inline("\\sqrt{2}")} root</p>`);
  expect(within(panel).getByRole("status").textContent).toBe("1 of 1");
  expect(screen.getByText("1 / 1")).toBeDefined();
  // Nothing left to replace: both buttons are disabled, and the formula is still in the search.
  expect(screen.getByRole("button", { name: "Replace all" })).toHaveProperty("disabled", true);
  expect(screen.getByRole("button", { name: "Replace" })).toHaveProperty("disabled", true);
});

test("Escape on a found formula closes the panel and selects the formula", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: `<p>a</p>${block("\\sqrt{x}")}` });

  await user.click(screen.getByRole("button", { name: "Find" }));
  await user.type(await screen.findByRole("textbox", { name: "Find" }), "sqrt");
  await user.keyboard("{Escape}");

  expect(screen.queryByRole("search", { name: "Find and replace" })).toBeNull();
  await waitFor(() => expect(editor.isFocused).toBe(true));
  const selection = editor.state.selection;
  expect(selection).toBeInstanceOf(NodeSelection);
  expect((selection as NodeSelection).node.type.name).toBe("blockMath");
  expect(editor.view.dom.querySelectorAll(".rte-search-match")).toHaveLength(0);
});
