// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRef, useRef } from "react";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import {
  RICH_TEXT_PRESETS,
  RichTextEditor,
  useRichTextEditorState,
  type RichTextEditorHandle,
  type RichTextEditorProps,
} from "../src/editor/index.js";
import { loadLazyBuiltins } from "./editor-lazy-builtins.js";
import { testMergeTagTool } from "./editor-test-tools.js";

// Lazy `codeBlock` and `table` (OLDSUI-111): `full` is ready in `render` once the chunks load.
beforeAll(loadLazyBuiltins);

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

/** Editor with a `ref`: everything the screen does, it does through the Handle, not the engine. */
function renderEditor(props: Partial<RichTextEditorProps> = {}) {
  const ref = createRef<RichTextEditorHandle>();
  const view = render(<RichTextEditor ref={ref} aria-label="Body" {...props} />);
  if (!ref.current?.editor) throw new Error("the editor was not created inside render()");
  return { ...view, ref, handle: () => ref.current! };
}

/** Caret (or range) in the document, as the author left it. */
function select(handle: RichTextEditorHandle, from: number, to = from) {
  act(() => void handle.editor!.commands.setTextSelection({ from, to }));
}

/** Tiptap sets focus on the next frame, for the sake of the iOS keyboard. */
async function focused() {
  await waitFor(() =>
    expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Body" }))
  );
}

// --- insertion at the caret -----------------------------------------------------

test("insertHTML puts the markup at the caret and reports it", () => {
  const { handle } = renderEditor({ defaultValue: "<p>Hello world</p>" });
  select(handle(), 6);

  let inserted: boolean | undefined;
  act(() => {
    inserted = handle().insertHTML("<strong>,</strong>");
  });

  expect(inserted).toBe(true);
  expect(handle().getHTML()).toBe("<p>Hello<strong>,</strong> world</p>");
});

test("insertHTML inserts a Block as HTML", () => {
  const { handle } = renderEditor({ defaultValue: "<p>One</p>" });
  select(handle(), 4);

  let inserted: boolean | undefined;
  act(() => {
    inserted = handle().insertHTML("<h2>Title</h2>");
  });

  expect(inserted).toBe(true);
  expect(handle().getHTML()).toContain("<h2>Title</h2>");
});

test("insertHTML drops a Block of a disabled Tool and reports nothing inserted", () => {
  const { handle } = renderEditor({ tools: ["bold"], defaultValue: "<p>One</p>" });

  let inserted: boolean | undefined;
  act(() => {
    inserted = handle().insertHTML("<hr>");
  });

  expect(inserted).toBe(false);
  expect(handle().getHTML()).toBe("<p>One</p>");

  act(() => void handle().insertHTML("<h2>Title</h2>"));
  expect(handle().getHTML()).not.toContain("<h2");
});

test("insertHTML past maxLength is refused whole, with no change", () => {
  const onChange = vi.fn();
  const { handle } = renderEditor({
    maxLength: 10,
    defaultValue: "<p>12345678</p>",
    onChange,
    changeDelay: 0,
  });
  select(handle(), 9);

  let inserted: boolean | undefined;
  act(() => {
    inserted = handle().insertHTML("<p>abcdef</p>");
  });

  expect(inserted).toBe(false);
  expect(handle().getHTML()).toBe("<p>12345678</p>");
  expect(onChange).not.toHaveBeenCalled();

  act(() => {
    inserted = handle().insertHTML("<em>ab</em>");
  });
  expect(inserted).toBe(true);
  expect(handle().getText()).toBe("12345678ab");
});

test("insertText inserts the text literally, not as HTML", () => {
  const { handle } = renderEditor({ defaultValue: "<p>ab</p>" });
  select(handle(), 2);

  let inserted: boolean | undefined;
  act(() => {
    inserted = handle().insertText("<b>x</b>");
  });

  expect(inserted).toBe(true);
  expect(handle().getHTML()).toBe("<p>a&lt;b&gt;x&lt;/b&gt;b</p>");
});

test("insertText turns a newline into a soft break, and keeps it raw in a code block", () => {
  const { handle } = renderEditor({ defaultValue: "<p>ab</p><pre><code>x</code></pre>" });
  select(handle(), 2);
  act(() => void handle().insertText("1\n2"));
  expect(handle().getHTML()).toContain("<p>a1<br>2b</p>");

  // Caret in a code block: a line break there is a character, not a soft break.
  const code = handle().editor!;
  select(handle(), code.state.doc.content.size - 1);
  act(() => void handle().insertText("\ny"));
  expect(handle().getHTML()).toContain("<code>x\ny</code>");
});

test("insertText past maxLength returns false", () => {
  const { handle } = renderEditor({ maxLength: 5, defaultValue: "<p>abc</p>" });
  select(handle(), 4);

  let inserted: boolean | undefined;
  act(() => {
    inserted = handle().insertText("defg");
  });

  expect(inserted).toBe(false);
  expect(handle().getHTML()).toBe("<p>abc</p>");
});

test("an empty insertion changes nothing and returns false", () => {
  const { handle } = renderEditor({ defaultValue: "<p>abc</p>" });
  expect(handle().insertText("")).toBe(false);
  expect(handle().insertHTML("")).toBe(false);
});

test("insertions do nothing in a field the author cannot edit", () => {
  const { handle } = renderEditor({ readOnly: true, defaultValue: "<p>abc</p>" });

  expect(handle().insertText("x")).toBe(false);
  expect(handle().insertHTML("<p>x</p>")).toBe(false);
  expect(handle().getHTML()).toBe("<p>abc</p>");
});

// --- insertion — User edit -------------------------------------------------

test("an insertion is the author's edit: onChange after the delay, one undo step", () => {
  const onChange = vi.fn();
  const { handle } = renderEditor({ defaultValue: "<p>One</p>", onChange, changeDelay: 300 });
  vi.useFakeTimers();
  select(handle(), 4);

  act(() => void handle().insertText(" two"));
  // A User edit, not a Programmatic replacement from outside: `onChange` waits for `changeDelay`.
  expect(onChange).not.toHaveBeenCalled();
  act(() => void vi.advanceTimersByTime(300));
  expect(onChange).toHaveBeenLastCalledWith("<p>One two</p>");

  // An insertion is a separate history step, even right after typing.
  act(() => void handle().editor!.commands.insertContent("!"));
  act(() => void handle().insertText(" three"));
  expect(handle().getHTML()).toBe("<p>One two! three</p>");
  act(() => handle().undo());
  expect(handle().getHTML()).toBe("<p>One two!</p>");
});

test("clear and setMarkdown stay a replacement from outside: onChange at once", () => {
  const onChange = vi.fn();
  const { handle } = renderEditor({ defaultValue: "<p>One</p>", onChange, changeDelay: 300 });

  act(() => handle().setMarkdown("Two"));
  expect(onChange).toHaveBeenCalledTimes(1);
  act(() => handle().clear());
  expect(onChange).toHaveBeenCalledTimes(2);
  expect(onChange).toHaveBeenLastCalledWith("");
});

// --- reading -------------------------------------------------------------------

test("getText returns the plain text of the Document", () => {
  const { handle } = renderEditor({
    defaultValue: "<h2>Title</h2><p>One <strong>two</strong></p>",
  });

  expect(handle().getText()).toBe("Title\n\nOne two");
});

test("getSelectedText is empty for a caret and the text for a range", () => {
  const { handle } = renderEditor({ defaultValue: "<p>Hello world</p>" });

  select(handle(), 3);
  expect(handle().getSelectedText()).toBe("");

  select(handle(), 1, 6);
  expect(handle().getSelectedText()).toBe("Hello");
});

test("isEmpty follows the kit's rule: an atom is content, an empty paragraph is not", () => {
  const { handle } = renderEditor({ defaultValue: "<p></p>" });
  expect(handle().isEmpty()).toBe(true);

  act(() => void handle().insertText("a"));
  expect(handle().isEmpty()).toBe(false);

  act(() => handle().clear());
  expect(handle().isEmpty()).toBe(true);

  act(() => void handle().insertHTML("<hr>"));
  expect(handle().isEmpty()).toBe(false);
});

// --- focus ------------------------------------------------------------------------

test("focus() without an argument still puts the caret at the end of the Document", async () => {
  const { handle } = renderEditor({ defaultValue: "<p>Hello</p><p>World</p>" });
  select(handle(), 2);

  act(() => handle().focus());

  await focused();
  const { selection, doc } = handle().editor!.state;
  expect(selection.from).toBe(doc.content.size - 1);
});

test('focus("start") and focus("end") put the caret at the edges', async () => {
  const { handle } = renderEditor({ defaultValue: "<p>Hello</p><p>World</p>" });

  act(() => handle().focus("end"));
  await focused();
  expect(handle().editor!.state.selection.from).toBe(handle().editor!.state.doc.content.size - 1);

  act(() => handle().focus("start"));
  await waitFor(() => expect(handle().editor!.state.selection.from).toBe(1));
});

test('focus("restore") returns the selection after an outside dialog', async () => {
  const { handle } = renderEditor({ defaultValue: "<p>Hello world</p>" });
  select(handle(), 1, 6);
  act(() => handle().focus("restore"));
  await focused();

  // An outside dialog: focus went to a foreign field, and the document's selection stayed in the state.
  const dialog = document.createElement("input");
  document.body.append(dialog);
  act(() => dialog.focus());
  expect(document.activeElement).toBe(dialog);

  act(() => handle().focus("restore"));

  await focused();
  const { from, to } = handle().editor!.state.selection;
  expect([from, to]).toEqual([1, 6]);
  dialog.remove();
});

test("blur() takes the focus out of the Document", async () => {
  const { handle } = renderEditor({ defaultValue: "<p>Text</p>" });
  act(() => handle().focus());
  await focused();

  act(() => handle().blur());

  await waitFor(() =>
    expect(document.activeElement).not.toBe(screen.getByRole("textbox", { name: "Body" }))
  );
});

// --- history ------------------------------------------------------------------------

test("undo and redo go through the Handle, and canUndo / canRedo follow them", () => {
  const onChange = vi.fn();
  const { handle } = renderEditor({ defaultValue: "<p>One</p>", onChange, changeDelay: 0 });
  expect(handle().canUndo()).toBe(false);
  expect(handle().canRedo()).toBe(false);

  select(handle(), 4);
  act(() => void handle().insertText(" two"));
  expect(handle().canUndo()).toBe(true);

  act(() => handle().undo());
  expect(handle().getHTML()).toBe("<p>One</p>");
  expect(handle().canUndo()).toBe(false);
  expect(handle().canRedo()).toBe(true);
  // Undo is a User edit: the owner of the value learns about it through `onChange`.
  expect(onChange).toHaveBeenLastCalledWith("<p>One</p>");

  act(() => handle().redo());
  expect(handle().getHTML()).toBe("<p>One two</p>");
  expect(handle().canRedo()).toBe(false);
});

test("without the history Tool undo and redo are silent", () => {
  const { handle } = renderEditor({ tools: ["bold"], defaultValue: "<p>One</p>" });
  select(handle(), 4);
  act(() => void handle().insertText(" two"));

  expect(handle().canUndo()).toBe(false);
  expect(() => act(() => handle().undo())).not.toThrow();
  expect(() => act(() => handle().redo())).not.toThrow();
  expect(handle().getHTML()).toBe("<p>One two</p>");
});

// --- HTML mode ---------------------------------------------------------------------

test("in the HTML mode the Handle applies the field first and keeps the field in step", () => {
  const { handle } = renderEditor({ defaultValue: "<p>One</p>" });
  act(() => void screen.getByRole("button", { name: "HTML" }).click());
  const field = screen.getByRole<HTMLTextAreaElement>("textbox", { name: /HTML/ });

  fireEvent.change(field, { target: { value: "<p>Edited</p>" } });
  // Reading applies the field's edit, as `getHTML()` does.
  expect(handle().getText()).toBe("Edited");

  // The insertion goes into the Document, and the field is overwritten by the new Document.
  select(handle(), 7);
  act(() => void handle().insertText("!"));
  expect(handle().getHTML()).toBe("<p>Edited!</p>");
  expect(field.value).toContain("Edited!");

  // Undo in HTML mode belongs to the field itself; the Handle stays silent.
  expect(handle().canUndo()).toBe(false);
  act(() => handle().undo());
  expect(handle().getHTML()).toBe("<p>Edited!</p>");
  expect(handle().getSelectedText()).toBe("");
});

// --- before mount -----------------------------------------------------------------------

test("before mount the Handle reads what it knows and writes nothing", () => {
  const seen: Record<string, unknown> = {};
  render(
    <RichTextEditor
      aria-label="Body"
      defaultValue="<p>Known</p>"
      ref={(handle) => {
        // The callback `ref` gets the Handle on mount, when there is no engine yet.
        if (!handle || "html" in seen) return;
        seen.editor = handle.editor;
        seen.html = handle.getHTML();
        seen.text = handle.getText();
        seen.selected = handle.getSelectedText();
        seen.empty = handle.isEmpty();
        seen.insertHTML = handle.insertHTML("<p>x</p>");
        seen.insertText = handle.insertText("x");
        seen.canUndo = handle.canUndo();
        seen.canRedo = handle.canRedo();
        handle.focus();
        handle.focus("restore");
        handle.blur();
        handle.undo();
        handle.redo();
      }}
    />
  );

  expect(seen).toEqual({
    editor: null,
    html: "<p>Known</p>",
    text: "",
    selected: "",
    empty: false,
    insertHTML: false,
    insertText: false,
    canUndo: false,
    canRedo: false,
  });
});

test("before mount isEmpty judges by the incoming value", () => {
  let empty: boolean | undefined;
  render(
    <RichTextEditor
      aria-label="Body"
      value="<p></p>"
      ref={(handle) => {
        if (handle && empty === undefined) empty = handle.isEmpty();
      }}
    />
  );

  expect(empty).toBe(true);
});

/*
  Before and after mount there is one emptiness rule (`required`, `editor.isEmpty`):
  a paragraph without text, an empty heading, a list or a quote is empty; a soft
  break, an Atom and any text, even a non-breaking space, is content.
*/
const EMPTINESS = [
  "",
  "<p></p>",
  "<p> </p>",
  "<h2></h2>",
  "<p><strong></strong></p>",
  "<ul><li><p></p></li></ul>",
  "<blockquote><p></p></blockquote>",
  "<pre><code></code></pre>",
  "<!-- note --><p></p>",
  "<table><tbody><tr><td><p></p></td></tr></tbody></table>",
  "<p><br></p>",
  "<p>&nbsp;</p>",
  "<pre><code> </code></pre>",
  "<hr>",
  '<figure><img src="https://example.com/a.png"></figure>',
  '<p><span data-block="test_mergeTag" data-test_key="first_name"></span></p>',
  "<p>Text</p>",
];

test.each(EMPTINESS)("isEmpty before mount agrees with the mounted field: %j", (html) => {
  let before: boolean | undefined;
  let handle: RichTextEditorHandle | null = null;
  render(
    <RichTextEditor
      aria-label="Body"
      defaultValue={html}
      tools={[...RICH_TEXT_PRESETS.full, testMergeTagTool]}
      ref={(current) => {
        handle = current;
        if (current && before === undefined) before = current.isEmpty();
      }}
    />
  );

  expect(before).toBe(handle!.isEmpty());
});

// --- hook ----------------------------------------------------------------------------------

test("useRichTextEditorState shows the active Marks and re-renders only when the slice changes", () => {
  let renders = 0;
  const slices: unknown[] = [];

  function Screen() {
    const ref = useRef<RichTextEditorHandle>(null);
    const state = useRichTextEditorState(ref, (editor) => ({ bold: editor.isActive("bold") }));
    renders += 1;
    slices.push(state);
    return (
      <>
        <button
          type="button"
          aria-pressed={state?.bold ?? false}
          // Recipe for an external toolbar: the button does not take focus away from the Document.
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => ref.current?.editor?.chain().focus().toggleBold().run()}
        >
          Screen bold
        </button>
        <RichTextEditor ref={ref} aria-label="Body" defaultValue="<p>Hello world</p>" />
      </>
    );
  }

  render(<Screen />);

  // The Document was created after the first render, yet the panel still got the slice.
  expect(slices[0]).toBeNull();
  expect(slices.at(-1)).toEqual({ bold: false });
  const button = screen.getByRole("button", { name: "Screen bold" });
  expect(button.getAttribute("aria-pressed")).toBe("false");

  const editor = (document.querySelector(".ProseMirror") as HTMLElement & { editor?: unknown })
    .editor as NonNullable<RichTextEditorHandle["editor"]>;
  act(() => void editor.commands.setTextSelection({ from: 1, to: 6 }));
  act(() => void button.click());
  expect(button.getAttribute("aria-pressed")).toBe("true");

  // Typing does not change the slice, so the panel does not re-render.
  const before = renders;
  act(() => void editor.commands.insertContentAt(8, "x", { updateSelection: false }));
  act(() => void editor.commands.insertContentAt(9, "y", { updateSelection: false }));
  expect(renders).toBe(before);

  // The caret moves into plain text: the slice has changed.
  act(() => void editor.commands.setTextSelection(10));
  expect(button.getAttribute("aria-pressed")).toBe("false");
});
