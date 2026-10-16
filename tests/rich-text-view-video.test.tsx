// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { afterEach, expect, test, vi } from "vitest";
import { RichTextView } from "../src/editor/index.js";
import { PLAYER_FRAME } from "../src/editor/features/video/VideoPlayer.js";
import { PROSE_CLASS } from "../src/editor/styles/prose.js";
import { UiProvider } from "../src/i18n/UiProvider.js";
import { messages as ru } from "../src/locales/ru.js";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/**
 * Видео в `RichTextView` (OLDSUI-281, ADR-0071): остров кита, без движка. Блок
 * приходит ссылкой; остров монтируется, только когда он есть в HTML, ставит на его
 * место заглушку и после щелчка — плеер. До щелчка к сервису ни одного запроса.
 */
const YT = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
const TW = "https://www.twitch.tv/videos/1234567890";
const block = (provider: string, src: string) =>
  `<div data-block="video" data-provider="${provider}" data-src="${src}">` +
  `<a href="${src}" rel="noopener noreferrer">${src}</a></div>`;

test("the server markup is the document: the link, no player, no island", () => {
  const html = renderToString(<RichTextView html={`<p>Hi</p>${block("youtube", YT)}`} />);
  expect(html).toContain(`<a href="${YT}"`);
  expect(html).not.toContain("<iframe");
  expect(html).not.toContain("youtube-nocookie");
  expect(html).not.toContain("Play");
});

test("a document with a video gets the placeholder in place of the link, with no iframe", async () => {
  const { container } = render(
    <RichTextView html={`<p>Hi</p>${block("youtube", YT)}${block("twitch", TW)}`} />
  );
  const play = await screen.findByRole("button", { name: "Play YouTube video" });
  expect(play).toBeTruthy();
  expect(screen.getByRole("button", { name: "Play Twitch video" })).toBeTruthy();
  expect(container.querySelector("iframe")).toBeNull();
  // Ссылка уступила место заглушке; текст ссылки остался виден в заглушке.
  expect(container.querySelector('div[data-block="video"] a')).toBeNull();
  expect(container.textContent).toContain(YT);
  expect(container.textContent).toContain("Hi");
});

test("a click builds the player: nocookie YouTube, Twitch with the page host as parent", async () => {
  const user = userEvent.setup();
  const { container } = render(
    <RichTextView html={`${block("youtube", YT)}${block("twitch", TW)}`} />
  );
  await user.click(await screen.findByRole("button", { name: "Play YouTube video" }));
  await user.click(screen.getByRole("button", { name: "Play Twitch video" }));

  const [youtube, twitch] = [...container.querySelectorAll("iframe")];
  expect(youtube!.getAttribute("src")).toBe(
    "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1"
  );
  expect(youtube!.getAttribute("title")).toBe("YouTube video");
  expect(twitch!.getAttribute("src")).toBe(
    `https://player.twitch.tv/?video=1234567890&parent=${window.location.hostname}&autoplay=true`
  );
  expect(twitch!.getAttribute("title")).toBe("Twitch video");
  for (const frame of [youtube!, twitch!]) {
    expect(frame.getAttribute("loading")).toBe("lazy");
    expect(frame.getAttribute("referrerpolicy")).toBe("strict-origin-when-cross-origin");
    expect(frame.getAttribute("allow")).toMatch(/fullscreen/);
  }
});

test("the page host is read at display time, not stored in the document", async () => {
  const user = userEvent.setup();
  const html = block("twitch", TW);
  const { container, unmount } = render(<RichTextView html={html} />);
  await user.click(await screen.findByRole("button", { name: "Play Twitch video" }));
  expect(container.querySelector("iframe")!.getAttribute("src")).toContain("parent=localhost");
  unmount();
  // Тот же HTML на другой странице: другой `parent`, Документ тот же.
  vi.stubGlobal("location", { ...window.location, hostname: "docs.example.com" });
  render(<RichTextView html={html} />);
  await user.click(await screen.findByRole("button", { name: "Play Twitch video" }));
  expect(document.querySelector("iframe")!.getAttribute("src")).toContain(
    "parent=docs.example.com"
  );
  expect(html).not.toContain("parent");
});

test("the catalog language reaches the placeholder and the player title", async () => {
  const user = userEvent.setup();
  render(
    <UiProvider messages={ru} locale="ru">
      <RichTextView html={block("youtube", YT)} />
    </UiProvider>
  );
  await user.click(
    await screen.findByRole("button", { name: ru.editor.videoPlayLabel({ service: "YouTube" }) })
  );
  expect(document.querySelector("iframe")!.getAttribute("title")).toBe(
    ru.editor.videoPlayer({ service: "YouTube" })
  );
});

test("a document without a video mounts no island and loads no player", async () => {
  const { container } = render(<RichTextView html="<p>Only text</p>" />);
  await new Promise((resolve) => setTimeout(resolve, 30));
  expect(container.ownerDocument.querySelector("template[data-video-island]")).toBeNull();
  expect(screen.queryByRole("button")).toBeNull();
});

test("a block that did not pass the address check stays its link: the view builds no player from it", async () => {
  const bad =
    '<div data-block="video" data-provider="youtube" data-src="https://evil.example/x">' +
    '<a href="https://evil.example/x">x</a></div>' +
    '<div data-block="video" data-provider="vimeo" data-src="https://vimeo.com/1"><a href="https://vimeo.com/1">v</a></div>';
  const { container } = render(<RichTextView html={bad} />);
  await waitFor(() =>
    expect(container.ownerDocument.querySelector("template[data-video-island]")).not.toBeNull()
  );
  expect(screen.queryByRole("button")).toBeNull();
  expect(container.querySelectorAll('div[data-block="video"] a')).toHaveLength(2);
  expect(container.querySelector("iframe")).toBeNull();
});

test("a new document with another video replaces the players", async () => {
  const view = render(<RichTextView html={block("youtube", YT)} />);
  await screen.findByRole("button", { name: "Play YouTube video" });
  view.rerender(<RichTextView html={block("twitch", TW)} />);
  await screen.findByRole("button", { name: "Play Twitch video" });
  expect(screen.queryByRole("button", { name: "Play YouTube video" })).toBeNull();
});

// ── Высота: рамка 16:9 с первого кадра ──────────────────────────────────────

const PROSE_TOKENS = new Set(PROSE_CLASS.split(/\s+/).filter(Boolean));

test("the server block is the same 16:9 frame as the player placeholder, so the island changes no height", () => {
  // HTML Документа классов не несёт: рамка блока — правила контейнера Документа
  // по `div[data-block=video]`, и каждый класс рамки плеера в них есть.
  for (const token of PLAYER_FRAME.split(/\s+/)) {
    expect(PROSE_TOKENS.has(`[&_div[data-block=video]]:${token}`), token).toBe(true);
  }
  // Ссылка в рамке остаётся ссылкой: читается и нажимается без JS.
  const html = renderToString(<RichTextView html={block("youtube", YT)} />);
  expect(html).toContain(`<div data-block="video"`);
  expect(html).toContain(`<a href="${YT}"`);
});

test("the placeholder fills the server frame instead of drawing a second one", async () => {
  const { container } = render(<RichTextView html={block("youtube", YT)} />);
  await screen.findByRole("button", { name: "Play YouTube video" });
  const player = container.querySelector<HTMLElement>("[data-video-player]")!;
  expect(player.classList.contains("aspect-video")).toBe(false);
  expect(player.classList.contains("border")).toBe(false);
  expect(player.classList.contains("absolute")).toBe(true);
  expect(player.classList.contains("inset-0")).toBe(true);
});
