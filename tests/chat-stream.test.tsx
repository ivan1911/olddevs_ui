// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { BasicChatDemo } from "../.storybook/recipes/BasicChatDemo.js";
import type {
  DemoResponseHandler,
  DemoResponseControls,
} from "../.storybook/recipes/useChatDemo.js";

afterEach(cleanup);

test("a stopped stream keeps received text, marks interruption and unlocks the next draft", () => {
  render(<BasicChatDemo streaming />);
  const field = screen.getByRole("textbox", { name: "Message" }) as HTMLTextAreaElement;
  fireEvent.change(field, { target: { value: "A question" } });
  fireEvent.keyDown(field, { key: "Enter" });
  fireEvent.click(screen.getByRole("button", { name: "Append response chunk" }));
  fireEvent.change(field, { target: { value: "Next question" } });
  fireEvent.keyDown(field, { key: "Enter" });
  expect(screen.getAllByRole("article")).toHaveLength(2);
  fireEvent.click(screen.getByRole("button", { name: "Stop response" }));
  expect(screen.getByText("Response interrupted")).toBeTruthy();
  expect(screen.getByText(/A clear plan begins with one small step/)).toBeTruthy();
  expect(field.value).toBe("Next question");
  expect((screen.getByRole("button", { name: "Send" }) as HTMLButtonElement).disabled).toBe(false);
});

test("accepting a send preserves newer edits and rejects duplicate acceptance", async () => {
  let resolve!: () => void;
  const accept = vi.fn(
    () =>
      new Promise<void>((done) => {
        resolve = done;
      })
  );
  render(<BasicChatDemo streaming accept={accept} />);
  const field = screen.getByRole("textbox") as HTMLTextAreaElement;
  fireEvent.change(field, { target: { value: "Submitted draft" } });
  fireEvent.keyDown(field, { key: "Enter" });
  fireEvent.keyDown(field, { key: "Enter" });
  fireEvent.change(field, { target: { value: "Newer draft" } });
  await act(async () => {
    resolve();
  });
  expect(accept).toHaveBeenCalledOnce();
  expect(field.value).toBe("Newer draft");
  expect(screen.getByRole("article").textContent).toContain("Submitted draft");
});

test.each(["", "   \n"])("Stop removes an empty or whitespace-only answer (%j)", (partial) => {
  const onStart: DemoResponseHandler = (_text, response) => response.append(partial);
  render(<BasicChatDemo streaming onStart={onStart} />);
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Question" } });
  fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
  fireEvent.click(screen.getByRole("button", { name: "Stop response" }));
  expect(screen.getAllByRole("article")).toHaveLength(1);
  expect(screen.queryByText("Response interrupted")).toBeNull();
  expect(screen.getByRole("button", { name: "Retry response" })).toBeTruthy();
});

test("late stream events cannot change a stopped response or a reset conversation", () => {
  let response!: DemoResponseControls;
  render(
    <BasicChatDemo
      streaming
      onStart={(_text, next) => {
        response = next;
      }}
    />
  );
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Question" } });
  fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
  act(() => response.append("Retained answer"));
  fireEvent.click(screen.getByRole("button", { name: "Stop response" }));
  act(() => {
    response.append(" Stale tail");
    response.complete();
  });
  expect(screen.getByText("Retained answer")).toBeTruthy();
  expect(screen.queryByText(/Stale tail/)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Reset chat" }));
  act(() => response.append("Phantom message"));
  expect(screen.queryAllByRole("article")).toHaveLength(0);
});

test("canceling new acceptance leaves a previous completed response unchanged", async () => {
  let resolve!: () => void;
  let sends = 0;
  const accept = () => {
    sends += 1;
    if (sends === 2)
      return new Promise<void>((done) => {
        resolve = done;
      });
  };
  render(<BasicChatDemo streaming accept={accept} />);
  const field = screen.getByRole("textbox");
  fireEvent.change(field, { target: { value: "First question" } });
  fireEvent.keyDown(field, { key: "Enter" });
  fireEvent.click(screen.getByRole("button", { name: "Append response chunk" }));
  fireEvent.click(screen.getByRole("button", { name: "Complete response" }));
  fireEvent.change(field, { target: { value: "Second question" } });
  fireEvent.keyDown(field, { key: "Enter" });
  fireEvent.click(screen.getByRole("button", { name: "Cancel send" }));
  await act(async () => {
    resolve();
  });
  expect(screen.getAllByRole("article")).toHaveLength(2);
  expect(screen.queryByText("Response interrupted")).toBeNull();
  expect(
    screen.getAllByRole("article").some((node) => node.textContent?.includes("Second question"))
  ).toBe(false);
  expect((field as HTMLTextAreaElement).value).toBe("Second question");
});

test.each(["throw", "reject"])(
  "external response handler %s becomes a recoverable response error",
  async (mode) => {
    const onStart: DemoResponseHandler = (_text, response) => {
      response.append("Received before failure");
      if (mode === "throw") throw new Error("Handler failed");
      return Promise.reject(new Error("Handler rejected"));
    };
    render(<BasicChatDemo streaming onStart={onStart} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Question" } });
    await act(async () => {
      fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
    });
    expect(screen.getByText("Received before failure")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry response" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Stop response" })).toBeNull();
  }
);

test("a failed stream retains its partial answer and retry invokes a separate external callback", () => {
  const onStart = vi.fn<DemoResponseHandler>((_text, response) => {
    response.append("Received partial answer");
  });
  const onRetry = vi.fn<DemoResponseHandler>((_text, response) => {
    response.append("Retried answer");
    response.complete();
  });
  render(<BasicChatDemo streaming onStart={onStart} onRetry={onRetry} />);
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Original request" } });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  fireEvent.click(screen.getByRole("button", { name: "Fail response" }));
  expect(screen.getByText("Received partial answer")).toBeTruthy();
  expect(screen.getByText("Response interrupted")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Retry response" }));
  expect(onStart).toHaveBeenCalledOnce();
  expect(onRetry).toHaveBeenCalledOnce();
  expect(onRetry.mock.calls[0]?.[0]).toBe("Original request");
  expect(screen.getByText("Retried answer")).toBeTruthy();
  expect(screen.getAllByRole("article")).toHaveLength(3);
  expect(screen.queryByRole("button", { name: "Retry response" })).toBeNull();
});

test("send acceptance failure preserves the draft without adding a message", async () => {
  const accept = vi.fn().mockRejectedValue(new Error("Offline"));
  render(<BasicChatDemo streaming accept={accept} />);
  const field = screen.getByRole("textbox", { name: "Message" }) as HTMLTextAreaElement;
  fireEvent.change(field, { target: { value: "Keep this draft" } });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
  });
  expect(field.value).toBe("Keep this draft");
  expect(screen.queryAllByRole("article")).toHaveLength(0);
  expect(screen.getByRole("status").textContent).toBe("Send failed. Your draft is preserved.");
});
