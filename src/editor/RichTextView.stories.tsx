import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { highlightCodeBlocks } from "./features/code/highlight.js";
import { EDITOR_MARKER_NAMES, EDITOR_TEXT_COLOR_NAMES } from "./styles/palette.js";
import { RichTextEditor } from "./RichTextEditor.js";
import { RichTextView } from "./RichTextView.js";
import { tool } from "./core/toolOptions.js";

/*
  A neutral Document with every Block and every Schema Mark, the same one as in the
  Editor stories: typography is compared on one text.
*/
const SAMPLE =
  "<h2>Release notes</h2>" +
  "<p>This document shows every block the editor supports. Text can be " +
  "<strong>bold</strong>, <em>italic</em>, <s>struck through</s> or <code>inline code</code>.</p>" +
  "<h3>What changed</h3>" +
  "<ul><li><p>First item of a bulleted list</p></li><li><p>Second item</p>" +
  "<ul><li><p>A nested item</p></li></ul></li></ul>" +
  "<ol><li><p>Step one</p></li><li><p>Step two</p></li></ol>" +
  "<h4>A smaller heading</h4>" +
  "<blockquote><p>A quotation stands apart from the surrounding text.</p></blockquote>" +
  "<hr><p>Text after the divider.</p>";

/* A table: a header row of `th` cells, six columns, wider than a narrow screen. */
const TABLE_HTML =
  "<h2>Roadmap</h2><p>Quarterly plan by area.</p>" +
  "<table><tbody>" +
  "<tr><th><p>Area</p></th><th><p>Owner</p></th><th><p>Status</p></th><th><p>Start</p></th>" +
  "<th><p>Finish</p></th><th><p>Notes</p></th></tr>" +
  "<tr><td><p>Search</p></td><td><p>Alex</p></td><td><p><strong>Done</strong></p></td><td><p>Jan 9</p></td>" +
  "<td><p>Feb 20</p></td><td><p>Shipped to <em>all</em> accounts</p></td></tr>" +
  "<tr><td><p>Billing</p></td><td><p>Sam</p></td><td><p>In progress</p></td><td><p>Feb 1</p></td>" +
  "<td><p>Apr 3</p></td><td><p>Waiting on the <code>invoice</code> format</p></td></tr>" +
  "</tbody></table><p>Text after the table.</p>";

/*
  Merged cells and column alignment, written the way the Editor's Table menu writes
  them: `colspan`, `rowspan`, and `data-align` on each cell in a column.
*/
const MERGED_TABLE_HTML =
  "<table><tbody>" +
  '<tr><th rowspan="2"><p>Area</p></th><th colspan="2" data-align="center"><p>Q1</p></th></tr>' +
  '<tr><th data-align="right"><p>Plan</p></th><th data-align="right"><p>Fact</p></th></tr>' +
  '<tr><td><p>Search</p></td><td data-align="right"><p>1,200</p></td><td data-align="right"><p>1,150</p></td></tr>' +
  '<tr><td><p>Billing</p></td><td colspan="2" data-align="center"><p>moved to Q2</p></td></tr>' +
  "</tbody></table>";

const meta = {
  title: "Content/RichTextView",
  component: RichTextView,
  parameters: { layout: "padded" },
  args: { html: SAMPLE },
  render: (args) => (
    <div className="max-w-[640px]">
      <RichTextView {...args} />
    </div>
  ),
} satisfies Meta<typeof RichTextView>;

export default meta;
type Story = StoryObj<typeof meta>;

/*
  Code blocks: one per language the Editor supports, plus plain text. The samples
  include keywords, strings, numbers, comments and tags, so the highlight theme can be
  seen in full and axe measures the contrast of every token role in all three themes.
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
] as const;

const escapeCode = (code: string) =>
  code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const CODE_BLOCKS =
  "<h2>Code blocks</h2>" +
  CODE_SAMPLES.map(
    ([language, code]) => `<pre><code class="language-${language}">${escapeCode(code)}</code></pre>`
  ).join("") +
  "<pre><code>Plain text is never highlighted: if (a) { return b; }</code></pre>";

/**
 * A saved Document without an engine. The HTML here is a constant; in the app it
 * arrives from the server already sanitized: the component does not sanitize anything itself.
 */
export const Playground: Story = {};

/** An empty Document is an empty container, with no placeholder: the page draws the empty state. */
export const Empty: Story = {
  args: { html: "" },
};

/**
 * Text color, marker and alignment in the View: the same palette names the Editor
 * writes, and the same classes (`prose.ts`), with no engine and no `style`. Text color
 * is six tones on a `span`; the marker is three bright colors and the six older Notion
 * colors on a `mark`. The theme is switched with the showcase toolbar.
 */
export const ColourAndAlignment: Story = {
  args: {
    html:
      EDITOR_TEXT_COLOR_NAMES.map(
        (name) => `<p><span data-color="${name}">Text in ${name}</span></p>`
      ).join("") +
      EDITOR_MARKER_NAMES.map(
        (name) => `<p><mark data-color="${name}">Highlight in ${name}</mark></p>`
      ).join("") +
      '<p data-align="center">Centred paragraph.</p><p data-align="right">Right-aligned paragraph.</p>',
  },
};

/**
 * Marker palette: the three bright colors (yellow, bright green, pink) are the same in
 * `dark`, `light` and `dim`, and the text on them is dark (`--marker-text`, 4.5:1 in
 * every theme, `npm run contrast`). The six older Notion colors (blue, gray, brown,
 * orange, purple, red) take their theme values alongside the main text; the grid offers
 * them again. The theme is switched with the showcase toolbar, so the story is
 * snapshotted and checked with axe in all three.
 *
 * Rows: the marker on its own in one row, and the marker under colored text in another.
 * Text color on a marker of a different name does not always keep the contrast, and the
 * gate does not measure it: the author chose the pair.
 */
export const MarkerPalette: Story = {
  args: {
    html:
      "<h2>Marker palette</h2>" +
      "<p>" +
      EDITOR_MARKER_NAMES.map((name) => `<mark data-color="${name}">${name}</mark>`).join(" ") +
      "</p>" +
      EDITOR_MARKER_NAMES.map(
        (name) =>
          `<p><mark data-color="${name}">The body text on the ${name} marker keeps 4.5:1 ` +
          "in every theme, and the word is the cue, not the colour alone.</mark></p>"
      ).join(""),
  },
};

/** Four heading levels: H1 uses the same typography as in the Editor (`RichTextEditor` › `Heading1`). */
export const Headings: Story = {
  args: {
    html:
      "<h1>Quarterly report</h1>" +
      "<p>The main heading of a document that lives without a page of its own.</p>" +
      "<h2>Summary</h2><p>Text under the second level.</p>" +
      "<h3>Details</h3><p>Text under the third level.</p>" +
      "<h4>Notes</h4><p>Text under the fourth level.</p>",
  },
};

/** Headings on a light Paper: H1 stays light in the app's dark theme. */
export const HeadingsPaper: Story = {
  args: { ...Headings.args, surface: "paper" },
};

/** A table in the View: the same borders and header-row background as in the Editor, on a bare `<table>`. */
export const Table: Story = {
  args: { html: TABLE_HTML },
};

/** Merged cells and column alignment in the View: the same `prose.ts` classes as in the Editor. */
export const TableMerged: Story = {
  args: { html: MERGED_TABLE_HTML },
};

/**
 * Narrow screen (375 px): the table scrolls horizontally on the `<table>` itself. The
 * saved HTML has no wrapper, so scrolling must work without one.
 */
export const TableNarrow: Story = {
  tags: ["viewport-phone"],
  args: { html: TABLE_HTML },
};

/**
 * Highlighted code blocks (ADR-0051): the HTML went through `highlightCodeBlocks` from
 * `@olddevs/ui/editor/highlight`. In the app, the server does this after sanitizing.
 * `RichTextView` only colors the tokens with the GitHub Light/Dark theme through the
 * container's classes; it has no highlighter in its graph.
 *
 * Each block has a header: the language on the left (a block with no language has no
 * label), and "Copy" on the right. The label comes in the HTML from the server, and the
 * button is inserted by a client-side Island after mounting. The clipboard receives the
 * code text without tokens.
 */
export const CodeBlocks: Story = {
  args: { html: highlightCodeBlocks(CODE_BLOCKS) },
};

/**
 * A light Paper in any theme (`surface="paper"`), for print, PDF and email screens. The
 * document looks as it does in the light theme: the markers and the code highlight are
 * light, and the sheet is set off from the dark page by a border and a shadow. The same
 * document in the Editor is `RichTextEditor` › `PaperSurface`.
 */
export const PaperSurface: Story = {
  args: {
    surface: "paper",
    html:
      SAMPLE.replace(
        "<p>Text after the divider.</p>",
        '<p>Read the <a href="https://example.com/guide">style guide</a> before you print.</p>'
      ) +
      EDITOR_TEXT_COLOR_NAMES.map(
        (name) => `<p><span data-color="${name}">Text in ${name}</span></p>`
      ).join("") +
      "<p>" +
      EDITOR_MARKER_NAMES.map((name) => `<mark data-color="${name}">${name}</mark>`).join(" ") +
      "</p>" +
      MERGED_TABLE_HTML +
      highlightCodeBlocks(CODE_BLOCKS),
  },
};

/**
 * The Editor and the View on one document. An edit on the left shows up on the right at
 * once: the typography matches, because both take their classes from one module
 * (`prose.ts`). The theme is switched with the showcase toolbar; the `dark`, `light` and
 * `dim` themes are checked with snapshots.
 */
export const SideBySide: Story = {
  render: (args) => {
    const [html, setHtml] = useState(args.html);
    return (
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <section className="flex flex-col gap-2">
          <p className="text-fg-2 text-caption font-semibold">RichTextEditor</p>
          <RichTextEditor aria-label="Document" value={html} onChange={setHtml} changeDelay={0} />
        </section>
        <section className="flex flex-col gap-2">
          <p className="text-fg-2 text-caption font-semibold">RichTextView</p>
          <div className="border-line rounded-control border px-3 py-2.5">
            <RichTextView html={html} />
          </div>
        </section>
      </div>
    );
  },
};

/*
  Code block header: the Editor and the View on one document, side by side.
  Light and dark themes are switched with the showcase toggle; the snapshot is taken in all three.
*/
const HEADER_DOC =
  `<pre><code class="language-python">${escapeCode(CODE_SAMPLES[0][1])}</code></pre>` +
  '<pre><code class="language-go">func main() { fmt.Println("hello") }</code></pre>' +
  "<pre><code>Plain text: no label in the view.</code></pre>";

/**
 * Code block header: a strip above the code, the language on the left and "Copy" on the
 * right. Both parts are always visible, on desktop and on touch. The Editor is on the
 * left and the View on the right (its HTML went through `highlightCodeBlocks`, as on the
 * server). The code starts below the strip, and the buttons do not cover it. In the
 * Editor, a block with no language shows a "Plain text" button; in the View, it has no
 * label. The theme is switched with the showcase toggle; the snapshot is taken in `dark`,
 * `light` and `dim`.
 */
export const CodeBlockHeader: Story = {
  render: () => (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <section className="flex min-w-0 flex-col gap-2">
        <p className="text-fg-2 text-caption font-semibold">RichTextEditor</p>
        <RichTextEditor aria-label="Document" toolbar="none" defaultValue={HEADER_DOC} />
      </section>
      <section className="flex min-w-0 flex-col gap-2">
        <p className="text-fg-2 text-caption font-semibold">RichTextView</p>
        <div className="border-line rounded-control border px-3 py-2.5">
          <RichTextView html={highlightCodeBlocks(HEADER_DOC)} />
        </div>
      </section>
    </div>
  ),
};

/*
  Column layout in the View: the same grid as in the Editor, without borders.
  The sample is the same one as in the Editor's `Layouts` story.
*/
const layoutColumn = (title: string, text: string) =>
  `<div data-block="column"><h4>${title}</h4><p>${text}</p></div>`;
const layoutBlock = (variant: string, ...columns: string[]) =>
  `<div data-block="layout" data-layout="${variant}">${columns.join("")}</div>`;

const LAYOUTS_HTML =
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

/**
 * Column layout in the View: the columns use the same grid as in the Editor, but without
 * the dashed outline. The border is for the author, not the reader. The reading order is
 * the columns from left to right, as in the markup.
 */
export const Layouts: Story = {
  render: () => (
    <div className="max-w-[960px]">
      <RichTextView html={LAYOUTS_HTML} />
    </div>
  ),
};

/** Column layouts on a light Paper (`surface="paper"`). */
export const LayoutsPaper: Story = {
  render: () => (
    <div className="max-w-[960px]">
      <RichTextView html={LAYOUTS_HTML} surface="paper" />
    </div>
  ),
};

/**
 * Narrow screen (375 px): the columns stack, with the left one on top. The threshold is
 * the width of the Document itself (a container query), so on a wide screen they also
 * stack inside a narrow column of the page.
 */
export const LayoutNarrow: Story = {
  tags: ["viewport-phone"],
  args: { html: LAYOUTS_HTML },
};

/* Image alignment (OLDSUI-311): the same markup the Editor writes; the View draws it with the same styles. */
const alignedParagraph =
  "<p>The text wraps the picture while the Document is at least 30 rem wide, and a heading, a table or a divider starts below it. " +
  "Narrower than that the picture stands on a line of its own, in the centre.</p>";

function alignedHtml(): string {
  // The showcase file, absolute because the Document accepts only `http(s)`; read at render, not at import.
  const ALIGNED_IMAGE = new URL("editor-sample-landscape.svg", document.baseURI).href;
  return (
    "<h2>Image alignment</h2>" +
    `<figure data-align="left"><img src="${ALIGNED_IMAGE}" alt="Mountains under a clear sky" data-width="33">` +
    "<figcaption>On the left</figcaption></figure>" +
    alignedParagraph +
    alignedParagraph +
    "<h3>A heading starts below</h3>" +
    `<figure data-align="right"><img src="${ALIGNED_IMAGE}" alt="" data-width="25"></figure>` +
    alignedParagraph
  );
}

/** An image the text wraps, left and right, in `RichTextView`. */
export const ImageAlignmentView: Story = {
  render: () => (
    <div className="max-w-[640px]">
      <RichTextView html={alignedHtml()} />
    </div>
  ),
};

/*
  Wrapper in the View: no border, and the spacing between Blocks is the same as in
  the Document. The sample is the same one as in the Editor's `Wrappers` story.
*/
const wrapperBlock = (...blocks: string[]) => `<div data-block="wrapper">${blocks.join("")}</div>`;

const WRAPPERS_HTML =
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
 * Wrapper in the View: the reader does not see it. There is no border and no indent, and
 * the Blocks flow as they do in the Document. The dashed outline is a hint for the author
 * in the Editor.
 */
export const Wrappers: Story = {
  render: () => (
    <div className="max-w-[960px]">
      <RichTextView html={WRAPPERS_HTML} />
    </div>
  ),
};

/*
  Collapsible block in the View: the native `details` and `summary` elements expand without
  JavaScript, work from the keyboard, and are read by screen readers. The sample is the
  same one as in the Editor's `Details` story; the second block is saved open (`persist`).
*/
const DETAILS_HTML =
  "<h2>Collapsible blocks</h2><p>A block keeps its details under a title. Click the title to open it.</p>" +
  '<details><summary>How to build the package</summary><div data-type="detailsContent">' +
  "<p>Run the gates, then the build.</p>" +
  "<ol><li><p>Install the dependencies</p></li><li><p>Run <code>npm run build</code></p></li></ol>" +
  "</div></details>" +
  '<details open=""><summary>Release checklist</summary><div data-type="detailsContent">' +
  "<ul><li><p>Write the changelog</p></li><li><p>Tag the release</p></li></ul>" +
  '<details><summary>Rolling back</summary><div data-type="detailsContent">' +
  "<p>Revert the tag and publish the previous version.</p></div></details>" +
  "</div></details>" +
  "<p>Text after the blocks.</p>";

/**
 * Collapsible block in the View: no engine and no JavaScript. The browser itself opens and
 * closes it. A block saved with `open` arrives open.
 */
export const Details: Story = {
  render: () => (
    <div className="max-w-[640px]">
      <RichTextView html={DETAILS_HTML} />
    </div>
  ),
};

/** Collapsible block on a light Paper (`surface="paper"`). */
export const DetailsPaper: Story = {
  render: () => (
    <div className="max-w-[640px]">
      <RichTextView html={DETAILS_HTML} surface="paper" />
    </div>
  ),
};

/*
  Formulas in the View (OLDSUI-280, ADR-0070): an element with `data-latex` arrives with
  its source LaTeX, and after mounting, a lazy Island loads KaTeX and draws the formula.
  The sample is the same one as in the Editor's `Mathematics` story.
*/
const MATH_HTML =
  "<h2>Formulas</h2>" +
  '<p>The area of a circle is <span data-type="inline-math" data-latex="S = \\pi r^2"></span>, ' +
  'and Euler\'s identity is <span data-type="inline-math" data-latex="e^{i\\pi} + 1 = 0"></span>.</p>' +
  '<div data-type="block-math" data-latex="\\int_0^1 x^2\\,dx = \\frac{1}{3}"></div>' +
  "<p>The quadratic formula in a block:</p>" +
  '<div data-type="block-math" data-latex="x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}"></div>' +
  '<p>A formula KaTeX cannot read stays as source: <span data-type="inline-math" data-latex="\\frac{1"></span>.</p>';

/**
 * Formulas in the View without an engine: the Island draws KaTeX from `data-latex` in
 * place. Without JavaScript, or before rendering, the reader sees the source LaTeX; a
 * screen reader reads the MathML that KaTeX outputs.
 */
export const Mathematics: Story = {
  // Lazy chunks (KaTeX, player, Island): the snapshot and the audit wait for network silence.
  tags: ["network-idle"],
  render: () => (
    <div className="max-w-[640px]">
      <RichTextView html={MATH_HTML} />
    </div>
  ),
};

/** Formulas on a light Paper (`surface="paper"`). */
export const MathematicsPaper: Story = {
  // Lazy chunks (KaTeX, player, Island): the snapshot and the audit wait for network silence.
  tags: ["network-idle"],
  render: () => (
    <div className="max-w-[640px]">
      <RichTextView html={MATH_HTML} surface="paper" />
    </div>
  ),
};

/**
 * Formula options come from the View's `tools`: the `\RR` macro set for the Editor through
 * `tool("mathematics", { macros })` works here too. No need to name the Tool itself.
 */
export const MathematicsMacros: Story = {
  // Lazy chunks (KaTeX, player, Island): the snapshot and the audit wait for network silence.
  tags: ["network-idle"],
  render: () => (
    <div className="max-w-[640px]">
      <RichTextView
        html={
          '<p>A custom macro: <span data-type="inline-math" data-latex="x \\in \\RR"></span>.</p>'
        }
        tools={[tool("mathematics", { macros: { "\\RR": "\\mathbb{R}" } })]}
      />
    </div>
  ),
};

/*
  Callout tone of a Wrapper in the View: the same look as in the Editor, a background and
  a tone stripe. A Wrapper without a tone is still invisible. The sample is the same one as
  in the Editor's `WrapperTones` story.
*/
const tonedBlock = (tone: string, ...blocks: string[]) =>
  `<div data-block="wrapper" data-tone="${tone}">${blocks.join("")}</div>`;

const WRAPPER_TONES_HTML =
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
  wrapperBlock("<p>A wrapper without a tone stays invisible to the reader.</p>") +
  "<p>Text after the wrappers.</p>";

/**
 * Callout tones of a Wrapper for the reader: a soft background and a 3 px stripe on the
 * left, and the text is ordinary Document text. A Wrapper has no role or `aria-*`: the
 * meaning of the note is carried by a word in its text.
 */
export const WrapperTones: Story = {
  render: () => (
    <div className="max-w-[640px]">
      <RichTextView html={WRAPPER_TONES_HTML} />
    </div>
  ),
};

/** Callout tones of a Wrapper on a light Paper (`surface="paper"`), in any app theme. */
export const WrapperTonesPaper: Story = {
  render: () => (
    <div className="max-w-[640px]">
      <RichTextView html={WRAPPER_TONES_HTML} surface="paper" />
    </div>
  ),
};

/*
  Video in the View (OLDSUI-281, ADR-0071): the block arrives as a link, and the kit's
  Island puts the player in its place right away (OLDSUI-287). With `autoload: false` in
  `tools`, it shows a placeholder, and the player loads after a click. The sample is the
  same one as in the Editor's `Video` story.
*/
const VIDEO_HTML =
  "<h2>Video</h2><p>Without JavaScript a reader sees the links below.</p>" +
  '<div data-block="video" data-provider="youtube" data-src="https://www.youtube.com/watch?v=dQw4w9WgXcQ">' +
  '<a href="https://www.youtube.com/watch?v=dQw4w9WgXcQ" rel="noopener noreferrer">https://www.youtube.com/watch?v=dQw4w9WgXcQ</a></div>' +
  '<div data-block="video" data-provider="twitch" data-src="https://www.twitch.tv/aws">' +
  '<a href="https://www.twitch.tv/aws" rel="noopener noreferrer">https://www.twitch.tv/aws</a></div>' +
  "<p>Text after the videos.</p>";

/**
 * Video in the View: no engine. The player appears immediately; Twitch takes this page's
 * domain as `parent` when it is shown.
 */
export const Video: Story = {
  // Lazy chunks (KaTeX, player, Island): the snapshot and the audit wait for network silence.
  tags: ["network-idle"],
  render: () => (
    <div className="max-w-[640px]">
      <RichTextView html={VIDEO_HTML} />
    </div>
  ),
};

/**
 * `tool("youtube", { autoload: false })` and `tool("twitch", { autoload: false })` in the View's
 * `tools`: a placeholder with a "Play" button. No request goes to the service until the click.
 */
export const VideoClickToPlay: Story = {
  // Lazy chunks (KaTeX, player, Island): the snapshot and the audit wait for network silence.
  tags: ["network-idle"],
  render: () => (
    <div className="max-w-[640px]">
      <RichTextView
        html={VIDEO_HTML}
        tools={[tool("youtube", { autoload: false }), tool("twitch", { autoload: false })]}
      />
    </div>
  ),
};

/** Video on a light Paper (`surface="paper"`). */
export const VideoPaper: Story = {
  // Lazy chunks (KaTeX, player, Island): the snapshot and the audit wait for network silence.
  tags: ["network-idle"],
  render: () => (
    <div className="max-w-[640px]">
      <RichTextView html={VIDEO_HTML} surface="paper" />
    </div>
  ),
};
