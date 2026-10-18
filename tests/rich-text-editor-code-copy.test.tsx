// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { createRef } from "react";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { UiProvider } from "../src/i18n/UiProvider.js";
import { messages as ru } from "../src/locales/ru.js";
import {
  RICH_TEXT_PRESETS,
  RichTextEditor,
  type RichTextEditorHandle,
  type RichTextEditorProps,
} from "../src/editor/index.js";
import { loadLazyBuiltins } from "./editor-lazy-builtins.js";

// Lazy `codeBlock` and `table` (OLDSUI-111): `full` is ready in `render` after the chunks load.
beforeAll(loadLazyBuiltins);

afterEach(cleanup);

/**
 * The "Copy" button in the header of a code block (OLDSUI-50, ADR-0039): the clipboard
 * gets the block's text as a string, not the highlight markup, and the Editor has the
 * button in every mode — copying works even when editing is not allowed.
 */

function renderEditor(props: Partial<RichTextEditorProps> = {}) {
  const ref = createRef<RichTextEditorHandle>();
  const view = render(<RichTextEditor ref={ref} aria-label="Body" {...props} />);
  const editor = ref.current?.editor;
  if (!editor) throw new Error("the editor was not created inside render()");
  return { ...view, ref, editor };
}

async function settle() {
  await act(async () => {});
}

/** The stub is set AFTER `userEvent.setup()`: that call replaces `navigator.clipboard` itself. */
function setupClipboard() {
  const user = userEvent.setup();
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  return { user, writeText };
}

const PYTHON = "def greet(name):\n    return f'hi {name}'\n";

test("each block has a copy button in its header, next to the language", async () => {
  renderEditor({
    defaultValue:
      '<pre><code class="language-python">a = 1</code></pre><pre><code>plain</code></pre>',
  });
  await settle();

  expect(screen.getAllByRole("button", { name: "Copy" })).toHaveLength(2);
  const header = screen.getAllByRole("button", { name: "Copy" })[0]!.closest("[data-code-header]");
  expect(header).not.toBeNull();
  expect(header!.contains(screen.getByRole("button", { name: "Language: Python" }))).toBe(true);
  // The header is block chrome: not content, and the caret cannot be placed in it.
  expect(header!.getAttribute("contenteditable")).toBe("false");
});

test("clicking copy writes the exact text of a highlighted block, without markup", async () => {
  const { user, writeText } = setupClipboard();
  const { editor } = renderEditor({
    defaultValue: `<pre><code class="language-python">${PYTHON.replace(/\n$/, "")}</code></pre>`,
  });
  await settle();
  // The tokens are in the DOM — but they do not go to the clipboard.
  expect(editor.view.dom.querySelector("pre code [class*='hljs-']")).not.toBeNull();

  await user.click(screen.getByRole("button", { name: "Copy" }));

  expect(writeText).toHaveBeenCalledTimes(1);
  expect(writeText).toHaveBeenCalledWith("def greet(name):\n    return f'hi {name}'");
});

test("it copies the block it sits in, and follows edits of its text", async () => {
  const { user, writeText } = setupClipboard();
  const { editor } = renderEditor({
    defaultValue: "<pre><code>first</code></pre><pre><code>second</code></pre>",
  });
  await settle();
  act(() => void editor.commands.setTextSelection(6));
  act(() => void editor.commands.insertContent("!"));
  await settle();

  const [, secondCopy] = screen.getAllByRole("button", { name: "Copy" });
  await user.click(secondCopy!);
  expect(writeText).toHaveBeenLastCalledWith("second");
  await user.click(screen.getAllByRole("button", { name: "Copy" })[0]!);
  expect(writeText).toHaveBeenLastCalledWith("first!");
});

test("the result is announced and the tooltip text becomes «Copied»", async () => {
  const { user } = setupClipboard();
  renderEditor({ defaultValue: "<pre><code>x</code></pre>" });
  await settle();

  await user.click(screen.getByRole("button", { name: "Copy" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Copied" })).toBeTruthy());
  expect(screen.getAllByRole("status").some((region) => region.textContent === "Copied")).toBe(
    true
  );
});

test.each([
  ["editable", {}],
  ["read-only", { readOnly: true }],
  ["disabled", { disabled: true }],
] as const)("copy works in a %s editor", async (_mode, props) => {
  const { user, writeText } = setupClipboard();
  renderEditor({
    ...props,
    defaultValue: '<pre><code class="language-go">x := 1</code></pre>',
  });
  await settle();

  await user.click(screen.getByRole("button", { name: "Copy" }));
  expect(writeText).toHaveBeenCalledWith("x := 1");
});

test("read-only and disabled show the language as a label on the left, copy still on the right", async () => {
  renderEditor({
    readOnly: true,
    defaultValue: '<pre><code class="language-yaml">a: 1</code></pre>',
  });
  await settle();

  expect(screen.queryByRole("button", { name: /Language/ })).toBeNull();
  const header = document.querySelector("[data-code-header]")!;
  expect(header.firstElementChild?.textContent).toBe("YAML");
  expect(header.lastElementChild?.contains(screen.getByRole("button", { name: "Copy" }))).toBe(
    true
  );
});

test("a read-only block without a language has no label: «Plain text» belongs to the menu button", async () => {
  renderEditor({ readOnly: true, defaultValue: "<pre><code>x</code></pre>" });
  await settle();

  // `RichTextView` (the server-side one) gives such a block no name: it has no catalog
  // either; the read-only Editor does not diverge from it.
  expect(document.querySelector("[data-code-header]")!.firstElementChild?.textContent).toBe("");
});

test("copy appears when the editor goes read-only on the fly", async () => {
  const { rerender, ref } = renderEditor({ defaultValue: "<pre><code>x</code></pre>" });
  await settle();
  rerender(<RichTextEditor ref={ref} aria-label="Body" readOnly defaultValue="x" />);
  await settle();

  expect(screen.getAllByRole("button", { name: "Copy" })).toHaveLength(1);
});

test("copy stays out of the Tab order while the editor is editable, and in it when it is not", async () => {
  const { rerender, ref } = renderEditor({ defaultValue: "<pre><code>x</code></pre>" });
  await settle();
  expect(screen.getByRole("button", { name: "Copy" }).getAttribute("tabindex")).toBe("-1");

  rerender(<RichTextEditor ref={ref} aria-label="Body" readOnly defaultValue="x" />);
  await settle();
  // Read-only: there is no caret, and `Alt+F10` from the block is unavailable — the
  // button must be reachable with a plain Tab.
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Copy" }).getAttribute("tabindex")).not.toBe("-1")
  );
});

test("the tooltip and the name speak Russian with the Russian catalog", async () => {
  render(
    <UiProvider messages={ru}>
      <RichTextEditor aria-label="Body" defaultValue="<pre><code>x</code></pre>" />
    </UiProvider>
  );
  await settle();

  expect(screen.getByRole("button", { name: ru.copyButton.copy })).toBeTruthy();
});

/*
  Keyboard. Both header buttons are outside the Tab order: the entry is `Alt+F10` from
  the block, to the language; then `Alt+F10` or the arrows move along the header, and
  `Escape` returns to the code.
*/
test("Alt+F10 cycles language, copy, toolbar; Escape from copy returns to the code", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({
    defaultValue: '<p>before</p><pre><code class="language-go">x := 1</code></pre>',
  });
  await settle();
  act(() => void editor.chain().focus().setTextSelection(11).run());
  await waitFor(() => expect(editor.view.hasFocus()).toBe(true));

  await user.keyboard("{Alt>}{F10}{/Alt}");
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Language: Go" }));
  await user.keyboard("{Alt>}{F10}{/Alt}");
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Copy" }));

  await user.keyboard("{Escape}");
  expect(editor.view.hasFocus()).toBe(true);
  expect(editor.state.selection.from).toBe(11);
});

test("arrow keys move between the language button and copy", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({
    defaultValue: '<pre><code class="language-go">x</code></pre>',
  });
  await settle();
  act(() => void editor.chain().focus().setTextSelection(2).run());
  await waitFor(() => expect(editor.view.hasFocus()).toBe(true));

  await user.keyboard("{Alt>}{F10}{/Alt}");
  await user.keyboard("{ArrowRight}");
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Copy" }));
  await user.keyboard("{ArrowLeft}");
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Language: Go" }));
});

test("Enter on the focused copy button copies", async () => {
  const { user, writeText } = setupClipboard();
  const { editor } = renderEditor({
    defaultValue: '<pre><code class="language-go">x := 1</code></pre>',
  });
  await settle();
  act(() => void editor.chain().focus().setTextSelection(2).run());
  await waitFor(() => expect(editor.view.hasFocus()).toBe(true));

  await user.keyboard("{Alt>}{F10}{/Alt}{Alt>}{F10}{/Alt}");
  await user.keyboard("{Enter}");

  expect(writeText).toHaveBeenCalledWith("x := 1");
});

test("a read-only editor puts copy into the Tab order: that is the only way to it", async () => {
  const { user } = setupClipboard();
  // Without Block selection a read-only Document takes no focus, and copy is the first stop.
  renderEditor({
    readOnly: true,
    tools: RICH_TEXT_PRESETS.full.filter((name) => name !== "blockSelection"),
    defaultValue: "<pre><code>x</code></pre>",
  });
  await settle();

  await user.tab();
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Copy" }));
});

test("with Block selection the read-only Document comes first, then copy (ADR-0077, decision 13)", async () => {
  const { user } = setupClipboard();
  const { editor } = renderEditor({ readOnly: true, defaultValue: "<pre><code>x</code></pre>" });
  await settle();

  await user.tab();
  expect(document.activeElement).toBe(editor.view.dom);
  await user.tab();
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Copy" }));
});
