import { CODE_LANGUAGE_IDS } from "../features/code/codeLanguages.js";
import { EDITOR_LAYOUTS } from "../features/layout/columnLayouts.js";
import { CUSTOM_COLOR_STYLE_PATTERN } from "../features/color/customColor.js";
import { normalizeLanguageTag } from "../features/language/languageTag.js";
import { safeLatexSource } from "../features/mathematics/mathHtml.js";
import { BLOCK_FORMULA_TYPE, INLINE_FORMULA_TYPE } from "../features/mathematics/mathNames.js";
import { devWarn } from "../../lib/dev-warn.js";
import type { CustomAttribute, PrefixedName, ToolEntry } from "./customTool.js";
import { customToolOf } from "./toolDefinition.js";
import {
  EDITOR_ALIGNMENTS,
  EDITOR_MARKER_NAMES,
  EDITOR_TEXT_COLOR_NAMES,
  LEGACY_MARKER_NAMES,
} from "../styles/palette.js";
import { EDITOR_WRAPPER_TONES } from "../features/wrapper/wrapperTones.js";
import { isVideoProvider, isVideoSrc, VIDEO_BLOCK } from "../features/video/videoSrc.js";

/**
 * The Editor's Schema as DATA: an allowlist of the tags and attributes it accepts and returns.
 *
 * WHY A SEPARATE LIST WHEN THE EXTENSIONS ALREADY DEFINE THE SCHEMA. Tiptap extensions describe
 * the schema in code, and neither a person nor a sanitizer can read "what may arrive in HTML"
 * from them. The consumer needs exactly that answer: sanitizing on the server is its
 * responsibility (ADR-0050), and the cleanup (`sanitizeRichText` below) is built by the kit from
 * this list, not from the source. That the list matches what the Editor actually returns is
 * guarded by `tests/rich-text-editor-schema.test.tsx`, in both directions.
 *
 * The list grows together with the set of Blocks and Marks. It is published on the
 * `RichTextView` page, and the table there is checked against this file by a test
 * (`tests/rich-text-view.test.tsx`). There is no `style` attribute in it, except for one narrow
 * exception: the arbitrary color (`customColor` below). A palette color and alignment are written
 * to `data-*` (spec, "Schema and security").
 *
 * The module is safe to run on the server: it is data, without React and without the engine. Its
 * imports `palette.ts`, `customColor.ts`, `codeLanguages.ts`, `columnLayouts.ts` and
 * `wrapperTones.ts` are data too: the palette names, the languages, the Column layout variants
 * and the Wrapper tones live there once. `videoSrc.ts` holds the video names and the check of
 * a video address (pure functions over a string). Also `lib/dev-warn.ts`, a developer warning
 * with no dependencies.
 */
export const RICH_TEXT_SCHEMA = {
  /**
   * Blocks. `h1` is allowed only with the `heading1` Tool: a screen whose page title sits above
   * the Editor turns it off, and then the Editor does not return `h1`. The schema data lists
   * everything the kit CAN return, not what it returns for a given `tools` set.
   * `pre` is a code Block, with `code` inside it. `figure` is an image: it contains `img` and,
   * if the caption is not empty, `figcaption`. Outside `figure` the Editor returns neither `img`
   * nor `figcaption`.
   *
   * `label`, `input`, `span` and `div` are the markup of a task item, as Tiptap writes it:
   * `<li data-type="taskItem"><label><input type="checkbox"><span>
   * </span></label><div>…</div></li>`. Outside a task item the Editor does not return them, and
   * `sanitizeRichText` keeps them there too, with a hook on the ancestor.
   *
   * A `div` with `data-block` is a Column layout: `div[data-block="layout"]` with the variant in
   * `data-layout`, containing one to four `div[data-block="column"]`. A column holds Blocks,
   * except another Column layout. A Column layout is only a top-level Block: not inside a
   * column, a Wrapper, a list, a quote, a cell or a Details Block. Column widths are set by the variant, not by
   * `style` (`layouts` below).
   *
   * `div[data-block="wrapper"]` is a Wrapper, a group of Blocks, as in Redactor. Its tone, if
   * any, is in `data-tone` (`wrapperTones` below). It sits at the top level and directly in a
   * Column layout column. Inside it are Blocks, except another Wrapper and a Column layout.
   *
   * `details` is a collapsible Block: `details > summary`, followed by
   * `div[data-type="detailsContent"]` with Blocks. `open` is only on `details`, and only empty
   * (`open=""`), as the Editor writes it with the `persist` option. `summary` outside `details`
   * and a content wrapper outside it are removed; the Blocks stay in place. The tags and
   * attributes of this Block are allowed only in this form: `iframe` and the like are not
   * allowed this way.
   *
   * `div[data-block="video"]` is a video by link (ADR-0071): `data-provider` (`youtube` or
   * `twitch`), and `data-src`, an `https` address of the video in the canonical form the Editor
   * writes, on this service's host (YouTube: `www.youtube.com`, `watch?v=` or
   * `playlist?list=`; Twitch: `www.twitch.tv` and `clips.twitch.tv`). Short forms (`youtu.be`),
   * an address without `www.`, `http`, and player addresses do not pass (`isVideoSrc`). Inside
   * is an ordinary link. There is no player in the Document, and `iframe` is still removed: the
   * kit renders the player when the Document is shown.
   *
   * Formulas: `span[data-type="inline-math"]` inline and `div[data-type="block-math"]` as a Block,
   * with the LaTeX source in `data-latex` (ADR-0070). Both elements are always empty: the
   * rendered KaTeX markup does not get into the Document. The Editor and the `RichTextView`
   * Island render it. The `data-type` and `data-latex` pair is allowed only on these two tags;
   * `data-latex` is the only attribute value where `<` is allowed.
   *
   * A table is `table > tbody > tr > th|td`, without `thead`, `colgroup` or `caption`: a header
   * row is an ordinary first row of `th` cells. A cell carries only merging (`colspan`,
   * `rowspan`) and column alignment (`data-align`). Column widths are not built, and `style` and
   * `colwidth` never appear in the output. The HTML parser drops `tbody`, `tr`, `th` and `td`
   * outside a table on its own, so no hook is needed for that.
   */
  blocks: [
    "p",
    "h1",
    "h2",
    "h3",
    "h4",
    "ul",
    "ol",
    "li",
    "blockquote",
    "hr",
    "pre",
    "table",
    "tbody",
    "tr",
    "th",
    "td",
    "label",
    "input",
    "span",
    "div",
    "figure",
    "img",
    "figcaption",
    "details",
    "summary",
  ],
  /**
   * Marks and inline nodes. `br` is a soft line break on Shift+Enter. `mark` is a marker, always
   * with `data-color`. `span` with `data-color` is a text color (the tag is named in `blocks`
   * too, where it is task item markup), and `span` with `lang` is a language of a fragment. `a`
   * is a link, its address limited to the schemes in `protocols`.
   */
  marks: ["strong", "em", "u", "s", "code", "sup", "sub", "mark", "br", "a"],
  /** Attributes by tag. Anything not listed here does not appear in the output. */
  attributes: {
    /** The number of the first item, only when it is not 1. */
    ol: ["start"],
    /** Task list: `data-type="taskList"`. */
    ul: ["data-type"],
    /**
     * Column layout and its column: `data-block="layout"` and `data-block="column"`.
     * `data-layout` is a variant from `layouts`, only on a Column layout. A Wrapper is
     * `data-block="wrapper"` and, if it has a tone, `data-tone`, a name from `wrapperTones`,
     * only on a Wrapper. The content wrapper of a Details Block is `data-type="detailsContent"`,
     * only directly inside `details`. A block formula is `data-type="block-math"` with
     * `data-latex`, only on a `div`. A video by link is `data-block="video"` with `data-provider`
     * (the service) and `data-src` (a link to a video of that service, `isVideoSrc`). A `div` of
     * a task item has no attributes.
     */
    div: [
      "data-block",
      "data-layout",
      "data-tone",
      "data-type",
      "data-provider",
      "data-src",
      "data-latex",
    ],
    /** An open Details Block: an empty `open`, only with the `persist` option. */
    details: ["open"],
    /** Task item: `data-type="taskItem"` and `data-checked="true|false"`. */
    li: ["data-type", "data-checked"],
    /** Checkbox of a task item: always `type="checkbox"`, `checked` on a checked one. */
    input: ["type", "checked"],
    /**
     * Language of a code Block: only `language-<name>`, with a name from `codeLanguages`, and
     * only on `code` inside `pre`. Syntax highlighting is not written into the Document: the
     * `hljs-*` tokens live as Editor Decorations (ADR-0051). The Editor returns no other classes,
     * and a Block without a language is a bare `<code>` with no class.
     */
    code: ["class"],
    /**
     * Text color and marker: a name in `data-color` OR an arbitrary color in `style`
     * (`customColor`). The two never sit together on one element. There are two palettes:
     * `span[data-color]` takes a name from `textColors`, `mark[data-color]` a name from
     * `markerColors`. A name from the other palette is not accepted on a tag. The Editor returns
     * no other name, and on load it drops such a name along with its wrapper. It converts old
     * marker names (`legacyMarkerColors`). A `span` without `data-color` and without `style` never
     * occurs either: an empty `span` exists only in a task item and in an inline formula
     * (`data-type="inline-math"` with `data-latex`, only on `span`).
     *
     * `span[lang]` is the Text part language Mark (ADR-0078): a standard attribute, the first one in
     * the Schema that is not `data-*`, so that a screen reader, spell checking and hyphenation read
     * it without the kit's code. Its value is NOT a list: any tag of the BCP 47 SHAPE passes
     * (`languageTag.ts`), because HTML with `lang="de"` arrives from other screens and from Word, and
     * the server's sanitizer has no Options of the screen. It may sit next to `data-color` on one
     * element, and an element with only `lang` is kept, not unwrapped.
     */
    span: ["data-color", "style", "data-type", "data-latex", "lang"],
    mark: ["data-color", "style"],
    /**
     * Block alignment: a value from `alignments`, except `left`. `left` is the default, and the
     * Editor does not write it (it reads it as the attribute being absent).
     */
    p: ["data-align"],
    /**
     * Table cell: merging is `colspan` and `rowspan`, an integer greater than 1 and not above
     * `tableSpans` (the Editor does not write 1, it is the default). Column alignment is
     * `data-align` with a value from `alignments`, except `left`, on every cell of the column.
     */
    th: ["colspan", "rowspan", "data-align"],
    td: ["colspan", "rowspan", "data-align"],
    h1: ["data-align"],
    h2: ["data-align"],
    h3: ["data-align"],
    h4: ["data-align"],
    /**
     * Link: `href` only with a scheme from `protocols`, `rel` always `"noopener noreferrer"`.
     * The Editor does not return `target`: opening a new tab is the decision of the page that
     * shows the Document, not of the Document's data.
     */
    a: ["href", "rel"],
    /**
     * Image: `src` only an absolute `http` or `https` URL (`imageProtocols`). `alt` is always
     * present, empty for an image with no description. `data-width` is a value from `imageWidths`,
     * only on an image with a set width.
     */
    img: ["src", "alt", "data-width"],
  },
  /**
   * Allowed values of `span[data-color]`, the text color: six status tones. `sanitizeRichText`
   * removes a value outside the list together with the attribute. DOMPurify's `ALLOWED_ATTR`
   * does not check values, so the check has to be done per tag: a marker name is not valid on
   * a `span`.
   */
  textColors: EDITOR_TEXT_COLOR_NAMES,
  /**
   * Allowed values of `mark[data-color]`, the marker: nine color names. The same rules as
   * `textColors`, with its own tag.
   */
  markerColors: EDITOR_MARKER_NAMES,
  /**
   * Legacy names of `mark[data-color]`: six text color names that the marker used before the
   * Notion-style palette, and the color the Editor converts them to on load and on paste.
   * `sanitizeRichText` does the same BEFORE the check against `markerColors`. Otherwise the
   * highlight of a saved Document would disappear. There is no conversion on `span`.
   */
  legacyMarkerColors: LEGACY_MARKER_NAMES,
  /**
   * The ONLY place in a Document where `style` occurs: the arbitrary color the author selected
   * in `ColorPicker`. The exception is narrow and was approved by the owner: an author's color
   * has no name, and the carrier of the value in HTML is `style`.
   *
   * `styles` is a regular expression (as a string) matched against the WHOLE attribute value, per
   * tag: `span` takes only `color:#rrggbb`, `mark` only `background-color:#rrggbb`. Lowercase
   * letters, six digits, no spaces or `;`, nothing else. The Editor drops any other `style` on
   * load and on paste, and `sanitizeRichText` removes it. DOMPurify's `ALLOWED_ATTR` does not
   * check values, so in a bare `richTextSanitizeConfig()` there is no `style` at all. `style`
   * never occurs together with `data-color` on one element.
   *
   * An author's color does NOT follow the theme, unlike `textColors` and `markerColors`:
   * `#ff0000` is the same in `dark`, `light` and `dim`, and the contrast may fail on one of
   * the themes.
   */
  customColor: {
    styles: CUSTOM_COLOR_STYLE_PATTERN,
  },
  /**
   * Code Block languages: the names after `language-` in the `class` of `<pre><code>`. The
   * Editor maps aliases (`py`, `yml`) to the name on load, and an unknown language to a Block
   * without a class. `sanitizeRichText` removes a `class` whose value is outside this list,
   * aliases included.
   */
  codeLanguages: CODE_LANGUAGE_IDS,
  /** Allowed values of `data-align`. `left` is read, but never written. */
  alignments: EDITOR_ALIGNMENTS,
  /**
   * Column layout variants: the values of `div[data-layout]`, the column shares in percent,
   * separated by hyphens (`50-50`, `60-40`, `25-25-25-25`). The Editor maps the number of columns
   * of a Column layout to a variant on load. The server does not recalculate it, and an extra or
   * a missing column does not break the display.
   */
  layouts: EDITOR_LAYOUTS,
  /**
   * Wrapper Callout tones: the values of `div[data-tone]`, the names from the kit's `Tone`
   * vocabulary. Without a tone there is no attribute. The Editor drops a name outside the list
   * on load (the Wrapper stays), and `sanitizeRichText` removes the attribute. The color comes
   * from the theme, as with `data-color`: HTML has neither `style` nor an ARIA role.
   */
  wrapperTones: EDITOR_WRAPPER_TONES,
  /**
   * Link address schemes. Absolute addresses only: `javascript:`, `data:` and other schemes are
   * not accepted from `value`, from paste, or from the popover.
   *
   * WHY NO RELATIVE ADDRESSES (`/docs`, `#part`, `page.html`). A Document is data that travels
   * away from the screen where it was written: to `RichTextView` on another route, into an
   * email, into Markdown, into a neighboring product on another domain. A relative address there
   * means something else or nothing. Anchors in the Document have nothing to point to, because
   * headings have no `id`. Also, an address without a scheme in the popover is unambiguous:
   * `example.com` is `https://example.com`, not a path from the current page. The rule can be
   * loosened later without breaking saved content. Tightening it would no longer be possible.
   */
  protocols: ["http", "https", "mailto"],
  /**
   * Image address schemes are stricter than link schemes: `mailto:` is never an image, and `data:`
   * and `blob:` are never written (spec, "Schema and security"). `data:` is base64 inside the
   * Document: megabytes in the consumer's database and in every `onChange`. `blob:` is an address
   * that lives only in the tab where it was created, so after saving it leads nowhere.
   */
  imageProtocols: ["http", "https"],
  /**
   * Image width is the share of the Document's width in percent: `data-width="50"`. Without the
   * attribute the image is shown at its own size, but not wider than the Document. Presets rather
   * than any number: the mouse resize handles snap to them, and the same set is available from
   * the keyboard in the image popover.
   */
  imageWidths: ["50", "75", "100"],
  /**
   * Cell merge limit: `colspan` no more than 20, `rowspan` no more than 50, the same as the number
   * of columns and rows of the largest table the Editor pastes. On load and on paste the Editor
   * reads a value above the limit, zero, a fraction or a non-number as 1: the cell stays, and the
   * merge is undone. The sanitizer should remove the attribute: `colspan="10000"` means ten
   * thousand empty cells for everyone who opens the table.
   */
  tableSpans: { colspan: 20, rowspan: 50 },
} as const satisfies {
  blocks: readonly string[];
  marks: readonly string[];
  attributes: Readonly<Record<string, readonly string[]>>;
  textColors: readonly string[];
  markerColors: readonly string[];
  legacyMarkerColors: Readonly<Record<string, string>>;
  codeLanguages: readonly string[];
  customColor: { readonly styles: Readonly<Record<string, string>> };
  alignments: readonly string[];
  layouts: readonly string[];
  wrapperTones: readonly string[];
  protocols: readonly string[];
  imageProtocols: readonly string[];
  imageWidths: readonly string[];
  tableSpans: { readonly colspan: number; readonly rowspan: number };
};

/**
 * Schema rules of a custom Block: the data from its custom Tool's description (`CustomBlock`),
 * with the defaults filled in. The Block traits are not here: they are Editor behavior, not what
 * may arrive in HTML.
 */
export interface RichTextCustomBlockRules {
  /** Block-level: `div[data-block="<name>"]`. Inline: `span[data-block="<name>"]`. */
  kind: "block" | "inline";
  /** `top` means only the top level of the Document (possible only for a block-level Block). */
  place: "anywhere" | "top";
  /** Its own attributes: the name without `data-` maps to the kind of value. */
  attributes: Readonly<Record<PrefixedName, CustomAttribute>>;
}

/** Schema rules of a custom Mark: `span[data-mark="<name>"]` and its attributes. */
export interface RichTextCustomMarkRules {
  attributes: Readonly<Record<PrefixedName, CustomAttribute>>;
}

/** The Schema as data with the rules of custom Tools: the result of `richTextSchema(tools)`. */
export type RichTextSchema = typeof RICH_TEXT_SCHEMA & {
  /** Custom Blocks and inline atoms, by Block name. */
  customBlocks: Readonly<Record<PrefixedName, RichTextCustomBlockRules>>;
  /** Custom Marks, by Mark name. */
  customMarks: Readonly<Record<PrefixedName, RichTextCustomMarkRules>>;
};

/**
 * A name of a custom Block, Mark or Tool: the Consumer prefix (a letter, then letters and
 * digits), an underscore, and the rest of the word, for example `acme_mergeTag`. Kit names never
 * contain an underscore, so custom and built-in names never collide.
 *
 * @internal The Editor's tool set also checks names with it (`customToolEngine.ts`).
 */
export const CUSTOM_NAME = /^[A-Za-z][A-Za-z0-9]*_\w+$/;
/**
 * The name of a custom attribute: the same, but in lowercase, because HTML attribute names are
 * case-insensitive.
 *
 * @internal
 */
export const CUSTOM_ATTRIBUTE_NAME = /^[a-z][a-z0-9]*_[a-z0-9_]+$/;

/**
 * The HTML convention of a custom rule (ADR-0058, item 2). A block-level Block is a `div`. An
 * inline Block and a Mark are a `span`. A Block is marked with `data-block`, a Mark with
 * `data-mark`, and the value is the name. One place for the Editor (`customToolEngine.ts`:
 * parsing, output, the check against `renderHTML`) and for the sanitization on the server.
 *
 * @internal
 */
export function customElement(kind: "block" | "inline" | "mark"): {
  tag: "div" | "span";
  marker: "data-block" | "data-mark";
} {
  return {
    tag: kind === "block" ? "div" : "span",
    marker: kind === "mark" ? "data-mark" : "data-block",
  };
}

/** Custom attributes with a valid name. The server ignores the rest. */
function customAttributes(
  attributes: Readonly<Record<string, CustomAttribute>> | undefined
): Record<PrefixedName, CustomAttribute> {
  return Object.fromEntries(
    Object.entries(attributes ?? {}).filter(([name]) => CUSTOM_ATTRIBUTE_NAME.test(name))
  );
}

/**
 * The Editor's Schema as data for the `tools` set: the same array the Editor receives (ADR-0058,
 * item 2.3). It is the kit's Schema plus the rules of its custom Blocks and Marks.
 *
 * KIT NAMES ARE NOT NARROWED BY THE ALLOWLIST. The kit's Schema is still everything the kit can
 * return, for any set: screens with `basic` and `full` write one Document, and the server may not
 * strip what another one wrote. Descriptions of custom Tools only add rules. Without an argument
 * it returns the kit's Schema with no custom rules. The `RICH_TEXT_SCHEMA` constant itself does
 * not change.
 *
 * Rules whose name has no Consumer prefix are not read here. The Editor rejects such a set with
 * a field error, but the server has no error channel. So a description named like a kit name
 * (`wrapper`, or an attribute `tone`) must not open a way around the kit's rules.
 *
 * Only the description's data (`blocks`, `marks`) is read. Extensions are not touched: the module
 * with a custom Tool's description is imported on the server, and Tiptap is not needed there.
 */
export function richTextSchema(tools: readonly ToolEntry[] = []): RichTextSchema {
  const customBlocks: Record<PrefixedName, RichTextCustomBlockRules> = {};
  const customMarks: Record<PrefixedName, RichTextCustomMarkRules> = {};
  for (const entry of tools) {
    // A string is a kit name; a configured built-in carries its options, and has no Schema.
    const tool = customToolOf(entry);
    if (!tool) continue;
    for (const [name, block] of Object.entries(tool.blocks ?? {})) {
      if (!CUSTOM_NAME.test(name)) continue;
      const kind = block.kind === "inline" ? "inline" : "block";
      customBlocks[name as PrefixedName] = {
        kind,
        place: kind === "block" && block.place === "top" ? "top" : "anywhere",
        attributes: customAttributes(block.attributes),
      };
    }
    for (const [name, mark] of Object.entries(tool.marks ?? {})) {
      if (CUSTOM_NAME.test(name)) {
        customMarks[name as PrefixedName] = { attributes: customAttributes(mark.attributes) };
      }
    }
  }
  return { ...RICH_TEXT_SCHEMA, customBlocks, customMarks };
}

/**
 * The HTML attribute names of the custom rules: `data-mark` and `data-<name>` for each custom
 * attribute.
 */
function customAttributeNames(schema: RichTextSchema): string[] {
  const rules = [...Object.values(schema.customBlocks), ...Object.values(schema.customMarks)];
  return [
    ...(Object.keys(schema.customMarks).length > 0 ? ["data-mark"] : []),
    ...rules.flatMap((rule) => Object.keys(rule.attributes).map((name) => `data-${name}`)),
  ];
}

/**
 * Schema attributes and tags that are unsafe without a check by tag and by value.
 *
 * DOMPurify's `ALLOWED_ATTR` is one list for all tags, and it does not check values. For most
 * Schema attributes this is harmless: `data-color` on a `<p>` or `start` on a `<ul>` paints
 * nothing and executes nothing. For these it is not harmless. `style` would pass any CSS, for
 * example `position:fixed` over the page. `class` would pass any Tailwind class of the consumer
 * (`fixed inset-0 z-50`). DOMPurify passes `src` on `<img>` with `data:` past `ALLOWED_URI_REGEXP`.
 * `colspan="10000"` means ten thousand empty cells for every reader. `type` and `checked` turn a
 * checkbox into any input field. And `<input>` and `<img>` without their own attributes are an
 * empty text field and a broken image.
 *
 * So they are allowed ONLY together with the `sanitizeRichText` hooks, which check the tag and the
 * value. A bare `richTextSanitizeConfig()` does not know them.
 */
const HOOK_GUARDED_ATTRIBUTES: readonly string[] = [
  "style",
  "class",
  "src",
  "colspan",
  "rowspan",
  "type",
  "checked",
  // The video address: a third-party lazy-loading script reads `data-src` in particular.
  "data-src",
  // The language of a fragment: only a tag of the BCP 47 shape on a `span` (ADR-0078).
  "lang",
];
const HOOK_GUARDED_TAGS: readonly string[] = ["input", "img"];

/** Schema attributes that carry an address: DOMPurify checks them against `ALLOWED_URI_REGEXP`. */
const URI_ATTRIBUTES: readonly string[] = ["href", "src"];

/**
 * The DOMPurify cleanup config, CLOSED BY DEFAULT. The safe path is `sanitizeRichText(html,
 * DOMPurify)` below: it installs the Schema hooks and passes the Editor's markup through in full.
 * This config is for whoever passes it to DOMPurify directly. Without the hooks it lets nothing
 * dangerous through, but part of the Editor's markup is lost too: the author's color, the code
 * block language, cell merging, task checkboxes and images (`HOOK_GUARDED_ATTRIBUTES`).
 *
 * WHY A FUNCTION OVER ARRAYS, NOT A DEPENDENCY. The kit does not install or import DOMPurify.
 * Sanitizing is the consumer server's job (ADR-0050), and the consumer chooses its own: DOMPurify
 * with jsdom, `isomorphic-dompurify`, or another sanitizer. Here there is only the Schema data,
 * in the shape DOMPurify accepts. So the result type is the kit's own, not DOMPurify's `Config`:
 * it is structurally assignable to it.
 *
 * WHY NEW ARRAYS EVERY TIME. DOMPurify and the calling code are free to change the config
 * (`ALLOWED_ATTR.push("data-color")`). A shared array would leak such an edit into neighboring
 * calls.
 *
 * What stays in the shared `ALLOWED_ATTR` is harmless on any tag and with any value: the Schema's
 * `data-*` names (only the styling reads them, and only for their own values), `start`, `alt`,
 * `rel`, and `href`, whose address the expression below checks. `ALLOW_DATA_ATTR` and
 * `ALLOW_ARIA_ATTR` are off. By default DOMPurify passes any `data-*` and `aria-*`, while the
 * Schema knows its own `data-*`: `data-type`, `data-checked`, `data-color`, `data-align` and
 * `data-width`. They are named one by one in `ALLOWED_ATTR` and get there from `attributes`.
 *
 * THE LINK ADDRESS is `ALLOWED_URI_REGEXP` from `protocols`, with the same policy as in the
 * Editor: `javascript:`, `data:`, `ftp:` and relative `href` addresses do not pass. DOMPurify
 * checks this expression not only against `href`, but against EVERY allowed attribute except the
 * "URI-safe" ones. A strict expression would strip `start="3"` and `data-type="taskList"`. So all
 * Schema attributes except the addresses (`href` and `src`) are declared URI-safe
 * (`ADD_URI_SAFE_ATTR`) and are checked only against the list of names. An attribute that the
 * next change adds will land there by itself.
 *
 * The module is safe to run on the server: a function over data, without React or the engine.
 */
export function richTextSanitizeConfig(): RichTextSanitizeConfig {
  return sanitizeConfig(false);
}

/**
 * The Schema config. The closed variant has no attributes or tags guarded by hooks. The full
 * variant has them, plus the attributes of custom Blocks and Marks (`data-mark`, `data-<name>`).
 * Their values are also checked only by the hooks.
 */
function sanitizeConfig(withHooks: boolean, custom?: RichTextSchema): RichTextSanitizeConfig {
  const attributes = [
    ...new Set<string>([
      ...Object.values(RICH_TEXT_SCHEMA.attributes).flat(),
      ...(custom ? customAttributeNames(custom) : []),
    ]),
  ].filter((name) => withHooks || !HOOK_GUARDED_ATTRIBUTES.includes(name));
  return {
    ALLOWED_TAGS: [...RICH_TEXT_SCHEMA.blocks, ...RICH_TEXT_SCHEMA.marks].filter(
      (tag) => withHooks || !HOOK_GUARDED_TAGS.includes(tag)
    ),
    ALLOWED_ATTR: attributes,
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
    ALLOWED_URI_REGEXP: linkProtocolPattern(),
    ADD_URI_SAFE_ATTR: attributes.filter((name) => !URI_ATTRIBUTES.includes(name)),
  };
}

/** The shape that `DOMPurify.sanitize` accepts: a subset of its `Config`. */
export interface RichTextSanitizeConfig {
  ALLOWED_TAGS: string[];
  ALLOWED_ATTR: string[];
  ALLOW_DATA_ATTR: false;
  ALLOW_ARIA_ATTR: false;
  /** The link address schemes: `RICH_TEXT_SCHEMA.protocols`. */
  ALLOWED_URI_REGEXP: RegExp;
  /**
   * Attributes that DOMPurify does not check against `ALLOWED_URI_REGEXP`: all except `href` and
   * `src`.
   */
  ADD_URI_SAFE_ATTR: string[];
}

/** The `uponSanitizeAttribute` hook event: a subset of what DOMPurify passes. */
export interface RichTextAttributeHookEvent {
  attrName: string;
  attrValue: string;
  keepAttr: boolean;
}

/**
 * A DOMPurify instance: exactly what `sanitizeRichText` uses.
 *
 * WHY A STRUCTURAL TYPE, NOT AN IMPORT FROM `dompurify`. The kit has no such package in its
 * dependencies and never will (ADR-0050). The consumer brings its own: `dompurify` with jsdom, or
 * `isomorphic-dompurify`. An instance of either is assignable to this type without casts.
 * `tests/editor-sanitize.test.tsx` guards this against the real DOMPurify.
 */
export interface RichTextPurifier {
  sanitize(dirty: string, config: RichTextSanitizeConfig): string;
  addHook(
    entryPoint: "uponSanitizeAttribute",
    hook: (node: Element, event: RichTextAttributeHookEvent) => void
  ): void;
  addHook(entryPoint: "afterSanitizeAttributes", hook: (node: Element) => void): void;
  removeHook(
    entryPoint: "uponSanitizeAttribute",
    hook?: (node: Element, event: RichTextAttributeHookEvent) => void
  ): unknown;
  removeHook(entryPoint: "afterSanitizeAttributes", hook?: (node: Element) => void): unknown;
}

/**
 * Cleans a Document's HTML by the Editor's Schema. This is the safe default path (ADR-0050): the
 * consumer calls `sanitizeRichText(html, DOMPurify)` on its server.
 *
 * WHY A HELPER, NOT A RECIPE ON THE PAGE. The policy by tag (where `style` may occur and with which
 * value, which `class` `code` takes, where `label` and `input` live) used to live only in the hooks
 * that the consumer copied from the `RichTextView` page. The config then allowed `style` and `class`
 * on any tag, and a hook forgotten or outdated during copying silently passed any CSS. Now the hooks
 * are the kit's code: they change together with the Schema, and without them the config is closed.
 *
 * THE HOOKS LIVE FOR ONE CALL. DOMPurify keeps hooks on the instance, and the consumer's instance is
 * shared (comments, emails, its own rules). Hooks installed permanently would fire in someone
 * else's cleanup. The helper installs them before `sanitize` and removes them after, by function
 * reference, so the consumer's own hooks stay in place. Removal by reference needs DOMPurify 3.2+.
 * An old `removeHook` without a function removes the last one installed, which is also ours.
 * `sanitize` is synchronous: no foreign call can slip in between installing and removing.
 *
 * What the hooks check (everything the Editor writes passes unchanged):
 *
 * - `label`, `input`, `span`, `div`: only the markup of a task item. `input` only as
 *   `type="checkbox"`.
 * - `ol[start]`: only on `ol`. `ul`/`li[data-type]` and `li[data-checked]`: only the task list
 *   values.
 * - `code[class]`: only the canonical `language-<name>` from `codeLanguages`.
 * - `span[data-color]` and `mark[data-color]`: only names from their own palette. Old marker names
 *   are converted (`legacyMarkerColors`). A `mark` without a color is removed.
 * - `style`: only `color:#rrggbb` on `span`, and `background-color:#rrggbb` on `mark`, and never
 *   together with `data-color`.
 * - `data-align`: a known value on `p`, `h1`–`h4`, `th`, `td`.
 * - Column layout: `div[data-block="layout"]` with a variant from `layouts`, and only outside a
 *   column, a Wrapper, a list, a quote, a table or a Details Block. `div[data-block="column"]` only directly inside a Column
 *   layout. Otherwise the wrapper is removed and the Blocks stay in place.
 * - Wrapper: `div[data-block="wrapper"]` at the top level or directly in a Column layout column,
 *   not inside another Wrapper, a list, a quote or a table. Otherwise it is removed the same way,
 *   along with its tone. `data-tone` is a name from `wrapperTones`, and only on a Wrapper.
 * - Details Block: `details` with `summary` directly in it, and the content wrapper
 *   `div[data-type="detailsContent"]` also directly in it. `open` is only empty, and only on
 *   `details`. `summary` and the wrapper outside `details` lose their tag, and their Blocks stay in
 *   place.
 * - Formula: `span[data-type="inline-math"]` or `div[data-type="block-math"]` with `data-latex`.
 *   The pair is allowed only on these tags. The element itself is empty, and `data-latex` may
 *   contain `<` (it is LaTeX text, not markup). Without `data-latex` the element loses its wrapper.
 * - `colspan`, `rowspan`: on `th` and `td`, an integer from 1 to `tableSpans`.
 * - Video: `div[data-block="video"]` with `data-provider` from `VIDEO_PROVIDERS` and `data-src`,
 *   an `https` address of a video on that service's host (`isVideoSrc`). A Block without a valid
 *   service or address, and a video Block inside a video Block, loses its wrapper; the link inside
 *   remains. `iframe` is always removed.
 * - Link: `href` by `protocols` (the config's expression), `rel` always `"noopener noreferrer"`.
 *   A link without an address becomes text.
 * - Image: `img` with an absolute `http`/`https` address, directly inside `figure`, with no `data:`
 *   or `blob:`. `data-width` is a preset, and `alt` is always present. `figcaption` only inside
 *   `figure`.
 *
 * The Schema has no `hljs-*` highlight tokens, and the helper removes them: highlighting happens
 * after sanitization (`highlightCodeBlocks`, ADR-0051).
 *
 * CUSTOM TOOLS ARE THE THIRD ARGUMENT (ADR-0058, item 2.3): the same `tools` array the Editor gets.
 * A custom Block passes as `div[data-block="<name>"]` (inline: `span`). A custom Mark passes as
 * `span[data-mark="<name>"]`. Their `data-<name>` attributes pass only on their own element, and
 * only with a value of the kind set by the rules: a list, a pattern, or an address under the link
 * protocol policy. A value containing markup never passes. Foreign tags and attributes on a custom
 * element are removed. A Block with the `top` placement outside the top level loses its wrapper,
 * as a Column layout does. Kit tool names do not narrow the allowlist (`richTextSchema`). Without
 * the third argument, the cleanup is the same as it was before custom Tools.
 *
 * The module is safe to run on the server: the DOM comes from a DOMPurify instance, which the kit
 * does not import.
 */
export function sanitizeRichText(
  html: string,
  purify: RichTextPurifier,
  tools?: readonly ToolEntry[]
): string {
  // The hooks are closures over this call's Schema. They are removed by reference, as before.
  const schema = richTextSchema(tools);
  const onAttribute = (node: Element, event: RichTextAttributeHookEvent) =>
    checkAttribute(node, event, schema);
  const onStructure = (node: Element) => checkStructure(node, schema);
  purify.addHook("uponSanitizeAttribute", onAttribute);
  purify.addHook("afterSanitizeAttributes", onStructure);
  try {
    return purify.sanitize(html, sanitizeConfig(true, schema));
  } finally {
    purify.removeHook("afterSanitizeAttributes", onStructure);
    purify.removeHook("uponSanitizeAttribute", onAttribute);
  }
}

const has = (list: readonly string[], value: string) => list.includes(value);

/** Cell merging: only `th` and `td`, only digits, and no more than the Schema limit. */
function isSpan(node: Element, value: string, max: number): boolean {
  return (
    (node.nodeName === "TH" || node.nodeName === "TD") &&
    /^\d{1,6}$/.test(value) &&
    Number(value) >= 1 &&
    Number(value) <= max
  );
}

/**
 * Each Schema attribute is allowed only on its own tag and with its own value. DOMPurify's shared
 * `ALLOWED_ATTR` lets it through anywhere and with any value. The rule here keeps the attribute
 * only where, and only as, the Editor writes it.
 */
const ATTRIBUTE_RULES: Record<string, (node: Element, value: string) => boolean> = {
  start: (node) => node.nodeName === "OL",
  "data-type": (node, value) =>
    (node.nodeName === "UL" && value === "taskList") ||
    (node.nodeName === "LI" && value === "taskItem") ||
    // The content wrapper of a Details Block: only a `div` directly inside `details`.
    (node.nodeName === "DIV" &&
      value === DETAILS_CONTENT &&
      node.parentElement?.nodeName === "DETAILS") ||
    // Formula: inline is a `span`, block is a `div`. A value on a foreign tag does not pass.
    (node.nodeName === "SPAN" && value === INLINE_FORMULA_TYPE) ||
    (node.nodeName === "DIV" && value === BLOCK_FORMULA_TYPE),
  // The LaTeX source is text, not markup. So the "no `<`" rule (ADR-0070) does not apply to it:
  // DOMPurify escapes it on output. But it applies only to a formula: the same attribute on another
  // tag, or next to a foreign `data-type`, is removed. `data-type` is read from the markup, not from
  // the hook's decision, because DOMPurify walks the attributes in its own order.
  "data-latex": (node) => isFormula(node),
  // An open Block: `open=""`, as the Editor writes it. An `open="open"` value from foreign HTML
  // loses the attribute, and the Block stays closed.
  open: (node, value) => node.nodeName === "DETAILS" && value === "",
  "data-checked": (node, value) =>
    node.nodeName === "LI" &&
    node.getAttribute("data-type") === "taskItem" &&
    (value === "true" || value === "false"),
  // Color: only on `span` and `mark`, and only a name from THEIR OWN palette. The text color and
  // the marker have different lists, so a marker name does not pass on a `span`.
  "data-color": (node, value) =>
    (node.nodeName === "SPAN" && has(RICH_TEXT_SCHEMA.textColors, value)) ||
    (node.nodeName === "MARK" && has(RICH_TEXT_SCHEMA.markerColors, value)),
  // `style`: only the author's arbitrary color, with the expressions from the Schema. Any other
  // CSS, and `style` on other tags, is removed.
  style: (node, value) => {
    const tag = node.nodeName.toLowerCase();
    const pattern =
      tag === "span" || tag === "mark" ? RICH_TEXT_SCHEMA.customColor.styles[tag] : undefined;
    return pattern !== undefined && new RegExp(pattern).test(value);
  },
  // Column layout, column, Wrapper and video: only on `div`. The variant is only on a Column layout.
  "data-block": (node, value) =>
    node.nodeName === "DIV" &&
    (value === LAYOUT_BLOCK ||
      value === COLUMN_BLOCK ||
      value === WRAPPER_BLOCK ||
      value === VIDEO_BLOCK),
  "data-layout": (node, value) =>
    node.nodeName === "DIV" &&
    node.getAttribute("data-block") === LAYOUT_BLOCK &&
    has(RICH_TEXT_SCHEMA.layouts, value),
  // The tone: only on a Wrapper, and only a name from the tone vocabulary.
  "data-tone": (node, value) =>
    node.nodeName === "DIV" &&
    node.getAttribute("data-block") === WRAPPER_BLOCK &&
    has(RICH_TEXT_SCHEMA.wrapperTones, value),
  // Video: a service from the list, and an address on that service's host. The service is read from
  // the element itself, because DOMPurify walks the attributes in its own order.
  "data-provider": (node, value) =>
    node.nodeName === "DIV" &&
    node.getAttribute("data-block") === VIDEO_BLOCK &&
    isVideoProvider(value),
  "data-src": (node, value) =>
    node.nodeName === "DIV" &&
    node.getAttribute("data-block") === VIDEO_BLOCK &&
    isVideoSrc(node.getAttribute("data-provider") ?? "", value),
  "data-align": (node, value) =>
    ["P", "H1", "H2", "H3", "H4", "TH", "TD"].includes(node.nodeName) &&
    has(RICH_TEXT_SCHEMA.alignments, value),
  colspan: (node, value) => isSpan(node, value, RICH_TEXT_SCHEMA.tableSpans.colspan),
  rowspan: (node, value) => isSpan(node, value, RICH_TEXT_SCHEMA.tableSpans.rowspan),
  type: (node, value) => node.nodeName === "INPUT" && value === "checkbox",
  checked: (node) => node.nodeName === "INPUT",
  // The code block language: only the canonical "language-<name>", and only on `code`. An alias, a
  // second class next to it, and a class on other tags are removed. The class list is not built at
  // module level: a `map` call there would not be tree-shaken, and it would ship in every import of
  // `@olddevs/ui/editor`, even without sanitization.
  class: (node, value) =>
    node.nodeName === "CODE" &&
    value.startsWith("language-") &&
    has(RICH_TEXT_SCHEMA.codeLanguages, value.slice("language-".length)),
  // The address scheme is already checked by the config's `ALLOWED_URI_REGEXP`. Here it is the tag.
  href: (node) => node.nodeName === "A",
  rel: (node) => node.nodeName === "A",
  // Image address: only an absolute http and https. `ALLOWED_URI_REGEXP` does not help here, because
  // DOMPurify lets `data:` in `src` on `<img>` past it.
  src: (node, value) => node.nodeName === "IMG" && isAllowedImageSrc(value),
  alt: (node) => node.nodeName === "IMG",
  "data-width": (node, value) =>
    node.nodeName === "IMG" && has(RICH_TEXT_SCHEMA.imageWidths, value),
  // The language of a fragment: only on a plain `span` (a formula and a custom Mark are `span` too,
  // and carry no language), and only a value of the BCP 47 shape. The hook has already written the
  // tag in its canonical case, so the shape is what is checked here.
  lang: (node, value) =>
    node.nodeName === "SPAN" &&
    !node.hasAttribute("data-type") &&
    normalizeLanguageTag(value) !== null,
};

/** A record key counts only as an own property: `constructor` and `__proto__` do not become a rule. */
function own<T>(record: Readonly<Record<string, T>>, key: string | null): T | undefined {
  return key !== null && Object.hasOwn(record, key) ? record[key] : undefined;
}

/**
 * The rules of a custom element: a custom Block by `data-block` and by the tag of its kind. A
 * custom Mark is a `span` by `data-mark`. The tag is checked here, instead of relying on the
 * `data-block` that was already checked, because DOMPurify walks the attributes in its own order.
 */
function customRulesOf(
  node: Element,
  schema: RichTextSchema
): RichTextCustomBlockRules | RichTextCustomMarkRules | undefined {
  const tag = node.nodeName.toLowerCase();
  const block = own(schema.customBlocks, node.getAttribute("data-block"));
  if (block) return tag === customElement(block.kind).tag ? block : undefined;
  return tag === customElement("mark").tag
    ? own(schema.customMarks, node.getAttribute("data-mark"))
    : undefined;
}

/**
 * An attribute of a custom element: `true` and `false` decide it. `undefined` means it is up
 * to the kit's rules. A custom element can carry only `data-block`, `data-mark`, and its own
 * `data-<name>` per its rules. The kit's attributes (`data-color`, `style`) are foreign there.
 */
function customAttributeAllowed(
  node: Element,
  { attrName, attrValue }: RichTextAttributeHookEvent,
  schema: RichTextSchema
): boolean | undefined {
  if (attrName === "data-mark") {
    return node.nodeName === "SPAN" && own(schema.customMarks, attrValue) !== undefined;
  }
  const rules = customRulesOf(node, schema);
  if (attrName === "data-block") {
    const block = own(schema.customBlocks, attrValue);
    return block ? rules === block : undefined;
  }
  const attribute = attrName.startsWith("data-")
    ? own(rules?.attributes ?? {}, attrName.slice("data-".length))
    : undefined;
  if (attribute) return isAllowedAttributeValue(attribute, attrValue);
  return rules ? false : undefined;
}

/** The `uponSanitizeAttribute` hook: a Schema attribute is checked by the rule for its name. */
function checkAttribute(
  node: Element,
  event: RichTextAttributeHookEvent,
  schema: RichTextSchema
): void {
  // The formula source is fixed BEFORE DOMPurify's `SAFE_FOR_XML` check, which runs right after the
  // hooks and would strip an attribute containing `]>` or `</style`: a space goes inside the pair
  // (`mathHtml.ts`).
  if (event.attrName === "data-latex" && isFormula(node)) {
    event.attrValue = safeLatexSource(event.attrValue);
  }
  const custom = customAttributeAllowed(node, event, schema);
  if (custom !== undefined) {
    if (!custom) event.keepAttr = false;
    return;
  }
  // A Document saved before the Notion-style marker palette carries an old name on `mark`
  // (`accent`, `success`, …). It is converted before the check, as the Editor does on load.
  // Otherwise the highlight would disappear, and a bare `mark` is removed below.
  if (event.attrName === "data-color" && node.nodeName === "MARK") {
    const legacy = RICH_TEXT_SCHEMA.legacyMarkerColors as Record<string, string>;
    if (Object.hasOwn(legacy, event.attrValue)) event.attrValue = legacy[event.attrValue]!;
  }
  // `EN-US` from Word is written as `en-US`, as the Editor writes it (`normalizeLanguageTag`).
  if (event.attrName === "lang") {
    event.attrValue = normalizeLanguageTag(event.attrValue) ?? event.attrValue;
  }
  const allowed = ATTRIBUTE_RULES[event.attrName];
  if (allowed && !allowed(node, event.attrValue)) event.keepAttr = false;
}

/**
 * `label`, `input`, `span` and `div` are the markup of a task item. Outside an item the wrapper is
 * removed and the content stays, as with any tag that is not allowed.
 */
const TASK_ITEM = 'li[data-type="taskItem"]';
const PARENT_OF: Record<string, string> = {
  LABEL: TASK_ITEM,
  DIV: TASK_ITEM,
  INPUT: `${TASK_ITEM} > label`,
  SPAN: `${TASK_ITEM} > label`,
};

/** The `div[data-type]` value of a Details content wrapper (`details.ts`). */
const DETAILS_CONTENT = "detailsContent";

/** A formula in the form the Editor writes: the tag and `data-type` from the pair. */
function isFormula(node: Element): boolean {
  const type = node.getAttribute("data-type");
  return (
    (node.nodeName === "SPAN" && type === INLINE_FORMULA_TYPE) ||
    (node.nodeName === "DIV" && type === BLOCK_FORMULA_TYPE)
  );
}

/** The `div[data-block]` values: Column layout, its column and Wrapper. */
const LAYOUT_BLOCK = "layout";
const COLUMN_BLOCK = "column";
const WRAPPER_BLOCK = "wrapper";

/**
 * Where a Column layout cannot be: inside another Column layout (its column), in a Wrapper, a list,
 * a quote, a cell or a Details Block. The Editor does not return one there, because the engine's
 * Schema has no such place for a column or for other containers. On load it unwraps such a layout
 * into its Blocks, in sequence.
 */
const NOT_A_LAYOUT_PLACE = "div[data-block], li, blockquote, th, td, details";

/**
 * Column layout, column and Wrapper: `true` means the element was handled (kept or removed). A
 * parent is visited before its children. So a column of a removed Column layout no longer finds
 * it above itself, and it is removed too. The Wrapper of a removed column is checked at its new
 * position.
 */
function checkLayout(node: Element): boolean {
  const block = node.nodeName === "DIV" ? node.getAttribute("data-block") : null;
  // A Wrapper is at the top level or directly in a column. It is the same list of places where a
  // Column layout is not allowed, except that a column does accept it.
  if (block === WRAPPER_BLOCK) {
    const parent = node.parentElement;
    if (
      parent?.closest(NOT_A_LAYOUT_PLACE) &&
      !parent.matches(`div[data-block="${COLUMN_BLOCK}"]`)
    ) {
      node.replaceWith(...node.childNodes);
    }
    return true;
  }
  if (block === LAYOUT_BLOCK) {
    if (!node.hasAttribute("data-layout") || node.parentElement?.closest(NOT_A_LAYOUT_PLACE)) {
      node.replaceWith(...node.childNodes);
    }
    return true;
  }
  if (block === COLUMN_BLOCK) {
    if (!node.parentElement?.matches(`div[data-block="${LAYOUT_BLOCK}"]`)) {
      node.replaceWith(...node.childNodes);
    }
    return true;
  }
  return false;
}

/**
 * A custom element: `true` means it was handled (kept or removed). A Block with the `top` placement
 * is allowed only directly in the Document. A nested one loses its wrapper, and its content stays.
 */
function checkCustom(node: Element, schema: RichTextSchema): boolean {
  const rules = customRulesOf(node, schema);
  if (!rules) return false;
  const parent = node.parentElement;
  // The top level is directly in DOMPurify's parse `body`. It is checked by name, not via
  // `ownerDocument.body`, because the parse document of DOMPurify may not have one.
  if ("place" in rules && rules.place === "top" && parent && parent.nodeName !== "BODY") {
    node.replaceWith(...node.childNodes);
  }
  return true;
}

/**
 * A video Block: `true` means the element was handled. Without a valid service and address (the
 * attribute hook removed what should not be there), and inside another video Block, it loses its
 * wrapper. The link stays, and the reader sees it even without the player.
 */
function checkVideo(node: Element): boolean {
  if (node.nodeName !== "DIV" || node.getAttribute("data-block") !== VIDEO_BLOCK) return false;
  const provider = node.getAttribute("data-provider");
  const src = node.getAttribute("data-src");
  const valid = provider !== null && src !== null && isVideoSrc(provider, src);
  if (!valid || node.parentElement?.closest(`div[data-block="${VIDEO_BLOCK}"]`)) {
    node.replaceWith(...node.childNodes);
  }
  return true;
}

/** The `afterSanitizeAttributes` hook: the element's place in the Document. */
function checkStructure(node: Element, schema: RichTextSchema): void {
  if (checkLayout(node) || checkVideo(node) || checkCustom(node, schema)) return;
  // A formula is a leaf: an empty element with `data-latex`. The rendered KaTeX markup does not get
  // into the Document (ADR-0070), so its children are removed. Without a source the element loses
  // its wrapper, like any stray `span` or `div`.
  if (isFormula(node)) {
    if (node.hasAttribute("data-latex")) node.replaceChildren();
    else node.replaceWith(...node.childNodes);
    return;
  }
  // Without `type="checkbox"` an input is an ordinary text field: there is no such checkbox.
  if (node.nodeName === "INPUT" && node.getAttribute("type") !== "checkbox") {
    node.remove();
    return;
  }
  // A label has one color, from a palette or the author's. So `style` is removed next to
  // `data-color`. A `span` with a color may appear anywhere. A `mark` without a color is removed,
  // because the browser paints a bare marker yellow.
  if (node.hasAttribute("data-color")) node.removeAttribute("style");
  const coloured = node.hasAttribute("data-color") || node.hasAttribute("style");
  if (node.nodeName === "MARK" && !coloured) {
    node.replaceWith(...node.childNodes);
    return;
  }
  if (node.nodeName === "SPAN" && coloured) return;
  // A `span` with a language is a Mark (ADR-0078), not a stray wrapper. The attribute hook has already
  // removed a `lang` that is not a tag, so a `span` that still has one is valid.
  if (node.nodeName === "SPAN" && node.hasAttribute("lang")) return;
  // Details Block: `summary` only directly in `details`, and the content wrapper with its
  // `data-type` likewise. (The hook has already removed the attribute if the wrapper is not in
  // place.) Outside a Block they lose their wrapper, and the content stays.
  if (node.nodeName === "SUMMARY") {
    if (node.parentElement?.nodeName !== "DETAILS") node.replaceWith(...node.childNodes);
    return;
  }
  if (node.nodeName === "DIV" && node.getAttribute("data-type") === DETAILS_CONTENT) return;
  // An image is an `img` with an address, directly inside a `figure`, and only that way. A `figure`
  // without a valid image is unwrapped into its content. An `img` outside `figure`, or without an
  // address, is removed. A `figcaption` outside `figure` loses its wrapper.
  if (node.nodeName === "FIGURE") {
    const img = node.querySelector(":scope > img");
    if (!img || !isAllowedImageSrc(img.getAttribute("src") ?? "")) {
      node.replaceWith(...node.childNodes);
    }
    return;
  }
  if (node.nodeName === "IMG") {
    if (!node.hasAttribute("src") || node.parentElement?.nodeName !== "FIGURE") {
      node.remove();
      return;
    }
    if (!node.hasAttribute("alt")) node.setAttribute("alt", "");
    return;
  }
  if (node.nodeName === "FIGCAPTION") {
    if (node.parentElement?.nodeName !== "FIGURE") node.replaceWith(...node.childNodes);
    return;
  }
  // A link whose address was stripped (a foreign scheme) stays as text. A link with an address
  // always gets the `rel` that the Editor writes.
  if (node.nodeName === "A") {
    if (!node.hasAttribute("href")) {
      node.replaceWith(...node.childNodes);
      return;
    }
    node.setAttribute("rel", "noopener noreferrer");
  }
  const parent = PARENT_OF[node.nodeName];
  if (parent && !node.parentElement?.matches(parent)) node.replaceWith(...node.childNodes);
}

/**
 * Characters the browser strips from an address before parsing it: spaces and control characters.
 * To the browser, `java\tscript:` is `javascript:`, so the scheme is checked after they are
 * removed. The set is the same as DOMPurify's `ATTR_WHITESPACE`. The Editor and the sanitization on
 * the server must see the same address.
 */
// eslint-disable-next-line no-control-regex -- control characters are the very thing being checked
const URI_WHITESPACE = /[\u0000-\u0020\u00A0\u1680\u180E\u2000-\u2029\u205F\u3000]/g;

/** The address starts with an allowed scheme from `RICH_TEXT_SCHEMA.protocols`. */
function linkProtocolPattern(): RegExp {
  return new RegExp(`^(?:${RICH_TEXT_SCHEMA.protocols.join("|")}):`, "i");
}

/**
 * Whether an address is valid for a Document link: absolute, with a scheme from
 * `RICH_TEXT_SCHEMA.protocols`. The Editor (load, paste, popover) and the cleanup config both check
 * it, so the rule is the same on both sides.
 *
 * @internal Not part of the public entry points: the consumer only needs the config.
 */
export function isAllowedLinkHref(href: string): boolean {
  return linkProtocolPattern().test(href.replace(URI_WHITESPACE, ""));
}

/**
 * Whether an address is valid for a Document image: an absolute `http` or `https`
 * (`RICH_TEXT_SCHEMA.imageProtocols`) with a host name. `https:photo.png` without `//` would be
 * parsed by the browser relative to the page, so such an address does not pass.
 *
 * @internal Not part of the public entry points: the consumer only needs `sanitizeRichText`.
 */
export function isAllowedImageSrc(src: string): boolean {
  const pattern = new RegExp(`^(?:${RICH_TEXT_SCHEMA.imageProtocols.join("|")})://[^/?#]`, "i");
  return pattern.test(src.replace(URI_WHITESPACE, ""));
}

/**
 * Whether a custom attribute's value is valid for its kind (`CustomAttribute`). One check serves
 * the Editor (`customToolEngine.ts`) and the sanitization on the server.
 *
 * A value containing `<` never passes, whatever the pattern. HTML in attributes is forbidden
 * (ADR-0058, item 2.5). A Block's content lives as Document markup in its children, where the same
 * Schema cleans it.
 *
 * @internal Exposed through `customTool.ts`.
 */
export function isAllowedAttributeValue(rule: CustomAttribute, value: string): boolean {
  if (value.includes("<")) return false;
  if (rule.kind === "list") return rule.values.includes(value);
  if (rule.kind === "pattern") return patternOf(rule)?.test(value) ?? false;
  return rule.kind === "url" && isAllowedLinkHref(value);
}

/**
 * Regular expressions of `pattern` rules, one per rule. Cleanup calls the check for every attribute
 * of every call, so there is no point compiling the pattern again each time. The key is the rule
 * object (`richTextSchema` does not copy it). `null` means the pattern is not a valid expression.
 */
const PATTERNS = new WeakMap<CustomAttribute, RegExp | null>();

/**
 * The rule's expression, or `null`. The Editor rejects a broken pattern with a field error
 * (`customToolsError`), but the server has no error channel. So the cleanup does not crash: no value
 * passes that rule, and the developer sees a warning. The pattern text is description data that does
 * not change from call to call.
 */
function patternOf(rule: Extract<CustomAttribute, { kind: "pattern" }>): RegExp | null {
  let pattern = PATTERNS.get(rule);
  if (pattern === undefined) {
    try {
      pattern = new RegExp(`^(?:${rule.pattern})$`);
    } catch {
      pattern = null;
      devWarn(
        `sanitizeRichText: the custom attribute pattern "${rule.pattern}" is not a regular ` +
          "expression, so no value passes it. Fix the pattern in the tool's rules."
      );
    }
    PATTERNS.set(rule, pattern);
  }
  return pattern;
}
