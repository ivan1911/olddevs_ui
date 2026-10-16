// @vitest-environment jsdom
import createDOMPurify from "dompurify";
import { describe, expect, test } from "vitest";
import {
  richTextSanitizeConfig,
  RICH_TEXT_SCHEMA,
  sanitizeRichText,
  type RichTextPurifier,
} from "../src/editor/schema-entry.js";

/*
  Очистка блока видео (ADR-0071): `iframe` срезается всегда, и с Инструментами
  `youtube` и `twitch` тоже; новые правила — обычные: `data-block="video"`,
  `data-provider` из списка, `data-src` — `https`-адрес хоста сервиса. Настоящий
  DOMPurify на jsdom, как у сервера потребителя.
*/

const purify: RichTextPurifier = createDOMPurify(window);
const TOOLS = ["youtube", "twitch"] as const;

const LINK = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
const attribute = (value: string) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
const block = (provider: string, src: string, inner = `<a href="${attribute(src)}">link</a>`) =>
  `<div data-block="video" data-provider="${provider}" data-src="${attribute(src)}">${inner}</div>`;
const clean = (html: string) => sanitizeRichText(html, purify, [...TOOLS]);

describe("a video block of the editor", () => {
  test("passes the sanitizer unchanged", () => {
    const youtube = block("youtube", LINK).replace("<a ", '<a rel="noopener noreferrer" ');
    const twitch = block("twitch", "https://www.twitch.tv/videos/1234567890").replace(
      "<a ",
      '<a rel="noopener noreferrer" '
    );
    expect(clean(youtube)).toBe(youtube);
    expect(clean(twitch)).toBe(twitch);
    expect(clean(youtube + twitch)).toBe(youtube + twitch);
  });

  test("passes with no tools argument and with the other tools: the kit names do not narrow the schema", () => {
    const html = block("youtube", LINK).replace("<a ", '<a rel="noopener noreferrer" ');
    expect(sanitizeRichText(html, purify)).toBe(html);
    expect(sanitizeRichText(html, purify, ["bold"])).toBe(html);
  });

  test("the schema lists the two attributes on div", () => {
    expect(RICH_TEXT_SCHEMA.attributes.div).toEqual(
      expect.arrayContaining(["data-block", "data-provider", "data-src"])
    );
  });
});

describe("iframe", () => {
  test("is stripped with the video tools in tools, as without them", () => {
    const html =
      '<p>a</p><iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe><p>b</p>';
    expect(clean(html)).toBe("<p>a</p><p>b</p>");
    expect(sanitizeRichText(html, purify)).toBe("<p>a</p><p>b</p>");
  });

  test("is stripped from inside a video block too, the block itself stays", () => {
    const html = block("youtube", LINK, `<iframe src="https://www.youtube.com/embed/x"></iframe>`);
    expect(clean(html)).toBe(block("youtube", LINK, ""));
  });

  test("the Tiptap extension markup loses its player", () => {
    const html =
      '<div data-youtube-video=""><iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe></div>' +
      '<div data-twitch-video=""><iframe src="https://player.twitch.tv/?video=1&parent=example.com"></iframe></div>';
    expect(clean(html)).not.toMatch(/iframe|youtube|twitch|<div/);
  });
});

describe("data-src", () => {
  test.each([
    ["a foreign host", "https://evil.example/watch?v=dQw4w9WgXcQ"],
    ["a look-alike host", "https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ"],
    ["a login in front of the host", "https://youtube.com@evil.example/watch?v=dQw4w9WgXcQ"],
    ["http", "http://www.youtube.com/watch?v=dQw4w9WgXcQ"],
    // Читаемые, но не канонические формы: Редактор пишет только канонический вид.
    ["a short form", "https://youtu.be/dQw4w9WgXcQ"],
    ["a host without www", "https://youtube.com/watch?v=dQw4w9WgXcQ"],
    ["a javascript: address", "javascript:alert(1)"],
    ["a data: address", "data:text/html,<script>alert(1)</script>"],
    ["a player host instead of a site host", "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"],
    ["markup", 'https://youtu.be/dQw4w9WgXcQ"><img src=x onerror=alert(1)>'],
    ["the other service", "https://www.twitch.tv/videos/1234567890"],
  ])("%s drops the block, the link inside stays", (_name, src) => {
    const html = block("youtube", src, '<a href="https://example.com/inside">inside</a>');
    const out = clean(html);
    expect(out).not.toContain("data-src");
    expect(out).not.toContain("data-block");
    expect(out).not.toContain("data-provider");
    expect(out).not.toMatch(/onerror|<img|<script/);
    expect(out).toContain(
      '<a href="https://example.com/inside" rel="noopener noreferrer">inside</a>'
    );
  });

  test("Twitch accepts its own hosts and nothing else", () => {
    for (const src of [
      "https://www.twitch.tv/videos/1234567890",
      "https://www.twitch.tv/some_channel",
      "https://clips.twitch.tv/FunnyClip-AbC123",
    ]) {
      expect(clean(block("twitch", src))).toContain(`data-src="${src}"`);
    }
    expect(clean(block("twitch", "https://player.twitch.tv/?video=1"))).not.toContain("data-src");
    expect(clean(block("twitch", "https://youtu.be/dQw4w9WgXcQ"))).not.toContain("data-src");
  });
});

describe("data-provider and the markup around", () => {
  test("a provider outside the list drops the block", () => {
    const out = clean(block("vimeo", LINK));
    expect(out).not.toMatch(/data-|<div/);
    expect(out).toContain("<a ");
  });

  test("a block without a provider or without an address drops its wrapper", () => {
    expect(
      clean(`<div data-block="video" data-src="${LINK}"><a href="${LINK}">v</a></div>`)
    ).not.toMatch(/data-|<div/);
    expect(
      clean(`<div data-block="video" data-provider="youtube"><a href="${LINK}">v</a></div>`)
    ).not.toMatch(/data-|<div/);
  });

  test("data-provider and data-src mean nothing on other elements", () => {
    const out = clean(
      `<p data-provider="youtube" data-src="${LINK}">text</p><span data-src="${LINK}">s</span>`
    );
    expect(out).toBe("<p>text</p>s");
  });

  test("a video block inside another one loses its wrapper", () => {
    const inner = block("youtube", LINK);
    const out = clean(block("youtube", LINK, inner));
    expect(out.match(/data-block="video"/g)).toHaveLength(1);
  });

  test("the link inside follows the link policy of the kit", () => {
    const out = clean(block("youtube", LINK, '<a href="javascript:alert(1)">play</a>'));
    expect(out).not.toContain("javascript");
    expect(out).toContain("data-src");
    expect(out).toContain("play");
  });
});

test("the bare config (no hooks) leaves data-src out: only the hooks may admit an address", () => {
  const config = richTextSanitizeConfig();
  expect(config.ALLOWED_ATTR).not.toContain("data-src");
  expect(config.ALLOWED_ATTR).not.toContain("src");
});
