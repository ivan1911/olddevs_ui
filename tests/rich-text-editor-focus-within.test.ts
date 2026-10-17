// @vitest-environment jsdom
import { expect, test } from "vitest";
import { focusWithin } from "../src/editor/ui/focusWithin.js";

/*
  The condition for showing the floating toolbars must read the active element from
  the document OF the toolbar itself. The Editor in an `iframe` lives in another document: there
  the global `document.activeElement` is not the toolbar's button, and a toolbar that read it
  would hide itself from its own focused button.
*/
test("a toolbar focused inside another document keeps the floating panel shown", () => {
  const frame = document.createElement("iframe");
  document.body.append(frame);
  const other = frame.contentDocument!;
  const panel = other.createElement("div");
  const button = other.createElement("button");
  panel.append(button);
  other.body.append(panel);
  button.focus();

  expect(other.activeElement).toBe(button);
  expect(panel.contains(document.activeElement)).toBe(false);
  expect(focusWithin({ hasFocus: () => false }, panel)).toBe(true);
  frame.remove();
});

test("the editor's own focus shows the panel even when nothing inside it is focused", () => {
  const panel = document.createElement("div");
  expect(focusWithin({ hasFocus: () => true }, panel)).toBe(true);
  expect(focusWithin({ hasFocus: () => false }, panel)).toBe(false);
});
