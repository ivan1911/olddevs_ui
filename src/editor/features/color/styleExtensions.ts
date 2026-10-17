"use client";

import type { DOMOutputSpec } from "@tiptap/pm/model";
import { mergeAttributes, type Extension, type Mark } from "@tiptap/core";
import { Highlight } from "@tiptap/extension-highlight";
import { TextAlign } from "@tiptap/extension-text-align";
import { Color, TextStyle } from "@tiptap/extension-text-style";
import {
  CUSTOM_COLOR_PROPERTY,
  customColorFromStyle,
  customColorStyle,
  normalizeCustomColor,
} from "./customColor.js";
import {
  alignmentFromElement,
  DEFAULT_ALIGNMENT,
  EDITOR_ALIGNMENTS,
  EDITOR_MARKER_NAMES,
  EDITOR_TEXT_COLOR_NAMES,
  markerNameFromAttribute,
  type EditorAlignment,
} from "../../styles/palette.js";

/**
 * Text color, highlight and alignment: Tiptap extensions rewritten from `style` to `data-*`.
 *
 * WHY NOT "OUT OF THE BOX". `Color`, `Highlight` and `TextAlign` write `style="color: …"` and read
 * any CSS value that arrives. For the kit these are two promises that such parsing breaks. The
 * saved HTML has no `style` (the consumer's server may not allow it at all), and the color comes
 * only from the token palette, not from `#ff0000` pasted from Word. So the packages are taken for
 * their commands and Schema markup, while the attributes, parsing and output are replaced.
 *
 * THE ONE EXCEPTION IS THE CUSTOM COLOR (`customColor.ts`): `style="color:#rrggbb"` on a `span` and
 * `style="background-color:#rrggbb"` on a `mark`, and only in this strict form, never together with
 * `data-color`. Any other `style` is still not parsed.
 *
 * ANYTHING NOT FROM THE PALETTE IS DROPPED TOGETHER WITH ITS WRAPPER, AND THE TEXT STAYS.
 * `<span data-color="hotpink">` is parsed without the Mark, and `<span style="…">` is not parsed at
 * all: a CSS value from foreign HTML is not mapped to the nearest palette color. Such mapping would
 * guess for the author, and in a dark theme the guessed color could turn out unreadable.
 */

const textColorNames: ReadonlySet<string> = new Set(EDITOR_TEXT_COLOR_NAMES);
const markerNames: ReadonlySet<string> = new Set(EDITOR_MARKER_NAMES);

const knownAlignments: ReadonlySet<string> = new Set(EDITOR_ALIGNMENTS);

type ColorProperty = (typeof CUSTOM_COLOR_PROPERTY)[keyof typeof CUSTOM_COLOR_PROPERTY];

/**
 * What counts as a palette name on a Mark. There are two palettes (`palette.ts`): `span` takes the
 * text color names, `mark` takes the highlight names, and a foreign name on a tag is not accepted.
 * `named` is the name as it is written into the Document. `parsed` is the same from foreign or saved
 * HTML: for a highlight it maps an old name to the new one (`LEGACY_MARKER_NAMES`), for text it
 * does not.
 */
interface ColorKind {
  property: ColorProperty;
  named: (value: string | null) => string | null;
  parsed: (value: string | null) => string | null;
}

const TEXT_KIND: ColorKind = {
  property: CUSTOM_COLOR_PROPERTY.span,
  named: (value) => (value !== null && textColorNames.has(value) ? value : null),
  parsed: (value) => (value !== null && textColorNames.has(value) ? value : null),
};

const MARKER_KIND: ColorKind = {
  property: CUSTOM_COLOR_PROPERTY.mark,
  named: (value) => (value !== null && markerNames.has(value) ? value : null),
  parsed: markerNameFromAttribute,
};

/**
 * The value of a Mark's color: the name from its palette, or a custom `#rrggbb` (the case is
 * lowered). A Mark stores one string, and that is what makes a palette color and a custom color
 * mutually exclusive: the second cannot be "added" to the first.
 */
const colorValue = (value: unknown, kind: ColorKind): string | null =>
  typeof value === "string" ? (kind.named(value) ?? normalizeCustomColor(value)) : null;

/** HTML attributes for a Mark's color value: `data-color` OR `style`, never both. */
const renderColor = (value: string | null | undefined, kind: ColorKind): Record<string, string> => {
  const color = colorValue(value, kind);
  if (color === null) return {};
  return kind.named(color) !== null
    ? { "data-color": color }
    : { style: customColorStyle(kind.property, color) };
};

/**
 * A Mark's markup with `style` that is kept VERBATIM.
 *
 * WHY NOT THE ARRAY `["span", { style }, 0]`. ProseMirror writes the `style` key through
 * `element.style.cssText`, and the browser returns the value in its own notation: `color:#ff0000`
 * comes out as `color: rgb(255, 0, 0);`. Such a Document would not pass the strict parse on the next
 * load, and the rule "`style` only `color:#rrggbb`" for the server-side sanitization
 * (`sanitizeRichText`) would stop being true. `setAttribute("style", …)` leaves the string alone, so
 * the element is built by hand, and ProseMirror gets a ready node and a place for the content.
 */
const renderMark = (tag: "span" | "mark", attributes: Record<string, string>): DOMOutputSpec => {
  const { style, ...rest } = attributes;
  if (style === undefined || typeof document === "undefined") return [tag, attributes, 0];
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(rest)) element.setAttribute(name, value);
  element.setAttribute("style", style);
  return { dom: element, contentDOM: element };
};

/**
 * The color of an element from foreign HTML. A palette name in `data-color` goes first. `style` is
 * read only when there is no `data-color` at all, so an element with a foreign name and a `style`
 * gets nothing, not "at least the style".
 */
const colorOf = (element: HTMLElement, kind: ColorKind): string | null => {
  const name = element.getAttribute("data-color");
  if (name !== null) return kind.parsed(name);
  return customColorFromStyle(element.getAttribute("style"), kind.property);
};

/**
 * Text color Mark: `<span data-color="danger">`.
 *
 * The engine's Mark is called `textStyle`, and `Color` knows it under that name, so the name does
 * not change. The parse rule takes only a `span` with a name from the palette: an empty `<span>`
 * wrapper (the markup of a task list item) and a `span` with a Mark's `style` do not get it.
 */
const TextColorMark: Mark = TextStyle.extend({
  // Outside the highlight (its priority is 1001): `span[data-color]` › `mark` › `sup`. The dark
  // text of the highlight (`prose.ts`) sits on `mark` and so takes precedence over the author's
  // color around it. On a bright background the text is readable in any theme.
  priority: 1002,
  renderHTML({ HTMLAttributes }) {
    return renderMark("span", mergeAttributes(this.options.HTMLAttributes, HTMLAttributes));
  },
  parseHTML() {
    return [
      {
        tag: "span[data-color],span[style]",
        getAttrs: (element) => (colorOf(element, TEXT_KIND) ? {} : false),
      },
    ];
  },
});

/** Value of the text color Mark: a palette name in `data-color`, or `#rrggbb` in `style`. */
const TextColorValue: Extension = Color.extend({
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          color: {
            default: null,
            parseHTML: (element: HTMLElement) => colorOf(element, TEXT_KIND),
            renderHTML: (attributes: { color?: string | null }) =>
              renderColor(attributes.color, TEXT_KIND),
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      ...this.parent?.(),
      // Neither a palette name nor `#rrggbb` is set: a Mark without a value would come out as an
      // empty `<span>` in the saved HTML.
      setColor:
        (color) =>
        ({ chain }) => {
          const value = colorValue(color, TEXT_KIND);
          return value !== null && chain().setMark("textStyle", { color: value }).run();
        },
    } as ReturnType<NonNullable<typeof Color.config.addCommands>>;
  },
});

/** The `color` Tool: the Mark and its value together. */
export const TEXT_COLOR_EXTENSIONS = [TextColorMark, TextColorValue];

/**
 * Highlight: `<mark data-color="yellow">`. A highlight without a color from the palette does not
 * exist: a bare `<mark>` is painted yellow by the browser with black text, and in a dark theme that
 * is a glowing patch over the whole document. So parsing takes only `mark[data-color]` with a known
 * name, and a command without a color sets nothing.
 *
 * Also switched off is everything that set a highlight without a color: `Mod-Shift-H`, the input and
 * paste rule `==text==`, and Markdown parsing. The last one also closes a leak between Editors: the
 * Markdown rules live in a shared `marked`, so one Editor's highlight rule would parse `==` in
 * another Editor, with no Tool enabled.
 */
export const HighlightExtension: Mark = Highlight.configure({ multicolor: true }).extend({
  /*
    The highlight is the OUTERMOST Mark. The nesting of Marks in the DOM is set by the order in the
    Schema, and that order follows the extension's priority. At the default priority the highlight
    sat inside `<sup>`/`<sub>` and rose with the index, so the strip jumped up and down in the
    middle of a line. Outside, its background stays on the line, and the index rises inside it.
    It is also above the link (`RichLink` has priority 1000), so a marked link does not break the
    strip either.
  */
  priority: 1001,
  addAttributes() {
    return {
      color: {
        default: null,
        parseHTML: (element: HTMLElement) => colorOf(element, MARKER_KIND),
        renderHTML: (attributes: { color?: string | null }) =>
          renderColor(attributes.color, MARKER_KIND),
      },
    };
  },
  renderHTML({ HTMLAttributes }) {
    return renderMark("mark", mergeAttributes(this.options.HTMLAttributes, HTMLAttributes));
  },
  parseHTML() {
    return [
      {
        tag: "mark[data-color],mark[style]",
        getAttrs: (element) => (colorOf(element, MARKER_KIND) ? {} : false),
      },
    ];
  },
  addCommands() {
    const parent = this.parent?.();
    return {
      ...parent!,
      // A highlight without a color (palette or `#rrggbb`) is not set: see the comment on the
      // extension above.
      setHighlight:
        (attributes) =>
        ({ commands }) => {
          const color = colorValue(attributes?.color, MARKER_KIND);
          return color !== null && commands.setMark(this.name, { ...attributes, color });
        },
    };
  },
  addKeyboardShortcuts: () => ({}),
  addInputRules: () => [],
  addPasteRules: () => [],
  // The parent extension holds its own tokenizer, and `undefined` in `extend` does not switch the
  // parent's tokenizer off. So it is replaced with one that finds nothing: a `start` with no match
  // does not let parsing stop at `==`.
  markdownTokenizer: {
    name: "highlight",
    level: "inline",
    start: () => -1,
    tokenize: () => undefined,
  },
  // The color is lost on export to Markdown (see the spec, "Markdown"): the text stays.
  renderMarkdown: (node, helpers) => helpers.renderChildren(node),
  parseMarkdown: (token, helpers) => helpers.parseInline(token.tokens ?? []),
});

/**
 * Block alignment: `<p data-align="center">`.
 *
 * `left` is the default and is not written into the markup: a Document without alignment stays as
 * it was, and `setTextAlign("left")` removes the attribute rather than setting "explicitly left".
 * `left` from foreign HTML is read as the absence of the attribute.
 *
 * The types are paragraph and heading. The Schema knows four heading levels (the first one is
 * `heading1`), so `p` and `h1`–`h4` are aligned. A paragraph inside a list or a quote is a `p` too.
 */
export const TextAlignExtension: Extension = TextAlign.extend({
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          textAlign: {
            default: null,
            // `data-align`; from foreign HTML, `text-align` and `align` (`palette.ts`).
            parseHTML: (element: HTMLElement): EditorAlignment | null =>
              alignmentFromElement(element),
            renderHTML: (attributes: { textAlign?: string | null }) =>
              attributes.textAlign &&
              knownAlignments.has(attributes.textAlign) &&
              attributes.textAlign !== DEFAULT_ALIGNMENT
                ? { "data-align": attributes.textAlign }
                : {},
          },
        },
      },
    ];
  },
  addCommands() {
    const parent = this.parent?.();
    return {
      ...parent!,
      setTextAlign:
        (alignment) =>
        ({ commands }) => {
          if (alignment === DEFAULT_ALIGNMENT) return commands.unsetTextAlign();
          if (!knownAlignments.has(alignment)) return false;
          return this.options.types
            .map((type) => commands.updateAttributes(type, { textAlign: alignment }))
            .some(Boolean);
        },
    };
  },
  addKeyboardShortcuts() {
    return {
      "Mod-Shift-l": () => this.editor.commands.setTextAlign("left"),
      "Mod-Shift-e": () => this.editor.commands.setTextAlign("center"),
      "Mod-Shift-r": () => this.editor.commands.setTextAlign("right"),
    };
  },
}).configure({ types: ["paragraph", "heading"], alignments: [...EDITOR_ALIGNMENTS] });
