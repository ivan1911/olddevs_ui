// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import type { Editor } from "@tiptap/react";
import { createRef, useRef } from "react";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import {
  RICH_TEXT_PRESETS,
  RichTextEditor,
  tool,
  useRichTextToolState,
  type RichTextEditorHandle,
  type RichTextEditorProps,
} from "../src/editor/index.js";
import { BlockSelection } from "../src/editor/core/blockSelection.js";
import { PRESETS, TOOLS } from "../src/editor/core/tools.js";
import { loadLazyBuiltins } from "./editor-lazy-builtins.js";

beforeAll(loadLazyBuiltins);

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/**
 * The focus mode (OLDSUI-312, ADR-0082): the `focus` Tool. Decorations over the Document that dim
 * everything outside the Block unit (ADR-0077) with the caret. Through the public `RichTextEditor`:
 * what the author sees (the classes on the Document's DOM, the checkbox item in the "…" menu) and
 * what the owner gets (the saved HTML, `onChange`, the Tool state and Commands). Colors and contrast
 * are for the browser checks: jsdom has no stylesheet.
 */
function renderEditor(props: Partial<RichTextEditorProps> = {}) {
  const ref = createRef<RichTextEditorHandle>();
  const view = render(
    <>
      <button type="button">Outside</button>
      <RichTextEditor
        ref={ref}
        aria-label="Body"
        tools={[...TOOLS]}
        {...props}
        // The mode is on from the start in most tests: the option is what they exercise too.
      />
    </>
  );
  const handle = ref.current;
  if (!handle?.editor) throw new Error("the editor was not created inside render()");
  return { ...view, handle, editor: handle.editor };
}

const ON = [tool("focus", { enabled: true })];

/** Put the caret at the end of the text `text` and focus the Document. */
function caretIn(editor: Editor, text: string) {
  let found = -1;
  editor.state.doc.descendants((node, pos) => {
    if (found < 0 && node.isText && node.text === text) found = pos + node.nodeSize;
  });
  if (found < 0) throw new Error(`no text "${text}" in the document`);
  act(() => {
    editor.view.focus();
    editor.commands.setTextSelection(found);
  });
}

/** The text that is dimmed now, as one string per run, in the order of the Document. */
function dimmed(): string[] {
  return Array.from(document.querySelectorAll(".rte-focus-dim"), (node) => node.textContent ?? "");
}
const media = () => document.querySelectorAll(".rte-focus-dim-media").length;

const THREE = "<p>One</p><p>Two</p><p>Three</p>";

// --- What is dimmed ------------------------------------------------------------------------

test("the Blocks around the caret are dimmed, the Block with the caret is as it is", () => {
  const { editor } = renderEditor({ tools: [...TOOLS, ...ON], defaultValue: THREE });

  caretIn(editor, "Two");
  expect(dimmed().join("|")).toBe("One|Three");

  caretIn(editor, "One");
  expect(dimmed().join("|")).toBe("Two|Three");
});

test("a list item is the unit, not the whole list", () => {
  const { editor } = renderEditor({
    tools: [...TOOLS, ...ON],
    defaultValue: "<ul><li><p>a</p></li><li><p>b</p></li><li><p>c</p></li></ul><p>after</p>",
  });

  caretIn(editor, "b");

  expect(dimmed().join("|")).toBe("a|c|after");
});

test("a nested item is the unit, and the text of the item around it is dimmed", () => {
  const { editor } = renderEditor({
    tools: [...TOOLS, ...ON],
    defaultValue:
      "<ul><li><p>outer</p><ul><li><p>inner</p></li></ul></li><li><p>next</p></li></ul>",
  });

  caretIn(editor, "inner");

  expect(dimmed().join("|")).toBe("outer|next");
});

test("a table is one unit, wherever the caret is in it", () => {
  const { editor } = renderEditor({
    tools: [...TOOLS, ...ON],
    defaultValue:
      "<p>before</p><table><tbody><tr><td><p>c1</p></td><td><p>c2</p></td></tr></tbody></table><p>after</p>",
  });

  caretIn(editor, "c2");

  expect(dimmed().join("|")).toBe("before|after");
});

test("a Block of a column is the unit: the other column and the text around are dimmed", () => {
  const { editor } = renderEditor({
    tools: [...TOOLS, ...ON],
    defaultValue:
      '<p>above</p><div data-block="layout"><div data-block="column"><p>left one</p><p>left two</p></div><div data-block="column"><p>right</p></div></div>',
  });

  caretIn(editor, "left two");

  expect(dimmed().join("|")).toBe("above|left one|right");
});

test("a selection across Blocks keeps all of them as they are", () => {
  const { editor } = renderEditor({ tools: [...TOOLS, ...ON], defaultValue: THREE });
  act(() => {
    editor.view.focus();
    editor.commands.setTextSelection({ from: 2, to: 8 });
  });

  expect(dimmed().join("|")).toBe("Three");
});

test("images and code Blocks without text of their own go translucent, not recolored", () => {
  const { editor } = renderEditor({
    tools: [...TOOLS, ...ON],
    defaultValue:
      '<p>Text</p><figure><img src="https://example.com/a.png" alt="a"></figure><pre><code>let x = 1;</code></pre>',
  });

  caretIn(editor, "Text");

  expect(media()).toBe(2);
  expect(document.querySelector("figure.rte-focus-dim-media")).not.toBeNull();
  expect(document.querySelector(".node-codeBlock.rte-focus-dim-media")).not.toBeNull();

  // The image is the Block with the caret now: it is not dimmed, the code Block still is.
  act(() => void editor.commands.setNodeSelection(editor.state.doc.child(0).nodeSize));
  expect(document.querySelector("figure.rte-focus-dim-media")).toBeNull();
  expect(document.querySelector(".node-codeBlock.rte-focus-dim-media")).not.toBeNull();
});

test("a floated image is a media Block like any other: dimmed whole when it is not current", () => {
  const { editor } = renderEditor({
    tools: [...TOOLS, ...ON],
    defaultValue:
      '<p>Text</p><figure data-align="left"><img src="https://example.com/a.png" alt="a" data-width="50"></figure><p>More</p>',
  });

  caretIn(editor, "Text");
  const floated = document.querySelector("figure[data-align=left]");
  expect(floated?.classList.contains("rte-focus-dim-media")).toBe(true);
  expect(dimmed().join("|")).toBe("More");

  // Selected, it is the current Block and is as it is.
  act(() => void editor.commands.setNodeSelection(editor.state.doc.child(0).nodeSize));
  expect(document.querySelector("figure[data-align=left].rte-focus-dim-media")).toBeNull();
});

test("marks keep working inside dimmed text: the decoration wraps, it does not replace", () => {
  const { editor } = renderEditor({
    tools: [...TOOLS, ...ON],
    defaultValue:
      '<p>One <strong>bold</strong> <a href="https://example.com">link</a></p><p>Two</p>',
  });

  caretIn(editor, "Two");

  expect(document.querySelector("strong")?.textContent).toBe("bold");
  expect(document.querySelector("a")?.textContent).toBe("link");
  expect(dimmed().join("")).toBe("One bold link");
});

// --- Footnotes: the list is not a Block unit, but a note is the current Block ----------------

const NOTE_A = "aaaaaaa1";
const NOTE_B = "bbbbbbb2";
const reference = (key: string, number: number) =>
  `<sup data-footnote-ref="${key}"><a href="#fn-${key}" id="fnref-${key}" role="doc-noteref">${number}</a></sup>`;
const notes =
  '<section data-block="footnotes" role="doc-endnotes" aria-label="Footnotes"><ol>' +
  [
    [NOTE_A, "Note one"],
    [NOTE_B, "Note two"],
  ]
    .map(
      ([key, html]) =>
        `<li id="fn-${key}"><p>${html}</p><a href="#fnref-${key}" role="doc-backlink">↩</a></li>`
    )
    .join("") +
  "</ol></section>";
const WITH_NOTES =
  `<p>First${reference(NOTE_A, 1)}</p><p>Second${reference(NOTE_B, 2)}</p>` + notes;
/** The dimmed text runs that are words (the reference numbers are atoms of their own). */
const dimmedWords = () => dimmed().filter((text) => /[a-z]{3}/i.test(text));

test("a caret in a footnote keeps that note as it is and dims the text and the other notes", () => {
  const { editor } = renderEditor({ tools: [...TOOLS, ...ON], defaultValue: WITH_NOTES });

  caretIn(editor, "Note two");
  expect(dimmedWords()).toEqual(["First", "Second", "Note one"]);

  caretIn(editor, "Note one");
  expect(dimmedWords()).toEqual(["First", "Second", "Note two"]);
});

test("a caret in the text dims the whole footnote list like any other Block", () => {
  const { editor } = renderEditor({ tools: [...TOOLS, ...ON], defaultValue: WITH_NOTES });

  caretIn(editor, "First");

  expect(dimmedWords()).toEqual(["Second", "Note one", "Note two"]);
});

// --- Where there is no dimming -------------------------------------------------------------

test("nothing is dimmed without the mode: it is off until it is turned on", () => {
  const { editor } = renderEditor({ defaultValue: THREE });

  caretIn(editor, "Two");

  expect(dimmed()).toEqual([]);
});

test("nothing is dimmed without focus in the Document, and the dimming returns with it", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ tools: [...TOOLS, ...ON], defaultValue: THREE });
  caretIn(editor, "Two");
  expect(dimmed().length).toBeGreaterThan(0);

  await user.click(screen.getByRole("button", { name: "Outside" }));
  expect(dimmed()).toEqual([]);

  act(() => editor.view.focus());
  expect(dimmed().join("|")).toBe("One|Three");
});

test("nothing is dimmed over a Block selection, and the dimming returns after it", () => {
  const { editor } = renderEditor({ tools: [...TOOLS, ...ON], defaultValue: THREE });
  caretIn(editor, "Two");

  act(() => void editor.commands.selectBlocks());
  expect(editor.state.selection).toBeInstanceOf(BlockSelection);
  expect(dimmed()).toEqual([]);

  act(() => void editor.commands.clearBlockSelection());
  expect(editor.state.selection).not.toBeInstanceOf(BlockSelection);
  expect(dimmed().length).toBeGreaterThan(0);
});

test("nothing is dimmed in a read-only field", () => {
  const { editor } = renderEditor({
    tools: [...TOOLS, ...ON],
    defaultValue: THREE,
    readOnly: true,
  });
  act(() => {
    editor.view.focus();
    editor.commands.setTextSelection(3);
  });

  expect(dimmed()).toEqual([]);
});

test("a caret in no Block unit dims nothing: an empty Document", () => {
  const { editor } = renderEditor({ tools: [...TOOLS, ...ON], defaultValue: "" });
  act(() => editor.view.focus());

  expect(dimmed()).toEqual([]);
});

// --- A view only -----------------------------------------------------------------------------

test("the Document, onChange and the HTML do not see it", async () => {
  const onChange = vi.fn();
  const { editor, handle } = renderEditor({
    tools: [...TOOLS, ...ON],
    defaultValue: THREE,
    onChange,
  });
  const before = handle.getHTML();

  caretIn(editor, "Two");
  expect(dimmed().length).toBeGreaterThan(0);

  expect(handle.getHTML()).toBe(before);
  expect(handle.getHTML()).not.toContain("rte-focus");
  expect(handle.getMarkdown()).not.toContain("rte-focus");
  await act(() => new Promise((resolve) => setTimeout(resolve, 150)));
  expect(onChange).not.toHaveBeenCalled();
});

test("the mode is not an edit: it leaves the history alone", () => {
  const { editor, handle } = renderEditor({ tools: [...TOOLS, ...ON], defaultValue: THREE });
  caretIn(editor, "Two");
  act(() => void editor.chain().insertContentAt(2, "x").run());
  const typed = handle.getHTML();

  act(() => void handle.tool("focus")!.toggle());
  act(() => void handle.tool("focus")!.toggle());
  act(() => void editor.commands.undo());

  expect(handle.getHTML()).not.toBe(typed);
  expect(handle.getHTML()).toBe(THREE);
});

// --- API: the item, the Option, the State, the Command --------------------------------------

const MORE = { name: "More formatting" } as const;
const NAME = { name: "Focus mode" } as const;

async function openMore(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", MORE));
  return screen.getByRole("menu", MORE);
}

test("the «…» item turns the mode on and off, and its check mark follows", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: THREE });
  caretIn(editor, "Two");

  let menu = await openMore(user);
  expect(within(menu).getByRole("menuitemcheckbox", NAME).getAttribute("aria-checked")).toBe(
    "false"
  );
  await user.click(within(menu).getByRole("menuitemcheckbox", NAME));
  await waitFor(() => expect(document.activeElement).toBe(editor.view.dom));
  expect(dimmed().join("|")).toBe("One|Three");

  menu = await openMore(user);
  expect(within(menu).getByRole("menuitemcheckbox", NAME).getAttribute("aria-checked")).toBe(
    "true"
  );
  await user.click(within(menu).getByRole("menuitemcheckbox", NAME));
  await waitFor(() => expect(document.activeElement).toBe(editor.view.dom));
  expect(dimmed()).toEqual([]);
});

test("the item is in the selection bubble's «…» menu too", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ toolbar: "bubble", defaultValue: THREE });
  act(() => {
    editor.view.focus();
    editor.commands.setTextSelection({ from: 2, to: 4 });
  });
  const bubble = await screen.findByRole("toolbar", { name: "Selection formatting" });

  await user.click(within(bubble).getByRole("button", MORE));

  expect(
    within(screen.getByRole("menu", MORE)).queryByRole("menuitemcheckbox", NAME)
  ).not.toBeNull();
});

test("the option sets the starting mode, and the State and the Command follow it", () => {
  const states: boolean[] = [];
  function Probe() {
    const ref = useRef<RichTextEditorHandle>(null);
    const enabled = useRichTextToolState(ref, "focus", (state) => state.enabled);
    states.push(enabled === true);
    return (
      <>
        <RichTextEditor
          ref={ref}
          aria-label="Body"
          tools={[...TOOLS, ...ON]}
          defaultValue={THREE}
        />
        <button type="button" onClick={() => ref.current?.tool("focus")?.toggle()}>
          Toggle
        </button>
      </>
    );
  }
  render(<Probe />);
  expect(states.at(-1)).toBe(true);

  act(() => screen.getByRole("button", { name: "Toggle" }).click());
  expect(states.at(-1)).toBe(false);
  act(() => screen.getByRole("button", { name: "Toggle" }).click());
  expect(states.at(-1)).toBe(true);
});

test("without the Tool there is no item, no Command and no State", async () => {
  const user = userEvent.setup();
  const { handle } = renderEditor({
    tools: PRESETS.full.filter((name) => name !== "focus"),
    defaultValue: THREE,
  });

  const menu = await openMore(user);

  expect(within(menu).queryByRole("menuitemcheckbox", NAME)).toBeNull();
  expect(handle.tool("focus")).toBeNull();
});

test("in HTML mode the Command returns false: there is no Document on screen", async () => {
  const user = userEvent.setup();
  const { handle } = renderEditor({ defaultValue: THREE });
  await user.click(screen.getByRole("button", { name: "HTML" }));

  expect(handle.tool("focus")!.toggle()).toBe(false);
});

test("the Tool is in `full`, not in `basic`", () => {
  expect(PRESETS.full).toContain("focus");
  expect(PRESETS.basic).not.toContain("focus");
  expect(RICH_TEXT_PRESETS.full).toContain("focus");
});
