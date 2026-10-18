"use client";

// Origin: minimal-tiptap, `minimal-tiptap.tsx` and `hooks/use-minimal-tiptap.ts`
// (MIT, © 2024 Aslam, https://github.com/Aslam97/minimal-tiptap). Kept the wrapper
// around `useEditor` and `EditorContent`, the field frame and the placeholder. The Toolbar
// lives in `EditorToolbar.tsx`. License: NOTICE in the package root.

import { createDocument } from "@tiptap/core";
import { closeHistory } from "@tiptap/pm/history";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import {
  forwardRef,
  lazy,
  Suspense,
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useCallback,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useDescribedBy, useFieldInvalid, useFieldLabelId } from "../hooks/useFieldDescription.js";
import { useMessages, useUiLocale } from "../i18n/useMessages.js";
import { cn } from "../lib/cn.js";
import { FIELD_SHELL_CLASS } from "../lib/field.js";
import { CollapseIcon } from "../icons.js";
import { OVERLAY_LAYER } from "../lib/overlay-layer.js";
import { BlockHandle } from "./ui/BlockHandle.js";
import { FullscreenLayer } from "./features/fullscreen/FullscreenLayer.js";
import { expandTools } from "./features/builtins.js";
import {
  createHandleMethods,
  clearToolSignals,
  publishToolSignals,
  type RichTextEditorHandleMethods,
} from "./core/handle.js";
import { EditorToolbar, ToolbarSkeleton } from "./ui/EditorToolbar.js";
import { matchSelection, searchState } from "./features/search/searchPlugin.js";
import { isDocumentEmpty } from "./core/emptiness.js";
import { FieldNoticeView, StatusLine } from "./ui/FieldStatus.js";
import type { FieldNotice } from "./core/fieldNotice.js";
import { FLOATING_TOOLBAR_KEY, FloatingToolbar } from "./ui/FloatingToolbar.js";
import { createEditorExtensions } from "./core/extensions.js";
import type { ToolEntry } from "./core/customTool.js";
import { customToolsError, FALLBACK_EXTENSIONS } from "./core/customToolEngine.js";
import { startLoad, type ToolLoad } from "./core/toolLoader.js";
import { skeletonHtml } from "./core/skeleton.js";
import { Button } from "../components/actions/Button.js";
import { devError, devWarn } from "../lib/dev-warn.js";
import { describeImageNotice } from "./features/image/imageNotice.js";
import { insertItemsFor } from "./core/insertItems.js";
import type { CustomColorKind } from "./features/color/customColor.js";
import { isImageSelection } from "./features/image/image.js";
import { ImagePopover } from "./features/image/ImagePopover.js";
import { ImageToolbar } from "./features/image/ImageToolbar.js";
import { textCardsOf, toolOptions, triggersOf, type ToolBridge } from "./core/toolDescriptor.js";
import type { ToolPopoverRequest } from "./core/toolButtons.js";
import type { TextCardControl } from "./ui/TextCard.js";
import { SelectionPopover } from "./ui/ToolButtonView.js";
import { tableChunk } from "./features/table/tableTool.js";
import { stickyOffset } from "./features/toc/stickyOffset.js";
import { replaceWithMarkdown } from "./core/markdown.js";
import {
  documentFromJSON,
  documentToJSON,
  replaceWithJSON,
  type RichTextDocument,
} from "./core/jsonDocument.js";
import { markdownOf } from "./core/atomText.js";
import { countCharacters, EXTERNAL_CHANGE } from "./core/maxLength.js";
import { PAPER_SHEET_CLASS, proseClass } from "./styles/prose.js";
import { SELECTION_BUBBLE_KEY, SelectionBubble } from "./ui/SelectionBubble.js";
import { useSlashMenu } from "./ui/SlashMenu.js";
import { useTriggerMenu } from "./ui/TriggerMenu.js";
import { FIELD_MIN_HEIGHT, FieldResizer } from "./ui/FieldResizer.js";
import { formatSourceHtml } from "./core/sourceFormat.js";
import { surfaceAttributes, type RichTextSurface } from "./styles/surface.js";
import { EDITOR_PAPER_TOKENS_CLASS, EDITOR_TOKENS_CLASS } from "./styles/tokens.js";
import type { RichTextEditorPreset } from "./core/tools.js";
import { useChangeThrottle } from "./hooks/useChangeThrottle.js";
import { useCoarsePointer } from "./hooks/useCoarsePointer.js";
import { useFieldsetDisabled } from "./hooks/useFieldsetDisabled.js";

/**
 * The custom color popover loads on the first "Custom color…" click. It pulls in
 * `ColorPicker` and the color subsystem of `react-aria-components` (61 kB gzip,
 * ADR-0038), and few users need it. A static import would double the size of the
 * `@olddevs/ui/editor` entry point for everyone.
 */
const CustomColorPopover = lazy(() =>
  import("./features/color/CustomColorPopover.js").then((module) => ({
    default: module.CustomColorPopover,
  }))
);

/**
 * The Text card loads once the `tools` set has at least one Text card. Its frame,
 * range recalculation and live region are needed only by whoever declared a Text card,
 * and a static import would land on every consumer.
 */
const TextCard = lazy(() =>
  import("./ui/TextCard.js").then((module) => ({ default: module.TextCard }))
);

/**
 * The "Find and replace" panel loads on first open. Its fields, checkboxes and
 * toggle are needed only by someone searching, while `search` is also in `basic`, which
 * is held to the "startup" budget. The highlight plugin and the shortcuts are small
 * and sit in the engine right away.
 */
/*
  The Table of contents core (the `toc` Tool) is a lazy chunk. Few consumers enable it,
  and the strip with the list and `HoverCard` would cost every Editor ~5 kB gzip at
  startup. The chunk arrives only when the Tool is enabled and the engine is ready.
*/
const TocCore = lazy(() =>
  import("./features/toc/RichTextToc.js").then((module) => ({ default: module.TocCore }))
);

const SearchPanel = lazy(() =>
  import("./features/search/SearchPanel.js").then((module) => ({ default: module.SearchPanel }))
);

/** Position of the search panel: under the right edge of the Toolbar; full field width on phones. */
const SEARCH_PANEL_PLACE_CLASS = "absolute top-full right-2 left-2 z-[2] mt-2 sm:left-auto sm:w-80";
/** Position of the search panel without a fixed Toolbar: the top corner of the field. */
const SEARCH_PANEL_CORNER_CLASS = "absolute top-2 right-2 left-2 sm:left-auto sm:w-80";

export interface RichTextEditorProps {
  /**
   * The Document: an HTML string constrained by the Schema. An empty Document is `""`.
   *
   * Anything the Schema does not know (tags, attributes, `style`, event handlers,
   * `javascript:`) is dropped on load. The only `style` the Schema knows is the author color,
   * in the strict form `color:#rrggbb` on a `span` and `background-color:#rrggbb` on a `mark`
   * (`customColor.ts`). This is NOT sanitization: the consumer's server cleans user HTML,
   * and client-side cleanup does not protect against XSS.
   */
  value?: string;
  /**
   * The initial Document of an uncontrolled field: an HTML string or a JSON envelope
   * (`getJSON()`). The envelope passes through the Schema, as `setJSON()` does.
   * A rejected envelope yields an empty Document and an error in the development console.
   * Before Readiness, a Skeleton with an envelope is just the frame without a Document:
   * only the engine knows the envelope's HTML.
   * `onChange` and the hidden form field still receive HTML, as always.
   */
  defaultValue?: string | RichTextDocument;
  /**
   * Called with the new HTML, at most once per `changeDelay` ms and also immediately on `blur`,
   * before the form is submitted, and when an edit made in the HTML field is applied. Replacing the
   * Document with a new `value` does not call it.
   */
  onChange?: (html: string) => void;
  /**
   * The Editor is ready: the engine is created and the Handle methods (`ref`) already work, for
   * example to insert a template. Takes no arguments and fires once per mount, including with
   * `readOnly` and `disabled`. Re-renders and a new callback do not trigger it again. It waits for
   * the Loaders of its Tools. It does not fire on server rendering, on an error in the `tools` set,
   * or when a loader fails (no engine).
   */
  onReady?: () => void;
  /**
   * Called when focus enters the field. The field includes the Document, the Toolbar, the kit's
   * popovers and the HTML field, so moving focus between them does not lose field focus and
   * `onFocus` does not fire again. Takes no arguments; the DOM event is not forwarded.
   */
  onFocus?: () => void;
  /**
   * Called when focus leaves the field (see `onFocus`). Before the call, a pending `onChange` is
   * flushed, so autosave on `onBlur` gets fresh HTML. The call is deferred by one tick: focus may
   * return to the field in that time, for example from the Document to the Toolbar or a popover and
   * back, and `onBlur` does not fire then.
   */
  onBlur?: () => void;
  /**
   * The `onChange` delay in ms. Defaults to 300.
   *
   * Serializing to HTML walks the whole document. On a document of tens of thousands
   * of characters, that would slow typing on every keystroke. `0` reports each edit
   * immediately.
   */
  changeDelay?: number;
  /** Form field name: renders an `<input type="hidden">` with the current HTML. */
  name?: string;
  /**
   * The `id` of the editable area, for external links and tests. The name from the `FormField`
   * label does not depend on it: that name comes from context.
   */
  id?: string;
  /** Placeholder for an empty Document. Defaults to the text from the message catalog. */
  placeholder?: string;
  /**
   * Character limit. A remaining-count indicator appears at 80% of the limit, input past it
   * is blocked, and a paste is cut at the limit. A long `value` loads in full:
   * it may be shortened, but not lengthened.
   */
  maxLength?: number;
  /** Read-only: the text can be selected and is submitted with the form, but cannot be edited. */
  readOnly?: boolean;
  /** Disabled, as with other fields: cannot be edited, dimmed, and not submitted with the form. */
  disabled?: boolean;
  /**
   * Required field: `aria-required`. In a regular `<form>`, it also blocks submission while the
   * Document is empty (no text, no Atom, no table). The browser shows the message from the message
   * catalog (`editor.required`) and returns focus to the Editor. `readOnly` and `disabled` are not
   * validated, as with native fields. In the kit's `Form` (`noValidate`) there is no browser
   * validation: the consumer shows the error.
   */
  required?: boolean;
  /** Field name when there is no `FormField` label. */
  "aria-label"?: string;
  /** Field name, referencing an existing label element. Takes precedence over `aria-label`. */
  "aria-labelledby"?: string;
  /** A custom description. Merged with the `FormField` hint and error. */
  "aria-describedby"?: string;
  /** Invalid state. Without the prop, it is taken from a `FormField` with `error`. */
  "aria-invalid"?: boolean;
  /**
   * The formatting Toolbar. `"fixed"` (default) sits above the field and sticks under the app
   * header on scroll (`--topbar-h`, ADR-0016). `"floating"` appears above a non-empty selection.
   * On a touch screen (`pointer: coarse`) it is fixed instead, so it does not cover the iOS and
   * Android system selection menu. `"bubble"` replaces the Toolbar with the Bubble menu: a compact
   * pill on an inverse surface above a non-empty selection ("¶", bold, italic, strikethrough,
   * "…", link, emoji). On a touch screen it is a fixed Toolbar, as above. `"none"` has no Toolbar,
   * so formatting is left to the keyboard. In `readOnly` mode there is no Toolbar in any case.
   * `Alt+F10` from the Document moves focus to the Toolbar or the Bubble menu.
   */
  toolbar?: "fixed" | "floating" | "bubble" | "none";
  /**
   * The Bubble menu on top of the fixed Toolbar. Defaults to `true`: with `toolbar="fixed"`, the
   * same Bubble menu as in `"bubble"` mode appears above a non-empty selection. The owner decided
   * this: the fixed Toolbar covers everything, and the Bubble menu saves the mouse a trip away from
   * the text. `false` keeps just the one Toolbar. The other modes ignore this prop: `"bubble"`
   * already has the Bubble menu, and `"floating"` already shows the Toolbar above the selection. On
   * a touch screen the kit has no Bubble menu: the iOS and Android system selection menu takes its
   * place.
   */
  selectionMenu?: boolean;
  /**
   * A preset: a ready-made set of built-in Tools. `"full"` (default) includes everything.
   * `"basic"` is for comments: bold, italic, strikethrough, inline code, link, both list kinds,
   * blockquote, undo and redo. Ignored if `tools` is passed.
   */
  preset?: RichTextEditorPreset;
  /**
   * The exact list of Tools. Takes precedence over `preset`. A disabled Tool removes both its
   * button and its Block or Mark from the Schema, so they cannot be reached with a keyboard
   * shortcut, a Markdown shortcut, or a paste.
   *
   * Descriptions of custom Tools (`CustomTool`) can be mixed in with the kit's names:
   * `[...RICH_TEXT_PRESETS.full, mergeTagTool]`. A built-in Tool with Options (`search`, `toc`)
   * is configured with a `tool()` entry:
   * `[...RICH_TEXT_PRESETS.full, tool("toc", { levels: [2, 3] })]`. The entry enables the Tool
   * even without the name, and the preset's name yields to it. Two `tool()` entries with the same
   * name are a field error. An unknown name is dropped silently. A description with an error
   * (a name without the consumer prefix, a name clash, Extensions that break the Schema rules)
   * is a field error: the engine is not created, the form value stays as it came in, and the
   * cause is logged to the developer console.
   *
   * `preset` and `tools`, along with the Tool Options, are read when the engine is created: the
   * ProseMirror Schema does not change after that. To change the set on a live field, remount it
   * with `key`. Edit history is lost in that case.
   */
  tools?: readonly ToolEntry[];
  /**
   * The image upload handler: takes a file and returns the absolute `http(s)` URL the image will be
   * served from, or rejects the promise.
   *
   * With it, an image can be pasted from the clipboard, dragged into the field, or picked as a file
   * in the image popover. While the promise is pending, a placeholder sits where the image will go,
   * and the Document does not contain it yet. On rejection the Document does not change, and a
   * message appears under the field. Without it, files are not accepted: only pasting by address.
   * `data:` and `blob:` are never written to the Document: an address outside the policy counts as
   * a rejection. It is read at the moment of insertion, so it can be changed on the fly.
   */
  onUploadImage?: (file: File) => Promise<string>;
  /**
   * The Document surface: `"theme"` (default) uses the app theme. `"paper"` is a light Paper
   * in any theme, for letters, print and PDF. Paper covers only the editable area: the Toolbar,
   * popovers, menus and the field's focus frame stay in the app theme.
   */
  surface?: RichTextSurface;
  /**
   * The Status bar: a React node inside the field frame, in the `maxLength` counter row. The
   * screen's content (word count, "Saved", co-author) sits at the start and the kit's counter at
   * the end. Visible with both `readOnly` and `disabled`.
   *
   * The kit does not announce it: the container has no `role`, so the word count is not read out
   * on every edit. To have "Saved" announced, wrap it in `role="status"` yourself. Take the data
   * from your own state: the Status bar is a prop of the screen, and Tools have no access to it.
   */
  status?: ReactNode;
  /**
   * The height limit of the Document area (ADR-0059): a number is pixels, a string is any CSS
   * length (`"32rem"`, `"60vh"`). Up to the limit the field grows with the Document. Beyond it, the
   * Document scrolls inside the frame, while the Toolbar above and the Status bar below stay in
   * place. Without this prop the field has no scrolling of its own. There is no row-based limit
   * like `maxRows` on `TextControl`, because Blocks differ in height.
   */
  maxHeight?: number | string;
  /**
   * The resize handle in the corner of the Document area: drag it vertically to change the height.
   * With `maxHeight`, it sets the starting height rather than a limit. Two systems that both
   * control the height make the field jump (the same argument applies to `autosize` on
   * `TextControl`). Without `maxHeight`, the starting height is the height of the Document.
   */
  resizable?: boolean;
  /** Classes for the root: width, outer spacing. */
  className?: string;
}

/**
 * Imperative access to the Editor: insert, read text, focus with a position, and history.
 * See `RichTextEditorHandleMethods` (`handle.ts`).
 */
export interface RichTextEditorHandle extends RichTextEditorHandleMethods {
  /**
   * Current HTML, right now, without waiting for `changeDelay`. An empty Document is `""`. In
   * Source mode, it first applies the edit made in the HTML field (through the Schema) and calls
   * `onChange` if the Document changed.
   */
  getHTML(): string;
  /** Clear the Document. The owner of the value learns about it through `onChange("")`. */
  clear(): void;
  /**
   * The Document as Markdown, right now, without waiting for `changeDelay`. An empty Document,
   * and a call before mount (the engine does not exist during server rendering), return `""`.
   *
   * Color, alignment, underline and image size have no Markdown equivalent, so they are lost
   * on export. In Source mode, this behaves like `getHTML()`: the HTML field's edit is applied first.
   */
  getMarkdown(): string;
  /**
   * Replace the Document with parsed Markdown. As with `clear()`, this is a programmatic
   * replacement: the value's owner learns about it through `onChange` right away, and `maxLength`
   * does not truncate it. Anything the Schema does not know is dropped. Does nothing before mount.
   */
  setMarkdown(markdown: string): void;
  /**
   * The Document as a JSON envelope, right now, without waiting for `changeDelay`. Unlike Markdown,
   * nothing is lost. Before mount and during server rendering it returns `null`. In Source mode,
   * this behaves like `getHTML()`: the HTML field's edit is applied first.
   */
  getJSON(): RichTextDocument | null;
  /**
   * Replace the Document with a JSON envelope. The parameter is `unknown`: the usual source is the
   * result of `JSON.parse` on a file, and the Editor validates the shape. `true` means replaced.
   * `false` means the envelope was rejected (wrong format or version, malformed tree) or the engine
   * does not exist yet, and the Document is untouched. This is a programmatic replacement, as with
   * `setMarkdown()`: `onChange` fires right away, `maxLength` does not truncate it, and anything
   * the Schema does not know is dropped under the same rules as HTML.
   */
  setJSON(document: unknown): boolean;
  /**
   * Open the "Find and replace" panel from screen code. This is the same as the "Search" button and
   * `Mod+F`; `replace` moves focus to the replace field. Without the `search` Tool, in Source mode,
   * or before mount, it does nothing.
   *
   * @deprecated Works as `handle.tool("search")?.open(options)`. In development it logs a warning
   * about this once to the console. Will be removed in 5.0.
   */
  openSearch(options?: { replace?: boolean }): void;
  /**
   * The raw Tiptap engine: an escape hatch for the commands of Marks, Blocks and custom Tools
   * (`editor.chain().focus()…run()`). Its API follows the Tiptap major version, not the kit's
   * contract. Before mount and during server rendering, `null`.
   */
  editor: Editor | null;
}

/** An empty Document is an empty string, not `<p></p>`: that is how the form sees it. */
// Snapshot "we are in the browser after hydration" for `useSyncExternalStore`: never changes.
const subscribeNever = () => () => {};
const isBrowser = () => true;
const isServer = () => false;

/** Length for `maxHeight`: a number is pixels, a string is passed through as a CSS length. */
const cssLength = (value: number | string) => (typeof value === "number" ? `${value}px` : value);

function serialize(editor: Editor): string {
  return isDocumentEmpty(editor.state.doc) ? "" : editor.getHTML();
}

/*
  The placeholder is a pseudo-element on the first empty paragraph. The extension puts the text
  in `data-placeholder`. For screen readers it is declared as `aria-placeholder` on the field
  itself, because the `::before` content is not read everywhere.
*/
const PLACEHOLDER_CLASS =
  "[&_p.is-editor-empty:first-child]:before:pointer-events-none " +
  "[&_p.is-editor-empty:first-child]:before:float-left " +
  "[&_p.is-editor-empty:first-child]:before:h-0 " +
  "[&_p.is-editor-empty:first-child]:before:text-(--rte-muted-foreground) " +
  "[&_p.is-editor-empty:first-child]:before:content-[attr(data-placeholder)]";

/*
  Image editing covers what the saved HTML and `RichTextView` do not have: the outline of the
  selected image, its width handles (only in the editable field), the hint for an empty caption,
  and an empty caption hidden in the read-only field. The `rte-caption-empty` and
  `rte-resize-handle` classes are set by `image.ts`, as decorations and in the node view.
  They do not go into the Document.
*/
const IMAGE_EDITING_CLASS =
  "[&_figure.ProseMirror-selectednode_img]:outline-2 " +
  "[&_figure.ProseMirror-selectednode_img]:outline-offset-2 " +
  "[&_figure.ProseMirror-selectednode_img]:outline-(--rte-primary) " +
  "[&[contenteditable=true]_figure.ProseMirror-selectednode_.rte-resize-handle]:block " +
  "[&_figcaption.rte-caption-empty]:before:pointer-events-none " +
  "[&_figcaption.rte-caption-empty]:before:float-left " +
  "[&_figcaption.rte-caption-empty]:before:h-0 " +
  "[&_figcaption.rte-caption-empty]:before:w-full " +
  "[&_figcaption.rte-caption-empty]:before:text-(--rte-muted-foreground) " +
  "[&_figcaption.rte-caption-empty]:before:content-[attr(data-placeholder)] " +
  "[&[contenteditable=false]_figcaption.rte-caption-empty]:hidden";

/*
  Search match highlighting: the search plugin sets these classes as decorations, so they do not
  go into the Document. All matches get a soft fill in the `warning` tone, like a highlighter
  marker. The current match is stronger and has a border in the same tone, so it stands out among
  its neighbors and on a yellow marker. The text is not recolored: the fill is semi-transparent,
  so the Mark's color stays readable under it.
*/
const SEARCH_HIGHLIGHT_CLASS =
  "[&_.rte-search-match]:rounded-[2px] " +
  "[&_.rte-search-match]:bg-[color-mix(in_srgb,var(--warning)_30%,transparent)] " +
  "[&_.rte-search-current]:bg-[color-mix(in_srgb,var(--warning)_60%,transparent)] " +
  "[&_.rte-search-current]:shadow-[0_0_0_1px_var(--warning)]";

/*
  The field's frame inside the fullscreen layer (ADR-0082): the whole window, a column of the Toolbar,
  the Document's area (`flex-1`, scrolls itself) and the Status bar. No frame, shadow or focus ring:
  the window edge is the frame.
*/
const FULLSCREEN_SHELL_CLASS =
  "flex min-h-0 flex-1 flex-col rounded-none border-0 shadow-none " +
  "focus-within:border-transparent focus-within:ring-0";

// Frame of the fixed Toolbar and of its Skeleton (the reason for this markup is below).
const TOOLBAR_SHELL_CLASS =
  "bg-bg-2 border-line-soft rounded-t-control sticky top-[var(--topbar-h,0px)] z-[1] " +
  "-mx-3 border-b px-1.5 py-1";

/*
  The HTML-mode field and its mirror share one typography. The field's height is set by an
  invisible twin in the same grid cell, as in `TextControl` with growing height (see there for
  why not `scrollHeight`). The surface is always dark, using the kit's colors (`--rte-source-*`
  in `styles.css`): in dark themes it is the theme background, and in light themes and on Paper
  it uses the dark theme's values. The corner radius matches code blocks, and the font is a
  monospace 13 px, as in `CodeView`. The mode reads as "code", not as one more text field.
*/
const SOURCE_BOX_CLASS =
  "col-start-1 row-start-1 w-full rounded-(--rte-radius) border px-3 py-2 " +
  "font-mono text-[13px] leading-5 break-words whitespace-pre-wrap";
const SOURCE_FIELD_CLASS =
  "border-(--rte-source-border) bg-(--rte-source-background) text-(--rte-source-foreground) " +
  "caret-(--rte-source-foreground) " +
  // Selection uses the dark theme too: the global `::selection` in the light theme is a light
  // fill with dark text, which is unreadable on the dark field.
  "selection:bg-(--rte-source-selection) selection:text-(--rte-source-foreground) " +
  "resize-y outline-none disabled:cursor-not-allowed";

/**
 * The rich text field on Tiptap v3, a separate entry point of `@olddevs/ui/editor` (ADR-0050).
 *
 * VALUE AND CURSOR. The last HTML the value's owner knows about is kept next to the engine. An
 * incoming `value` equal to it is an echo of our own edit: the document is not recreated and the
 * cursor stays put. Otherwise, controlled mode would reset the cursor to the start on every
 * keystroke.
 *
 * FORM. The hidden field and `onChange` receive HTML on the same timer. Submitting the form and
 * `new FormData(form)` flush it early, so the value is fresh at submit time, even mid-delay.
 *
 * SSR AND SKELETON. The engine is created only in the browser (`immediatelyRender: false`) and
 * after the Tools' loaders. Until then (on the server, after hydration, or if a loader fails) a
 * Skeleton is rendered: the frame, the Toolbar's place, and the Document as static HTML with the
 * Document class, without input and without a height jump. The Skeleton's Document is `value`
 * cleaned by the Schema (`skeleton.ts`), and only in the browser after mount. On the server the
 * Skeleton is just the frame and the Toolbar's place.
 */
export const RichTextEditor = forwardRef<RichTextEditorHandle, RichTextEditorProps>(
  function RichTextEditor(
    {
      value,
      defaultValue,
      onChange,
      onReady,
      onFocus,
      onBlur,
      changeDelay = 300,
      name,
      id,
      placeholder,
      maxLength,
      readOnly = false,
      disabled: disabledProp = false,
      required = false,
      "aria-label": ariaLabel,
      "aria-labelledby": ariaLabelledBy,
      "aria-describedby": ariaDescribedBy,
      "aria-invalid": ariaInvalid,
      toolbar = "fixed",
      selectionMenu = true,
      preset = "full",
      tools,
      onUploadImage,
      status,
      surface = "theme",
      maxHeight,
      resizable = false,
      className,
    },
    ref
  ) {
    const messages = useMessages();
    const locale = useUiLocale();
    /*
      The Tool set is frozen at mount: the Schema is built from it, and a live engine's Schema
      cannot be changed. The Toolbar reads the same frozen set, otherwise a new `tools` would show
      a button the Schema does not know. The set is a list of Tool descriptions
      (`features/builtins.ts`), and the surfaces read its projection.
    */
    const [enabledTools] = useState(() => expandTools(preset, tools));
    /*
      Extension loaders (ADR-0058, items 11.3–11.6). Loading starts during render, not in an
      effect: from the first render in the browser, before mount. On the server, never. The promise
      is cached on the loader (`toolLoader.ts`), so a re-render and a second Editor do not call it
      again. The engine's set is assembled only after all of them have finished (`ready`): the
      Schema is fixed at creation, and Blocks from `value` would be lost during parsing without
      their Extensions.
    */
    const loaders = enabledTools.descriptors.flatMap((descriptor) => descriptor.load ?? []);
    const loads = loaders.map((loader) =>
      typeof window === "undefined" ? ({} as ToolLoad) : startLoad(loader)
    );
    const loading = loads.some((load) => !load.done && !load.failed);
    const ready = loads.every((load) => load.done);
    const [, setLoadRound] = useState(0);
    useEffect(() => {
      if (!loading) return;
      let live = true;
      void Promise.all(loads.map((load) => load.promise)).then(
        () => live && setLoadRound((round) => round + 1)
      );
      return () => void (live = false);
    }, [loading]);
    // "Retry" calls again only the loaders that failed: the successful ones are in the cache.
    // A failure becomes visible after the first effect (`engine` below): a string that did not
    // exist on the server would break hydration.
    const retryLoads = () => {
      for (const loader of loaders) startLoad(loader, true);
      setLoadRound((round) => round + 1);
    };
    const editorRef = useRef<Editor | null>(null);
    const rootRef = useRef<HTMLDivElement>(null);
    /** The field's frame: in the root, or in the fullscreen layer. Whatever asks "is this inside the field" asks it. */
    const shellRef = useRef<HTMLDivElement>(null);
    // A disabled `<fieldset>` disables the editor too, like a native field. `Form pending`
    // behaves the same way, and a foreign `fieldset` is covered by the same rule.
    const inDisabledFieldset = useFieldsetDisabled(rootRef);
    const disabled = disabledProp || inDisabledFieldset;
    const hiddenRef = useRef<HTMLInputElement>(null);
    const proxyRef = useRef<HTMLInputElement>(null);
    /*
      The initial envelope: only the engine builds HTML from it, using its own Schema. Until then
      the value is an empty string, and the Document appears once the engine is ready (the effect
      below). `value` takes precedence, as HTML strings in `defaultValue` do.
    */
    const initialDocument =
      value === undefined && typeof defaultValue === "object" ? defaultValue : undefined;
    const initialDocumentRef = useRef(initialDocument);
    initialDocumentRef.current = initialDocument;
    const initial = value ?? (typeof defaultValue === "string" ? defaultValue : "");
    /*
      The last HTML the value's owner knows about: the one passed to `onChange` or received in
      `value`. An incoming `value` equal to it is an echo of our own edit, and the document must
      not be recreated from it.
    */
    const knownRef = useRef(initial);
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;
    // Event callbacks also go through refs: they are read after render (the readiness effect,
    // the focus-leave timer), and a new event callback does not trigger a re-run.
    const onReadyRef = useRef(onReady);
    onReadyRef.current = onReady;
    const onFocusRef = useRef(onFocus);
    onFocusRef.current = onFocus;
    const onBlurRef = useRef(onBlur);
    onBlurRef.current = onBlur;
    /*
      The limit and the placeholder are read by the extension through refs: the extension set lives
      as long as the engine, and recreating the engine for a new number or a locale change would
      mean losing edit history and the cursor.
    */
    const limitRef = useRef(maxLength);
    limitRef.current = maxLength;
    const placeholderText = placeholder ?? messages.editor.placeholder;
    const placeholderRef = useRef(placeholderText);
    placeholderRef.current = placeholderText;
    const taskCheckboxRef = useRef(messages.editor.taskCheckbox);
    taskCheckboxRef.current = messages.editor.taskCheckbox;
    const detailsToggleRef = useRef(messages.editor.detailsToggle);
    detailsToggleRef.current = messages.editor.detailsToggle;
    // The footnote list's name is written into the saved HTML, and the number button's name is drawn in
    // the Document: both are read when they are needed, so a catalog change does not recreate the engine.
    const footnotesRef = useRef(messages.editor.footnotes);
    footnotesRef.current = messages.editor.footnotes;
    const footnoteBackRef = useRef(messages.editor.footnoteBack);
    footnoteBackRef.current = messages.editor.footnoteBack;
    // The `disabled` flag for the Tool commands that must work in `readOnly` but not in a disabled field.
    const disabledRef = useRef(disabled);
    disabledRef.current = disabled;
    // `typography` quotes are read at the moment of typing: a catalog change does not recreate the engine.
    const quoteSetRef = useRef(messages.editor.typographyQuotes);
    quoteSetRef.current = messages.editor.typographyQuotes;
    // The `language` Tool reads the interface locale when asked, as the quotes are read.
    const localeRef = useRef(locale);
    localeRef.current = locale;
    // The upload handler and image strings also go through refs: the extension reads them when a
    // file is inserted and when a caption is redrawn, not when the engine is created.
    const uploadRef = useRef(onUploadImage);
    uploadRef.current = onUploadImage;
    const imageMessagesRef = useRef(messages.editor);
    imageMessagesRef.current = messages.editor;

    /*
      The character count is kept in state only when `maxLength` is set: without a limit there is
      no counter, and recounting the Document on every keystroke would be pointless. The functions
      below read only the ref and the state setter, so they need nothing in the effect dependencies.
    */
    const [count, setCount] = useState(0);
    /**
     * The popover for a description of a selection or a Block (`ToolButtonView.tsx`). It is opened
     * by a shortcut, the link button, an Insert item, or a Block action, through an engine command.
     * After closing, the request stays (`open: false`), so the frame closes normally.
     */
    const [toolPopover, setToolPopover] = useState<{
      request: ToolPopoverRequest;
      open: boolean;
    } | null>(null);
    // Custom color popover: `null` means it was never opened. After closing it stays mounted
    // (`open: false`), so the module is not loaded again.
    const [customColor, setCustomColor] = useState<{
      kind: CustomColorKind;
      open: boolean;
    } | null>(null);
    const openCustomColor = (kind: CustomColorKind) => setCustomColor({ kind, open: true });
    /** Whether the image popover is open: from the Toolbar button, an Insert item, or the image toolbar. */
    const [imageOpen, setImageOpen] = useState(false);
    // The "Insert table" dialog belongs to the Editor, not to the menu: see `TableInsertDialog`.
    // The dialog comes from the table's lazy chunk (`tableTool.ts`): the table engine is created
    // after it, and without the engine there is no dialog.
    const TableInsertDialog = tableChunk()?.TableInsertDialog;
    const TableColumnHandles = tableChunk()?.TableColumnHandles;
    const [tableDialogOpen, setTableDialogOpen] = useState(false);
    /**
     * The field message (`showNotice`, `fieldNotice.ts`): only the latest one is kept. `status` is
     * for the live region. `error` is a visible line under the field. A Document edit clears `error`.
     */
    const [notice, setNotice] = useState<FieldNotice | null>(null);
    /*
      Fullscreen mode (ADR-0082). `layer` is non-null while the layer is mounted: from the open
      command until the exit animation ends. `height` is the field's height before it left its place:
      the root keeps it, so the page below does not jump and its scroll stays put. The field's DOM
      moves into the layer (a portal), and the engine, its history and its state stay where they are.
    */
    const [layer, setLayer] = useState<{ height: number; closing: boolean } | null>(null);
    /** The mirror of "the layer is open" for the Commands, which hold a closure from an earlier render. */
    const fullscreenRef = useRef(false);
    const pageScrollRef = useRef({ x: 0, y: 0 });
    /*
      Focus is moving between the field's two places. Removing the focused Document from the DOM may
      send a `blur` with no `relatedTarget`, and that is not a departure from the field: the layer is
      a part of it. The flag holds the departure check until the Document is focused again.
    */
    const settlingRef = useRef(false);
    /*
      HTML mode: `null` means visual mode. Otherwise it holds the HTML field's text and the
      Document's height at entry. The field never gets shorter than that, so the page does not jump.
      The mode is Editor state, not a prop: the engine stays mounted and hidden, and edit history
      survives.

      The text and the comparison base are duplicated in a ref: applying is called by form handlers
      and the `ref` Handle, which have no fresh closure. The base is the text at entry or after the
      last apply. Unchanged text produces no transaction, no history step and no `onChange`.
    */
    const [source, setSource] = useState<{ text: string; minHeight: number } | null>(null);
    const sourceOpen = source !== null;
    /**
     * The search panel. `token` grows with each open: a repeated `Mod+F` while the panel is open
     * puts focus back into the search field. `query` is the text selected in the Document when
     * it was opened.
     */
    const [searchPanel, setSearchPanel] = useState<{
      token: number;
      replace: boolean;
      query: string;
    } | null>(null);
    /** The jump of the Table of contents core (`TocCore`): present while it is mounted. */
    const tocJumpRef = useRef<((index: number) => boolean) | null>(null);
    const sourceFieldRef = useRef<HTMLTextAreaElement>(null);
    const sourceTextRef = useRef<string | null>(null);
    const sourceBaseRef = useRef("");
    /** Where to put focus after the mode switch: entering goes to the field, exiting by the button goes to the Document. */
    const switchFocusRef = useRef<"source" | "document" | null>(null);
    // The extension lives as long as the engine, and the Toolbar mode changes on the fly
    // (`pointer: coarse`), so the `Alt+F10` handler is read through a ref.
    const focusToolbarRef = useRef<() => boolean>(() => false);
    // `Mod+/` opens the Block handle's menu. The handle registers that handler itself (`BlockHandle`).
    const openBlockMenuRef = useRef<() => boolean>(() => false);
    // `Alt+F10` goes to an open Text card before the Toolbar (`TextCard`).
    const textCardRef = useRef<TextCardControl | null>(null);
    const recount = (current: Editor) => {
      if (limitRef.current !== undefined) setCount(countCharacters(current.state.doc));
    };
    const emit = (html: string) => {
      knownRef.current = html;
      if (hiddenRef.current) hiddenRef.current.value = html;
      onChangeRef.current?.(html);
    };

    /*
      Required check. An empty Document is defined by the kit's rule (`emptiness.ts`): an atom
      (`hr`, an image, a custom atom) and a table, even one with empty cells, count as content.
      So a Document made of just one such Block does not block the form. The same check decides
      whether `""` goes into the hidden field.

      It runs on every edit, not on the `onChange` timer: a submit can happen 50 ms after the first
      letter, and a late validity update would block a form that has text.

      In HTML mode with an unapplied edit, the field's text decides emptiness, not the Document:
      the browser checks constraints BEFORE the `submit` event, and the edit is applied by its
      capture handler. Otherwise `form.requestSubmit()` with focus in the field would block a form
      with text in the field as empty, and let a cleared field through. The text is parsed with
      Tiptap's `createDocument` and the Schema, the same way as on apply, and emptiness is the same
      kit rule as for the Document. Parsing happens only when the check is enabled: without
      `required` it is not needed.
    */
    const validatableRef = useRef(false);
    const requiredMessageRef = useRef(messages.editor.required);
    requiredMessageRef.current = messages.editor.required;
    const fieldEmpty = (current: Editor) => {
      const text = sourceTextRef.current;
      return text !== null && text !== sourceBaseRef.current
        ? isDocumentEmpty(createDocument(text, current.schema))
        : isDocumentEmpty(current.state.doc);
    };
    const syncValidity = (current: Editor) => {
      proxyRef.current?.setCustomValidity(
        validatableRef.current && fieldEmpty(current) ? requiredMessageRef.current : ""
      );
    };

    const throttle = useChangeThrottle(() => {
      const current = editorRef.current;
      if (current && !current.isDestroyed) emit(serialize(current));
    }, changeDelay);

    /*
      Applying the HTML mode: the field's text is parsed with the Schema, the same way as an incoming
      `value`, and replaces the Document in one transaction. That is one history step, which
      `Ctrl/⌘+Z` in the Document undoes as a whole. It runs on leaving the mode, on the field's `blur`,
      on form submit, on `formdata`, on `getHTML()`, on `getMarkdown()`, and on switching to `readOnly`.

      Unchanged text, and text whose parse gives the same Document (only whitespace between Blocks),
      changes nothing: "open, look, close" does not pollute undo and does not call `onChange`.

      The replacement is external for the limit (`EXTERNAL_CHANGE`): like `setMarkdown`, it is not
      truncated, and the counter shows the overage. `onChange` fires right away, as on `blur`, without
      `changeDelay`. The pending timer is cleared after the replacement, otherwise it would report the
      same value a second time. `closeHistory` is applied on both sides: the apply does not merge with
      the edit made before entering, nor with the first edit after it.
    */
    const applySource = () => {
      const current = editorRef.current;
      const text = sourceTextRef.current;
      if (!current || current.isDestroyed || text === null || text === sourceBaseRef.current) {
        return;
      }
      sourceBaseRef.current = text;
      const next = createDocument(text, current.schema);
      if (next.eq(current.state.doc)) return;
      current
        .chain()
        .setMeta(EXTERNAL_CHANGE, true)
        .command(({ tr }) => {
          closeHistory(tr);
          return true;
        })
        .setContent(next, { emitUpdate: false })
        .run();
      current.view.dispatch(closeHistory(current.state.tr));
      throttle.cancel();
      recount(current);
      syncValidity(current);
      emit(serialize(current));
    };
    const applySourceRef = useRef(applySource);
    applySourceRef.current = applySource;
    /*
      Unmounting applies the edit, as `blur` does. Escape in the HTML field inside a `Dialog` closes
      the dialog, and the Editor leaves the tree without a field `blur`, so the edit would vanish
      silently. The engine is still alive at this point: Tiptap's `useEditor` destroys it with a timer
      after its own cleanup, and effect cleanups run in one pass before that timer fires. The
      `onChange` that fires is the same one as on `blur`. With no edit (`sourceBaseRef`), nothing is called.
    */
    useEffect(() => () => applySourceRef.current(), []);

    /** The HTML field's text is the Document's formatted HTML as it is, on entry and on external replacement. */
    const writeSource = (current: Editor) => {
      const text = formatSourceHtml(serialize(current));
      sourceTextRef.current = text;
      sourceBaseRef.current = text;
      return text;
    };
    /*
      The Document is replaced from outside while in this mode (`value`, `setMarkdown`, `clear`):
      the field's text is overwritten with the new Document. The value's owner takes precedence
      over an unsaved edit, as in visual mode.
    */
    const rewriteSource = (current: Editor) => {
      if (sourceTextRef.current === null) return;
      const text = writeSource(current);
      setSource((previous) => previous && { ...previous, text });
    };
    const openSource = () => {
      const current = editorRef.current;
      if (!current) return;
      // The Document will not be on screen, so there is nothing to search in. Highlighting can also
      // exist without the panel (the `setQuery` command): `next()` in a hidden Document would succeed.
      if (enabledTools.has("search")) closeSearch(false);
      const text = writeSource(current);
      switchFocusRef.current = "source";
      setSource({ text, minHeight: current.view.dom.getBoundingClientRect().height });
    };
    const closeSource = (focusDocument: boolean) => {
      applySource();
      sourceTextRef.current = null;
      switchFocusRef.current = focusDocument ? "document" : null;
      setSource(null);
    };
    /** Focus the field: the HTML field in Source mode, otherwise the Document. */
    const focusField = () => {
      if (sourceTextRef.current !== null) sourceFieldRef.current?.focus();
      else editorRef.current?.commands.focus();
    };
    const focusFieldRef = useRef(focusField);
    focusFieldRef.current = focusField;

    /*
      Open the search panel: from the Toolbar button, `Mod+F`/`Mod+Alt+F` from the engine, and the
      `open` command of the Tool. Selected text inside one Block becomes the query, as in code
      editors. A selection that spans Blocks does not: the query does not cross a Block boundary, so
      that text would never be found. An explicit `query` command takes precedence over the selection.
      In HTML mode there is no Document on screen to search in, so `Mod+F` is left to the browser.
    */
    const openSearch = (replace: boolean, query?: string): boolean => {
      const current = editorRef.current;
      if (!current || !enabledTools.has("search") || sourceTextRef.current !== null) return false;
      const { $from, $to, empty } = current.state.selection;
      const selected =
        !empty && $from.sameParent($to) ? current.state.doc.textBetween($from.pos, $to.pos) : "";
      setSearchPanel((previous) => ({
        token: (previous?.token ?? 0) + 1,
        replace,
        query: query ?? selected,
      }));
      // Highlighting and jumps happen right away, without waiting for the lazy panel.
      if (query !== undefined) current.commands.setSearch(query);
      return true;
    };
    const openSearchRef = useRef(openSearch);
    openSearchRef.current = openSearch;
    /*
      Close the search panel: Escape, the "Close" button, or the search button pressed again.
      The caret stays on the current match and focus goes to the Document, so the author continues
      from where they were searching. When entering HTML mode, there is no focus move: focus goes
      to the HTML field.
    */
    const closeSearch = (focusDocument: boolean) => {
      const current = editorRef.current;
      if (current && !current.isDestroyed) {
        const state = searchState(current.state);
        const match = state?.matches[state.current];
        const chain = current.chain();
        if (focusDocument) chain.focus();
        // Text matches are selected as a range, formulas as a node (`matchSelection`).
        if (focusDocument && match) {
          chain.command(({ tr }) => (tr.setSelection(matchSelection(tr.doc, match)), true));
        }
        chain.clearSearch().run();
      }
      setSearchPanel(null);
      return true;
    };

    // Slash menu items come from the same frozen set as the Schema.
    const insertItems = useMemo(() => insertItemsFor(enabledTools), [enabledTools]);
    const textCardEntries = useMemo(() => textCardsOf(enabledTools), [enabledTools]);
    const slash = useSlashMenu(insertItems, editorRef);
    const slashBridge = slash.bridge;
    const triggerRecords = useMemo(() => triggersOf(enabledTools), [enabledTools]);
    const triggerMenu = useTriggerMenu(triggerRecords, editorRef);
    const triggerBindings = triggerMenu.bindings;

    const extensions = useMemo(
      () =>
        ready &&
        createEditorExtensions({
          tools: enabledTools,
          placeholder: () => placeholderRef.current,
          limit: () => limitRef.current,
          taskCheckbox: (text) => taskCheckboxRef.current({ text }),
          detailsToggle: (text) => detailsToggleRef.current({ text }),
          footnoteListName: () => footnotesRef.current,
          footnoteBack: (number) => footnoteBackRef.current({ number }),
          quoteSet: () => quoteSetRef.current,
          locale: () => localeRef.current,
          slash: slashBridge,
          triggers: triggerBindings,
          openPopover: (request) => setToolPopover({ request, open: true }),
          focusToolbar: () => focusToolbarRef.current(),
          openBlockMenu: () => openBlockMenuRef.current(),
          onNotice: setNotice,
          editorMessages: () => imageMessagesRef.current,
          openSearch: (replace) => openSearchRef.current(replace),
          image: {
            /*
              The popover opens one frame later. The Slash menu item runs its command in a chain
              after `focus()`, and Tiptap returns focus to the Document on the next frame. A popover
              opened right away would get focus in the address field and lose it immediately, closing
              as "focus left outside".
            */
            onOpenEditor: () => requestAnimationFrame(() => setImageOpen(true)),
            captionPlaceholder: () => imageMessagesRef.current.imageCaption,
            uploadingLabel: (name) => imageMessagesRef.current.imageUploading({ name }),
            upload: () => uploadRef.current,
            describeNotice: (event) => describeImageNotice(event, imageMessagesRef.current),
          },
        }),
      [enabledTools, slashBridge, triggerBindings, ready]
    );
    /*
      An error while assembling a custom Tool set (ADR-0058, items 1.5, 2.4) is a field error: the
      Schema built from such a set would lose foreign Blocks already while parsing `value`. The engine
      is then built from the fallback set and stays empty, and nothing leaks out (`editor` below is
      `null`, as before mount): the Handle is silent, the hidden field carries the incoming value, and
      `onChange` stays quiet. The set with its loaders is checked once they have finished, since their
      Extensions are the final result.
    */
    const toolsError = useMemo(
      () => extensions && customToolsError(enabledTools, extensions),
      [enabledTools, extensions]
    );
    useEffect(() => {
      if (toolsError) devError(`RichTextEditor: ${toolsError.message}`, toolsError.cause);
    }, [toolsError]);

    /*
      The name of the `FormField` label. The browser links `<label for>` only to labelable elements
      (`input`, `textarea`, `select`). `contenteditable` is not one of them, so the label would be
      visible while the field stayed unnamed.

      So the name is passed by reference: `FormField` publishes its label's `id` through context, and
      the field sets it as `aria-labelledby`. Explicit `aria-label` and `aria-labelledby` take
      precedence: the consumer knows more about its own field.

      A click on the label does not reach the field natively, for the same reason. So the listener is
      attached to the label node itself, read-only: `FormField` stays as it is, and the rule "a label
      focuses its field" lives in the field. A label whose `for` points to a real native control is
      left alone: the browser already handles its focus.
    */
    const fieldLabelId = useFieldLabelId();
    useEffect(() => {
      const label = fieldLabelId
        ? rootRef.current?.ownerDocument.getElementById(fieldLabelId)
        : null;
      if (!(label instanceof HTMLLabelElement) || label.control) return;
      const focus = () => focusFieldRef.current();
      label.addEventListener("click", focus);
      return () => label.removeEventListener("click", focus);
    }, [fieldLabelId]);

    /*
      The counter appears at 80% of the limit and takes no space before that. While it is visible,
      it is part of the field's description: a screen reader announces the remainder on entering
      the field, but does not announce every letter. A live region on the counter would talk over
      the typing.
    */
    const counterId = useId();
    const counter =
      maxLength !== undefined && count >= maxLength * 0.8
        ? count > maxLength
          ? messages.editor.overLimit({ count: count - maxLength })
          : messages.editor.remaining({ count: maxLength - count })
        : null;

    const describedBy = useDescribedBy(
      [ariaDescribedBy, counter != null ? counterId : undefined].filter(Boolean).join(" ") ||
        undefined
    );
    // An explicit prop takes precedence over the form layout, the same order as in `TextControl`.
    const fieldInvalid = useFieldInvalid();
    const invalid = ariaInvalid ?? fieldInvalid;
    const labelledBy = ariaLabelledBy ?? (ariaLabel ? undefined : fieldLabelId);
    const editable = !readOnly && !disabled;

    /*
      Expand the field to the window or put it back (ADR-0082): the "Fullscreen" item, the `Esc` and
      "Collapse" of the layer, and the Tool's Commands. `false` when nothing changed: the Tool is off,
      the layer is already in that state, or the field cannot open it (disabled, or Source mode, where
      the Document is not on screen). The announcement and the focus come later, from the places that
      have the new DOM: `onLayerOpened` and the layout effect below.
    */
    const setFullscreen = (next: boolean): boolean => {
      if (!enabledTools.has("fullscreen") || fullscreenRef.current === next) return false;
      if (next && (disabled || sourceTextRef.current !== null)) return false;
      fullscreenRef.current = next;
      settlingRef.current = true;
      if (next) {
        // A repeated open during the exit animation only cancels the exit.
        if (!layer) pageScrollRef.current = { x: window.scrollX, y: window.scrollY };
        const height = rootRef.current?.offsetHeight ?? 0;
        setLayer((previous) => ({ height: previous?.height ?? height, closing: false }));
      } else {
        setLayer((previous) => previous && { ...previous, closing: true });
      }
      return true;
    };
    const setFullscreenRef = useRef(setFullscreen);
    setFullscreenRef.current = setFullscreen;
    /** The layer has mounted: the Document takes focus with its selection, scrolled into view. */
    const onLayerOpened = (): boolean => {
      const current = editorRef.current;
      const focused =
        current != null && !current.isDestroyed && editable && sourceTextRef.current === null;
      if (focused) {
        current.view.focus();
        current.commands.scrollIntoView();
      }
      settlingRef.current = false;
      setNotice({ tone: "status", text: messages.editor.fullscreenOpened });
      return focused;
    };
    // The layer has gone: the field is back in its place, and so is the page's scroll and the focus.
    const layerShown = layer !== null;
    const layerShownRef = useRef(false);
    useLayoutEffect(() => {
      if (layerShownRef.current && !layerShown) {
        const { x, y } = pageScrollRef.current;
        if (window.scrollX !== x || window.scrollY !== y) window.scrollTo(x, y);
        const current = editorRef.current;
        if (sourceTextRef.current !== null) sourceFieldRef.current?.focus();
        else if (editable && current && !current.isDestroyed) current.view.focus();
        settlingRef.current = false;
        setNotice({ tone: "status", text: messages.editor.fullscreenClosed });
      }
      layerShownRef.current = layerShown;
    }, [layerShown]);
    /*
      On a touch screen, the floating Toolbar and the Bubble menu compete with the system selection
      menu ("Copy / Paste") for the same spot above the text, and lose: there, a fixed Toolbar is
      shown instead (spec, "Toolbar and Slash menu"; the same goes for the pill).
    */
    const coarsePointer = useCoarsePointer();
    const toolbarMode =
      (toolbar === "floating" || toolbar === "bubble") && coarsePointer ? "fixed" : toolbar;
    // The selection pill: in its own mode, or on top of the fixed Toolbar (but not on top of the
    // one that replaced the floating Toolbar on a touch screen).
    const bubbleShown =
      toolbarMode === "bubble" || (toolbar === "fixed" && selectionMenu && !coarsePointer);
    /*
      The HTML mode exists only with the fixed Toolbar. The floating Toolbar and the Bubble menu have
      no button for it (they live above the selection in the Document). With `none` and in `readOnly`
      there is no Toolbar. If the button disappears while the mode is open, the mode closes with an
      apply: there is no entry without an exit.
    */
    const sourceAvailable = enabledTools.has("source") && toolbarMode === "fixed" && !readOnly;

    /*
      The Document area (ADR-0059): the Document, its Skeleton, the HTML-mode field, and the Block
      handle. With `maxHeight` or `resizable`, the area scrolls them itself. The Toolbar above it and
      the Status bar below it stay in place. `relative` makes it the origin for the Block handle's
      coordinates, so the handle moves with the text. The selection pills listen to its scrolling
      (`scrollTarget`). Without these props it is a plain block with no styles: the field grows with
      the Document, as before.

      The `-mx-3 px-3` margins match the horizontal padding of the shell, as the Toolbar does: the
      scrollbar sits at the frame, and the Block handle on the left is not clipped.
    */
    const scrolls = maxHeight != null || resizable || layerShown;
    const [scrollArea, setScrollArea] = useState<HTMLDivElement | null>(null);
    const scrollTarget = scrolls ? (scrollArea ?? undefined) : undefined;
    const areaLength = maxHeight == null ? undefined : cssLength(maxHeight);
    /** Height set by the resize handle (`FieldResizer`); `null` means the starting height. */
    const [areaHeight, setAreaHeight] = useState<number | null>(null);
    // The layer sets the area's height itself (`flex-1`): `maxHeight` and `resizable` do not apply in it.
    const areaStyle: CSSProperties | undefined =
      !scrolls || layerShown
        ? undefined
        : resizable
          ? {
              height: areaHeight != null ? `${areaHeight}px` : areaLength,
              minHeight: FIELD_MIN_HEIGHT,
            }
          : { maxHeight: areaLength };

    /*
      The Table of contents in the left margin (`toc` Tool, ADR-0068). Its strip sticks under the
      fixed Toolbar. The Toolbar's height is measured, because the Toolbar wraps its row of buttons
      in a narrow field. In a scrolling field, the edge is the top of the area.
    */
    const tocOptions = toolOptions(enabledTools, "toc");
    const tocOn = enabledTools.has("toc") && tocOptions !== undefined;
    const tocOffsetVar = tocOptions?.offsetVar ?? "--topbar-h";
    const [toolbarShell, setToolbarShell] = useState<HTMLDivElement | null>(null);
    const [toolbarHeight, setToolbarHeight] = useState(0);
    useEffect(() => {
      if (!toolbarShell || typeof ResizeObserver === "undefined") {
        setToolbarHeight(toolbarShell?.offsetHeight ?? 0);
        return;
      }
      const observer = new ResizeObserver(() => setToolbarHeight(toolbarShell.offsetHeight));
      observer.observe(toolbarShell);
      return () => observer.disconnect();
    }, [toolbarShell]);
    /*
      The bottom edge of the field's sticky top: the app header and the Toolbar above the Document.
      Never `null`, even without a header: otherwise a jump would go to `scrollIntoView`, which also
      moves the page around a field with `maxHeight`. In a scrolling field, highlighting and jumps
      measure from the top of the area, and do not use this edge.
    */
    const tocStickyTop = useCallback(
      // The layer covers the app's header: its Toolbar is at the window edge, whatever the app publishes.
      () => (layerShown ? 0 : (stickyOffset(tocOffsetVar) ?? 0)) + toolbarHeight,
      [tocOffsetVar, toolbarHeight, layerShown]
    );
    /*
      A jump in edit mode puts the caret at the end of the heading, as Google Docs' document outline
      does, so the author can type right away. The Table of contents does the scrolling, and the
      engine does not scroll, so the two do not fight.
      In `readOnly` there is no caret: the Table of contents itself moves focus to the heading.
    */
    const tocFocusHeading = useCallback((heading: HTMLElement) => {
      const current = editorRef.current;
      if (!current || current.isDestroyed || !current.isEditable) return false;
      const inside = current.view.posAtDOM(heading, 0);
      const end = inside + current.state.doc.resolve(inside).parent.content.size;
      current.commands.setTextSelection(end);
      // `view.focus()`, not the `focus` command: the command moves focus one frame later, and a list
      // item that releases focus after a click would hand it back to the page.
      // ProseMirror focuses without scrolling: the Table of contents does the scrolling.
      current.view.focus();
      return true;
    }, []);

    /*
      `Alt+F10` moves focus to the first available action in the Toolbar. The key shows the floating
      Toolbar itself, without waiting for the show delay: a keyboard user has just selected text and
      is asking for the Toolbar right away. On an empty selection there is no floating Toolbar, so the
      key passes on, as if there were no Toolbar at all. The Bubble menu (`bubble`) works the same
      way, with its own plugin key.
    */
    focusToolbarRef.current = () => {
      const current = editorRef.current;
      const root = shellRef.current;
      if (!current || !root) return false;
      // An open Text card is closer than the Toolbar; a hidden one does not take the key.
      if (textCardRef.current?.focus()) return true;
      if (readOnly) return false;
      /*
        HTML mode (from the HTML field, `onKeyDown` below): there is no Document, and the other
        Toolbar actions are `aria-disabled`. Focus goes to the first one that works, which is the
        "HTML" button itself. Enter on it returns to visual mode, and the arrow keys move along the
        Toolbar as usual.
      */
      if (sourceTextRef.current !== null) {
        const action = root
          .querySelector('[role="toolbar"]')
          ?.querySelector<HTMLElement>('button:not([disabled]):not([aria-disabled="true"])');
        if (!action) return false;
        action.focus();
        return true;
      }
      // An image is selected: `Alt+F10` goes to its toolbar. Actions on the selection are closer
      // than the formatting Toolbar, which has nothing to offer an image.
      if (isImageSelection(current.state.selection)) {
        const action = root.querySelector<HTMLElement>(
          '[data-image-toolbar] [role="toolbar"] button:not([disabled])'
        );
        if (action) {
          action.focus();
          return true;
        }
      }
      if (toolbarMode === "floating" || toolbarMode === "bubble") {
        if (current.state.selection.empty) return false;
        const key = toolbarMode === "floating" ? FLOATING_TOOLBAR_KEY : SELECTION_BUBBLE_KEY;
        current.view.dispatch(current.state.tr.setMeta(key, "show"));
        /*
          On `show`, the plugin computes the position first and only then displays the menu. For a
          menu that is hidden, that count is a no-op. Without the second command, a menu hidden until
          the key press would appear with no coordinates under the field, where the plugin places its
          node, and would reach the selection only after its own timer (250 ms).
        */
        current.view.dispatch(current.state.tr.setMeta(key, "updatePosition"));
      }
      const action = root
        .querySelector('[role="toolbar"]')
        ?.querySelector<HTMLElement>("button:not([disabled])");
      if (!action) return false;
      action.focus();
      return true;
    };
    // Native `required` is not validated for `readonly` and disabled fields. This applies the same rule.
    const validatable = required && editable;
    validatableRef.current = validatable;
    const requiredMessage = messages.editor.required;

    /*
      Attributes of the editable area. The object is rebuilt only when the values change: `useEditor`
      compares options by reference, and otherwise would push them to the engine on every render.
    */
    const slashAttributes = slash.attributes;
    const triggerAttributes = triggerMenu.attributes;
    // The Document class is shared by the engine and the Skeleton: the rhythm and padding match, so the height does not jump.
    const documentClass = cn(
      proseClass(surface),
      PLACEHOLDER_CLASS,
      IMAGE_EDITING_CLASS,
      SEARCH_HIGHLIGHT_CLASS,
      // Paper is inset from the field frame, so its edge shows against the field background.
      surface === "paper" ? "my-3 min-h-24 outline-none" : "min-h-24 py-2.5 outline-none",
      // Left margin for the Block handle (`BlockHandle`): the handle sits there, so the text does
      // not overlap it. Only where the handle can appear, so not in `readOnly`. A disabled field
      // keeps it, so the text does not jump.
      !readOnly && (surface === "paper" ? "pl-10" : "pl-6")
    );
    const editorProps = useMemo(() => {
      const attributes: Record<string, string> = {
        role: "textbox",
        "aria-multiline": "true",
        "aria-placeholder": placeholderText,
        // The global `:focus-visible` outline is redundant here: the field frame shows focus,
        // as in `TextControl`.
        "data-disable-focus-ring": "true",
        class: documentClass,
        ...surfaceAttributes(surface),
      };
      if (id) attributes.id = id;
      if (labelledBy) attributes["aria-labelledby"] = labelledBy;
      else attributes["aria-label"] = ariaLabel ?? messages.editor.label;
      if (describedBy) attributes["aria-describedby"] = describedBy;
      if (invalid) attributes["aria-invalid"] = "true";
      if (required) attributes["aria-required"] = "true";
      if (readOnly) attributes["aria-readonly"] = "true";
      if (disabled) attributes["aria-disabled"] = "true";
      // The Slash menu opens only in edit mode: a read-only field has no list to promise.
      if (editable) Object.assign(attributes, slashAttributes, triggerAttributes);
      return { attributes };
    }, [
      editable,
      slashAttributes,
      triggerAttributes,
      id,
      labelledBy,
      ariaLabel,
      messages.editor.label,
      describedBy,
      invalid,
      required,
      readOnly,
      disabled,
      placeholderText,
      surface,
      documentClass,
    ]);

    /*
      While the loaders are running or the set has an error, the `useEditor` engine is built from the
      fallback set and does not leave this component. When the set changes, the fallback engine is
      destroyed: a live Tiptap engine only gets its options updated and does not rebuild its Schema,
      so a destroyed one is created again with the new set. This effect must run BEFORE `useEditor`:
      effects run in declaration order, so this one goes first.
    */
    const engineSet = extensions && !toolsError ? extensions : FALLBACK_EXTENSIONS;
    const engineRef = useRef<Editor | null>(null);
    useEffect(() => {
      if (engineRef.current?.options.extensions !== engineSet) engineRef.current?.destroy();
    }, [engineSet]);
    const engine = useEditor({
      immediatelyRender: false,
      extensions: engineSet,
      content: engineSet === extensions ? initial : "",
      editable,
      editorProps,
      onUpdate: ({ editor: updated }) => {
        // An edit clears the error: it refers to a past action.
        setNotice((current) => (current?.tone === "error" ? null : current));
        recount(updated);
        syncValidity(updated);
        throttle.schedule();
      },
      onBlur: () => throttle.flush(),
    });
    engineRef.current = engine;
    const loadFailed = !!engine && !loading && !ready;
    const editor = engine?.options.extensions === extensions ? engine : null;
    editorRef.current = editor;
    /*
      The Skeleton's Document exists only in the browser after mount: parsing with the Schema runs
      in the browser DOM, while the server and hydration see an empty Skeleton. Otherwise the markup
      would diverge. Client-only rendering without SSR gets the Document from the first frame
      (`useSyncExternalStore` returns the server snapshot only during hydration). It is recomputed on
      a new `value` and on each loader that settles. The number of loaders only grows, since a retry
      calls just the ones that failed.
    */
    const mounted = useSyncExternalStore(subscribeNever, isBrowser, isServer);
    const settledLoads = loads.filter((load) => load.done).length;
    const skeleton = useMemo(
      () =>
        mounted && !editor
          ? skeletonHtml(
              initial,
              enabledTools,
              loaders.filter((_, index) => !loads[index]?.done),
              { footnoteListName: () => footnotesRef.current }
            )
          : "",
      [mounted, !editor, initial, enabledTools, settledLoads]
    );

    /*
      The initial envelope is applied as soon as the engine appears, in the layout phase, before the
      first paint, so an empty Document never flashes on screen. This is the initial value, not an
      edit: no `onChange` and no history step. The character limit does not truncate it. The hidden
      field and the counter are synced below, as for HTML.
    */
    useLayoutEffect(() => {
      const envelope = initialDocumentRef.current;
      if (!editor || !envelope) return;
      const next = documentFromJSON(editor, envelope);
      if (!next) {
        devError("RichTextEditor: defaultValue is not a rich text document; it is ignored");
        return;
      }
      editor
        .chain()
        .setMeta(EXTERNAL_CHANGE, true)
        .setMeta("addToHistory", false)
        .setContent(next, { emitUpdate: false })
        .run();
      knownRef.current = serialize(editor);
    }, [editor]);

    /*
      Once the engine appears, the hidden field and the counter are synced with the parsed document.
      Not in `onCreate`: Tiptap fires it on a timer, already after mount, and until then the counter
      would show zero for a long `value`. Until this point the hidden field carries the incoming
      string as is. The server render gets the same string, since there is no engine there at all.
    */
    useEffect(() => {
      if (!editor) return;
      if (hiddenRef.current) hiddenRef.current.value = serialize(editor);
      // The limit may have appeared after the engine: the counter needs a fresh recount.
      if (maxLength !== undefined) setCount(countCharacters(editor.state.doc));
    }, [editor, maxLength]);

    // The proxy appears and disappears together with `required`, and the message text follows the
    // locale. Validity is checked against the Document here too, not only on an edit.
    useEffect(() => {
      if (editor) syncValidity(editor);
    }, [editor, validatable, requiredMessage]);

    // The extension redraws the placeholder only on a transaction. Without this, a locale change
    // with no document edit would leave the old string on screen.
    useEffect(() => {
      if (editor && !editor.isDestroyed) editor.view.dispatch(editor.state.tr);
    }, [editor, placeholderText]);

    useEffect(() => {
      if (!editor || value === undefined || value === knownRef.current) return;
      // The Document was replaced from outside: a pending edit refers to the old content, so there is
      // nothing to report. A replacement is not a user edit: `onChange` stays silent, and the character
      // limit does not truncate it (`EXTERNAL_CHANGE`).
      throttle.cancel();
      knownRef.current = value;
      editor.chain().setMeta(EXTERNAL_CHANGE, true).setContent(value, { emitUpdate: false }).run();
      recount(editor);
      syncValidity(editor);
      if (hiddenRef.current) hiddenRef.current.value = serialize(editor);
      rewriteSource(editor);
    }, [editor, value, throttle]);

    // `useEditor` passes every option to the engine except `editable`, which it deliberately keeps
    // on a live engine. So the mode is set with a separate call, and without an `update` event:
    // changing the mode is not an edit.
    useEffect(() => {
      if (editor && editor.isEditable !== editable) editor.setEditable(editable, false);
    }, [editor, editable]);

    // The "HTML" button disappeared (`readOnly`, a `toolbar` change, or a touch screen switching to
    // the floating mode): the mode closes and applies the edit.
    useEffect(() => {
      if (!sourceAvailable && sourceTextRef.current !== null) closeSource(false);
    }, [sourceAvailable]);

    /*
      Focus moves on a mode change after render: on entry the field does not exist yet, and on exit
      the Document is still hidden. Entering focuses the HTML field with the caret at the start.
      Exiting by the button focuses the Document with the caret at the end, as `ref.focus()` does.
    */
    useEffect(() => {
      const target = switchFocusRef.current;
      switchFocusRef.current = null;
      if (target === "source") {
        const field = sourceFieldRef.current;
        field?.focus();
        field?.setSelectionRange(0, 0);
      } else if (target === "document") {
        editorRef.current?.commands.focus("end");
      }
    }, [sourceOpen]);

    useEffect(() => {
      const form = rootRef.current?.closest("form");
      if (!form) return;
      // The capture listener on the form itself runs before the consumer's `onSubmit`:
      // React listens for bubbling at the app root.
      // The HTML-mode edit is applied first, so the form does not lose it and does not
      // receive unsanitized HTML.
      const flush = () => {
        applySourceRef.current();
        throttle.flush();
      };
      // `formdata` fires on any `new FormData(form)`, both on submit and on timer-based autosave,
      // but AFTER the entries are collected. So the fresh value is written straight into the
      // collected set.
      const fill = (event: FormDataEvent) => {
        flush();
        if (name != null && hiddenRef.current && !hiddenRef.current.disabled) {
          event.formData.set(name, hiddenRef.current.value);
        }
      };
      form.addEventListener("submit", flush, { capture: true });
      form.addEventListener("formdata", fill);
      return () => {
        form.removeEventListener("submit", flush, { capture: true });
        form.removeEventListener("formdata", fill);
      };
    }, [throttle, name]);

    const toolBridge: ToolBridge = {
      openSearch,
      // Focus and the caret are left alone: the command is called by screen code, not by the author
      // in the panel.
      closeSearch: () => closeSearch(false),
      sourceOpen: () => sourceTextRef.current !== null,
      jumpToc: (index) => tocJumpRef.current?.(index) ?? false,
      setFullscreen: (next) => setFullscreenRef.current(next),
      fullscreenOpen: () => fullscreenRef.current,
      disabled: () => disabledRef.current,
    };

    useImperativeHandle(ref, () => {
      const methods = createHandleMethods({
        editor,
        editable,
        known: () => knownRef.current,
        initialDocument: () => initialDocumentRef.current,
        tables: enabledTools.has("table"),
        sourceOpen: () => sourceTextRef.current !== null,
        sourceField: () => sourceFieldRef.current,
        applySource: () => applySourceRef.current(),
        rewriteSource,
        fieldEmpty,
        commands: (name) => {
          const descriptor = enabledTools.descriptors.find((entry) => entry.name === name);
          return editor && !editor.isDestroyed && descriptor?.commands
            ? descriptor.commands({ editor, bridge: toolBridge })
            : null;
        },
      });
      return {
        editor,
        ...methods,
        getHTML: () => {
          applySourceRef.current();
          return editor ? serialize(editor) : knownRef.current;
        },
        getMarkdown: () => {
          applySourceRef.current();
          return editor && !isDocumentEmpty(editor.state.doc) ? markdownOf(editor) : "";
        },
        setMarkdown: (markdown) => {
          if (!editor) return;
          // The same external replacement as `clear()`: the character limit does not truncate it.
          // The timer is cleared AFTER the replacement: its transaction fires `update` itself, and
          // a pending `onChange` would report the value that was already reported.
          replaceWithMarkdown(editor, markdown);
          throttle.cancel();
          recount(editor);
          emit(serialize(editor));
          rewriteSource(editor);
        },
        getJSON: () => {
          if (!editor) return null;
          applySourceRef.current();
          return documentToJSON(editor);
        },
        setJSON: (document) => {
          // The same external replacement as `setMarkdown`, in the same order.
          if (!editor || !replaceWithJSON(editor, document)) return false;
          throttle.cancel();
          recount(editor);
          emit(serialize(editor));
          rewriteSource(editor);
          return true;
        },
        openSearch: (options) => {
          devWarn(
            'RichTextEditor: handle.openSearch() is deprecated; use handle.tool("search")?.open() instead'
          );
          methods.tool("search")?.open(options);
        },
        clear: () => {
          if (!editor) return;
          throttle.cancel();
          editor.chain().setMeta(EXTERNAL_CHANGE, true).clearContent(false).run();
          recount(editor);
          syncValidity(editor);
          // The consumer calls the clear, but the owner holds the value: without `onChange`, a
          // controlled field would restore the old text on the next render.
          emit("");
          rewriteSource(editor);
        },
      };
    }, [editor, editable, throttle]);
    /*
      The `useRichTextEditorState` and `useRichTextToolState` hooks do not notice on their own that the
      engine behind `ref` changed, so we report it. The kit's signals for Tool state travel in the same
      message: the Tool set and whether the search panel is open.
    */
    const searchOpen = searchPanel !== null;
    const fullscreenOpen = layer !== null && !layer.closing;
    useEffect(
      () => publishToolSignals(ref, { tools: enabledTools, searchOpen, fullscreenOpen }),
      [ref, editor, enabledTools, searchOpen, fullscreenOpen]
    );
    // Unmounting (or a `ref` change) takes the signals back: the screen hook returns `null`.
    useEffect(() => () => clearToolSignals(ref), [ref]);

    /*
      Readiness (spec, glossary): once per mount, when the engine has been created. The effect runs
      after `useImperativeHandle` (which is in the layout phase), so `ref` already works inside
      `onReady`. The flag lives in a ref, not in the effect: in React's strict mode, effects run twice,
      but the event fires once. The loaders are already part of the condition: `editor` leaves the
      component only after them, and a set error or a failed loader (`editor === null`) does not
      count as ready.
    */
    const readySentRef = useRef(false);
    useEffect(() => {
      if (!editor || readySentRef.current) return;
      readySentRef.current = true;
      onReadyRef.current?.();
    }, [editor]);

    /*
      Field focus means the Document, the Toolbar, the kit's popovers and the HTML field together
      (`onFocus` and `onBlur` are about this). Document focus, which is the engine's `focus` and
      `blur`, is not the same: a click on the Toolbar removes it. The listener sits on the field's root
      through React: React focus events bubble through the component tree, including out of the portals
      that popovers and kit dialogs render into, so the root's DOM nesting does not matter.

      `focusout` arrives before the `focusin` of the next target, so a departure is confirmed one tick
      later: in that time, focus may have returned to the field (Document, then Toolbar, then popover,
      then Document again). A target inside the root itself is filtered out immediately. `onBlur` runs
      AFTER the pending `onChange` is flushed, so autosave on `blur` gets the fresh Document, wherever
      focus went, not only from the Document where the engine's `blur` flushes on its own.
    */
    const fieldFocusedRef = useRef(false);
    const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    useEffect(() => () => clearTimeout(leaveTimerRef.current), []);

    /** The Table of contents target is the engine's Document. The object is new for each engine. */
    const tocTarget = useMemo(
      () => ({
        get current() {
          return editor && !editor.isDestroyed ? (editor.view.dom as HTMLElement) : null;
        },
      }),
      [editor]
    );
    const searchPanelElement = (className: string) =>
      editor &&
      searchPanel && (
        <Suspense fallback={null}>
          <SearchPanel
            editor={editor}
            focus={searchPanel}
            onClose={() => closeSearch(true)}
            className={className}
          />
        </Suspense>
      );

    const editorContent = <EditorContent editor={editor} hidden={sourceOpen} />;
    // In the layer the Document is a column of about 72 characters in the middle of the window (ADR-0082).
    const column = (content: ReactNode) =>
      layerShown ? <div className="mx-auto w-full max-w-[72ch]">{content}</div> : content;
    /*
      The "Fullscreen" item and the "Collapse" button read the layer's state and toggle it; they exist
      only with the Tool on. Opening from Source mode is refused by `setFullscreen`, as for the Command.
    */
    const fullscreenItem = enabledTools.has("fullscreen")
      ? { open: fullscreenOpen, onToggle: () => setFullscreen(!fullscreenRef.current) }
      : undefined;
    /*
      "Collapse" lives in the Toolbar. Without a fixed Toolbar (floating, bubble, none, or `readOnly`) it
      sits in the layer's corner, where a finger finds it: a touch screen has no `Esc`.
    */
    const collapseCorner = !(toolbarMode === "fixed" && !readOnly) && (
      <Button
        size="sm"
        variant="outline"
        iconOnly
        icon={<CollapseIcon size={16} aria-hidden />}
        aria-label={messages.editor.fullscreenExit}
        onClick={() => setFullscreen(false)}
        className="absolute top-2 right-3 z-[3]"
      />
    );

    const renderShell = () => {
      return (
        <div
          ref={shellRef}
          data-disabled={disabled || undefined}
          className={cn(
            FIELD_SHELL_CLASS,
            "has-[[contenteditable][aria-invalid=true]]:border-danger-strong",
            "data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",
            layerShown && FULLSCREEN_SHELL_CLASS,
            layerShown && surface === "paper" && "bg-bg-0"
          )}
        >
          {editor && toolbarMode === "fixed" && !readOnly && (
            /*
              Sticks under the app header: the offset is `--topbar-h`, which `TopBar` publishes
              (ADR-0016, ADR-0019). Without a header the variable does not exist, and the Toolbar
              sticks to the window edge. The stickiness is inside the field frame: the Toolbar scrolls
              away with the field when the whole field is scrolled.

              The negative margins match the horizontal padding of the shell: the Toolbar's background
              covers text that scrolls under it, from frame edge to frame edge. `z-[1]` is local to the
              field, not a step in the layer stack: the Toolbar is not an overlay and must stay below
              any of them.
            */
            <div
              ref={setToolbarShell}
              className={cn(TOOLBAR_SHELL_CLASS, layerShown && "rounded-none")}
            >
              <EditorToolbar
                editor={editor}
                tools={enabledTools}
                disabled={disabled}
                onInsertTable={() => setTableDialogOpen(true)}
                shortcutsReference
                invisibleCharacters={enabledTools.has("invisibleCharacters")}
                fullscreen={fullscreenItem}
                focusMode={enabledTools.has("focus")}
                search={
                  enabledTools.has("search")
                    ? {
                        open: searchPanel !== null,
                        onToggle: () => (searchPanel ? closeSearch(true) : openSearch(false)),
                      }
                    : undefined
                }
                source={
                  sourceAvailable
                    ? {
                        active: sourceOpen,
                        onToggle: () => (sourceOpen ? closeSource(true) : openSource()),
                      }
                    : undefined
                }
              />
              {searchPanelElement(SEARCH_PANEL_PLACE_CLASS)}
            </div>
          )}
          {editor && !(toolbarMode === "fixed" && !readOnly) && searchPanel && (
            /*
              Without a fixed Toolbar, the search panel sits in the top corner of the field. A sticky
              wrapper of zero height keeps it in view when the Document scrolls, and does not shift the Document.
            */
            <div className="sticky top-[var(--topbar-h,0px)] z-[2] h-0">
              {searchPanelElement(SEARCH_PANEL_CORNER_CLASS)}
            </div>
          )}
          {!editor && toolbarMode === "fixed" && !readOnly && (
            // The Toolbar's Skeleton: its frame and an invisible copy of its layout. It has as many
            // rows as the Toolbar will, so the field does not jump.
            <div className={TOOLBAR_SHELL_CLASS}>
              <ToolbarSkeleton
                tools={enabledTools}
                source={sourceAvailable}
                search={enabledTools.has("search")}
                invisibleCharacters={enabledTools.has("invisibleCharacters")}
                view={enabledTools.has("fullscreen") || enabledTools.has("focus")}
                shortcutsReference
              />
            </div>
          )}
          <div
            /*
              The ref is set only on the scrolling area. A callback sets state and causes an extra
              render on mount. On an ordinary field it used to shift the first position calculation of
              the floating Toolbar: the whole Document briefly became the anchor, and the Toolbar
              landed under the field.
            */
            ref={scrolls ? setScrollArea : undefined}
            className={cn(
              scrolls && "relative -mx-3 overflow-y-auto px-3",
              layerShown && "min-h-0 flex-1"
            )}
            style={areaStyle}
          >
            {/* In HTML mode the Document is hidden but still mounted: the engine and history stay alive. */}
            {tocOn ? (
              /*
                The Table of contents' left margin: the column exists only while the strip does.
                `TocCore` draws nothing with fewer than two headings, and the text sits at the edge,
                as it does without the Tool (ADR-0068, item 2).
              */
              <div className="flex items-start">
                {editor && !sourceOpen && (
                  <Suspense fallback={null}>
                    <TocCore
                      target={tocTarget}
                      offsetVar={tocOptions.offsetVar}
                      levels={tocOptions.levels}
                      listWidth={tocOptions.listWidth}
                      stickyTop={tocStickyTop}
                      focusHeading={tocFocusHeading}
                      alignToFirstHeading
                      onCurrentChange={(tocAt) => publishToolSignals(ref, { tocAt })}
                      editor={editor}
                      jumpRef={tocJumpRef}
                      data-toc-gutter=""
                      className="sticky mr-3 shrink-0"
                      style={{
                        top: scrolls
                          ? "0.5rem"
                          : `calc(var(${tocOffsetVar}, 0px) + ${toolbarHeight}px + 0.5rem)`,
                      }}
                    />
                  </Suspense>
                )}
                <div className="min-w-0 flex-1">{column(editorContent)}</div>
              </div>
            ) : (
              column(editorContent)
            )}
            {!editor && (
              /*
              Skeleton (ADR-0058, item 11.4): before Readiness, and when a loader fails. The Document
              is static HTML with the engine's Document class, with no input. The HTML is `value`
              cleaned by the Schema (`skeleton.ts`), not as is: before the epic, `value` reached the
              page only through Schema parsing, and the Skeleton does not break that. On the server and
              before hydration it is empty.
            */
              <div
                {...surfaceAttributes(surface)}
                className={documentClass}
                dangerouslySetInnerHTML={{ __html: skeleton }}
              />
            )}
            {source && (
              /*
              The HTML-mode field sits where the Document is. The padding matches the Document area, and
              the `--rte-*` roles and the nested Paper theme are the same as the Document's. On Paper the
              field stays dark, as everywhere. The height is not less than the Document's at entry; beyond
              that it grows with its content (the mirror), and can be stretched vertically by hand.

              The name, description and invalid state are the same as the Document's: the `FormField` hint
              and error are not lost when the mode changes. Autocorrect is off, since it would corrupt code.
              Tab is native: the field does not insert a tab character, and there is no keyboard trap.
            */
              <div
                {...surfaceAttributes(surface)}
                className={cn(
                  "grid",
                  // On Paper, the light sheet stays under the dark field: a mode switch changes
                  // the sheet's content, not the sheet itself.
                  surface === "paper"
                    ? cn(EDITOR_PAPER_TOKENS_CLASS, PAPER_SHEET_CLASS, "my-3")
                    : cn(EDITOR_TOKENS_CLASS, "py-2.5")
                )}
                style={{ minHeight: source.minHeight }}
              >
                <textarea
                  ref={sourceFieldRef}
                  value={source.text}
                  aria-label={messages.editor.sourceField}
                  aria-describedby={describedBy}
                  aria-invalid={invalid || undefined}
                  aria-required={required || undefined}
                  spellCheck={false}
                  autoCapitalize="off"
                  autoCorrect="off"
                  autoComplete="off"
                  dir="ltr"
                  disabled={disabled}
                  data-disable-focus-ring="true"
                  onChange={(event) => {
                    const text = event.target.value;
                    sourceTextRef.current = text;
                    setSource((previous) => previous && { ...previous, text });
                    if (editor) syncValidity(editor);
                  }}
                  onBlur={applySource}
                  /*
                  `Alt+F10` lives in the engine's keymap, but focus here is in the `textarea`, outside
                  ProseMirror. The Toolbar does declare the shortcut (`aria-keyshortcuts`), so from the
                  HTML field it must work the same way it does from the Document.
                */
                  onKeyDown={(event) => {
                    if (
                      event.key === "F10" &&
                      event.altKey &&
                      !event.ctrlKey &&
                      !event.metaKey &&
                      !event.shiftKey &&
                      focusToolbarRef.current()
                    ) {
                      event.preventDefault();
                    }
                  }}
                  className={cn(SOURCE_BOX_CLASS, SOURCE_FIELD_CLASS)}
                />
                <div aria-hidden className={cn(SOURCE_BOX_CLASS, "invisible border-transparent")}>
                  {source.text + "\n"}
                </div>
              </div>
            )}
            {editor && !readOnly && !sourceOpen && (
              <BlockHandle editor={editor} tools={enabledTools} openRef={openBlockMenuRef} />
            )}
            {editor &&
              TableColumnHandles &&
              enabledTools.has("table") &&
              !readOnly &&
              !sourceOpen && <TableColumnHandles editor={editor} />}
          </div>
          {editor && !sourceOpen && slash.element}
          {editor && !sourceOpen && triggerMenu.element}
          {editor && bubbleShown && !readOnly && !sourceOpen && (
            <SelectionBubble
              editor={editor}
              tools={enabledTools}
              disabled={disabled}
              onCustomColor={openCustomColor}
              keyboardTarget={toolbarMode === "bubble"}
              scrollTarget={scrollTarget}
              fullscreen={fullscreenItem}
              focusMode={enabledTools.has("focus")}
            />
          )}
          {editor && toolbarMode === "floating" && !readOnly && (
            <FloatingToolbar
              editor={editor}
              tools={enabledTools}
              disabled={disabled}
              onInsertTable={() => setTableDialogOpen(true)}
              scrollTarget={scrollTarget}
            />
          )}
          {editor && TableInsertDialog && enabledTools.has("table") && !readOnly && (
            <TableInsertDialog
              editor={editor}
              open={tableDialogOpen}
              onClose={() => setTableDialogOpen(false)}
              zIndex={layerShown ? OVERLAY_LAYER.alert : undefined}
            />
          )}
          {editor && toolPopover && (
            <SelectionPopover
              editor={editor}
              request={toolPopover.request}
              open={toolPopover.open}
              onOpenChange={(open) => setToolPopover((prev) => prev && { ...prev, open })}
            />
          )}
          {editor && textCardEntries.length > 0 && (
            <Suspense fallback={null}>
              <TextCard
                editor={editor}
                entries={textCardEntries}
                enabled={!disabled && !sourceOpen}
                readOnly={readOnly}
                rootRef={shellRef}
                controlRef={textCardRef}
              />
            </Suspense>
          )}
          {editor && customColor && (
            <Suspense fallback={null}>
              <CustomColorPopover
                editor={editor}
                kind={customColor.kind}
                open={customColor.open}
                onOpenChange={(open) => setCustomColor((prev) => prev && { ...prev, open })}
              />
            </Suspense>
          )}
          {editor && enabledTools.has("image") && !readOnly && !sourceOpen && (
            <ImageToolbar
              editor={editor}
              disabled={disabled}
              onEdit={() => setImageOpen(true)}
              scrollTarget={scrollTarget}
            />
          )}
          {editor && enabledTools.has("image") && (
            <ImagePopover
              editor={editor}
              open={imageOpen}
              onOpenChange={setImageOpen}
              canUpload={onUploadImage != null}
            />
          )}
          {resizable && !layerShown && (
            <FieldResizer
              area={scrollArea}
              height={areaHeight}
              onHeight={setAreaHeight}
              disabled={disabled}
            />
          )}
          <FieldNoticeView
            notice={
              toolsError || loadFailed
                ? { tone: "error", text: messages.editor.toolsFailed }
                : notice
            }
            action={
              loadFailed && (
                <Button size="sm" variant="outline" onClick={retryLoads}>
                  {messages.editor.retry}
                </Button>
              )
            }
          />
          <StatusLine status={status} counter={counter} counterId={counterId} />
        </div>
      );
    };

    return (
      <div
        ref={rootRef}
        className={cn("relative", className)}
        // While the field is in the layer, its place keeps the height, so the page below does not jump.
        style={layer ? { minHeight: layer.height } : undefined}
        onFocus={() => {
          clearTimeout(leaveTimerRef.current);
          settlingRef.current = false;
          if (fieldFocusedRef.current) return;
          fieldFocusedRef.current = true;
          onFocusRef.current?.();
        }}
        onBlur={(event) => {
          const next = event.relatedTarget;
          if (next instanceof Node && event.currentTarget.contains(next)) return;
          clearTimeout(leaveTimerRef.current);
          leaveTimerRef.current = setTimeout(() => {
            // The Document is moving between its two places (the layer): not a departure.
            if (settlingRef.current || !fieldFocusedRef.current) return;
            fieldFocusedRef.current = false;
            throttle.flush();
            onBlurRef.current?.();
          }, 0);
        }}
      >
        {layer ? (
          <FullscreenLayer
            title={messages.editor.fullscreen}
            closing={layer.closing}
            onClose={() => setFullscreen(false)}
            onExited={() => setLayer(null)}
            onOpened={onLayerOpened}
          >
            {renderShell()}
            {collapseCorner}
          </FullscreenLayer>
        ) : (
          renderShell()
        )}
        {validatable && (
          /*
            A proxy for browser constraint validation. An `<input type="hidden">` is EXCLUDED from it
            by the spec (barred from constraint validation: `willValidate === false`, and
            `setCustomValidity` on it blocks nothing), and `contenteditable` is not a form-associated
            element at all. So `required` is held by a separate field: it is an ordinary text input
            with no `name`, so it does not reach `FormData`. The value is still carried by the hidden
            field below.

            Validity is set by `setCustomValidity` (`syncValidity`), not by the `required` attribute:
            the message comes from the kit's catalog, not from the browser's language. The invisible
            field stays focusable (`tabIndex=-1`, not `display:none`). Otherwise the browser would not
            show the bubble, and would log "An invalid form control is not focusable" to the console.
            The bubble appears at the field frame.

            When the browser rejects a submit, it focuses the first invalid field, which is the proxy
            here. From there, focus is forwarded into the Document. `invalid` catches the same case
            earlier, so focus reaches the editor even where the browser itself does not move focus.
          */
          <input
            ref={proxyRef}
            type="text"
            tabIndex={-1}
            aria-hidden="true"
            autoComplete="off"
            className="pointer-events-none absolute right-0 bottom-0 left-0 h-px opacity-0"
            onInvalid={focusField}
            onFocus={focusField}
          />
        )}
        {name != null && (
          <input
            ref={hiddenRef}
            type="hidden"
            name={name}
            /*
              The Editor writes the hidden field's value (`emit`, the engine's effects), not React. But
              React re-applies `defaultValue` on EVERY update, and for `type="hidden"` that is its value.
              So any parent render would roll the form field back to the incoming string. That is why
              after mount, `defaultValue` receives what the field already holds: React sees equality and
              leaves it alone. The server render and the first frame carry `initial`.
            */
            defaultValue={hiddenRef.current?.value ?? initial}
            // A disabled field is not submitted with the form, the same as a native field. A read-only
            // field is submitted: its value is shown, and it is not an unavailable control.
            disabled={disabled}
          />
        )}
      </div>
    );
  }
);
