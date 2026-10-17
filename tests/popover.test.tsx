// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, expect, test } from "vitest";
import { Popover, PopoverContent, PopoverTrigger } from "../src/components/overlays/Popover.js";
import { OVERLAY_LAYER } from "../src/lib/overlay-layer.js";

afterEach(cleanup);

/**
 * Before wave 26, the component had no tests at all.
 */
function Host() {
  return (
    <Popover>
      {/* `asChild`: without it, Radix renders its OWN button on top of ours,
          and the markup ends up with two nested ones. */}
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
 * The layer sits above dialogs, not below them: the popover is opened FROM a dialog,
 * and hiding it under the scrim would make it unusable. The comment in the component
 * states this decision directly.
 */
test("the panel sits on the popover layer", async () => {
  const user = userEvent.setup();
  const { baseElement } = render(<Host />);

  await user.click(screen.getByRole("button", { name: "Open" }));

  const panel = baseElement.querySelector(`.${CSS.escape(OVERLAY_LAYER.popover)}`);
  expect(panel).not.toBeNull();
});
