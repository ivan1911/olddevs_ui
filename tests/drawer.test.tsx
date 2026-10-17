// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { Drawer } from "../src/components/overlays/Drawer.js";

/**
 * Drawer: the layer layout, on which the scrolling inside it depends.
 *
 * The scroll lock's behaviour is not tested here and cannot be tested:
 * `react-remove-scroll` asks elements for `scrollHeight`, and jsdom always
 * answers zero. A "check" that passes under any layout is worse than having no
 * check. The wheel itself is verified in the browser, on a live drawer.
 *
 * What is guarded here is the cause, not the effect: the Radix lock hangs on the
 * scrim (`shards: [contentRef]` in `DialogOverlayImpl`), and the drawer panel must
 * sit INSIDE it. Had it become a sibling, a popover opened from within the drawer
 * would lose the wheel (OLDSUI-6).
 */

afterEach(cleanup);

test("the panel lives inside the overlay, where the scroll lock is", () => {
  render(
    <Drawer open onClose={vi.fn()} title="Details" closeLabel="Close">
      body
    </Drawer>
  );

  const content = screen.getByRole("dialog");
  /*
    The scrim is identified by its role in the markup, not by its class: it has neither
    an ARIA role nor a label. The only trait that belongs to the contract rather than
    the styling is that it is an ancestor of the panel,
    and not the panel itself.
  */
  const overlay = content.parentElement;

  expect(overlay).not.toBeNull();
  expect(overlay).not.toBe(document.body);
  expect(overlay?.contains(content)).toBe(true);
});

test("the drawer is announced as a dialog and takes its name from the title", () => {
  render(
    <Drawer open onClose={vi.fn()} title="Task details" closeLabel="Close">
      body
    </Drawer>
  );

  // `getByRole` throws when it finds nothing, so the check is the call itself.
  expect(screen.getByRole("dialog", { name: "Task details" })).toBeTruthy();
});
