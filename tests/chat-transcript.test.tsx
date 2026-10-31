// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { ChatTranscript } from "../src/index.js";

afterEach(cleanup);

const setup = (scrollTop: number) => {
  const onFollowingChange = vi.fn();
  render(
    <ChatTranscript label="Conversation" onFollowingChange={onFollowingChange}>
      <button aria-expanded={false}>Details</button>
      <button aria-expanded={false} aria-haspopup="menu">
        Actions
      </button>
    </ChatTranscript>
  );
  const region = screen.getByRole("region", { name: "Conversation" });
  region.scrollTop = scrollTop;
  return { region, onFollowingChange };
};
const swipe = (region: HTMLElement, from: number, to: number) => {
  fireEvent.touchStart(region, { touches: [{ clientY: from }] });
  fireEvent.touchMove(region, { touches: [{ clientY: to }] });
};

test("upward intent pauses following only when the viewport can move up", () => {
  const atTop = setup(0);
  fireEvent.wheel(atTop.region, { deltaY: -40 });
  fireEvent.keyDown(atTop.region, { key: "PageUp" });
  swipe(atTop.region, 100, 160);
  expect(atTop.onFollowingChange).not.toHaveBeenCalled();
  cleanup();

  const scrolled = setup(200);
  fireEvent.wheel(scrolled.region, { deltaY: -40 });
  expect(scrolled.onFollowingChange).toHaveBeenLastCalledWith(false);
  cleanup();

  const keyboard = setup(200);
  fireEvent.keyDown(keyboard.region, { key: "ArrowUp" });
  expect(keyboard.onFollowingChange).toHaveBeenLastCalledWith(false);
});

test("a touch drag pauses following only when it scrolls toward older content", () => {
  const { region, onFollowingChange } = setup(200);
  swipe(region, 160, 100);
  expect(onFollowingChange).not.toHaveBeenCalled();
  swipe(region, 100, 160);
  expect(onFollowingChange).toHaveBeenLastCalledWith(false);
});

test("a disclosure pauses following, while a popup trigger does not change height", () => {
  const { onFollowingChange } = setup(0);
  fireEvent.click(screen.getByRole("button", { name: "Actions" }));
  fireEvent.keyDown(screen.getByRole("button", { name: "Actions" }), { key: "Enter" });
  expect(onFollowingChange).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Details" }));
  expect(onFollowingChange).toHaveBeenLastCalledWith(false);
});
