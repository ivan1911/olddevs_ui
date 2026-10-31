// @vitest-environment jsdom
import { createRef, useState } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { PromptInput, ChatMessage, ChatTranscript, UiProvider } from "../src/index.js";
import { BasicChatDemo } from "../.storybook/recipes/BasicChatDemo.js";

afterEach(cleanup);

test("PromptInput edits a controlled draft and submits its value without clearing it", () => {
  const submitted = vi.fn();
  function Example() {
    const [value, setValue] = useState("");
    return (
      <PromptInput label="Message" value={value} onValueChange={setValue} onSubmit={submitted} />
    );
  }
  render(<Example />);
  const field = screen.getByRole("textbox", { name: "Message" }) as HTMLTextAreaElement;
  fireEvent.change(field, { target: { value: "A question" } });
  fireEvent.keyDown(field, { key: "Enter" });
  expect(submitted).toHaveBeenCalledWith("A question");
  expect(field.value).toBe("A question");
});

test("PromptInput blocks blank or unavailable sending while allowing controlled edits", () => {
  const submitted = vi.fn();
  const changed = vi.fn();
  const { rerender } = render(
    <PromptInput label="Message" value="   " onValueChange={changed} onSubmit={submitted} />
  );
  fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
  expect((screen.getByRole("button", { name: "Send" }) as HTMLButtonElement).disabled).toBe(true);
  rerender(
    <PromptInput
      label="Message"
      value="Next draft"
      canSubmit={false}
      onValueChange={changed}
      onSubmit={submitted}
    />
  );
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Still editing" } });
  fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
  expect(changed).toHaveBeenCalledWith("Still editing");
  expect(submitted).not.toHaveBeenCalled();
  expect((screen.getByRole("textbox") as HTMLTextAreaElement).disabled).toBe(false);
});

test("PromptInput reserves Shift+Enter and composition Enter for the input method", () => {
  const submitted = vi.fn();
  render(
    <PromptInput label="Message" value="An answer" onValueChange={() => {}} onSubmit={submitted} />
  );
  const field = screen.getByRole("textbox");
  fireEvent.keyDown(field, { key: "Enter", shiftKey: true });
  fireEvent.compositionStart(field);
  fireEvent.keyDown(field, { key: "Enter" });
  fireEvent.compositionEnd(field);
  fireEvent.keyDown(field, { key: "Enter", keyCode: 229 });
  expect(submitted).not.toHaveBeenCalled();
  fireEvent.keyDown(field, { key: "Enter" });
  expect(submitted).toHaveBeenCalledOnce();
});

test("PromptInput forwards a real textarea ref, slots and catalog labels", () => {
  const ref = createRef<HTMLTextAreaElement>();
  render(
    <UiProvider messages={{ promptInput: { send: "Send message" } }}>
      <PromptInput
        ref={ref}
        label="Message"
        value="Draft"
        onValueChange={() => {}}
        onSubmit={() => {}}
        actions={<button>Attach context</button>}
      >
        <p>Consumer status</p>
      </PromptInput>
    </UiProvider>
  );
  expect(ref.current?.tagName).toBe("TEXTAREA");
  expect(screen.getByRole("button", { name: "Send message" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Attach context" })).toBeTruthy();
  expect(screen.getByText("Consumer status")).toBeTruthy();
});

test("the basic recipe accepts once, presents the response, and resets the conversation", () => {
  render(<BasicChatDemo />);
  const field = screen.getByRole("textbox", { name: "Message" });
  fireEvent.change(field, { target: { value: "Where should I start?" } });
  fireEvent.keyDown(field, { key: "Enter" });
  fireEvent.keyDown(field, { key: "Enter" });
  expect(screen.getAllByRole("article")).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Complete response" }));
  expect(screen.getAllByRole("article")).toHaveLength(2);
  expect(screen.getByText("16:54")).toBeTruthy();
  expect(screen.getByText("16:50")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Reset chat" }));
  expect(screen.queryAllByRole("article")).toHaveLength(0);
});

test("resetting the recipe rejects a late result from its external request handler", async () => {
  let resolve!: (text: string) => void;
  const request = () =>
    new Promise<string>((done) => {
      resolve = done;
    });
  render(<BasicChatDemo request={request} />);
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "A question" } });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  fireEvent.click(screen.getByRole("button", { name: "Reset chat" }));
  await act(async () => {
    resolve("Late response");
  });
  expect(screen.queryByText("Late response")).toBeNull();
  expect(screen.queryAllByRole("article")).toHaveLength(0);
});

test("ChatMessage exposes the author, supplied time and input method beside its body and actions", () => {
  render(
    <ChatMessage
      author="Assistant"
      speaker="assistant"
      timestamp="16:54"
      dateTime="2026-10-31T16:54:00+03:00"
      inputMethod="voice"
      state="interrupted"
      actions={<button>Copy answer</button>}
    >
      <p>Retained answer</p>
    </ChatMessage>
  );
  expect(screen.getByRole("article", { name: "Assistant" })).toBeTruthy();
  expect(screen.getByText("16:54").getAttribute("datetime")).toBe("2026-10-31T16:54:00+03:00");
  expect(screen.getByText("Voice input")).toBeTruthy();
  expect(screen.getByText("Response interrupted")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Copy answer" })).toBeTruthy();
  expect(screen.getByText("Retained answer")).toBeTruthy();
});

test("ChatTranscript preserves supplied order and is a named region without token announcements", () => {
  render(
    <ChatTranscript label="Conversation">
      <ChatMessage author="First" speaker="user" timestamp="16:54">
        First in sequence
      </ChatMessage>
      <ChatMessage author="Second" speaker="assistant" timestamp="16:50">
        Second in sequence
      </ChatMessage>
    </ChatTranscript>
  );
  const region = screen.getByRole("region", { name: "Conversation" });
  expect(region.getAttribute("aria-live")).toBeNull();
  expect(
    screen.getAllByRole("article").map((node) => node.getAttribute("aria-labelledby"))
  ).toHaveLength(2);
  expect(region.textContent!.indexOf("First in sequence")).toBeLessThan(
    region.textContent!.indexOf("Second in sequence")
  );
  expect(screen.getByText("16:54").tagName).toBe("SPAN");
});
