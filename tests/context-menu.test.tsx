// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "../src/components/overlays/ContextMenu.js";
import { MENU_PANEL_CLASS } from "../src/lib/menu.js";
import { OVERLAY_LAYER } from "../src/lib/overlay-layer.js";

afterEach(cleanup);

/**
 * Before wave 26 the component had no tests at all, nor did `Toaster`,
 * `ModalOverlay` or `Popover`. These are exactly the components where a failure
 * is silent: the layer, focus, Escape.
 */
function Menu({ onSelect }: { onSelect?: () => void }) {
  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <div>Right click me</div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuLabel>Actions</ContextMenuLabel>
        <ContextMenuItem onSelect={onSelect}>Rename</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem tone="danger">Delete</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

const open = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.pointer({ keys: "[MouseRight]", target: screen.getByText("Right click me") });
};

test("the panel opens on a right click and is a real menu", async () => {
  const user = userEvent.setup();
  render(<Menu />);

  await open(user);

  expect(screen.getByRole("menu")).toBeTruthy();
  expect(screen.getByRole("menuitem", { name: "Rename" })).toBeTruthy();
});

test("choosing an item reports it and closes the panel", async () => {
  const user = userEvent.setup();
  const onSelect = vi.fn();
  render(<Menu onSelect={onSelect} />);

  await open(user);
  await user.click(screen.getByRole("menuitem", { name: "Rename" }));

  expect(onSelect).toHaveBeenCalled();
  expect(screen.queryByRole("menu")).toBeNull();
});

test("Escape closes the panel", async () => {
  const user = userEvent.setup();
  render(<Menu />);

  await open(user);
  await user.keyboard("{Escape}");

  expect(screen.queryByRole("menu")).toBeNull();
});

/**
 * The panel must sit ON the popover overlay layer.
 *
 * Radix takes the z-index from the content's computed style and got `auto`:
 * a right click inside a `Dialog` or `Drawer` drew the menu UNDER the scrim
 * (`z-90`), blurred and unclickable. See ADR-0041.
 */
test("the panel sits on the popover layer, above the modal scrim", async () => {
  const user = userEvent.setup();
  render(<Menu />);

  await open(user);

  expect(screen.getByRole("menu").className).toContain(OVERLAY_LAYER.popover);
  expect(MENU_PANEL_CLASS).toContain(OVERLAY_LAYER.popover);
});

/*
  A SINGLE CHOICE IS DECLARED BY ITS ROLE, NOT BY THE LOOK OF A CHECKMARK.

  This is why Radix is used here: `menuitemradio` and `aria-checked` on ALL
  items of the group, including the unselected ones. A set of plain items with a
  drawn checkmark looks the same, but to a screen reader it announces a list of
  commands, among which the current one cannot be told apart.
*/
test("a single-choice group announces every item, chosen and not", async () => {
  const user = userEvent.setup();
  render(
    <ContextMenu>
      <ContextMenuTrigger>
        <div>Target</div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuRadioGroup value="b">
          <ContextMenuRadioItem value="a">First</ContextMenuRadioItem>
          <ContextMenuRadioItem value="b">Second</ContextMenuRadioItem>
        </ContextMenuRadioGroup>
      </ContextMenuContent>
    </ContextMenu>
  );

  await user.pointer({ keys: "[MouseRight]", target: screen.getByText("Target") });

  const items = await screen.findAllByRole("menuitemradio");
  expect(items).toHaveLength(2);
  expect(items[0]!.getAttribute("aria-checked")).toBe("false");
  expect(items[1]!.getAttribute("aria-checked")).toBe("true");
});

test("choosing an item reports its value, not a boolean", async () => {
  const user = userEvent.setup();
  const onValueChange = vi.fn();
  render(
    <ContextMenu>
      <ContextMenuTrigger>
        <div>Target</div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuRadioGroup value="a" onValueChange={onValueChange}>
          <ContextMenuRadioItem value="a">First</ContextMenuRadioItem>
          <ContextMenuRadioItem value="b">Second</ContextMenuRadioItem>
        </ContextMenuRadioGroup>
      </ContextMenuContent>
    </ContextMenu>
  );

  await user.pointer({ keys: "[MouseRight]", target: screen.getByText("Target") });
  await user.click(await screen.findByRole("menuitemradio", { name: "Second" }));

  expect(onValueChange).toHaveBeenCalledWith("b");
});
