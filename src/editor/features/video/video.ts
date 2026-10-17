"use client";

import {
  Node,
  type Editor,
  type JSONContent,
  type MarkdownToken,
  type MarkdownTokenizer,
} from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin, PluginKey, TextSelection, type Transaction } from "@tiptap/pm/state";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { VideoView } from "./VideoView.js";
import { VIDEO_DEFAULTS, type VideoAutoload } from "./videoOptions.js";
import { parseVideoLink, videoLinkFromPlayer, videoLinkOf } from "./videoLink.js";
import {
  isVideoProvider,
  isVideoSrc,
  VIDEO_BLOCK,
  type VideoLink,
  type VideoProvider,
} from "./videoSrc.js";

/** The node name in the engine's Schema. */
export const VIDEO_NODE = VIDEO_BLOCK;

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    video: {
      /** Put a video Block at the caret (`placeVideo`). The link comes from `parseVideoLink`. */
      insertVideo: (link: VideoLink) => ReturnType;
    };
  }
}

export interface VideoOptions {
  /** The services whose links the Editor accepts: the `tools` set decides (`youtube`, `twitch`). */
  providers: readonly VideoProvider[];
  /**
   * The `autoload` option of each service (`tool("youtube", { autoload })`): the player renders
   * at once, or a placeholder until a click. The node view reads it; the Document does not change
   * because of it.
   */
  autoload: VideoAutoload;
}

/** The services of the Editor the engine lives in: the popover and the paste rules read them. */
export function videoProviders(editor: Editor): readonly VideoProvider[] {
  const extension = editor.extensionManager.extensions.find((item) => item.name === VIDEO_NODE);
  return (extension?.options as VideoOptions | undefined)?.providers ?? [];
}

/**
 * A video Block node built from a link, if the service is enabled in this Editor. The link is
 * brought to its canonical form, and its service becomes `provider`.
 */
function videoNode(editor: Editor, input: string): ProseMirrorNode | null {
  const link = parseVideoLink(input);
  const type = editor.schema.nodes[VIDEO_NODE];
  return link && type && videoProviders(editor).includes(link.provider)
    ? type.create({ provider: link.provider, link: link.src })
    : null;
}

/**
 * Put a video Block. The empty paragraph under the caret (or the paragraph where a bare link was
 * typed, `replaceCurrent`) is the Block's place. Otherwise the Block goes after the current Block,
 * at the nearest level where it is allowed to stand (not inside a quote, if it cannot be there).
 * After the Block there is always a paragraph with the caret: a video is an Atom, and if it were
 * last, there would be nowhere to type next.
 */
export function placeVideo(tr: Transaction, node: ProseMirrorNode, replaceCurrent: boolean) {
  const { $from } = tr.selection;
  const paragraph = tr.doc.type.schema.nodes.paragraph!;
  let end: number;
  const parent = $from.depth > 0 ? $from.node($from.depth - 1) : null;
  if (
    replaceCurrent &&
    parent &&
    $from.parent.isTextblock &&
    parent.canReplaceWith(
      $from.index($from.depth - 1),
      $from.indexAfter($from.depth - 1),
      node.type
    )
  ) {
    const start = $from.before();
    tr.replaceWith(start, $from.after(), node);
    end = start + node.nodeSize;
  } else {
    let depth = $from.depth;
    while (
      depth > 0 &&
      !$from
        .node(depth - 1)
        .canReplaceWith($from.indexAfter(depth - 1), $from.indexAfter(depth - 1), node.type)
    ) {
      depth -= 1;
    }
    if (depth === 0) return false;
    end = $from.after(depth);
    tr.insert(end, node);
    end += node.nodeSize;
  }
  // After the Block comes a paragraph: the existing one if there is one, otherwise a new empty one.
  if (!tr.doc.resolve(end).nodeAfter?.isTextblock) tr.insert(end, paragraph.create());
  tr.setSelection(TextSelection.create(tr.doc, end + 1));
  return true;
}

/**
 * A bare video link under the caret: the only content of the top-level paragraph (text, a link,
 * or both), whose service is enabled.
 */
function bareLinkNode(editor: Editor): ProseMirrorNode | null {
  const { selection } = editor.state;
  const { $from } = selection;
  if (!selection.empty || $from.parent.type.name !== "paragraph") return null;
  // A paragraph with a line break or any other node besides text does not become a player link.
  let onlyText = $from.parent.childCount > 0;
  $from.parent.forEach((child) => {
    if (!child.isText) onlyText = false;
  });
  return onlyText ? videoNode(editor, $from.parent.textContent) : null;
}

/**
 * Parsing of the HTML that the Tiptap YouTube and Twitch extensions write
 * (`div[data-youtube-video] iframe`, `div[data-twitch-video] iframe`) and of a lone player `iframe`:
 * the player address is turned back into a link to the video. The player does not get into the
 * Document.
 */
function attrsFromPlayer(
  element: HTMLElement,
  providers: readonly VideoProvider[],
  only?: VideoProvider
): { provider: VideoProvider; link: string } | false {
  const frame = element.localName === "iframe" ? element : element.querySelector("iframe");
  const link = videoLinkFromPlayer(frame?.getAttribute("src"));
  return link && providers.includes(link.provider) && (!only || link.provider === only)
    ? { provider: link.provider, link: link.src }
    : false;
}

/**
 * Markdown (ADR-0071, item 7): a video is a link. The Block is written as an address on its own
 * line, and the same line (bare or inside `<…>`) among paragraphs is read back as the Block, if its
 * service is enabled. A link inside paragraph text, `[text](address)`, and a link in a list stay
 * ordinary links: Markdown does not know about the player.
 */
function markdownTokenizer(providers: readonly VideoProvider[]): MarkdownTokenizer {
  return {
    name: VIDEO_NODE,
    level: "block",
    // A link line does not interrupt a paragraph (as in CommonMark). Without `start` the Markdown
    // manager substitutes its own, and that breaks the parsing of inline tokens in neighboring paragraphs.
    start: () => -1,
    tokenize(src) {
      const line =
        /^ {0,3}(?:<(https?:\/\/[^\s<>]+)>|(https?:\/\/\S+))[ \t]*(?=\n[ \t]*(?:\n|$)|$)/.exec(src);
      const link = line && parseVideoLink(line[1] ?? line[2] ?? "");
      return link && providers.includes(link.provider)
        ? ({
            type: VIDEO_NODE,
            raw: line[0],
            provider: link.provider,
            link: link.src,
          } as MarkdownToken)
        : undefined;
    },
  };
}

/**
 * The video Block (ADR-0071): an Atom `div[data-block="video"]` with a service, a link to the video,
 * and an ordinary link inside. The node has no player: the node view (`VideoView`) renders it, and in
 * the View, the island does. The `providers` Option decides which services are enabled: a link to a
 * disabled service does not become a Block, and a Block from `value` unwraps into its link.
 */
export const RichVideo = Node.create<VideoOptions>({
  name: VIDEO_NODE,
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addOptions: () => ({
    providers: [],
    autoload: { youtube: VIDEO_DEFAULTS.autoload, twitch: VIDEO_DEFAULTS.autoload },
  }),

  addAttributes() {
    // Own names, not `src`: the `iframe` the Block is parsed from has a `src`, and Tiptap
    // would substitute it for the computed link.
    return {
      provider: { default: null, rendered: false, parseHTML: () => null },
      link: { default: null, rendered: false, parseHTML: () => null },
    };
  },

  parseHTML() {
    const { providers } = this.options;
    return [
      {
        tag: `div[data-block="${VIDEO_BLOCK}"]`,
        getAttrs: (element) => {
          // The Block's service, the address on its host, and the enabled service: all checked together.
          const link = videoLinkOf(
            element.getAttribute("data-provider"),
            element.getAttribute("data-src") ?? ""
          );
          return link && providers.includes(link.provider)
            ? { provider: link.provider, link: link.src }
            : false;
        },
      },
      // The HTML of the Tiptap extensions and a lone player `iframe` become a link to the video.
      {
        tag: "div[data-youtube-video]",
        getAttrs: (element) => attrsFromPlayer(element, providers, "youtube"),
      },
      {
        tag: "div[data-twitch-video]",
        getAttrs: (element) => attrsFromPlayer(element, providers, "twitch"),
      },
      { tag: "iframe[src]", getAttrs: (element) => attrsFromPlayer(element, providers) },
    ];
  },

  renderHTML({ node }) {
    const { provider, link } = node.attrs as { provider: string | null; link: string | null };
    // Unknown values (from a raw `ref.editor`) never come out as a Block.
    if (!isVideoProvider(provider) || !link || !isVideoSrc(provider, link)) return ["div", {}];
    return [
      "div",
      { "data-block": VIDEO_BLOCK, "data-provider": provider, "data-src": link },
      ["a", { href: link, rel: "noopener noreferrer" }, link],
    ];
  },

  // The text of the Atom (ADR-0058, item 4): the link, for the counter, copying, and search.
  renderText: ({ node }) => String(node.attrs.link ?? ""),

  addNodeView() {
    return ReactNodeViewRenderer(VideoView);
  },

  addCommands() {
    return {
      insertVideo:
        (link) =>
        ({ editor, tr, dispatch }) => {
          const node = videoNode(editor, link.src);
          if (!node) return false;
          const { $from } = tr.selection;
          const empty = $from.parent.type.name === "paragraph" && $from.parent.content.size === 0;
          return dispatch ? placeVideo(tr, node, empty) : true;
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      // A bare video link and `Enter` make a Block: that is how it is typed, without opening a menu.
      Enter: ({ editor }) => {
        if (!editor.isEditable) return false;
        const node = bareLinkNode(editor);
        if (!node) return false;
        const { tr } = editor.state;
        if (!placeVideo(tr, node, true)) return false;
        editor.view.dispatch(tr.scrollIntoView());
        return true;
      },
    };
  },

  addProseMirrorPlugins() {
    const { editor } = this;
    return [
      new Plugin({
        key: new PluginKey("videoPaste"),
        props: {
          // A bare video link pasted into an empty paragraph becomes a Block. A link pasted into
          // text, or into a non-empty paragraph, stays an ordinary pasted link.
          handlePaste: (view, event) => {
            const { selection } = view.state;
            const { $from } = selection;
            if (
              !editor.isEditable ||
              !selection.empty ||
              $from.parent.type.name !== "paragraph" ||
              $from.parent.content.size !== 0
            ) {
              return false;
            }
            const text = (event.clipboardData?.getData("text/plain") ?? "").trim();
            const node = text.includes("\n") ? null : videoNode(editor, text);
            if (!node) return false;
            const tr = view.state.tr;
            if (!placeVideo(tr, node, true)) return false;
            view.dispatch(tr.setMeta("paste", true).setMeta("uiEvent", "paste").scrollIntoView());
            return true;
          },
        },
      }),
    ];
  },

  markdownTokenizer: markdownTokenizer([]),

  parseMarkdown(token, helpers) {
    return helpers.createNode(VIDEO_NODE, { provider: token.provider, link: token.link });
  },

  renderMarkdown(node: JSONContent) {
    return String(node.attrs?.link ?? "");
  },
});

/**
 * The video Block node for a set of services and their Options. The Markdown tokenizer depends on
 * the enabled services, and `Node.create` takes it only once, so the node is built for the set: a
 * configured `extend` with the tokenizer of this set.
 */
export function createVideoNode(providers: readonly VideoProvider[], autoload: VideoAutoload) {
  return RichVideo.extend({ markdownTokenizer: markdownTokenizer(providers) }).configure({
    providers,
    autoload,
  });
}
