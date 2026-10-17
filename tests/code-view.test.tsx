// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { CodeView } from "../src/components/content/CodeView.js";

afterEach(cleanup);

const JSON_BODY = `{
  "id": 4821,
  "status": "assembling"
}`;

test("plain code is rendered as is when no markup is given", () => {
  const { container } = render(<CodeView code={JSON_BODY} />);
  expect(container.querySelector("pre")?.textContent).toBe(JSON_BODY);
});

/*
  Markup is an optional display layer; `code` nonetheless stays the source of truth both
  for numbering and for copying.
*/
test("supplied markup replaces the plain rendering", () => {
  render(
    <CodeView code={JSON_BODY}>
      <span data-testid="highlighted">highlighted</span>
    </CodeView>
  );
  expect(screen.getByTestId("highlighted")).toBeTruthy();
});

/*
  The gutter is counted from `code`, not from the children: a gutter that counts from the
  markup would drift out of sync with the content on the first highlighter that wraps a
  line in two elements.
*/
test("line numbers are counted from code", () => {
  const { container } = render(<CodeView code={JSON_BODY} lineNumbers />);
  expect(container.querySelector("[aria-hidden]")?.textContent).toBe("1234");
});

/*
  One trailing newline is stripped: a file read from disk almost always ends with one,
  and without this the gutter would show an extra number on the empty line at the end.
*/
test("trailing newlines do not add phantom lines", () => {
  const { container, rerender } = render(<CodeView code={"a\nb\n"} lineNumbers />);
  expect(container.querySelector("[aria-hidden]")?.textContent).toBe("12");

  // Two in a row are no rarer than one: a file with an empty line at the end.
  rerender(<CodeView code={"a\nb\n\n"} lineNumbers />);
  expect(container.querySelector("[aria-hidden]")?.textContent).toBe("12");
});

/*
  With markup there is no gutter at all, and that is a deliberate decision. The kit does
  not know where the line boundaries are in foreign markup: a highlighter is free to wrap
  a line in any number of elements, and wrapping adds height that the neighboring column
  of numbers cannot know about. A number opposite someone else's line is worse than no
  number.
*/
test("supplied markup drops the gutter instead of misaligning it", () => {
  const { container } = render(
    <CodeView code={JSON_BODY} lineNumbers>
      <span>one single element</span>
    </CodeView>
  );
  expect(container.querySelector("[aria-hidden]")).toBeNull();
});

/*
  Numbers are noise for screen readers and junk in the clipboard: copied code with
  numbers does not compile.
*/
test("line numbers are hidden from speech and from selection", () => {
  const { container } = render(<CodeView code={JSON_BODY} lineNumbers />);
  const gutter = container.querySelector("[aria-hidden]") as HTMLElement;

  expect(gutter.getAttribute("aria-hidden")).toBe("true");
  expect(gutter.className).toContain("select-none");
});

test("without line numbers there is no gutter at all", () => {
  const { container } = render(<CodeView code={JSON_BODY} />);
  expect(container.querySelector("[aria-hidden]")).toBeNull();
});

/*
  Without wrapping there is scrolling, not clipping: a clipped line of code silently loses
  what it was opened for.
*/
test("wrapping is an axis, and its absence gives scrolling rather than clipping", () => {
  const { container, rerender } = render(<CodeView code={JSON_BODY} />);
  const scroller = container.querySelector(".overflow-x-auto") as HTMLElement;
  expect(scroller).toBeTruthy();
  expect(container.querySelector("pre")?.className).toContain("whitespace-pre");
  // The keyboard cannot reach content that scrolls only with a pointer: the axe rule
  // `scrollable-region-focusable`.
  expect(scroller.getAttribute("tabindex")).toBe("0");

  rerender(<CodeView code={JSON_BODY} wrap />);
  expect(container.querySelector(".overflow-x-auto")).toBeNull();
  expect(container.querySelector("pre")?.className).toContain("whitespace-pre-wrap");
});

/*
  Copying takes `code`, not the DOM: otherwise the line numbers and the boundaries of the
  highlight tokens would end up in the clipboard.
*/
test("copying takes the plain code even when markup is shown", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  // The stub goes in AFTER `userEvent.setup()`: it replaces `navigator.clipboard` itself,
  // and a stub set earlier is silently overwritten. Same order as in
  // `tests/copy-button.test.tsx`.
  const user = userEvent.setup();
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });

  render(
    <CodeView code={JSON_BODY} copyable title="response.json">
      <span>coloured markup</span>
    </CodeView>
  );
  await user.click(screen.getByRole("button", { name: /Copy/i }));

  // Only the string goes to the clipboard, not the markup: a copy from the DOM would
  // carry the line numbers and the boundaries of the highlight tokens, text that does
  // not compile.
  expect(writeText).toHaveBeenCalledWith(JSON_BODY);
});

/*
  Counting `div`s is pointless: the previous version of this test also passed on a
  component that always renders the header. We guard the specific node.
*/
test("without a title and without copying there is no header", () => {
  const { container, rerender } = render(<CodeView code={JSON_BODY} title="response.json" />);
  expect(container.querySelector(".border-b")).toBeTruthy();

  rerender(<CodeView code={JSON_BODY} />);
  expect(container.querySelector(".border-b")).toBeNull();
  expect(screen.queryByRole("button")).toBeNull();
});

/*
  The component does not highlight anything itself: this is the ADR-0039 boundary, and it
  is worth guarding, since a highlighter added "while at it" would otherwise appear
  unnoticed.
*/
test("the kit adds no syntax markup of its own", () => {
  const { container } = render(<CodeView code={JSON_BODY} />);
  const code = container.querySelector("pre > code") as HTMLElement;
  expect(code.children).toHaveLength(0);
  expect(code.textContent).toBe(JSON_BODY);
});

/*
  The second reason to drop the gutter, named in the prop's doc string alongside the
  first: wrapping adds height to a line that the column of numbers does not know about,
  and the number lands opposite someone else's line. The condition checked only the markup.
*/
test("wrapping drops the gutter for the same reason markup does", () => {
  const { container, rerender } = render(<CodeView code={JSON_BODY} lineNumbers />);
  expect(container.querySelector("[aria-hidden]")).toBeTruthy();

  rerender(<CodeView code={JSON_BODY} lineNumbers wrap />);
  expect(container.querySelector("[aria-hidden]")).toBeNull();
});

/*
  An extra tab stop on a non-scrollable block is the same defect as its absence on a
  scrollable one: a keyboard user stops where there is nothing to do.
*/
test("a wrapped block is not a tab stop, because it does not scroll", () => {
  const { container } = render(<CodeView code={JSON_BODY} wrap />);
  const pre = container.querySelector("pre") as HTMLElement;
  const scroller = pre.parentElement as HTMLElement;
  expect(scroller.hasAttribute("tabindex")).toBe(false);
});
