// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { RichTextView, tool } from "../src/editor/index.js";

afterEach(cleanup);

/**
 * A player whose URL cannot be built (OLDSUI-281, ADR-0071): the Play button does not
 * fail silently, the link to the video stays in its place. The player URL is replaced
 * with "unavailable": a Block that passed the `data-src` check always produces one, so
 * this branch cannot be reached any other way.
 */
vi.mock("../src/editor/features/video/videoLink.js", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  playerUrl: () => null,
}));

const YT = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

const HTML = `<div data-block="video" data-provider="youtube" data-src="${YT}"><a href="${YT}" rel="noopener noreferrer">${YT}</a></div>`;

test("autoload: false, a click that cannot build the player address leaves the link to the video, not nothing", async () => {
  const user = userEvent.setup();
  const { container } = render(
    <RichTextView html={HTML} tools={[tool("youtube", { autoload: false })]} />
  );
  await user.click(await screen.findByRole("button", { name: "Play YouTube video" }));

  expect(container.querySelector("iframe")).toBeNull();
  expect(screen.queryByRole("button")).toBeNull();
  const link = screen.getByRole("link", { name: YT });
  expect(link.getAttribute("href")).toBe(YT);
  expect(link.getAttribute("rel")).toBe("noopener noreferrer");
});

test("by default the player that cannot be built is the link to the video too: no empty frame", async () => {
  const { container } = render(<RichTextView html={HTML} />);
  const link = await screen.findByRole("link", { name: YT });
  expect(link.getAttribute("href")).toBe(YT);
  expect(container.querySelector("iframe")).toBeNull();
  expect(screen.queryByRole("button")).toBeNull();
});
