// @vitest-environment jsdom
import { expect, test } from "vitest";
import { focusWithin } from "../src/editor/ui/focusWithin.js";

/*
  Условие показа плавающих панелей обязано читать активный элемент из
  документа САМОЙ панели. Редактор в `iframe` живёт в чужом документе: там
  глобальный `document.activeElement` — не кнопка панели, и панель, прочитав
  его, пряталась бы от собственной кнопки в фокусе.
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
