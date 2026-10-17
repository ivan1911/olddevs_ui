/**
 * Video by link: the recognition rules and the player address (ADR-0071). These serve the Editor's
 * node, the link field, and the View's island. The light part (the names and the `data-src` check
 * for sanitizing) lives in `videoSrc.ts`, and the start bundle pulls in only that.
 *
 * WHAT LIVES IN THE DOCUMENT. Not the player, but the link: `data-provider` (the service) and
 * `data-src`, a link to the video in canonical form (`parseVideoLink`). The player's address is
 * built at display time (`playerUrl`). For Twitch it contains the page's domain (`parent`), and a
 * Document saved in the admin area would show a broken player on a public site with another
 * domain. YouTube always goes through `youtube-nocookie.com`.
 *
 * MODELLED ON THE TIPTAP YOUTUBE AND TWITCH EXTENSIONS (the owner's decision of 2026-10-16: our
 * own code, the extension packages are not installed). Which links count as video, and how the
 * identifier is taken from them, follows the rules of their `utils`, rewritten for parsing `URL`
 * rather than for a single expression. The host is matched by name, not by substring, so
 * `youtube.com.evil.example` and `youtube.com@evil.example` give no video.
 *
 * The module is safe to run on the server: data and pure functions over strings, with no React
 * and no engine. It needs the global `URL`, which exists in the browser and in Node.
 */

import {
  isTwitchChannel,
  isTwitchClip,
  isVideoProvider,
  isVideoSrc,
  type VideoLink,
  type VideoProvider,
} from "./videoSrc.js";

export type { VideoLink, VideoProvider } from "./videoSrc.js";

/** The service name in words: the placeholder's label and the player's name. These are brand names and are not translated. */
export const VIDEO_PROVIDER_NAME: Readonly<Record<VideoProvider, string>> = {
  youtube: "YouTube",
  twitch: "Twitch",
};

/** Identifier of a video, playlist, or clip: letters, digits, `_` and `-`. */
const ID = /^[\w-]{1,64}$/;
/** Twitch recording number: digits, optionally preceded by `v` (the player itself writes it that way). */
const TWITCH_VIDEO_ID = /^v?(\d{1,20})$/;
/** Twitch time offset: `1h2m3s`, `45m`, `30s`; at least one part. */
const TWITCH_TIME = /^(?=\d)(?:\d+h)?(?:\d+m)?(?:\d+s)?$/;

/**
 * Parse text as an address: `https://…`, `http://…`, `//…`, or without a scheme (`youtu.be/…`).
 * Another scheme, spaces, a login, a password, or a port means it is not a video address.
 */
function toUrl(input: string): URL | null {
  const text = input.trim();
  if (!text || /\s/.test(text) || text.length > 2048) return null;
  let full = text;
  if (/^https?:\/\//i.test(text)) full = text;
  else if (text.startsWith("//")) full = `https:${text}`;
  else if (text.includes("://") || /^[a-z][a-z\d+.-]*:(?!\d)/i.test(text)) return null;
  else full = `https://${text}`;
  try {
    const url = new URL(full);
    return url.username === "" && url.password === "" && url.port === "" ? url : null;
  } catch {
    return null;
  }
}

/** Path segments without the empty ones: `/a//b/` → `["a", "b"]`. */
const segments = (url: URL) => url.pathname.split("/").filter(Boolean);

/** Seconds from a YouTube time offset: `90`, `90s`, `1h2m3s`. `null` means there is no offset, or it is not valid. */
function youtubeStart(value: string | null): number | null {
  if (!value) return null;
  const parts = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/.exec(value);
  if (!parts || !(parts[1] || parts[2] || parts[3])) return null;
  const seconds = Number(parts[1] ?? 0) * 3600 + Number(parts[2] ?? 0) * 60 + Number(parts[3] ?? 0);
  return seconds > 0 && seconds < 1e7 ? seconds : null;
}

function youtubeLink(id: string, start: number | null): VideoLink | null {
  return ID.test(id)
    ? {
        provider: "youtube",
        src: `https://www.youtube.com/watch?v=${id}${start ? `&t=${start}` : ""}`,
      }
    : null;
}

function youtubePlaylist(list: string | null): VideoLink | null {
  return list && ID.test(list)
    ? { provider: "youtube", src: `https://www.youtube.com/playlist?list=${list}` }
    : null;
}

/** Host name without `www.` and mobile subdomains. */
function bareHost(url: URL, ...prefixes: string[]): string {
  const host = url.hostname.toLowerCase();
  for (const prefix of prefixes) if (host.startsWith(prefix)) return host.slice(prefix.length);
  return host;
}

/**
 * A YouTube link: a video (`watch?v=`, `youtu.be/`, `/shorts/`, `/live/`, `/embed/`, `/v/`) or a
 * playlist (`/playlist?list=`). `embed` is parsed because it is also a link to a video, although
 * the kit does not write it.
 */
function fromYoutube(url: URL, hosts: readonly string[]): VideoLink | null {
  const host = bareHost(url, "www.", "m.", "music.");
  if (!hosts.includes(host)) return null;
  const parts = segments(url);
  const start = youtubeStart(url.searchParams.get("t") ?? url.searchParams.get("start"));
  if (host === "youtu.be") {
    return parts.length === 1 ? youtubeLink(parts[0]!, start) : null;
  }
  const [first, second] = parts;
  if (first === "watch" && parts.length === 1) {
    const id = url.searchParams.get("v");
    return id ? youtubeLink(id, start) : youtubePlaylist(url.searchParams.get("list"));
  }
  if (first === "playlist" && parts.length === 1)
    return youtubePlaylist(url.searchParams.get("list"));
  if (first === "embed" && second === "videoseries" && parts.length === 2) {
    return youtubePlaylist(url.searchParams.get("list"));
  }
  if ((first === "embed" || first === "v" || first === "shorts" || first === "live") && second) {
    return parts.length === 2 ? youtubeLink(second, start) : null;
  }
  return null;
}

function twitchTime(url: URL): string {
  const time = url.searchParams.get("t") ?? url.searchParams.get("time");
  return time && TWITCH_TIME.test(time) ? time : "";
}

/**
 * A Twitch link: a recording (`/videos/<number>`), a clip (`clips.twitch.tv/<name>`,
 * `/<channel>/clip/<name>`), or a channel (`/<channel>`).
 */
function fromTwitch(url: URL): VideoLink | null {
  const host = bareHost(url, "www.", "m.");
  const parts = segments(url);
  if (host === "clips.twitch.tv") {
    return parts.length === 1 && isTwitchClip(parts[0]!) && ID.test(parts[0]!)
      ? { provider: "twitch", src: `https://clips.twitch.tv/${parts[0]}` }
      : null;
  }
  if (host !== "twitch.tv") return null;
  if (parts[0] === "videos" && parts.length === 2) {
    const id = /^\d{1,20}$/.exec(parts[1]!)?.[0];
    const time = twitchTime(url);
    return id
      ? { provider: "twitch", src: `https://www.twitch.tv/videos/${id}${time ? `?t=${time}` : ""}` }
      : null;
  }
  if (parts.length === 3 && parts[1] === "clip" && ID.test(parts[0]!) && ID.test(parts[2]!)) {
    return { provider: "twitch", src: `https://clips.twitch.tv/${parts[2]}` };
  }
  if (parts.length === 1 && ID.test(parts[0]!) && isTwitchChannel(parts[0]!)) {
    return { provider: "twitch", src: `https://www.twitch.tv/${parts[0]}` };
  }
  return null;
}

const YOUTUBE_HOSTS = ["youtube.com", "youtu.be"] as const;

/**
 * The video link in canonical form, or `null` if this is not a video. The hosts come from
 * ADR-0071: YouTube is `youtube.com` and `youtu.be`; Twitch is `twitch.tv` and `clips.twitch.tv`
 * (with `www.`, and for YouTube also `m.` and `music.`). The `http` scheme and a link without a
 * scheme are accepted; the canonical form is always `https`.
 */
export function parseVideoLink(input: string): VideoLink | null {
  const url = toUrl(input);
  return url && (fromYoutube(url, YOUTUBE_HOSTS) ?? fromTwitch(url));
}

/**
 * A video Block from the Document (`data-provider` and `data-src`) as a link, if it is valid: a
 * service of the kit, the canonical address of that service (`isVideoSrc`), and a parse that
 * recognizes it as the same service. One check serves the HTML parsing (`video.ts`), the Skeleton,
 * and the island (`VideoIslandSlots.tsx`). An unknown service, an unknown host, and a value with
 * player markup do not pass. `null` means the Block stays a link.
 */
export function videoLinkOf(provider: string | null, src: string): VideoLink | null {
  if (!isVideoProvider(provider) || !isVideoSrc(provider, src)) return null;
  const link = parseVideoLink(src);
  return link?.provider === provider ? link : null;
}

/**
 * Turns a player address, as the Tiptap extensions write it (`iframe src`), back into a link to the
 * video. The YouTube player (`/embed/<id>`, `/embed/videoseries?list=`, including
 * `youtube-nocookie.com`) and the Twitch players (`player.twitch.tv/?video=` or `?channel=`,
 * `clips.twitch.tv/embed`) are recognized. Player parameters (`autoplay`, `parent`, `origin`, …)
 * are not carried over.
 */
export function videoLinkFromPlayer(input: string | null | undefined): VideoLink | null {
  const url = input ? toUrl(input) : null;
  if (!url) return null;
  const host = bareHost(url, "www.");
  if (host === "youtube-nocookie.com") {
    return fromYoutube(url, ["youtube-nocookie.com"]);
  }
  if (host === "player.twitch.tv") {
    const video = TWITCH_VIDEO_ID.exec(url.searchParams.get("video") ?? "")?.[1];
    const channel = url.searchParams.get("channel");
    const time = twitchTime(url);
    if (video) {
      return {
        provider: "twitch",
        src: `https://www.twitch.tv/videos/${video}${time ? `?t=${time}` : ""}`,
      };
    }
    return channel && ID.test(channel) ? parseVideoLink(`https://www.twitch.tv/${channel}`) : null;
  }
  if (host === "clips.twitch.tv" && url.pathname === "/embed") {
    const clip = url.searchParams.get("clip");
    return clip && ID.test(clip) ? parseVideoLink(`https://clips.twitch.tv/${clip}`) : null;
  }
  // A link to the video itself in `src` (YouTube accepts that too) is an ordinary link.
  return fromYoutube(url, YOUTUBE_HOSTS) ?? fromTwitch(url);
}

/**
 * The player address for display. `parentHost` is the host name of the current page
 * (`location.hostname`): Twitch does not start the player without it. `autoplay` says whether
 * playback starts at once. After a click on Play it does (the reader has just decided to watch).
 * A player that appeared on the page by itself (`autoload`) does not start on its own: it is a
 * video on the page, not an ad.
 */
export function playerUrl(link: VideoLink, parentHost: string, autoplay = true): string | null {
  const url = parseVideoLink(link.src);
  if (!url || url.provider !== link.provider) return null;
  const source = new URL(url.src);
  if (url.provider === "youtube") {
    const list = source.searchParams.get("list");
    // YouTube: `autoplay=1` or nothing. Without the parameter the player waits for a click.
    const play = autoplay ? "autoplay=1" : "";
    if (list) {
      return (
        `https://www.youtube-nocookie.com/embed/videoseries?list=${list}` + (play && `&${play}`)
      );
    }
    const start = source.searchParams.get("t");
    const query = [play, start && `start=${start}`].filter(Boolean).join("&");
    return (
      `https://www.youtube-nocookie.com/embed/${source.searchParams.get("v")}` +
      (query && `?${query}`)
    );
  }
  const parent = encodeURIComponent(parentHost);
  // Twitch starts on its own by default: without an explicit `autoplay=false` the player would start playing.
  const play = `&autoplay=${autoplay}`;
  if (source.hostname === "clips.twitch.tv") {
    return (
      `https://clips.twitch.tv/embed?clip=${source.pathname.slice(1)}` + `&parent=${parent}${play}`
    );
  }
  const parts = segments(source);
  const time = source.searchParams.get("t");
  const target = parts[0] === "videos" ? `video=${parts[1]}` : `channel=${parts[0]}`;
  return (
    `https://player.twitch.tv/?${target}&parent=${parent}${play}` + (time ? `&time=${time}` : "")
  );
}
