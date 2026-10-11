// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, expect, test } from "vitest";
import { Popover, PopoverContent, PopoverTrigger } from "../src/components/overlays/Popover.js";
import { OVERLAY_LAYER } from "../src/lib/overlay-layer.js";

afterEach(cleanup);

/**
 * До волны 26 у компонента не было ни одного теста.
 */
function Host() {
  return (
    <Popover>
      {/* `asChild`: без него Radix рисует СВОЮ кнопку поверх нашей, и в
          разметке оказываются две вложенные. */}
      <PopoverTrigger asChild>
        <button type="button">Open</button>
      </PopoverTrigger>
      <PopoverContent>
        <p>Panel body</p>
        <button type="button">Inside</button>
      </PopoverContent>
    </Popover>
  );
}

test("the panel opens from the trigger and closes on Escape", async () => {
  const user = userEvent.setup();
  render(<Host />);

  await user.click(screen.getByRole("button", { name: "Open" }));
  expect(screen.getByText("Panel body")).toBeTruthy();

  await user.keyboard("{Escape}");
  expect(screen.queryByText("Panel body")).toBeNull();
});

test("closing returns focus to the trigger", async () => {
  const user = userEvent.setup();
  render(<Host />);

  const trigger = screen.getByRole("button", { name: "Open" });
  await user.click(trigger);
  await user.keyboard("{Escape}");

  expect(document.activeElement).toBe(trigger);
});

/**
 * Слой выше окон, а не ниже: поповер открывают ИЗ окна, и спрятать его под
 * затемнением значит сделать неработающим. Комментарий в компоненте называет
 * это решение прямо.
 */
test("the panel sits on the popover layer", async () => {
  const user = userEvent.setup();
  const { baseElement } = render(<Host />);

  await user.click(screen.getByRole("button", { name: "Open" }));

  const panel = baseElement.querySelector(`.${CSS.escape(OVERLAY_LAYER.popover)}`);
  expect(panel).not.toBeNull();
});
