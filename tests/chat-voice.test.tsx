// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { VoicePanelPresentation } from "../.storybook/recipes/VoicePanelPresentation.js";
import { VoiceChatDemo } from "../.storybook/recipes/VoiceChatDemo.js";

afterEach(cleanup);

test("finalizing incoming speech keeps an unsent typed draft", () => {
  render(<VoiceChatDemo initialConnection="ready" />);
  const field = screen.getByRole("textbox", { name: "Message" }) as HTMLTextAreaElement;
  fireEvent.change(field, { target: { value: "An unsent typed draft" } });
  fireEvent.click(screen.getByRole("button", { name: "Show interim transcript" }));
  fireEvent.click(screen.getByRole("button", { name: "Finalize transcript" }));
  expect(field.value).toBe("An unsent typed draft");
});

test("the compact voice panel presents independent states and delegates mute without ending voice", () => {
  const mute = vi.fn();
  const end = vi.fn();
  render(
    <VoicePanelPresentation
      assistantName="Demo assistant"
      connection="ready"
      agent="speaking"
      muted={false}
      expanded={false}
      onExpandedChange={() => {}}
      onMuteToggle={mute}
      onStart={() => {}}
      onEnd={end}
    />
  );
  expect(screen.getByText("Connection: Ready")).toBeTruthy();
  expect(screen.getByText("Agent: Speaking")).toBeTruthy();
  expect(screen.getByText("Microphone: Unmuted")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Mute microphone" }));
  expect(mute).toHaveBeenCalledOnce();
  expect(end).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "End voice" })).toBeTruthy();
});

test("mute keeps the agent and session active; ending voice preserves history and text continuation", () => {
  render(<VoiceChatDemo initialConnection="ready" />);
  fireEvent.click(screen.getByRole("button", { name: "Show interim transcript" }));
  fireEvent.click(screen.getByRole("button", { name: "Finalize transcript" }));
  fireEvent.click(screen.getByRole("button", { name: "Append voice answer" }));
  fireEvent.click(screen.getByRole("button", { name: "Mute microphone" }));
  expect(screen.getByText("Connection: Ready")).toBeTruthy();
  expect(screen.getByText("Agent: Speaking")).toBeTruthy();
  expect(screen.getByText("Microphone: Muted")).toBeTruthy();
  expect(
    (screen.getByRole("button", { name: "Show interim transcript" }) as HTMLButtonElement).disabled
  ).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "End voice" }));
  expect(screen.getByText("Connection: Off")).toBeTruthy();
  expect(screen.getAllByRole("article")).toHaveLength(2);
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Continue by text" } });
  fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
  fireEvent.click(screen.getByRole("button", { name: "Complete text response" }));
  expect(screen.getAllByRole("article")).toHaveLength(4);
  expect(screen.getByText("Text can continue the same conversation.")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Start voice" }));
  fireEvent.click(screen.getByRole("button", { name: "Connection ready" }));
  expect(screen.getAllByRole("article")).toHaveLength(4);
  expect(screen.getByText("Connection: Ready")).toBeTruthy();
});

test("the panel takes its name and visualizer from outside and keeps controls when collapsed", () => {
  render(
    <VoiceChatDemo
      assistantName="Atlas"
      initialConnection="ready"
      visualizer={
        <span role="img" aria-label="Consumer visualizer">
          Static sample
        </span>
      }
    />
  );
  expect(screen.getByText("Atlas", { exact: true })).toBeTruthy();
  expect(screen.queryByRole("img", { name: "Consumer visualizer" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Expand voice panel" }));
  expect(screen.getByRole("img", { name: "Consumer visualizer" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Collapse voice panel" }));
  expect(screen.queryByRole("img", { name: "Consumer visualizer" })).toBeNull();
  expect(screen.getByRole("button", { name: "Mute microphone" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "End voice" })).toBeTruthy();
  expect(screen.getByText("Agent: Listening")).toBeTruthy();
});

test("connection failure is recoverable and does not erase an accepted voice message", () => {
  render(<VoiceChatDemo initialConnection="ready" />);
  fireEvent.click(screen.getByRole("button", { name: "Show interim transcript" }));
  fireEvent.click(screen.getByRole("button", { name: "Finalize transcript" }));
  fireEvent.click(screen.getByRole("button", { name: "Connection failed" }));
  expect(screen.getByText("Connection: Error")).toBeTruthy();
  expect(screen.getAllByRole("article")).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Retry voice connection" }));
  expect(screen.getByText("Connection: Preparing")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Connection ready" }));
  expect(screen.getByText("Connection: Ready")).toBeTruthy();
  expect(screen.getAllByRole("article")).toHaveLength(1);
});

test("farewell text does not end voice and ending voice removes only unfinished speech", () => {
  render(<VoiceChatDemo initialConnection="ready" />);
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Goodbye" } });
  fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
  expect(screen.getByText("Connection: Ready")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Show interim transcript" }));
  expect(screen.getByText("Interim transcript")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "End voice" }));
  expect(screen.queryByText("Interim transcript")).toBeNull();
  expect(screen.getByRole("article").textContent).toContain("Goodbye");
});

test("text interrupts an active voice answer synchronously while keeping voice connected", () => {
  render(<VoiceChatDemo initialConnection="ready" />);
  fireEvent.click(screen.getByRole("button", { name: "Show interim transcript" }));
  fireEvent.click(screen.getByRole("button", { name: "Finalize transcript" }));
  fireEvent.click(screen.getByRole("button", { name: "Append voice answer" }));
  const field = screen.getByRole("textbox", { name: "Message" }) as HTMLTextAreaElement;
  fireEvent.change(field, { target: { value: "Continue with this typed request" } });
  fireEvent.keyDown(field, { key: "Enter" });
  expect(screen.getAllByRole("article")).toHaveLength(3);
  expect(screen.getByText("Continue with this typed request")).toBeTruthy();
  expect(screen.getByText("Response interrupted")).toBeTruthy();
  expect(screen.getByText(/We can continue this conversation/)).toBeTruthy();
  expect(screen.getByText("Connection: Ready")).toBeTruthy();
  expect(screen.getByRole("button", { name: "End voice" })).toBeTruthy();
  expect(screen.getByText("Agent: Processing")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Append voice answer" }));
  expect(screen.getAllByRole("article")).toHaveLength(4);
});

test("interim speech becomes one final message and assistant playback does not duplicate its answer", () => {
  render(<VoiceChatDemo />);
  fireEvent.click(screen.getByRole("button", { name: "Start voice" }));
  fireEvent.click(screen.getByRole("button", { name: "Connection ready" }));
  fireEvent.click(screen.getByRole("button", { name: "Show interim transcript" }));
  fireEvent.click(screen.getByRole("button", { name: "Show interim transcript" }));
  expect(screen.getAllByRole("article")).toHaveLength(1);
  expect(screen.getByText("Interim transcript")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Finalize transcript" }));
  expect(screen.getAllByRole("article")).toHaveLength(1);
  expect(screen.queryByText("Interim transcript")).toBeNull();
  expect(screen.getByText("I would like to plan a visit tomorrow.")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Append voice answer" }));
  fireEvent.click(screen.getByRole("button", { name: "Finish voice answer" }));
  expect(screen.getAllByRole("article")).toHaveLength(2);
  fireEvent.click(screen.getByRole("button", { name: "Simulate audio playback" }));
  expect(screen.getAllByRole("article")).toHaveLength(2);
  expect(screen.getByText("Agent: Speaking")).toBeTruthy();
});
