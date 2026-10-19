import { Mark, Node, type Editor } from "@tiptap/core";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useRef, useState, type RefObject } from "react";
import { Button } from "../components/actions/Button.js";
import { Dialog } from "../components/overlays/Dialog.js";
import { Drawer } from "../components/overlays/Drawer.js";
import { FormField } from "../components/inputs/FormField.js";
import { UiProvider } from "../i18n/UiProvider.js";
import { MentionIcon, PinIcon, SparkleIcon, TagIcon, WrapperIcon } from "../icons.js";
import ru from "../locales/ru.js";
import { EDITOR_MARKER_NAMES, EDITOR_TEXT_COLOR_NAMES } from "./styles/palette.js";
import {
  RichTextEditor,
  type RichTextEditorHandle,
  type RichTextEditorProps,
} from "./RichTextEditor.js";
import { markRange, type CustomTool } from "./core/customTool.js";
import { FLOATING_TOOLBAR_KEY } from "./ui/FloatingToolbar.js";
import { SELECTION_BUBBLE_KEY } from "./ui/SelectionBubble.js";
import { TableSizeGrid as SizeGrid } from "./features/table/TableSizeGrid.js";
import { defineTool } from "./core/toolDefinition.js";
import { loadPasteCleanup } from "./features/pasteCleanup/pasteCleanupTool.js";
import { tool } from "./core/toolOptions.js";
import { useRichTextToolState } from "./hooks/useRichTextToolState.js";
import { RICH_TEXT_PRESETS, TOOLS } from "./core/tools.js";

/*
  Neutral document: headings, lists, a checklist, a quote, a code Block,
  a divider and all Marks, so the typography can be seen in full, without
  domain data.
*/
const SAMPLE =
  "<h2>Release notes</h2>" +
  "<p>This document shows every block the editor supports. Text can be " +
  "<strong>bold</strong>, <em>italic</em>, <u>underlined</u>, <s>struck through</s> or " +
  "<code>inline code</code>; formulas need x<sup>2</sup> and H<sub>2</sub>O.</p>" +
  "<h3>What changed</h3>" +
  "<ul><li><p>First item of a bulleted list</p></li><li><p>Second item</p>" +
  "<ul><li><p>A nested item</p></li></ul></li></ul>" +
  "<ol><li><p>Step one</p></li><li><p>Step two</p></li></ol>" +
  '<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><p>A finished task</p></li>' +
  '<li data-type="taskItem" data-checked="false"><p>A task still open</p></li></ul>' +
  '<pre><code class="language-ts">const answer = 42;</code></pre>' +
  "<h4>A smaller heading</h4>" +
  "<blockquote><p>A quotation stands apart from the surrounding text.</p></blockquote>" +
  "<hr><p>Text after the divider.</p>";

/*
  Code Blocks: one for each Editor language, and plain text. The samples
  contain keywords, strings, numbers, comments and tags, so the highlight theme
  can be seen in full and axe measures the contrast of every token role in all
  three themes.
*/
const CODE_SAMPLES = [
  ["python", '# Greets a user\ndef greet(name: str) -> str:\n    return f"Hello, {name}!" * 2'],
  [
    "typescript",
    "// Sum of a list\nexport function sum(values: number[]): number {\n  return values.reduce((a, b) => a + b, 0);\n}",
  ],
  ["javascript", 'const user = { name: "Ada", age: 36 };\nconsole.log(`Hi, ${user.name}`, this);'],
  ["go", 'package main\n\nimport "fmt"\n\nfunc main() {\n\tfmt.Println(len("hi"), true)\n}'],
  [
    "html",
    '<!DOCTYPE html>\n<a href="/docs" class="link">Docs &amp; guides</a>\n<!-- a comment -->',
  ],
  [
    "json",
    '{\n  "id": 4821,\n  "status": "assembling",\n  "paid": true,\n  "tags": ["api", null]\n}',
  ],
  ["yaml", "# Service config\nname: billing\nreplicas: 3\nenabled: true\ntags:\n  - api"],
  [
    "markdown",
    "# Release notes\n\n- **Fixed** a crash on `save`\n- See [the docs](https://example.com)",
  ],
] as const;

const escapeCode = (code: string) =>
  code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const CODE_BLOCKS =
  "<h2>Code blocks</h2>" +
  CODE_SAMPLES.map(
    ([language, code]) => `<pre><code class="language-${language}">${escapeCode(code)}</code></pre>`
  ).join("") +
  "<pre><code>Plain text is never highlighted: if (a) { return b; }</code></pre>";

/*
  Palette names in the Document: text color names go on `span`, highlight
  names on `mark`. The name lists are kit data (`palette.ts`), so a new color
  gets into the story by itself, and into its snapshots in all themes (`dark`,
  `light`, `dim`) too.
*/
const COLOURS =
  "<h2>Colour, highlight and alignment</h2>" +
  EDITOR_TEXT_COLOR_NAMES.map(
    (name) => `<p><span data-color="${name}">Text in ${name}</span></p>`
  ).join("") +
  EDITOR_MARKER_NAMES.map(
    (name) => `<p><mark data-color="${name}">Highlight in ${name}</mark></p>`
  ).join("") +
  '<p data-align="center">A paragraph aligned to the centre.</p>' +
  '<p data-align="right">A paragraph aligned to the right.</p>' +
  '<h3 data-align="center">A heading aligned to the centre</h3>' +
  "<p>Text on the default alignment, to the left.</p>";

/*
  Author color: the only `style` in the Document, and only in its strict form.
  It sits next to the palette so the difference is visible: the palette follows
  the theme (`dark`, `light`, `dim`), the author color stays the same in all
  three, and in one of the themes the "color on background" pair may lose
  contrast. This is intended and documented; the story is captured in all
  themes so that this shows.
  Text on any highlight is dark (`--marker-text`): both on a bright palette
  highlight and on an author-color highlight; the author's text color under a
  highlight is overridden by it.
*/
const CUSTOM_COLOURS =
  "<h2>Custom colour</h2>" +
  '<p><span data-color="danger">Palette red follows the theme</span> · ' +
  '<mark style="background-color:#fee4e2"><span style="color:#b42318">' +
  "custom red stays #b42318</span></mark></p>" +
  '<p><mark data-color="yellow">Palette highlight is bright in every theme</mark> · ' +
  '<mark style="background-color:#ffe066"><span style="color:#3d2c00">' +
  "custom highlight stays #ffe066</span></mark></p>" +
  '<p><mark style="background-color:#b8e6c1">A custom highlight carries the dark marker text</mark> ' +
  "and looks the same in every theme.</p>" +
  "<p>An author colour on its own does not follow the theme and can lose contrast " +
  "when the theme changes; the picker warns against the current theme only. " +
  "This sample pairs every custom text colour with its own highlight, so it reads in all themes.</p>" +
  "<p>Select a word and choose Color › «Custom color…» for the text or the highlight.</p>";

/*
  Table: a header row, text and Marks in the cells. Six columns, so that on a
  narrow screen it does not fit and scrolls (`TableNarrow`).
*/
const TABLE_SAMPLE =
  "<h2>Roadmap</h2><p>Quarterly plan by area.</p>" +
  "<table><tbody>" +
  "<tr><th><p>Area</p></th><th><p>Owner</p></th><th><p>Status</p></th><th><p>Start</p></th>" +
  "<th><p>Finish</p></th><th><p>Notes</p></th></tr>" +
  "<tr><td><p>Search</p></td><td><p>Alex</p></td><td><p><strong>Done</strong></p></td><td><p>Jan 9</p></td>" +
  "<td><p>Feb 20</p></td><td><p>Shipped to <em>all</em> accounts</p></td></tr>" +
  "<tr><td><p>Billing</p></td><td><p>Sam</p></td><td><p>In progress</p></td><td><p>Feb 1</p></td>" +
  "<td><p>Apr 3</p></td><td><p>Waiting on the <code>invoice</code> format</p></td></tr>" +
  "<tr><td><p>Reports</p></td><td><p>Kim</p></td><td><p>Planned</p></td><td><p>Apr 6</p></td>" +
  "<td><p>Jun 12</p></td><td><p>Needs a design review</p></td></tr>" +
  "</tbody></table><p>Text after the table.</p>";

/*
  Merged cells: a "Q1" header over two columns (`colspan`) and an area stretched
  over two rows (`rowspan`), the way a table arrives from Word or Google Docs.
  The caret is in an ordinary cell, and "Cell › Merge cells" is available after
  selecting several cells with the mouse or with Shift and the arrows.
*/
const MERGED_SAMPLE =
  "<h2>Budget</h2>" +
  "<table><tbody>" +
  '<tr><th rowspan="2"><p>Area</p></th><th colspan="2" data-align="center"><p>Q1</p></th>' +
  '<th colspan="2" data-align="center"><p>Q2</p></th></tr>' +
  '<tr><th data-align="right"><p>Plan</p></th><th data-align="right"><p>Fact</p></th>' +
  '<th data-align="right"><p>Plan</p></th><th data-align="right"><p>Fact</p></th></tr>' +
  '<tr><td><p>Search</p></td><td data-align="right"><p>1,200</p></td><td data-align="right"><p>1,150</p></td>' +
  '<td data-align="right"><p>1,300</p></td><td data-align="right"><p>1,410</p></td></tr>' +
  '<tr><td rowspan="2"><p>Billing</p></td><td data-align="right"><p>800</p></td><td data-align="right"><p>760</p></td>' +
  '<td colspan="2" data-align="center"><p>moved to Q3</p></td></tr>' +
  '<tr><td data-align="right"><p>90</p></td><td data-align="right"><p>95</p></td>' +
  '<td data-align="right"><p>100</p></td><td data-align="right"><p>98</p></td></tr>' +
  "</tbody></table><p>Merged cells stay merged in HTML; Markdown keeps the text and loses the merge.</p>";

/*
  Sorting and alignment: numbers with digit grouping, ISO dates and
  `DD.MM.YYYY`, text. The Amount column is right-aligned and Status is centered
  (`data-align` on every cell of the column). The header row stays first when
  sorting.
*/
const SORT_SAMPLE =
  "<h2>Invoices</h2>" +
  "<table><tbody>" +
  '<tr><th><p>Client</p></th><th data-align="right"><p>Amount</p></th><th><p>Due</p></th>' +
  '<th data-align="center"><p>Status</p></th></tr>' +
  '<tr><td><p>Northwind</p></td><td data-align="right"><p>12,400.50</p></td><td><p>2026-11-02</p></td>' +
  '<td data-align="center"><p>sent</p></td></tr>' +
  '<tr><td><p>Contoso</p></td><td data-align="right"><p>980</p></td><td><p>15.10.2026</p></td>' +
  '<td data-align="center"><p>paid</p></td></tr>' +
  '<tr><td><p>Fabrikam</p></td><td data-align="right"><p>-150</p></td><td><p>2026-10-20</p></td>' +
  '<td data-align="center"><p>credit</p></td></tr>' +
  '<tr><td><p>Adventure Works</p></td><td data-align="right"><p>3,000</p></td><td><p>01.12.2026</p></td>' +
  '<td data-align="center"><p>draft</p></td></tr>' +
  "</tbody></table><p>Put the caret in a column and choose Table › Sort.</p>";

/*
  Column widths (OLDSUI-310, ADR-0080): a table with the widths the author set. The shares are in
  `<colgroup><col data-width>`, in 5% steps, and add up to 100: the table fills the Document, a narrow
  "Owner" and "Status" leave room for the notes. `SIZED_WIDE_SAMPLE` is the six-column roadmap of the
  table stories with shares of its own, for the narrow screen, where 6 rem per column wins over them.
*/
const colgroup = (...shares: number[]) =>
  `<colgroup>${shares.map((share) => `<col data-width="${share}">`).join("")}</colgroup>`;

const SIZED_TABLE_SAMPLE =
  "<h2>Roadmap</h2><p>Quarterly plan by area.</p>" +
  `<table>${colgroup(25, 20, 20, 35)}<tbody>` +
  "<tr><th><p>Area</p></th><th><p>Owner</p></th><th><p>Status</p></th><th><p>Notes</p></th></tr>" +
  "<tr><td><p>Search</p></td><td><p>Alex</p></td><td><p><strong>Done</strong></p></td>" +
  "<td><p>Shipped to <em>all</em> accounts</p></td></tr>" +
  "<tr><td><p>Billing</p></td><td><p>Sam</p></td><td><p>In progress</p></td>" +
  "<td><p>Waiting on the <code>invoice</code> format</p></td></tr>" +
  "<tr><td><p>Reports</p></td><td><p>Kim</p></td><td><p>Planned</p></td>" +
  "<td><p>Needs a design review</p></td></tr>" +
  "</tbody></table><p>Text after the table.</p>";

const SIZED_WIDE_SAMPLE = TABLE_SAMPLE.replace(
  "<table><tbody>",
  `<table>${colgroup(20, 10, 10, 10, 10, 40)}<tbody>`
);

/*
  A range as Excel puts it on the clipboard: the Office namespace that tells the source, and a
  `<col>` per column with the width in points (the exact value) and in pixels (rounded). The widths
  are 132, 84, 72, 84 and 60 points: after the paste they are 30%, 20%, 15%, 20% and 15%.
*/
const EXCEL_RANGE =
  '<html xmlns:x="urn:schemas-microsoft-com:office:excel"><body><table>' +
  "<col width=176 style='mso-width-source:userset;width:132pt'>" +
  "<col width=112 style='mso-width-source:userset;width:84pt'>" +
  "<col width=96 style='mso-width-source:userset;width:72pt'>" +
  "<col width=112 style='mso-width-source:userset;width:84pt'>" +
  "<col width=80 style='mso-width-source:userset;width:60pt'>" +
  "<tr><td>Fruit</td><td>Origin</td><td>Price</td><td>Updated</td><td>Share</td></tr>" +
  "<tr><td>Apple</td><td>Spain</td><td>1.20</td><td>01.10.2026</td><td>25%</td></tr>" +
  "<tr><td>Pear</td><td>Italy</td><td>1.80</td><td>03.10.2026</td><td>10%</td></tr>" +
  "</table></body></html>";

/** Part of the remount key for a `tools` entry: the name, and for `tool()` the options too. */
const toolKey = (entry: NonNullable<RichTextEditorProps["tools"]>[number]) =>
  typeof entry === "string"
    ? entry
    : "configured" in entry
      ? `${entry.name}${JSON.stringify(entry.options)}`
      : entry.name;

const meta = {
  title: "Inputs/RichTextEditor",
  component: RichTextEditor,
  parameters: { layout: "padded" },
  args: { "aria-label": "Document", defaultValue: SAMPLE },
  render: (args) => (
    <div className="max-w-[640px]">
      {/* The Tool set is read when the engine is created: changing the preset in
          the controls panel remounts the field with a new key. */}
      <RichTextEditor key={`${args.preset}-${args.tools?.map(toolKey).join()}`} {...args} />
    </div>
  ),
} satisfies Meta<typeof RichTextEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * All Blocks, all Marks and the fixed Toolbar in the `full` preset. The Toolbar
 * is one Tab stop; the buttons are reached with the arrows, Home and End, and
 * the hint names the key combination. The layout follows the kit's order: "+",
 * HTML, "¶", alignment ▾ | Marks and "…" (which also holds the code Block) |
 * lists ▾ | link, image, table ▾, emoji | undo and redo, with the keyboard
 * shortcuts popover at the right edge.
 */
export const Playground: Story = {};

/** The `basic` preset, for comments and short descriptions. */
export const BasicPreset: Story = {
  args: {
    preset: "basic",
    defaultValue:
      "<p>A short comment with <strong>bold</strong> and a list:</p><ul><li><p>one</p></li></ul>",
  },
};

/**
 * An exact list of Tools: `tools` overrides the preset. The kit sets the order
 * of the buttons, not the list. There are no headings in the set: the `<h2>`
 * from the value came in as a paragraph.
 */
export const CustomTools: Story = {
  args: { tools: ["bold", "italic", "taskList", "history"] },
};

/** Without a Toolbar: formatting stays with the keyboard and the Markdown shortcuts. */
export const WithoutToolbar: Story = {
  args: { toolbar: "none" },
};

/**
 * Floating Toolbar: select a word and the Toolbar appears above it. `Alt+F10`
 * from the Document moves focus into it, `Shift+Tab` returns it. On a touch
 * screen (`pointer: coarse`) a fixed Toolbar is shown instead.
 */
export const FloatingToolbar: Story = {
  args: {
    toolbar: "floating",
    defaultValue:
      "<p>Select a few words in this paragraph: the formatting toolbar appears right above " +
      "the selection and hides again when the selection collapses.</p>" +
      "<p>From the keyboard: select with Shift and the arrows, then press Alt+F10.</p>",
  },
  render: (args) => (
    // Extra space on top: the Toolbar sits above the first line.
    <div className="max-w-[640px] pt-16">
      <RichTextEditor {...args} />
    </div>
  ),
};

/*
  The Bubble menu shown at once: focus goes to the Document, the selection is
  on a word, and the command is the show command that `Alt+F10` sends to the
  pill. Without the command the pill would wait for the show delay, and the
  snapshot could miss it.

  One `show` is not enough: the `BubbleMenu` plugin computes the position first
  and only then shows, and a hidden pill does not compute its position. The pill
  is placed without `top`/`left`, under the field, and moves to the selection
  only after the show delay, about 250 ms. A snapshot taken before it settled
  caught it under the field. The second command computes the position for the
  already visible pill.
*/
function useShownBubble(
  ref: RefObject<RichTextEditorHandle | null>,
  word: string,
  key: string = SELECTION_BUBBLE_KEY
) {
  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const editor = ref.current?.editor;
      if (!editor) {
        frame = requestAnimationFrame(tick);
        return;
      }
      let from = -1;
      editor.state.doc.descendants((node, pos) => {
        const at = node.isText ? (node.text ?? "").indexOf(word) : -1;
        if (from < 0 && at >= 0) from = pos + at;
      });
      if (from < 0) return;
      editor.view.focus();
      editor.commands.setTextSelection({ from, to: from + word.length });
      editor.view.dispatch(editor.state.tr.setMeta(key, "show"));
      editor.view.dispatch(editor.state.tr.setMeta(key, "updatePosition"));
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [ref, word, key]);
}

const BUBBLE_SAMPLE =
  "<h2>Meeting notes</h2>" +
  "<p>Select a few words: a compact <strong>dark</strong> menu appears above them in the " +
  "light theme and a light one in the dark themes.</p>" +
  "<p>From the keyboard: select with Shift and the arrows, then press Alt+F10.</p>";

function ShownBubble({ surface }: { surface?: "paper" }) {
  const ref = useRef<RichTextEditorHandle>(null);
  useShownBubble(ref, "compact");
  return (
    // Extra space on top: the pill sits above the line, not below it.
    <div className="max-w-[640px] pt-16">
      <RichTextEditor
        ref={ref}
        aria-label="Document"
        toolbar="bubble"
        surface={surface}
        defaultValue={BUBBLE_SAMPLE}
      />
    </div>
  );
}

/**
 * Bubble menu (`toolbar="bubble"`): a compact pill on an inverse surface, dark
 * in the light theme and light in the dark ones. Its contents are set by the
 * kit: "¶", "Lists", bold, italic, underline, "Color", "…", link, emoji; buttons
 * of disabled Tools are absent. Showing and position work as for the floating
 * Toolbar. Menus, popovers and hints opened from the pill sit on the regular
 * surface. The pill is shown as soon as the story is shown.
 */
export const SelectionBubble: Story = {
  render: () => <ShownBubble />,
};

/** The `surface="paper"` sheet: a light Document, the pill in the app theme. */
export const SelectionBubblePaper: Story = {
  render: () => <ShownBubble surface="paper" />,
};

/**
 * Bubble menu in a drawer. The pill sits in the Editor's DOM, so it moves with
 * the text when the drawer scrolls; Escape in a menu opened from it closes only
 * that menu.
 */
export const SelectionBubbleInDrawer: Story = {
  render: function Render() {
    const [open, setOpen] = useState(true);
    return (
      <div className="h-[520px]">
        <Button onClick={() => setOpen(true)}>Open the drawer</Button>
        <Drawer open={open} onClose={() => setOpen(false)} title="Edit the note">
          <RichTextEditor aria-label="Document" toolbar="bubble" defaultValue={BUBBLE_SAMPLE} />
        </Drawer>
      </div>
    );
  },
};

/**
 * Bubble menu in a scroll container. Near the container's top edge the pill
 * flips below the selection; near the side edges it shifts inward.
 */
export const SelectionBubbleInScroll: Story = {
  render: () => (
    <div
      data-testid="scroll-container"
      className="border-line h-[260px] max-w-[480px] overflow-auto rounded-md border p-2"
    >
      <RichTextEditor
        aria-label="Document"
        toolbar="bubble"
        defaultValue={
          BUBBLE_SAMPLE +
          Array.from(
            { length: 12 },
            (_, index) => `<p>Paragraph ${index + 1} keeps the container scrolling.</p>`
          ).join("")
        }
      />
    </div>
  ),
};

/*
  Glass shows only over a contrasting background: over plain text a translucent
  backing is indistinguishable from a solid one. So above the selected line
  there is a row of colored Marks (the Toolbar), and below it several more (the
  "¶" and "…" lists open downward).
*/
const MARKS_ROW =
  '<p><mark data-color="yellow">Pipeline</mark> <mark data-color="orange">forecast</mark> ' +
  '<mark data-color="green">hiring plan</mark> <mark data-color="purple">roadmap</mark> ' +
  '<mark data-color="pink">pricing</mark> <mark data-color="red">risks</mark> ' +
  '<mark data-color="blue">security audit</mark> <mark data-color="brown">budget</mark></p>';

const GLASS_SAMPLE =
  '<h2>Quarterly <mark data-color="yellow">review</mark> notes</h2>' +
  MARKS_ROW +
  "<p>The toolbar floats above this line, and the coloured marks show through it.</p>" +
  "<p><strong>Open ¶ or …</strong>: the menus drop over the rows below and blur them " +
  "the same way.</p>" +
  MARKS_ROW +
  MARKS_ROW +
  MARKS_ROW;

function ShownGlass({ toolbar }: { toolbar: "floating" | "bubble" }) {
  const ref = useRef<RichTextEditorHandle>(null);
  useShownBubble(
    ref,
    "toolbar floats",
    toolbar === "floating" ? FLOATING_TOOLBAR_KEY : SELECTION_BUBBLE_KEY
  );
  return (
    <div className="max-w-[640px] pt-16">
      <RichTextEditor
        ref={ref}
        aria-label="Document"
        toolbar={toolbar}
        defaultValue={GLASS_SAMPLE}
      />
    </div>
  );
}

/**
 * Glass on floating surfaces: the floating Toolbar, the Bubble menu, the
 * Editor's menu lists and popovers get a translucent backing of their own
 * surface (82 %) with the background blurred by 14px, as toasts do. With
 * `prefers-reduced-transparency` and `prefers-contrast: more` the backing is
 * solid. The Toolbar is shown as soon as the story is shown; "¶" and "…" open
 * over the colored rows below.
 */
export const GlassFloatingToolbar: Story = {
  render: () => <ShownGlass toolbar="floating" />,
};

/** Bubble menu on glass: an inverse surface, the same 82 % and 14px. */
export const GlassSelectionBubble: Story = {
  render: () => <ShownGlass toolbar="bubble" />,
};

/**
 * Links: the "Link" button or `Ctrl/⌘+K` opens an address field at the
 * selection. Enter applies, Escape cancels; an existing link has "Remove link".
 * Addresses are `http`, `https` or `mailto` only; an address typed into the
 * text becomes a link by itself.
 */
export const LinkEditing: Story = {
  args: {
    preset: "basic",
    defaultValue:
      '<p>Read the <a href="https://example.com/guide">setup guide</a> or write to ' +
      '<a href="mailto:team@example.com">the team</a>. Put the caret inside a link and press ' +
      "Ctrl+K to change or remove it; select plain text and press Ctrl+K to link it.</p>" +
      "<p>Type an address such as example.com followed by a space.</p>",
  },
};

/**
 * A long Document under the app's sticky header. The header publishes its
 * height in `--topbar-h` (set by hand here, and by the kit's `TopBar` itself),
 * and the Toolbar sticks right below it while the field is on screen.
 */
export const StickyUnderHeader: Story = {
  parameters: { layout: "fullscreen" },
  render: (args) => (
    <div className="h-[520px] overflow-auto [--topbar-h:56px]">
      <header className="bg-bg-1 border-line text-md sticky top-0 z-10 flex h-14 items-center border-b px-6 font-semibold">
        Application header
      </header>
      <div className="mx-auto flex max-w-[640px] flex-col gap-4 px-6 py-6">
        <p className="text-fg-2">Scroll down: the toolbar stays under the header.</p>
        <RichTextEditor {...args} defaultValue={SAMPLE + SAMPLE + SAMPLE} />
        <p className="text-fg-2">The toolbar leaves together with the field.</p>
        <div className="h-[400px]" />
      </div>
    </div>
  ),
};

/**
 * Editor in a dialog. Escape in the "¶" menu or in the link popover closes the
 * menu or popover, not the dialog: their layers are in the kit's shared overlay
 * stack (ADR-0041).
 */
export const InsideDialog: Story = {
  render: function Render(args) {
    const [open, setOpen] = useState(true);
    return (
      <div className="h-[520px]">
        <Button onClick={() => setOpen(true)}>Open the window</Button>
        <Dialog open={open} onClose={() => setOpen(false)} title="Edit the note">
          <div className="w-[560px] max-w-full">
            <RichTextEditor
              {...args}
              defaultValue="<p>Press Escape inside the block type menu, the link popover or after typing a slash.</p><p></p>"
            />
          </div>
        </Dialog>
      </div>
    );
  },
};

/**
 * Editor in a drawer: the options of the "…" menu and of the color popovers
 * are selected with the mouse and the keyboard. Escape closes one level at a
 * time: first the popover or menu, and only then the drawer (ADR-0041).
 */
export const InsideDrawer: Story = {
  render: function Render(args) {
    const [open, setOpen] = useState(true);
    return (
      <div className="h-[520px]">
        <Button onClick={() => setOpen(true)}>Open the panel</Button>
        <Drawer open={open} onClose={() => setOpen(false)} title="Edit the note" size="lg">
          <RichTextEditor
            {...args}
            defaultValue="<p>Select a word and open More formatting to mark it.</p><p></p>"
          />
        </Drawer>
      </div>
    );
  },
};

/**
 * Text color, highlight and alignment. Select a word and select a color in the
 * "Color" popover (the "Text color" and "Highlight color" grids), or use the
 * "Highlight" button; alignment is the "Alignment ▾" menu. The Document keeps
 * the palette names (`data-color`, `data-align`) and no `style`; the theme
 * supplies the actual color, so the story is captured in all three.
 */
export const ColourAndAlignment: Story = {
  args: { defaultValue: COLOURS },
};

/**
 * Custom color: "Custom color…" in the grids of the "Color" popover opens a
 * `ColorPicker` inside the popover, with a warning about contrast against the
 * CURRENT theme's background. The Document keeps `style="color:#rrggbb"` on
 * `span` and `style="background-color:#rrggbb"` on `mark`; an author color does
 * not follow the theme, unlike the palette.
 *
 * Every custom text color in the sample sits on its own highlight: the pair does
 * not depend on the theme and keeps contrast in all three, so the axe audit of
 * the stories passes, while switching the theme still shows that the custom
 * color stays in place. A bare author color on a theme background cannot keep
 * contrast in every theme, which is exactly what the popover warns about.
 */
export const CustomColour: Story = {
  args: { defaultValue: CUSTOM_COLOURS },
};

/*
  A Document with four heading levels: the same sample in the Editor and in the
  View, so the H1 typography is compared on one text.
*/
const HEADING_LEVELS =
  "<h1>Quarterly report</h1>" +
  "<p>The main heading of a document that lives without a page of its own.</p>" +
  "<h2>Summary</h2><p>Text under the second level.</p>" +
  "<h3>Details</h3><p>Text under the third level.</p>" +
  "<h4>Notes</h4><p>Text under the fourth level.</p>";

/**
 * First-level heading: with the `heading1` Tool (it is in `full`), the Block
 * levels are 1–4. H1 is set with `Ctrl/⌘+Alt+1`, by typing `# `, or with the
 * "Heading 1" item of the "¶" menu. The theme is switched with the showcase
 * toolbar: the H1 typography is captured in `dark`, `light` and `dim`.
 */
export const Heading1: Story = {
  args: { defaultValue: HEADING_LEVELS },
};

/**
 * The same Document on a `surface="paper"` sheet: H1 is light in any app
 * theme, like the rest of the sheet's text.
 */
export const Heading1Paper: Story = {
  args: { surface: "paper", defaultValue: HEADING_LEVELS },
};

/**
 * A screen that already has an H1 above the Editor turns `heading1` off: the
 * "¶" menu has no "Heading 1" item, and the `<h1>` from the value comes in as a
 * paragraph.
 */
export const WithoutHeading1: Story = {
  args: { tools: TOOLS.filter((tool) => tool !== "heading1"), defaultValue: HEADING_LEVELS },
};

/*
  The caret in a Block and an open Toolbar menu, once the engine is created: the
  menu is opened by a click, not by a prop, and the story shows it open.
  `button` is the start of the button's name: "¶", "Alignment" or "List".
*/
function useOpenBlockMenu(
  ref: RefObject<RichTextEditorHandle | null>,
  text: string,
  button = "Block type"
) {
  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const editor = ref.current?.editor;
      if (!editor) {
        frame = requestAnimationFrame(tick);
        return;
      }
      let end = -1;
      editor.state.doc.descendants((node, pos) => {
        if (end < 0 && node.isText && node.text === text) end = pos + node.nodeSize;
      });
      if (end > 0) editor.commands.setTextSelection(end);
      // The story has one field, so there is one menu button on the page.
      const trigger = document.querySelector<HTMLElement>(`button[aria-label^="${button}"]`);
      frame = requestAnimationFrame(() => trigger?.click());
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [ref, text, button]);
}

const BLOCK_TYPES_SAMPLE =
  "<h2>Project plan</h2><p>Pick a block type from the pilcrow menu.</p>" +
  "<ul><li><p>A bulleted item keeps its text when it becomes a heading</p></li></ul>";

function OpenBlockMenu({ caret }: { caret: string }) {
  const ref = useRef<RichTextEditorHandle>(null);
  useOpenBlockMenu(ref, caret);
  return (
    <div className="h-[520px] max-w-[640px]">
      <RichTextEditor ref={ref} aria-label="Document" defaultValue={BLOCK_TYPES_SAMPLE} />
    </div>
  );
}

/**
 * The "¶" menu sets the line type: Text and Heading 1–4, each with its shortcut;
 * lists are under "List ▾", and the quote is a checkbox item in the "…" menu.
 * The caret is in a heading, so "Heading 2" is checked, and it is also the icon
 * (H2) and the button's name. Choosing an item changes the line type and keeps
 * the text; `Ctrl/⌘+Z` undoes it in one step.
 */
export const BlockTypeMenu: Story = {
  render: () => <OpenBlockMenu caret="Project plan" />,
};

/** The caret in a list item: the line decides, so "Text" is checked and the icon is "¶". */
export const BlockTypeMenuInList: Story = {
  render: () => <OpenBlockMenu caret="A bulleted item keeps its text when it becomes a heading" />,
};

/*
  The Block handle shown at once: focus goes to the Document and the caret to
  the `text`. The handle is visible only on the Block that holds the caret while
  the Editor has focus; it does not wait for hover. With `open` the menu is also
  opened by pressing the handle, as with a click: the handle appears one frame
  after the caret, so the story waits for it.
*/
function useShownHandle(
  ref: RefObject<RichTextEditorHandle | null>,
  text: string,
  open: boolean,
  submenu?: string
) {
  useEffect(() => {
    let frame = 0;
    // The submenu opens as it does from the keyboard: focus on the item and `→`.
    // Hovering with the mouse would open it after a delay, and the snapshot
    // would catch an intermediate frame.
    const openSubmenu = () => {
      const item = Array.from(
        document.querySelectorAll<HTMLElement>('[role="menuitem"][aria-haspopup]')
      ).find((candidate) => submenu && candidate.textContent?.startsWith(submenu));
      if (!item) {
        frame = requestAnimationFrame(openSubmenu);
        return;
      }
      item.focus();
      item.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    };
    const press = () => {
      const handle = document.querySelector<HTMLElement>('button[aria-label="Block actions"]');
      if (!handle) {
        frame = requestAnimationFrame(press);
        return;
      }
      handle.click();
      if (submenu) frame = requestAnimationFrame(openSubmenu);
    };
    const tick = () => {
      const editor = ref.current?.editor;
      if (!editor) {
        frame = requestAnimationFrame(tick);
        return;
      }
      let end = -1;
      editor.state.doc.descendants((node, pos) => {
        if (end < 0 && node.isText && node.text === text) end = pos + node.nodeSize;
      });
      editor.view.focus();
      if (end > 0) editor.commands.setTextSelection(end);
      if (open) frame = requestAnimationFrame(press);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [ref, text, open, submenu]);
}

const HANDLE_SAMPLE =
  "<h2>Weekly summary</h2>" +
  "<p>Put the caret into any block: the handle appears to the left of its first line.</p>" +
  "<ul><li><p>A list is one block: it moves, copies and changes as a whole</p></li>" +
  "<li><p>Second item of the list</p></li></ul>" +
  "<p>Text after the list.</p>";

function ShownHandle({
  caret,
  open = false,
  submenu,
  document = HANDLE_SAMPLE,
}: {
  caret: string;
  open?: boolean;
  /** Also opens a submenu: the item whose name starts with these words. */
  submenu?: string;
  document?: string;
}) {
  const ref = useRef<RichTextEditorHandle>(null);
  useShownHandle(ref, caret, open, submenu);
  return (
    <div className="h-[520px] max-w-[640px]">
      <RichTextEditor ref={ref} aria-label="Document" defaultValue={document} />
    </div>
  );
}

/**
 * Block handle "⋮": on the Block with the caret, to the left of its first line,
 * in the Document's left margin. The caret is in the second item of the list,
 * but the handle is at the list's first line: the Block is the whole list.
 * Hovering does not show the handle; from the keyboard, `Ctrl/⌘+/` opens the
 * menu.
 */
export const BlockHandle: Story = {
  render: () => <ShownHandle caret="Second item of the list" />,
};

/**
 * The handle menu: Add › (the Insert menu items, a new Block below), Format ›
 * (the "¶" items), Move up, Move down, Duplicate and Delete, in red. A top-level
 * paragraph shows its shortcuts: they do the same as the items.
 */
export const BlockHandleMenu: Story = {
  render: () => (
    <ShownHandle
      caret="Put the caret into any block: the handle appears to the left of its first line."
      open
    />
  ),
};

const ALIGN_LISTS_SAMPLE =
  "<h2>Meeting notes</h2>" +
  '<p data-align="center">A centred line under the heading.</p>' +
  "<ol><li><p>Agree on the agenda</p></li><li><p>Share the minutes</p></li></ol>";

function OpenToolbarMenu({ caret, button }: { caret: string; button: string }) {
  const ref = useRef<RichTextEditorHandle>(null);
  useOpenBlockMenu(ref, caret, button);
  return (
    <div className="h-[520px] max-w-[640px]">
      <RichTextEditor ref={ref} aria-label="Document" defaultValue={ALIGN_LISTS_SAMPLE} />
    </div>
  );
}

/**
 * The "Alignment ▾" menu: Align left, Align center and Align right, with their
 * shortcuts. The caret is in the centered line, so "Align center" is checked;
 * its icon is on the button, and the button's name is "Alignment: center".
 * There is no justify (WCAG 1.4.8). The compact Toolbar in one row is also
 * visible in the 640 px column.
 */
export const AlignmentMenu: Story = {
  render: () => <OpenToolbarMenu caret="A centred line under the heading." button="Alignment" />,
};

/**
 * The "List ▾" menu: the same three kinds of list as in "¶". The caret is in a
 * numbered list, so "Numbered list" is checked, its icon is on the button, and
 * the name is "List: numbered". Selecting the checked item again removes the list.
 */
export const ListsMenu: Story = {
  render: () => <OpenToolbarMenu caret="Share the minutes" button="List" />,
};

/*
  A selection and an open "…" menu or color popover, once the engine is created.
  `button` is the exact button name or its start. With `bubble` the button is
  searched for in the Bubble menu ("Color" lives only there): focus goes to the
  Document, and the button is awaited until the pill is placed above the selection.
*/
function useOpenToolbarPopover(
  ref: RefObject<RichTextEditorHandle | null>,
  text: string,
  button: string,
  bubble = false
) {
  useEffect(() => {
    let frame = 0;
    let tries = 0;
    const later = (step: () => void) => {
      frame = requestAnimationFrame(step);
    };
    const press = () => {
      const scope = bubble
        ? document.querySelector('[role="toolbar"][aria-label="Selection formatting"]')
        : document;
      // There is only one button with this name in its scope.
      const trigger = scope?.querySelector<HTMLElement>(`button[aria-label^="${button}"]`);
      if (!trigger) {
        if (tries++ < 120) later(press);
        return;
      }
      // Focus the button first, as a mouse click does: the pill hides when focus
      // leaves the Document for something outside it (the popover), but not when
      // it leaves the button.
      trigger.focus();
      trigger.click();
    };
    const tick = () => {
      const editor = ref.current?.editor;
      if (!editor) return later(tick);
      let from = -1;
      editor.state.doc.descendants((node, pos) => {
        if (from < 0 && node.isText && node.text === text) from = pos;
      });
      if (bubble) editor.view.focus();
      if (from >= 0) editor.commands.setTextSelection({ from, to: from + text.length });
      later(press);
    };
    later(tick);
    return () => cancelAnimationFrame(frame);
  }, [ref, text, button, bubble]);
}

const MORE_FORMATTING_SAMPLE =
  "<h2>Release notes</h2>" +
  "<p>Rare marks live in the <u>More formatting</u> menu: <code>inline code</code>, " +
  "x<sup>2</sup> and H<sub>2</sub>O.</p>" +
  '<p>Colours have their own buttons: <mark data-color="pink">a pink highlight</mark> and ' +
  '<span data-color="danger">red text</span>, picked from circles.</p>';

function OpenFormatPopover({
  selection,
  button = "More formatting",
  bubble = false,
}: {
  selection: string;
  button?: string;
  bubble?: boolean;
}) {
  const ref = useRef<RichTextEditorHandle>(null);
  useOpenToolbarPopover(ref, selection, button, bubble);
  return (
    <div className="h-[520px] max-w-[640px]">
      <RichTextEditor ref={ref} aria-label="Document" defaultValue={MORE_FORMATTING_SAMPLE} />
    </div>
  );
}

/**
 * The "…" menu, More formatting: Inline code, Underline, Superscript and
 * Subscript with their shortcuts, Code block, "Clear formatting" (`Ctrl/⌘+\`).
 * A selected underlined word has "Underline" checked. Next to Code block is a
 * "Quote" checkbox. There are no colors here: they have their own buttons.
 */
export const MoreFormattingMenu: Story = {
  render: () => <OpenFormatPopover selection="More formatting" />,
};

/**
 * The "Color" popover, in the Bubble menu: the "Text color" grid (default and
 * six tones) and the "Highlight color" grid (no highlight and nine colors); each
 * grid's header has "Custom color…". The selected red text has "Red" checked in
 * the text grid.
 */
export const ColorPopover: Story = {
  render: () => <OpenFormatPopover selection="red text" button="Color" bubble />,
  // The pill is placed above the selection after a delay, and the popover after
  // it: the tag tells the snapshot and axe to wait for quiet, otherwise they
  // catch the field without the pill.
  tags: ["network-idle"],
};

/**
 * The "Highlight" popover: nine highlights by hue, and "Remove highlight".
 * A selected pink highlight has "Pink" checked, and the button's name is
 * "Highlight: Pink".
 */
export const HighlightPopover: Story = {
  render: () => <OpenFormatPopover selection="a pink highlight" button="Highlight:" />,
};

/** An empty Document: the placeholder comes from the catalog. */
export const Empty: Story = {
  args: { defaultValue: undefined },
};

/**
 * Controlled mode: the HTML goes out at most once per `changeDelay` ms, and at
 * once on `blur`. The caret is not reset when the owner passes back the same HTML.
 */
export const Controlled: Story = {
  render: (args) => {
    const [html, setHtml] = useState("<p>Type here and watch the value below.</p>");
    return (
      <div className="flex max-w-[640px] flex-col gap-3">
        <RichTextEditor {...args} defaultValue={undefined} value={html} onChange={setHtml} />
        <code className="text-fg-2 text-caption break-all">{html}</code>
      </div>
    );
  },
};

const MARKDOWN_SAMPLE = [
  "## Meeting notes",
  "",
  "Agreed on the **next steps** and a *short* timeline.",
  "",
  "- Prepare the draft",
  "- Review it together",
  "",
  "1. Publish on Friday",
  "2. Collect feedback",
  "",
  "> Keep it simple.",
].join("\n");

/**
 * Markdown. Paste text with markup into the field (`## Heading`, `- item`,
 * `**bold**`) and it becomes Blocks and Marks; plain text stays as paragraphs.
 * The buttons call `ref.setMarkdown()` and `ref.getMarkdown()`; color, alignment
 * and underline are not part of the export.
 */
export const PasteMarkdown: Story = {
  args: { defaultValue: undefined },
  render: (args) => {
    const ref = useRef<RichTextEditorHandle>(null);
    const [markdown, setMarkdown] = useState("");
    return (
      <div className="flex max-w-[640px] flex-col gap-3">
        <RichTextEditor {...args} ref={ref} />
        <div className="flex gap-2">
          <Button onClick={() => ref.current?.setMarkdown(MARKDOWN_SAMPLE)}>Load Markdown</Button>
          <Button variant="outline" onClick={() => setMarkdown(ref.current?.getMarkdown() ?? "")}>
            Export Markdown
          </Button>
        </div>
        <pre className="text-fg-2 text-caption break-all whitespace-pre-wrap">{markdown}</pre>
      </div>
    );
  },
};

/**
 * JSON envelope. "Download JSON" saves the Document to a file through
 * `ref.getJSON()`, losslessly, unlike Markdown: color, alignment and underline
 * are kept. "Open JSON" reads the file and passes it to `ref.setJSON()`; a
 * foreign file is rejected, and the screen says so itself. The buttons and the
 * file picker are the screen's code, not the Editor's.
 */
export const JsonExportImport: Story = {
  render: (args) => {
    const ref = useRef<RichTextEditorHandle>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const [status, setStatus] = useState("");
    const download = () => {
      const document = ref.current?.getJSON();
      if (!document) return;
      const blob = new Blob([JSON.stringify(document, null, 2)], { type: "application/json" });
      const link = Object.assign(window.document.createElement("a"), {
        href: URL.createObjectURL(blob),
        download: "document.json",
      });
      link.click();
      // The browser takes the file after the click, not during it: the address lives until the next task.
      setTimeout(() => URL.revokeObjectURL(link.href));
      setStatus("Saved document.json");
    };
    const open = async (file: File | undefined) => {
      if (!file) return;
      let parsed: unknown = null;
      try {
        parsed = JSON.parse(await file.text());
      } catch {
        // Not JSON at all: `setJSON(null)` rejects it the same way as a foreign format.
      }
      const accepted = ref.current?.setJSON(parsed) ?? false;
      setStatus(accepted ? `Opened ${file.name}` : `${file.name} is not a rich text document`);
    };
    return (
      <div className="flex max-w-[640px] flex-col gap-3">
        <RichTextEditor {...args} ref={ref} />
        <div className="flex items-center gap-2">
          <Button onClick={download}>Download JSON</Button>
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            Open JSON
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(event) => {
              void open(event.currentTarget.files?.[0]);
              event.currentTarget.value = "";
            }}
          />
          <span role="status" className="text-fg-2 text-caption">
            {status}
          </span>
        </div>
      </div>
    );
  },
};

/** The remaining-count appears at 80 % of the limit; input stops at the limit. */
export const WithMaxLength: Story = {
  args: {
    defaultValue: "<p>A short note that is already close to its limit.</p>",
    maxLength: 60,
  },
};

/** The word count of a Document's HTML: tags are not counted, an empty Document is zero. */
function countWords(html: string): number {
  const text = html.replace(/<[^>]*>/g, " ").trim();
  return text ? text.split(/\s+/).length : 0;
}

/**
 * Field height (ADR-0059): `maxHeight` limits the Document's area, and a long
 * Document scrolls inside the frame; the Toolbar above it and the Status bar
 * below it stay in place. The Block handle and the selection pill move together
 * with the text.
 */
export const ScrollingDocument: Story = {
  render: (args) => (
    <div className="max-w-[640px]">
      <RichTextEditor
        {...args}
        defaultValue={SAMPLE + CODE_BLOCKS}
        maxHeight={320}
        status={<span>{countWords(SAMPLE + CODE_BLOCKS)} words</span>}
      />
    </div>
  ),
};

/**
 * `resizable`: the resize handle is a strip along the bottom edge of the
 * Document's area, with a grip in the middle. With it, `maxHeight` is the
 * starting height, not a limit: the field can be dragged both taller and
 * shorter, but not below a few lines.
 */
export const ResizableDocument: Story = {
  render: (args) => (
    <div className="max-w-[640px]">
      <RichTextEditor {...args} defaultValue={SAMPLE + CODE_BLOCKS} maxHeight={320} resizable />
    </div>
  ),
};

/**
 * Status bar (ADR-0058, section 7): "Saved" and the word count sit inside the
 * field's frame at the start of the counter line, and the `maxLength` counter
 * at the end. The kit does not announce it: the word count is not read out on
 * every edit, and "Saved" is wrapped in `role="status"`, the screen-side recipe
 * for announcing it. "Saving" runs on a timer after an edit, like autosave.
 */
export const StatusLine: Story = {
  render: (args) => {
    const [html, setHtml] = useState("<p>Type here: the line below counts words and saves.</p>");
    const [saved, setSaved] = useState(true);
    const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    useEffect(() => () => clearTimeout(timer.current), []);
    return (
      <div className="max-w-[640px]">
        <RichTextEditor
          {...args}
          defaultValue={undefined}
          value={html}
          maxLength={60}
          onChange={(next) => {
            setHtml(next);
            setSaved(false);
            clearTimeout(timer.current);
            timer.current = setTimeout(() => setSaved(true), 800);
          }}
          status={
            <span className="flex gap-3">
              <span role="status">{saved ? "Saved" : ""}</span>
              <span>{countWords(html)} words</span>
            </span>
          }
        />
      </div>
    );
  },
};

/** The status bar is visible with `readOnly` too: it is part of the field's frame, not of the edits. */
export const StatusLineReadOnly: Story = {
  args: {
    readOnly: true,
    defaultValue: "<p>Three words here.</p>",
    status: <span>3 words</span>,
  },
};

/**
 * Field notice: the engine command `showNotice` with a tone and a text.
 * "status" is only announced (a live region, nothing is visible to the eye);
 * "error" is a `role="alert"` line under the field, until the next edit, a new
 * notice or its removal. File messages travel through the same channel (stories
 * `ImageUpload…`).
 */
export const FieldNotice: Story = {
  render: (args) => {
    const ref = useRef<RichTextEditorHandle>(null);
    const show = (notice: { tone: "status" | "error"; text: string } | null) =>
      ref.current?.editor?.commands.showNotice(notice);
    return (
      <div className="flex max-w-[640px] flex-col gap-3">
        <RichTextEditor
          {...args}
          ref={ref}
          defaultValue="<p>Edit this text to dismiss an error.</p>"
        />
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => show({ tone: "status", text: "Draft restored" })}
          >
            Announce status
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => show({ tone: "error", text: "Could not insert the card. Try again." })}
          >
            Show error
          </Button>
          <Button size="sm" variant="ghost" onClick={() => show(null)}>
            Clear
          </Button>
        </div>
      </div>
    );
  },
};

/** The label, hint and error of `FormField`; the label gives the field its name through `id`. */
export const InFormField: Story = {
  render: () => {
    const [submitted, setSubmitted] = useState<string | null>(null);
    return (
      <form
        className="flex max-w-[640px] flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          setSubmitted(String(new FormData(event.currentTarget).get("description")));
        }}
      >
        <FormField
          label="Description"
          htmlFor="story-description"
          hint="Shown on the overview page"
          required
        >
          <RichTextEditor id="story-description" name="description" required />
        </FormField>
        <FormField label="Summary" htmlFor="story-summary" error="The summary is too short">
          <RichTextEditor id="story-summary" defaultValue="<p>Too short</p>" />
        </FormField>
        <div>
          <Button type="submit">Submit</Button>
        </div>
        {submitted != null && <code className="text-fg-2 text-caption break-all">{submitted}</code>}
      </form>
    );
  },
};

/** Read-only: the text can be selected and goes into the form, but it cannot be edited. */
export const ReadOnly: Story = {
  args: { readOnly: true },
};

/**
 * A light sheet in any theme (`surface="paper"`): the Document — text, link,
 * palettes, table, checklist, code Block (GitHub Light) — looks as in the light
 * theme, while the Toolbar, menus, popovers and the field's focus ring stay in
 * the app theme. The theme is switched with the showcase toolbar; axe measures
 * the story in `dark`, `light`, `dim` and with the brand.
 */
export const PaperSurface: Story = {
  args: {
    surface: "paper",
    defaultValue:
      SAMPLE.replace(
        "<p>Text after the divider.</p>",
        '<p>Read the <a href="https://example.com/guide">style guide</a> before you print.</p>'
      ) +
      COLOURS +
      TABLE_SAMPLE,
  },
  /*
    The column is wider than the others, to make room for the Block handle's
    margin: the sheet has its own right margin, and at 640 px six table columns
    of 6 rem each did not fit. The table scrolled inside itself, and axe counts
    such an area as unreachable from the keyboard (it does not see the caret in
    the cells, `prose.ts`).
  */
  render: (args) => (
    <div className="max-w-[680px]">
      <RichTextEditor {...args} />
    </div>
  ),
};

/** Disabled, like other fields. */
export const Disabled: Story = {
  args: { disabled: true },
};

/**
 * Code Blocks (ADR-0051): eight languages (the sample has all of them, Markdown
 * last) and plain text. In a Block's header the language button is on the left
 * and "Copy" on the right: the Block's text goes to the clipboard without the
 * highlight tokens. From the keyboard, `Alt+F10` from the Block goes to the
 * language, again to "Copy", and once more to the Toolbar; the arrows move across
 * the header, and `Escape` returns to the code. The highlighting is decoration:
 * only `class="language-…"` goes into `onChange`. The theme is GitHub Light in
 * `light` and GitHub Dark in `dark` and `dim`; it is captured in all three, and
 * axe measures the token contrast on the Block's background.
 */
export const CodeBlocks: Story = {
  args: { defaultValue: CODE_BLOCKS },
};

/**
 * Read-only: a label replaces the language button, as there is nothing to
 * change; "Copy" stays. A Block without a language has no label: "Plain text" is
 * the name of a menu item, not of a language, and the server-side `RichTextView`
 * does not label such a Block either.
 */
export const CodeBlocksReadOnly: Story = {
  args: { defaultValue: CODE_BLOCKS, readOnly: true },
};

/**
 * The header in the Russian locale: labels such as "Language: Python", "Plain
 * text" and the "Copy code" hint come from the catalog.
 */
export const CodeBlocksRussian: Story = {
  render: () => (
    <UiProvider locale="ru-RU" messages={ru}>
      <RichTextEditor defaultValue={CODE_BLOCKS} />
    </UiProvider>
  ),
};

/**
 * Russian locale: the field name, placeholder, counter, Toolbar and hints come
 * from `@olddevs/ui/locales/ru`. The Document's text is data and stays English.
 */
export const RussianLocale: Story = {
  render: () => (
    <UiProvider locale="ru-RU" messages={ru}>
      <div className="flex max-w-[640px] flex-col gap-4">
        <RichTextEditor />
        <RichTextEditor
          preset="basic"
          maxLength={40}
          defaultValue="<p>Close to the limit of forty symbols.</p>"
        />
      </div>
    </UiProvider>
  ),
};

/**
 * Type the command into the last (empty) paragraph, once the engine is created:
 * the menu opened by `/` opens by typing, not by a prop, and the story shows it
 * open.
 */
function useTypedCommand(ref: RefObject<RichTextEditorHandle | null>, command: string) {
  useEffect(() => {
    // An empty command leaves the field untouched: tests type into it by hand.
    if (command === "") return;
    let frame = 0;
    const tick = () => {
      const editor = ref.current?.editor;
      if (!editor) {
        frame = requestAnimationFrame(tick);
        return;
      }
      editor.chain().focus("end").insertContent(command).run();
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [ref, command]);
}

const INSERT_SAMPLE = "<h2>Meeting notes</h2><p>Start a new line with a slash.</p><p></p>";

function TypedCommand({ command }: { command: string }) {
  const ref = useRef<RichTextEditorHandle>(null);
  useTypedCommand(ref, command);
  return (
    <div className="h-[520px] max-w-[640px]">
      <RichTextEditor ref={ref} aria-label="Document" defaultValue={INSERT_SAMPLE} />
    </div>
  );
}

/**
 * The Slash menu opened by `/`: it appears at the caret, and focus stays in the
 * field. The arrows move between items, Enter applies, and Escape closes it and
 * keeps what was typed. The sections are "Insert" (a new Block after the current
 * one) and "Turn into" (change the type of the current one).
 */
export const InsertMenuSlash: Story = {
  render: () => <TypedCommand command="/" />,
};

/** What is typed after `/` filters the items: by label and by short names (`h2`, `hr`). */
export const InsertMenuFiltered: Story = {
  render: () => <TypedCommand command="/head" />,
};

/**
 * The same items, opened by the "+" button, the first one on the Toolbar: the
 * kit's menu with focus on its items. An item applies to the Block under the caret.
 */
export const InsertMenuPlus: Story = {
  args: {
    defaultValue: "<p>Put the caret here and press the plus button on the toolbar.</p>",
  },
};

/** The Slash menu in the Russian locale: labels, sections and the "no results" text come from the catalog. */
export const InsertMenuRussian: Story = {
  render: () => (
    <UiProvider locale="ru-RU" messages={ru}>
      <TypedCommand command="/" />
    </UiProvider>
  ),
};

/**
 * Place the caret in a cell once the engine is created: the "Table" menu items,
 * except insert, are available only while the caret is in a table, and the
 * story must show them as available.
 */
function useCaretInCell(ref: RefObject<RichTextEditorHandle | null>, text: string) {
  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const editor = ref.current?.editor;
      if (!editor) {
        frame = requestAnimationFrame(tick);
        return;
      }
      let end = -1;
      editor.state.doc.descendants((node, pos) => {
        if (end < 0 && node.isText && node.text === text) end = pos + node.nodeSize;
      });
      if (end > 0) editor.chain().focus().setTextSelection(end).run();
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [ref, text]);
}

function TableInCell({
  locale,
  document = TABLE_SAMPLE,
  caret = "Billing",
  showBars = false,
}: {
  locale?: "ru-RU";
  document?: string;
  caret?: string;
  /**
   * The width bars are in the table while the caret is in it, but each one draws its line only under
   * the pointer. The story has no pointer, so it draws all of them.
   */
  showBars?: boolean;
}) {
  const ref = useRef<RichTextEditorHandle>(null);
  useCaretInCell(ref, caret);
  const field = (
    <div
      className={
        showBars ? "max-w-[640px] [&_[data-column-handle]>div]:opacity-100" : "max-w-[640px]"
      }
    >
      <RichTextEditor ref={ref} aria-label="Document" defaultValue={document} />
    </div>
  );
  return locale ? (
    <UiProvider locale={locale} messages={ru}>
      {field}
    </UiProvider>
  ) : (
    field
  );
}

/**
 * The "Table ▾" menu on the Toolbar, as in TinyMCE: "Table ›" is the size grid,
 * "Insert table…" opens a dialog with numbers up to 20 × 50, and then come the
 * "Cell", "Row", "Column", "Sort" and "Delete table" submenus. The caret is in
 * the "Billing" cell, so everything is available. From the keyboard: `Alt+F10`
 * → button → `Enter`; `→` opens a submenu, `←` and `Escape` close it. `Tab` in
 * the Document moves between cells, and in the last one it adds a row.
 */
export const TableMenu: Story = {
  render: () => <TableInCell />,
};

/**
 * Merged cells: `colspan` and `rowspan` are written to the HTML and survive
 * saving. "Cell › Split cell" on a merged cell restores the grid; "Merge cells"
 * needs several selected cells. Sorting is unavailable in such a table, and the
 * submenu says why.
 */
export const TableMerged: Story = {
  render: () => <TableInCell document={MERGED_SAMPLE} caret="Billing" />,
};

/**
 * Sorting and alignment of a column: "Sort ›" compares numbers as numbers
 * (digit grouping and decimals per locale), ISO dates and `DD.MM.YYYY` as dates,
 * and text by the locale's alphabet. "Column › Align" writes `data-align` on
 * every cell of the column; in Markdown it is `:---:` and `---:`.
 */
export const TableSortAndAlign: Story = {
  render: () => <TableInCell document={SORT_SAMPLE} caret="Contoso" />,
};

/** The Slash menu by `/table`: a new 3×3 table with a header row goes after the current Block. */
export const TableInsertSlash: Story = {
  render: () => <TypedCommand command="/table" />,
};

/**
 * The table menu in the Russian locale: the "Table" and "Insert table…" labels,
 * the submenus and the items come from the catalog; the grid size takes Russian
 * plural forms, and text sorting follows the Russian alphabet.
 */
export const TableRussian: Story = {
  render: () => <TableInCell locale="ru-RU" document={SORT_SAMPLE} caret="Contoso" />,
};

/**
 * A narrow screen (375 px): a six-column table does not fit and scrolls
 * horizontally inside itself (`display: block; overflow-x: auto`), without
 * pushing the page wider. The minimum column width is 6 rem.
 */
export const TableNarrow: Story = {
  tags: ["viewport-phone"],
  render: () => <TableInCell />,
};

/**
 * Column widths with the pointer (decision 4): with the caret in a table, a bar appears on the
 * boundary between every two columns (it is always visible on a touch screen). Drag one: the bar
 * follows the pointer smoothly, and on release the boundary snaps to the nearest 5%. Only the two
 * columns around it trade width, the rest stay put, and the last column has no bar. The drag is one
 * undo step. This table has no widths yet: the first drag rounds all of them to 5%, then moves the
 * boundary. The bars are for the pointer only; the keyboard has the menu (`TableColumnWidthMenu`).
 * The caret is in the "Search" cell; a bar draws its line under the pointer, and the story draws all
 * three at once so that they are in the frame.
 */
export const TableColumnWidthHandle: Story = {
  render: () => (
    <TableInCell
      document={SIZED_TABLE_SAMPLE.replace(colgroup(25, 20, 20, 35), "")}
      caret="Search"
      showBars
    />
  ),
};

/**
 * Column widths from the keyboard (decision 6): "Table ▾" → "Column ›" → "Wider" / "Narrower" widen
 * or narrow the column under the caret by 5% at the expense of its neighbour on the right (on the left
 * for the last column). The group's name is the current width ("Column width: 20%"), and the result is
 * announced through the Field notice. "Equal columns" and "Fit columns to content" are in the "Table"
 * menu itself: the second takes all the widths away, and the table is sized by its content again.
 */
export const TableColumnWidthMenu: Story = {
  render: () => <TableInCell document={SIZED_TABLE_SAMPLE} caret="Billing" />,
};

/**
 * A narrow screen (375 px): the shares are of the table's width, but a column never gets narrower than
 * 6 rem, so six columns do not fit and the table scrolls inside itself, as a table without widths does.
 * The bars follow the scroll.
 */
export const TableColumnWidthNarrow: Story = {
  tags: ["viewport-phone"],
  render: () => <TableInCell document={SIZED_WIDE_SAMPLE} caret="Billing" />,
};

/** Paste a range from Excel (decision 7): its column widths in points become shares rounded to 5%. */
function ExcelPasteDemo() {
  const ref = useRef<RichTextEditorHandle>(null);
  return (
    <div className="flex max-w-[640px] flex-col gap-3">
      <div>
        <Button
          onClick={() => {
            const editor = ref.current?.editor;
            editor?.view.focus();
            editor?.view.pasteHTML(EXCEL_RANGE, new Event("paste") as ClipboardEvent);
          }}
        >
          Paste a range from Excel
        </Button>
      </div>
      <RichTextEditor ref={ref} aria-label="Document" defaultValue="<p>Press the button.</p>" />
    </div>
  );
}

/**
 * A range from Excel: the paste cleanup (`pasteCleanup`) reads the column widths the application writes
 * (points and pixels) and the Document keeps them as shares (30/20/15/20/15). Word, Google Docs and
 * Google Sheets are read the same way. A copy from a web page with a `colgroup` is read by the table
 * itself; a table with no widths comes in sized by its content.
 */
export const TableColumnWidthExcelPaste: Story = {
  render: () => <ExcelPasteDemo />,
};

/** Column widths in the Russian locale: the name of the menu group, the two items and the announcement come from the catalog. */
export const TableColumnWidthRussian: Story = {
  render: () => <TableInCell locale="ru-RU" document={SIZED_TABLE_SAMPLE} caret="Billing" />,
};

/**
 * The image address of the stories: the showcase file (`.storybook/static`).
 * It must be absolute, because the Document accepts only `http(s)`, and it is
 * built from the showcase's own address: the showcase is published either at the
 * root or in a subdirectory (as on GitHub Pages).
 */
function sampleImage(): string {
  return new URL("editor-sample-landscape.svg", document.baseURI).href;
}

/** Images at three widths, with and without a caption, written the way the Editor writes them. */
function imagesDocument(): string {
  const src = sampleImage();
  return (
    "<h2>Images</h2><p>A figure keeps its caption under the picture.</p>" +
    `<figure><img src="${src}" alt="Mountains under a clear sky" data-width="75">` +
    "<figcaption>Caption under a picture at 75% of the width</figcaption></figure>" +
    `<figure><img src="${src}" alt="" data-width="50"></figure>` +
    "<p>The image above is decorative and has no caption. The next one is full width.</p>" +
    `<figure><img src="${src}" alt="Mountains, full width" data-width="100">` +
    "<figcaption>Full width</figcaption></figure>"
  );
}

/** A host stub for the grid: it shows what is selected, for the eye and for browser tests. */
function TableSizeGridDemo({ fields, locale }: { fields?: boolean; locale?: "ru-RU" }) {
  const [picked, setPicked] = useState("nothing picked yet");
  const grid = (
    <div className="flex w-56 flex-col gap-3">
      <SizeGrid
        fields={fields ? { maxCols: 20, maxRows: 50 } : undefined}
        onPick={(cols, rows) => setPicked(`picked ${cols} x ${rows}`)}
        onCancel={() => setPicked("cancelled")}
      />
      <p data-testid="picked" className="text-fg-2 text-caption">
        {picked}
      </p>
    </div>
  );
  return locale ? (
    <UiProvider locale={locale} messages={ru}>
      {grid}
    </UiProvider>
  ) : (
    grid
  );
}

/**
 * Images: a `<figure>` with an `<img>` and an optional caption. A click on the
 * image selects it: above it is a bar with width presets of 50, 75 and 100 %,
 * "Edit image" and "Remove image", and on the sides are width grips for the
 * mouse. Enter on the selected image moves into the caption. The "Image" button
 * on the Toolbar inserts an image by address.
 */
export const Images: Story = {
  render: (args) => (
    <div className="max-w-[640px]">
      <RichTextEditor {...args} defaultValue={imagesDocument()} />
    </div>
  ),
};

/** Insert by address: the popover opened by the Toolbar's "Image" button above an empty paragraph. */
export const ImageByAddress: Story = {
  render: function Render(args) {
    const ref = useRef<RichTextEditorHandle>(null);
    useEffect(() => {
      let frame = 0;
      const tick = () => {
        const editor = ref.current?.editor;
        if (!editor) {
          frame = requestAnimationFrame(tick);
          return;
        }
        editor.chain().focus("end").openImageEditor().run();
      };
      frame = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(frame);
    }, []);
    return (
      <div className="h-[520px] max-w-[640px]">
        <RichTextEditor
          {...args}
          ref={ref}
          defaultValue="<p>Paste an image address, for example the one of this showcase.</p><p></p>"
        />
      </div>
    );
  },
};

/** A fake uploader: it "uploads" for one and a half seconds, then gives back an address or a refusal. */
function fakeUploader(outcome: "success" | "failure") {
  return (file: File) =>
    new Promise<string>((resolve, reject) => {
      window.setTimeout(() => {
        if (outcome === "success") resolve(sampleImage());
        else reject(new Error(`The server refused ${file.name}`));
      }, 1500);
    });
}

/**
 * File upload: drag an image into the field, paste a screenshot from the
 * clipboard, or choose a file in the popover ("Upload from device"). For one and
 * a half seconds a placeholder stands where the image will go, then the image
 * takes its place; one undo removes it. The uploader is fake and always gives
 * back the showcase image.
 */
export const ImageUploadSuccess: Story = {
  args: {
    onUploadImage: fakeUploader("success"),
    defaultValue: "<p>Drop or paste an image file here.</p><p></p>",
  },
};

/**
 * Upload failure: the placeholder disappears, the Document does not change, and
 * a message appears under the field. Without `onUploadImage` (the `Images`
 * story) a file from the clipboard is not accepted at all, and the field hints
 * at inserting the image by address.
 */
export const ImageUploadFailure: Story = {
  args: {
    onUploadImage: fakeUploader("failure"),
    defaultValue: "<p>Drop or paste an image file here: the upload always fails.</p><p></p>",
  },
};

/** Images in the Russian locale: the popover, the image bar, the caption hint and file messages. */
export const ImagesRussian: Story = {
  render: () => (
    <UiProvider locale="ru-RU" messages={ru}>
      <div className="max-w-[640px]">
        <RichTextEditor
          aria-label="Document"
          defaultValue={imagesDocument()}
          onUploadImage={fakeUploader("success")}
        />
      </div>
    </UiProvider>
  ),
};

/*
  Image alignment (ADR-0081, OLDSUI-311). The images are written the way the Editor writes them:
  `data-align` on the `figure`, the width as a preset on the `img`. The text is neutral on purpose.
*/
const LOREM =
  "The paragraph is long enough to run past the picture and fall back to the full width of the " +
  "Document, which is how the wrapping shows. Text beside an aligned image follows its edge, and a " +
  "heading, a table or a divider starts below it.";

function alignedDocument(): string {
  const src = sampleImage();
  return (
    "<h2>Image alignment</h2>" +
    `<figure data-align="left"><img src="${src}" alt="Mountains under a clear sky" data-width="33">` +
    "<figcaption>On the left, 33%</figcaption></figure>" +
    `<p>${LOREM} ${LOREM}</p><p>${LOREM}</p>` +
    "<h3>A heading starts below the image</h3>" +
    `<figure data-align="right"><img src="${src}" alt="Mountains, again" data-width="25"></figure>` +
    `<p>${LOREM} ${LOREM}</p>` +
    "<ul><li><p>A list wraps the image too</p></li><li><p>Its bullets stay clear of the picture</p></li></ul>" +
    "<hr><p>A divider clears both sides.</p>" +
    `<figure data-align="left"><img src="${src}" alt="" data-width="25"></figure>` +
    `<figure data-align="right"><img src="${src}" alt="" data-width="25"></figure>` +
    "<p>One image on the left and one on the right can stand side by side, with the text between them.</p>"
  );
}

/**
 * Image alignment: left and right put the image at the edge and the text of the next Blocks wraps
 * around it, as in Word. A selected image shows three toggles (left, centre, right) before the width
 * presets; `Ctrl/⌘+Shift+L/E/R` do the same on a selected image. An aligned image is 25, 33, 50 or
 * 75% wide and has one resize handle, on the side of the text. A heading, a table, a divider and the
 * other Blocks of ADR-0081 start below it.
 */
export const ImageAlignment: Story = {
  render: (args) => (
    <div className="max-w-[640px]">
      <RichTextEditor {...args} defaultValue={alignedDocument()} />
    </div>
  ),
};

/**
 * A narrow Document (375 px): from 30 rem of the Document's own width the image floats, and below it
 * there is no room for a column of text beside the image, so it stands on a line of its own, in the
 * centre, at its own width. The threshold is a container query, not the window's width.
 */
export const ImageAlignmentNarrow: Story = {
  tags: ["viewport-phone"],
  render: (args) => <RichTextEditor {...args} defaultValue={alignedDocument()} />,
};

/**
 * Alignment is relative to its own container: here it is a share of a column of a Column layout and
 * of a Wrapper, and each container holds the floats of its own children. In a table cell the toggles
 * are unavailable and an aligned image stays in the centre.
 */
export const ImageAlignmentInColumn: Story = {
  render: (args) => {
    const src = sampleImage();
    const column = (side: "left" | "right") =>
      `<div data-block="column"><figure data-align="${side}"><img src="${src}" alt="" data-width="50"></figure>` +
      `<p>${LOREM}</p></div>`;
    return (
      <div className="max-w-[640px]">
        <RichTextEditor
          {...args}
          defaultValue={
            `<div data-block="layout" data-layout="50-50">${column("left")}${column("right")}</div>` +
            '<div data-block="wrapper" data-tone="accent">' +
            `<figure data-align="left"><img src="${src}" alt="" data-width="25"></figure>` +
            `<p>${LOREM}</p></div>` +
            "<table><tbody><tr><td>" +
            `<figure data-align="left"><img src="${src}" alt="" data-width="50"></figure>` +
            "</td><td><p>The image in the first cell takes no alignment.</p></td></tr></tbody></table>"
          }
        />
      </div>
    );
  },
};

const WORD_ALIGNED_FRAGMENT = (src: string) =>
  '<html xmlns:o="urn:schemas-microsoft-com:office:office" ' +
  'xmlns:w="urn:schemas-microsoft-com:office:word"><body>' +
  "<p class=MsoNormal><span style='mso-ignore:vglayout'>" +
  `<img width=200 height=130 src="${src}" align=left hspace=12 alt="A landscape"></span>` +
  "A picture Word wraps with the text on its right.</p>" +
  `<p class=MsoNormal><img width=200 height=130 src="${src}" align=right alt="">` +
  "And one with the text on its left.</p></body></html>";

function PasteAlignedDemo() {
  const ref = useRef<RichTextEditorHandle>(null);
  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const editor = ref.current?.editor;
      if (!editor) {
        frame = requestAnimationFrame(tick);
        return;
      }
      // The cleanup steps come in their own chunk: wait for it, or the first paste would go in uncleaned.
      void loadPasteCleanup().then(() => {
        editor.view.pasteHTML(WORD_ALIGNED_FRAGMENT(sampleImage()));
      });
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <div className="max-w-[640px]">
      <RichTextEditor ref={ref} aria-label="Document" />
    </div>
  );
}

/**
 * A paste from Word: a picture the text wraps (`align="left"` or `"right"`, as Word writes it) comes
 * in aligned, at 50% because the width in pixels says nothing about the target Document. The same
 * goes for `float` on a picture from a web page.
 */
export const ImageAlignmentPasteFromWord: Story = {
  render: () => <PasteAlignedDemo />,
};

/** Image alignment in the Russian locale: the toggles, their tooltips and the popover. */
export const ImageAlignmentRussian: Story = {
  render: () => (
    <UiProvider locale="ru-RU" messages={ru}>
      <div className="max-w-[640px]">
        <RichTextEditor aria-label="Document" defaultValue={alignedDocument()} />
      </div>
    </UiProvider>
  ),
};

/**
 * The table size grid on its own: five by five, growing to ten by ten as the
 * selection moves. The arrows move the selection, `Enter` selects, `Escape`
 * cancels; the first row is painted as a header. On the Toolbar it lives in the
 * "Table ›" submenu of the "Table" menu (story `TableMenu`).
 */
export const TableSizeGrid: Story = {
  render: () => <TableSizeGridDemo />,
};

/** The same grid with the numeric "Columns" and "Rows" fields (up to 20 × 50) and an "Insert" button. */
export const TableSizeGridFields: Story = {
  render: () => <TableSizeGridDemo fields />,
};

/** Russian locale: the grid's name and the size in words with plural forms, e.g. "3 columns, 4 rows" (English stand-in). */
export const TableSizeGridRussian: Story = {
  render: () => <TableSizeGridDemo fields locale="ru-RU" />,
};

/**
 * Open the emoji grid with the Toolbar button, as soon as the engine and the
 * Toolbar appear: the story shows the popover open, for the eye, snapshots and axe.
 */
function useOpenEmoji(ref: RefObject<HTMLDivElement | null>, name: string) {
  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const button = ref.current?.querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`);
      if (!button) {
        frame = requestAnimationFrame(tick);
        return;
      }
      button.click();
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [ref, name]);
}

function EmojiOpen({ locale }: { locale?: "ru-RU" }) {
  const host = useRef<HTMLDivElement>(null);
  useOpenEmoji(host, locale ? ru.editor.emoji : "Emoji");
  const field = (
    <div ref={host} className="h-[480px] max-w-[640px]">
      <RichTextEditor
        aria-label="Document"
        defaultValue="<p>Pick an emoji from the grid: it lands in the text as it is.</p>"
      />
    </div>
  );
  return locale ? (
    <UiProvider locale={locale} messages={ru}>
      {field}
    </UiProvider>
  ) : (
    field
  );
}

/**
 * The "Emoji" button is the last one in the Toolbar row, after the table and the
 * image. It opens a popover with a curated set: "Favorites" (20) and six
 * categories of ten emoji each. A click or `Enter` inserts the emoji as plain
 * text: at the end of the selection, without erasing it, with the caret after
 * the emoji and one edit for undo. The arrows, `Home` and `End` move across the
 * grid, and `Escape` closes the popover and returns focus to the Document. The
 * popover is open as the story is shown.
 */
export const EmojiGrid: Story = {
  render: () => <EmojiOpen />,
};

/** Russian locale: the category names and the emoji names (a screen reader reads them) come from the catalog. */
export const EmojiGridRussian: Story = {
  render: () => <EmojiOpen locale="ru-RU" />,
};

/** Without `emoji` in `tools` there is no button, as in the `basic` preset. */
export const EmojiDisabled: Story = {
  args: { tools: ["history", "bold", "italic", "link", "table", "image"] },
};

/**
 * Click the keyboard shortcuts button once the Toolbar is drawn: the popover
 * opens by a click, not by a prop, and the story shows it open.
 */
function useOpenedShortcuts(rootRef: RefObject<HTMLDivElement | null>, name: string) {
  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const button = rootRef.current?.querySelector<HTMLButtonElement>(
        `button[aria-label="${name}"]`
      );
      if (!button) {
        frame = requestAnimationFrame(tick);
        return;
      }
      button.click();
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [rootRef, name]);
}

function OpenedShortcuts({ name, preset }: { name: string; preset?: "basic" }) {
  const rootRef = useRef<HTMLDivElement>(null);
  useOpenedShortcuts(rootRef, name);
  return (
    <div ref={rootRef} className="h-[620px] max-w-[640px]">
      <RichTextEditor aria-label="Document" preset={preset} defaultValue="<p>Notes</p>" />
    </div>
  );
}

/**
 * Keyboard shortcuts popover: its keyboard button is the last one on the
 * Toolbar, at the right edge. The popover is a read-only "Command — Shortcut"
 * table; its rows come from the same table the Toolbar takes its hints from.
 * Escape and a click outside close it and return focus to the button.
 */
export const ShortcutsReference: Story = {
  render: () => <OpenedShortcuts name="Keyboard shortcuts" />,
};

/** The `basic` preset: the reference lists only the commands of its Tools and the common ones. */
export const ShortcutsReferenceBasic: Story = {
  render: () => <OpenedShortcuts name="Keyboard shortcuts" preset="basic" />,
};

/** Russian locale: the column headers and the command names come from the catalog. */
export const ShortcutsReferenceRussian: Story = {
  render: () => (
    <UiProvider locale="ru-RU" messages={ru}>
      <OpenedShortcuts name={ru.editor.shortcuts} />
    </UiProvider>
  ),
};

/*
  Column layouts: all six variants on neutral text. The columns have different
  heights, to show that the grid does not align their content, and the dashed
  outline of each column stretches to the height of the row.
*/
const layoutColumn = (title: string, text: string) =>
  `<div data-block="column"><h4>${title}</h4><p>${text}</p></div>`;
const layoutBlock = (variant: string, ...columns: string[]) =>
  `<div data-block="layout" data-layout="${variant}">${columns.join("")}</div>`;

const LAYOUTS_SAMPLE =
  "<h2>Column layouts</h2><p>Each layout is one block. Its columns read from left to right.</p>" +
  layoutBlock("100", layoutColumn("Single column", "A layout of one column frames its blocks.")) +
  layoutBlock(
    "50-50",
    layoutColumn("Goals", "Ship the new search and keep the old one running until March."),
    layoutColumn("Risks", "The index rebuild may take longer than a night.")
  ) +
  layoutBlock(
    "33-33-33",
    layoutColumn("Plan", "Three steps, one per sprint."),
    layoutColumn("Owner", "Alex"),
    layoutColumn("Status", "On track")
  ) +
  layoutBlock(
    "25-25-25-25",
    layoutColumn("Q1", "Search"),
    layoutColumn("Q2", "Billing"),
    layoutColumn("Q3", "Reports"),
    layoutColumn("Q4", "Review")
  ) +
  layoutBlock(
    "60-40",
    layoutColumn("Summary", "The wide column carries the main text, the narrow one a note."),
    layoutColumn("Note", "60/40")
  ) +
  layoutBlock(
    "40-60",
    layoutColumn("Note", "40/60"),
    layoutColumn("Details", "The narrow column comes first and the wide one follows it.")
  ) +
  "<p>Text after the layouts.</p>";

/** The layout story is wider than usual: the four-column layout needs a width of at least 48 rem. */
function WideField(props: Partial<RichTextEditorProps>) {
  return (
    <div className="max-w-[960px]">
      <RichTextEditor aria-label="Document" defaultValue={LAYOUTS_SAMPLE} {...props} />
    </div>
  );
}

/**
 * Column layout: six variants — one, two, three and four columns, 60/40 and
 * 40/60. A column is a separate area with a dashed frame (in the Editor only),
 * and it holds any Blocks except another Column layout. Tab and Shift+Tab move
 * between the columns; `←`/`→` at the edge of the text move to the neighboring
 * column; `↑`/`↓` at the top and bottom lines leave the Column layout. In HTML it
 * is `div[data-block]` with the variant in `data-layout`, and no `style`.
 */
export const Layouts: Story = {
  render: () => <WideField />,
};

/** The same Column layouts on a `surface="paper"` sheet. */
export const LayoutsPaper: Story = {
  render: () => <WideField surface="paper" />,
};

/** Insert a Column layout once the engine is created: the "Column layout" item of the Insert menu. */
function useInsertedLayout(ref: RefObject<RichTextEditorHandle | null>) {
  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const editor = ref.current?.editor;
      if (!editor) {
        frame = requestAnimationFrame(tick);
        return;
      }
      editor.chain().focus("end").insertLayout().run();
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [ref]);
}

function InsertedLayout() {
  const ref = useRef<RichTextEditorHandle>(null);
  useInsertedLayout(ref);
  return (
    <div className="max-w-[640px]">
      <RichTextEditor
        ref={ref}
        aria-label="Document"
        defaultValue="<p>A new layout goes below the current block.</p>"
      />
    </div>
  );
}

/**
 * A Column layout just inserted: two empty columns with a dashed frame, the
 * caret in the first one (as the owner's reference shows). This is how the
 * "Column layout" item of the Insert menu places it (`/layout` or "+").
 */
export const LayoutInserted: Story = {
  render: () => <InsertedLayout />,
};

/** The Slash menu by `/layout`: the "Column layout" item with two columns by default. */
export const LayoutInsertSlash: Story = {
  render: () => <TypedCommand command="/layout" />,
};

/**
 * A narrow screen (375 px): the columns stack in reading order, the left one on
 * top. The threshold is the width of the Document itself (a container query),
 * not the window's.
 */
export const LayoutNarrow: Story = {
  tags: ["viewport-phone"],
  render: () => <WideField />,
};

/**
 * A Column layout in a window: two columns fit in a 560 px Dialog and stand
 * side by side. Tab in the Document moves between the columns and does not
 * close the window; from the last column it moves on through the window.
 */
export const LayoutInDialog: Story = {
  render: function Render() {
    const [open, setOpen] = useState(true);
    return (
      <div className="h-[520px]">
        <Button onClick={() => setOpen(true)}>Open the window</Button>
        <Dialog open={open} onClose={() => setOpen(false)} title="Edit the note">
          <div className="w-[560px] max-w-full">
            <RichTextEditor
              aria-label="Document"
              defaultValue={
                "<p>Press Tab to move between the columns.</p>" +
                layoutBlock(
                  "50-50",
                  layoutColumn("Left", "First column."),
                  layoutColumn("Right", "Second column.")
                )
              }
            />
          </div>
        </Dialog>
      </div>
    );
  },
};

const LAYOUT_HANDLE_SAMPLE =
  "<p>The handle of a block in a column stands at the left edge of its column.</p>" +
  layoutBlock(
    "50-50",
    layoutColumn("Left", "First column."),
    layoutColumn("Right", "The caret is in this column.")
  );

/**
 * The Block handle in a column: at the left edge of its own column, at the level
 * of the Block's first line; for the right column it stands in the gap between
 * the columns. The Block here is a child of the column: "Move up", "Move down"
 * and "Add below" do not leave it.
 */
export const LayoutBlockHandle: Story = {
  render: () => (
    <ShownHandle caret="The caret is in this column." document={LAYOUT_HANDLE_SAMPLE} />
  ),
};

/**
 * The menu of the Block handle in a column: "Format ›" is the type of the Block
 * itself, and "Column layout ›" is the variant of its Column layout (six, with
 * the current one checked). Under "Add ›" the Column layout is a submenu of the
 * same six variants; the new one goes below the whole Column layout, with no
 * nesting. For a Column layout selected as a whole, "Format ›" lists these six
 * variants.
 */
export const LayoutBlockHandleMenu: Story = {
  render: () => (
    <ShownHandle caret="The caret is in this column." document={LAYOUT_HANDLE_SAMPLE} open />
  ),
};

/*
  Wrapper: a group of Blocks without a look of its own, as Redactor's Wrapper
  is. Neutral text: a release note, a Wrapper at the top level and in a Column
  layout column.
*/
const wrapperBlock = (...blocks: string[]) => `<div data-block="wrapper">${blocks.join("")}</div>`;

const WRAPPERS_SAMPLE =
  "<h2>Wrappers</h2><p>A wrapper groups blocks: they move, duplicate and go away together.</p>" +
  wrapperBlock(
    "<h3>Before the release</h3>",
    "<p>Check the access to the repository and the registry.</p>",
    "<ul><li><p>Run the gates</p></li><li><p>Write the changelog</p></li></ul>"
  ) +
  layoutBlock(
    "50-50",
    `<div data-block="column">${wrapperBlock("<h4>Inside a column</h4>", "<p>A wrapper stands in a layout column too.</p>")}</div>`,
    layoutColumn("Next to it", "A plain column without a wrapper.")
  ) +
  "<p>Text after the wrappers.</p>";

/**
 * Wrapper: a gray dashed outline and inner padding, in the Editor only, with the
 * same look as the Column layout's columns. Inside it are any Blocks except
 * another Wrapper and a Column layout; a Wrapper stands in the Document and in a
 * column. In HTML it is `div[data-block="wrapper"]` with no other attributes.
 */
export const Wrappers: Story = {
  render: () => (
    <div className="max-w-[960px]">
      <RichTextEditor aria-label="Document" defaultValue={WRAPPERS_SAMPLE} />
    </div>
  ),
};

function InsertedWrapper() {
  const ref = useRef<RichTextEditorHandle>(null);
  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const editor = ref.current?.editor;
      if (!editor) {
        frame = requestAnimationFrame(tick);
        return;
      }
      editor.chain().focus("end").insertWrapper().run();
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <div className="max-w-[640px]">
      <RichTextEditor
        ref={ref}
        aria-label="Document"
        defaultValue="<p>A new wrapper goes below the current block.</p>"
      />
    </div>
  );
}

/**
 * A Wrapper just inserted: an empty paragraph in a dashed frame, with the caret
 * inside. This is how the "Wrapper" item of the Insert menu (`/wrapper` or "+")
 * and the "Add › Wrapper" item of the Block handle place it.
 */
export const WrapperInserted: Story = {
  render: () => <InsertedWrapper />,
};

/** The Slash menu by `/wrapper`: the "Wrapper" item. */
export const WrapperInsertSlash: Story = {
  render: () => <TypedCommand command="/wrapper" />,
};

/**
 * The Block handle menu in a Wrapper: the handle is at the Wrapper's left edge,
 * and the actions do not leave it. "Tone ›" changes the look of the Wrapper, and
 * "Unwrap" leaves the Blocks in its place in one edit.
 */
export const WrapperBlockHandleMenu: Story = {
  render: () => (
    <ShownHandle
      caret="The caret is in this wrapper."
      document={
        "<p>The handle of a block in a wrapper stands at the left edge of the wrapper.</p>" +
        wrapperBlock("<p>First block of the wrapper.</p>", "<p>The caret is in this wrapper.</p>")
      }
      open
    />
  ),
};

/*
  Wrapper tones: five tones and a Wrapper without a tone in one Document.
  The meaning of a note is named in words in its text; the tone only reinforces it.
*/
const tonedBlock = (tone: string, ...blocks: string[]) =>
  `<div data-block="wrapper" data-tone="${tone}">${blocks.join("")}</div>`;

const WRAPPER_TONES_SAMPLE =
  "<h2>Callout tones</h2>" +
  "<p>A tone gives a wrapper a soft background and a stripe on the left.</p>" +
  tonedBlock(
    "accent",
    '<p><strong>Note:</strong> the registry moved to <a href="https://example.com">a new address</a>.</p>'
  ) +
  tonedBlock("success", "<p><strong>Tip:</strong> run the gates before you tag a release.</p>") +
  tonedBlock(
    "neutral",
    "<p><strong>Important:</strong> the changelog is written from the change notes.</p>",
    "<blockquote><p>A quotation inside a note.</p></blockquote>"
  ) +
  tonedBlock(
    "warning",
    "<h4>Warning</h4>",
    "<p>Back up the database before the upgrade.</p>",
    "<ul><li><p>Stop the workers</p></li><li><p>Take a snapshot</p></li></ul>"
  ) +
  tonedBlock("danger", "<p><strong>Caution:</strong> a deleted project cannot be restored.</p>") +
  wrapperBlock("<p>A wrapper without a tone keeps only the dashed frame in the editor.</p>") +
  "<p>Text after the wrappers.</p>";

/**
 * Wrapper tones: Note, Tip, Important, Warning, Caution, and a Wrapper without
 * a tone. A tone is a soft background and a 3 px stripe on the left, drawn from
 * the kit's status tokens: the same look the reader gets in `RichTextView`. The
 * Editor's dashed outline stays only on the Wrapper without a tone. In HTML it
 * is `data-tone` with the tone's name.
 */
export const WrapperTones: Story = {
  render: () => (
    <div className="max-w-[640px]">
      <RichTextEditor aria-label="Document" defaultValue={WRAPPER_TONES_SAMPLE} />
    </div>
  ),
};

/** Wrapper tones on a light `surface="paper"` sheet: the sheet's `--rte-tone-*` roles. */
export const WrapperTonesPaper: Story = {
  render: () => (
    <div className="max-w-[640px]">
      <RichTextEditor aria-label="Document" defaultValue={WRAPPER_TONES_SAMPLE} surface="paper" />
    </div>
  ),
};

/**
 * The "Tone ›" submenu of the Block handle in a Wrapper: "None" and the five
 * tones by name, with a sample of the background and the stripe. The current one
 * is checked, and its item name carries it too: "Tone: Warning". Choosing one is
 * one edit and one undo.
 */
export const WrapperToneMenu: Story = {
  render: () => (
    <ShownHandle
      caret="Back up the database before the upgrade."
      document={WRAPPER_TONES_SAMPLE}
      open
      submenu="Tone"
    />
  ),
};

/*
  Collapsible block (Details): a title and content made of Blocks.
  Neutral text: a build note with details under the title.
*/
const detailsBlock = (title: string, ...blocks: string[]) =>
  `<details><summary>${title}</summary><div data-type="detailsContent">${blocks.join("")}</div></details>`;
const openDetailsBlock = (title: string, ...blocks: string[]) =>
  `<details open=""><summary>${title}</summary><div data-type="detailsContent">${blocks.join("")}</div></details>`;

const DETAILS_SAMPLE =
  "<h2>Collapsible blocks</h2><p>A block keeps its details under a title. Click the arrow to open it.</p>" +
  detailsBlock(
    "How to build the package",
    "<p>Run the gates, then the build.</p>",
    "<ol><li><p>Install the dependencies</p></li><li><p>Run <code>npm run build</code></p></li></ol>"
  ) +
  detailsBlock(
    "Release checklist",
    "<ul><li><p>Write the changelog</p></li><li><p>Tag the release</p></li></ul>",
    detailsBlock("Rolling back", "<p>Revert the tag and publish the previous version.</p>")
  ) +
  "<p>Text after the blocks.</p>";

/**
 * Collapsible block: an arrow on the left expands and collapses the content;
 * the title and the Blocks inside are edited as ordinary text. Without the
 * `persist` option the open state lives only on screen and is not written into
 * the Document. Blocks nest in one another.
 */
export const Details: Story = {
  render: () => (
    <div className="max-w-[640px]">
      <RichTextEditor aria-label="Document" defaultValue={DETAILS_SAMPLE} />
    </div>
  ),
};

/**
 * `tool("details", { persist: true })`: an open Block is written into the
 * Document as `open` and comes back open from `value`. The first Block here is open.
 */
export const DetailsPersist: Story = {
  render: () => (
    <div className="max-w-[640px]">
      <RichTextEditor
        aria-label="Document"
        tools={[...TOOLS.filter((name) => name !== "details"), tool("details", { persist: true })]}
        defaultValue={
          "<h2>Persisted state</h2>" +
          openDetailsBlock("Open when saved", "<p>This block is saved open.</p>") +
          detailsBlock("Closed when saved", "<p>This one is saved closed.</p>")
        }
      />
    </div>
  ),
};

/** A collapsible block on a light `surface="paper"` sheet. */
export const DetailsPaper: Story = {
  render: () => (
    <div className="max-w-[640px]">
      <RichTextEditor aria-label="Document" defaultValue={DETAILS_SAMPLE} surface="paper" />
    </div>
  ),
};

function InsertedDetails() {
  const ref = useRef<RichTextEditorHandle>(null);
  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const editor = ref.current?.editor;
      if (!editor) {
        frame = requestAnimationFrame(tick);
        return;
      }
      editor.chain().focus("end").insertDetails().run();
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <div className="max-w-[640px]">
      <RichTextEditor
        ref={ref}
        aria-label="Document"
        defaultValue="<p>A new collapsible block goes below the current block.</p>"
      />
    </div>
  );
}

/**
 * A Collapsible block just inserted: an empty title with the caret, and an empty
 * paragraph in its content; the Block is expanded. This is how the "Collapsible
 * block" item of the Insert menu (`/collapsible` or "+") and the "Add › Collapsible
 * block" item of the handle place it.
 */
export const DetailsInserted: Story = {
  render: () => <InsertedDetails />,
};

/** The Slash menu by `/collapsible`: the "Collapsible block" item. */
export const DetailsInsertSlash: Story = {
  render: () => <TypedCommand command="/collapsible" />,
};

/**
 * The Block handle menu of a Collapsible block: the handle belongs to the whole
 * Block, and "Remove collapsing" leaves the title as a paragraph and the Blocks
 * in place, in one edit.
 */
export const DetailsBlockHandleMenu: Story = {
  render: () => (
    <ShownHandle
      caret="The caret is in this title."
      document={
        "<p>The handle of the title belongs to the whole block.</p>" +
        detailsBlock("The caret is in this title.", "<p>Hidden until the block is opened.</p>")
      }
      open
    />
  ),
};

/*
  Typography (OLDSUI-279): automatic replacements while typing; outside the
  Presets only with an explicit entry in `tools`. The stories do not type by
  themselves: the typing goes into the field, and the hint is in the text of the
  Document.
*/
const TYPOGRAPHY_SAMPLE =
  "<h2>Typography</h2>" +
  '<p>Type at the end of the next paragraph: <code>--</code>, <code>...</code>, <code>-&gt;</code>, <code>(c)</code>, <code>"quoted"</code> or <code>it\'s</code>. Backspace right after a replacement brings the typed characters back.</p>' +
  "<p>Try it here: </p>";

/**
 * Automatic replacements while typing, from the Typography extension of Tiptap:
 * `--` becomes a dash, `...` an ellipsis, `->` an arrow, and `"` a quotation
 * mark of the message catalog's language (English here: “ ”). Replacements do
 * not fire inside code.
 */
export const Typography: Story = {
  render: () => (
    <div className="max-w-[640px]">
      <RichTextEditor
        aria-label="Document"
        tools={[...RICH_TEXT_PRESETS.full, "typography"]}
        defaultValue={TYPOGRAPHY_SAMPLE}
      />
    </div>
  ),
};

/**
 * The message catalog is Russian: `"` gives guillemets «…», and a nested pair
 * gives „…“: `"a "b" c"` becomes «a „b“ c».
 */
export const TypographyRussian: Story = {
  render: () => (
    <UiProvider locale="ru-RU" messages={ru}>
      <div className="max-w-[640px]">
        <RichTextEditor
          aria-label="Document"
          tools={[...RICH_TEXT_PRESETS.full, "typography"]}
          defaultValue={TYPOGRAPHY_SAMPLE}
        />
      </div>
    </UiProvider>
  ),
};

/**
 * Options: the quote set is given explicitly (`ru` under the English interface),
 * the dash is off (`false`), and the ellipsis is replaced with its own string.
 */
export const TypographyOptions: Story = {
  render: () => (
    <div className="max-w-[640px]">
      <RichTextEditor
        aria-label="Document"
        tools={[
          ...RICH_TEXT_PRESETS.full,
          tool("typography", { quotes: "ru", emDash: false, ellipsis: "\u22EF" }),
        ]}
        defaultValue={TYPOGRAPHY_SAMPLE}
      />
    </div>
  ),
};

/*
  Formulas (Mathematics, OLDSUI-280, ADR-0070): LaTeX inline and as a Block,
  drawn by KaTeX. Outside the Presets only with an explicit entry in `tools`; the
  KaTeX chunk loads lazily, and until it arrives the formulas show as source.
  Neutral text: formulas from a school course.
*/
const MATH_SAMPLE =
  "<h2>Formulas</h2>" +
  '<p>The area of a circle is <span data-type="inline-math" data-latex="S = \\pi r^2"></span>, ' +
  'and Euler\'s identity is <span data-type="inline-math" data-latex="e^{i\\pi} + 1 = 0"></span>. ' +
  "Click a formula to edit it, or select it with the arrow keys and press Enter.</p>" +
  '<div data-type="block-math" data-latex="\\int_0^1 x^2\\,dx = \\frac{1}{3}"></div>' +
  "<p>The quadratic formula in a block:</p>" +
  '<div data-type="block-math" data-latex="x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}"></div>' +
  "<p>Text after the formulas.</p>";

const MATH_TOOLS = [...RICH_TEXT_PRESETS.full, "mathematics"] as const;

/**
 * LaTeX formulas with KaTeX: inline and block. A click on a formula, or Enter on
 * the selected one, opens the popover with the LaTeX field and a preview; new
 * ones are inserted from the Insert menu ("Formula" and "Block formula").
 */
export const Mathematics: Story = {
  // Lazy chunks (KaTeX, player, Island): the snapshot and the audit wait for the network to go quiet.
  tags: ["network-idle"],
  render: () => (
    <div className="max-w-[640px]">
      <RichTextEditor aria-label="Document" tools={MATH_TOOLS} defaultValue={MATH_SAMPLE} />
    </div>
  ),
};

/** Formulas on a light `surface="paper"` sheet. */
export const MathematicsPaper: Story = {
  // Lazy chunks (KaTeX, player, Island): the snapshot and the audit wait for the network to go quiet.
  tags: ["network-idle"],
  render: () => (
    <div className="max-w-[640px]">
      <RichTextEditor
        aria-label="Document"
        tools={MATH_TOOLS}
        defaultValue={MATH_SAMPLE}
        surface="paper"
      />
    </div>
  ),
};

/**
 * Options: `tool("mathematics", { macros })` sets your own KaTeX macros. `\RR`
 * below works only thanks to the macro; the same `tools` in `RichTextView`
 * renders it the same way.
 */
export const MathematicsMacros: Story = {
  // Lazy chunks (KaTeX, player, Island): the snapshot and the audit wait for the network to go quiet.
  tags: ["network-idle"],
  render: () => (
    <div className="max-w-[640px]">
      <RichTextEditor
        aria-label="Document"
        tools={[
          ...RICH_TEXT_PRESETS.full,
          tool("mathematics", { macros: { "\\RR": "\\mathbb{R}", "\\NN": "\\mathbb{N}" } }),
        ]}
        defaultValue={
          "<p>A custom macro: " +
          '<span data-type="inline-math" data-latex="f\\colon \\NN \\to \\RR"></span>.</p>'
        }
      />
    </div>
  ),
};

/**
 * A formula that KaTeX cannot read stays as source, underlined with the error
 * color wave. It does not break the Document and is not lost; it can be fixed
 * in the popover.
 */
export const MathematicsInvalid: Story = {
  // Lazy chunks (KaTeX, player, Island): the snapshot and the audit wait for the network to go quiet.
  tags: ["network-idle"],
  render: () => (
    <div className="max-w-[640px]">
      <RichTextEditor
        aria-label="Document"
        tools={MATH_TOOLS}
        defaultValue={
          '<p>A broken formula: <span data-type="inline-math" data-latex="\\frac{1"></span> stays visible.</p>' +
          '<div data-type="block-math" data-latex="\\badcommand{x}"></div>'
        }
      />
    </div>
  ),
};

/** Formulas in the Russian locale: the labels of the Insert menu and of the popover come from the catalog. */
export const MathematicsRussian: Story = {
  // Lazy chunks (KaTeX, player, Island): the snapshot and the audit wait for the network to go quiet.
  tags: ["network-idle"],
  render: () => (
    <UiProvider locale="ru-RU" messages={ru}>
      <div className="max-w-[640px]">
        <RichTextEditor aria-label="Document" tools={MATH_TOOLS} defaultValue={MATH_SAMPLE} />
      </div>
    </UiProvider>
  ),
};

function MathCommand({ command }: { command: string }) {
  const ref = useRef<RichTextEditorHandle>(null);
  useTypedCommand(ref, command);
  return (
    <div className="h-[520px] max-w-[640px]">
      <RichTextEditor
        ref={ref}
        aria-label="Document"
        tools={MATH_TOOLS}
        defaultValue={INSERT_SAMPLE}
      />
    </div>
  );
}

/** The Slash menu by `/formula`: the "Formula" and "Block formula" items (and by `latex`, `math`). */
export const MathematicsInsertSlash: Story = {
  // Lazy chunks (KaTeX, player, Island): the snapshot and the audit wait for the network to go quiet.
  tags: ["network-idle"],
  render: () => <MathCommand command="/formula" />,
};

/** Open the edit popover of the first formula as soon as the Editor has drawn it. */
function OpenedFormula() {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const target = root.current?.querySelector<HTMLElement>(
        ".tiptap-mathematics-render--editable"
      );
      if (!target) {
        frame = requestAnimationFrame(tick);
        return;
      }
      target.click();
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <div ref={root} className="h-[420px] max-w-[640px]">
      <RichTextEditor aria-label="Document" tools={MATH_TOOLS} defaultValue={MATH_SAMPLE} />
    </div>
  );
}

/**
 * The formula edit popover: the LaTeX field, a preview, and the "Apply" and
 * "Remove formula" buttons. Invalid LaTeX shows an error in the field and
 * blocks applying it.
 */
export const MathematicsPopover: Story = {
  // Lazy chunks (KaTeX, player, Island): the snapshot and the audit wait for the network to go quiet.
  tags: ["network-idle"],
  render: () => <OpenedFormula />,
};

/*
  Date mention (OLDSUI-309, ADR-0079): a date inside a line of text, `<time datetime>` with the words the
  author saw. In `full`, so no `tools` list is needed. The Calendar and the popover are a lazy chunk that
  loads when a mention is inserted or edited.
*/
const DATE_SAMPLE =
  "<h2>Project plan</h2>" +
  '<p>The kickoff is on <time datetime="2026-10-12">Oct 12, 2026</time>, the review meeting at ' +
  '<time datetime="2026-10-19T15:00+03:00">Oct 19, 2026, 3:00 PM</time>, and the release is planned for ' +
  '<time datetime="2026-11-02">Nov 02, 2026</time>. Click a date to change it, or select it with ' +
  "<kbd>Shift</kbd>+<kbd>→</kbd> and press Enter.</p>" +
  "<p>Text after the dates.</p>";

/**
 * A date mention: a rounded chip with the weak background and the ordinary font. A click on it, or Enter
 * on the selected one, opens the popover with the calendar; a new one is inserted from the Insert menu
 * ("Date"). The words are written in the author's locale and shown by `RichTextView` as they are.
 */
export const DateMention: Story = {
  render: () => (
    <div className="max-w-[640px]">
      <RichTextEditor aria-label="Document" defaultValue={DATE_SAMPLE} />
    </div>
  ),
};

/** Date mentions on a light `surface="paper"` sheet. */
export const DateMentionPaper: Story = {
  render: () => (
    <div className="max-w-[640px]">
      <RichTextEditor aria-label="Document" defaultValue={DATE_SAMPLE} surface="paper" />
    </div>
  ),
};

/** The Slash menu by `/date`: the "Date" item (and by `today`, `calendar`). Enter on it opens the calendar. */
export const DateMentionInsertSlash: Story = {
  render: () => <TypedCommand command="/date" />,
};

/**
 * Open the edit popover of the mention with a time as soon as the engine has drawn it. Before the
 * engine exists the field shows a Skeleton with the same `time` elements, and a click on those opens
 * nothing: the mention is looked for inside the Document (`editor.view.dom`), not in the whole story.
 */
function OpenedDate() {
  const ref = useRef<RichTextEditorHandle>(null);
  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const target =
        ref.current?.editor?.view.dom.querySelector<HTMLElement>("time[datetime*='T']");
      if (!target) {
        frame = requestAnimationFrame(tick);
        return;
      }
      target.click();
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <div className="h-[560px] max-w-[640px]">
      <RichTextEditor ref={ref} aria-label="Document" defaultValue={DATE_SAMPLE} />
    </div>
  );
}

/**
 * The edit popover of a mention with a time: the calendar on its day, the "Time" switch with the time
 * field, "Remove time" and "Delete date", and "Apply" for a changed time.
 */
export const DateMentionPopover: Story = {
  // The popover's chunk (the Calendar) is lazy: the snapshot and the audit wait for the network to go quiet.
  tags: ["network-idle"],
  render: () => <OpenedDate />,
};

/*
  A `<time>` from someone else's page. The forms the Editor writes itself (a date, a date with a time and
  an offset) become mentions with their words as they were; a period, a week, a year and a time without an
  offset stay ordinary text, and nothing is lost.
*/
const FOREIGN_TIME_HTML =
  '<p>From a news page: published <time datetime="2026-10-12">twelfth of October</time> and ' +
  '<time datetime="2026-10-12T09:30+02:00">9:30 CEST</time>.</p>' +
  '<p>These stay text: <time datetime="P3D">three days</time>, <time datetime="2026-W42">week 42</time>, ' +
  '<time datetime="2026-10-12T09:30">9:30 with no offset</time>.</p>';

function PastedTime() {
  const ref = useRef<RichTextEditorHandle>(null);
  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const editor = ref.current?.editor;
      if (!editor) {
        frame = requestAnimationFrame(tick);
        return;
      }
      editor.view.pasteHTML(FOREIGN_TIME_HTML);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <div className="max-w-[640px]">
      <RichTextEditor ref={ref} aria-label="Document" />
    </div>
  );
}

/** A `<time>` pasted from another page: a mention where `datetime` is in the Editor's form, text elsewhere. */
export const DateMentionPasted: Story = {
  render: () => <PastedTime />,
};

const DATE_FORMAT_SAMPLE =
  "<h2>Project plan</h2>" +
  '<p>Written before the option, as it was: <time datetime="2026-10-12">Oct 12, 2026</time>.</p>' +
  "<p>Inserted with the option:</p>";

/** Insert one mention at the end of the last paragraph, once the engine is created. */
function FormattedDate() {
  const ref = useRef<RichTextEditorHandle>(null);
  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const editor = ref.current?.editor;
      if (!editor) {
        frame = requestAnimationFrame(tick);
        return;
      }
      editor.chain().focus("end").insertContent(" ").run();
      ref.current?.tool("date")?.insert("2026-10-19");
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <div className="max-w-[640px]">
      <RichTextEditor
        ref={ref}
        aria-label="Document"
        tools={[...RICH_TEXT_PRESETS.full, tool("date", { format: { dateStyle: "long" } })]}
        defaultValue={DATE_FORMAT_SAMPLE}
      />
    </div>
  );
}

/**
 * The `format` option: `tool("date", { format: { dateStyle: "long" } })` writes new dates in the long
 * form. It applies to mentions made from now on, so the one in the Document already keeps the words it
 * was written with ("Oct 12, 2026"), and the one the story inserts reads "October 19, 2026".
 */
export const DateMentionFormat: Story = {
  render: () => <FormattedDate />,
};

/**
 * Date mentions in the Russian locale: the Insert menu and the popover come from the catalog, the
 * calendar is in Russian, and a date picked now is written as Russian text with a 24-hour clock.
 */
export const DateMentionRussian: Story = {
  // The popover's chunk (the Calendar) is lazy: the snapshot and the audit wait for the network to go quiet.
  tags: ["network-idle"],
  render: () => (
    <UiProvider locale="ru-RU" messages={ru}>
      <OpenedDate />
    </UiProvider>
  ),
};

/** Open the HTML mode as soon as the Toolbar appears: a click on the "HTML" button. */
function OpenedSource(props: Partial<RichTextEditorProps>) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const button = root.current?.querySelector<HTMLButtonElement>('button[aria-label="HTML"]');
      if (!button) {
        frame = requestAnimationFrame(tick);
        return;
      }
      button.click();
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <div ref={root} className="max-w-[640px]">
      <RichTextEditor aria-label="Document" defaultValue={SAMPLE} {...props} />
    </div>
  );
}

/**
 * HTML mode: the "HTML" button on the Toolbar, right after "+", replaces the
 * Document with a field holding its source HTML: one Block per line, nested
 * Blocks indented, and the content of a Block on the line of its tag. The field
 * has the surface and font of a code Block, is not shorter than the Document,
 * and grows with its content. The other Toolbar buttons are unavailable
 * (`aria-disabled`), and there is no Block handle or selection menu. Leaving the
 * mode with the same button, `blur`, form submission and `getHTML()` apply the
 * edit through the Schema, like an incoming `value`.
 */
export const SourceMode: Story = {
  render: () => <OpenedSource />,
};

/** HTML mode on a `surface="paper"` sheet: a light sheet, and a dark field in the kit's color. */
export const SourceModePaper: Story = {
  render: () => <OpenedSource surface="paper" />,
};

const SEARCH_SAMPLE =
  "<h2>Release notes</h2>" +
  "<p>The search panel finds every <strong>match</strong> in the document: a match in a " +
  "heading, a match in a list, a ma<em>tch</em> across marks.</p>" +
  "<ul><li><p>Next match: Enter</p></li><li><p>Previous match: Shift+Enter</p></li></ul>";

/**
 * The screen's status line, fed by the Search Tool state: "2 of 4" while the
 * panel is open. The hook reads the snapshot through the same `ref` that the
 * field receives.
 */
function SearchStatus({ target }: { target: RefObject<RichTextEditorHandle | null> }) {
  const search = useRichTextToolState(target, "search");
  const text = !search?.open
    ? "Search is closed"
    : search.error
      ? "Invalid regular expression"
      : search.total === 0
        ? "No matches"
        : `${search.current + 1} of ${search.total}`;
  return (
    <p role="status" className="text-fg-2 mt-2 text-[13px]">
      {text}
    </p>
  );
}

/** Open search on the first "match" once the engine is ready: that match becomes the current one. */
function OpenedSearch({
  status = false,
  ...props
}: Partial<RichTextEditorProps> & { status?: boolean }) {
  const ref = useRef<RichTextEditorHandle>(null);
  return (
    <div className="max-w-[640px]">
      <RichTextEditor
        ref={ref}
        aria-label="Document"
        defaultValue={SEARCH_SAMPLE}
        onReady={() => {
          const handle = ref.current;
          const editor = handle?.editor;
          if (!handle || !editor) return;
          let from = -1;
          editor.state.doc.descendants((node, pos) => {
            if (from !== -1 || !node.isText) return from === -1;
            const index = node.text!.indexOf("match");
            if (index !== -1) from = pos + index;
            return false;
          });
          editor.commands.setTextSelection({ from, to: from + "match".length });
          handle.tool("search")?.open();
        }}
        {...props}
      />
      {status && <SearchStatus target={ref} />}
    </div>
  );
}

/**
 * Find and replace: the "Find" button at the right edge of the Toolbar and
 * `Mod+F` open a panel under the Toolbar: the counter, next and previous, the
 * find and replace fields, "Match case", "Whole words", "Regular expression",
 * "Replace" and "Replace all". All matches are softly highlighted, and the
 * current one is stronger and framed; "ma*tch*" is found across a Mark's border.
 */
export const Search: Story = {
  render: () => <OpenedSearch />,
  // The search panel is a lazy chunk: the snapshot waits until it loads.
  tags: ["network-idle"],
};

/** Search in `basic`: the "Find" button is there in the short set too. */
export const SearchBasic: Story = {
  render: () => <OpenedSearch preset="basic" />,
  tags: ["network-idle"],
};

/**
 * The Search Tool state on the screen: the line under the field reads it with
 * the hook `useRichTextToolState(ref, "search")` and writes "1 of 4". Move
 * through the matches and change the query and the checkboxes: the line follows
 * the panel. Close the panel and the line says that search is closed.
 */
export const SearchStatusLine: Story = {
  render: () => <OpenedSearch status />,
  tags: ["network-idle"],
};

/*
  Invisible characters (OLDSUI-278): spaces, soft breaks (`Shift+Enter`) and
  paragraph ends. Neutral text: a note with a line break inside a paragraph, and
  an empty paragraph that is easy to overlook. A double space from HTML collapses
  when parsed, so it is typed by hand.
*/
const INVISIBLE_SAMPLE =
  "<h2>Invisible characters</h2>" +
  "<p>Spaces sit between these words, and a soft break<br>starts a new line inside one paragraph.</p>" +
  "<p></p>" +
  "<p>The empty paragraph above is easy to miss. Type a second space here to see it.</p>";

/**
 * Invisible characters: the "Invisible characters" checkbox item in the Toolbar's
 * "…" menu (the last section); there is no separate button, and the Toolbar in a
 * 640 px column stays in one row. By default the characters are hidden, as in any
 * Editor with the `full` preset. Tick the item, and spaces (·), soft breaks (↵)
 * and paragraph ends (¶) become visible. The Document does not change: the marks
 * are only drawn over the text.
 */
export const InvisibleCharacters: Story = {
  render: () => (
    <div className="max-w-[640px]">
      <RichTextEditor aria-label="Document" defaultValue={INVISIBLE_SAMPLE} />
    </div>
  ),
};

/** `tool("invisibleCharacters", { visible: true })`: the marks are shown from the start. */
export const InvisibleCharactersShown: Story = {
  render: () => (
    <div className="max-w-[640px]">
      <RichTextEditor
        aria-label="Document"
        tools={[...RICH_TEXT_PRESETS.full, tool("invisibleCharacters", { visible: true })]}
        defaultValue={INVISIBLE_SAMPLE}
      />
    </div>
  ),
};

/** Showing the marks on a light `surface="paper"` sheet. */
export const InvisibleCharactersPaper: Story = {
  render: () => (
    <div className="max-w-[640px]">
      <RichTextEditor
        aria-label="Document"
        surface="paper"
        tools={[...RICH_TEXT_PRESETS.full, tool("invisibleCharacters", { visible: true })]}
        defaultValue={INVISIBLE_SAMPLE}
      />
    </div>
  ),
};

function WithInvisibleToggle() {
  const ref = useRef<RichTextEditorHandle>(null);
  const [changes, setChanges] = useState(0);
  const visible = useRichTextToolState(ref, "invisibleCharacters", (state) => state.visible);
  return (
    <div className="flex max-w-[640px] flex-col gap-3">
      <div className="flex items-center gap-3">
        <Button
          size="sm"
          variant="soft"
          selected={visible === true}
          onClick={() => ref.current?.tool("invisibleCharacters")?.toggle()}
        >
          {visible ? "Hide invisible characters" : "Show invisible characters"}
        </Button>
        <span className="text-sm">
          <output aria-label="Change count">{changes}</output> changes reported
        </span>
      </div>
      <RichTextEditor
        ref={ref}
        aria-label="Document"
        defaultValue={INVISIBLE_SAMPLE}
        onChange={() => setChanges((count) => count + 1)}
      />
      <pre
        aria-label="Saved HTML"
        className="bg-bg-2 text-fg-2 overflow-x-auto rounded p-2 text-xs whitespace-pre-wrap"
      >
        {/* Read on every render: toggling redraws it through the Tool state. */}
        {ref.current?.getHTML() ?? ""}
      </pre>
    </div>
  );
}

/**
 * Showing from an external button: `handle.tool("invisibleCharacters")?.toggle()`
 * and `useRichTextToolState(ref, "invisibleCharacters")` instead of the "…" menu
 * item. Below the field are the saved HTML and the `onChange` counter; showing
 * does not touch them.
 */
export const InvisibleCharactersExternalToggle: Story = {
  render: () => <WithInvisibleToggle />,
};

/*
  Buttons of a custom Tool on neutral data: an action with a shortcut, a toggle
  Mark with the selection-menu flag, and a button with a popover. The label is a
  function of the locale, so the Russian story is translated by itself.
*/
/*
  The Russian labels are data of the Tool's author, not the kit's strings, and
  the catalog does not own them (ADR-0058, item 6.2). They are written as escape
  sequences: the i18n gate looks for Russian literals in components and stories,
  and here they are deliberate.
*/
const RU_LABELS = {
  stamp: "\u0428\u0442\u0430\u043c\u043f",
  pin: "\u0417\u0430\u043a\u0440\u0435\u043f\u0438\u0442\u044c",
  symbol: "\u0421\u0438\u043c\u0432\u043e\u043b",
} as const;

const PinMark = Mark.create({ name: "acme_pin" });

const SYMBOLS = ["★", "✓", "→"] as const;

/** The content of the example popovers: three symbols; selecting one calls `onPick`. */
function SymbolChoices({ onPick }: { onPick: (symbol: string) => void }) {
  return (
    <div role="group" aria-label="Symbols" className="flex gap-1">
      {SYMBOLS.map((symbol) => (
        <Button key={symbol} size="sm" variant="ghost" onClick={() => onPick(symbol)}>
          {symbol}
        </Button>
      ))}
    </div>
  );
}

const CUSTOM_BUTTON_TOOLS: readonly CustomTool[] = [
  {
    name: "acme_stamp",
    engine: [],
    buttons: [
      {
        id: "stamp",
        label: ({ locale }) => (locale.startsWith("ru") ? RU_LABELS.stamp : "Stamp"),
        icon: SparkleIcon,
        can: (editor) => editor.state.selection.$to.parent.inlineContent,
        run: (editor) => void editor.chain().focus().insertContent("★").run(),
        shortcut: ["mod", "shift", "Y"],
      },
    ],
  },
  {
    name: "acme_pin",
    engine: [PinMark],
    marks: { acme_pin: {} },
    buttons: [
      {
        id: "pin",
        label: ({ locale }) => (locale.startsWith("ru") ? RU_LABELS.pin : "Pin"),
        icon: PinIcon,
        can: (editor) => editor.can().toggleMark("acme_pin"),
        isActive: (editor) => editor.isActive("acme_pin"),
        run: (editor) => void editor.chain().focus().toggleMark("acme_pin").run(),
        selectionMenu: true,
        shortcut: ["mod", "alt", "P"],
      },
    ],
  },
  {
    name: "acme_symbols",
    engine: [],
    buttons: [
      {
        id: "symbols",
        label: ({ locale }) => (locale.startsWith("ru") ? RU_LABELS.symbol : "Symbol"),
        icon: TagIcon,
        can: (editor) => editor.state.selection.$to.parent.inlineContent,
        shortcut: ["mod", "shift", "J"],
        popover: ({ editor, close }) => (
          <SymbolChoices
            onPick={(symbol) => {
              editor.chain().insertContent(symbol).run();
              close();
            }}
          />
        ),
      },
    ],
  },
];

const CUSTOM_BUTTON_SAMPLE =
  "<h2>Own buttons</h2><p>The Stamp, Pin and Symbol buttons stand in one group " +
  "before Undo and Redo. Pin also shows in the selection menu.</p>";

/**
 * Buttons of a custom Tool: one group on the Toolbar, before "Undo" and "Redo",
 * in the order of `tools`. "Stamp" is an action with the `Ctrl/⌘+Shift+Y`
 * shortcut, "Pin" is a toggle with `aria-pressed` and a place in the selection
 * menu, and "Symbol" is a popover with the Tool's content. The hint names the
 * shortcut, and the keyboard shortcuts popover gives them a group with no heading
 * after the kit's groups.
 */
export const CustomToolButtons: Story = {
  args: {
    defaultValue: CUSTOM_BUTTON_SAMPLE,
    tools: [...RICH_TEXT_PRESETS.full, ...CUSTOM_BUTTON_TOOLS],
  },
};

/** The popover of the custom button is open: the frame, the layer and the focus return are the kit's. */
export const CustomToolButtonPopover: Story = {
  render: () => <CustomButtonOpen />,
};

/** Russian locale: the label functions receive `locale: "ru-RU"` and translate the buttons. */
export const CustomToolButtonsRussian: Story = {
  render: () => (
    <UiProvider locale="ru-RU" messages={ru}>
      <div className="max-w-[640px]">
        <RichTextEditor
          aria-label="Document"
          defaultValue={CUSTOM_BUTTON_SAMPLE}
          tools={[...RICH_TEXT_PRESETS.full, ...CUSTOM_BUTTON_TOOLS]}
        />
      </div>
    </UiProvider>
  ),
};

function CustomButtonOpen() {
  const host = useRef<HTMLDivElement>(null);
  useOpenEmoji(host, "Symbol");
  return (
    <div ref={host} className="h-[320px] max-w-[640px]">
      <RichTextEditor
        aria-label="Document"
        defaultValue={CUSTOM_BUTTON_SAMPLE}
        tools={[...RICH_TEXT_PRESETS.full, ...CUSTOM_BUTTON_TOOLS]}
      />
    </div>
  );
}

/*
  A custom Tool with an insert item and a Block action on neutral data: a
  container note. The item's label is a function of `{ locale }`, so in the
  Russian locale it is different.
*/
const Callout = Node.create({ name: "acme_callout", content: "block+", isolating: true });

const calloutTool: CustomTool = {
  name: "acme_callout",
  engine: [Callout],
  blocks: { acme_callout: { kind: "block", container: true } },
  insertItems: [
    {
      section: "insert",
      label: ({ locale }) => `Callout (${locale})`,
      icon: WrapperIcon,
      aliases: ["note", "tip"],
      shortcut: ["mod", "alt", "N"],
      run: (chain) =>
        chain.insertContent({ type: "acme_callout", content: [{ type: "paragraph" }] }),
    },
  ],
  blockActions: [
    {
      label: "Unwrap callout",
      icon: WrapperIcon,
      blocks: ["acme_callout"],
      run: (editor, pos) =>
        void editor
          .chain()
          .focus()
          .command(({ tr }) => {
            // The position is the handle's Block: the note itself, or a Block right inside it.
            const $pos = tr.doc.resolve(pos);
            const from = $pos.parent.type.name === "acme_callout" ? $pos.before($pos.depth) : pos;
            const callout = tr.doc.nodeAt(from);
            if (callout?.type.name === "acme_callout") {
              tr.replaceWith(from, from + callout.nodeSize, callout.content);
            }
            return true;
          })
          .run(),
    },
  ],
};

const CALLOUT_SAMPLE =
  "<p>Type / and pick Callout, or open the block menu of the note below.</p>" +
  '<div data-block="acme_callout"><p>The block menu of this note has its own Unwrap action.</p></div>';

/**
 * A custom insert item (in the "/" menu, the "+" button, and "Add ›", which
 * stand at the end of the "Add" section) and a custom Block action (in the handle
 * menu's section before "Delete", visible on the note and on a Block inside it).
 * Shortcuts are a recording field: `⌘⌥N` inserts the note, and the hint and the
 * keyboard shortcuts popover show them.
 */
export const CustomInsertItemAndBlockAction: Story = {
  args: { tools: [...RICH_TEXT_PRESETS.full, calloutTool], defaultValue: CALLOUT_SAMPLE },
};

/** The same in the Russian locale: the item's label receives `locale`, and the catalog is Russian. */
export const CustomInsertItemAndBlockActionRussian: Story = {
  args: { tools: [...RICH_TEXT_PRESETS.full, calloutTool], defaultValue: CALLOUT_SAMPLE },
  render: (args) => (
    <UiProvider locale="ru-RU" messages={ru}>
      <div className="max-w-[640px]">
        <RichTextEditor {...args} />
      </div>
    </UiProvider>
  ),
};

/*
  An insert item and a Block action with a popover (ADR-0058, item 5.6) on
  neutral data: choosing a symbol. The kit draws the frame, as for a button; the
  item's popover stands at the caret (from "/", where the "/" was), and the
  action's popover stands at the Block.
*/
const symbolEntriesTool: CustomTool = {
  name: "acme_symbolEntries",
  engine: [],
  insertItems: [
    {
      section: "insert",
      label: "Symbol",
      icon: TagIcon,
      aliases: ["sym", "char"],
      popover: ({ editor, close }) => (
        <SymbolChoices
          onPick={(symbol) => {
            editor.chain().insertContent(symbol).run();
            close();
          }}
        />
      ),
    },
  ],
  blockActions: [
    {
      label: "Append symbol",
      icon: TagIcon,
      blocks: ["paragraph", "heading"],
      // `pos` is the handle's Block: the symbol goes at the end of its text.
      popover: ({ editor, close, pos }) => (
        <SymbolChoices
          onPick={(symbol) => {
            const block = editor.state.doc.nodeAt(pos);
            if (block)
              editor
                .chain()
                .insertContentAt(pos + block.nodeSize - 1, symbol)
                .run();
            close();
          }}
        />
      ),
    },
  ],
};

const SYMBOL_ENTRIES_SAMPLE =
  "<h2>Popovers of menus</h2><p>Type / and pick Symbol: the picker opens where the slash was.</p>" +
  "<p>Append symbol in the block menu of this paragraph opens its picker at the block.</p>";

/**
 * The popover of an insert item and of a Block action: "Symbol" in "/", "+" and
 * "Add ›" opens the picker at the caret, and "Append symbol" in the handle menu
 * opens it at the Block. Escape closes the popover and returns the caret to the
 * text.
 */
export const CustomEntryPopovers: Story = {
  args: {
    tools: [...RICH_TEXT_PRESETS.full, symbolEntriesTool],
    defaultValue: SYMBOL_ENTRIES_SAMPLE,
  },
};

/*
  A custom Tool with a loader on neutral data: a container aside whose
  Extensions arrive as a promise. The buttons of the story settle the promise,
  so the Skeleton stays on screen as long as needed and the snapshot is
  deterministic. "Retry" calls the loader again: the buttons settle the new promise.
*/
const Aside = Node.create({ name: "acme_aside", content: "block+", isolating: true });
let settleAside: (fail: boolean) => void = () => {};

const asideTool: CustomTool = {
  name: "acme_aside",
  engine: () =>
    new Promise((resolve, reject) => {
      settleAside = (fail) => (fail ? reject(new Error("offline")) : resolve([Aside]));
    }),
  blocks: { acme_aside: { kind: "block", container: true } },
};

const ASIDE_SAMPLE =
  "<h2>Loading a tool</h2>" +
  "<p>Until the Extensions of every tool have loaded, the field shows the Skeleton: " +
  "the frame and this document as static HTML, without input.</p>" +
  '<div data-block="acme_aside"><p>An aside: its block comes from a lazily loaded tool.</p></div>' +
  "<ul><li><p>The height of the field does not jump.</p></li></ul>";

function ToolLoaderStory(args: RichTextEditorProps) {
  return (
    <div className="flex max-w-[640px] flex-col gap-3">
      <div className="flex gap-2">
        <Button size="sm" onClick={() => settleAside(false)}>
          Finish loading
        </Button>
        <Button size="sm" variant="outline" onClick={() => settleAside(true)}>
          Fail loading
        </Button>
      </div>
      <div data-story-field>
        <RichTextEditor {...args} />
      </div>
    </div>
  );
}

/**
 * The Skeleton before Readiness: the field's frame, a place for the Toolbar, and
 * the Document as static HTML with the rhythm of the View, without input. The
 * Document is cleaned by the Schema: an aside whose loader has not finished yet
 * shows as text. "Finish loading" settles the loader, and the engine takes the
 * Skeleton's place without a height jump; "Fail loading" shows a field error with
 * "Retry", and the Document stays visible.
 */
export const ToolLoader: Story = {
  args: { tools: [...RICH_TEXT_PRESETS.full, asideTool], defaultValue: ASIDE_SAMPLE },
  render: (args) => <ToolLoaderStory {...args} />,
};

/*
  Text card (ADR-0058, items 7.6–7.11) on neutral data: comments on the text.
  The `acme_comment` Mark and its Text card are the consumer's Tool; the range is
  given by the kit's ready-made helper `markRange`, while the frame, the anchor
  under the range, the flip at the edge and Escape are the kit's.
*/
const CommentMark = Mark.create({ name: "acme_comment" });

/* The Russian label is data of the Tool's author; it is escape-encoded because of the i18n gate, as above. */
const RU_COMMENT = "\u041a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0439";

const commentTool: CustomTool = {
  name: "acme_comment",
  engine: [CommentMark],
  marks: { acme_comment: {} },
  textCards: [
    {
      label: ({ locale }) => (locale.startsWith("ru") ? RU_COMMENT : "Comment"),
      rangeAt: markRange("acme_comment"),
      render: ({ editor, range, close }) => (
        <div className="flex max-w-xs flex-col gap-2 text-sm">
          <p className="text-fg-1">
            “{editor.state.doc.textBetween(range.from, range.to)}” needs a second look before the
            release.
          </p>
          <div className="flex justify-end">
            <Button size="sm" variant="ghost" onClick={close}>
              Resolve
            </Button>
          </div>
        </div>
      ),
    },
  ],
};

const COMMENT_SAMPLE =
  "<p>The release plan is ready for review. " +
  '<span data-mark="acme_comment">Ship the migration before the freeze</span> ' +
  "so the team can test it early.</p>" +
  '<p>Open questions: <span data-mark="acme_comment">who owns the rollback</span>?</p>';

/** Put the caret in the first comment Mark as soon as the engine appears: the story shows the Text card open. */
function useCaretInComment(ref: RefObject<RichTextEditorHandle | null>) {
  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const editor = ref.current?.editor;
      if (!editor) {
        frame = requestAnimationFrame(tick);
        return;
      }
      let at = 0;
      editor.state.doc.descendants((node, pos) => {
        if (!at && node.isText && node.marks.some((mark) => mark.type.name === "acme_comment")) {
          at = pos + 3;
        }
      });
      editor.chain().focus().setTextSelection(at).run();
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [ref]);
}

function CommentOpen({ locale }: { locale?: "ru-RU" }) {
  const ref = useRef<RichTextEditorHandle>(null);
  useCaretInComment(ref);
  const field = (
    <div className="h-[360px] max-w-[640px]">
      <RichTextEditor
        ref={ref}
        aria-label="Document"
        defaultValue={COMMENT_SAMPLE}
        tools={[...RICH_TEXT_PRESETS.full, commentTool]}
      />
    </div>
  );
  return locale ? (
    <UiProvider locale={locale} messages={ru}>
      {field}
    </UiProvider>
  ) : (
    field
  );
}

/**
 * Text card: the caret inside a comment, or a click on it, opens the Text card
 * under the range; hovering does not. Focus stays in the Document and typing
 * goes on; `Alt+F10` moves into the Text card, and Escape returns the caret and
 * hides the card until the caret leaves the range. An expanded selection closes
 * the Text card.
 */
export const TextCard: Story = {
  args: { defaultValue: COMMENT_SAMPLE, tools: [...RICH_TEXT_PRESETS.full, commentTool] },
};

/**
 * The Text card is open: for the eye, snapshots and axe. The frame, the layer
 * and the accessible name are the kit's. The Text card is a lazy chunk, and its
 * loading starts only after the engine is ready; the `network-idle` tag tells the
 * snapshot and the audit to wait for the network to go quiet, otherwise they
 * catch the field without the Text card.
 */
export const TextCardOpen: Story = {
  tags: ["network-idle"],
  render: () => <CommentOpen />,
};

/** Russian locale: the entry's label is a function of `{ locale }`; the frame's name and the appearance phrase come from the catalog. */
export const TextCardRussian: Story = {
  tags: ["network-idle"],
  render: () => <CommentOpen locale="ru-RU" />,
};

/** `readOnly`: the Text cards work, so the comments can be read without editing the text. */
export const TextCardReadOnly: Story = {
  args: {
    defaultValue: COMMENT_SAMPLE,
    readOnly: true,
    tools: [...RICH_TEXT_PRESETS.full, commentTool],
  },
};

/**
 * A field near the bottom edge of the window (scroll down): the last comment sits
 * where there is no room under its range, and the Text card flips above it.
 */
export const TextCardNearEdge: Story = {
  render: () => (
    <div className="max-w-[640px] pt-[120vh]">
      <RichTextEditor
        aria-label="Document"
        defaultValue={COMMENT_SAMPLE}
        tools={[...RICH_TEXT_PRESETS.full, commentTool]}
      />
    </div>
  ),
};

/*
  A custom trigger symbol (ADR-0064) on neutral data: mentions by `@`. The Tool
  describes the symbol, the items by query, and what choosing does (it replaces
  `@query` with an atom); the list is the same kit component as the one for "/".
*/
const MENTION_PEOPLE = [
  { id: "ada", name: "Ada Lovelace" },
  { id: "alan", name: "Alan Turing" },
  { id: "grace", name: "Grace Hopper" },
  { id: "margaret", name: "Margaret Hamilton" },
];
const mentionName = (id: unknown) =>
  MENTION_PEOPLE.find((person) => person.id === id)?.name ?? String(id ?? "");

const MentionAtom = Node.create({
  name: "acme_mention",
  atom: true,
  selectable: true,
  addAttributes: () => ({ acme_id: { default: null } }),
  renderText: ({ node }) => `@${mentionName(node.attrs.acme_id)}`,
  addNodeView:
    () =>
    ({ node }) => {
      const dom = document.createElement("span");
      dom.className = "rounded-sm bg-accent-soft px-1 text-accent-strong";
      dom.textContent = `@${mentionName(node.attrs.acme_id)}`;
      return { dom };
    },
});

const mentionTool: CustomTool = {
  name: "acme_mention",
  engine: [MentionAtom],
  blocks: {
    acme_mention: {
      kind: "inline",
      attributes: { acme_id: { kind: "list", values: MENTION_PEOPLE.map((person) => person.id) } },
    },
  },
  trigger: {
    char: "@",
    label: "People",
    items: (query) =>
      MENTION_PEOPLE.filter((person) =>
        person.name.toLowerCase().includes(query.toLowerCase())
      ).map((person) => ({ id: person.id, label: person.name, icon: MentionIcon })),
    onSelect: (item, { editor, range }) =>
      void editor
        .chain()
        .focus()
        .insertContentAt(range, [
          { type: "acme_mention", attrs: { acme_id: item.id } },
          { type: "text", text: " " },
        ])
        .run(),
  },
};

const MENTION_SAMPLE =
  '<p>Thanks <span data-block="acme_mention" data-acme_id="grace"></span> for the review.</p>' +
  "<p>Type @ to mention a teammate; mail@example.com inside a word stays text.</p><p></p>";

function MentionTriggerStory({ command }: { command: string }) {
  const ref = useRef<RichTextEditorHandle>(null);
  useTypedCommand(ref, command);
  return (
    <div className="h-[420px] max-w-[640px]">
      <RichTextEditor
        ref={ref}
        aria-label="Document"
        tools={[...RICH_TEXT_PRESETS.basic, mentionTool]}
        defaultValue={MENTION_SAMPLE}
      />
    </div>
  );
}

/**
 * A custom trigger symbol: typing `@` at the start of a Block or after a space
 * opens the list of people at the caret, the same one as for "/", with focus in
 * the field. The query after `@` filters the list, the arrows and Enter select,
 * and Escape closes it and keeps what was typed. Choosing an item replaces
 * `@query` with a mention atom. Inside a word (`mail@example.com`) the list
 * stays silent.
 */
export const MentionTrigger: Story = {
  render: () => <MentionTriggerStory command="@" />,
};

/** An empty field: the keyboard checks in the browser type the `@` themselves. */
export const MentionTriggerIdle: Story = {
  render: () => <MentionTriggerStory command="" />,
};

/** What is typed after `@` filters the items, which the Tool's `items(query)` returns. */
export const MentionTriggerFiltered: Story = {
  render: () => <MentionTriggerStory command="@gr" />,
};

/** Nothing found: the "Nothing found" line, as for "/". */
export const MentionTriggerNothingFound: Story = {
  render: () => <MentionTriggerStory command="@zzz" />,
};

/* ── Table of contents: the `toc` Tool (ADR-0068) ──────────────────── */

const tocSection = (topic: string) =>
  `<p>This section describes ${topic}. It has enough text to give the field some height, ` +
  "so that the strip and the headings it points to do not all fit on one screen.</p>";

const TOC_ARTICLE =
  "<h1>Palette</h1>" +
  tocSection("the palette as a whole") +
  "<h2>How to read</h2>" +
  tocSection("how a color goes from a primitive to a class") +
  "<h2>Layer 1 — primitives</h2>" +
  tocSection("the primitives") +
  "<h3>Neutrals</h3>" +
  tocSection("the neutral scales") +
  "<h3>Tones</h3>" +
  tocSection("the tone scales") +
  "<h2>Layer 2 — roles by theme</h2>" +
  tocSection("the roles") +
  "<h3>Surfaces</h3>" +
  tocSection("the surfaces") +
  "<h2>What's next</h2>" +
  tocSection("what comes next");

const TOC_TOOLS = [...RICH_TEXT_PRESETS.full, "toc"] as const;

/**
 * The Table of contents in the Editor's left margin: the `toc` Tool is switched
 * on by name; it is not in the presets. The strip sticks below the Toolbar;
 * hovering expands the list, and a click puts the caret at the end of a heading.
 * Add or remove a heading and the list rebuilds; the left margin goes away too
 * with the last heading of a pair.
 */
export const TableOfContents: Story = {
  args: { tools: [...TOC_TOOLS], defaultValue: TOC_ARTICLE },
  // The Table of contents core is a lazy chunk: the snapshot waits until the strip arrives.
  tags: ["network-idle"],
};

/** `readOnly`: there is no Toolbar, the strip sticks to the window edge, and a jump puts focus on the heading. */
export const TableOfContentsReadOnly: Story = {
  args: { tools: [...TOC_TOOLS], defaultValue: TOC_ARTICLE, readOnly: true },
  // The Table of contents core is a lazy chunk: the snapshot waits until the strip arrives.
  tags: ["network-idle"],
};

/**
 * A field with `maxHeight`: the Document scrolls inside the Editor, the strip
 * sticks to the top of the area, and the highlight and the jump are computed
 * from it.
 */
export const TableOfContentsScrollingField: Story = {
  args: { tools: [...TOC_TOOLS], defaultValue: TOC_ARTICLE, maxHeight: 360 },
  // The Table of contents core is a lazy chunk: the snapshot waits until the strip arrives.
  tags: ["network-idle"],
};

/** The light Paper: the Table of contents stands in the Editor's field to the left of the Paper, in the app theme. */
export const TableOfContentsPaper: Story = {
  args: { tools: [...TOC_TOOLS], defaultValue: TOC_ARTICLE, surface: "paper" },
  // The Table of contents core is a lazy chunk: the snapshot waits until the strip arrives.
  tags: ["network-idle"],
};

/** Floating Toolbar: nothing sticks above the field, and the strip sticks to the window edge. */
export const TableOfContentsFloatingToolbar: Story = {
  args: { tools: [...TOC_TOOLS], defaultValue: TOC_ARTICLE, toolbar: "floating" },
  // The Table of contents core is a lazy chunk: the snapshot waits until the strip arrives.
  tags: ["network-idle"],
};

/**
 * The Table of contents configured by a `tool("toc", …)` entry: only the H2–H3
 * levels, and the screen header, whose height is in its own variable
 * `--header-h`, not in `--topbar-h`. The entry switches the Tool on by itself;
 * the name `"toc"` is not needed in `tools`. Scroll the page and click a list
 * item: the heading goes under the header, and H1 and H4 are not in the strip
 * or the list.
 */
export const TableOfContentsOptions: Story = {
  args: {
    tools: [...RICH_TEXT_PRESETS.full, tool("toc", { offsetVar: "--header-h", levels: [2, 3] })],
    defaultValue: TOC_ARTICLE,
    toolbar: "floating",
  },
  render: (args) => <WithAppHeader {...args} />,
  // The Table of contents core is a lazy chunk: the snapshot waits until the strip arrives.
  tags: ["network-idle"],
};

function WithAppHeader(props: RichTextEditorProps) {
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--header-h", "56px");
    return () => {
      root.style.removeProperty("--header-h");
    };
  }, []);
  return (
    <div>
      <div className="border-line-soft bg-bg-1 text-fg-2 sticky top-0 z-10 -mx-4 -mt-4 mb-4 flex h-14 items-center border-b px-4 text-[13px] font-semibold">
        Application header
      </div>
      <RichTextEditor aria-label="Body" {...props} />
    </div>
  );
}

/*
  External navigation from the Table of contents Tool state: the list of
  headings and the current section are read by the hook
  `useRichTextToolState(ref, "toc")`, not from the Document's DOM.
*/
function ReadingPosition({ target }: { target: RefObject<RichTextEditorHandle | null> }) {
  const toc = useRichTextToolState(target, "toc");
  if (!toc) return null;
  return (
    <nav
      aria-label="Reading position"
      className="border-line-soft sticky top-4 hidden w-56 shrink-0 self-start border-l pl-3 text-[13px] md:block"
    >
      <ul className="space-y-1">
        {toc.headings.map((heading) => (
          <li
            key={heading.index}
            aria-current={heading.index === toc.current ? "location" : undefined}
            className={
              heading.index === toc.current ? "text-fg-0 font-semibold" : "text-fg-2 font-normal"
            }
            style={{ paddingLeft: (heading.level - 1) * 12 }}
          >
            {heading.text}
          </li>
        ))}
      </ul>
    </nav>
  );
}

function WithReadingPosition(props: RichTextEditorProps) {
  const ref = useRef<RichTextEditorHandle>(null);
  return (
    <div className="flex items-start gap-6">
      <div className="max-w-[640px] min-w-0 flex-1">
        <RichTextEditor ref={ref} aria-label="Body" {...props} />
      </div>
      <ReadingPosition target={ref} />
    </div>
  );
}

/**
 * The Table of contents Tool state on the screen: to the right of the field, an
 * external navigation built from the headings via `useRichTextToolState(ref, "toc")`;
 * the current section follows the scroll. Edit the headings: the list changes at
 * once, without waiting for the lazy Table of contents core.
 */
export const TableOfContentsExternalNavigation: Story = {
  args: { tools: [...TOC_TOOLS], defaultValue: TOC_ARTICLE },
  render: (args) => <WithReadingPosition {...args} />,
  // The Table of contents core is a lazy chunk: the snapshot waits until the strip arrives.
  tags: ["network-idle"],
};

/**
 * Tool commands from the screen's code: the header buttons call
 * `handle.tool("search")` and `handle.tool("toc")`, not the Editor's internals.
 * "Find “tone”" opens the Search panel at once with the query, "Next match" goes
 * to the next match, and "Go to “How to read”" jumps through the Table of contents
 * list: the heading goes under the screen header and under the fixed Toolbar, as
 * on a click of a list item. The list has only H2–H3 (`levels`), so index 0 is
 * "How to read".
 */
export const ToolCommands: Story = {
  args: {
    tools: [...RICH_TEXT_PRESETS.full, tool("toc", { offsetVar: "--header-h", levels: [2, 3] })],
    defaultValue: TOC_ARTICLE,
  },
  render: (args) => <WithToolCommands {...args} />,
  // The search panel is a lazy chunk.
  tags: ["network-idle"],
};

function WithToolCommands(props: RichTextEditorProps) {
  const ref = useRef<RichTextEditorHandle>(null);
  useEffect(() => {
    // The screen header and the Editor's Toolbar stick one under the other: both read the header height.
    const root = document.documentElement;
    root.style.setProperty("--header-h", "56px");
    root.style.setProperty("--topbar-h", "56px");
    return () => {
      root.style.removeProperty("--header-h");
      root.style.removeProperty("--topbar-h");
    };
  }, []);
  return (
    <div>
      <div className="border-line-soft bg-bg-1 sticky top-0 z-10 -mx-4 -mt-4 mb-4 flex h-14 items-center gap-2 border-b px-4">
        <Button
          size="sm"
          variant="soft"
          onClick={() => ref.current?.tool("search")?.open({ query: "tone" })}
        >
          Find “tone”
        </Button>
        <Button size="sm" variant="soft" onClick={() => ref.current?.tool("search")?.next()}>
          Next match
        </Button>
        <Button size="sm" variant="soft" onClick={() => ref.current?.tool("toc")?.jumpTo(0)}>
          Go to “How to read”
        </Button>
      </div>
      <RichTextEditor ref={ref} aria-label="Body" {...props} />
    </div>
  );
}

/* ── A custom Tool with options: defineTool ───────── */

/*
  A margin note on neutral data: a Tool with labels and a limit in its Options,
  a Tool state ("how many notes") and a Tool command ("add"). The author adds it
  to the `RichTextTools` map, and the hook with `handle.tool()` gets the types.
*/
declare module "@olddevs/ui/editor" {
  interface RichTextTools {
    acme_remark: {
      options: { labels: { insert: string }; limit: number };
      state: { count: number; limit: number };
      commands: { add(text: string): boolean };
    };
  }
}

const Remark = Node.create({ name: "acme_remark", content: "inline*" });

const countRemarks = (editor: Editor) => {
  let count = 0;
  editor.state.doc.descendants((node) => {
    if (node.type.name === "acme_remark") count += 1;
  });
  return count;
};

const remarkTool = defineTool({
  name: "acme_remark",
  defaults: { labels: { insert: "Remark" }, limit: 3 },
  create: (options) => ({
    engine: [Remark],
    blocks: { acme_remark: { kind: "block" } },
    insertItems: [
      {
        section: "insert",
        label: options.labels.insert,
        icon: PinIcon,
        aliases: ["note"],
        run: (chain) => chain.insertContent({ type: "acme_remark" }),
      },
    ],
    buttons: [
      {
        id: "remark",
        label: options.labels.insert,
        icon: PinIcon,
        can: (editor) => countRemarks(editor) < options.limit,
        run: (editor) => void editor.chain().focus().insertContent({ type: "acme_remark" }).run(),
      },
    ],
  }),
  state: ({ editor, options }) => ({ count: countRemarks(editor), limit: options.limit }),
  commands: ({ editor, options }) => ({
    add: (text: string) =>
      countRemarks(editor) < options.limit &&
      editor
        .chain()
        .focus("end")
        .insertContent({ type: "acme_remark", content: [{ type: "text", text }] })
        .run(),
  }),
});

const REMARK_SAMPLE =
  "<p>Remarks are the paragraphs below; the status line counts them using the Tool state.</p>" +
  '<div data-block="acme_remark">First remark</div>';

/** The status line and the screen button: they read the Tool state and call the Tool command. */
function RemarkScreen(props: RichTextEditorProps) {
  const ref = useRef<RichTextEditorHandle>(null);
  const remarks = useRichTextToolState(ref, "acme_remark");
  return (
    <div className="max-w-[640px]">
      <div className="mb-2 flex items-center gap-3">
        <Button
          size="sm"
          variant="soft"
          onClick={() => ref.current?.tool("acme_remark")?.add("Added from the screen")}
        >
          Add a remark
        </Button>
        <p role="status" className="text-fg-2 text-[13px]">
          {remarks ? `${remarks.count} of ${remarks.limit} remarks` : "Loading"}
        </p>
      </div>
      <RichTextEditor ref={ref} aria-label="Document" defaultValue={REMARK_SAMPLE} {...props} />
    </div>
  );
}

/**
 * A custom Tool through `defineTool` with defaults: the button label and the
 * "Remark" item, and the limit of three notes, come from `defaults`. The status
 * line above the field reads the Tool state with the `useRichTextToolState` hook;
 * the "Add a remark" button calls its Tool command `handle.tool("acme_remark")?.add(…)`;
 * at the limit the Toolbar button is disabled, and the command returns `false`.
 */
export const DefinedTool: Story = {
  render: () => <RemarkScreen tools={[...RICH_TEXT_PRESETS.full, remarkTool]} />,
};

/**
 * The same Tool, configured by the screen: `tool(remark, { labels: { insert:
 * "Comment" }, limit: 2 })` changes the button label, the "Comment" item and the
 * limit, while the other defaults stay, and the nested labels are merged with them.
 */
export const DefinedToolConfigured: Story = {
  render: () => (
    <RemarkScreen
      tools={[
        ...RICH_TEXT_PRESETS.full,
        tool(remarkTool, { labels: { insert: "Comment" }, limit: 2 }),
      ]}
    />
  ),
};

/*
  Video by link (OLDSUI-281, ADR-0071): the `youtube` and `twitch` Tools, outside
  the Presets: an explicit entry in `tools`. The Document holds a link, not a
  player; the kit draws the player. The player appears at once (OLDSUI-287), and
  `autoload: false` leaves a placeholder until a click. The videos in the stories
  are a real YouTube video and a Twitch recording, but the tests intercept the
  requests to the services (`tests-visual/rich-text-editor-video.spec.ts`).
*/
const VIDEO_SAMPLE =
  "<h2>Video</h2><p>Two blocks follow, one per service.</p>" +
  '<div data-block="video" data-provider="youtube" data-src="https://www.youtube.com/watch?v=dQw4w9WgXcQ">' +
  '<a href="https://www.youtube.com/watch?v=dQw4w9WgXcQ" rel="noopener noreferrer">https://www.youtube.com/watch?v=dQw4w9WgXcQ</a></div>' +
  '<div data-block="video" data-provider="twitch" data-src="https://www.twitch.tv/aws">' +
  '<a href="https://www.twitch.tv/aws" rel="noopener noreferrer">https://www.twitch.tv/aws</a></div>' +
  "<p>Add another: menu → Video, or paste a link.</p>";

/**
 * Videos from YouTube and Twitch: the service's player appears at once, in a
 * 16:9 frame. "Video" in the Insert menu ("+" and "/") accepts a link from either
 * service; a link in an empty paragraph also becomes a Block.
 */
export const Video: Story = {
  // Lazy chunks (KaTeX, player, Island): the snapshot and the audit wait for the network to go quiet.
  tags: ["network-idle"],
  render: () => (
    <div className="max-w-[640px]">
      <RichTextEditor
        aria-label="Document"
        tools={[...RICH_TEXT_PRESETS.full, "youtube", "twitch"]}
        defaultValue={VIDEO_SAMPLE}
      />
    </div>
  ),
};

/**
 * `autoload: false` for both services: a placeholder with the service's name and
 * a "Play" button stands in place of the player, and the player loads after a
 * click. Until then no request goes to the service at all; this is for screens
 * where privacy matters.
 */
export const VideoClickToPlay: Story = {
  // Lazy chunks (KaTeX, player, Island): the snapshot and the audit wait for the network to go quiet.
  tags: ["network-idle"],
  render: () => (
    <div className="max-w-[640px]">
      <RichTextEditor
        aria-label="Document"
        tools={[
          ...RICH_TEXT_PRESETS.full,
          tool("youtube", { autoload: false }),
          tool("twitch", { autoload: false }),
        ]}
        defaultValue={VIDEO_SAMPLE}
      />
    </div>
  ),
};

/**
 * YouTube only: a Twitch Block from `value` becomes a plain link, and the link
 * field in "Video" answers with an error for a link from another service.
 */
export const VideoYoutubeOnly: Story = {
  // Lazy chunks (KaTeX, player, Island): the snapshot and the audit wait for the network to go quiet.
  tags: ["network-idle"],
  render: () => (
    <div className="max-w-[640px]">
      <RichTextEditor
        aria-label="Document"
        tools={[...RICH_TEXT_PRESETS.full, "youtube"]}
        defaultValue={VIDEO_SAMPLE}
      />
    </div>
  ),
};

/** The Russian message catalog: labels such as "Video", "Play" and "Video link" (English stand-ins) come from it. */
export const VideoRussian: Story = {
  // Lazy chunks (KaTeX, player, Island): the snapshot and the audit wait for the network to go quiet.
  tags: ["network-idle"],
  render: () => (
    <UiProvider locale="ru-RU" messages={ru}>
      <div className="max-w-[640px]">
        <RichTextEditor
          aria-label="Document"
          tools={[...RICH_TEXT_PRESETS.full, "youtube", "twitch"]}
          defaultValue={VIDEO_SAMPLE}
        />
      </div>
    </UiProvider>
  ),
};

/*
  Paste cleanup (OLDSUI-274). The buttons paste real clipboard captures (`fixtures/paste/`, served by
  the showcase at `paste-fixtures/`) into two Editors: on the left with `pasteCleanup`, as in the
  presets, on the right without it, as the Editor pasted before the Tool existed. The address is built
  from the showcase's own, as for the sample image: it may be published in a subdirectory.
*/
const PASTE_SAMPLES = [
  { label: "Word for Mac", file: "word-mac-chrome-lists-numbered" },
  { label: "Word on Windows", file: "word-win-chrome-whole" },
  { label: "Word for the web", file: "word-web-chrome-whole" },
  { label: "Excel", file: "excel-mac-chrome-range" },
  { label: "Google Docs", file: "gdocs-chrome-whole" },
  { label: "Google Sheets", file: "gsheets-chrome-range" },
] as const;

const WITHOUT_PASTE_CLEANUP = RICH_TEXT_PRESETS.full.filter((name) => name !== "pasteCleanup");

async function pasteSample(handles: (RichTextEditorHandle | null)[], file: string) {
  // The cleanup steps come in their own chunk: wait for it, or the first paste would go in uncleaned.
  await loadPasteCleanup();
  const response = await fetch(new URL(`paste-fixtures/${file}.json`, document.baseURI));
  const sample = (await response.json()) as { "text/html": string };
  for (const handle of handles) {
    const editor = handle?.editor;
    if (!editor) continue;
    editor.commands.clearContent();
    editor.view.pasteHTML(sample["text/html"]);
  }
}

function PasteCleanupDemo() {
  const withCleanup = useRef<RichTextEditorHandle>(null);
  const withoutCleanup = useRef<RichTextEditorHandle>(null);
  const [current, setCurrent] = useState<string>(PASTE_SAMPLES[0].file);
  useEffect(() => {
    let frame = 0;
    const tick = () => {
      if (!withCleanup.current?.editor || !withoutCleanup.current?.editor) {
        frame = requestAnimationFrame(tick);
        return;
      }
      void pasteSample([withCleanup.current, withoutCleanup.current], current);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [current]);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Clipboard sample">
        {PASTE_SAMPLES.map((sample) => (
          <Button
            key={sample.file}
            size="sm"
            variant="soft"
            selected={current === sample.file}
            onClick={() => setCurrent(sample.file)}
          >
            {sample.label}
          </Button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <RichTextEditor ref={withCleanup} aria-label="With pasteCleanup" maxHeight={560} />
        <RichTextEditor
          ref={withoutCleanup}
          aria-label="Without pasteCleanup"
          tools={WITHOUT_PASTE_CLEANUP}
          maxHeight={560}
        />
      </div>
    </div>
  );
}

/**
 * Pasting from Word, Excel, Google Docs and Google Sheets: on the left with the `pasteCleanup` Tool
 * (in both presets), on the right without it. The buttons paste real clipboard captures. A Word list
 * stays a list, a highlight stays a marker, an Excel header stays bold.
 */
export const PasteFromOffice: Story = {
  // The sample is fetched from the showcase: the snapshot waits for the network to go quiet.
  tags: ["network-idle"],
  render: () => <PasteCleanupDemo />,
};

/*
  Text part language (OLDSUI-308, ADR-0078): the sample is a neutral English text with a German
  term, a French phrase and an English quotation inside a Russian page. The stories use Latin
  text only; the Russian interface comes from the catalog.
*/
const LANGUAGE_SAMPLE =
  "<h2>Language of parts</h2>" +
  '<p>A reader hears this sentence in the language of the page, but the word <span lang="de">Weltschmerz</span> ' +
  'is German, and <span lang="fr">joie de vivre</span> is French. A dotted line under a fragment shows the author where the mark ' +
  "begins and ends; the reader of <code>RichTextView</code> sees no line.</p>" +
  '<p><span lang="de">A whole paragraph can carry the mark too, with <strong>bold</strong> inside it.</span></p>';

/**
 * The `language` Tool, marked fragments: a thin dotted underline in the Editor shows where each
 * Mark begins and ends (the View draws nothing). The page language is `en`, so only the German and
 * French pieces are marked. The "Language ›" submenu is in the "…" menu.
 */
export const TextLanguage: Story = {
  render: () => (
    <div className="max-w-[640px]">
      <RichTextEditor aria-label="Document" defaultValue={LANGUAGE_SAMPLE} />
    </div>
  ),
};

/*
  Opens "…" over the selected `text`, then its submenu: the same way as from the keyboard (focus on
  the item and `→`), because hovering would open it after a delay and the snapshot would catch an
  intermediate frame.
*/
function useOpenLanguageSubmenu(
  ref: RefObject<RichTextEditorHandle | null>,
  text: string,
  more: string,
  item: string
) {
  useOpenToolbarPopover(ref, text, more);
  useEffect(() => {
    let frame = 0;
    const open = () => {
      const trigger = Array.from(
        document.querySelectorAll<HTMLElement>('[role="menuitem"][aria-haspopup]')
      ).find((candidate) => candidate.textContent?.startsWith(item));
      if (!trigger) {
        frame = requestAnimationFrame(open);
        return;
      }
      trigger.focus();
      trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    };
    frame = requestAnimationFrame(open);
    return () => cancelAnimationFrame(frame);
  }, [item]);
}

function OpenLanguageMenu({ more, item }: { more: string; item: string }) {
  const ref = useRef<RichTextEditorHandle>(null);
  useOpenLanguageSubmenu(ref, "Weltschmerz", more, item);
  return (
    <div className="h-[520px] max-w-[640px]">
      <RichTextEditor ref={ref} aria-label="Document" defaultValue={LANGUAGE_SAMPLE} />
    </div>
  );
}

/**
 * The "Language ›" submenu over the selected German word: English and Russian are the options
 * (`languages`), the page's own language is marked "primary", and "Remove language mark" removes
 * the Mark. German is not in the option, but it is under the selection, so it is added and checked.
 */
export const TextLanguageMenu: Story = {
  render: () => <OpenLanguageMenu more="More formatting" item="Language" />,
  tags: ["network-idle"],
};

/**
 * A Russian interface: the page's primary language is the interface locale (`ru-RU`, there is no
 * `lang` above the field in this story's frame), so the English piece is the real mark. The names
 * come from `Intl.DisplayNames` in Russian, the words from the catalog.
 */
export const TextLanguageRussian: Story = {
  render: () => (
    <UiProvider locale="ru-RU" messages={ru}>
      <OpenLanguageMenu more={ru.editor.moreFormatting} item={ru.editor.language} />
    </UiProvider>
  ),
  tags: ["network-idle"],
};

// A Word clipboard fragment: `lang` on every run, `mso-ansi-language` next to it, and Word's own case.
const WORD_LANGUAGE_FRAGMENT =
  "<html><body><p class=MsoNormal><span lang=EN-US style='mso-ansi-language:EN-US'>" +
  "The page is English, so this run is dropped. </span>" +
  "<span lang=DE style='mso-ansi-language:DE'>Dieser Satz bleibt deutsch.</span>" +
  "<span lang=EN-US style='mso-ansi-language:EN-US'> And the next run is again plain.</span></p></body></html>";

function PasteLanguageDemo() {
  const ref = useRef<RichTextEditorHandle>(null);
  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const editor = ref.current?.editor;
      if (!editor) {
        frame = requestAnimationFrame(tick);
        return;
      }
      editor.view.pasteHTML(WORD_LANGUAGE_FRAGMENT, new Event("paste") as ClipboardEvent);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <div className="max-w-[640px]">
      <RichTextEditor ref={ref} aria-label="Document" />
    </div>
  );
}

/**
 * A paste from Word: every run carries `lang`, and the Editor keeps only the one that differs
 * from the page's language (`en` here), written in the canonical case (`DE` becomes `de`). Without
 * the drop, Word would cover the whole text with marks.
 */
export const TextLanguagePasteFromWord: Story = {
  render: () => <PasteLanguageDemo />,
};

function QuotesDemo() {
  const ref = useRef<RichTextEditorHandle>(null);
  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const editor = ref.current?.editor;
      if (!editor) {
        frame = requestAnimationFrame(tick);
        return;
      }
      // The same path ProseMirror receives typing by, where the input rules hang.
      const { doc } = editor.state;
      let end = 0;
      doc.descendants((node, pos) => {
        if (node.isText && node.text === "French") end = pos + node.nodeSize;
      });
      editor.commands.setTextSelection(end);
      for (const char of ' "a phrase"') {
        const { from, to } = editor.state.selection;
        const handled = editor.view.someProp("handleTextInput", (handler) =>
          handler(editor.view, from, to, char, () => editor.state.tr.insertText(char, from, to))
        );
        if (!handled) editor.view.dispatch(editor.state.tr.insertText(char, from, to));
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <div className="max-w-[640px]">
      <RichTextEditor
        ref={ref}
        aria-label="Document"
        tools={[...RICH_TEXT_PRESETS.full, "typography"]}
        defaultValue={
          '<p>The English interface gives “curly” quotes: <span lang="en">English</span>, but inside a ' +
          '<span lang="ru">Russian</span> fragment the same key gives guillemets, and inside <span lang="fr">French</span></p>'
        }
      />
    </div>
  );
}

/**
 * Typography by the language of the fragment: the `"` typed at the end of the French fragment gives
 * the catalog's curly quotes, while one typed inside a `ru` mark gives guillemets and inside an
 * `en` mark curly quotes, whatever the interface language is.
 */
export const TextLanguageQuotes: Story = {
  render: () => <QuotesDemo />,
};

/*
  Block selection and the Block handle over a range (ADR-0077, OLDSUI-307). The story sets the state
  once the engine is created, the way a user gets there: a text selection across Blocks (the handle
  over a range), or `Esc` in the text and `Shift+↓` (Block selection). `extend` is how many times
  `Shift+↓` is pressed after `Esc`.
*/
function useRangeDemo(
  ref: RefObject<RichTextEditorHandle | null>,
  options: {
    from: string;
    to?: string;
    extend?: number;
    /** Blocks added to the set with `Cmd/Ctrl+click`, by their text (ADR-0083). */
    toggle?: readonly string[];
    open?: boolean;
    /** The accessible name of the "⋮" button: it comes from the catalog, so it is not English in `ru`. */
    handleName?: string;
  }
) {
  const { from, to, extend = 0, toggle = [], open = false, handleName = "Block actions" } = options;
  useEffect(() => {
    let frame = 0;
    const press = () => {
      const handle = document.querySelector<HTMLElement>(
        `button[aria-label="${CSS.escape(handleName)}"]`
      );
      if (!handle) {
        frame = requestAnimationFrame(press);
        return;
      }
      handle.click();
    };
    const tick = () => {
      const editor = ref.current?.editor;
      if (!editor) {
        frame = requestAnimationFrame(tick);
        return;
      }
      let start = -1;
      let end = -1;
      editor.state.doc.descendants((node, pos) => {
        if (!node.isText) return;
        if (start < 0 && node.text === from) start = pos + 1;
        if (node.text === (to ?? from)) end = pos + node.nodeSize - 1;
      });
      editor.view.focus();
      if (start > 0) editor.commands.setTextSelection(to ? { from: start, to: end } : start);
      if (!to) {
        // Block selection: the same as `Esc`, then `Shift+↓` for each extra Block.
        ref.current?.tool("blockSelection")?.selectCurrent();
        for (let step = 0; step < extend; step++) {
          editor.view.dom.dispatchEvent(
            new KeyboardEvent("keydown", { key: "ArrowDown", shiftKey: true, bubbles: true })
          );
        }
        // Both modifiers: the Tool reads the one of the platform (`Cmd` on a Mac, `Ctrl` elsewhere).
        for (const text of toggle) {
          const target = Array.from(editor.view.dom.querySelectorAll("p")).find(
            (node) => node.textContent === text
          );
          target?.dispatchEvent(
            new MouseEvent("mousedown", { metaKey: true, ctrlKey: true, bubbles: true })
          );
        }
      }
      if (open) frame = requestAnimationFrame(press);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [ref, from, to, extend, open, handleName]);
}

const RANGE_SAMPLE =
  "<h2>Release plan</h2>" +
  "<p>Freeze the scope on Monday.</p>" +
  "<p>Run the regression pass on Tuesday.</p>" +
  "<p>Ship on Wednesday.</p>" +
  "<ul><li><p>Announce the date</p></li><li><p>Update the changelog</p></li></ul>" +
  "<p>Closing note for the team.</p>";

function RangeDemo({
  document = RANGE_SAMPLE,
  from,
  to,
  extend,
  toggle,
  open,
  handleName,
  ...props
}: {
  document?: string;
  from: string;
  to?: string;
  extend?: number;
  toggle?: readonly string[];
  open?: boolean;
  handleName?: string;
} & Partial<RichTextEditorProps>) {
  const ref = useRef<RichTextEditorHandle>(null);
  useRangeDemo(ref, { from, to, extend, toggle, open, handleName });
  return (
    <div className="h-[520px] max-w-[640px]">
      <RichTextEditor ref={ref} aria-label="Document" defaultValue={document} {...props} />
    </div>
  );
}

/**
 * The Block handle over a range: a text selection across several Blocks no longer hides the "⋮". It
 * stands at the first Block the selection touches, and its menu acts on all of them. This is in every
 * Editor, with or without the `blockSelection` Tool.
 */
export const BlockHandleOverRange: Story = {
  // The frame is about the handle: the selection menu above the same range only animates in at a
  // varying moment and makes the snapshot flaky.
  render: () => (
    <RangeDemo
      from="Run the regression pass on Tuesday."
      to="Ship on Wednesday."
      selectionMenu={false}
    />
  ),
};

/**
 * The menu of the handle over a range: Format ›, Wrap in ›, Select, Move up, Move down, Duplicate and
 * Delete. No "Add ›": that item is for one Block. Every item is one edit for undo, and the screen
 * reader hears the result ("Blocks deleted: 2").
 */
export const BlockHandleOverRangeMenu: Story = {
  render: () => (
    <RangeDemo from="Run the regression pass on Tuesday." to="Ship on Wednesday." open />
  ),
};

/**
 * Block selection: `Esc` in the text selects the current Block, `Shift+↓` adds the next one. The
 * Blocks are painted whole on the selection color, there is no caret, and the "⋮" stands at the first
 * Block. Then `Backspace` removes them, `⌘C` and `⌘X` take them whole, `⌘V` replaces them, `⌘⇧D` and
 * `⌥⇧↑/↓` duplicate and move them; `Esc` again returns the caret.
 */
export const BlockSelection: Story = {
  render: () => <RangeDemo from="Freeze the scope on Monday." extend={1} />,
};

/**
 * A set from different places (ADR-0083): in the mode, `Cmd+click` (`Ctrl+click` off a Mac) adds a
 * Block from anywhere, here a paragraph and a list item past a gap. `Backspace`, `⌘C`, `⌘X` and
 * "Format ›" act on every Block; moving, duplicating, wrapping and `⌘V` are unavailable, since the
 * set has no one row to act on.
 */
export const BlockSelectionScattered: Story = {
  render: () => (
    <RangeDemo
      from="Freeze the scope on Monday."
      toggle={["Ship on Wednesday.", "Update the changelog"]}
    />
  ),
};

/** The handle's menu over a set from different places: Move, Duplicate and Wrap in are unavailable. */
export const BlockSelectionScatteredMenu: Story = {
  render: () => (
    <RangeDemo from="Freeze the scope on Monday." toggle={["Ship on Wednesday."]} open />
  ),
};

/** Block selection on the Paper sheet: the same highlight on a light surface in any theme. */
export const BlockSelectionPaper: Story = {
  render: () => <RangeDemo from="Freeze the scope on Monday." extend={1} surface="paper" />,
};

/** A list: the unit is the item, so the selection takes one item and grows by item. */
export const BlockSelectionInList: Story = {
  render: () => <RangeDemo from="Announce the date" extend={1} />,
};

const COLUMNS_RANGE_SAMPLE =
  "<p>Before the columns.</p>" +
  layoutBlock(
    "50-50",
    layoutColumn("Left", "First block of the left column."),
    layoutColumn("Right", "Only block of the right column.")
  ) +
  "<p>After the columns.</p>";

/**
 * Block selection in columns: the selection is neighbours of one container, so `Shift+↓` stays in the
 * column. At the column's edge it selects the whole Column layout and goes on at the Document's level.
 */
export const BlockSelectionInColumns: Story = {
  render: () => (
    <RangeDemo document={COLUMNS_RANGE_SAMPLE} from="First block of the left column." />
  ),
};

/**
 * Block selection inside a `Dialog`: the first `Esc` selects the Block and the window stays, the
 * second `Esc` ends the selection and closes the window, like any nested layer (ADR-0041). A comment
 * field uses `preset="basic"` and keeps the one-`Esc` close.
 */
export const BlockSelectionInDialog: Story = {
  render: function Render() {
    const [open, setOpen] = useState(true);
    return (
      <div className="h-[520px]">
        <Button onClick={() => setOpen(true)}>Open the window</Button>
        <Dialog open={open} onClose={() => setOpen(false)} title="Edit the plan">
          <div className="w-[560px] max-w-full">
            <RangeDemoInDialog />
          </div>
        </Dialog>
      </div>
    );
  },
};

function RangeDemoInDialog() {
  const ref = useRef<RichTextEditorHandle>(null);
  useRangeDemo(ref, { from: "Run the regression pass on Tuesday." });
  return <RichTextEditor ref={ref} aria-label="Document" defaultValue={RANGE_SAMPLE} />;
}

/**
 * Block selection in a read-only field: `Esc`, `Shift+↑/↓` and `Shift+click` work, and of the actions
 * only `⌘C` (there is no handle).
 */
export const BlockSelectionReadOnly: Story = {
  render: () => <RangeDemo from="Freeze the scope on Monday." extend={1} readOnly />,
};

/** The announcements, the menu items and the reference rows in the Russian catalog. */
export const BlockSelectionRussian: Story = {
  render: () => (
    <UiProvider locale="ru-RU" messages={ru}>
      <RangeDemo
        from="Run the regression pass on Tuesday."
        to="Ship on Wednesday."
        open
        handleName={ru.editor.blockActions}
      />
    </UiProvider>
  ),
};

/* ── Footnotes (the `footnotes` Tool, OLDSUI-306, ADR-0076) ───────────────────────────────── */

/** A footnote reference as the Editor writes it. */
const footnoteRef = (key: string, number: number) =>
  `<sup data-footnote-ref="${key}"><a href="#fn-${key}" id="fnref-${key}" role="doc-noteref">${number}</a></sup>`;

/** The footnote list as the Editor writes it. */
const footnoteList = (name: string, notes: readonly (readonly [key: string, html: string])[]) =>
  `<section data-block="footnotes" role="doc-endnotes" aria-label="${name}"><ol>` +
  notes
    .map(
      ([key, html]) =>
        `<li id="fn-${key}"><p>${html}</p><a href="#fnref-${key}" role="doc-backlink">↩</a></li>`
    )
    .join("") +
  "</ol></section>";

const FOOTNOTES_SAMPLE =
  "<h2>A short report</h2>" +
  `<p>The first result${footnoteRef("fnstory1", 1)} was measured twice, and the second one${footnoteRef("fnstory2", 2)} ` +
  `agreed with it${footnoteRef("fnstory3", 3)}.</p>` +
  "<p>Type <code>/footnote</code> or use the item in the “…” menu to add another reference at the caret.</p>" +
  footnoteList("Footnotes", [
    ["fnstory1", "Measured on <strong>2026-09-01</strong>, in the lab."],
    [
      "fnstory2",
      'See <a href="https://example.com/method" rel="noopener noreferrer">the method</a>.',
    ],
    ["fnstory3", "The difference stayed under one percent."],
  ]);

/**
 * Footnotes in `full`: a reference with an automatic number in the text, and the footnotes' texts in a
 * list at the end, edited in place. "Footnote" in the Slash menu and in the “…” menu inserts a reference
 * at the caret and moves the caret into its footnote. A click or Enter on a reference goes to its
 * footnote; the footnote's number button, or Enter in it, goes back.
 */
export const Footnotes: Story = {
  render: () => (
    <div className="max-w-[640px]">
      <RichTextEditor aria-label="Document" defaultValue={FOOTNOTES_SAMPLE} />
    </div>
  ),
};

function FootnotesRenumberingDemo() {
  const ref = useRef<RichTextEditorHandle>(null);
  const state = useRichTextToolState(ref, "footnotes");
  return (
    <div className="flex max-w-[640px] flex-col gap-3">
      <RichTextEditor ref={ref} aria-label="Document" defaultValue={FOOTNOTES_SAMPLE} />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          onClick={() => {
            // The caret goes to the start of the first paragraph: the new reference becomes number 1.
            const editor = ref.current?.editor;
            editor
              ?.chain()
              .focus()
              .setTextSelection(editor.state.doc.child(0).nodeSize + 1)
              .run();
            ref.current?.tool("footnotes")?.insert();
          }}
        >
          Add a footnote at the start of the report
        </Button>
        <Button variant="outline" onClick={() => ref.current?.undo()}>
          Undo
        </Button>
        <span role="status" className="text-fg-2 text-caption">
          {state
            ? `${state.footnotes.length} footnotes, current: ${state.current ?? "none"}`
            : "Loading"}
        </span>
      </div>
    </div>
  );
}

/**
 * Renumbering. The button puts a new reference before the others: the old references and footnotes
 * move down by one, the new footnote is first in the list, and one Undo takes the whole edit back. The
 * state line is `useRichTextToolState(ref, "footnotes")`.
 */
export const FootnotesRenumbering: Story = {
  render: () => <FootnotesRenumberingDemo />,
};

const FOOTNOTES_MARKDOWN =
  "The first result[^lab] was measured twice, and the second one[^method] agreed with it.\n\n" +
  "[^lab]: Measured on **2026-09-01**, in the lab.\n" +
  "[^method]: See [the method](https://example.com/method).";

/**
 * Markdown both ways. "Load Markdown" reads GFM footnotes (labels become numbers), and "Export Markdown"
 * writes `[^1]` … `[^n]` and the definitions at the end; the round trip loses nothing.
 */
export const FootnotesMarkdown: Story = {
  render: () => {
    const ref = useRef<RichTextEditorHandle>(null);
    const [markdown, setMarkdown] = useState("");
    return (
      <div className="flex max-w-[640px] flex-col gap-3">
        <RichTextEditor ref={ref} aria-label="Document" />
        <div className="flex gap-2">
          <Button onClick={() => ref.current?.setMarkdown(FOOTNOTES_MARKDOWN)}>
            Load Markdown
          </Button>
          <Button variant="outline" onClick={() => setMarkdown(ref.current?.getMarkdown() ?? "")}>
            Export Markdown
          </Button>
        </div>
        <pre className="text-fg-2 text-caption break-all whitespace-pre-wrap">{markdown}</pre>
      </div>
    );
  },
};

/**
 * `readOnly`: the Document does not change, but the jumps work. A click on a reference goes to its
 * footnote, and the buttons use the Tool's commands `goToFootnote(n)` and `goToReference(n)`.
 */
export const FootnotesReadOnly: Story = {
  render: () => {
    const ref = useRef<RichTextEditorHandle>(null);
    return (
      <div className="flex max-w-[640px] flex-col gap-3">
        <RichTextEditor ref={ref} aria-label="Document" readOnly defaultValue={FOOTNOTES_SAMPLE} />
        <div className="flex gap-2">
          <Button onClick={() => ref.current?.tool("footnotes")?.goToFootnote(2)}>
            Go to footnote 2
          </Button>
          <Button
            variant="outline"
            onClick={() => ref.current?.tool("footnotes")?.goToReference(2)}
          >
            Back to reference 2
          </Button>
        </div>
      </div>
    );
  },
};

const FOOTNOTES_RUSSIAN =
  "<h2>A short report</h2>" +
  `<p>The first result${footnoteRef("fnrusone", 1)} was measured twice, and the second one${footnoteRef("fnrustwo", 2)} agreed with it.</p>` +
  // The list's name is written into the HTML in the language of the catalog, as the Editor does.
  footnoteList(ru.editor.footnotes, [
    ["fnrusone", "Measured in the lab on 1 September 2026."],
    ["fnrustwo", "The method is described <em>separately</em>."],
  ]);

/**
 * The Russian catalog: the Toolbar, the Slash menu item, the number button's name and the list's name
 * in the HTML come from `@olddevs/ui/locales/ru`. The Document's text is data and stays English.
 */
export const FootnotesRussian: Story = {
  render: () => (
    <UiProvider locale="ru-RU" messages={ru}>
      <div className="max-w-[640px]">
        <RichTextEditor defaultValue={FOOTNOTES_RUSSIAN} />
      </div>
    </UiProvider>
  ),
};

/*
  Fullscreen mode and the focus mode (OLDSUI-312, ADR-0082). The demos put the field in the state
  the story is about: the caret in a Block, the layer open. `onReady` runs once the engine is created,
  and the Handle already works inside it.
*/
const FOCUS_SAMPLE =
  "<h2>Release plan</h2>" +
  "<p>Freeze the scope on Monday.</p>" +
  "<p>Run the regression pass on Tuesday.</p>" +
  "<ul><li><p>Announce the date</p></li><li><p>Update the changelog</p></li></ul>" +
  "<p>Ship on Wednesday.</p>";

/** Put the caret at the end of the text `text` and focus the Document. */
function caretAt(handle: RichTextEditorHandle | null, text: string) {
  const editor = handle?.editor;
  if (!editor) return;
  let found = -1;
  editor.state.doc.descendants((node, pos) => {
    if (found < 0 && node.isText && node.text === text) found = pos + node.nodeSize;
  });
  editor.view.focus();
  if (found > 0) editor.commands.setTextSelection(found);
}

function ModesDemo({
  fullscreen = false,
  fullWidth = false,
  focus = false,
  ...props
}: { fullscreen?: boolean; fullWidth?: boolean; focus?: boolean } & Partial<RichTextEditorProps>) {
  const ref = useRef<RichTextEditorHandle>(null);
  return (
    <div className="max-w-[640px]">
      <RichTextEditor
        ref={ref}
        aria-label="Document"
        tools={[
          ...RICH_TEXT_PRESETS.full,
          ...(focus ? [tool("focus", { enabled: true })] : []),
          ...(fullWidth ? [tool("fullscreen", { fullWidth: true })] : []),
        ]}
        defaultValue={FOCUS_SAMPLE}
        onReady={() => {
          caretAt(ref.current, "Run the regression pass on Tuesday.");
          if (fullscreen) ref.current?.tool("fullscreen")?.open();
        }}
        {...props}
      />
    </div>
  );
}

/**
 * Fullscreen mode: the "Fullscreen" item of the "…" menu expands the field to the whole window. The
 * Toolbar is across the top, the Status bar at the bottom, and the Document scrolls itself as a
 * 60rem column in the middle of the window. "Collapse" at the right edge of the Toolbar and `Esc` put
 * it back; the history, the caret and the selection stay. The story opens the layer on load.
 */
export const Fullscreen: Story = {
  render: () => <ModesDemo fullscreen status="12 words" />,
};

/** The same on the Paper: the sheet stays a sheet on the app's background. */
export const FullscreenPaper: Story = {
  render: () => <ModesDemo fullscreen surface="paper" />,
};

/**
 * "Full width" (OLDSUI-318): the item right after "Fullscreen" in the "…" menu of the layer spreads
 * the Document across the window, with margins that grow with it: 24px on a phone, 48px from `md`,
 * 96px from `xl`. The item exists only in the layer; the `fullWidth` option is the starting value,
 * which the story sets.
 */
export const FullscreenFullWidth: Story = {
  render: () => <ModesDemo fullscreen fullWidth status="12 words" />,
};

/** "Full width" on the Paper: the sheet follows the Document across the window. */
export const FullscreenFullWidthPaper: Story = {
  render: () => <ModesDemo fullscreen fullWidth surface="paper" />,
};

/**
 * Fullscreen mode inside a `Dialog`: the layer lies above the window. The first `Esc` collapses the
 * field (with `blockSelection`, the first one selects the Block), the next one closes the `Dialog`.
 */
export const FullscreenInDialog: Story = {
  render: function Render() {
    const [open, setOpen] = useState(true);
    return (
      <div className="h-[520px]">
        <Button onClick={() => setOpen(true)}>Open the window</Button>
        <Dialog open={open} onClose={() => setOpen(false)} title="Edit the plan">
          <div className="w-[560px] max-w-full">
            <ModesDemo fullscreen />
          </div>
        </Dialog>
      </div>
    );
  },
};

/** A phone: the layer is `100dvh` and the Toolbar sticks to the top. */
export const FullscreenPhone: Story = {
  tags: ["viewport-phone"],
  render: () => <ModesDemo fullscreen />,
};

/** The Bubble menu has no Toolbar: "Collapse" sits in the corner of the layer. */
export const FullscreenBubble: Story = {
  render: () => <ModesDemo fullscreen toolbar="bubble" />,
};

/**
 * Focus mode: the Block with the caret is as it is, everything around it is in secondary color.
 * Here the caret is in a paragraph; in a list the unit is the item, and a table is one Block. The
 * dimming goes away without focus in the Document, over a Block selection and in a read-only field.
 */
export const FocusMode: Story = {
  render: () => <ModesDemo focus />,
};

/** Focus mode on the Paper sheet. */
export const FocusModePaper: Story = {
  render: () => <ModesDemo focus surface="paper" />,
};

/**
 * Focus mode in a list: the caret is in the second item, so the first item and the text around the
 * list are dimmed, and the item itself is as it is.
 */
export const FocusModeInList: Story = {
  render: function Render() {
    const ref = useRef<RichTextEditorHandle>(null);
    return (
      <div className="max-w-[640px]">
        <RichTextEditor
          ref={ref}
          aria-label="Document"
          tools={[...RICH_TEXT_PRESETS.full, tool("focus", { enabled: true })]}
          defaultValue={FOCUS_SAMPLE}
          onReady={() => caretAt(ref.current, "Update the changelog")}
        />
      </div>
    );
  },
};

/** Both modes together: the long work the pair is for. */
export const FocusModeInFullscreen: Story = {
  render: () => <ModesDemo fullscreen focus />,
};

/** The item names, the "Collapse" button and the announcements in the Russian catalog. */
export const FullscreenRussian: Story = {
  render: () => (
    <UiProvider locale="ru-RU" messages={ru}>
      <ModesDemo fullscreen focus />
    </UiProvider>
  ),
};
