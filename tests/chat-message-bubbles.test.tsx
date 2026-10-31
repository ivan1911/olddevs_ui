// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { ChatMessage } from "../src/index.js";

import { BubbleExample } from "../.storybook/recipes/BubbleExample.js";

afterEach(cleanup);

test("a message defaults to a single bubble and keeps its accessible author/body/actions", () => {
  const { rerender } = render(
    <ChatMessage speaker="user" author="You" actions={<button>Copy answer</button>}>
      Short text
    </ChatMessage>
  );
  expect(screen.getByRole("article", { name: "You" }).getAttribute("data-group-position")).toBe(
    "single"
  );
  expect(screen.getByRole("button", { name: "Copy answer" })).toBeTruthy();
  expect(screen.queryByRole("img")).toBeNull();
  rerender(
    <ChatMessage speaker="assistant" author="Assistant" groupPosition="first">
      Short reply
    </ChatMessage>
  );
  expect(
    screen.getByRole("article", { name: "Assistant" }).getAttribute("data-group-position")
  ).toBe("first");
});

test.each([
  ["equal time", 0, 0, "same", ["first", "last"]],
  ["five minute boundary", 0, 300000, "same", ["first", "last"]],
  ["larger gap", 0, 300001, "same", ["single", "single"]],
  ["backward time", 1000, 999, "same", ["single", "single"]],
  ["unknown time", undefined, 1000, "same", ["single", "single"]],
  ["unknown next time", 0, undefined, "same", ["single", "single"]],
  ["unknown author", 0, 1000, "", ["single", "single"]],
  ["invalid time", NaN, 1000, "same", ["single", "single"]],
  ["infinite time", 0, Infinity, "same", ["single", "single"]],
  ["outside Date range", 0, 8.64e16, "same", ["single", "single"]],
  ["different author", 0, 1000, "other", ["single", "single"]],
] as const)(
  "consumer renders %s without deriving groups from displayed time",
  (_label, first, second, secondAuthor, expected) => {
    render(
      <BubbleExample
        messages={[
          {
            id: "a",
            authorId: "same",
            author: "Assistant",
            speaker: "assistant",
            createdAt: first,
            displayTime: "16:50",
            text: "First",
          },
          {
            id: "b",
            authorId: secondAuthor,
            author: "Assistant",
            speaker: "assistant",
            createdAt: second,
            displayTime: "16:50",
            text: "Second",
          },
        ]}
      />
    );
    expect(
      screen.getAllByRole("article").map((article) => article.getAttribute("data-group-position"))
    ).toEqual(expected);
    expect(screen.getAllByRole("article").map((article) => article.textContent)).toEqual([
      expect.stringContaining("First"),
      expect.stringContaining("Second"),
    ]);
  }
);

test("consumer groups a chain by adjacent gaps and never sorts the history", () => {
  render(
    <BubbleExample
      messages={[
        {
          id: "a",
          authorId: "same",
          author: "Assistant",
          speaker: "assistant",
          createdAt: 0,
          text: "One",
        },
        {
          id: "b",
          authorId: "same",
          author: "Assistant",
          speaker: "assistant",
          createdAt: 300000,
          text: "Two",
        },
        {
          id: "c",
          authorId: "same",
          author: "Assistant",
          speaker: "assistant",
          createdAt: 600000,
          text: "Three",
        },
        {
          id: "d",
          authorId: "same",
          author: "Assistant",
          speaker: "assistant",
          createdAt: 500000,
          text: "Backward",
        },
      ]}
    />
  );
  expect(
    screen.getAllByRole("article").map((article) => article.getAttribute("data-group-position"))
  ).toEqual(["first", "middle", "last", "single"]);
  expect(screen.getAllByRole("article")[3]!.textContent).toContain("Backward");
});
