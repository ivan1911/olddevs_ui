import { describe, expect, test } from "vitest";
import {
  parseVideoLink,
  playerUrl,
  videoLinkFromPlayer,
} from "../src/editor/features/video/videoLink.js";
import { hasVideoBlocks, isVideoSrc } from "../src/editor/features/video/videoSrc.js";

/*
  Recognizing video links (ADR-0071): the rules of the Tiptap Youtube and Twitch
  extensions, rewritten to parse `URL`. The behavior of pure functions; how the Editor,
  the sanitizer and the View read them is in the neighboring files.
*/

const yt = (id: string) => ({ provider: "youtube", src: `https://www.youtube.com/watch?v=${id}` });

describe("YouTube links", () => {
  test.each([
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://youtube.com/watch?v=dQw4w9WgXcQ&feature=share", "dQw4w9WgXcQ"],
    ["http://m.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://music.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://youtu.be/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["youtu.be/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["//www.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/shorts/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/live/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/embed/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["  https://www.youtube.com/watch?v=dQw4w9WgXcQ  ", "dQw4w9WgXcQ"],
  ])("%s is the canonical watch link", (input, id) => {
    expect(parseVideoLink(input)).toEqual(yt(id));
  });

  test("a start time is kept in seconds", () => {
    expect(parseVideoLink("https://youtu.be/dQw4w9WgXcQ?t=90")?.src).toBe(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=90"
    );
    expect(parseVideoLink("https://youtu.be/dQw4w9WgXcQ?t=1m30s")?.src).toBe(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=90"
    );
    expect(parseVideoLink("https://www.youtube.com/watch?v=dQw4w9WgXcQ&start=5")?.src).toBe(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=5"
    );
  });

  test("a playlist link stays a playlist", () => {
    const playlist = {
      provider: "youtube",
      src: "https://www.youtube.com/playlist?list=PL123-abc",
    };
    expect(parseVideoLink("https://www.youtube.com/playlist?list=PL123-abc")).toEqual(playlist);
    expect(parseVideoLink("https://www.youtube.com/embed/videoseries?list=PL123-abc")).toEqual(
      playlist
    );
  });

  test.each([
    "https://www.youtube.com/",
    "https://www.youtube.com/watch",
    "https://www.youtube.com/@channel",
    "https://www.youtube.com/watch?v=a b",
    "https://youtu.be/",
    "https://youtu.be/a/b",
  ])("%s is not a video", (input) => {
    expect(parseVideoLink(input)).toBeNull();
  });
});

describe("Twitch links", () => {
  test.each([
    ["https://www.twitch.tv/videos/1234567890", "https://www.twitch.tv/videos/1234567890"],
    [
      "https://twitch.tv/videos/1234567890?t=1h2m3s",
      "https://www.twitch.tv/videos/1234567890?t=1h2m3s",
    ],
    ["https://clips.twitch.tv/FunnyClip-AbC123", "https://clips.twitch.tv/FunnyClip-AbC123"],
    [
      "https://www.twitch.tv/some_channel/clip/FunnyClip-AbC123",
      "https://clips.twitch.tv/FunnyClip-AbC123",
    ],
    ["https://www.twitch.tv/some_channel", "https://www.twitch.tv/some_channel"],
    ["https://www.twitch.tv/some_channel/", "https://www.twitch.tv/some_channel"],
    ["twitch.tv/some_channel", "https://www.twitch.tv/some_channel"],
  ])("%s", (input, src) => {
    expect(parseVideoLink(input)).toEqual({ provider: "twitch", src });
  });

  test.each([
    "https://www.twitch.tv/",
    "https://www.twitch.tv/directory",
    "https://www.twitch.tv/videos",
    "https://www.twitch.tv/videos/abc",
    "https://www.twitch.tv/a/b/c/d",
    "https://clips.twitch.tv/embed",
  ])("%s is not a video", (input) => {
    expect(parseVideoLink(input)).toBeNull();
  });

  test("a time that is not a Twitch time is dropped", () => {
    expect(parseVideoLink("https://www.twitch.tv/videos/12?t=soon")?.src).toBe(
      "https://www.twitch.tv/videos/12"
    );
  });
});

describe("hostile and foreign links", () => {
  test.each([
    "https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ",
    "https://evil.example/youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtube.com@evil.example/watch?v=dQw4w9WgXcQ",
    "https://user:pass@www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://www.youtube.com:8443/watch?v=dQw4w9WgXcQ",
    "https://notyoutube.com/watch?v=dQw4w9WgXcQ",
    "javascript:alert(1)",
    "ftp://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "data:text/html,youtube.com/watch?v=dQw4w9WgXcQ",
    "https://vimeo.com/12345",
    "not a link",
    "",
  ])("%s gives nothing", (input) => {
    expect(parseVideoLink(input)).toBeNull();
  });
});

describe("a data-src value", () => {
  test("is the canonical https link on a host of its own service", () => {
    for (const src of [
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=90",
      "https://www.youtube.com/playlist?list=PL1-abc",
    ]) {
      expect(isVideoSrc("youtube", src), src).toBe(true);
    }
    for (const src of [
      "https://www.twitch.tv/videos/1234567890",
      "https://www.twitch.tv/videos/1234567890?t=1h2m3s",
      "https://www.twitch.tv/some_channel",
      "https://clips.twitch.tv/FunnyClip-AbC123",
    ]) {
      expect(isVideoSrc("twitch", src), src).toBe(true);
    }
  });

  test("is what the editor writes: every parsed link passes", () => {
    for (const input of [
      "https://youtu.be/dQw4w9WgXcQ?t=1m30s",
      "https://www.youtube.com/shorts/dQw4w9WgXcQ",
      "https://www.youtube.com/embed/videoseries?list=PL1",
      "twitch.tv/videos/12?t=45m",
      "https://www.twitch.tv/some_channel/clip/FunnyClip-AbC123",
    ]) {
      const link = parseVideoLink(input)!;
      expect(isVideoSrc(link.provider, link.src), input).toBe(true);
    }
  });

  test("is not the other service, a player host, http, a short form or markup", () => {
    expect(isVideoSrc("twitch", "https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(false);
    expect(isVideoSrc("youtube", "http://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(false);
    expect(isVideoSrc("youtube", "https://youtu.be/dQw4w9WgXcQ")).toBe(false);
    expect(isVideoSrc("youtube", "https://youtube.com/watch?v=dQw4w9WgXcQ")).toBe(false);
    expect(isVideoSrc("twitch", "https://twitch.tv/videos/1")).toBe(false);
    expect(isVideoSrc("youtube", "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ")).toBe(false);
    expect(isVideoSrc("twitch", "https://player.twitch.tv/?video=123")).toBe(false);
    expect(isVideoSrc("youtube", 'https://www.youtube.com/watch?v=dQw4w9WgXcQ"><script>')).toBe(
      false
    );
    expect(isVideoSrc("youtube", "https://www.youtube.com.evil.example/watch?v=dQw4w9WgXcQ")).toBe(
      false
    );
    expect(isVideoSrc("youtube", "https://www.youtube.com@evil.example/watch?v=dQw4w9WgXcQ")).toBe(
      false
    );
    expect(isVideoSrc("youtube", "https://www.youtube.com/watch?v=dQw4w9WgXcQ\n")).toBe(false);
    expect(isVideoSrc("", "https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(false);
    expect(isVideoSrc("vimeo", "https://vimeo.com/1")).toBe(false);
  });
});

/*
  TWO RULE SETS, ONE MEANING. The sanitizer (`isVideoSrc`) and the link parser
  (`parseVideoLink`) are written differently: the sanitizer needs an expression without
  `URL`, while the parser needs real parsing. They must not diverge on what counts as a video:
  a Block that passes the sanitizer but does not become a player is a dead Block in the Document.
  One table of addresses goes through both.
*/
describe("the sanitizer rule and the parser agree", () => {
  const YT = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
  const TABLE = [
    YT,
    `${YT}&t=90`,
    `${YT}&t=0`,
    `${YT}&t=99999999`,
    "https://www.youtube.com/playlist?list=PL1-abc",
    "https://www.youtube.com/watch?v=",
    "https://www.youtube.com/watch?v=a/b",
    "https://www.twitch.tv/videos/1234567890",
    "https://www.twitch.tv/videos/1234567890?t=1h2m3s",
    "https://www.twitch.tv/videos/1234567890?t=",
    "https://www.twitch.tv/videos/abc",
    "https://www.twitch.tv/videos",
    "https://www.twitch.tv/some_channel",
    "https://www.twitch.tv/Some-Channel2",
    "https://clips.twitch.tv/FunnyClip-AbC123",
    "https://clips.twitch.tv/embed",
    "https://clips.twitch.tv/",
    // Site service sections, and their spelling in another case, are not channels.
    ...[
      "directory",
      "Videos",
      "DIRECTORY",
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
    ].map((name) => `https://www.twitch.tv/${name}`),
  ];

  test.each(TABLE)("%s", (src) => {
    for (const provider of ["youtube", "twitch"]) {
      const parsed = parseVideoLink(src);
      const accepted = isVideoSrc(provider, src);
      // What the sanitizer accepts, the parser must recognize, as the same service.
      if (accepted) expect(parsed?.provider, "sanitizer accepts, parser rejects").toBe(provider);
      // What the parser would write to the Document, the sanitizer must accept.
      if (parsed?.provider === provider) {
        expect(isVideoSrc(provider, parsed.src), "parser writes, sanitizer rejects").toBe(true);
      }
    }
  });

  test("the reserved names give neither a channel nor a block", () => {
    for (const name of ["directory", "videos", "Videos", "settings", "clips"]) {
      const src = `https://www.twitch.tv/${name}`;
      expect(parseVideoLink(src), src).toBeNull();
      expect(isVideoSrc("twitch", src), src).toBe(false);
    }
    expect(isVideoSrc("twitch", "https://clips.twitch.tv/embed")).toBe(false);
  });
});

test("the video block is told from the HTML by a substring", () => {
  expect(hasVideoBlocks('<div data-block="video" data-provider="youtube"></div>')).toBe(true);
  expect(hasVideoBlocks('<div data-block="wrapper"><p>video</p></div>')).toBe(false);
});

describe("a player address from the Tiptap extensions", () => {
  test.each([
    ["https://www.youtube.com/embed/dQw4w9WgXcQ", "https://www.youtube.com/watch?v=dQw4w9WgXcQ"],
    [
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?controls=0&start=30",
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30",
    ],
    [
      "https://www.youtube.com/embed/videoseries?list=PL1",
      "https://www.youtube.com/playlist?list=PL1",
    ],
    [
      "https://player.twitch.tv/?video=1234567890&parent=example.com",
      "https://www.twitch.tv/videos/1234567890",
    ],
    [
      "https://player.twitch.tv/?video=v1234567890&parent=example.com",
      "https://www.twitch.tv/videos/1234567890",
    ],
    [
      "https://player.twitch.tv/?channel=some_channel&parent=example.com",
      "https://www.twitch.tv/some_channel",
    ],
    [
      "https://clips.twitch.tv/embed?clip=FunnyClip&parent=example.com",
      "https://clips.twitch.tv/FunnyClip",
    ],
  ])("%s goes back to its video link", (player, src) => {
    expect(videoLinkFromPlayer(player)?.src).toBe(src);
  });

  test.each([
    "https://evil.example/embed/dQw4w9WgXcQ",
    "https://player.twitch.tv/",
    "https://clips.twitch.tv/embed",
    "https://www.youtube.com/embed/",
    null,
    "",
  ])("%s gives nothing", (player) => {
    expect(videoLinkFromPlayer(player)).toBeNull();
  });
});

describe("the player address built at display time", () => {
  test("YouTube always goes through youtube-nocookie.com", () => {
    expect(playerUrl(yt("dQw4w9WgXcQ") as never, "example.com")).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1"
    );
    expect(
      playerUrl(
        { provider: "youtube", src: "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=90" },
        "example.com"
      )
    ).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&start=90");
    expect(
      playerUrl(
        { provider: "youtube", src: "https://www.youtube.com/playlist?list=PL1" },
        "example.com"
      )
    ).toBe("https://www.youtube-nocookie.com/embed/videoseries?list=PL1&autoplay=1");
  });

  test("Twitch carries the host of the current page as parent", () => {
    const parent = "docs.example.com";
    expect(
      playerUrl({ provider: "twitch", src: "https://www.twitch.tv/videos/12?t=1h2m3s" }, parent)
    ).toBe("https://player.twitch.tv/?video=12&parent=docs.example.com&autoplay=true&time=1h2m3s");
    expect(
      playerUrl({ provider: "twitch", src: "https://www.twitch.tv/some_channel" }, parent)
    ).toBe("https://player.twitch.tv/?channel=some_channel&parent=docs.example.com&autoplay=true");
    expect(
      playerUrl({ provider: "twitch", src: "https://clips.twitch.tv/FunnyClip" }, parent)
    ).toBe("https://clips.twitch.tv/embed?clip=FunnyClip&parent=docs.example.com&autoplay=true");
  });

  test("a player that stands on the page by itself (autoload) does not start playing (OLDSUI-287)", () => {
    expect(playerUrl(yt("dQw4w9WgXcQ") as never, "example.com", false)).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"
    );
    expect(
      playerUrl(
        { provider: "youtube", src: "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=90" },
        "example.com",
        false
      )
    ).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=90");
    expect(
      playerUrl(
        { provider: "youtube", src: "https://www.youtube.com/playlist?list=PL1" },
        "example.com",
        false
      )
    ).toBe("https://www.youtube-nocookie.com/embed/videoseries?list=PL1");
    // Twitch starts on its own unless told otherwise: `autoplay=false` is named explicitly.
    const parent = "docs.example.com";
    expect(
      playerUrl(
        { provider: "twitch", src: "https://www.twitch.tv/videos/12?t=1h2m3s" },
        parent,
        false
      )
    ).toBe("https://player.twitch.tv/?video=12&parent=docs.example.com&autoplay=false&time=1h2m3s");
    expect(
      playerUrl({ provider: "twitch", src: "https://clips.twitch.tv/FunnyClip" }, parent, false)
    ).toBe("https://clips.twitch.tv/embed?clip=FunnyClip&parent=docs.example.com&autoplay=false");
  });

  test("a link of another service than the block says builds nothing", () => {
    expect(
      playerUrl({ provider: "twitch", src: "https://youtu.be/dQw4w9WgXcQ" }, "example.com")
    ).toBe(null);
    expect(playerUrl({ provider: "youtube", src: "https://evil.example/x" }, "example.com")).toBe(
      null
    );
  });
});
