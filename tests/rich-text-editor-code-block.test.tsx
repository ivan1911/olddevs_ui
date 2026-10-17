// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import type { Editor } from "@tiptap/react";
import { createRef } from "react";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { Dialog } from "../src/components/overlays/Dialog.js";
import { Drawer } from "../src/components/overlays/Drawer.js";
import { UiProvider } from "../src/i18n/UiProvider.js";
import { messages as ru } from "../src/locales/ru.js";
import {
  RichTextEditor,
  type RichTextEditorHandle,
  type RichTextEditorProps,
} from "../src/editor/index.js";
import { RICH_TEXT_SCHEMA } from "../src/editor/core/schema.js";
import { loadLazyBuiltins } from "./editor-lazy-builtins.js";

// Lazy `codeBlock` and `table` (OLDSUI-111): `full` is ready in `render` after the chunks load.
beforeAll(loadLazyBuiltins);

afterEach(cleanup);

/**
 * A code block with a language and highlighting (OLDSUI-50, ADR-0051). Only the language
 * is written into the Document — `class="language-…"`; the token markup lives in the
 * Editor's decorations and does not get into the saved HTML.
 */

function renderEditor(props: Partial<RichTextEditorProps> = {}) {
  const ref = createRef<RichTextEditorHandle>();
  const view = render(<RichTextEditor ref={ref} aria-label="Body" {...props} />);
  const editor = ref.current?.editor;
  if (!editor) throw new Error("the editor was not created inside render()");
  return { ...view, ref, editor };
}

/**
 * The React portal renders a Tiptap node view in a microtask: the language button and the
 * block wrapper appear after it, not right after the transaction.
 */
async function settle() {
  await act(async () => {});
}

/** Types text along the same path ProseMirror receives it from the browser. */
function typeText(editor: Editor, text: string) {
  act(() => {
    for (const char of text) {
      const { from, to } = editor.state.selection;
      const handled = editor.view.someProp("handleTextInput", (handler) =>
        handler(editor.view, from, to, char, () => editor.state.tr.insertText(char, from, to))
      );
      if (!handled) editor.view.dispatch(editor.state.tr.insertText(char, from, to));
    }
  });
}

test("a fence with a language opens a code block in that language", () => {
  const { editor } = renderEditor();

  typeText(editor, "```python ");
  typeText(editor, "print(1)");

  expect(editor.getHTML()).toBe('<pre><code class="language-python">print(1)</code></pre>');
});

test.each([
  ["py", "python"],
  ["ts", "typescript"],
  ["js", "javascript"],
  ["golang", "go"],
  ["htm", "html"],
  ["yml", "yaml"],
  ["md", "markdown"],
])("the fence alias %s is stored as %s", (alias, language) => {
  const { editor } = renderEditor();

  typeText(editor, `\`\`\`${alias} `);

  expect(editor.getHTML()).toBe(`<pre><code class="language-${language}"></code></pre>`);
});

/*
  JSON (OLDSUI-59): the ```json fence is what any README with an API response example
  writes. There is no alias: the JSON grammar cannot parse `jsonc` with comments, and it
  is more honest to show "Plain text" than highlighting with errors.
*/
test("a json fence opens a JSON block, and jsonc stays plain text", () => {
  const { editor } = renderEditor();

  typeText(editor, "```json ");
  expect(editor.getHTML()).toBe('<pre><code class="language-json"></code></pre>');

  const other = renderEditor().editor;
  typeText(other, "```jsonc ");
  expect(other.getHTML()).toBe("<pre><code></code></pre>");
});

test("a fence in a language the editor does not know opens a plain-text block", () => {
  const { editor } = renderEditor();

  typeText(editor, "```rust ");

  expect(editor.getHTML()).toBe("<pre><code></code></pre>");
});

test("a saved block with an alias or an unknown language loads in the document's form", () => {
  const { editor } = renderEditor({
    defaultValue:
      '<pre><code class="language-py">a = 1</code></pre>' +
      '<pre><code class="language-YML">a: 1</code></pre>' +
      '<pre><code class="language-rust">fn main() {}</code></pre>' +
      '<pre><code class="hljs language-htm">&lt;p&gt;</code></pre>',
  });

  expect(editor.getHTML()).toBe(
    '<pre><code class="language-python">a = 1</code></pre>' +
      '<pre><code class="language-yaml">a: 1</code></pre>' +
      "<pre><code>fn main() {}</code></pre>" +
      '<pre><code class="language-html">&lt;p&gt;</code></pre>'
  );
});

test("a block given an alias by an engine command is stored by its name", () => {
  const { editor } = renderEditor();

  act(() => void editor.commands.setCodeBlock({ language: "ts" }));

  expect(editor.getHTML()).toBe('<pre><code class="language-typescript"></code></pre>');
});

/** One sample per language: each has a keyword or a tag — something that is sure to get a token. */
const SAMPLES = {
  python: "def greet(name):\n    return f'hi {name}'",
  typescript: "const total: number = 1;",
  javascript: "function sum(a, b) { return a + b; }",
  go: 'func main() { fmt.Println("hi") }',
  html: '<a href="/x">link</a>',
  json: '{ "name": "ui", "version": 3, "private": true }',
  yaml: "name: ui\nversion: 3",
  markdown: "# Title\n\n- item",
} as const;

/* A sample for every language in the list: a new language without a sample breaks this test
   instead of passing unchecked. */
test("the samples cover every code block language", () => {
  expect(Object.keys(SAMPLES)).toEqual(RICH_TEXT_SCHEMA.codeLanguages);
});

test.each(Object.entries(SAMPLES))(
  "a %s block is highlighted in the editor and saved without the tokens",
  async (language, code) => {
    const { editor } = renderEditor();
    await act(async () => {
      editor.commands.setContent({
        type: "doc",
        content: [
          { type: "codeBlock", attrs: { language }, content: [{ type: "text", text: code }] },
        ],
      });
    });

    const tokens = editor.view.dom.querySelectorAll("pre code [class*='hljs-']");
    expect(tokens.length).toBeGreaterThan(0);
    // Tokens are only `hljs-*` classes: no `style`, no foreign classes.
    for (const token of tokens) {
      expect(token.getAttribute("style")).toBeNull();
      expect(token.className).toMatch(/^hljs-[\w-]+( [\w-]+)*$/);
    }
    const html = editor.getHTML();
    expect(html).not.toMatch(/hljs|style=|<span/);
    expect(html).toContain(`<pre><code class="language-${language}">`);
  }
);

test("a plain-text block is not highlighted, even when its text looks like code", () => {
  const { editor } = renderEditor({
    defaultValue: "<pre><code>function sum(a, b) { return a + b; }</code></pre>",
  });

  expect(editor.view.dom.querySelectorAll("pre [class*='hljs-']")).toHaveLength(0);
});

test("each block carries a language button named after its language", async () => {
  renderEditor({
    defaultValue:
      '<pre><code class="language-python">a = 1</code></pre><pre><code>plain</code></pre>',
  });
  await settle();

  const python = screen.getByRole("button", { name: "Language: Python" });
  expect(python.getAttribute("aria-haspopup")).toBe("menu");
  expect(screen.getByRole("button", { name: "Language: Plain text" })).toBeTruthy();
  // Outside the Tab order: the entry is `Alt+F10` from the block.
  expect(python.getAttribute("tabindex")).toBe("-1");
  expect(python.getAttribute("aria-keyshortcuts")).toBe("Alt+F10");
});

test("choosing a language changes the class in one undo step and returns focus to the code", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({
    defaultValue: '<pre><code class="language-python">a = 1</code></pre>',
  });
  await settle();
  act(() => void editor.commands.setTextSelection(2));
  // Typing right before the choice: history would merge it with the language change.
  act(() => void editor.commands.insertContent("b"));

  await user.click(screen.getByRole("button", { name: "Language: Python" }));
  const menu = screen.getByRole("menu", { name: "Language: Python" });
  const checked = menu.querySelector('[aria-checked="true"]');
  expect(checked?.textContent).toBe("Python");
  await user.click(screen.getByRole("menuitemradio", { name: "JSON" }));

  expect(editor.getHTML()).toBe('<pre><code class="language-json">ab = 1</code></pre>');
  await waitFor(() => expect(editor.view.hasFocus()).toBe(true));

  act(() => void editor.commands.undo());
  expect(editor.getHTML()).toBe('<pre><code class="language-python">ab = 1</code></pre>');
});

test("plain text removes the language from the block", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({
    defaultValue: '<pre><code class="language-go">x</code></pre>',
  });
  await settle();

  await user.click(screen.getByRole("button", { name: "Language: Go" }));
  await user.click(screen.getByRole("menuitemradio", { name: "Plain text" }));

  expect(editor.getHTML()).toBe("<pre><code>x</code></pre>");
});

test("Alt+F10 inside a code block focuses its language button, Escape returns to the code", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({
    defaultValue: '<p>before</p><pre><code class="language-go">x := 1</code></pre>',
  });
  await settle();
  act(() => void editor.chain().focus().setTextSelection(11).run());
  await waitFor(() => expect(editor.view.hasFocus()).toBe(true));

  await user.keyboard("{Alt>}{F10}{/Alt}");
  const trigger = screen.getByRole("button", { name: "Language: Go" });
  expect(document.activeElement).toBe(trigger);

  await user.keyboard("{Escape}");
  expect(editor.view.hasFocus()).toBe(true);
  expect(editor.state.selection.from).toBe(11);
});

/*
  Inside the dialog, Escape on the header buttons also returns to the code, and the
  dialog stays. Radix listens for Escape on the document in the capture phase, before the
  header does, and closed the dialog as soon as the language menu had time to disappear —
  that is, always, except for the fastest key repeat.
*/
test("inside a Dialog Escape on the header buttons returns to the code and keeps the window", async () => {
  const user = userEvent.setup();
  const onClose = vi.fn();
  const ref = createRef<RichTextEditorHandle>();
  render(
    <Dialog open onClose={onClose} title="Edit">
      <RichTextEditor
        ref={ref}
        aria-label="Body"
        defaultValue='<p>before</p><pre><code class="language-go">x := 1</code></pre>'
      />
    </Dialog>
  );
  await settle();
  const editor = ref.current!.editor!;
  act(() => void editor.chain().focus().setTextSelection(11).run());
  await waitFor(() => expect(editor.view.hasFocus()).toBe(true));

  await user.keyboard("{Alt>}{F10}{/Alt}");
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Language: Go" }));
  await user.keyboard("{Escape}");
  expect(editor.view.hasFocus()).toBe(true);
  expect(onClose).not.toHaveBeenCalled();

  await user.keyboard("{Alt>}{F10}{/Alt}{Alt>}{F10}{/Alt}");
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Copy" }));
  await user.keyboard("{Escape}");
  expect(editor.view.hasFocus()).toBe(true);
  expect(onClose).not.toHaveBeenCalled();

  // Escape from the code itself is the usual one: the dialog closes.
  await user.keyboard("{Escape}");
  expect(onClose).toHaveBeenCalledTimes(1);
});

/*
  The Drawer (OLDSUI-120) is the same Radix modal layer with its own guard against a
  foreign Escape: the code block's header must not close it either.
*/
test("inside a Drawer Escape on the language button returns to the code and keeps the drawer", async () => {
  const user = userEvent.setup();
  const onClose = vi.fn();
  const ref = createRef<RichTextEditorHandle>();
  render(
    <Drawer open onClose={onClose} title="Edit">
      <RichTextEditor
        ref={ref}
        aria-label="Body"
        defaultValue='<p>before</p><pre><code class="language-go">x := 1</code></pre>'
      />
    </Drawer>
  );
  await settle();
  const editor = ref.current!.editor!;
  act(() => void editor.chain().focus().setTextSelection(11).run());
  await waitFor(() => expect(editor.view.hasFocus()).toBe(true));

  await user.keyboard("{Alt>}{F10}{/Alt}");
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Language: Go" }));
  await user.keyboard("{Escape}");
  expect(editor.view.hasFocus()).toBe(true);
  expect(onClose).not.toHaveBeenCalled();

  await user.keyboard("{Escape}");
  expect(onClose).toHaveBeenCalledTimes(1);
});

test("Alt+F10 on the language button moves on to copy, and from copy to the toolbar", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({
    defaultValue: '<pre><code class="language-go">x</code></pre>',
  });
  await settle();
  act(() => void editor.chain().focus().setTextSelection(2).run());
  await waitFor(() => expect(editor.view.hasFocus()).toBe(true));

  await user.keyboard("{Alt>}{F10}{/Alt}");
  await user.keyboard("{Alt>}{F10}{/Alt}");
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Copy" }));

  await user.keyboard("{Alt>}{F10}{/Alt}");
  expect(document.activeElement?.closest('[role="toolbar"]')).not.toBeNull();
});

test("a read-only editor shows the language as text, without a button", async () => {
  const { rerender, ref } = renderEditor({
    readOnly: true,
    defaultValue: '<pre><code class="language-yaml">a: 1</code></pre>',
  });
  await settle();

  expect(screen.queryByRole("button", { name: /Language/ })).toBeNull();
  expect(ref.current!.editor!.view.dom.textContent).toContain("YAML");

  rerender(
    <RichTextEditor
      ref={ref}
      aria-label="Body"
      defaultValue='<pre><code class="language-yaml">a: 1</code></pre>'
    />
  );
  await settle();
  expect(screen.getByRole("button", { name: "Language: YAML" })).toBeTruthy();
});

test("the language button speaks Russian with the Russian catalog", async () => {
  render(
    <UiProvider messages={ru}>
      <RichTextEditor aria-label="Body" defaultValue="<pre><code>x</code></pre>" />
    </UiProvider>
  );
  await settle();

  const name = ru.editor.codeLanguage({ current: ru.editor.codeLanguagePlain });
  expect(screen.getByRole("button", { name })).toBeTruthy();
});

test("the schema names exactly the languages a code block may carry", () => {
  expect(RICH_TEXT_SCHEMA.codeLanguages).toEqual([
    "python",
    "typescript",
    "javascript",
    "go",
    "html",
    "json",
    "yaml",
    "markdown",
  ]);
});

test("a Markdown code block shows its language and is highlighted as Markdown", async () => {
  const { editor } = renderEditor({
    defaultValue: '<pre><code class="language-markdown"># Title\n\n- item</code></pre>',
  });
  await settle();

  expect(editor.getHTML()).toBe(
    '<pre><code class="language-markdown"># Title\n\n- item</code></pre>'
  );
  expect(screen.getByRole("button", { name: "Language: Markdown" })).toBeTruthy();
  expect(editor.view.dom.querySelector(".hljs-section")?.textContent).toBe("# Title");
});

/*
  A Markdown block almost always contains its own fence ```` ``` ````: a README example
  with code inside. The export must take a fence longer than any inner one, otherwise the
  inner ``` would close the outer block and the document would break on reload.
*/
test("a Markdown block that contains its own fence survives getMarkdown and setMarkdown", () => {
  const inner = "Install:\n\n```bash\nnpm i\n```";
  const { ref, editor } = renderEditor();
  act(() => {
    editor.commands.setContent({
      type: "doc",
      content: [
        {
          type: "codeBlock",
          attrs: { language: "markdown" },
          content: [{ type: "text", text: inner }],
        },
      ],
    });
  });

  const markdown = ref.current!.getMarkdown();
  act(() => ref.current!.setMarkdown(markdown));

  const block = editor.getJSON().content?.[0];
  expect(editor.getJSON().content).toHaveLength(1);
  expect(block?.attrs?.language).toBe("markdown");
  expect((block?.content?.[0] as { text?: string } | undefined)?.text).toBe(inner);
});

test("highlighted HTML loaded as a value comes back as the plain block: tokens are not data", () => {
  const { editor } = renderEditor({
    defaultValue:
      '<pre><code class="language-python"><span class="hljs-keyword">def</span> f(): ' +
      '<span class="hljs-keyword">pass</span></code></pre>',
  });

  expect(editor.getHTML()).toBe('<pre><code class="language-python">def f(): pass</code></pre>');
});
