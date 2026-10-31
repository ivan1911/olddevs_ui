// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { ToolsSourcesDemo, type ToolsResponse } from "../.storybook/recipes/ToolsSourcesDemo.js";

afterEach(cleanup);
const send = () => {
  fireEvent.change(screen.getByRole("textbox", { name: "Message" }), {
    target: { value: "Find planning guidance" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
};
test("operation outcomes stay local and sources belong to the corresponding reply", () => {
  render(<ToolsSourcesDemo />);
  send();
  expect(screen.getByRole("button", { name: /Search guidance · Waiting/ })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Start operations" }));
  expect(screen.getByRole("button", { name: /Search guidance · Running/ })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Resolve operations" }));
  const answer = screen.getAllByRole("article")[1]!;
  expect(
    within(answer).getByText(/A weekly review can help you choose the next step/)
  ).toBeTruthy();
  expect(within(answer).getByRole("button", { name: /Search guidance · Complete/ })).toBeTruthy();
  expect(within(answer).getByRole("button", { name: /Check availability · Error/ })).toBeTruthy();
  expect(within(answer).getByRole("link", { name: "Planning guide" }).getAttribute("href")).toBe(
    "https://example.com/planning"
  );
  fireEvent.click(within(answer).getByRole("button", { name: "Planning guide excerpt" }));
  expect(
    within(answer).getByText("Review your goals and select one achievable next step.")
  ).toBeTruthy();
  expect(screen.queryByText("Response interrupted")).toBeNull();
});

test("an answer without sources has no empty sources section", () => {
  render(<ToolsSourcesDemo withSources={false} />);
  send();
  fireEvent.click(screen.getByRole("button", { name: "Start operations" }));
  fireEvent.click(screen.getByRole("button", { name: "Resolve operations" }));
  expect(screen.queryByRole("region", { name: "Sources" })).toBeNull();
  expect(screen.queryByText("Sources", { exact: true })).toBeNull();
});

test("answer retry does not replay completed operations or move their sources to another reply", () => {
  render(<ToolsSourcesDemo />);
  send();
  fireEvent.click(screen.getByRole("button", { name: "Start operations" }));
  fireEvent.click(screen.getByRole("button", { name: "Resolve operations" }));
  fireEvent.click(screen.getByRole("button", { name: "Fail response" }));
  fireEvent.click(screen.getByRole("button", { name: "Retry response" }));
  expect(screen.getAllByRole("button", { name: /Search guidance · Complete/ })).toHaveLength(1);
  expect(screen.queryByRole("button", { name: "Start operations" })).toBeNull();
  const replies = screen.getAllByRole("article", { name: "Assistant" });
  expect(replies).toHaveLength(2);
  expect(within(replies[0]!).getByRole("link", { name: "Planning guide" })).toBeTruthy();
  expect(within(replies[1]!).getByRole("link", { name: "Planning guide" })).toBeTruthy();
  expect(within(replies[1]!).queryByRole("button", { name: /Search guidance/ })).toBeNull();
});

test("external operation events retain stable identity and cannot replace completed results", () => {
  let response!: ToolsResponse;
  render(
    <ToolsSourcesDemo
      onStart={(_text, controls) => {
        response = controls;
        controls.append("Received answer");
        controls.operations([
          {
            id: "lookup",
            summary: "Look up guidance",
            state: "running",
            details: "Collecting context",
          },
        ]);
      }}
    />
  );
  send();
  const trigger = screen.getByRole("button", { name: "Look up guidance · Running" });
  fireEvent.click(trigger);
  act(() =>
    response.operations([
      { id: "lookup", summary: "Look up guidance", state: "success", details: "One guide found" },
    ])
  );
  expect(screen.getByRole("button", { name: "Look up guidance · Complete" })).toBe(trigger);
  expect(trigger.getAttribute("aria-expanded")).toBe("true");
  act(() => response.complete());
  act(() =>
    response.operations([
      { id: "lookup", summary: "Late result", state: "error", details: "Stale event" },
    ])
  );
  expect(screen.queryByRole("button", { name: /Late result/ })).toBeNull();
  expect(screen.getByText("One guide found")).toBeTruthy();
});
