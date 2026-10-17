// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { PLAYER_FRAME } from "../src/editor/features/video/VideoPlayer.js";
import {
  RichTextEditor,
  type RichTextEditorHandle,
  type RichTextEditorProps,
} from "../src/editor/index.js";

afterEach(cleanup);

/**
 * The video chunk is lazy (OLDSUI-281, ADR-0058, item 11.1): the player, the link field,
 * and the node are loaded by the Loader, and only for an Editor with `youtube` or `twitch`
 * in `tools`. `full` and `basic` do not load it. An Editor with video shows a Skeleton, the
 * block as a link, as a reader without JS sees it, and reaches Readiness after the chunk loads.
 *
 * The chunk module is replaced with a wrapper that only records the import (as in
 * `rich-text-editor-lazy-builtins.test.tsx`); the chunk's contents are the real thing.
 */
const imported = vi.hoisted(() => [] as string[]);

vi.mock("../src/editor/features/video/videoChunk.js", async (original) => {
  imported.push("video");
  return original();
});

const YT = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
const VALUE =
  "<p>Intro</p>" +
  `<div data-block="video" data-provider="youtube" data-src="${YT}"><a href="${YT}" rel="noopener noreferrer">${YT}</a></div>`;

function renderEditor(props: Partial<RichTextEditorProps>) {
  const ref = createRef<RichTextEditorHandle>();
  const onReady = vi.fn();
  const view = render(<RichTextEditor ref={ref} aria-label="Body" onReady={onReady} {...props} />);
  return { ...view, ref, onReady };
}

const settle = () =>
  act(async () => void (await new Promise((resolve) => setTimeout(resolve, 20))));

// Test order matters: the Loader cache lives on the module, and the first Editor with video
// warms it up.

test("basic does not load the video chunk", async () => {
  const { onReady } = renderEditor({ preset: "basic", value: "<p>Comment</p>" });
  expect(onReady).toHaveBeenCalledTimes(1);
  await settle();
  expect(imported).toEqual([]);
});

test("full does not load the video chunk, and a video block in its value is a link", async () => {
  const { ref, onReady } = renderEditor({ value: VALUE });
  expect(await screen.findByRole("textbox", { name: "Body" }, { timeout: 10_000 })).toBeTruthy();
  expect(onReady).toHaveBeenCalledTimes(1);
  await settle();
  expect(imported).toEqual([]);
  expect(ref.current?.getHTML()).toBe(
    `<p>Intro</p><p><a href="${YT}" rel="noopener noreferrer">${YT}</a></p>`
  );
});

test("an editor with the video tools shows the link as a Skeleton, then is ready with the block", async () => {
  const { ref, onReady, container } = renderEditor({
    tools: ["youtube", "twitch", "link"],
    value: VALUE,
  });

  // Skeleton: the block is visible as a block with a link; there is no input field and no
  // Readiness yet.
  expect(container.querySelector("[contenteditable]")).toBeNull();
  expect(ref.current?.editor).toBeNull();
  expect(onReady).not.toHaveBeenCalled();
  expect(container.querySelector(`div[data-block="video"] > a[href="${YT}"]`)).not.toBeNull();
  // Before the click there is no player at all: no `iframe` and no button.
  expect(container.querySelector("iframe")).toBeNull();
  // Height (ADR-0071): the Skeleton block is a 16:9 frame, like the player placeholder,
  // and the chunk does not make it grow.
  // The Skeleton is the block markup (`div > a`), and the frame comes from the Document container
  // rules, the same ones `RichTextView` uses: every player frame class is in them.
  const frame = container.querySelector<HTMLElement>('div[data-block="video"]')!;
  for (const token of PLAYER_FRAME.split(/\s+/)) {
    expect(
      frame.parentElement!.classList.contains(`[&_div[data-block=video]]:${token}`),
      token
    ).toBe(true);
  }
  expect([...frame.children].map((child) => child.localName)).toEqual(["a"]);

  expect(await screen.findByRole("textbox", { name: "Body" }, { timeout: 10_000 })).toBeTruthy();
  // Both Tools share one chunk, which loads once.
  expect(imported).toEqual(["video"]);
  expect(onReady).toHaveBeenCalledTimes(1);
  expect(ref.current?.getHTML()).toBe(VALUE);
  // The chunk has arrived: the player replaces the link (OLDSUI-287); the placeholder with
  // a button appears only with `autoload: false`.
  expect(container.querySelector("iframe")?.getAttribute("title")).toBe("YouTube video");
  expect(screen.queryByRole("button", { name: "Play YouTube video" })).toBeNull();
});

test("a second editor with the video tools finds the chunk loaded and is ready inside render", () => {
  const { ref, onReady } = renderEditor({ tools: ["twitch"], value: "<p>Comment</p>" });
  expect(ref.current?.editor).not.toBeNull();
  expect(onReady).toHaveBeenCalledTimes(1);
  expect(imported).toEqual(["video"]);
});
