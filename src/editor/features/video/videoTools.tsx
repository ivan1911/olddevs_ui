"use client";

import { Node } from "@tiptap/core";
import { VideoIcon } from "../../../icons.js";
import { devError } from "../../../lib/dev-warn.js";
import type { InsertItem } from "../../core/insertItems.js";
import type { ToolDescriptor, ToolEngineContext } from "../../core/toolDescriptor.js";
import { loaded } from "../../core/toolLoader.js";
// Type only: a static import of the module would pull the chunk into the start bundle.
import type * as VideoChunkModule from "./videoChunk.js";
import { videoLinkOf } from "./videoLink.js";
import { VIDEO_CHECKS, VIDEO_DEFAULTS, type VideoAutoload } from "./videoOptions.js";
import { VIDEO_BLOCK, VIDEO_PROVIDERS, type VideoProvider } from "./videoSrc.js";

type VideoChunk = typeof VideoChunkModule;

const loadVideo = () => import("./videoChunk.js");

/**
 * The video chunk, if it is already loaded. The popover of the "Video" Insert item is drawn only
 * while the engine is alive, and an engine with video is created after the loader, so wherever
 * the chunk is needed, it is already there.
 */
const videoChunk = (): VideoChunk | undefined => loaded(loadVideo) as VideoChunk | undefined;

/*
  The shape of the video Block for the Skeleton: the same node with the same parsing of
  `div[data-block]` and the same markup (`div > a`), but without the player view, the paste
  plugins, or Markdown. The Skeleton shows the link, the same as a reader without JS sees.
*/
const VideoShape = Node.create({
  name: VIDEO_BLOCK,
  group: "block",
  atom: true,
  addAttributes: () => ({
    provider: { default: null, rendered: false },
    link: { default: null, rendered: false },
  }),
  parseHTML: () => [
    {
      tag: `div[data-block="${VIDEO_BLOCK}"]`,
      getAttrs: (element) => {
        // The address in the Document is already canonical (`videoLinkOf`), so the Skeleton has no reason to rewrite it.
        const link = videoLinkOf(
          element.getAttribute("data-provider"),
          element.getAttribute("data-src") ?? ""
        );
        return link ? { provider: link.provider, link: link.src } : false;
      },
    },
  ],
  renderHTML: ({ node }) => [
    "div",
    {
      "data-block": VIDEO_BLOCK,
      "data-provider": node.attrs.provider,
      "data-src": node.attrs.link,
    },
    ["a", { href: node.attrs.link, rel: "noopener noreferrer" }, node.attrs.link],
  ],
});

/** The services enabled in the Editor: the `youtube` and `twitch` Tool names in the set. */
const providersOf = (has: ToolEngineContext["has"]): VideoProvider[] =>
  VIDEO_PROVIDERS.filter((provider) => has(provider));

/**
 * Whether the player loads at once, per service in the set: each Tool's `autoload` Option is read
 * from its Options (`optionsOf`), and a service that is not in the set gets the default.
 */
const autoloadOf = (optionsOf: ToolEngineContext["optionsOf"]): VideoAutoload => ({
  youtube: optionsOf("youtube")?.autoload ?? VIDEO_DEFAULTS.autoload,
  twitch: optionsOf("twitch")?.autoload ?? VIDEO_DEFAULTS.autoload,
});

/** Nodes by the set of services and their Options: the same object for both Tools (see `engineOf`). */
const NODES = new Map<string, ReturnType<VideoChunk["createVideoNode"]>>();

/**
 * The `video` node is shared by two Tools, and Extensions with the same name are not registered
 * twice. Both descriptions return the same object: the node takes the set of services from `has`,
 * that is, from what is actually enabled, and the `autoload` Options from the Options of both
 * Tools (`optionsOf`: `engine` gets only its own, but the node is one). The node is remembered by
 * the set and the Options. `createEditorExtensions` removes the duplicate by reference.
 */
const engineOf = ({ has, optionsOf }: ToolEngineContext) => {
  const providers = providersOf(has);
  const autoload = autoloadOf(optionsOf);
  const key = `${providers.join()}:${autoload.youtube}:${autoload.twitch}`;
  let node = NODES.get(key);
  if (!node) {
    // The engine is built after the loader (`load`), so the chunk is there. If not, the Schema
    // stays without the node, and video Blocks are read as links, as they are without the Tool.
    const chunk = videoChunk();
    if (!chunk) {
      devError("RichTextEditor: the video chunk is not loaded when the engine is built");
      return [];
    }
    NODES.set(key, (node = chunk.createVideoNode(providers, autoload)));
  }
  return [node];
};

/**
 * The single "Video" Insert item for both Tools (ADR-0071, item 6). It sits in each description,
 * and `insertItemsFor` merges the entries with one `id` into one item and merges their search
 * words: the word "twitch" finds the item only if Twitch is enabled. The popover is the link
 * field: the service is determined by the address, among the enabled ones.
 */
const videoItem = (alias: VideoProvider): InsertItem => ({
  id: VIDEO_BLOCK,
  section: "insert",
  label: (m) => m.video,
  icon: VideoIcon,
  aliases: [alias, "embed", "player"],
  // An item with a popover does not call `run`: `applyInsertItem` opens the popover.
  run: (chain) => chain,
  popover: ({ editor, close }) => {
    const VideoForm = videoChunk()?.VideoForm;
    return VideoForm && <VideoForm editor={editor} onDone={close} />;
  },
});

/**
 * The Tool description for a service. Both are the same, except for the name and the item's
 * search word: the Block is shared, and the `tools` set decides the service.
 */
const videoTool = (name: VideoProvider): ToolDescriptor => ({
  name,
  defaults: VIDEO_DEFAULTS,
  checks: VIDEO_CHECKS,
  load: loadVideo,
  engine: engineOf,
  skeleton: () => [VideoShape],
  blocks: { [VIDEO_BLOCK]: { plainAtom: true } },
  kitTags: ["div", "a"],
  insertItems: [videoItem(name)],
});

/**
 * Video by link, in the Tool descriptions (ADR-0071; ADR-0048: there was no client for it at
 * release, and the API follows the Youtube and Twitch extensions from Tiptap). The Tiptap
 * extensions are not connected: link recognition and the player address are the kit's own code
 * (`videoLink.ts`). Outside the presets: they are enabled by an explicit entry in `tools`.
 *
 * The Block is shared, `video`; the `tools` set decides which services are allowed. The
 * Extensions are lazy (the `videoChunk.ts` chunk), as the table's and the code Block's are: the
 * Skeleton shows the link while the chunk loads.
 */
export const YOUTUBE_TOOL: ToolDescriptor = videoTool("youtube");

export const TWITCH_TOOL: ToolDescriptor = videoTool("twitch");
