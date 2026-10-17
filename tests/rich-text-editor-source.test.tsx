// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { createRef } from "react";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { FormField } from "../src/components/inputs/FormField.js";
import { UiProvider } from "../src/i18n/UiProvider.js";
import { messages as ru } from "../src/locales/ru.js";
import {
  RichTextEditor,
  type RichTextEditorHandle,
  type RichTextEditorProps,
} from "../src/editor/index.js";
import { loadLazyBuiltins } from "./editor-lazy-builtins.js";

// Lazy `codeBlock` and `table` (OLDSUI-111): `full` is ready in `render` after the chunks load.
beforeAll(loadLazyBuiltins);

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

/**
 * The Editor's HTML mode (OLDSUI-76): the "HTML" button on the fixed Toolbar
 * replaces the Document with a field holding the source HTML, and the output applies the edit
 * through the Schema, like the incoming `value`.
 *
 * There is one seam, the public `RichTextEditor`: what the person sees and hears, and what
 * the owner receives (`onChange`, `ref`, the form). The formatting module is not tested on its
 * own: its losslessness shows through the component.
 */
function renderEditor(props: Partial<RichTextEditorProps> = {}) {
  const ref = createRef<RichTextEditorHandle>();
  const view = render(
    <>
      <button type="button">Before</button>
      <RichTextEditor ref={ref} aria-label="Body" {...props} />
    </>
  );
  const handle = ref.current;
  if (!handle?.editor) throw new Error("the editor was not created inside render()");
  return { ...view, handle, editor: handle.editor };
}

const sourceButton = () => screen.queryByRole<HTMLButtonElement>("button", { name: "HTML" });

test("the full preset has the HTML button on the fixed toolbar, the basic one does not", () => {
  renderEditor();
  expect(sourceButton()).not.toBeNull();
  cleanup();

  renderEditor({ preset: "basic" });
  expect(sourceButton()).toBeNull();
  cleanup();

  renderEditor({ tools: ["bold", "italic"] });
  expect(sourceButton()).toBeNull();
});

test("floating, bubble and no toolbar have no HTML button, nor does a read-only field", () => {
  for (const props of [
    { toolbar: "floating" },
    { toolbar: "bubble" },
    { toolbar: "none" },
    { readOnly: true },
  ] as const) {
    const { editor } = renderEditor({ ...props, defaultValue: "<p>text</p>" });
    // Over a selection the floating Toolbar and the Bubble menu show up, and the button is not there either.
    act(() => void editor.commands.setTextSelection({ from: 1, to: 5 }));
    expect(sourceButton(), JSON.stringify(props)).toBeNull();
    cleanup();
  }
});

const sourceField = () => screen.queryByRole("textbox", { name: "HTML source" });

test("the HTML button swaps the document for a field with its formatted HTML", async () => {
  const user = userEvent.setup();
  renderEditor({
    defaultValue:
      "<h2>Title</h2><p>Some <strong>bold</strong> text</p>" +
      "<ul><li><p>one</p></li><li><p>two</p><ul><li><p>nested</p></li></ul></li></ul>" +
      '<pre><code class="language-javascript">if (a) {\n  b();\n}</code></pre><hr>',
  });
  expect(sourceField()).toBeNull();

  await user.click(sourceButton()!);

  const field = sourceField() as HTMLTextAreaElement;
  // A Block starts on its own line, the children of a Block container are indented by two spaces,
  // a Block's content stays on the line of its tag, and `pre` is kept as is.
  expect(field.value).toBe(
    [
      "<h2>Title</h2>",
      "<p>Some <strong>bold</strong> text</p>",
      "<ul>",
      "  <li>",
      "    <p>one</p>",
      "  </li>",
      "  <li>",
      "    <p>two</p>",
      "    <ul>",
      "      <li>",
      "        <p>nested</p>",
      "      </li>",
      "    </ul>",
      "  </li>",
      "</ul>",
      '<pre><code class="language-javascript">if (a) {\n  b();\n}</code></pre>',
      "<hr>",
    ].join("\n")
  );
  expect(sourceButton()!.getAttribute("aria-pressed")).toBe("true");
  // The Document is hidden, not unmounted: the engine and the history are alive.
  expect(screen.queryByRole("textbox", { name: "Body" })).toBeNull();
  // Focus is in the field, and the caret is at the start.
  expect(document.activeElement).toBe(field);
  expect([field.selectionStart, field.selectionEnd]).toEqual([0, 0]);
});

test("an empty document opens an empty field, not a blank paragraph", async () => {
  const user = userEvent.setup();
  renderEditor();

  await user.click(sourceButton()!);

  expect((sourceField() as HTMLTextAreaElement).value).toBe("");
});

test("in HTML mode the other toolbar actions are aria-disabled and stay in the arrow order", async () => {
  const user = userEvent.setup();
  renderEditor({ defaultValue: "<p>text</p>" });
  await user.click(sourceButton()!);

  const toolbar = screen.getByRole("toolbar", { name: "Formatting" });
  const buttons = Array.from(toolbar.querySelectorAll("button"));
  const names = (list: HTMLButtonElement[]) =>
    list.map((button) => button.getAttribute("aria-label"));
  // No button is disabled for good: all of them are in the arrow-key navigation.
  expect(names(buttons.filter((button) => button.disabled))).toEqual([]);
  // Only the "HTML" button itself and the keyboard shortcuts popover are available.
  expect(
    names(buttons.filter((button) => button.getAttribute("aria-disabled") !== "true"))
  ).toEqual(["HTML", "Keyboard shortcuts"]);

  sourceButton()!.focus();
  await user.keyboard("{Home}");
  expect(document.activeElement?.getAttribute("aria-label")).toBe("Insert block");
  await user.keyboard("{ArrowRight}{ArrowRight}");
  expect(document.activeElement?.getAttribute("aria-label")).toMatch(/^Block type/);
  // The "¶" menu is unavailable: the arrow down and Enter do not open it.
  await user.keyboard("{ArrowDown}{Enter}");
  expect(screen.queryByRole("menu")).toBeNull();
  // The button is unavailable: a click does nothing.
  await user.click(screen.getByRole("button", { name: "Bold" }));
  expect(screen.queryByRole("textbox", { name: "HTML source" })).not.toBeNull();
});

/** Replaces the whole text of the HTML field: `fireEvent.change`, like an edit by the author. */
function typeSource(text: string) {
  const field = screen.getByRole("textbox", { name: "HTML source" });
  act(() => void fireEvent.change(field, { target: { value: text } }));
}

test("leaving the mode applies the edit through the schema and calls onChange once", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  const { handle } = renderEditor({ defaultValue: "<p>old</p>", onChange });
  await user.click(sourceButton()!);

  typeSource(
    '<h2 class="x" style="color:red" onclick="steal()">Title</h2>\n' +
      "<script>steal()</script>\n" +
      '<p>Read <a href="javascript:steal()">this</a> and <span style="font-size:40px">that</span></p>'
  );
  // Typing in the field does not call `onChange`.
  expect(onChange).not.toHaveBeenCalled();
  await user.click(sourceButton()!);

  // The Document is back in place, and the HTML field is gone.
  expect(screen.getByRole("textbox", { name: "Body" })).toBeDefined();
  expect(screen.queryByRole("textbox", { name: "HTML source" })).toBeNull();
  const html = "<h2>Title</h2><p>Read this and that</p>";
  expect(handle.getHTML()).toBe(html);
  expect(onChange).toHaveBeenCalledTimes(1);
  expect(onChange).toHaveBeenLastCalledWith(html);
});

test("a tool switched off drops its markup from the applied HTML, as from value", async () => {
  const user = userEvent.setup();
  const { handle } = renderEditor({ tools: ["bold", "source"], defaultValue: "<p>x</p>" });
  await user.click(sourceButton()!);

  typeSource(
    "<h2>Title</h2><table><tbody><tr><td><p>cell</p></td></tr></tbody></table>" +
      "<p><strong>b</strong> <em>i</em></p>"
  );
  await user.click(sourceButton()!);

  expect(handle.getHTML()).toBe("<p>Title</p><p>cell</p><p><strong>b</strong> i</p>");
});

/*
  A Document with all the Block containers: nested lists, a checklist, a quote,
  a table, an image with a caption, a Column layout, and a code block with empty lines.
*/
const RICH =
  "<h2>Title</h2><p>Text with <strong>bold</strong>, <em>italic</em> and <code>code</code><br>next line</p>" +
  "<ul><li><p>one</p><ol><li><p>nested</p></li></ol></li></ul>" +
  '<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><p>done</p></li></ul>' +
  "<blockquote><p>quote</p><p>second</p></blockquote>" +
  "<table><tbody><tr><th><p>head</p></th></tr><tr><td><p>cell</p></td></tr></tbody></table>" +
  '<figure><img src="https://example.com/a.png" alt="alt"><figcaption>Caption</figcaption></figure>' +
  '<div data-block="layout" data-layout="50-50"><div data-block="column"><p>left</p></div>' +
  '<div data-block="column"><p>right</p></div></div>' +
  '<pre><code class="language-python">def f():\n\n    return  1</code></pre><hr>';

test("opening and closing the mode without an edit changes nothing and calls nothing", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  const { handle, editor } = renderEditor({ defaultValue: RICH, onChange });
  const before = handle.getHTML();

  await user.click(sourceButton()!);
  await user.click(sourceButton()!);

  expect(handle.getHTML()).toBe(before);
  expect(onChange).not.toHaveBeenCalled();
  expect(editor.can().undo()).toBe(false);
});

test("the formatting is lossless: re-applying the formatted text gives the same document", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  const { handle, editor } = renderEditor({ defaultValue: RICH, onChange });
  const before = handle.getHTML();
  await user.click(sourceButton()!);
  const field = screen.getByRole("textbox", { name: "HTML source" }) as HTMLTextAreaElement;
  // Each top-level Block starts on its own line, and nested ones are indented.
  expect(field.value).toContain(
    '\n<div data-block="layout" data-layout="50-50">\n  <div data-block="column">\n    <p>left</p>\n  </div>'
  );
  expect(field.value).toContain("\n<figure>\n  <img");

  // The text was edited, but only the spaces between Blocks: the Document is the same.
  typeSource(field.value + "\n\n");
  await user.click(sourceButton()!);

  expect(handle.getHTML()).toBe(before);
  expect(onChange).not.toHaveBeenCalled();
  expect(editor.can().undo()).toBe(false);
});

test("a wrapper shows its blocks indented, and the schema still rules what the mode applies", async () => {
  const user = userEvent.setup();
  const wrapper =
    '<div data-block="wrapper"><h3>Inside</h3><ul><li><p>item</p></li></ul></div>' +
    '<div data-block="layout" data-layout="50-50">' +
    '<div data-block="column"><div data-block="wrapper"><p>in a column</p></div></div>' +
    '<div data-block="column"><p>right</p></div></div>';
  const { handle } = renderEditor({ defaultValue: wrapper });
  const before = handle.getHTML();
  await user.click(sourceButton()!);

  // The Wrapper (OLDSUI-77) is a Block container: the structural formatting shared by all of them
  // indents its Blocks without a separate rule.
  const field = screen.getByRole("textbox", { name: "HTML source" }) as HTMLTextAreaElement;
  expect(field.value).toContain(
    '<div data-block="wrapper">\n  <h3>Inside</h3>\n  <ul>\n    <li>\n      <p>item</p>\n    </li>\n  </ul>\n</div>'
  );
  expect(field.value).toContain(
    '  <div data-block="column">\n    <div data-block="wrapper">\n      <p>in a column</p>\n    </div>\n  </div>'
  );
  // No edit: the same Document.
  await user.click(sourceButton()!);
  expect(handle.getHTML()).toBe(before);

  // The HTML mode does not carry a nested Wrapper through: the Schema removes it, and the Blocks stay.
  await user.click(sourceButton()!);
  typeSource('<div data-block="wrapper"><div data-block="wrapper"><p>deep</p></div></div>');
  await user.click(sourceButton()!);
  expect(handle.getHTML()).toBe('<div data-block="wrapper"><p>deep</p></div>');
});

test("one undo in the document reverts the whole applied edit", async () => {
  const user = userEvent.setup();
  const { handle, editor } = renderEditor({ defaultValue: "<p>first</p>" });
  act(() => void editor.chain().focus("end").insertContent(" typed").run());
  await user.click(sourceButton()!);

  typeSource("<h2>One</h2>\n<p>Two</p>\n<p>Three</p>");
  await user.click(sourceButton()!);
  expect(handle.getHTML()).toBe("<h2>One</h2><p>Two</p><p>Three</p>");

  act(() => void editor.commands.undo());
  expect(handle.getHTML()).toBe("<p>first typed</p>");
});

test("blur of the HTML field applies the edit and updates the hidden form field", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  const { container } = renderEditor({ name: "body", defaultValue: "<p>old</p>", onChange });
  await user.click(sourceButton()!);
  typeSource("<p>new</p>");

  await user.click(screen.getByRole("button", { name: "Before" }));

  expect(onChange).toHaveBeenCalledTimes(1);
  expect(onChange).toHaveBeenLastCalledWith("<p>new</p>");
  expect(container.querySelector<HTMLInputElement>('input[name="body"]')?.value).toBe("<p>new</p>");
  // Applying on `blur` does not reformat the field: the author continues with their own text.
  expect((screen.getByRole("textbox", { name: "HTML source" }) as HTMLTextAreaElement).value).toBe(
    "<p>new</p>"
  );
});

/** A form with the Editor: submit and `new FormData` from the HTML mode. */
function renderInForm() {
  const ref = createRef<RichTextEditorHandle>();
  const onChange = vi.fn();
  const submitted: FormData[] = [];
  const view = render(
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submitted.push(new FormData(event.currentTarget));
      }}
    >
      <RichTextEditor
        ref={ref}
        aria-label="Body"
        name="body"
        defaultValue="<p>old</p>"
        onChange={onChange}
      />
      <button type="submit">Send</button>
    </form>
  );
  return { ...view, ref, onChange, submitted, form: view.container.querySelector("form")! };
}

test("submitting the form from HTML mode sends the edit after the schema", async () => {
  const user = userEvent.setup();
  const { onChange, submitted } = renderInForm();
  await user.click(sourceButton()!);
  typeSource('<p onclick="x()">new <b>bold</b></p>');

  // A programmatic click, without the field's `blur`: the submit itself applies the edit.
  act(() => screen.getByRole("button", { name: "Send" }).click());

  expect(submitted[0]?.get("body")).toBe("<p>new <strong>bold</strong></p>");
  expect(onChange).toHaveBeenLastCalledWith("<p>new <strong>bold</strong></p>");
});

test("FormData read from HTML mode carries the edit", async () => {
  const user = userEvent.setup();
  const { form } = renderInForm();
  await user.click(sourceButton()!);
  typeSource("<h2>Saved</h2>");

  // jsdom does not send `formdata` on `new FormData`, so the event is sent the way the browser
  // sends it (see `rich-text-editor.test.tsx`).
  const data = new FormData(form);
  act(() => void form.dispatchEvent(Object.assign(new Event("formdata"), { formData: data })));

  expect(data.get("body")).toBe("<h2>Saved</h2>");
});

test("getHTML and getMarkdown in HTML mode return the current edit after the schema", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  const { handle } = renderEditor({ defaultValue: "<p>old</p>", onChange });
  await user.click(sourceButton()!);

  typeSource("<h2>Title</h2><p><b>bold</b><script>x()</script></p>");
  // The Schema removes `script` together with its content, as it does for `value` and on paste.
  expect(handle.getHTML()).toBe("<h2>Title</h2><p><strong>bold</strong></p>");
  expect(onChange).toHaveBeenCalledTimes(1);

  typeSource("<h3>Other</h3>");
  expect(handle.getMarkdown().trim()).toBe("### Other");
  expect(onChange).toHaveBeenCalledTimes(2);
});

const fieldValue = () =>
  (screen.getByRole("textbox", { name: "HTML source" }) as HTMLTextAreaElement).value;

test("a new value from the owner replaces the field text, its own echo does not", async () => {
  const user = userEvent.setup();
  const ref = createRef<RichTextEditorHandle>();
  const tree = (value: string, onChange?: (html: string) => void) => (
    <RichTextEditor ref={ref} aria-label="Body" value={value} onChange={onChange} />
  );
  let echoed = "";
  const { rerender } = render(tree("<p>one</p>", (html) => (echoed = html)));
  await user.click(sourceButton()!);

  // The value it sent out came back as `value`: the field is not reset.
  typeSource("<p>two</p>\n");
  act(() => void ref.current!.getHTML());
  expect(echoed).toBe("<p>two</p>");
  rerender(tree(echoed, (html) => (echoed = html)));
  expect(fieldValue()).toBe("<p>two</p>\n");

  // The owner's new value takes precedence over an unsaved edit.
  typeSource("<p>unsaved</p>");
  rerender(tree("<ul><li><p>three</p></li></ul>", (html) => (echoed = html)));
  expect(fieldValue()).toBe("<ul>\n  <li>\n    <p>three</p>\n  </li>\n</ul>");
  expect(ref.current!.getHTML()).toBe("<ul><li><p>three</p></li></ul>");
});

test("setMarkdown and clear in HTML mode replace the document and the field text", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  const { handle } = renderEditor({ defaultValue: "<p>old</p>", onChange });
  await user.click(sourceButton()!);

  typeSource("<p>unsaved</p>");
  act(() => handle.setMarkdown("## From markdown"));
  expect(fieldValue()).toBe("<h2>From markdown</h2>");
  expect(onChange).toHaveBeenLastCalledWith("<h2>From markdown</h2>");

  act(() => handle.clear());
  expect(fieldValue()).toBe("");
  expect(onChange).toHaveBeenLastCalledWith("");
  // A replacement from outside is not an edit of the field: the output applies nothing again.
  await user.click(sourceButton()!);
  expect(onChange).toHaveBeenCalledTimes(2);
  expect(handle.getHTML()).toBe("");
});

test("the HTML field is named, described by FormField and free of autocorrection", async () => {
  const user = userEvent.setup();
  const tree = (props: { hint?: string; error?: string }) => (
    <FormField label="Body" {...props}>
      <RichTextEditor aria-describedby="own" />
    </FormField>
  );
  const { rerender } = render(tree({ hint: "Markdown shortcuts work" }));
  await user.click(sourceButton()!);

  const field = screen.getByRole("textbox", { name: "HTML source" });
  const hint = screen.getByText("Markdown shortcuts work");
  expect(field.getAttribute("aria-describedby")?.split(" ")).toEqual(["own", hint.id]);
  expect(field.getAttribute("aria-invalid")).toBeNull();
  expect(field.getAttribute("spellcheck")).toBe("false");
  expect(field.getAttribute("autocapitalize")).toBe("off");
  expect(field.getAttribute("autocorrect")).toBe("off");
  expect(field.getAttribute("autocomplete")).toBe("off");
  expect(field.getAttribute("dir")).toBe("ltr");

  rerender(tree({ error: "Too short" }));
  expect(field.getAttribute("aria-invalid")).toBe("true");
  expect(field.getAttribute("aria-describedby")).toContain(screen.getByRole("alert").id);
});

test("the field speaks the provider's language", async () => {
  const user = userEvent.setup();
  render(
    <UiProvider messages={ru}>
      <RichTextEditor aria-label="Body" />
    </UiProvider>
  );

  await user.click(screen.getByRole("button", { name: ru.editor.source }));

  expect(screen.getByRole("textbox", { name: ru.editor.sourceField })).toBeDefined();
});

test("leaving by the button puts the focus back into the document, caret at the end", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: "<p>first</p><p>last</p>" });
  await user.click(sourceButton()!);
  await user.click(sourceButton()!);

  const document_ = screen.getByRole("textbox", { name: "Body" });
  await vi.waitFor(() => expect(document.activeElement).toBe(document_));
  expect(editor.state.selection.from).toBe(editor.state.doc.content.size - 1);
});

test("Tab leaves the HTML field instead of inserting a tab", async () => {
  const user = userEvent.setup();
  render(
    <>
      <RichTextEditor aria-label="Body" defaultValue="<p>x</p>" />
      <button type="button">After</button>
    </>
  );
  await user.click(sourceButton()!);

  await user.tab();

  expect(document.activeElement).toBe(screen.getByRole("button", { name: "After" }));
  expect(fieldValue()).toBe("<p>x</p>");
});

test("the block handle and the selection bubble are gone in HTML mode", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: "<p>some text</p>" });
  act(() => void editor.chain().focus().setTextSelection({ from: 1, to: 5 }).run());
  expect(await screen.findByRole("button", { name: "Block actions" })).toBeDefined();
  expect(await screen.findByRole("toolbar", { name: "Selection formatting" })).toBeDefined();

  await user.click(sourceButton()!);

  expect(screen.queryByRole("button", { name: "Block actions" })).toBeNull();
  expect(screen.queryByRole("toolbar", { name: "Selection formatting" })).toBeNull();
});

test("disabled and a disabled fieldset switch the HTML field off, the mode stays open", async () => {
  const user = userEvent.setup();
  const tree = (disabled: boolean) => (
    <fieldset disabled={disabled}>
      <RichTextEditor aria-label="Body" defaultValue="<p>x</p>" />
    </fieldset>
  );
  const { rerender } = render(tree(false));
  await user.click(sourceButton()!);

  rerender(tree(true));
  await vi.waitFor(() =>
    expect(
      (screen.getByRole("textbox", { name: "HTML source" }) as HTMLTextAreaElement).disabled
    ).toBe(true)
  );
  expect(sourceButton()!.disabled).toBe(true);
  cleanup();

  const ref = createRef<RichTextEditorHandle>();
  const props = { ref, "aria-label": "Body", defaultValue: "<p>x</p>" };
  const view = render(<RichTextEditor {...props} />);
  await user.click(sourceButton()!);
  view.rerender(<RichTextEditor {...props} disabled />);
  expect(
    (screen.getByRole("textbox", { name: "HTML source" }) as HTMLTextAreaElement).disabled
  ).toBe(true);
  expect(sourceButton()!.getAttribute("aria-pressed")).toBe("true");
});

test("switching to readOnly closes HTML mode and applies the edit", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  const ref = createRef<RichTextEditorHandle>();
  const props = { ref, "aria-label": "Body", defaultValue: "<p>old</p>", onChange };
  const { rerender } = render(<RichTextEditor {...props} />);
  await user.click(sourceButton()!);
  typeSource("<p>new</p>");

  rerender(<RichTextEditor {...props} readOnly />);

  expect(screen.queryByRole("textbox", { name: "HTML source" })).toBeNull();
  expect(screen.getByRole("textbox", { name: "Body" })).toBeDefined();
  expect(onChange).toHaveBeenCalledTimes(1);
  expect(ref.current!.getHTML()).toBe("<p>new</p>");
});

test("maxLength does not cut the applied HTML, the counter shows the excess", async () => {
  const user = userEvent.setup();
  const { handle } = renderEditor({ maxLength: 10, defaultValue: "<p>short</p>" });
  await user.click(sourceButton()!);

  typeSource("<p>a much longer text</p>");
  await user.click(sourceButton()!);

  expect(handle.getHTML()).toBe("<p>a much longer text</p>");
  expect(screen.getByText("8 characters over the limit")).toBeDefined();
});

test("required follows the applied HTML and sends the focus to the HTML field", async () => {
  const user = userEvent.setup();
  const submitted: FormData[] = [];
  const { container } = render(
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submitted.push(new FormData(event.currentTarget));
      }}
    >
      <RichTextEditor aria-label="Body" name="body" required />
      <button type="button">Elsewhere</button>
    </form>
  );
  const form = container.querySelector("form")!;
  await user.click(sourceButton()!);
  const field = screen.getByRole("textbox", { name: "HTML source" });
  await user.click(screen.getByRole("button", { name: "Elsewhere" }));

  // An empty Document blocks the submit, and focus goes to the HTML field, where the author
  // will fill it in.
  act(() => form.requestSubmit());
  expect(submitted).toHaveLength(0);
  await vi.waitFor(() => expect(document.activeElement).toBe(field));

  typeSource("<p>filled</p>");
  await user.click(screen.getByRole("button", { name: "Elsewhere" }));
  act(() => form.requestSubmit());
  expect(submitted).toHaveLength(1);
  expect(submitted[0]?.get("body")).toBe("<p>filled</p>");
});

test("unmounting the editor in HTML mode applies the pending edit and calls onChange once", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  const { unmount } = renderEditor({ defaultValue: "<p>old</p>", onChange });
  await user.click(sourceButton()!);
  typeSource('<p onclick="x()">new <b>bold</b></p><script>x()</script>');

  // Escape in a field inside a `Dialog` closes the window, and the Editor leaves the tree without
  // the field's `blur`: the unmount itself applies the edit, otherwise the edit would be lost.
  unmount();

  expect(onChange).toHaveBeenCalledTimes(1);
  expect(onChange).toHaveBeenLastCalledWith("<p>new <strong>bold</strong></p>");
});

test("unmounting in HTML mode without an edit calls nothing", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  const { unmount } = renderEditor({ defaultValue: "<p>old</p>", onChange });
  await user.click(sourceButton()!);

  unmount();

  expect(onChange).not.toHaveBeenCalled();
});

/** A required Editor in a form: submit with `requestSubmit()` from code, focus in the HTML field. */
function renderRequired(defaultValue = "") {
  const submitted: FormData[] = [];
  const view = render(
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submitted.push(new FormData(event.currentTarget));
      }}
    >
      <RichTextEditor aria-label="Body" name="body" required defaultValue={defaultValue} />
    </form>
  );
  return { ...view, submitted, form: view.container.querySelector("form")! };
}

test("requestSubmit with the focus in the HTML field sends text typed into an empty document", async () => {
  const user = userEvent.setup();
  const { submitted, form } = renderRequired();
  await user.click(sourceButton()!);
  typeSource("<p>filled</p>");
  expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "HTML source" }));

  // The validity check runs BEFORE the `submit` event, and a capture listener applies the edit:
  // validity has to follow the field's text already while typing.
  act(() => form.requestSubmit());

  expect(submitted).toHaveLength(1);
  expect(submitted[0]?.get("body")).toBe("<p>filled</p>");
});

test("requestSubmit with the focus in the HTML field blocks a field the author emptied", async () => {
  const user = userEvent.setup();
  const { submitted, form } = renderRequired("<p>text</p>");
  await user.click(sourceButton()!);
  // What the Schema drops entirely also counts as empty, the same as on apply.
  typeSource("<script>x()</script>\n<p></p>");

  act(() => form.requestSubmit());

  expect(submitted).toHaveLength(0);
  const field = screen.getByRole("textbox", { name: "HTML source" });
  await vi.waitFor(() => expect(document.activeElement).toBe(field));

  typeSource("<hr>");
  act(() => form.requestSubmit());
  expect(submitted).toHaveLength(1);
  expect(submitted[0]?.get("body")).toBe("<hr>");
});

test("Alt+F10 in the HTML field moves the focus to the HTML button, the toolbar's first live action", async () => {
  const user = userEvent.setup();
  renderEditor({ defaultValue: "<p>text</p>" });
  await user.click(sourceButton()!);
  const field = screen.getByRole("textbox", { name: "HTML source" }) as HTMLTextAreaElement;
  expect(document.activeElement).toBe(field);
  // The Toolbar promises the shortcut to everyone: from the HTML field it has to work the same way.
  expect(
    screen.getByRole("toolbar", { name: "Formatting" }).getAttribute("aria-keyshortcuts")
  ).toBe("Alt+F10");

  await user.keyboard("{Alt>}{F10}{/Alt}");

  // "+", "¶" and the others are in `aria-disabled` mode: the first action that works is the "HTML"
  // button itself. The key does not touch the field's text.
  expect(document.activeElement).toBe(sourceButton());
  expect(field.value).toBe("<p>text</p>");
  // The arrows move along the Toolbar from it, and Enter returns to the visual mode.
  await user.keyboard("{Enter}");
  expect(screen.queryByRole("textbox", { name: "HTML source" })).toBeNull();
});

/*
  Selection in the HTML field (OLDSUI-149). The field is always dark, but the global
  `::selection` in the light theme is a light fill with dark text: the selected text came out
  dark on dark blue. The field has its own role for selection and text of the dark theme,
  like its background.
*/
test("the HTML field selects with its own dark-surface selection and text colour", async () => {
  const user = userEvent.setup();
  renderEditor({ defaultValue: "<p>text</p>" });
  await user.click(sourceButton()!);
  const classes = sourceField()!.className.split(/\s+/);
  expect(classes).toContain("selection:bg-(--rte-source-selection)");
  expect(classes).toContain("selection:text-(--rte-source-foreground)");
});

test("on the paper surface the light sheet stays under the dark HTML field", async () => {
  const user = userEvent.setup();
  renderEditor({ surface: "paper", defaultValue: "<p>text</p>" });
  await user.click(sourceButton()!);
  const sheet = sourceField()!.parentElement!;
  const classes = sheet.className.split(/\s+/);
  expect(classes).toContain("bg-(--rte-background)");
  expect(classes).toContain("border");
  expect(classes).toContain("scheme-light");
  // The field itself stays dark.
  expect(sourceField()!.className).toContain("bg-(--rte-source-background)");
});

test("without the paper surface the HTML field has no sheet around it", async () => {
  const user = userEvent.setup();
  renderEditor({ defaultValue: "<p>text</p>" });
  await user.click(sourceButton()!);
  expect(sourceField()!.parentElement!.className.split(/\s+/)).not.toContain(
    "bg-(--rte-background)"
  );
});
