// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { RichTextView } from "../src/editor/index.js";

afterEach(cleanup);

/**
 * Плеер, адрес которого собрать нельзя (OLDSUI-281, ADR-0071): кнопка «Воспроизвести» не
 * молчит, на её месте остаётся ссылка на видео. Адрес плеера подменён на «нельзя»: из
 * блока, прошедшего проверку `data-src`, он собирается всегда, так что иначе этой
 * ветки не достичь.
 */
vi.mock("../src/editor/features/video/videoLink.js", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  playerUrl: () => null,
}));

const YT = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

test("a click that cannot build the player address leaves the link to the video, not nothing", async () => {
  const user = userEvent.setup();
  const { container } = render(
    <RichTextView
      html={`<div data-block="video" data-provider="youtube" data-src="${YT}"><a href="${YT}" rel="noopener noreferrer">${YT}</a></div>`}
    />
  );
  await user.click(await screen.findByRole("button", { name: "Play YouTube video" }));

  expect(container.querySelector("iframe")).toBeNull();
  expect(screen.queryByRole("button")).toBeNull();
  const link = screen.getByRole("link", { name: YT });
  expect(link.getAttribute("href")).toBe(YT);
  expect(link.getAttribute("rel")).toBe("noopener noreferrer");
});
