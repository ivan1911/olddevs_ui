/**
 * Video by link is THE LIGHT PART OF THE DATA (ADR-0071): what the server-side sanitizer
 * (`schema.ts`), `RichTextView`, and the Tool descriptions in the start bundle need: the names,
 * the `data-src` check, and the marker of a video in HTML. Link parsing and the player address
 * live in a separate file (`videoLink.ts`) and do not reach the start bundle: the server schema
 * and a View without video do not pay for them.
 *
 * WHAT LIVES IN THE DOCUMENT. Not the player, but the link: `data-provider` (the service) and
 * `data-src`, an `https` link to the video in the canonical form that the Editor writes
 * (`parseVideoLink`). The `data-src` check is two expressions, one per service, not a parse: the
 * sanitizer accepts nothing except what the kit writes itself, and the hosts are spelled out in
 * full (`www.youtube.com`, `www.twitch.tv`, `clips.twitch.tv`), so `youtube.com.evil.example` and
 * `youtube.com@evil.example` do not pass.
 *
 * The module is safe to run on the server: data and pure functions over strings, with no React
 * and no engine.
 */

/** The `div[data-block]` value of a video Block. */
export const VIDEO_BLOCK = "video";

/** Video services: the `data-provider` values, which are also the Tool names. */
export const VIDEO_PROVIDERS = ["youtube", "twitch"] as const;

export type VideoProvider = (typeof VIDEO_PROVIDERS)[number];

/** A video in canonical form: the service and the link that is stored in the Document. */
export interface VideoLink {
  provider: VideoProvider;
  /** An `https` link to the video on its own service; the same as the `href` inside the Block. */
  src: string;
}

/**
 * Top-level `twitch.tv` names that are not channels: a link to them is not a video. The list
 * holds the site's service sections, not the full dictionary of forbidden names. ONE list serves
 * both sanitizing and link parsing (`videoLink.ts`): otherwise a `twitch.tv/videos` Block would
 * pass sanitizing and stay in the Document with no player that can be built from it.
 */
const TWITCH_RESERVED = new Set([
  "directory",
  "videos",
  "downloads",
  "jobs",
  "p",
  "settings",
  "subscriptions",
  "friends",
  "wallet",
  "turbo",
  "store",
  "prime",
  "search",
  "popout",
  "embed",
  "moderator",
  "broadcast",
  "bits",
  "dashboard",
  "inventory",
  "drops",
  "u",
  "team",
  "clips",
]);

/** Whether a name works as the first path segment of `www.twitch.tv` for a channel: not a service section, in any letter case. */
export const isTwitchChannel = (name: string): boolean => !TWITCH_RESERVED.has(name.toLowerCase());

/** A clip name in `clips.twitch.tv/<name>`: `embed` is the player's address, not a clip. */
export const isTwitchClip = (name: string): boolean => name !== "embed";

/**
 * Canonical link per service. YouTube: a video (`watch?v=`, with a start `&t=` in seconds) or a
 * playlist. Twitch: a recording (`/videos/<number>`, with a start `?t=1h2m3s`), a channel, or a
 * clip (`clips.twitch.tv`). An identifier is letters, digits, `_` and `-`. The Twitch expression
 * captures the channel name (1) and the clip name (2): `isVideoSrc` filters out service names with
 * the same list that link parsing uses.
 */
const SRC: Readonly<Record<VideoProvider, RegExp>> = {
  youtube:
    /^https:\/\/www\.youtube\.com\/(?:watch\?v=[\w-]{1,64}(?:&t=\d{1,7})?|playlist\?list=[\w-]{1,64})$/,
  twitch:
    /^https:\/\/(?:www\.twitch\.tv\/(?:videos\/\d{1,20}(?:\?t=(?=\d)(?:\d+h)?(?:\d+m)?(?:\d+s)?)?|([\w-]{1,64}))|clips\.twitch\.tv\/([\w-]{1,64}))$/,
};

/** The `data-provider` value: a service of the kit. */
export function isVideoProvider(value: unknown): value is VideoProvider {
  return (VIDEO_PROVIDERS as readonly unknown[]).includes(value);
}

/**
 * Whether a `data-src` value is valid for the service `provider`: a canonical `https` link to a
 * video on that service. One rule serves sanitizing on the server, the Editor, and the island.
 * The player's address (`youtube-nocookie.com`, `player.twitch.tv`), `http`, `youtu.be`, and a
 * value with markup do not pass.
 */
export function isVideoSrc(provider: string, value: string): boolean {
  if (!isVideoProvider(provider)) return false;
  const match = SRC[provider].exec(value);
  if (!match) return false;
  // The Twitch channel and clip: the same names that link parsing (`videoLink.ts`) accepts.
  const [, channel, clip] = match;
  return (
    (channel === undefined || isTwitchChannel(channel)) &&
    (clip === undefined || isTwitchClip(clip))
  );
}

/**
 * Does the Document's HTML contain a video Block? A Block in sanitized HTML is always written as
 * `data-block="video"` in double quotes (the DOM serializer writes it that way), so the check is a
 * substring match: `RichTextView` uses it to decide whether the island is needed.
 */
export function hasVideoBlocks(html: string): boolean {
  return html.includes(`data-block="${VIDEO_BLOCK}"`);
}
