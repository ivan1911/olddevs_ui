/**
 * Editor Tools: one capability is one Toolbar button and one Schema extension.
 *
 * WHY THE BUTTON AND THE EXTENSION SHARE ONE NAME. A hidden button with the extension
 * still enabled forbids nothing: the underline would arrive by pasting from Word, with
 * `Ctrl+U`, or with a markdown shortcut. So a disabled Tool removes both (the spec, section
 * "Tool set"), and the extension set is built from the same set as the Toolbar
 * (`extensions.ts`).
 *
 * THE NAME COMES INTO THE TYPE WITH THE TOOL, NOT EARLIER. The type is an input type: the
 * consumer passes values and does not parse them, so extending the union with a new name is
 * not a breaking change for it. But a name with no implementation would be a silent trap:
 * `tools={["x"]}` would compile and do nothing. This is how `link`, `color`, `highlight`,
 * `align`, `table`, `image`, `emoji`, `layout`, `wrapper`, `details`, `mathematics`,
 * `invisibleCharacters`, `source`, `typography`, `youtube` and `twitch` arrived; there are no
 * reserved names at the moment.
 *
 * `heading1` is the first-level heading, an add-on over `heading`: with it, the Block's levels
 * are 1–4; without it, 2–4. It is a separate Tool because on a screen the page's heading often
 * already sits above the Editor, and a second H1 there is a structure error (WCAG 1.3.1), while
 * a document without its own page (a note, an article in a knowledge base) gives its author no
 * other way to set a main heading. Without `heading` it does not exist at all: levels belong only
 * to the heading Block.
 *
 * `insertMenu` is the Slash menu (`/` in the text and the "+" on the Toolbar). It has no Block of
 * its own, like `clearFormatting`: it is a way to reach other Blocks, and it is switched off for
 * the sake of a field where `/` is an ordinary character (paths, "and/or"). Menu items come from
 * the enabled Tools (`insertItems.ts`).
 *
 * `emoji` is the Toolbar button with an emoji grid (`EmojiGrid`). It has no Schema of its own,
 * like `clearFormatting`: an emoji is ordinary text, so the Schema, the sanitizer and Markdown do
 * not change. It is not in `basic`: in a comment, the OS's own emoji palette is the closer fit,
 * and the button would take space from the short row.
 *
 * `layout` is the Column layout, a Block of columns (`layout.ts`). It has no Toolbar button: it is
 * inserted from the Slash menu and from the Block handle menu. A disabled Tool removes the nodes
 * from the Schema, and a Column layout from an insert unwraps into its Blocks one after another.
 * It is not in `basic`: in a comment, columns are layout, not text.
 *
 * `wrapper` is the Wrapper, a Block that groups other Blocks (`wrapper.ts`), like Redactor's
 * Wrapper. It has no Toolbar button either, only the Slash menu and the Block handle menu. A
 * disabled Tool unwraps a Wrapper from an insert and from `value` into its Blocks one after
 * another. It is not in `basic`, for the same reason as the Column layout.
 *
 * `details` is the collapsible Block: a title (`summary`) and content made of Blocks
 * (`details.ts`), with an API based on the Details extension from Tiptap (ADR-0048: no customer
 * had asked for it at release). It has no Toolbar button, only the Slash menu and the Block handle
 * menu. A disabled Tool unwraps the Block from an insert and from `value`: the title becomes a
 * paragraph, and the content follows as Blocks. It is in `full` but not in `basic`, for the same
 * reason as the Column layout and the Wrapper. The open state is written into the Document by the
 * `tool("details", { persist: true })` option.
 *
 * `mathematics` is LaTeX formulas, inline and block, on the Mathematics extension from Tiptap
 * (ADR-0070; ADR-0048: no customer had asked for it at release). It has no Toolbar button: it is
 * inserted from the Slash menu items ("Formula" and "Block formula") and opened by a click or Enter
 * on a formula, which edits it in the kit's popover. The Document holds only the source LaTeX
 * (`data-latex`); KaTeX renders it: in the Editor as a node view, in `RichTextView` as an Island.
 * KaTeX is heavy, so the Tool is lazy: its engine parts and KaTeX with its CSS are loaded by the
 * Loader (ADR-0058, item 11.1). It is not in the presets, neither `full` nor `basic`: presets must
 * not load KaTeX; it is enabled by an explicit entry in `tools`. A disabled Tool leaves a formula
 * from an insert and from `value` as the text `$…$` / `$$…$$`, so the LaTeX is not lost.
 *
 * `source` is Source mode: the "HTML" button on the fixed Toolbar replaces the Document with a field
 * holding its HTML, and on exit the field's content is applied through the Schema, like an
 * incoming `value`. It has no Schema of its own, like `clearFormatting`: the Schema governs the
 * markup, and the mode does not extend it. It is not in `basic`: in a comment, an "HTML" button
 * without an explicit request from the screen is superfluous.
 *
 * `toc` is the Table of contents in the frame's left margin (ADR-0068): the strip and the
 * `RichTextToc` list, sticky under the Toolbar or in a scrolling field. It has no Schema. It is
 * configured with `tool("toc", { offsetVar, levels, listWidth })`. It is not in the presets,
 * neither `full` nor `basic`: it changes the field's layout, and a kit update must not shift the
 * text where nobody asked for that.
 *
 * `typography` is typing replacements: straight quotes become the quotes of the message catalog's
 * language (guillemets for ru, curly quotes for en), a dash, an ellipsis, arrows, and the other
 * rules of the Typography extension from Tiptap (ADR-0048). Input rules only: the Schema, the
 * sanitizer and Markdown do not change, and `value` gets plain characters. It is not in the presets,
 * neither `full` nor `basic`: it changes the text being typed, and a kit update must not do that
 * where nobody asked for it. The rules and the quote set are set by
 * `tool("typography", { quotes, emDash, … })`.
 *
 * `youtube` and `twitch` are video by link (ADR-0071; based on the Youtube and Twitch extensions
 * from Tiptap, ADR-0048: no customer had asked for them at release). They share one `video` Block:
 * the Document holds a link to the video, and the kit renders the player at display time, as a
 * placeholder with a "Play" button, with no request to the service until a click. Which services
 * are allowed is decided by the `tools` set: `youtube`, `twitch`, or both. There is no Toolbar
 * button: a single "Video" item in the Slash menu, and a bare link in an empty paragraph. A
 * disabled service unwraps the Block from an insert and from `value` into its link. They are not in
 * the presets, neither `full` nor `basic`: the player loads a third-party service (CSP `frame-src`,
 * privacy), and a kit update must not do that where nobody asked for it.
 *
 * `search` is find and replace across the Document: the "Find" button on the fixed Toolbar and
 * `Mod+F` in the field open the panel in the field's corner. It has no Schema of its own, like
 * `clearFormatting`. It is also in `basic`: searching a long description is needed there too, and
 * the button at the right edge does not make the row longer. The panel's starting flags are set by
 * the `tool("search", { matchCase, wholeWord, regex })` entry.
 *
 * `invisibleCharacters` shows spaces, soft hyphens and paragraph ends (based on the Invisible
 * Characters extension from Tiptap, ADR-0048: no customer had asked for it at release). It is a
 * Decoration over the Document: the Schema, the sanitizer, Markdown and the saved HTML do not change.
 * The "Invisible characters" checkbox item sits in the "…" menu of the fixed Toolbar, as its last
 * section. There is no separate button, because it pushed `full` onto a second row; the floating
 * Toolbar and the Bubble menu have no such item. It is in `full`, not in `basic`: a comment does not
 * need this mode. But in `full` the characters stay hidden until the author turns display on: the
 * starting display is set by the `tool("invisibleCharacters", { visible: true })` option.
 *
 * `blockSelection` is Block selection (ADR-0077): several Blocks selected whole, as in Notion. `Esc` in
 * the text selects the current Block, `Shift+↑/↓` and `Shift+click` grow the selection, and then
 * `Backspace`, `⌘C`, `⌘X`, `⌘V`, `⌘⇧D` and `⌥⇧↑/↓` act on the Blocks. It has no Schema of its own, like
 * `clearFormatting`: the Document, the sanitizer and Markdown do not change. It is in `full`, not in
 * `basic`: it takes the first `Esc` in the text, so a field in a `Dialog` closes on the second one,
 * and a comment field keeps the usual "one `Esc` closes the window". The Block handle's menu over
 * several Blocks (the text selection across them) is not a Tool: it is in every Editor.
 *
 * `fullscreen` expands the field to the whole window (ADR-0082): a layer of the kit above the page,
 * not the browser's Fullscreen API, so it works inside a `Dialog` and on iOS. It is a view only: the
 * same engine and history, the Toolbar on top, the Status bar at the bottom, a column of text in
 * the middle. "Fullscreen" is a checkbox item in the "…" menu, `Esc` collapses one level at a time,
 * and the Tool has no Schema. `focus` is the focus mode: the Blocks around the current one (by the
 * Block unit of ADR-0077) are shown in secondary color. A view too, with no Schema, no Markdown and
 * no change to `value`. They are two Tools because the focus mode is useful in an ordinary field.
 * Both are in `full`, not in `basic`; the focus mode is off until the author turns it on, or the
 * `tool("focus", { enabled: true })` option does.
 */
export const TOOLS = [
  "history",
  "heading",
  "heading1",
  "bold",
  "italic",
  "underline",
  "strike",
  "code",
  "superscript",
  "subscript",
  "clearFormatting",
  "link",
  "color",
  "highlight",
  "align",
  "language",
  "bulletList",
  "orderedList",
  "taskList",
  "blockquote",
  "codeBlock",
  "horizontalRule",
  "table",
  "image",
  "layout",
  "wrapper",
  "details",
  "mathematics",
  "emoji",
  "source",
  "search",
  "invisibleCharacters",
  "blockSelection",
  "fullscreen",
  "focus",
  "insertMenu",
  "typography",
  "pasteCleanup",
  "toc",
  "youtube",
  "twitch",
] as const;

/** Name of an Editor Tool. The list and the meaning of each one are on the component's page. */
export type Tool = (typeof TOOLS)[number];

/** Ready-made set of Tools. */
export type RichTextEditorPreset = "full" | "basic";

/**
 * Composition of the presets.
 *
 * `basic` is for comments and short descriptions: marks without underline and sub- and
 * superscript, a link, two kinds of lists, a quote, and the edit history.
 *
 * The Slash menu is not in `basic`: in a comment, `/` more often means "and/or" or a path
 * than a command, and of the Blocks there only lists and a quote are included. For those, a
 * markdown shortcut is closer than the menu.
 */
export const PRESETS: Record<RichTextEditorPreset, readonly Tool[]> = {
  // Everything built in except the Table of contents, typography, formulas and video: they are
  // enabled only explicitly (ADR-0068; formulas load KaTeX, ADR-0070; video is a third-party player, ADR-0071).
  full: TOOLS.filter(
    (tool) =>
      tool !== "toc" &&
      tool !== "typography" &&
      tool !== "mathematics" &&
      tool !== "youtube" &&
      tool !== "twitch"
  ),
  basic: [
    "history",
    "bold",
    "italic",
    "strike",
    "code",
    "link",
    "bulletList",
    "orderedList",
    "blockquote",
    "search",
    "pasteCleanup",
  ],
};

/**
 * Presets are exported as arrays (ADR-0058, item 1.2): a custom set is assembled from them, for
 * example `[...RICH_TEXT_PRESETS.full, mergeTagTool]`. The copies are frozen: `PRESETS.full` is
 * almost all of `TOOLS`, and if a consumer changed the array, the kit's set would change in every
 * Editor on the page. The composition of a preset is not a contract (ADR-0058, item 12.5): a
 * stable set is the exact list of names.
 */
export const RICH_TEXT_PRESETS: Readonly<Record<RichTextEditorPreset, readonly Tool[]>> =
  Object.freeze({
    full: Object.freeze([...PRESETS.full]),
    basic: Object.freeze([...PRESETS.basic]),
  });

/**
 * Enabled Tools: the exact `tools` list if one is passed, otherwise the preset. The Editor does
 * not take them from here; it takes a list of descriptions (`expandTools`, `features/builtins.ts`),
 * which is built from these names.
 *
 * Unknown names are dropped silently: they come from JS without types, or from a name of a later
 * slice in an older kit version. There is no point in throwing an error over an extra name: no extra Tool
 * will appear in the Editor because of it.
 */
export function resolveTools(
  preset: RichTextEditorPreset,
  tools: readonly Tool[] | undefined
): ReadonlySet<Tool> {
  const known = new Set<string>(TOOLS);
  return new Set((tools ?? PRESETS[preset] ?? PRESETS.full).filter((tool) => known.has(tool)));
}
