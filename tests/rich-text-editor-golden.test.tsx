// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import type { Editor } from "@tiptap/react";
import { createRef } from "react";
import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import {
  RichTextEditor,
  type RichTextEditorHandle,
  type RichTextEditorProps,
} from "../src/editor/index.js";
import { loadLazyBuiltins } from "./editor-lazy-builtins.js";

// Lazy `codeBlock` and `table` (OLDSUI-111): `full` is ready in `render` once the chunks load.
beforeAll(loadLazyBuiltins);

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/*
  "Golden" tests of the built-in Tools (OLDSUI-273).

  The built-in Tools moved from the old registries, keyed by name, to descriptors
  (`features/builtins.ts`, `core/toolDescriptor.ts`) with no visible changes;
  these tests held the move and keep holding it. They pin what the Editor does
  today: the order of Marks in the saved HTML, the rows of the shortcut
  reference, the composition and order of buttons and menus, the priority of
  keys, and what survives a trimmed Schema. Snapshots are written from the
  current code and change only on purpose: editing a snapshot is a visible
  product change.

  Public behavior only: `RichTextEditor`, its engine through `ref`, roles and
  names in the DOM. Internal descriptors are not imported: the test holds the
  behavior. The language is English by default, and shortcuts are as in jsdom
  (not Apple): `Ctrl`.
*/

function renderEditor(props: Partial<RichTextEditorProps> = {}) {
  const ref = createRef<RichTextEditorHandle>();
  const view = render(
    <>
      <button type="button">Before</button>
      <RichTextEditor ref={ref} aria-label="Body" {...props} />
    </>
  );
  const editor = ref.current?.editor;
  if (!editor) throw new Error("the editor was not created inside render()");
  return { ...view, ref, editor };
}

/** The Document's HTML by top-level Blocks: the snapshot reads line by line. */
function blocks(html: string): string[] {
  const root = document.createElement("div");
  root.innerHTML = html;
  return Array.from(root.children, (child) => child.outerHTML);
}

/** Range of the text `text` in the Document (first occurrence). */
function rangeOf(editor: Editor, text: string) {
  let from = -1;
  editor.state.doc.descendants((node, pos) => {
    if (from < 0 && node.isText && node.text?.includes(text)) from = pos + node.text.indexOf(text);
  });
  if (from < 0) throw new Error(`no text "${text}" in the document`);
  return { from, to: from + text.length };
}

function select(editor: Editor, text: string) {
  const range = rangeOf(editor, text);
  act(() => void editor.commands.setTextSelection(range));
}

/** Caret at the end (or at the start) of the text `text`. */
function caretIn(editor: Editor, text: string, at: "end" | "start" = "end") {
  const { from, to } = rangeOf(editor, text);
  act(() => {
    editor.view.focus();
    editor.commands.setTextSelection(at === "end" ? to : from);
  });
}

/** `keydown` on the document; `true` means the Editor released the key to the browser. */
function press(editor: Editor, key: string, init: KeyboardEventInit = {}) {
  const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init });
  act(() => void editor.view.dom.dispatchEvent(event));
  return !event.defaultPrevented;
}

// --- 1. Saved HTML: order of nested Marks -----------------------------

const LINK = "https://example.com/page";
const FIGURE = '<figure><img src="https://cdn.example.com/photo.png" alt="A lake"></figure>';
const TABLE =
  "<table><tbody><tr><th><p>H1</p></th><th><p>H2</p></th></tr>" +
  "<tr><td><p>c1</p></td><td><p>c2</p></td></tr></tbody></table>";

/** A Document with every kind of Block and Mark, including in different nesting orders. */
const EVERYTHING =
  // Marks nested in different orders: the serializer normalizes them to one order.
  "<p><strong><em><u><s>BIUS</s></u></em></strong> " +
  "<s><u><em><strong>SUIB</strong></em></u></s> " +
  "<u><strong><s><em>UBSE</em></s></strong></u></p>" +
  "<p><code>code</code> x<sup>2</sup> H<sub>2</sub>O " +
  `<a href="${LINK}">link</a> <mark data-color="yellow">marker</mark> ` +
  '<span style="color:#ff0000">red</span> <span data-color="danger">palette</span></p>' +
  // Everything at once on one run of text, from outside in, in an awkward order.
  `<p><a href="${LINK}"><mark data-color="green"><span style="color:#ff0000">` +
  "<s><u><em><strong><sup>everything</sup></strong></em></u></s></span></mark></a></p>" +
  "<h1>Heading 1</h1><h2>Heading 2</h2><h3>Heading 3</h3><h4>Heading 4</h4>" +
  "<ul><li><p>bullet</p></li></ul>" +
  "<ol><li><p>ordered</p></li></ol>" +
  '<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked><span></span></label><div><p>done</p></div></li>' +
  '<li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>todo</p></div></li></ul>' +
  "<blockquote><p>quote <strong>bold</strong></p></blockquote>" +
  '<pre><code class="language-ts">const a = 1;</code></pre>' +
  TABLE +
  '<div data-block="layout" data-layout="50-50"><div data-block="column"><p>left</p></div><div data-block="column"><p>right</p></div></div>' +
  '<div data-block="wrapper"><h2>In wrapper</h2><p>text</p></div>' +
  FIGURE +
  '<p data-align="center">centered</p><p data-align="right">right</p><hr>';

describe("saved HTML", () => {
  test("every kind of block and mark, as the Schema serializes it", () => {
    const { editor } = renderEditor({ defaultValue: EVERYTHING });

    expect(blocks(editor.getHTML())).toMatchInlineSnapshot(`
      [
        "<p><strong><em><s><u>BIUS</u></s></em></strong> <strong><em><s><u>SUIB</u></s></em></strong> <strong><em><s><u>UBSE</u></s></em></strong></p>",
        "<p><code>code</code> x<sup>2</sup> H<sub>2</sub>O <a href="https://example.com/page" rel="noopener noreferrer">link</a> <mark data-color="yellow">marker</mark> <span style="color:#ff0000">red</span> <span data-color="danger">palette</span></p>",
        "<p><span style="color:#ff0000"><mark data-color="green"><a href="https://example.com/page" rel="noopener noreferrer"><strong><em><s><u><sup>everything</sup></u></s></em></strong></a></mark></span></p>",
        "<h1>Heading 1</h1>",
        "<h2>Heading 2</h2>",
        "<h3>Heading 3</h3>",
        "<h4>Heading 4</h4>",
        "<ul><li><p>bullet</p></li></ul>",
        "<ol><li><p>ordered</p></li></ol>",
        "<ul data-type="taskList"><li data-checked="true" data-type="taskItem"><label><input type="checkbox" checked="checked"><span></span></label><div><p>done</p></div></li><li data-checked="false" data-type="taskItem"><label><input type="checkbox"><span></span></label><div><p>todo</p></div></li></ul>",
        "<blockquote><p>quote <strong>bold</strong></p></blockquote>",
        "<pre><code class="language-typescript">const a = 1;</code></pre>",
        "<table><tbody><tr><th><p>H1</p></th><th><p>H2</p></th></tr><tr><td><p>c1</p></td><td><p>c2</p></td></tr></tbody></table>",
        "<div data-block="layout" data-layout="50-50"><div data-block="column"><p>left</p></div><div data-block="column"><p>right</p></div></div>",
        "<div data-block="wrapper"><h2>In wrapper</h2><p>text</p></div>",
        "<figure><img src="https://cdn.example.com/photo.png" alt="A lake"></figure>",
        "<p data-align="center">centered</p>",
        "<p data-align="right">right</p>",
        "<hr>",
      ]
    `);
  });

  test("marks applied through commands in different orders land in one nesting order", () => {
    const order = [
      "toggleBold",
      "toggleItalic",
      "toggleUnderline",
      "toggleStrike",
      "toggleSuperscript",
    ] as const;
    const results: Record<string, string> = {};
    const orders: Record<string, readonly (typeof order)[number][]> = {
      forward: order,
      reversed: [...order].reverse(),
      strikeFirst: [
        "toggleStrike",
        "toggleUnderline",
        "toggleItalic",
        "toggleBold",
        "toggleSuperscript",
      ],
      underlineFirst: [
        "toggleUnderline",
        "toggleSuperscript",
        "toggleBold",
        "toggleStrike",
        "toggleItalic",
      ],
    };
    for (const [name, commands] of Object.entries(orders)) {
      const { editor, unmount } = renderEditor({ defaultValue: "<p>one two three</p>" });
      select(editor, "two");
      for (const command of commands) act(() => void editor.chain()[command]().run());
      results[name] = editor.getHTML();
      unmount();
    }

    expect(results).toMatchInlineSnapshot(`
      {
        "forward": "<p>one <strong><em><s><u><sup>two</sup></u></s></em></strong> three</p>",
        "reversed": "<p>one <strong><em><s><u><sup>two</sup></u></s></em></strong> three</p>",
        "strikeFirst": "<p>one <strong><em><s><u><sup>two</sup></u></s></em></strong> three</p>",
        "underlineFirst": "<p>one <strong><em><s><u><sup>two</sup></u></s></em></strong> three</p>",
      }
    `);
  });

  test("link, marker and colour applied before or after the text marks", () => {
    const apply = (steps: readonly string[]) => {
      const { editor, unmount } = renderEditor({ defaultValue: "<p>one two three</p>" });
      select(editor, "two");
      for (const step of steps) {
        act(() => {
          switch (step) {
            case "bold":
              editor.chain().toggleBold().run();
              break;
            case "underline":
              editor.chain().toggleUnderline().run();
              break;
            case "strike":
              editor.chain().toggleStrike().run();
              break;
            case "link":
              editor.chain().setLink({ href: LINK }).run();
              break;
            case "highlight":
              editor.chain().setHighlight({ color: "yellow" }).run();
              break;
            case "color":
              editor.chain().setColor("danger").run();
              break;
            case "hex":
              editor.chain().setColor("#00ff00").run();
              break;
            case "code":
              editor.chain().toggleCode().run();
              break;
            case "sub":
              editor.chain().toggleSubscript().run();
              break;
            case "sup":
              editor.chain().toggleSuperscript().run();
              break;
          }
        });
      }
      const html = editor.getHTML();
      unmount();
      return html;
    };

    expect({
      "bold,underline,strike,link,highlight,color": apply([
        "bold",
        "underline",
        "strike",
        "link",
        "highlight",
        "color",
      ]),
      "color,highlight,link,strike,underline,bold": apply([
        "color",
        "highlight",
        "link",
        "strike",
        "underline",
        "bold",
      ]),
      "link,color,bold,highlight,strike": apply(["link", "color", "bold", "highlight", "strike"]),
      "hex,sup,strike": apply(["hex", "sup", "strike"]),
      "sup,sub": apply(["sup", "sub"]),
      "code,bold": apply(["code", "bold"]),
      "bold,code": apply(["bold", "code"]),
      "code,link": apply(["code", "link"]),
      "link,code,strike": apply(["link", "code", "strike"]),
    }).toMatchInlineSnapshot(`
      {
        "bold,code": "<p>one <code>two</code> three</p>",
        "bold,underline,strike,link,highlight,color": "<p>one <span data-color="danger"><mark data-color="yellow"><a href="https://example.com/page" rel="noopener noreferrer"><strong><s><u>two</u></s></strong></a></mark></span> three</p>",
        "code,bold": "<p>one <code>two</code> three</p>",
        "code,link": "<p>one <code>two</code> three</p>",
        "color,highlight,link,strike,underline,bold": "<p>one <span data-color="danger"><mark data-color="yellow"><a href="https://example.com/page" rel="noopener noreferrer"><strong><s><u>two</u></s></strong></a></mark></span> three</p>",
        "hex,sup,strike": "<p>one <span style="color:#00ff00"><s><sup>two</sup></s></span> three</p>",
        "link,code,strike": "<p>one <code>two</code> three</p>",
        "link,color,bold,highlight,strike": "<p>one <span data-color="danger"><mark data-color="yellow"><a href="https://example.com/page" rel="noopener noreferrer"><strong><s>two</s></strong></a></mark></span> three</p>",
        "sup,sub": "<p>one <sup><sub>two</sub></sup> three</p>",
      }
    `);
  });

  test("code next to other marks and links, parsed in either nesting", () => {
    const { editor } = renderEditor({
      defaultValue:
        "<p><strong><code>bc</code></strong> <code><strong>cb</strong></code> " +
        `<a href="${LINK}"><code>lc</code></a> <code><a href="${LINK}">cl</a></code> ` +
        "<em><code>ec</code></em> <s><code>sc</code></s> <u><code>uc</code></u></p>",
    });

    expect(blocks(editor.getHTML())).toMatchInlineSnapshot(`
      [
        "<p><code>bc</code> <code>cb</code> <code>lc</code> <code>cl</code> <code>ec</code> <code>sc</code> <code>uc</code></p>",
      ]
    `);
  });

  test("a partial overlap of marks splits the text into runs in a stable order", () => {
    const { editor } = renderEditor({ defaultValue: "<p>abcdefgh</p>" });
    act(() => {
      editor.chain().setTextSelection({ from: 1, to: 6 }).toggleBold().run();
      editor.chain().setTextSelection({ from: 3, to: 8 }).toggleItalic().run();
      editor.chain().setTextSelection({ from: 2, to: 7 }).toggleUnderline().run();
      editor.chain().setTextSelection({ from: 4, to: 9 }).toggleStrike().run();
    });

    expect(editor.getHTML()).toMatchInlineSnapshot(
      `"<p><strong>a<u>b</u><em><u>c</u><s><u>de</u></s></em></strong><em><s><u>f</u>g</s></em><s>h</s></p>"`
    );
  });

  test("onChange hands out the same HTML the engine serializes", async () => {
    const onChange = vi.fn();
    const { editor } = renderEditor({ defaultValue: "<p>one two</p>", onChange });
    select(editor, "two");
    act(() => void editor.chain().toggleStrike().toggleUnderline().toggleBold().run());

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(onChange.mock.lastCall?.[0]).toBe(editor.getHTML());
    expect(onChange.mock.lastCall?.[0]).toMatchInlineSnapshot(
      `"<p>one <strong><s><u>two</u></s></strong></p>"`
    );
  });
});

// --- 2. Shortcut reference ---------------------------------------------------

/** Rows of the reference by group (`tbody`): the command label and its shortcut. */
async function shortcutRows(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Keyboard shortcuts" }));
  const dialog = await screen.findByRole("dialog", { name: "Keyboard shortcuts" });
  return Array.from(dialog.querySelectorAll("tbody"), (group) =>
    Array.from(group.querySelectorAll("tr"), (row) => {
      const label = row.querySelector("th")?.textContent ?? "";
      const keys = row.querySelector("kbd")?.textContent ?? "";
      return `${label} | ${keys}`;
    })
  );
}

describe("shortcut reference", () => {
  test("full: groups and rows in order", async () => {
    const user = userEvent.setup();
    renderEditor();

    expect(await shortcutRows(user)).toMatchInlineSnapshot(`
      [
        [
          "Select block text | Ctrl+A",
          "Select all (second press) | Ctrl+A",
          "Select block | Esc",
          "Extend selection | Shift+↑/↓",
        ],
        [
          "Undo | Ctrl+Z",
          "Redo | Ctrl+Shift+Z",
        ],
        [
          "Duplicate block | Ctrl+Shift+D",
          "Move block up | Alt+Shift+↑",
          "Move block down | Alt+Shift+↓",
          "Block actions | Ctrl+/",
        ],
        [
          "Clear formatting | Ctrl+\\",
        ],
        [
          "Bold | Ctrl+B",
          "Italic | Ctrl+I",
          "Strikethrough | Ctrl+Shift+S",
          "Underline | Ctrl+U",
          "Inline code | Ctrl+E",
          "Superscript | Ctrl+.",
          "Subscript | Ctrl+,",
        ],
        [
          "Text | Ctrl+Alt+0",
          "Heading 1 | Ctrl+Alt+1",
          "Heading 2 | Ctrl+Alt+2",
          "Heading 3 | Ctrl+Alt+3",
          "Heading 4 | Ctrl+Alt+4",
          "Quote | Ctrl+Shift+B",
          "Code block | Ctrl+Alt+C",
        ],
        [
          "Bulleted list | Ctrl+Shift+8",
          "Numbered list | Ctrl+Shift+7",
          "Checklist | Ctrl+Shift+9",
          "Indent list item | Ctrl+]",
          "Outdent list item | Ctrl+[",
        ],
        [
          "Align left | Ctrl+Shift+L",
          "Align center | Ctrl+Shift+E",
          "Align right | Ctrl+Shift+R",
        ],
        [
          "Link | Ctrl+K",
        ],
        [
          "Find | Ctrl+F",
          "Find and replace | Ctrl+Alt+F",
        ],
        [
          "Go to the toolbar | Alt+F10",
        ],
      ]
    `);
  });

  test("basic: groups and rows in order", async () => {
    const user = userEvent.setup();
    renderEditor({ preset: "basic" });

    expect(await shortcutRows(user)).toMatchInlineSnapshot(`
      [
        [
          "Select block text | Ctrl+A",
          "Select all (second press) | Ctrl+A",
        ],
        [
          "Undo | Ctrl+Z",
          "Redo | Ctrl+Shift+Z",
        ],
        [
          "Duplicate block | Ctrl+Shift+D",
          "Move block up | Alt+Shift+↑",
          "Move block down | Alt+Shift+↓",
          "Block actions | Ctrl+/",
        ],
        [
          "Bold | Ctrl+B",
          "Italic | Ctrl+I",
          "Strikethrough | Ctrl+Shift+S",
          "Inline code | Ctrl+E",
        ],
        [
          "Quote | Ctrl+Shift+B",
        ],
        [
          "Bulleted list | Ctrl+Shift+8",
          "Numbered list | Ctrl+Shift+7",
          "Indent list item | Ctrl+]",
          "Outdent list item | Ctrl+[",
        ],
        [
          "Link | Ctrl+K",
        ],
        [
          "Find | Ctrl+F",
          "Find and replace | Ctrl+Alt+F",
        ],
        [
          "Go to the toolbar | Alt+F10",
        ],
      ]
    `);
  });
});

// --- 3. Compositions and order of surfaces -----------------------------------------

/** Items of the open menu: role, name without the shortcut, checked mark, shortcut. */
function items(menu: HTMLElement) {
  return Array.from(menu.querySelectorAll<HTMLElement>('[role^="menuitem"]'), (item) => {
    const shortcut = item.querySelector("kbd")?.textContent ?? null;
    const name = (item.textContent ?? "").replace(shortcut ?? "", "");
    const checked = item.getAttribute("aria-checked") === "true" ? " [x]" : "";
    const disabled = item.getAttribute("aria-disabled") === "true" ? " (disabled)" : "";
    return `${item.getAttribute("role")}: ${name}${checked}${disabled}${shortcut ? ` | ${shortcut}` : ""}`;
  });
}

/** Buttons and separators of the Toolbar in order: `|` is a separator. */
function layoutOf(toolbar: HTMLElement) {
  return Array.from(toolbar.querySelectorAll('button, [role="separator"]'), (node) =>
    node.getAttribute("role") === "separator"
      ? "|"
      : (node.getAttribute("aria-label") ?? node.textContent)
  );
}

const PRESETS = ["full", "basic"] as const;

/**
 * Run the scenario through both presets and collect the results into one object:
 * a shared `toMatchInlineSnapshot` call inside `describe.each` would write to a
 * single place.
 */
async function eachPreset<T>(run: (preset: (typeof PRESETS)[number]) => Promise<T> | T) {
  const out = {} as Record<(typeof PRESETS)[number], T>;
  for (const preset of PRESETS) {
    out[preset] = await run(preset);
    cleanup();
  }
  return out;
}

const CONTENT = "<p>Hello world</p>";

/** Editor with the first word selected and the Bubble menu above it. */
async function openBubble(preset: (typeof PRESETS)[number]) {
  const { editor } = renderEditor({ preset, toolbar: "bubble", defaultValue: CONTENT });
  act(() => {
    editor.view.focus();
    editor.commands.setTextSelection({ from: 1, to: 6 });
  });
  return screen.findByRole("toolbar", { name: "Selection formatting" });
}

describe("surfaces", () => {
  test("the fixed toolbar: buttons and separators in order", async () => {
    const result = await eachPreset((preset) => {
      renderEditor({ preset, defaultValue: CONTENT });
      return layoutOf(screen.getByRole("toolbar", { name: "Formatting" }));
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "basic": [
          "Bold",
          "Italic",
          "More formatting",
          "|",
          "Lists",
          "|",
          "Link",
          "|",
          "Undo",
          "Redo",
          "Find",
          "Keyboard shortcuts",
        ],
        "full": [
          "Insert block",
          "HTML",
          "Block type: Text",
          "Alignment: left",
          "|",
          "Bold",
          "Italic",
          "Highlight: None",
          "More formatting",
          "|",
          "Lists",
          "|",
          "Link",
          "Image",
          "Table",
          "Emoji",
          "|",
          "Undo",
          "Redo",
          "Find",
          "Keyboard shortcuts",
        ],
      }
    `);
  });

  test("the selection bubble: buttons in order", async () => {
    const result = await eachPreset(async (preset) => layoutOf(await openBubble(preset)));

    expect(result).toMatchInlineSnapshot(`
      {
        "basic": [
          "Lists",
          "|",
          "Bold",
          "Italic",
          "More formatting",
          "|",
          "Link",
        ],
        "full": [
          "Block type: Text",
          "Lists",
          "|",
          "Bold",
          "Italic",
          "Underline",
          "Color: Default",
          "More formatting",
          "|",
          "Link",
          "Emoji",
        ],
      }
    `);
  });

  test("the «…» menu on the fixed toolbar", async () => {
    const user = userEvent.setup();
    const result = await eachPreset(async (preset) => {
      renderEditor({ preset, defaultValue: CONTENT });
      await user.click(screen.getByRole("button", { name: "More formatting" }));
      return items(screen.getByRole("menu", { name: "More formatting" }));
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "basic": [
          "menuitemcheckbox: Inline code | Ctrl+E",
          "menuitemcheckbox: Strikethrough | Ctrl+Shift+S",
          "menuitemcheckbox: Quote | Ctrl+Shift+B",
        ],
        "full": [
          "menuitemcheckbox: Inline code | Ctrl+E",
          "menuitemcheckbox: Underline | Ctrl+U",
          "menuitemcheckbox: Strikethrough | Ctrl+Shift+S",
          "menuitemcheckbox: Superscript | Ctrl+.",
          "menuitemcheckbox: Subscript | Ctrl+,",
          "menuitem: Language",
          "menuitemcheckbox: Code block | Ctrl+Alt+C",
          "menuitemcheckbox: Quote | Ctrl+Shift+B",
          "menuitem: Footnote",
          "menuitem: Clear formatting | Ctrl+\\",
          "menuitemcheckbox: Invisible characters",
          "menuitemcheckbox: Focus mode",
          "menuitemcheckbox: Fullscreen",
        ],
      }
    `);
  });

  test("the «…» menu in the selection bubble", async () => {
    const user = userEvent.setup();
    const result = await eachPreset(async (preset) => {
      const bubble = await openBubble(preset);
      await user.click(within(bubble).getByRole("button", { name: "More formatting" }));
      return items(screen.getByRole("menu", { name: "More formatting" }));
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "basic": [
          "menuitemcheckbox: Inline code | Ctrl+E",
          "menuitemcheckbox: Strikethrough | Ctrl+Shift+S",
          "menuitemcheckbox: Quote | Ctrl+Shift+B",
        ],
        "full": [
          "menuitemcheckbox: Inline code | Ctrl+E",
          "menuitemcheckbox: Strikethrough | Ctrl+Shift+S",
          "menuitemcheckbox: Superscript | Ctrl+.",
          "menuitemcheckbox: Subscript | Ctrl+,",
          "menuitem: Language",
          "menuitemcheckbox: Code block | Ctrl+Alt+C",
          "menuitemcheckbox: Quote | Ctrl+Shift+B",
          "menuitem: Footnote",
          "menuitem: Clear formatting | Ctrl+\\",
          "menuitemcheckbox: Focus mode",
          "menuitemcheckbox: Fullscreen",
        ],
      }
    `);
  });

  test("the lists menu", async () => {
    const user = userEvent.setup();
    const result = await eachPreset(async (preset) => {
      renderEditor({ preset, defaultValue: CONTENT });
      await user.click(screen.getByRole("button", { name: /^(Lists|List:)/ }));
      return items(screen.getByRole("menu", { name: /^Lists/ }));
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "basic": [
          "menuitemradio: Bulleted list | Ctrl+Shift+8",
          "menuitemradio: Numbered list | Ctrl+Shift+7",
        ],
        "full": [
          "menuitemradio: Bulleted list | Ctrl+Shift+8",
          "menuitemradio: Numbered list | Ctrl+Shift+7",
          "menuitemradio: Checklist | Ctrl+Shift+9",
        ],
      }
    `);
  });

  test("the «¶» block type widget; basic has none (one block type)", async () => {
    const user = userEvent.setup();
    const result = await eachPreset(async (preset) => {
      renderEditor({ preset, defaultValue: CONTENT });
      const button = screen.queryByRole("button", { name: /^Block type/ });
      if (!button) return null;
      await user.click(button);
      return items(screen.getByRole("menu", { name: /^Block type/ }));
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "basic": null,
        "full": [
          "menuitemradio: Text [x] | Ctrl+Alt+0",
          "menuitemradio: Heading 1 | Ctrl+Alt+1",
          "menuitemradio: Heading 2 | Ctrl+Alt+2",
          "menuitemradio: Heading 3 | Ctrl+Alt+3",
          "menuitemradio: Heading 4 | Ctrl+Alt+4",
        ],
      }
    `);
  });

  test("the alignment menu; basic has none", async () => {
    const user = userEvent.setup();
    const result = await eachPreset(async (preset) => {
      renderEditor({ preset, defaultValue: CONTENT });
      const button = screen.queryByRole("button", { name: /^Alignment/ });
      if (!button) return null;
      await user.click(button);
      return items(screen.getByRole("menu", { name: /^Alignment/ }));
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "basic": null,
        "full": [
          "menuitemradio: Align left [x] | Ctrl+Shift+L",
          "menuitemradio: Align center | Ctrl+Shift+E",
          "menuitemradio: Align right | Ctrl+Shift+R",
        ],
      }
    `);
  });
});

/** Slash menu on `/`: sections and their rows in display order. */
function slashSections() {
  const listbox = screen.getByRole("listbox", { name: "Insert block" });
  return Array.from(listbox.querySelectorAll('[role="group"]'), (group) => ({
    // The section name comes from `aria-labelledby`: the id itself is random.
    section:
      group.getAttribute("aria-label") ??
      document.getElementById(group.getAttribute("aria-labelledby") ?? "")?.textContent,
    options: Array.from(group.querySelectorAll('[role="option"]'), (option) =>
      option.textContent?.trim()
    ),
  }));
}

describe("the Insert menu", () => {
  test("full: sections and rows opened by «/»", () => {
    const { editor } = renderEditor();
    act(() => screen.getByRole("textbox", { name: "Body" }).focus());
    act(() => void editor.commands.insertContent("/"));

    expect(slashSections()).toMatchInlineSnapshot(`
      [
        {
          "options": [
            "Code block\`\`\`",
            "Divider---",
            "Table",
            "Image",
            "Layout",
            "Wrapper",
            "Collapsible block",
            "Footnote",
            "Date",
          ],
          "section": "Insert",
        },
        {
          "options": [
            "ParagraphCtrl+Alt+0",
            "Heading 1#",
            "Heading 2##",
            "Heading 3###",
            "Heading 4####",
            "Bulleted list-",
            "Numbered list1.",
            "Checklist[ ]",
            "Quote>",
            "Code blockCtrl+Alt+C",
          ],
          "section": "Turn into",
        },
      ]
    `);
  });

  test("basic: «/» is just text, there is no Insert menu", () => {
    const { editor } = renderEditor({ preset: "basic" });
    act(() => screen.getByRole("textbox", { name: "Body" }).focus());
    act(() => void editor.commands.insertContent("/"));

    expect(screen.queryByRole("listbox")).toBeNull();
    expect(screen.queryByRole("button", { name: "Insert block" })).toBeNull();
  });

  test("full: the «+» button of the toolbar lists the same rows", async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.click(screen.getByRole("button", { name: "Insert block" }));
    expect(items(screen.getByRole("menu", { name: "Insert block" }))).toMatchInlineSnapshot(`
      [
        "menuitem: Code block | \`\`\`",
        "menuitem: Divider | ---",
        "menuitem: Table",
        "menuitem: Image",
        "menuitem: Layout",
        "menuitem: Wrapper",
        "menuitem: Collapsible block",
        "menuitem: Footnote",
        "menuitem: Date",
        "menuitem: Paragraph | Ctrl+Alt+0",
        "menuitem: Heading 1 | #",
        "menuitem: Heading 2 | ##",
        "menuitem: Heading 3 | ###",
        "menuitem: Heading 4 | ####",
        "menuitem: Bulleted list | -",
        "menuitem: Numbered list | 1.",
        "menuitem: Checklist | [ ]",
        "menuitem: Quote | >",
        "menuitem: Code block | Ctrl+Alt+C",
      ]
    `);
  });
});

describe("the block handle menu", () => {
  test("a paragraph: top level, Add and Format", async () => {
    const user = userEvent.setup();
    const result = await eachPreset(async (preset) => {
      const { editor } = renderEditor({ preset, defaultValue: "<p>One</p><p>Two</p>" });
      caretIn(editor, "One");

      const handle = screen.queryByRole("button", { name: "Block actions" });
      if (!handle) return null;
      await user.click(handle);
      const menu = await screen.findByRole("menu", { name: "Block actions" });
      const top = items(menu);

      const submenu = async (name: string) => {
        const item = within(menu).queryByRole("menuitem", { name });
        if (!item) return null;
        await user.click(item);
        return items(await screen.findByRole("menu", { name }));
      };
      const add = await submenu("Add");
      await user.keyboard("{ArrowLeft}");
      const format = await submenu("Format");
      return { top, add, format };
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "basic": {
          "add": null,
          "format": [
            "menuitemradio: Text [x] | Ctrl+Alt+0",
            "menuitemradio: Quote | Ctrl+Shift+B",
            "menuitemradio: Bulleted list | Ctrl+Shift+8",
            "menuitemradio: Numbered list | Ctrl+Shift+7",
          ],
          "top": [
            "menuitem: Format",
            "menuitem: Move up (disabled) | Alt+Shift+↑",
            "menuitem: Move down | Alt+Shift+↓",
            "menuitem: Duplicate | Ctrl+Shift+D",
            "menuitem: Delete",
          ],
        },
        "full": {
          "add": [
            "menuitem: Paragraph",
            "menuitem: Heading 1",
            "menuitem: Heading 2",
            "menuitem: Heading 3",
            "menuitem: Heading 4",
            "menuitem: Bulleted list",
            "menuitem: Numbered list",
            "menuitem: Checklist",
            "menuitem: Quote",
            "menuitem: Code block",
            "menuitem: Divider",
            "menuitem: Table",
            "menuitem: Image",
            "menuitem: Layout",
            "menuitem: Wrapper",
            "menuitem: Collapsible block",
          ],
          "format": [
            "menuitemradio: Text [x] | Ctrl+Alt+0",
            "menuitemradio: Heading 1 | Ctrl+Alt+1",
            "menuitemradio: Heading 2 | Ctrl+Alt+2",
            "menuitemradio: Heading 3 | Ctrl+Alt+3",
            "menuitemradio: Heading 4 | Ctrl+Alt+4",
            "menuitemradio: Quote | Ctrl+Shift+B",
            "menuitemradio: Bulleted list | Ctrl+Shift+8",
            "menuitemradio: Numbered list | Ctrl+Shift+7",
            "menuitemradio: Checklist | Ctrl+Shift+9",
          ],
          "top": [
            "menuitem: Select",
            "menuitem: Add",
            "menuitem: Format",
            "menuitem: Move up (disabled) | Alt+Shift+↑",
            "menuitem: Move down | Alt+Shift+↓",
            "menuitem: Duplicate | Ctrl+Shift+D",
            "menuitem: Delete",
          ],
        },
      }
    `);
  });
});

// --- 4. Key priority ---------------------------------------------------------

/** Where the caret is: the Block that holds it, its text, and the Block's parent. */
function where(editor: Editor) {
  const { $from } = editor.state.selection;
  return `${$from.parent.type.name}("${$from.parent.textContent}") in ${$from.node(-2)?.type.name ?? "-"}/${$from.node(-1).type.name}`;
}

const COLUMN = (...blockList: string[]) => `<div data-block="column">${blockList.join("")}</div>`;
const LAYOUT = (...columns: string[]) =>
  `<div data-block="layout" data-layout="50-50">${columns.join("")}</div>`;
const WRAPPER = (...blockList: string[]) => `<div data-block="wrapper">${blockList.join("")}</div>`;

describe("key precedence", () => {
  test("Tab and Shift+Tab in a table cell inside a layout column", () => {
    const { editor } = renderEditor({
      defaultValue: LAYOUT(COLUMN("<p>left</p>"), COLUMN("<p>before</p>", TABLE, "<p>after</p>")),
    });
    const log: string[] = [];
    const step = (label: string, key: string, init: KeyboardEventInit = {}) => {
      const released = press(editor, key, init);
      log.push(`${label}: released=${released} caret=${where(editor)}`);
    };

    caretIn(editor, "H1", "start");
    step("Tab H1 -> H2", "Tab");
    step("Tab H2 -> c1", "Tab");
    step("Shift+Tab c1 -> H2", "Tab", { shiftKey: true });
    step("Shift+Tab H2 -> H1", "Tab", { shiftKey: true });
    step("Shift+Tab in the first cell", "Tab", { shiftKey: true });
    caretIn(editor, "c2");
    step("Tab in the last cell", "Tab");
    log.push(`html: ${editor.getHTML()}`);

    expect(log).toMatchInlineSnapshot(`
      [
        "Tab H1 -> H2: released=false caret=paragraph("H2") in tableRow/tableHeader",
        "Tab H2 -> c1: released=false caret=paragraph("c1") in tableRow/tableCell",
        "Shift+Tab c1 -> H2: released=false caret=paragraph("H2") in tableRow/tableHeader",
        "Shift+Tab H2 -> H1: released=false caret=paragraph("H1") in tableRow/tableHeader",
        "Shift+Tab in the first cell: released=true caret=paragraph("H1") in tableRow/tableHeader",
        "Tab in the last cell: released=false caret=paragraph("") in tableRow/tableCell",
        "html: <div data-block="layout" data-layout="50-50"><div data-block="column"><p>left</p></div><div data-block="column"><p>before</p><table><tbody><tr><th><p>H1</p></th><th><p>H2</p></th></tr><tr><td><p>c1</p></td><td><p>c2</p></td></tr><tr><td><p></p></td><td><p></p></td></tr></tbody></table><p>after</p></div></div>",
      ]
    `);
  });

  test("Tab and Shift+Tab in a table cell without a layout", () => {
    const { editor } = renderEditor({ defaultValue: `<p>before</p>${TABLE}<p>after</p>` });
    const log: string[] = [];
    const step = (label: string, key: string, init: KeyboardEventInit = {}) => {
      const released = press(editor, key, init);
      log.push(`${label}: released=${released} caret=${where(editor)}`);
    };

    caretIn(editor, "H1", "start");
    step("Shift+Tab in the first cell", "Tab", { shiftKey: true });
    step("Tab H1 -> H2", "Tab");
    caretIn(editor, "c2");
    step("Tab in the last cell", "Tab");
    log.push(`html: ${editor.getHTML()}`);

    expect(log).toMatchInlineSnapshot(`
      [
        "Shift+Tab in the first cell: released=true caret=paragraph("H1") in tableRow/tableHeader",
        "Tab H1 -> H2: released=false caret=paragraph("H2") in tableRow/tableHeader",
        "Tab in the last cell: released=false caret=paragraph("") in tableRow/tableCell",
        "html: <p>before</p><table><tbody><tr><th><p>H1</p></th><th><p>H2</p></th></tr><tr><td><p>c1</p></td><td><p>c2</p></td></tr><tr><td><p></p></td><td><p></p></td></tr></tbody></table><p>after</p>",
      ]
    `);
  });

  test("Enter at the end of a code block inside a wrapper", () => {
    const { editor } = renderEditor({
      defaultValue: WRAPPER(
        "<p>intro</p>",
        '<pre><code class="language-ts">const a = 1;</code></pre>'
      ),
    });
    const log: string[] = [];
    caretIn(editor, "const a = 1;");
    for (const label of ["Enter 1", "Enter 2", "Enter 3"]) {
      const released = press(editor, "Enter");
      log.push(`${label}: released=${released} caret=${where(editor)} html=${editor.getHTML()}`);
    }

    expect(log).toMatchInlineSnapshot(`
      [
        "Enter 1: released=false caret=codeBlock("const a = 1;
      ") in doc/wrapper html=<div data-block="wrapper"><p>intro</p><pre><code class="language-typescript">const a = 1;
      </code></pre></div>",
        "Enter 2: released=false caret=codeBlock("const a = 1;

      ") in doc/wrapper html=<div data-block="wrapper"><p>intro</p><pre><code class="language-typescript">const a = 1;

      </code></pre></div>",
        "Enter 3: released=false caret=paragraph("") in doc/wrapper html=<div data-block="wrapper"><p>intro</p><pre><code class="language-typescript">const a = 1;</code></pre><p></p></div>",
      ]
    `);
  });

  test("Enter in an empty list item, bulleted, numbered, checklist and nested", () => {
    const cases: Record<string, string> = {
      bullet: "<ul><li><p>a</p></li><li><p></p></li></ul>",
      ordered: "<ol><li><p>a</p></li><li><p></p></li></ol>",
      task:
        '<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>a</p></div></li>' +
        '<li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p></p></div></li></ul>',
      onlyItem: "<ul><li><p></p></li></ul>",
      nested: "<ul><li><p>a</p><ul><li><p>b</p></li><li><p></p></li></ul></li></ul>",
      inWrapper: WRAPPER("<ul><li><p>a</p></li><li><p></p></li></ul>"),
    };
    const results: Record<string, string> = {};
    for (const [name, html] of Object.entries(cases)) {
      const { editor, unmount } = renderEditor({ defaultValue: html });
      act(() => {
        editor.view.focus();
        editor.commands.setTextSelection(editor.state.doc.content.size - 1);
      });
      // The caret goes into the last (empty) item: find the deepest empty paragraph.
      let target = -1;
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === "paragraph" && node.content.size === 0) target = pos + 1;
      });
      act(() => void editor.commands.setTextSelection(target));
      const released = press(editor, "Enter");
      results[name] = `released=${released} caret=${where(editor)} html=${editor.getHTML()}`;
      unmount();
    }

    expect(results).toMatchInlineSnapshot(`
      {
        "bullet": "released=false caret=paragraph("") in -/doc html=<ul><li><p>a</p></li></ul><p></p>",
        "inWrapper": "released=false caret=paragraph("") in doc/wrapper html=<div data-block="wrapper"><ul><li><p>a</p></li></ul><p></p></div>",
        "nested": "released=false caret=paragraph("") in bulletList/listItem html=<ul><li><p>a</p><ul><li><p>b</p></li></ul></li><li><p></p></li></ul>",
        "onlyItem": "released=false caret=paragraph("") in -/doc html=<p></p>",
        "ordered": "released=false caret=paragraph("") in -/doc html=<ol><li><p>a</p></li></ol><p></p>",
        "task": "released=false caret=paragraph("") in -/doc html=<ul data-type="taskList"><li data-checked="false" data-type="taskItem"><label><input type="checkbox"><span></span></label><div><p>a</p></div></li></ul><p></p>",
      }
    `);
  });

  test("Backspace at the start of a list item", () => {
    const cases: Record<string, [string, string]> = {
      second: ["<ul><li><p>a</p></li><li><p>b</p></li></ul>", "b"],
      first: ["<p>x</p><ul><li><p>a</p></li><li><p>b</p></li></ul>", "a"],
      ordered: ["<ol><li><p>a</p></li><li><p>b</p></li></ol>", "b"],
      task: [
        '<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>a</p></div></li>' +
          '<li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked><span></span></label><div><p>b</p></div></li></ul>',
        "b",
      ],
      nested: ["<ul><li><p>a</p><ul><li><p>b</p></li></ul></li></ul>", "b"],
      onlyItem: ["<ul><li><p>a</p></li></ul>", "a"],
      inWrapper: [WRAPPER("<ul><li><p>a</p></li><li><p>b</p></li></ul>"), "b"],
    };
    const results: Record<string, string> = {};
    for (const [name, [html, text]] of Object.entries(cases)) {
      const { editor, unmount } = renderEditor({ defaultValue: html });
      caretIn(editor, text, "start");
      const released = press(editor, "Backspace");
      results[name] = `released=${released} caret=${where(editor)} html=${editor.getHTML()}`;
      unmount();
    }

    expect(results).toMatchInlineSnapshot(`
      {
        "first": "released=false caret=paragraph("a") in -/doc html=<p>x</p><p>a</p><ul><li><p>b</p></li></ul>",
        "inWrapper": "released=false caret=paragraph("b") in doc/wrapper html=<div data-block="wrapper"><ul><li><p>a</p></li></ul><p>b</p></div>",
        "nested": "released=false caret=paragraph("b") in bulletList/listItem html=<ul><li><p>a</p></li><li><p>b</p></li></ul>",
        "onlyItem": "released=false caret=paragraph("a") in -/doc html=<p>a</p>",
        "ordered": "released=false caret=paragraph("b") in -/doc html=<ol><li><p>a</p></li></ol><p>b</p>",
        "second": "released=false caret=paragraph("b") in -/doc html=<ul><li><p>a</p></li></ul><p>b</p>",
        "task": "released=false caret=paragraph("b") in -/doc html=<ul data-type="taskList"><li data-checked="false" data-type="taskItem"><label><input type="checkbox"><span></span></label><div><p>a</p></div></li></ul><p>b</p>",
      }
    `);
  });
});

// --- 5. Trimmed Schema --------------------------------------------------------

const KITCHEN_SINK =
  "<p><strong>b</strong> <em>i</em> <u>u</u> <s>s</s> <code>c</code> x<sup>2</sup> H<sub>2</sub>O " +
  `<a href="${LINK}">link</a> <mark data-color="yellow">hl</mark> ` +
  '<span style="color:#ff0000">red</span> <span data-color="danger">pal</span> ' +
  "<strong><em><u><s>nested</s></u></em></strong></p>" +
  "<h1>H1</h1><h2>H2</h2><h3>H3</h3><h4>H4</h4>" +
  "<ul><li><p>bullet</p></li></ul>" +
  "<ol><li><p>ordered</p></li></ol>" +
  '<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked><span></span></label><div><p>task</p></div></li></ul>' +
  "<blockquote><p>quote</p></blockquote>" +
  '<pre><code class="language-ts">code block</code></pre>' +
  TABLE +
  LAYOUT(COLUMN("<p>left</p>"), COLUMN("<p>right</p>")) +
  WRAPPER("<h2>in wrapper</h2><p>text</p>") +
  FIGURE +
  '<p data-align="center">centered</p><hr><p>end</p>';

describe("what survives a reduced Schema", () => {
  const sets: Record<string, Partial<RichTextEditorProps>> = {
    "tools: []": { tools: [] },
    'tools: ["bold"]': { tools: ["bold"] },
    'tools: ["bulletList"]': { tools: ["bulletList"] },
    'tools: ["heading"]': { tools: ["heading"] },
    'tools: ["heading", "heading1"]': { tools: ["heading", "heading1"] },
    'tools: ["taskList"]': { tools: ["taskList"] },
    'tools: ["table"]': { tools: ["table"] },
    'tools: ["layout"]': { tools: ["layout"] },
    'tools: ["wrapper"]': { tools: ["wrapper"] },
    'tools: ["code", "link", "highlight"]': { tools: ["code", "link", "highlight"] },
    'tools: ["underline", "strike", "superscript", "subscript"]': {
      tools: ["underline", "strike", "superscript", "subscript"],
    },
    'tools: ["color"]': { tools: ["color"] },
    'tools: ["align"]': { tools: ["align"] },
    'tools: ["blockquote"]': { tools: ["blockquote"] },
    'tools: ["codeBlock"]': { tools: ["codeBlock"] },
    'tools: ["horizontalRule"]': { tools: ["horizontalRule"] },
    'tools: ["image"]': { tools: ["image"] },
    "preset: basic": { preset: "basic" },
  };

  test("every set, one snapshot", () => {
    const result: Record<string, string[]> = {};
    for (const [name, props] of Object.entries(sets)) {
      const { editor, unmount } = renderEditor({ ...props, defaultValue: KITCHEN_SINK });
      result[name] = blocks(editor.getHTML());
      unmount();
    }

    expect(result).toMatchInlineSnapshot(`
      {
        "preset: basic": [
          "<p><strong>b</strong> <em>i</em> u <s>s</s> <code>c</code> x2 H2O <a href="https://example.com/page" rel="noopener noreferrer">link</a> hl red pal <strong><em><s>nested</s></em></strong></p>",
          "<p>H1</p>",
          "<p>H2</p>",
          "<p>H3</p>",
          "<p>H4</p>",
          "<ul><li><p>bullet</p></li></ul>",
          "<ol><li><p>ordered</p></li></ol>",
          "<ul><li><p>task</p></li></ul>",
          "<blockquote><p>quote</p></blockquote>",
          "<p><code>code block</code></p>",
          "<p>H1</p>",
          "<p>H2</p>",
          "<p>c1</p>",
          "<p>c2</p>",
          "<p>left</p>",
          "<p>right</p>",
          "<p>in wrapper</p>",
          "<p>text</p>",
          "<p>centered</p>",
          "<p>end</p>",
        ],
        "tools: ["align"]": [
          "<p>b i u s c x2 H2O link hl red pal nested</p>",
          "<p>H1</p>",
          "<p>H2</p>",
          "<p>H3</p>",
          "<p>H4</p>",
          "<p>bullet</p>",
          "<p>ordered</p>",
          "<p>task</p>",
          "<p>quote</p>",
          "<p>code block</p>",
          "<p>H1</p>",
          "<p>H2</p>",
          "<p>c1</p>",
          "<p>c2</p>",
          "<p>left</p>",
          "<p>right</p>",
          "<p>in wrapper</p>",
          "<p>text</p>",
          "<p data-align="center">centered</p>",
          "<p>end</p>",
        ],
        "tools: ["blockquote"]": [
          "<p>b i u s c x2 H2O link hl red pal nested</p>",
          "<p>H1</p>",
          "<p>H2</p>",
          "<p>H3</p>",
          "<p>H4</p>",
          "<p>bullet</p>",
          "<p>ordered</p>",
          "<p>task</p>",
          "<blockquote><p>quote</p></blockquote>",
          "<p>code block</p>",
          "<p>H1</p>",
          "<p>H2</p>",
          "<p>c1</p>",
          "<p>c2</p>",
          "<p>left</p>",
          "<p>right</p>",
          "<p>in wrapper</p>",
          "<p>text</p>",
          "<p>centered</p>",
          "<p>end</p>",
        ],
        "tools: ["bold"]": [
          "<p><strong>b</strong> i u s c x2 H2O link hl red pal <strong>nested</strong></p>",
          "<p>H1</p>",
          "<p>H2</p>",
          "<p>H3</p>",
          "<p>H4</p>",
          "<p>bullet</p>",
          "<p>ordered</p>",
          "<p>task</p>",
          "<p>quote</p>",
          "<p>code block</p>",
          "<p>H1</p>",
          "<p>H2</p>",
          "<p>c1</p>",
          "<p>c2</p>",
          "<p>left</p>",
          "<p>right</p>",
          "<p>in wrapper</p>",
          "<p>text</p>",
          "<p>centered</p>",
          "<p>end</p>",
        ],
        "tools: ["bulletList"]": [
          "<p>b i u s c x2 H2O link hl red pal nested</p>",
          "<p>H1</p>",
          "<p>H2</p>",
          "<p>H3</p>",
          "<p>H4</p>",
          "<ul><li><p>bullet</p></li></ul>",
          "<ul><li><p>ordered</p></li></ul>",
          "<ul><li><p>task</p></li></ul>",
          "<p>quote</p>",
          "<p>code block</p>",
          "<p>H1</p>",
          "<p>H2</p>",
          "<p>c1</p>",
          "<p>c2</p>",
          "<p>left</p>",
          "<p>right</p>",
          "<p>in wrapper</p>",
          "<p>text</p>",
          "<p>centered</p>",
          "<p>end</p>",
        ],
        "tools: ["code", "link", "highlight"]": [
          "<p>b i u s <code>c</code> x2 H2O <a href="https://example.com/page" rel="noopener noreferrer">link</a> <mark data-color="yellow">hl</mark> red pal nested</p>",
          "<p>H1</p>",
          "<p>H2</p>",
          "<p>H3</p>",
          "<p>H4</p>",
          "<p>bullet</p>",
          "<p>ordered</p>",
          "<p>task</p>",
          "<p>quote</p>",
          "<p><code>code block</code></p>",
          "<p>H1</p>",
          "<p>H2</p>",
          "<p>c1</p>",
          "<p>c2</p>",
          "<p>left</p>",
          "<p>right</p>",
          "<p>in wrapper</p>",
          "<p>text</p>",
          "<p>centered</p>",
          "<p>end</p>",
        ],
        "tools: ["codeBlock"]": [
          "<p>b i u s c x2 H2O link hl red pal nested</p>",
          "<p>H1</p>",
          "<p>H2</p>",
          "<p>H3</p>",
          "<p>H4</p>",
          "<p>bullet</p>",
          "<p>ordered</p>",
          "<p>task</p>",
          "<p>quote</p>",
          "<pre><code class="language-typescript">code block</code></pre>",
          "<p>H1</p>",
          "<p>H2</p>",
          "<p>c1</p>",
          "<p>c2</p>",
          "<p>left</p>",
          "<p>right</p>",
          "<p>in wrapper</p>",
          "<p>text</p>",
          "<p>centered</p>",
          "<p>end</p>",
        ],
        "tools: ["color"]": [
          "<p>b i u s c x2 H2O link hl <span style="color:#ff0000">red</span> <span data-color="danger">pal</span> nested</p>",
          "<p>H1</p>",
          "<p>H2</p>",
          "<p>H3</p>",
          "<p>H4</p>",
          "<p>bullet</p>",
          "<p>ordered</p>",
          "<p>task</p>",
          "<p>quote</p>",
          "<p>code block</p>",
          "<p>H1</p>",
          "<p>H2</p>",
          "<p>c1</p>",
          "<p>c2</p>",
          "<p>left</p>",
          "<p>right</p>",
          "<p>in wrapper</p>",
          "<p>text</p>",
          "<p>centered</p>",
          "<p>end</p>",
        ],
        "tools: ["heading", "heading1"]": [
          "<p>b i u s c x2 H2O link hl red pal nested</p>",
          "<h1>H1</h1>",
          "<h2>H2</h2>",
          "<h3>H3</h3>",
          "<h4>H4</h4>",
          "<p>bullet</p>",
          "<p>ordered</p>",
          "<p>task</p>",
          "<p>quote</p>",
          "<p>code block</p>",
          "<p>H1</p>",
          "<p>H2</p>",
          "<p>c1</p>",
          "<p>c2</p>",
          "<p>left</p>",
          "<p>right</p>",
          "<h2>in wrapper</h2>",
          "<p>text</p>",
          "<p>centered</p>",
          "<p>end</p>",
        ],
        "tools: ["heading"]": [
          "<p>b i u s c x2 H2O link hl red pal nested</p>",
          "<p>H1</p>",
          "<h2>H2</h2>",
          "<h3>H3</h3>",
          "<h4>H4</h4>",
          "<p>bullet</p>",
          "<p>ordered</p>",
          "<p>task</p>",
          "<p>quote</p>",
          "<p>code block</p>",
          "<p>H1</p>",
          "<p>H2</p>",
          "<p>c1</p>",
          "<p>c2</p>",
          "<p>left</p>",
          "<p>right</p>",
          "<h2>in wrapper</h2>",
          "<p>text</p>",
          "<p>centered</p>",
          "<p>end</p>",
        ],
        "tools: ["horizontalRule"]": [
          "<p>b i u s c x2 H2O link hl red pal nested</p>",
          "<p>H1</p>",
          "<p>H2</p>",
          "<p>H3</p>",
          "<p>H4</p>",
          "<p>bullet</p>",
          "<p>ordered</p>",
          "<p>task</p>",
          "<p>quote</p>",
          "<p>code block</p>",
          "<p>H1</p>",
          "<p>H2</p>",
          "<p>c1</p>",
          "<p>c2</p>",
          "<p>left</p>",
          "<p>right</p>",
          "<p>in wrapper</p>",
          "<p>text</p>",
          "<p>centered</p>",
          "<hr>",
          "<p>end</p>",
        ],
        "tools: ["image"]": [
          "<p>b i u s c x2 H2O link hl red pal nested</p>",
          "<p>H1</p>",
          "<p>H2</p>",
          "<p>H3</p>",
          "<p>H4</p>",
          "<p>bullet</p>",
          "<p>ordered</p>",
          "<p>task</p>",
          "<p>quote</p>",
          "<p>code block</p>",
          "<p>H1</p>",
          "<p>H2</p>",
          "<p>c1</p>",
          "<p>c2</p>",
          "<p>left</p>",
          "<p>right</p>",
          "<p>in wrapper</p>",
          "<p>text</p>",
          "<figure><img src="https://cdn.example.com/photo.png" alt="A lake"></figure>",
          "<p>centered</p>",
          "<p>end</p>",
        ],
        "tools: ["layout"]": [
          "<p>b i u s c x2 H2O link hl red pal nested</p>",
          "<p>H1</p>",
          "<p>H2</p>",
          "<p>H3</p>",
          "<p>H4</p>",
          "<p>bullet</p>",
          "<p>ordered</p>",
          "<p>task</p>",
          "<p>quote</p>",
          "<p>code block</p>",
          "<p>H1</p>",
          "<p>H2</p>",
          "<p>c1</p>",
          "<p>c2</p>",
          "<div data-block="layout" data-layout="50-50"><div data-block="column"><p>left</p></div><div data-block="column"><p>right</p></div></div>",
          "<p>in wrapper</p>",
          "<p>text</p>",
          "<p>centered</p>",
          "<p>end</p>",
        ],
        "tools: ["table"]": [
          "<p>b i u s c x2 H2O link hl red pal nested</p>",
          "<p>H1</p>",
          "<p>H2</p>",
          "<p>H3</p>",
          "<p>H4</p>",
          "<p>bullet</p>",
          "<p>ordered</p>",
          "<p>task</p>",
          "<p>quote</p>",
          "<p>code block</p>",
          "<table><tbody><tr><th><p>H1</p></th><th><p>H2</p></th></tr><tr><td><p>c1</p></td><td><p>c2</p></td></tr></tbody></table>",
          "<p>left</p>",
          "<p>right</p>",
          "<p>in wrapper</p>",
          "<p>text</p>",
          "<p>centered</p>",
          "<p>end</p>",
        ],
        "tools: ["taskList"]": [
          "<p>b i u s c x2 H2O link hl red pal nested</p>",
          "<p>H1</p>",
          "<p>H2</p>",
          "<p>H3</p>",
          "<p>H4</p>",
          "<p>bullet</p>",
          "<p>ordered</p>",
          "<ul data-type="taskList"><li data-checked="true" data-type="taskItem"><label><input type="checkbox" checked="checked"><span></span></label><div><p>task</p></div></li></ul>",
          "<p>quote</p>",
          "<p>code block</p>",
          "<p>H1</p>",
          "<p>H2</p>",
          "<p>c1</p>",
          "<p>c2</p>",
          "<p>left</p>",
          "<p>right</p>",
          "<p>in wrapper</p>",
          "<p>text</p>",
          "<p>centered</p>",
          "<p>end</p>",
        ],
        "tools: ["underline", "strike", "superscript", "subscript"]": [
          "<p>b i <u>u</u> <s>s</s> c x<sup>2</sup> H<sub>2</sub>O link hl red pal <s><u>nested</u></s></p>",
          "<p>H1</p>",
          "<p>H2</p>",
          "<p>H3</p>",
          "<p>H4</p>",
          "<p>bullet</p>",
          "<p>ordered</p>",
          "<p>task</p>",
          "<p>quote</p>",
          "<p>code block</p>",
          "<p>H1</p>",
          "<p>H2</p>",
          "<p>c1</p>",
          "<p>c2</p>",
          "<p>left</p>",
          "<p>right</p>",
          "<p>in wrapper</p>",
          "<p>text</p>",
          "<p>centered</p>",
          "<p>end</p>",
        ],
        "tools: ["wrapper"]": [
          "<p>b i u s c x2 H2O link hl red pal nested</p>",
          "<p>H1</p>",
          "<p>H2</p>",
          "<p>H3</p>",
          "<p>H4</p>",
          "<p>bullet</p>",
          "<p>ordered</p>",
          "<p>task</p>",
          "<p>quote</p>",
          "<p>code block</p>",
          "<p>H1</p>",
          "<p>H2</p>",
          "<p>c1</p>",
          "<p>c2</p>",
          "<p>left</p>",
          "<p>right</p>",
          "<div data-block="wrapper"><p>in wrapper</p><p>text</p></div>",
          "<p>centered</p>",
          "<p>end</p>",
        ],
        "tools: []": [
          "<p>b i u s c x2 H2O link hl red pal nested</p>",
          "<p>H1</p>",
          "<p>H2</p>",
          "<p>H3</p>",
          "<p>H4</p>",
          "<p>bullet</p>",
          "<p>ordered</p>",
          "<p>task</p>",
          "<p>quote</p>",
          "<p>code block</p>",
          "<p>H1</p>",
          "<p>H2</p>",
          "<p>c1</p>",
          "<p>c2</p>",
          "<p>left</p>",
          "<p>right</p>",
          "<p>in wrapper</p>",
          "<p>text</p>",
          "<p>centered</p>",
          "<p>end</p>",
        ],
      }
    `);
  });
});
