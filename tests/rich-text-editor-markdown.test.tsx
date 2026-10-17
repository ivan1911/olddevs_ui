// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import type { Editor } from "@tiptap/react";
import { createRef } from "react";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import {
  RichTextEditor,
  type RichTextEditorHandle,
  type RichTextEditorProps,
} from "../src/editor/index.js";
import { TOOLS } from "../src/editor/core/tools.js";
import { loadLazyBuiltins } from "./editor-lazy-builtins.js";

// Lazy `codeBlock` and `table` (OLDSUI-111): `full` is ready in `render` once the chunks load.
beforeAll(loadLazyBuiltins);

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function renderEditor(props: Partial<RichTextEditorProps> = {}) {
  const ref = createRef<RichTextEditorHandle>();
  render(<RichTextEditor ref={ref} aria-label="Body" {...props} />);
  const handle = ref.current;
  if (!handle?.editor) throw new Error("the editor was not created inside render()");
  return { handle, editor: handle.editor };
}

test("setMarkdown replaces the document and hands the new HTML to onChange at once", () => {
  const onChange = vi.fn();
  const { handle } = renderEditor({ defaultValue: "<p>old</p>", onChange });
  vi.useFakeTimers();

  act(() => handle.setMarkdown("## Title\n\n- one\n- two"));

  const html = "<h2>Title</h2><ul><li><p>one</p></li><li><p>two</p></li></ul>";
  expect(handle.getHTML()).toBe(html);
  // As with `clear()`: the consumer makes the call, but the owner holds the value;
  // without an immediate `onChange`, controlled mode would bring the previous text back.
  expect(onChange).toHaveBeenCalledTimes(1);
  expect(onChange).toHaveBeenLastCalledWith(html);
  // The deferred `onChange` from the replacement itself must not report the same value a second time.
  act(() => void vi.advanceTimersByTime(1000));
  expect(onChange).toHaveBeenCalledTimes(1);
});

test("a document without colour or alignment survives setMarkdown then getMarkdown", () => {
  const { handle } = renderEditor();
  const markdown = [
    "## Title",
    "",
    "Text with **bold**, *italic*, ~~struck~~ and `code`.",
    "",
    "- one",
    "- two",
    "",
    "3. three",
    "4. four",
    "",
    "> quoted",
    "",
    "---",
  ].join("\n");

  act(() => handle.setMarkdown(markdown));

  expect(handle.getMarkdown().trim()).toBe(markdown);
});

test("an empty document exports an empty string", () => {
  const { handle } = renderEditor();
  expect(handle.getMarkdown()).toBe("");
});

test("setMarkdown drops what the editor schema does not know and keeps the text", () => {
  const { handle } = renderEditor();
  const markdown = [
    "# Top",
    "",
    "A [link](https://example.com) and ![alt](https://example.com/a.png).",
    "",
    "| a | b |",
    "| - | - |",
    "| 1 | 2 |",
    "",
    "<script>steal()</script>",
  ].join("\n");

  act(() => handle.setMarkdown(markdown));

  const html = handle.getHTML();
  // `#` is H1: `full` has the `heading1` Tool. Without it, `#` becomes H2
  // (`rich-text-editor-heading1.test.tsx`).
  expect(html).toContain("<h1>Top</h1>");
  expect(handle.getMarkdown()).toContain("# Top");
  expect(html).not.toMatch(/<script[\s>]/);
  // The table is in the Schema since OLDSUI-45: it passes through, not left as text.
  expect(html).toContain("<table>");
  // The image is in the Schema since OLDSUI-44: it passes through as its own Block.
  expect(html).toContain('<figure><img src="https://example.com/a.png" alt="alt"></figure>');
  // The link is in the Schema since OLDSUI-42: it passes through and keeps its wrapper.
  expect(html).toContain('<a href="https://example.com" rel="noopener noreferrer">link</a>');
});

test("setMarkdown turns a task list and a code fence into their blocks in the full preset", () => {
  const { handle } = renderEditor();
  const markdown = "- [ ] todo\n- [x] done\n\n```js\nrun()\n```";

  act(() => handle.setMarkdown(markdown));

  const html = handle.getHTML();
  expect(html).toContain('<ul data-type="taskList">');
  expect(html).toContain('<li data-checked="true" data-type="taskItem">');
  // The fence alias (`js`) comes into the Document as the full language name (OLDSUI-50).
  expect(html).toContain('<pre><code class="language-javascript">run()</code></pre>');
  // Back out with the full name: `getMarkdown()` writes the language as it is in the Document.
  expect(handle.getMarkdown().trim()).toBe(markdown.replace("```js", "```javascript"));
});

/**
 * A paste from the clipboard through a plain `paste` event with `clipboardData`:
 * ProseMirror reads `text/plain` and `text/html` from it just as from a live
 * clipboard. jsdom has no `ClipboardEvent` or `DataTransfer`, so the data is an object.
 */
function paste(editor: Editor, payload: { text?: string; html?: string }) {
  const event = new Event("paste", { bubbles: true, cancelable: true });
  Object.assign(event, {
    clipboardData: {
      // The other types (`vscode-editor-data` and the like) are empty, as in a clipboard without them.
      getData: (type: string) =>
        (type === "text/plain" ? payload.text : type === "text/html" ? payload.html : "") ?? "",
      types: Object.keys(payload).map((key) => (key === "text" ? "text/plain" : "text/html")),
    },
  });
  act(() => void editor.view.dom.dispatchEvent(event));
}

test("pasted Markdown text turns into blocks and marks", () => {
  const { editor } = renderEditor();

  paste(editor, { text: "## Plan\n\n1. first **step**\n2. second\n\n> note" });

  expect(editor.getHTML()).toBe(
    "<h2>Plan</h2><ol><li><p>first <strong>step</strong></p></li><li><p>second</p></li></ol>" +
      "<blockquote><p>note</p></blockquote>"
  );
});

test("plain text without Markdown signs still pastes as plain paragraphs", () => {
  const { editor } = renderEditor();

  paste(editor, {
    text: "Meeting at 10:00\nTotal: 6 = 2 * 3, file_name_v2 stays as is\n\nSecond paragraph",
  });

  expect(editor.getHTML()).toBe(
    "<p>Meeting at 10:00</p><p>Total: 6 = 2 * 3, file_name_v2 stays as is</p>" +
      "<p>Second paragraph</p>"
  );
});

test("an HTML payload keeps the HTML path even when its plain text looks like Markdown", () => {
  const { editor } = renderEditor();

  paste(editor, { text: "## Not a heading", html: "<p>Just <em>text</em></p>" });

  expect(editor.getHTML()).toBe("<p>Just <em>text</em></p>");
});

test("a Markdown phrase pasted mid-sentence continues the paragraph", () => {
  const { editor } = renderEditor({ defaultValue: "<p>ab</p>" });
  act(() => void editor.commands.setTextSelection(2));

  paste(editor, { text: "**bold** and `code`" });

  expect(editor.getHTML()).toBe("<p>a<strong>bold</strong> and <code>code</code>b</p>");
});

test("pasted Markdown is cut to maxLength like any other paste", () => {
  const { editor } = renderEditor({ maxLength: 8 });

  paste(editor, { text: "- 12345\n- 67890" });

  expect(editor.getText({ blockSeparator: "" }).length).toBeLessThanOrEqual(8);
});

test.each([
  ["a heading", "### Section", "<h3>Section</h3>"],
  ["a bullet list", "* one\n* two", "<ul><li><p>one</p></li><li><p>two</p></li></ul>"],
  [
    "a task list",
    "- [ ] todo\n- [x] done",
    '<ul data-type="taskList"><li data-checked="false" data-type="taskItem">',
  ],
  [
    "a code fence",
    "```js\nrun()\n```",
    '<pre><code class="language-javascript">run()</code></pre>',
  ],
  ["a quote", "> said", "<blockquote><p>said</p></blockquote>"],
  [
    "a link",
    "see [docs](https://example.com)",
    '<p>see <a href="https://example.com" rel="noopener noreferrer">docs</a></p>',
  ],
  ["italic", "an _accent_ here", "<p>an <em>accent</em> here</p>"],
  ["strikethrough", "~~old~~", "<p><s>old</s></p>"],
])("pasting %s is recognised as Markdown", (_name, text, expected) => {
  const { editor } = renderEditor();

  paste(editor, { text });

  expect(editor.getHTML()).toContain(expected);
});

/*
  Markdown links on paste (OLDSUI-71). A link in the Schema has one attribute —
  `href`: the title is dropped, and a footnote definition does not get into the Document.
*/
const DOCS_LINK = '<a href="https://example.com/docs" rel="noopener noreferrer">the docs</a>';

test.each([
  ["an inline link", "See [the docs](https://example.com/docs) for more."],
  ["a link with a title", 'See [the docs](https://example.com/docs "Docs") for more.'],
  [
    "a link with a title in single quotes",
    "See [the docs](https://example.com/docs 'Docs') for more.",
  ],
  ["a reference link", "See [the docs][1] for more.\n\n[1]: https://example.com/docs"],
  [
    "a collapsed reference link",
    "See [the docs][] for more.\n\n[the docs]: https://example.com/docs",
  ],
  [
    "a shortcut reference link",
    "See [the docs] for more.\n\n[The Docs]: <https://example.com/docs>",
  ],
])("pasting %s gives a link with its text and address", (_name, text) => {
  const { editor } = renderEditor();

  paste(editor, { text });

  expect(editor.getHTML()).toBe(`<p>See ${DOCS_LINK} for more.</p>`);
});

test("a pasted autolink in angle brackets keeps no brackets", () => {
  const { editor } = renderEditor();

  paste(editor, { text: "See <https://example.com/docs> for more." });

  expect(editor.getHTML()).toBe(
    '<p>See <a href="https://example.com/docs" rel="noopener noreferrer">https://example.com/docs</a>' +
      " for more.</p>"
  );
});

// The Cyrillic word for "link" is written as escape sequences: here it is input
// data, and the i18n gate would reject it written as letters (`tests/i18n-gate.test.ts`).
const CYRILLIC_PAGE = "\u0421\u0441\u044b\u043b\u043a\u0430";

test.each([
  [
    "in a list",
    "- see [docs](https://example.com)",
    '<ul><li><p>see <a href="https://example.com" rel="noopener noreferrer">docs</a></p></li></ul>',
  ],
  [
    "in bold",
    "**[docs](https://example.com)**",
    // The order of Marks is the order of the Schema: the link is outside the bold.
    '<p><a href="https://example.com" rel="noopener noreferrer"><strong>docs</strong></a></p>',
  ],
  [
    "with Cyrillic in the address",
    `see [wiki](https://ru.wikipedia.org/wiki/${CYRILLIC_PAGE})`,
    `<p>see <a href="https://ru.wikipedia.org/wiki/${CYRILLIC_PAGE}" rel="noopener noreferrer">wiki</a></p>`,
  ],
  [
    "as a bare address",
    "see https://example.com/docs now",
    '<p>see <a href="https://example.com/docs" rel="noopener noreferrer">https://example.com/docs</a> now</p>',
  ],
  // The link policy does not allow a relative address (only http, https, mailto),
  // so the link text stays.
  [
    "with a relative address",
    "see [docs](/docs) and **more**",
    "<p>see docs and <strong>more</strong></p>",
  ],
])("a pasted link %s still works", (_name, text, expected) => {
  const { editor } = renderEditor();

  paste(editor, { text });

  expect(editor.getHTML()).toBe(expected);
});

test.each([
  ["a title", 'See [the docs](https://example.com/docs "Docs") for more.'],
  ["a reference", "See [the docs][1] for more.\n\n[1]: https://example.com/docs"],
])("setMarkdown reads a link with %s, getMarkdown writes it back inline", (_name, markdown) => {
  const { handle } = renderEditor();

  act(() => handle.setMarkdown(markdown));

  expect(handle.getHTML()).toBe(`<p>See ${DOCS_LINK} for more.</p>`);
  expect(handle.getMarkdown().trim()).toBe("See [the docs](https://example.com/docs) for more.");
});

/*
  A code editor puts `text/html` on the clipboard next to `text/plain`: the same
  source, colored by syntax highlighting. The samples below repeat what VS Code and
  JetBrains give: a monospace block, lines as `div` or line breaks in `pre`, and
  color as `span` with `color`.
*/
const VS_CODE_LINE =
  `<meta charset='utf-8'><div style="color: #cccccc;background-color: #1f1f1f;font-family: Menlo;">` +
  `<div><span style="color: #cccccc;">See </span><span style="color: #3794ff;">[the docs]</span>` +
  `<span style="color: #cccccc;">(</span><span style="color: #3794ff;">https://example.com/docs</span>` +
  `<span style="color: #cccccc;">) for more.</span></div></div>`;

test("Markdown copied from VS Code pastes as Markdown, without the highlighting colours", () => {
  const { editor } = renderEditor();

  paste(editor, { text: "See [the docs](https://example.com/docs) for more.", html: VS_CODE_LINE });

  expect(editor.getHTML()).toBe(`<p>See ${DOCS_LINK} for more.</p>`);
});

test("a multi-line Markdown file from VS Code keeps its blocks", () => {
  const { editor } = renderEditor();
  const span = (color: string, text: string) => `<span style="color: ${color};">${text}</span>`;
  const html =
    `<meta charset='utf-8'><div style="color: #3b3b3b;background-color: #ffffff;` +
    `font-family: Menlo, Monaco, 'Courier New', monospace;font-weight: normal;font-size: 12px;` +
    `line-height: 18px;white-space: pre;">` +
    `<div>${span("#800000", "## Plan")}</div><br>` +
    `<div>${span("#0451a5", "-")}${span("#3b3b3b", " read ")}${span("#a31515", "[the docs][1]")}</div>` +
    `<div>${span("#0451a5", "-")}${span("#3b3b3b", " ship")}</div><br>` +
    `<div>${span("#a31515", "[1]:")}${span("#3b3b3b", " ")}${span("#a31515", "https://example.com/docs")}</div></div>`;

  paste(editor, {
    text: "## Plan\n\n- read [the docs][1]\n- ship\n\n[1]: https://example.com/docs",
    html,
  });

  expect(editor.getHTML()).toBe(
    `<h2>Plan</h2><ul><li><p>read ${DOCS_LINK}</p></li><li><p>ship</p></li></ul>`
  );
});

test("Markdown copied from a JetBrains IDE pastes as Markdown", () => {
  const { editor } = renderEditor();
  const html =
    `<html><head><meta http-equiv="content-type" content="text/html; charset=UTF-8">` +
    `<style type="text/css">.s0 { color: #0033b3;} .s1 { color: #080808;}</style></head><body>` +
    `<pre style="background-color:#ffffff;color:#080808;font-family:'JetBrains Mono',monospace;font-size:9,8pt;">` +
    `<span class="s0">**Note:**</span><span class="s1"> see </span>` +
    `<span class="s0">[the docs](https://example.com/docs "Docs")</span></pre></body></html>`;

  paste(editor, { text: '**Note:** see [the docs](https://example.com/docs "Docs")', html });

  expect(editor.getHTML()).toBe(`<p><strong>Note:</strong> see ${DOCS_LINK}</p>`);
});

test("a highlighted block wrapped in an outer div (Sublime Text style) pastes as Markdown", () => {
  const { editor } = renderEditor();
  const html =
    `<div style="background-color: #303841;"><pre style="font-family: 'Fira Code'; color: #d8dee9;">` +
    `<span style="color: #f9ae58;">&gt; quoted </span><span style="color: #5fb4b4;">&lt;https://example.com/docs&gt;</span>` +
    `</pre></div>`;

  paste(editor, { text: "> quoted <https://example.com/docs>", html });

  expect(editor.getHTML()).toBe(
    '<blockquote><p>quoted <a href="https://example.com/docs" rel="noopener noreferrer">' +
      "https://example.com/docs</a></p></blockquote>"
  );
});

test("highlighted code that is not Markdown keeps the HTML path", () => {
  const { editor } = renderEditor();

  paste(editor, {
    text: "const total = 2 * 3;",
    html:
      `<div style="font-family: Menlo;"><div><span style="color: #569cd6;">const</span>` +
      `<span style="color: #9cdcfe;"> total = 2 * 3;</span></div></div>`,
  });

  expect(editor.getText()).toBe("const total = 2 * 3;");
});

test("Shift-paste of highlighted Markdown stays plain text", () => {
  const { editor } = renderEditor();
  const text = "See [the docs](https://example.com/docs) for more.";

  act(() => void editor.commands.focus());
  fireEvent.keyDown(editor.view.dom, { key: "Shift", keyCode: 16, shiftKey: true });
  paste(editor, { text, html: VS_CODE_LINE });
  fireEvent.keyUp(editor.view.dom, { key: "Shift", keyCode: 16 });

  expect(editor.getText()).toBe(text);
});

/*
  Regression: plain HTML (browser, Word, Google Docs) keeps the old path, even when
  its `text/plain` looks like Markdown. The expectations are what these pastes gave
  before OLDSUI-71.
*/
test.each([
  [
    "a browser page with a link",
    "See the docs for **more**.",
    `<meta charset='utf-8'><span style="color: rgb(31, 35, 40); font-family: -apple-system, sans-serif;">See </span>` +
      `<a href="https://example.com/docs" style="color: rgb(9, 105, 218);">the docs</a>` +
      `<span style="color: rgb(31, 35, 40);"> for **more**.</span>`,
    `<p>See ${DOCS_LINK} for <strong>more</strong>.</p>`,
  ],
  [
    "a Word numbered list",
    "1.\tOne\n2.\tTwo",
    `<html xmlns:o="urn:schemas-microsoft-com:office:office"><head><meta charset="utf-8">` +
      `<style>p.MsoNormal{margin:0}</style></head><body lang=RU style='tab-interval:35.4pt'><!--StartFragment-->` +
      `<p class=MsoListParagraphCxSpFirst style='text-indent:-18.0pt;mso-list:l0 level1 lfo1'>` +
      `<span style='mso-list:Ignore'>1.<span style='font:7.0pt "Times New Roman"'>&nbsp;&nbsp;&nbsp; </span></span>One<o:p></o:p></p>` +
      `<p class=MsoListParagraphCxSpLast style='text-indent:-18.0pt;mso-list:l0 level1 lfo1'>` +
      `<span style='mso-list:Ignore'>2.<span style='font:7.0pt "Times New Roman"'>&nbsp;&nbsp;&nbsp; </span></span>Two<o:p></o:p></p>` +
      `<!--EndFragment--></body></html>`,
    "<p>1.&nbsp;&nbsp;&nbsp; One</p><p>2.&nbsp;&nbsp;&nbsp; Two</p>",
  ],
  [
    "a Google Docs list in a monospace font",
    "* one\n* two",
    `<meta charset="utf-8"><b style="font-weight:normal;" id="docs-internal-guid-1a2b3c">` +
      `<ul style="margin-top:0;margin-bottom:0;"><li dir="ltr" style="list-style-type:disc;">` +
      `<p dir="ltr" style="line-height:1.38;margin-top:0pt;margin-bottom:0pt;" role="presentation">` +
      `<span style="font-size:11pt;font-family:'Courier New',monospace;color:#000000;">one</span></p></li>` +
      `<li dir="ltr" style="list-style-type:disc;"><p dir="ltr"><a href="https://example.com/docs" style="text-decoration:none;">` +
      `<span style="font-size:11pt;color:#1155cc;text-decoration:underline;">two</span></a></p></li></ul></b>`,
    '<ul><li><p>one</p></li><li><p><a href="https://example.com/docs" rel="noopener noreferrer"><u>two</u></a></p></li></ul>',
  ],
])("%s keeps the HTML path", (_name, text, html, expected) => {
  const { editor } = renderEditor();

  paste(editor, { text, html });

  expect(editor.getHTML()).toBe(expected);
});

const GFM_TABLE = "| a | b |\n| --- | --- |\n| 1 | 2 |";
const TABLE_HTML =
  "<table><tbody><tr><th><p>a</p></th><th><p>b</p></th></tr>" +
  "<tr><td><p>1</p></td><td><p>2</p></td></tr></tbody></table>";

test("a pasted Markdown table becomes a table with a header row", () => {
  const { editor } = renderEditor();

  paste(editor, { text: GFM_TABLE });

  expect(editor.getHTML()).toBe(TABLE_HTML);
});

test("setMarkdown and getMarkdown round-trip a table with column alignment", () => {
  const { handle } = renderEditor();

  act(() =>
    handle.setMarkdown("Intro\n\n| Name | Qty |\n| :--- | ---: |\n| apple | 3 |\n| pear | 10 |")
  );

  const html = handle.getHTML();
  expect(html).toContain("<th><p>Name</p></th>");
  // `---:` is column alignment (`data-align` on each of its cells); `:---` is the
  // default, with no attribute. `style` is never written.
  expect(html).toContain('<th data-align="right"><p>Qty</p></th>');
  expect(html).toContain('<td data-align="right"><p>10</p></td>');
  expect(html).not.toMatch(/style|data-align="left"/);
  expect(handle.getMarkdown().trim()).toBe(
    ["Intro", "", "| Name  | Qty |", "| ----- | ---: |", "| apple | 3   |", "| pear  | 10  |"].join(
      "\n"
    )
  );
});

test("a table without the table tool stays as the text the author copied", () => {
  const { editor } = renderEditor({ tools: TOOLS.filter((tool) => tool !== "table") });

  paste(editor, { text: GFM_TABLE });

  // Dropping the block would silently lose what was pasted; when nothing is left of
  // the Markdown, the paste goes in as plain text.
  expect(editor.getText({ blockSeparator: "\n" })).toBe(GFM_TABLE);
  expect(editor.getHTML()).not.toContain("<table");
});

test("setMarkdown without the table tool drops the table", () => {
  const { handle } = renderEditor({ tools: TOOLS.filter((tool) => tool !== "table") });

  act(() => handle.setMarkdown(`Intro\n\n${GFM_TABLE}`));

  expect(handle.getHTML()).not.toContain("<table");
  expect(handle.getHTML()).toContain("<p>Intro</p>");
});

/**
 * Editors are independent: each has its own `marked` instance. A shared one would
 * leak a side effect: an Editor with the task list would leave its tokenizer to
 * every Editor created after it, and "an Editor without the task list" would parse
 * `- [ ]` as a task list. Parsing runs after both are created, in either creation order.
 */
test.each([
  ["with the task list first", true],
  ["without the task list first", false],
])("editors parse Markdown independently of each other, %s", (_name, withFirst) => {
  const withoutTaskList = TOOLS.filter((tool) => tool !== "taskList");
  const markdown = "- [ ] todo\n- [x] done";
  const mountWith = () => renderEditor();
  const mountWithout = () => renderEditor({ tools: withoutTaskList });

  const [first, second] = withFirst ? [mountWith(), mountWithout()] : [mountWithout(), mountWith()];
  const full = withFirst ? first : second;
  const reduced = withFirst ? second : first;

  act(() => reduced.handle.setMarkdown(markdown));
  act(() => full.handle.setMarkdown(markdown));

  expect(reduced.handle.getHTML()).toBe("<ul><li><p>todo</p></li><li><p>done</p></li></ul>");
  expect(full.handle.getHTML()).toContain('<ul data-type="taskList">');
});

/**
 * Markdown in an Editor with neither a task list nor a code block: "foreign
 * content is dropped" (`tools`, OLDSUI-41).
 */
const WITHOUT_TASK_LIST_AND_CODE_BLOCK = TOOLS.filter(
  (tool) => tool !== "taskList" && tool !== "codeBlock"
);

test("setMarkdown drops a task list and a code fence the editor has no tool for", () => {
  const { handle } = renderEditor({ tools: WITHOUT_TASK_LIST_AND_CODE_BLOCK });

  act(() => handle.setMarkdown("## Top\n\n- [ ] todo\n- [x] done\n\n```js\nrun()\n```"));

  const html = handle.getHTML();
  expect(html).toContain("<h2>Top</h2>");
  expect(html).not.toMatch(/<(pre|input|label)[\s>]|data-type/);
});

test("pasting a task list the editor has no tool for keeps the items as a bullet list", () => {
  const { editor } = renderEditor({ tools: WITHOUT_TASK_LIST_AND_CODE_BLOCK });

  paste(editor, { text: "- [ ] todo\n- [x] done" });

  expect(editor.getHTML()).toContain("<ul><li><p>todo</p></li><li><p>done</p></li></ul>");
});

test("a code fence the editor has no tool for stays as the text the author copied", () => {
  const { editor } = renderEditor({ tools: WITHOUT_TASK_LIST_AND_CODE_BLOCK });
  const text = "```js\nrun()\n```";

  paste(editor, { text });

  // Dropping the block would silently lose what was pasted; when nothing is left of
  // the Markdown, the paste goes in as plain text.
  expect(editor.getText({ blockSeparator: "\n" })).toBe(text);
  expect(editor.getHTML()).not.toContain("<pre");
});

test("table cells keep their marks and links through Markdown", () => {
  const { handle } = renderEditor();

  act(() =>
    handle.setMarkdown("| **a** | [b](https://example.com) |\n| --- | --- |\n| `c` | d \\| e |")
  );

  expect(handle.getHTML()).toBe(
    "<table><tbody><tr>" +
      "<th><p><strong>a</strong></p></th>" +
      '<th><p><a href="https://example.com" rel="noopener noreferrer">b</a></p></th></tr>' +
      "<tr><td><p><code>c</code></p></td><td><p>d | e</p></td></tr></tbody></table>"
  );
  expect(handle.getMarkdown()).toContain("| d \\| e");
});
