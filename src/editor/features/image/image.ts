"use client";

// Origin: minimal-tiptap, `extensions/image/image.ts` and
// `extensions/file-handler/index.ts` (MIT, © 2024 Aslam,
// https://github.com/Aslam97/minimal-tiptap). The paste and drop handling of files and
// the "file → upload → address" path are taken from them; the node is rewritten as a
// `<figure>` with a caption, and `blob:` and base64 never make it into the document. The
// license is in the NOTICE file at the package root.

import { Node, type Editor } from "@tiptap/core";
import type { DOMOutputSpec, Node as ProseMirrorNode } from "@tiptap/pm/model";
import {
  NodeSelection,
  Plugin,
  PluginKey,
  TextSelection,
  type EditorState,
  type Transaction,
} from "@tiptap/pm/state";
import { closeHistory } from "@tiptap/pm/history";
import { Decoration, DecorationSet, type EditorView, type NodeView } from "@tiptap/pm/view";
import type { FieldNotice } from "../../core/fieldNotice.js";
import { isAllowedImageSrc, RICH_TEXT_SCHEMA } from "../../core/schema.js";

/** Image width: a preset from the Schema, or `null` for a custom size no wider than the Document. */
export type ImageWidth = (typeof RICH_TEXT_SCHEMA.imageWidths)[number];

export const IMAGE_WIDTHS: readonly ImageWidth[] = RICH_TEXT_SCHEMA.imageWidths;

/** Image attributes in the Document. */
export interface ImageAttributes {
  src: string;
  alt: string;
  width: ImageWidth | null;
}

/** Width from the HTML attribute: only a Schema preset is accepted; anything else means "not set". */
function widthOf(value: unknown): ImageWidth | null {
  return IMAGE_WIDTHS.find((width) => width === value) ?? null;
}

/**
 * Attributes from the `<img>` of incoming HTML, or `false` if such an image must not
 * exist in the Document. An address outside the policy (`data:`, `blob:`, `javascript:`,
 * relative) drops the whole image: there is no empty frame without an address.
 */
function attributesFromImg(img: Element | null): ImageAttributes | false {
  const src = img?.getAttribute("src")?.trim() ?? "";
  if (!img || !isAllowedImageSrc(src)) return false;
  return {
    src,
    alt: img.getAttribute("alt") ?? "",
    width: widthOf(img.getAttribute("data-width")),
  };
}

/** The `<img>` on output: `alt` always (empty means "no description"), `data-width` if set. */
function imgAttributes(node: ProseMirrorNode): Record<string, string> {
  const { src, alt, width } = node.attrs as ImageAttributes;
  // `src` is checked on output too: only a raw `ref.editor` could set an image with a foreign
  // address, and in the HTML it is emitted without an address, as a link in `link.ts` is.
  const attributes: Record<string, string> = isAllowedImageSrc(src) ? { src } : {};
  attributes.alt = alt ?? "";
  if (widthOf(width)) attributes["data-width"] = width!;
  return attributes;
}

/** Whether the image has a caption, that is, a non-empty `figcaption`. */
function hasCaption(node: ProseMirrorNode): boolean {
  return (node.firstChild?.childCount ?? 0) > 0;
}

/** The image under the selection: the selected node, or the image whose caption holds the caret. */
export function selectedImage(state: EditorState): { pos: number; node: ProseMirrorNode } | null {
  const { selection } = state;
  if (selection instanceof NodeSelection && selection.node.type.name === IMAGE_NODE) {
    return { pos: selection.from, node: selection.node };
  }
  const { $from } = selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth);
    if (node.type.name === IMAGE_NODE) return { pos: $from.before(depth), node };
  }
  return null;
}

/**
 * Whether the image is selected as a whole. If so, the image toolbar is shown above it
 * instead of the formatting toolbar.
 *
 * It lives in the node, not in `ImageToolbar.tsx`: the condition is needed by the shared UI
 * (the floating Toolbar and the selection menu), and the shared UI must not import the image
 * toolbar, which itself takes `focusWithin` from it (ADR-0060, item 14).
 */
export function isImageSelection(selection: unknown): boolean {
  return selection instanceof NodeSelection && selection.node.type.name === IMAGE_NODE;
}

/** Stub type for a dropped Markdown image: there is no such node in the Schema. */
const DROPPED_IMAGE = "droppedImage";

/** Name of the image node in the engine's Schema. */
export const IMAGE_NODE = "image";
const CAPTION_NODE = "imageCaption";

/**
 * The image caption: a `figcaption` with text and Marks.
 *
 * It deliberately has no parse rule of its own. A caption exists only inside an image, and the
 * image's rule parses it (`contentElement`). A `<figcaption>` outside a `<figure>` in pasted
 * content becomes plain text, not an image without an address.
 */
const ImageCaption = Node.create({
  name: CAPTION_NODE,
  content: "inline*",
  // The caption is not a Block of its own: "Turn into heading" and the lists leave it alone,
  // because a `figure` holds nothing but the caption.
  defining: true,
  parseHTML: () => [],
  renderHTML: () => ["figcaption", 0],
  // Markdown has no caption: `![alt](src)` cannot express one.
  renderMarkdown: () => "",
});

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    richImage: {
      /** Open the image popover: the Toolbar button and the Insert menu item. */
      openImageEditor: () => ReturnType;
      /**
       * Insert an image in place of the selection. An empty paragraph is replaced; otherwise the
       * Block goes next to it. The caret moves into the caption. An address outside the policy
       * returns `false`.
       */
      insertImage: (attributes: Partial<ImageAttributes> & { src: string }) => ReturnType;
      /** Update the image under the selection; an address outside the policy returns `false`. */
      updateImage: (attributes: Partial<ImageAttributes>) => ReturnType;
      /** Remove the image under the selection. */
      removeImage: () => ReturnType;
      /**
       * Upload files through `onUploadImage` and insert the images at `pos` (by default, at the
       * caret). Without an uploader it returns `false` and shows a hint.
       */
      uploadImages: (files: readonly File[], pos?: number) => ReturnType;
    };
  }
}

export interface RichImageOptions {
  /** Open the image popover; `RichTextEditor` owns it. */
  onOpenEditor: () => void;
  /** Hint for an empty caption. Read on every re-render, so a locale change takes effect. */
  captionPlaceholder: () => string;
  /** Label of the upload placeholder for file `name`. */
  uploadingLabel: (name: string) => string;
  /** The consumer's uploader. `undefined` means files are not accepted. Read at the moment of insertion. */
  upload: () => ((file: File) => Promise<string>) | undefined;
  /**
   * The text and tone of the Field notice for a file event. The strings come from the message
   * catalog of `RichTextEditor`. The engine command `showNotice` sends the notice itself
   * (`fieldNotice.ts`), through the same channel as the built-in Tools.
   */
  describeNotice: (notice: ImageNotice) => FieldNotice;
}

/** File event: upload in progress, upload done, upload failed, or files not accepted. */
export type ImageNotice =
  | { kind: "uploading"; name: string }
  | { kind: "uploaded"; name: string }
  | { kind: "failed"; name: string }
  | { kind: "notImage"; name: string }
  | { kind: "unsupported" };

/** Report files through the Field notice channel. If the Editor has been removed from the screen, do it silently. */
function notify(editor: Editor, options: RichImageOptions, notice: ImageNotice): void {
  if (!editor.isDestroyed) editor.commands.showNotice(options.describeNotice(notice));
}

/**
 * Where a new image goes: an empty paragraph under the caret is replaced by it. Otherwise it
 * goes next to the current Block. `replaceRangeWith` finds the place itself, splitting the
 * paragraph if the caret is in the middle.
 */
function placeImage(tr: Transaction, pos: number, image: ProseMirrorNode): number {
  const $pos = tr.doc.resolve(pos);
  const parent = $pos.parent;
  // An empty paragraph may be replaced only if its place accepts an image. The first paragraph
  // of a list item must stay a paragraph.
  const index = $pos.depth > 0 ? $pos.index(-1) : 0;
  if (
    parent.isTextblock &&
    parent.content.size === 0 &&
    $pos.depth > 0 &&
    $pos.node(-1).canReplaceWith(index, index + 1, image.type)
  ) {
    const before = $pos.before();
    tr.replaceWith(before, $pos.after(), image);
    return before;
  }
  tr.replaceRangeWith(pos, pos, image);
  // The node in the document is the same object that was inserted, so its position is found by
  // identity, not by recomputing the place that `replaceRangeWith` chose.
  let found = -1;
  tr.doc.descendants((node, at) => {
    if (node === image) found = at;
    return found < 0 && !node.isTextblock;
  });
  return found;
}

/** Move the caret to the end of the image caption at position `pos`. */
function selectCaption(tr: Transaction, pos: number): void {
  const image = tr.doc.nodeAt(pos);
  if (!image) return;
  // pos + 1 is the start of the caption, and + 1 more is inside it. The end is that plus its content.
  const end = pos + 2 + (image.firstChild?.content.size ?? 0);
  tr.setSelection(TextSelection.create(tr.doc, end));
}

/**
 * The Document's image: a `<figure>` with an `<img>` and an optional `<figcaption>`.
 *
 * WHY A `figure` WITH A CAPTION NODE, AND NOT TIPTAP'S `Image`. The Tiptap extension is a bare
 * `<img>` with no caption, and the caption is part of "Set v1". Here the caption is a text node
 * of its own inside the image. Marks and links work in it, and "Turn into heading" or the lists
 * leave it alone, since the `figure` Schema lets nothing inside except the caption.
 *
 * `atom: true` — the image is selected as a whole (a click on it, the arrows, Backspace after
 * it), like a divider. This also makes a Document holding one image non-empty for the engine's
 * `isEmpty`, which `required` and the empty value `""` rely on.
 *
 * AN EMPTY CAPTION IS NOT WRITTEN. The caption node is always in the Document, otherwise there
 * would be nowhere to type it. In HTML the `figcaption` is emitted only when it has text. The
 * reverse path is symmetrical: a `<figure>` without a caption and a bare `<img>` both get an
 * empty one.
 */
export const RichImage = Node.create<RichImageOptions>({
  name: IMAGE_NODE,
  group: "block",
  content: CAPTION_NODE,
  atom: true,
  selectable: true,
  draggable: true,
  isolating: true,

  addOptions() {
    return {
      onOpenEditor: () => {},
      captionPlaceholder: () => "",
      uploadingLabel: (name) => name,
      upload: () => undefined,
      describeNotice: () => ({ tone: "status", text: "" }),
    };
  },

  addExtensions() {
    return [ImageCaption];
  },

  addAttributes() {
    // The parse rule (`attributesFromImg`) reads the attributes and `renderHTML` writes them.
    // Tiptap takes nothing from its own `figure` elements. Otherwise `<figure src="javascript:…">`
    // would bypass the address check.
    const own = { parseHTML: () => null, rendered: false };
    return {
      src: { default: "", ...own },
      alt: { default: "", ...own },
      width: { default: null, ...own },
    };
  },

  parseHTML() {
    return [
      {
        tag: "figure",
        getAttrs: (dom) => attributesFromImg(dom.querySelector("img")),
        // The content is the caption text. Without one it is an empty element, so the caption
        // comes out empty, not made from random text inside the `figure`.
        contentElement: (dom) =>
          (dom as HTMLElement).querySelector("figcaption") ??
          dom.ownerDocument!.createElement("figcaption"),
      },
      { tag: "img[src]", getAttrs: (dom) => attributesFromImg(dom) },
    ];
  },

  renderHTML({ node }): DOMOutputSpec {
    const img: DOMOutputSpec = ["img", imgAttributes(node)];
    if (!hasCaption(node)) return ["figure", img];
    /*
      A content hole in DOMOutputSpec must be the only child of its element, but the caption
      comes AFTER the `img` in the same `figure`. So with a caption, the node is a DOM node:
      `contentDOM` is the `figure` itself, and the caption is appended after the image.
    */
    const figure = document.createElement("figure");
    const element = document.createElement("img");
    for (const [name, value] of Object.entries(imgAttributes(node))) {
      element.setAttribute(name, value);
    }
    figure.append(element);
    return { dom: figure, contentDOM: figure };
  },

  markdownTokenName: "image",

  parseMarkdown: (token) => {
    const src = typeof token.href === "string" ? token.href.trim() : "";
    /*
      An image with a foreign address disappears entirely: its `alt` has no place in the
      Document's text. `@tiptap/markdown` reads an empty result as "not mine" and passes the token
      to the fallback parser, which would return `alt` as text. So the result is a node with no
      type in the Schema. Conforming to the Schema (`markdown.ts`, `conform`) unwraps such nodes
      into their content, and this one has none.
    */
    if (!isAllowedImageSrc(src)) return { type: DROPPED_IMAGE };
    return {
      type: IMAGE_NODE,
      attrs: { src, alt: typeof token.text === "string" ? token.text : "", width: null },
      content: [{ type: CAPTION_NODE }],
    };
  },

  renderMarkdown: (node) => {
    const src = String(node.attrs?.src ?? "");
    const alt = String(node.attrs?.alt ?? "").replace(/([[\]\\])/g, "\\$1");
    return isAllowedImageSrc(src) ? `![${alt}](${src.replace(/[()\s]/g, encodeURIComponent)})` : "";
  },

  addCommands() {
    return {
      openImageEditor:
        () =>
        ({ editor, dispatch }) => {
          if (!editor.isEditable) return false;
          if (dispatch) this.options.onOpenEditor();
          return true;
        },
      insertImage:
        (attributes) =>
        ({ tr, dispatch, state }) => {
          const src = attributes.src.trim();
          if (!isAllowedImageSrc(src)) return false;
          const image = state.schema.nodes[IMAGE_NODE]!.create(
            { src, alt: attributes.alt ?? "", width: widthOf(attributes.width) },
            state.schema.nodes[CAPTION_NODE]!.create()
          );
          if (dispatch) {
            const at = placeImage(tr, tr.selection.from, image);
            if (at >= 0) selectCaption(tr, at);
          }
          return true;
        },
      updateImage:
        (attributes) =>
        ({ tr, dispatch, state }) => {
          const found = selectedImage(state);
          if (!found) return false;
          const next = { ...(found.node.attrs as ImageAttributes), ...attributes };
          next.src = next.src.trim();
          if (!isAllowedImageSrc(next.src)) return false;
          next.width = widthOf(next.width);
          if (dispatch) {
            const wasNode = tr.selection instanceof NodeSelection;
            tr.setNodeMarkup(found.pos, undefined, next);
            if (wasNode) tr.setSelection(NodeSelection.create(tr.doc, found.pos));
          }
          return true;
        },
      removeImage:
        () =>
        ({ tr, dispatch, state }) => {
          const found = selectedImage(state);
          if (!found) return false;
          if (dispatch) tr.delete(found.pos, found.pos + found.node.nodeSize);
          return true;
        },
      uploadImages:
        (files, pos) =>
        ({ editor, dispatch }) => {
          if (!editor.isEditable) return false;
          if (!this.options.upload()) {
            if (dispatch) notify(editor, this.options, { kind: "unsupported" });
            return false;
          }
          if (dispatch)
            void uploadFiles(editor, this.options, files, pos ?? editor.state.selection.from);
          return true;
        },
    };
  },

  addKeyboardShortcuts() {
    const inCaption = () => this.editor.state.selection.$from.parent.type.name === CAPTION_NODE;
    return {
      /*
        Enter in the caption exits it into a new paragraph under the image. A caption is one line,
        and the Schema does not let a second `figcaption` into the `figure`. Enter on a selected
        image enters its caption, which is how keyboard users reach the caption: they select the
        image with the arrows.
      */
      Enter: ({ editor }) => {
        const found = selectedImage(editor.state);
        if (!found) return false;
        if (editor.state.selection instanceof NodeSelection) {
          return editor.commands.command(({ tr }) => {
            selectCaption(tr, found.pos);
            return true;
          });
        }
        if (!inCaption()) return false;
        return editor.commands.command(({ tr, state }) => {
          const after = found.pos + found.node.nodeSize;
          tr.insert(after, state.schema.nodes.paragraph!.create());
          tr.setSelection(TextSelection.create(tr.doc, after + 1));
          return true;
        });
      },
      // Backspace at the start of the caption selects the image instead of merging the caption
      // into the Block above. A merge would break the image apart into text.
      Backspace: ({ editor }) => {
        const { selection } = editor.state;
        if (!inCaption() || !selection.empty || selection.$from.parentOffset > 0) return false;
        const found = selectedImage(editor.state);
        if (!found) return false;
        return editor.commands.setNodeSelection(found.pos);
      },
    };
  },

  addNodeView() {
    return ({ node, view, getPos, editor }) =>
      new ImageView(node, view, getPos as () => number | undefined, editor);
  },

  addProseMirrorPlugins() {
    return [
      captionPlaceholderPlugin(this.options.captionPlaceholder),
      uploadPlugin(this.editor, this.options),
    ];
  },
});

/**
 * The empty-caption hint is a decoration, not text: it does not get into the Document or the HTML.
 * The `rte-caption-empty` class hides an empty caption in a non-editable field. `prose.ts` does
 * not know about it, because saved HTML has no empty caption at all.
 */
function captionPlaceholderPlugin(text: () => string): Plugin {
  return new Plugin({
    key: new PluginKey("imageCaptionPlaceholder"),
    props: {
      decorations(state) {
        const decorations: Decoration[] = [];
        state.doc.descendants((node, pos) => {
          if (node.type.name !== CAPTION_NODE) return true;
          if (node.content.size === 0) {
            decorations.push(
              Decoration.node(pos, pos + node.nodeSize, {
                class: "rte-caption-empty",
                "data-placeholder": text(),
              })
            );
          }
          return false;
        });
        return DecorationSet.create(state.doc, decorations);
      },
    },
  });
}

/** Whether the address has a scheme (`https:`, `data:`, `blob:`…). */
const SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/**
 * Turns the address from the popover field into the image address, or returns `null` if such an
 * image must not exist in the Document. The rule is the same as for a link (`normalizeLinkInput`):
 * an address without a scheme gets `https://`, and one starting with `/`, `#`, `?` or `.` is an
 * error, not a path from the current page. It is stricter in one respect: only the `http` and
 * `https` schemes are allowed, not `mailto:`, `data:` or `blob:`.
 */
export function normalizeImageInput(input: string): string | null {
  const value = input.trim();
  if (!value || /\s/.test(value)) return null;
  if (SCHEME.test(value)) return isAllowedImageSrc(value) ? value : null;
  if (/^[/#?.]/.test(value)) return null;
  const candidate = `https://${value}`;
  return isAllowedImageSrc(candidate) ? candidate : null;
}

/** An action on the upload placeholders, passed as a transaction meta, without changing the Document. */
type UploadAction = { add: { id: object; pos: number; name: string } } | { remove: { id: object } };

const UPLOAD_KEY = new PluginKey<DecorationSet>("imageUpload");

/** Where the upload placeholder `id` is now. Its position moves along with the edits around it. */
function placeholderPos(state: EditorState, id: object): number | null {
  const found = UPLOAD_KEY.getState(state)?.find(undefined, undefined, (spec) => spec.id === id);
  return found?.[0]?.from ?? null;
}

/** Whether the clipboard HTML contains text. If so, it is a selection of the document, not a single image. */
function htmlHasText(html: string): boolean {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return (doc.body.textContent ?? "").trim() !== "";
}

/**
 * Files from the clipboard and from drag and drop, and the upload placeholders.
 *
 * THE PLACEHOLDER IS A DECORATION, NOT A NODE. While an upload is running, the Document does not
 * change at all. An image with a `blob:` address is in neither `getHTML()`, nor `onChange`, nor
 * the form, nor the edit history. The decoration moves along with the text around it. When the
 * upload completes, the real image takes its place in one transaction, so it is undone in one
 * step. A failed upload removes the decoration, and there is nothing to roll back because no
 * edit was made. This is the upload recipe from the ProseMirror examples. minimal-tiptap inserted
 * the node with a `blob:` address right away and swapped the address later, and that address could
 * leak into the value.
 *
 * WHICH FILES ARE OURS. Pasted content that has text in its clipboard HTML is a selection from
 * Word or a web page. The snapshot of the selection that Word puts next to an image must not be
 * uploaded, so the normal HTML parse runs. HTML without text ("Copy image" in a browser) is the
 * image itself. With an uploader the file is uploaded. Without one, the HTML parse stays, which
 * takes the image by its address, if the address is within the policy.
 */
function uploadPlugin(editor: Editor, options: RichImageOptions): Plugin {
  const start = (files: readonly File[], pos: number) => {
    if (!options.upload()) {
      notify(editor, options, { kind: "unsupported" });
      return;
    }
    void uploadFiles(editor, options, files, pos);
  };

  return new Plugin<DecorationSet>({
    key: UPLOAD_KEY,
    state: {
      init: () => DecorationSet.empty,
      apply(tr, set) {
        let next = set.map(tr.mapping, tr.doc);
        const action = tr.getMeta(UPLOAD_KEY) as UploadAction | undefined;
        if (action && "add" in action) {
          const { id, name } = action.add;
          const widget = Decoration.widget(
            action.add.pos,
            () => uploadPlaceholder(options.uploadingLabel(name), previews.get(id)),
            { id, side: -1 }
          );
          next = next.add(tr.doc, [widget]);
        } else if (action && "remove" in action) {
          const { id } = action.remove;
          next = next.remove(next.find(undefined, undefined, (spec) => spec.id === id));
          const preview = previews.get(id);
          if (preview) URL.revokeObjectURL(preview);
          previews.delete(id);
        }
        return next;
      },
    },
    props: {
      decorations: (state) => UPLOAD_KEY.getState(state),
      handlePaste(view, event) {
        const files = Array.from(event.clipboardData?.files ?? []);
        if (files.length === 0 || !editor.isEditable) return false;
        const html = event.clipboardData?.getData("text/html") ?? "";
        if (html && (htmlHasText(html) || !options.upload())) return false;
        event.preventDefault();
        start(files, view.state.selection.from);
        return true;
      },
      handleDrop(view, event, _slice, moved) {
        const files = Array.from(event.dataTransfer?.files ?? []);
        if (moved || files.length === 0 || !editor.isEditable) return false;
        event.preventDefault();
        let pos = view.state.selection.from;
        try {
          pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos ?? pos;
        } catch {
          // Without a layout (tests, a hidden field) there is no position from coordinates,
          // so the image goes at the caret.
        }
        start(files, pos);
        return true;
      },
    },
  });

  /** The placeholder is a block with a preview and the label "Uploading …". It does not get into the Document. */
  function uploadPlaceholder(label: string, preview: string | undefined): HTMLElement {
    const box = document.createElement("div");
    box.contentEditable = "false";
    box.dataset.imageUpload = "";
    box.className = UPLOAD_PLACEHOLDER_CLASS;
    if (preview) {
      const img = document.createElement("img");
      img.src = preview;
      img.alt = "";
      img.className = "max-h-40 max-w-full rounded-(--rte-radius) opacity-60";
      box.append(img);
    }
    const text = document.createElement("span");
    text.textContent = label;
    box.append(text);
    return box;
  }
}

/**
 * Previews of files in the placeholders, keyed by upload. The `blob:` address lives only in the
 * placeholder's DOM and is revoked along with it. It does not get into the Document.
 */
const previews = new Map<object, string>();

/**
 * Upload the files one by one and insert the images, starting at `pos`.
 *
 * ONE BY ONE, NOT ALL AT ONCE. The next image goes right after the previous one, and the order in
 * the Document is the order of the files, not the order in which uploads finished. Each file has
 * its own placeholder, which appears when the file's turn comes.
 */
async function uploadFiles(
  editor: Editor,
  options: RichImageOptions,
  files: readonly File[],
  pos: number
): Promise<void> {
  let at = pos;
  for (const file of files) {
    const upload = options.upload();
    if (editor.isDestroyed || !upload) return;
    if (!file.type.startsWith("image/")) {
      notify(editor, options, { kind: "notImage", name: file.name });
      continue;
    }
    const id = {};
    if (typeof URL.createObjectURL === "function") previews.set(id, URL.createObjectURL(file));
    const { view } = editor;
    const add: UploadAction = {
      add: { id, pos: Math.min(at, view.state.doc.content.size), name: file.name },
    };
    view.dispatch(view.state.tr.setMeta(UPLOAD_KEY, add));
    notify(editor, options, { kind: "uploading", name: file.name });

    let src: unknown = null;
    try {
      src = await upload(file);
    } catch {
      src = null;
    }
    if (editor.isDestroyed) {
      // The field was unmounted in the middle of the upload. The placeholder is gone, so the preview is revoked here.
      const preview = previews.get(id);
      if (preview) URL.revokeObjectURL(preview);
      previews.delete(id);
      return;
    }

    const placed = placeholderPos(editor.state, id);
    const tr = editor.state.tr.setMeta(UPLOAD_KEY, { remove: { id } } satisfies UploadAction);
    const address = typeof src === "string" ? src.trim() : "";
    if (!isAllowedImageSrc(address)) {
      editor.view.dispatch(tr);
      notify(editor, options, { kind: "failed", name: file.name });
      continue;
    }
    // The placeholder disappeared along with the text around it, so there is nowhere for the image to go.
    if (placed == null) {
      editor.view.dispatch(tr);
      at = editor.state.selection.from;
      continue;
    }
    const { schema } = editor.state;
    const image = schema.nodes[IMAGE_NODE]!.create(
      { src: address, alt: "", width: null },
      schema.nodes[CAPTION_NODE]!.create()
    );
    const inserted = placeImage(tr, placed, image);
    // Its own history step: undo removes the image, not the text typed just before it
    // within the same half second.
    closeHistory(tr);
    editor.view.dispatch(tr);
    at = inserted >= 0 ? inserted + image.nodeSize : editor.state.selection.from;
    notify(editor, options, { kind: "uploaded", name: file.name });
  }
}

const UPLOAD_PLACEHOLDER_CLASS =
  "my-1 flex min-h-16 flex-col items-center justify-center gap-2 rounded-(--rte-radius) " +
  "border border-dashed border-(--rte-code-border) bg-(--rte-code-background) p-3 " +
  "text-sm text-(--rte-muted-foreground)";

/** The width the handle snaps to: the nearest preset to the Document width fraction. */
function nearestWidth(percent: number): ImageWidth {
  return IMAGE_WIDTHS.reduce((best, width) =>
    Math.abs(Number(width) - percent) < Math.abs(Number(best) - percent) ? width : best
  );
}

/**
 * The image's view in the Editor: a `figure` with the image, width handles, and a place for the caption.
 *
 * ITS OWN VIEW, NOT REACT. The node needs an image and two handles. A React node would make Tiptap
 * render on every image and need a portal of its own, for no gain.
 *
 * HANDLES ARE FOR THE MOUSE ONLY. They are `aria-hidden` and not focusable. From the keyboard the
 * same width is set with presets in the image popover. While a handle is being dragged, the width
 * changes in the DOM. On release the nearest preset goes into the Document: one edit, one undo.
 */
class ImageView implements NodeView {
  dom: HTMLElement;
  contentDOM: HTMLElement;
  private img: HTMLImageElement;
  private node: ProseMirrorNode;

  constructor(
    node: ProseMirrorNode,
    private view: EditorView,
    private getPos: () => number | undefined,
    private editor: Editor
  ) {
    this.node = node;
    this.dom = document.createElement("figure");
    const frame = document.createElement("div");
    frame.contentEditable = "false";
    frame.className = "relative";
    this.img = document.createElement("img");
    frame.append(this.img);
    for (const side of ["left", "right"] as const) frame.append(this.handle(side));
    this.contentDOM = document.createElement("div");
    this.dom.append(frame, this.contentDOM);
    this.render();
  }

  private render() {
    const attributes = imgAttributes(this.node);
    for (const name of ["src", "alt", "data-width"]) {
      if (attributes[name] == null) this.img.removeAttribute(name);
      else this.img.setAttribute(name, attributes[name]);
    }
  }

  private handle(side: "left" | "right"): HTMLElement {
    const handle = document.createElement("div");
    handle.setAttribute("aria-hidden", "true");
    handle.dataset.resizeHandle = side;
    handle.className =
      side === "left" ? RESIZE_HANDLE_CLASS + " -left-1" : RESIZE_HANDLE_CLASS + " -right-1";
    handle.addEventListener("pointerdown", (event) => this.startResize(event, side));
    return handle;
  }

  private startResize(event: PointerEvent, side: "left" | "right") {
    if (!this.editor.isEditable || event.button !== 0) return;
    event.preventDefault();
    const container = this.dom.parentElement?.getBoundingClientRect().width ?? 0;
    const start = this.dom.getBoundingClientRect().width;
    if (container <= 0 || start <= 0) return;
    const startX = event.clientX;
    const target = event.currentTarget as HTMLElement;
    target.setPointerCapture?.(event.pointerId);
    // The image is centered, so its edge follows the cursor when the width changes
    // by twice the shift.
    const sign = side === "right" ? 2 : -2;
    let width = start;
    const move = (moveEvent: PointerEvent) => {
      width = Math.min(
        container,
        Math.max(container * 0.25, start + sign * (moveEvent.clientX - startX))
      );
      this.dom.style.width = `${width}px`;
    };
    const end = () => {
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", end);
      target.removeEventListener("pointercancel", end);
      this.dom.style.removeProperty("width");
      const pos = this.getPos();
      if (pos == null) return;
      const next = nearestWidth((width / container) * 100);
      if (next === this.node.attrs.width) return;
      this.view.dispatch(
        this.view.state.tr.setNodeMarkup(pos, undefined, { ...this.node.attrs, width: next })
      );
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", end);
    target.addEventListener("pointercancel", end);
  }

  update(node: ProseMirrorNode): boolean {
    if (node.type !== this.node.type) return false;
    this.node = node;
    this.render();
    return true;
  }

  // The handles behave on their own: they do not start a selection or a drag of the node.
  stopEvent(event: Event): boolean {
    return event.target instanceof Element && event.target.closest("[data-resize-handle]") != null;
  }

  ignoreMutation(
    mutation: MutationRecord | { type: "selection"; target: globalThis.Node }
  ): boolean {
    if (mutation.type === "selection") return false;
    return !this.contentDOM.contains(mutation.target);
  }
}

/*
  The resize handle is a strip along the edge of the image. It is visible only on the selected
  image in an editable field (the Editor's `prose` classes, `ProseMirror-selectednode`).
*/
const RESIZE_HANDLE_CLASS =
  "rte-resize-handle absolute top-1/2 hidden h-10 w-2 -translate-y-1/2 cursor-ew-resize " +
  "rounded-full border border-(--rte-background) bg-(--rte-primary)";
