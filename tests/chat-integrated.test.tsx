// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { IntegratedChatDemo } from "../.storybook/recipes/IntegratedChatDemo.js";

afterEach(cleanup);
const click = (name: string) => fireEvent.click(screen.getByRole("button", { name }));
const send = (text = "Plan a visit") => {
  fireEvent.change(screen.getByRole("textbox", { name: "Message" }), { target: { value: text } });
  click("Send");
};

test("one conversation composes Markdown, operation outcomes and sources without replay on retry", () => {
  render(<IntegratedChatDemo />);
  click("Simulation events");
  send();
  click("Append Markdown fragment");
  click("Start operations");
  click("Resolve operations");
  expect(screen.getByRole("button", { name: /Search guidance · Complete/ })).toBeTruthy();
  expect(screen.getByRole("button", { name: /Check availability · Error/ })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Planning guide" })).toBeTruthy();
  expect(screen.getByText("Operation runs: 1")).toBeTruthy();
  click("Fail response");
  click("Retry response");
  expect(screen.getByText("Operation runs: 1")).toBeTruthy();
  expect(screen.getAllByRole("article", { name: "Assistant" })).toHaveLength(2);
  expect(screen.getAllByRole("button", { name: /Search guidance · Complete/ })).toHaveLength(1);
  expect(
    within(screen.getAllByRole("article", { name: "Assistant" })[0]!).getByRole("link")
  ).toBeTruthy();
});

test("incoming speech and typed interruption use the same history while preserving draft and voice", () => {
  render(<IntegratedChatDemo />);
  click("Simulation events");
  click("Start voice");
  click("Connection ready");
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Unsent next draft" } });
  click("Show interim transcript");
  click("Show interim transcript");
  expect(screen.getAllByRole("article")).toHaveLength(1);
  click("Finalize transcript");
  expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("Unsent next draft");
  expect(screen.getAllByRole("article")).toHaveLength(1);
  click("Append Markdown fragment");
  expect(
    within(screen.getAllByRole("article", { name: "Assistant" })[0]!).getByText("Voice input")
  ).toBeTruthy();
  send("Typed interruption");
  expect(screen.getAllByRole("article")).toHaveLength(3);
  expect(screen.getByText("Response interrupted")).toBeTruthy();
  expect(screen.getByText("Connection: Ready")).toBeTruthy();
  click("Append Markdown fragment");
  click("Complete response");
  click("Simulate audio playback");
  expect(screen.getAllByRole("article")).toHaveLength(4);
  click("Mute microphone");
  expect(screen.getByText("Agent: Speaking")).toBeTruthy();
  click("End voice");
  expect(screen.getByText("Connection: Off")).toBeTruthy();
  expect(screen.getAllByRole("article")).toHaveLength(4);
});

test("pending acceptance gates duplicate text even with voice ready, rejects without losing newer edits and resets stale acceptance", async () => {
  render(<IntegratedChatDemo />);
  click("Simulation events");
  click("Start voice");
  click("Connection ready");
  fireEvent.click(screen.getByRole("checkbox", { name: "Hold acceptance" }));
  send("First request");
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "A newer draft" } });
  fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
  expect(screen.queryAllByRole("article")).toHaveLength(0);
  await act(async () => click("Reject send"));
  expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("A newer draft");
  expect(screen.getAllByText("Send failed. Your draft is preserved.").length).toBeGreaterThan(0);
  send("Second request");
  click("Reset chat");
  await act(async () => {});
  expect(screen.queryAllByRole("article")).toHaveLength(0);
  expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("");
  send("Fresh request");
  click("Simulation events");
  click("Complete response");
  expect(screen.getAllByRole("article")).toHaveLength(1);
});

test("an accepted incoming voice final retains voice metadata after delayed acceptance", async () => {
  render(<IntegratedChatDemo />);
  click("Simulation events");
  click("Start voice");
  click("Connection ready");
  fireEvent.click(screen.getByRole("checkbox", { name: "Hold acceptance" }));
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Independent draft" } });
  click("Show interim transcript");
  click("Finalize transcript");
  expect(screen.queryAllByRole("article")).toHaveLength(0);
  await act(async () => click("Accept send"));
  expect(within(screen.getByRole("article")).getByText("Voice input")).toBeTruthy();
  expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("Independent draft");
});

test("empty and whitespace-only stops leave no assistant bubble; source-free answers and lifecycle status stay usable", () => {
  render(<IntegratedChatDemo />);
  click("Simulation events");
  fireEvent.click(screen.getByRole("checkbox", { name: "Include sources" }));
  send();
  click("Stop response");
  expect(screen.queryAllByRole("article", { name: "Assistant" })).toHaveLength(0);
  send("Next request");
  click("Append whitespace");
  click("Stop response");
  expect(screen.queryAllByRole("article", { name: "Assistant" })).toHaveLength(0);
  send("One more request");
  expect(screen.getByText("Assistant response started.")).toBeTruthy();
  click("Append Markdown fragment");
  click("Append Markdown fragment");
  expect(screen.getByText("Assistant response started.")).toBeTruthy();
  click("Start operations");
  click("Resolve operations");
  click("Complete response");
  expect(screen.queryByRole("region", { name: "Sources" })).toBeNull();
  expect(screen.getByText("Assistant response complete.")).toBeTruthy();
});

test("a failed voice connection does not interrupt an independently active text answer", () => {
  render(<IntegratedChatDemo />);
  click("Simulation events");
  send();
  click("Append Markdown fragment");
  click("Start voice");
  click("Connection failed");
  expect(screen.getByText("Connection: Error")).toBeTruthy();
  expect(screen.queryByText("Response interrupted")).toBeNull();
  expect(
    (screen.getByRole("button", { name: "Complete response" }) as HTMLButtonElement).disabled
  ).toBe(false);
  click("Complete response");
  expect(screen.getByText("Assistant response complete.")).toBeTruthy();
});
