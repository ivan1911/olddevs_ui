// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { createRef } from "react";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { Dialog } from "../src/components/overlays/Dialog.js";
import { UiProvider } from "../src/i18n/UiProvider.js";
import { messages as ru } from "../src/locales/ru.js";
import {
  RichTextEditor,
  type RichTextEditorHandle,
  type RichTextEditorProps,
} from "../src/editor/index.js";
import { loadLazyBuiltins } from "./editor-lazy-builtins.js";

// Lazy `codeBlock` and `table` (OLDSUI-111): `full` is ready in `render` once the chunks load.
beforeAll(loadLazyBuiltins);

afterEach(cleanup);

/**
 * Link in the Editor (OLDSUI-42): a `a` Mark with an address from the allowed
 * schemes, `rel="noopener noreferrer"` on output, and a popover with an address field.
 *
 * The test checks from outside: the HTML on output, roles and names; the engine
 * through `ref.editor` only where jsdom cannot do input: selection and typing go
 * through commands.
 */
function renderEditor(props: Partial<RichTextEditorProps> = {}) {
  const ref = createRef<RichTextEditorHandle>();
  const view = render(<RichTextEditor ref={ref} aria-label="Body" {...props} />);
  const editor = ref.current?.editor;
  if (!editor) throw new Error("the editor was not created inside render()");
  return { ...view, ref, editor };
}

test("a loaded link keeps its address and leaves with rel and nothing else", () => {
  const { editor } = renderEditor({
    defaultValue:
      '<p><a href="https://example.com/a?b=1" target="_blank" class="x" title="t" rel="ugc">site</a></p>',
  });

  expect(editor.getHTML()).toBe(
    '<p><a href="https://example.com/a?b=1" rel="noopener noreferrer">site</a></p>'
  );
});

/** Links with addresses outside the Schema: the scheme is foreign, the address is relative, or it is hidden by spaces. */
const HOSTILE_LINKS =
  '<p><a href="javascript:alert(1)">js</a> <a href=" java\tscript:alert(1)">tab</a> ' +
  '<a href="data:text/html,x">data</a> <a href="ftp://example.com">ftp</a> ' +
  '<a href="/docs">relative</a> <a href="mailto:team@example.com">mail</a></p>';

test("a link outside the protocol policy loses its wrapper on load and on paste", () => {
  const { editor } = renderEditor({ defaultValue: HOSTILE_LINKS });
  const loaded = editor.getHTML();
  act(() => void editor.commands.clearContent());
  act(() => void editor.view.pasteHTML(HOSTILE_LINKS, new Event("paste") as ClipboardEvent));
  const pasted = editor.getHTML();

  for (const html of [loaded, pasted]) {
    expect(html.match(/<a /g)).toHaveLength(1);
    expect(html).toContain('<a href="mailto:team@example.com" rel="noopener noreferrer">mail</a>');
    // The text of the dropped link stays; only the wrapper goes away.
    expect(html).toContain("js tab data ftp relative");
  }
});

test("a pasted link keeps its own address when its text looks like an address (OLDSUI-304)", () => {
  // A copy from Word or a web page: the visible text is a short form of the address.
  const PASTED =
    '<p>See <a href="https://example.com/docs?page=1#top">example.com/docs</a> and ' +
    '<a href="https://example.com/other">example.com/docs</a>, then example.org.</p>';
  const { editor } = renderEditor();

  act(() => void editor.view.pasteHTML(PASTED, new Event("paste") as ClipboardEvent));

  expect(editor.getHTML()).toBe(
    '<p>See <a href="https://example.com/docs?page=1#top" rel="noopener noreferrer">example.com/docs</a> and ' +
      '<a href="https://example.com/other" rel="noopener noreferrer">example.com/docs</a>, then ' +
      // A bare address in the same paste still becomes a link.
      '<a href="https://example.org" rel="noopener noreferrer">example.org</a>.</p>'
  );
});

test("a Markdown link with a foreign address keeps only its text", () => {
  const { ref, editor } = renderEditor();

  act(() => ref.current!.setMarkdown("[bad](javascript:alert(1)) and [good](https://example.com)"));

  expect(editor.getHTML()).toBe(
    '<p>bad and <a href="https://example.com" rel="noopener noreferrer">good</a></p>'
  );
});

test("without the link tool an anchor is plain text", () => {
  const { editor } = renderEditor({
    tools: ["bold"],
    defaultValue: '<p><a href="https://example.com">site</a></p>',
  });

  expect(editor.getHTML()).toBe("<p>site</p>");
});

test("an address typed in the text becomes a link once the word ends", () => {
  const { editor } = renderEditor();

  // Typing as the engine sees it: one character per transaction, and a space closes the word.
  for (const char of "see example.com and ftp://example.org ") {
    act(() => void editor.commands.insertContent(char));
  }

  expect(editor.getHTML()).toBe(
    '<p>see <a href="https://example.com" rel="noopener noreferrer">example.com</a> and ftp://example.org </p>'
  );
});

test("a pasted address over a selection links it only within the policy", () => {
  const { editor } = renderEditor({ defaultValue: "<p>docs and files</p>" });

  act(() => void editor.commands.setTextSelection({ from: 1, to: 5 }));
  act(
    () =>
      void editor.view.pasteText("https://example.com/docs", new Event("paste") as ClipboardEvent)
  );
  act(() => void editor.commands.setTextSelection({ from: 10, to: 15 }));
  act(
    () =>
      void editor.view.pasteText("ftp://example.com/files", new Event("paste") as ClipboardEvent)
  );

  const html = editor.getHTML();
  expect(html).toContain('<a href="https://example.com/docs" rel="noopener noreferrer">docs</a>');
  // Neither a link to `ftp:` nor a link without an address is left: an empty Mark that
  // the output would save as `<a rel>` without `href`.
  expect(html).not.toMatch(/href="(?!https?:)/);
  expect(html).not.toContain("<a rel=");
});

test("a click on a link inside the editor places the caret and opens nothing", () => {
  const open = vi.spyOn(window, "open").mockImplementation(() => null);
  const { editor } = renderEditor({
    defaultValue: '<p><a href="https://example.com">site</a></p>',
  });
  const anchor = editor.view.dom.querySelector("a")!;

  /*
    The click goes to the engine the same way ProseMirror delivers it: the
    `handleClick` of plugins. A real click does not reach it in jsdom, which has
    no way to measure a position from coordinates (`elementFromPoint`).
  */
  const event = new MouseEvent("click", { button: 0, bubbles: true });
  Object.defineProperty(event, "target", { value: anchor });
  const handled = editor.view.someProp("handleClick", (handle) => handle(editor.view, 2, event));

  expect(handled).toBeFalsy();
  expect(open).not.toHaveBeenCalled();
  open.mockRestore();
});

test("the Link button reports a link under the caret and names its shortcut", () => {
  const { editor } = renderEditor({
    defaultValue: '<p>plain <a href="https://example.com">site</a></p>',
  });
  const button = screen.getByRole("button", { name: "Link" });

  act(() => void editor.commands.setTextSelection(3));
  expect(button.getAttribute("aria-pressed")).toBe("false");
  act(() => void editor.commands.setTextSelection(9));
  expect(button.getAttribute("aria-pressed")).toBe("true");
  // jsdom is not Apple: `mod` is Ctrl.
  expect(button.getAttribute("aria-keyshortcuts")).toBe("Control+K");
});

/** `Mod+K` in the document, as the engine hears it: `keydown` on the editable area. */
function pressModK(editor: RichTextEditorHandle["editor"]) {
  act(() => {
    editor!.view.dom.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true, cancelable: true })
    );
  });
}

test("Mod+K opens the address field; Enter links the selection and returns to the text", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: "<p>Read the docs</p>" });
  act(() => void editor.commands.setTextSelection({ from: 10, to: 14 }));

  pressModK(editor);
  const popover = await screen.findByRole("dialog", { name: "Link" });
  const field = screen.getByRole("textbox", { name: "Address" });
  expect(popover.contains(field)).toBe(true);
  expect(document.activeElement).toBe(field);

  await user.type(field, "example.com/docs{Enter}");

  expect(screen.queryByRole("dialog", { name: "Link" })).toBeNull();
  expect(editor.getHTML()).toBe(
    '<p>Read the <a href="https://example.com/docs" rel="noopener noreferrer">docs</a></p>'
  );
  // Radix returns focus with a timer after the popover unmounts.
  await waitFor(() => expect(document.activeElement).toBe(editor.view.dom));
});

test("Escape in the address field cancels and returns to the text", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: "<p>Read the docs</p>" });
  act(() => void editor.commands.setTextSelection({ from: 10, to: 14 }));

  pressModK(editor);
  await user.type(await screen.findByRole("textbox", { name: "Address" }), "example.com");
  await user.keyboard("{Escape}");

  expect(screen.queryByRole("dialog", { name: "Link" })).toBeNull();
  expect(editor.getHTML()).toBe("<p>Read the docs</p>");
  await waitFor(() => expect(document.activeElement).toBe(editor.view.dom));
  // The selection is the same as before the popover: it can be opened again, or typing can go on.
  expect(editor.state.selection.from).toBe(10);
  expect(editor.state.selection.to).toBe(14);
});

/*
  The button, the shortcut, the reference row and the link Mark come from one Tool
  description (ADR-0058, item 10): without `link` none of them exists.
*/
test("without the link tool there is no Link button, Mod+K opens nothing and the reference has no Link row", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({
    tools: ["bold", "emoji"],
    defaultValue: "<p>Read the docs</p>",
  });
  act(() => void editor.commands.setTextSelection({ from: 10, to: 14 }));

  expect(screen.queryByRole("button", { name: "Link" })).toBeNull();
  pressModK(editor);
  expect(screen.queryByRole("dialog", { name: "Link" })).toBeNull();

  await user.click(screen.getByRole("button", { name: "Keyboard shortcuts" }));
  const reference = await screen.findByRole("dialog", { name: "Keyboard shortcuts" });
  const rows = [...reference.querySelectorAll("tbody th")].map((cell) => cell.textContent);
  expect(rows).toContain("Bold");
  expect(rows).not.toContain("Link");
});

test("on an existing link the field shows its address and can remove the link", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({
    defaultValue: '<p>See <a href="https://example.com/old">the site</a> now</p>',
  });
  // The caret is inside the link, with no selection.
  act(() => void editor.commands.setTextSelection(8));

  await user.click(screen.getByRole("button", { name: "Link" }));
  const field = await screen.findByRole("textbox", { name: "Address" });
  expect((field as HTMLInputElement).value).toBe("https://example.com/old");

  await user.clear(field);
  await user.type(field, "https://example.com/new{Enter}");
  expect(editor.getHTML()).toBe(
    '<p>See <a href="https://example.com/new" rel="noopener noreferrer">the site</a> now</p>'
  );
  await waitFor(() => expect(document.activeElement).toBe(editor.view.dom));

  act(() => void editor.commands.setTextSelection(8));
  pressModK(editor);
  await user.click(await screen.findByRole("button", { name: "Remove link" }));
  expect(editor.getHTML()).toBe("<p>See the site now</p>");
});

test("a new link has no Remove action; without a selection the address goes in as its text", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: "<p>Write to:</p>" });
  act(() => void editor.commands.setTextSelection(10));

  pressModK(editor);
  expect(screen.queryByRole("button", { name: "Remove link" })).toBeNull();
  await user.type(screen.getByRole("textbox", { name: "Address" }), "team@example.com");
  await user.click(screen.getByRole("button", { name: "Apply" }));

  expect(editor.getHTML()).toBe(
    '<p>Write to:<a href="mailto:team@example.com" rel="noopener noreferrer">team@example.com</a></p>'
  );
});

test("the field refuses an address outside the policy and says what it accepts", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: "<p>Click me</p>" });
  act(() => void editor.commands.setTextSelection({ from: 1, to: 6 }));

  pressModK(editor);
  const field = screen.getByRole("textbox", { name: "Address" });
  for (const address of ["javascript:alert(1)", "/relative/path", "ftp://example.com"]) {
    await user.clear(field);
    await user.type(field, `${address}{Enter}`);

    expect(screen.getByRole("dialog", { name: "Link" })).toBeDefined();
    expect(field.getAttribute("aria-invalid")).toBe("true");
    expect(field.getAttribute("aria-describedby")).toBeTruthy();
    const message = document.getElementById(field.getAttribute("aria-describedby")!);
    expect(message?.textContent).toBe("Enter a web address (http, https) or an email (mailto)");
  }
  expect(editor.getHTML()).toBe("<p>Click me</p>");
});

/**
 * Escape in the link popover belongs to the popover, not to the window (ADR-0041,
 * spec, story 23). Both the `Dialog` and the `Popover` of the kit are Radix, and the
 * Radix layer stack decides this on its own; the test guards that the popover stays
 * in this stack and does not become a layer of its own outside it.
 */
test("Escape in the link popover inside a Dialog closes the popover, not the window", async () => {
  const user = userEvent.setup();
  const onClose = vi.fn();
  const ref = createRef<RichTextEditorHandle>();
  render(
    <Dialog open onClose={onClose} title="Edit article">
      <RichTextEditor ref={ref} aria-label="Body" defaultValue="<p>Read the docs</p>" />
    </Dialog>
  );
  const editor = ref.current!.editor!;
  // `view.focus()`, not the `focus()` command: the command sets focus on the next
  // frame and would take it from the popover that is already open.
  act(() => editor.view.focus());
  act(() => void editor.commands.setTextSelection({ from: 10, to: 14 }));

  pressModK(editor);
  expect(await screen.findByRole("textbox", { name: "Address" })).toBeDefined();
  await user.keyboard("{Escape}");

  expect(screen.queryByRole("textbox", { name: "Address" })).toBeNull();
  expect(screen.getByRole("dialog", { name: "Edit article" })).toBeDefined();
  expect(onClose).not.toHaveBeenCalled();

  // Control: without the popover, the same Escape closes the dialog.
  await waitFor(() => expect(document.activeElement).toBe(editor.view.dom));
  await user.keyboard("{Escape}");
  expect(onClose).toHaveBeenCalledTimes(1);
});

test("the link popover speaks the provider's language", async () => {
  const user = userEvent.setup();
  const ref = createRef<RichTextEditorHandle>();
  render(
    <UiProvider messages={ru}>
      <RichTextEditor ref={ref} aria-label="Body" defaultValue="<p>Click me</p>" />
    </UiProvider>
  );
  const editor = ref.current!.editor!;
  act(() => void editor.commands.setTextSelection({ from: 1, to: 6 }));

  // The expectations come from the Russian catalog, not from literals (i18n gate).
  const t = ru.editor;
  await user.click(screen.getByRole("button", { name: t.link }));
  expect(screen.getByRole("dialog", { name: t.link })).toBeDefined();
  const field = screen.getByRole("textbox", { name: t.linkAddress });
  await user.type(field, "javascript:x{Enter}");
  expect(document.getElementById(field.getAttribute("aria-describedby")!)?.textContent).toBe(
    t.linkInvalid
  );
  expect(screen.getByRole("button", { name: t.linkApply })).toBeDefined();
  expect(screen.queryByRole("button", { name: "Apply" })).toBeNull();
});
