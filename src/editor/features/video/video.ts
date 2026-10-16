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
import { parseVideoLink, videoLinkFromPlayer } from "./videoLink.js";
import {
  isVideoProvider,
  isVideoSrc,
  VIDEO_BLOCK,
  type VideoLink,
  type VideoProvider,
} from "./videoSrc.js";

/** Имя узла в Схеме движка. */
export const VIDEO_NODE = VIDEO_BLOCK;

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    video: {
      /** Поставить блок видео на место каретки (`placeVideo`). Ссылка — из `parseVideoLink`. */
      insertVideo: (link: VideoLink) => ReturnType;
    };
  }
}

export interface VideoOptions {
  /** Сервисы, чьи ссылки Редактор принимает: решает набор `tools` (`youtube`, `twitch`). */
  providers: readonly VideoProvider[];
}

/** Сервисы Редактора, в котором живёт движок: их читают поповер и правила вставки. */
export function videoProviders(editor: Editor): readonly VideoProvider[] {
  const extension = editor.extensionManager.extensions.find((item) => item.name === VIDEO_NODE);
  return (extension?.options as VideoOptions | undefined)?.providers ?? [];
}

/**
 * Узел блока видео из ссылки, если сервис включён в этом Редакторе. Ссылка
 * приводится к каноническому виду, её сервис — к `provider`.
 */
function videoNode(editor: Editor, input: string): ProseMirrorNode | null {
  const link = parseVideoLink(input);
  const type = editor.schema.nodes[VIDEO_NODE];
  return link && type && videoProviders(editor).includes(link.provider)
    ? type.create({ provider: link.provider, link: link.src })
    : null;
}

/**
 * Поставить блок видео. Пустой абзац под кареткой (или абзац, в котором набрана
 * голая ссылка — `replaceCurrent`) и есть место блока; иначе блок встаёт за
 * текущим Блоком, на ближайшем уровне, где ему позволено стоять (не внутри
 * цитаты, если там нельзя). За блоком всегда есть абзац с кареткой: видео —
 * Атом, и если оно последнее, дальше писать было бы негде.
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
  // За блоком — абзац: готовый, если он есть, иначе новый пустой.
  if (!tr.doc.resolve(end).nodeAfter?.isTextblock) tr.insert(end, paragraph.create());
  tr.setSelection(TextSelection.create(tr.doc, end + 1));
  return true;
}

/**
 * Голая ссылка на видео под кареткой: единственное содержимое абзаца верхнего
 * для него уровня (текст, ссылка или то и другое), сервис которой включён.
 */
function bareLinkNode(editor: Editor): ProseMirrorNode | null {
  const { selection } = editor.state;
  const { $from } = selection;
  if (!selection.empty || $from.parent.type.name !== "paragraph") return null;
  // Абзац, где кроме текста есть перенос или иной узел, ссылкой-плеером не станет.
  let onlyText = $from.parent.childCount > 0;
  $from.parent.forEach((child) => {
    if (!child.isText) onlyText = false;
  });
  return onlyText ? videoNode(editor, $from.parent.textContent) : null;
}

/**
 * Разбор сопряжённых HTML-расширений Tiptap (`div[data-youtube-video] iframe`,
 * `div[data-twitch-video] iframe`) и одиночного `iframe` плеера: адрес плеера
 * переводится обратно в ссылку на видео. Плеер в Документ не попадает.
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
 * Markdown (ADR-0071, п. 7): видео — ссылка. Блок пишется адресом на своей
 * строке, и такая же строка (голая или в `<…>`) среди абзацев читается обратно
 * блоком, если её сервис включён. Ссылка в тексте абзаца, `[текст](адрес)` и
 * ссылка в списке остаются обычными ссылками: Markdown плеера не знает.
 */
function markdownTokenizer(providers: readonly VideoProvider[]): MarkdownTokenizer {
  return {
    name: VIDEO_NODE,
    level: "block",
    // Абзац строкой-ссылкой не прерывается (как в CommonMark), а без `start` менеджер
    // Markdown подставляет свой, и он ломает разбор строчных токенов у соседних абзацев.
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
 * Блок видео (ADR-0071): Атом `div[data-block="video"]` с сервисом, ссылкой на
 * видео и обычной ссылкой внутри. Плеера в узле нет: его рисует вид узла
 * (`VideoView`) и, в Просмотре, Остров. Какие сервисы включены, решает Опция
 * `providers`: ссылка выключенного сервиса не становится блоком, и блок из
 * `value` разворачивается в свою ссылку.
 */
export const RichVideo = Node.create<VideoOptions>({
  name: VIDEO_NODE,
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addOptions: () => ({ providers: [] }),

  addAttributes() {
    // Свои имена, не `src`: у `iframe`, из которого блок разбирается, есть `src`, и
    // Tiptap подставил бы его вместо рассчитанной ссылки.
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
          const provider = element.getAttribute("data-provider");
          const src = element.getAttribute("data-src") ?? "";
          const link = parseVideoLink(src);
          // Сервис блока, адрес на его хосте и включённый сервис — всё вместе.
          return isVideoProvider(provider) &&
            isVideoSrc(provider, src) &&
            link?.provider === provider &&
            providers.includes(provider)
            ? { provider, link: link.src }
            : false;
        },
      },
      // HTML расширений Tiptap и одиночный `iframe` плеера — ссылкой на видео.
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
    // Чужие значения (сырой `ref.editor`) на выходе блоком не бывают.
    if (!isVideoProvider(provider) || !link || !isVideoSrc(provider, link)) return ["div", {}];
    return [
      "div",
      { "data-block": VIDEO_BLOCK, "data-provider": provider, "data-src": link },
      ["a", { href: link, rel: "noopener noreferrer" }, link],
    ];
  },

  // Текст атома (ADR-0058, п. 4): ссылка — для счётчика, копирования и поиска.
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
      // Голая ссылка на видео и `Enter` — блок: так её набирают, не заходя в меню.
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
          // Голая ссылка на видео, вставленная в пустой абзац, — блок. Ссылка в
          // тексте и в непустом абзаце остаётся вставкой обычной ссылкой.
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
 * Узел блока видео для набора сервисов. Токенизатор Markdown зависит от
 * включённых сервисов, а `Node.create` берёт его один раз, поэтому узел
 * собирается под набор: настроенный `extend` с токенизатором этого набора.
 */
export function createVideoNode(providers: readonly VideoProvider[]) {
  return RichVideo.extend({ markdownTokenizer: markdownTokenizer(providers) }).configure({
    providers,
  });
}
