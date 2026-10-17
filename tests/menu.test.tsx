// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useState } from "react";
import type { Selection } from "react-aria-components";
import { afterEach, expect, test, vi } from "vitest";
import {
  Menu,
  MenuButton,
  MenuItem,
  MenuSection,
  MenuSeparator,
  MenuTrigger,
} from "../src/components/overlays/Menu.js";

/*
  `CSS.escape` shim.

  jsdom has no `CSS` object at all, but the react-aria popover calls `CSS.escape`
  when it opens. Without the shim, no menu opens in any test, and the failure
  surfaces not at the place being checked but inside the library.

  The shim is admissible precisely because it brings the environment CLOSER to a
  browser, not further away: `CSS.escape` exists everywhere and is a pure string
  function. That is not the same as replacing layout or focus. Such things are
  not replaced in jsdom, and the checks that depend on them live in
  `tests-visual/interactions.spec.ts` (ADR-0012).
*/
if (typeof globalThis.CSS === "undefined")
  (globalThis as unknown as { CSS: { escape: (v: string) => string } }).CSS = {
    escape: (value: string) => String(value).replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`),
  };

afterEach(cleanup);

function Plain({ onAction = () => {} }: { onAction?: () => void }) {
  return (
    <MenuTrigger>
      <MenuButton aria-label="Actions">…</MenuButton>
      <Menu>
        <MenuItem onAction={onAction}>Rename</MenuItem>
        <MenuSeparator />
        <MenuItem tone="danger" disabled>
          Delete
        </MenuItem>
      </Menu>
    </MenuTrigger>
  );
}

function WithToggles() {
  const [keys, setKeys] = useState<Selection>(new Set(["dense"]));
  return (
    <MenuTrigger>
      <MenuButton aria-label="View">…</MenuButton>
      <Menu>
        <MenuSection
          label="Density"
          selectionMode="multiple"
          selectedKeys={keys}
          onSelectionChange={setKeys}
        >
          <MenuItem id="dense">Dense grid</MenuItem>
          <MenuItem id="meta">Show labels</MenuItem>
        </MenuSection>
      </Menu>
    </MenuTrigger>
  );
}

test("the menu opens by button and closes by Escape", async () => {
  const user = userEvent.setup();
  render(<Plain />);

  expect(screen.queryByRole("menu")).toBeNull();
  await user.click(screen.getByRole("button", { name: "Actions" }));
  expect(screen.getByRole("menu")).toBeTruthy();

  await user.keyboard("{Escape}");
  expect(screen.queryByRole("menu")).toBeNull();
});

test("onAction fires once, not twice", async () => {
  const user = userEvent.setup();
  const onAction = vi.fn();
  render(<Plain onAction={onAction} />);

  await user.click(screen.getByRole("button", { name: "Actions" }));
  await user.click(screen.getByRole("menuitem", { name: "Rename" }));

  // A double call is the classic failure of a hand-built menu: the handler is
  // attached both to the item and to the panel's bubbling click.
  expect(onAction).toHaveBeenCalledTimes(1);
});

test("a plain item closes the menu", async () => {
  const user = userEvent.setup();
  render(<Plain />);

  await user.click(screen.getByRole("button", { name: "Actions" }));
  await user.click(screen.getByRole("menuitem", { name: "Rename" }));

  expect(screen.queryByRole("menu")).toBeNull();
});

test("a toggle item does NOT close the menu", async () => {
  const user = userEvent.setup();
  render(<WithToggles />);

  await user.click(screen.getByRole("button", { name: "View" }));
  await user.click(screen.getByRole("menuitemcheckbox", { name: "Show labels" }));

  // Toggles are set in bulk: closing after the first one would force the menu to
  // be reopened for every checkbox.
  expect(screen.getByRole("menu")).toBeTruthy();
});

test("selection on a section yields roles and aria-checked, not just a tick", async () => {
  const user = userEvent.setup();
  render(<WithToggles />);

  await user.click(screen.getByRole("button", { name: "View" }));

  // react-aria sets the role and the state, which is exactly why the toggles are
  // made as a selection on a section rather than with a `checked` prop on the item.
  const dense = screen.getByRole("menuitemcheckbox", { name: "Dense grid" });
  expect(dense.getAttribute("aria-checked")).toBe("true");
  expect(
    screen.getByRole("menuitemcheckbox", { name: "Show labels" }).getAttribute("aria-checked")
  ).toBe("false");
});

test("a disabled item fires no action", async () => {
  const user = userEvent.setup();
  const onAction = vi.fn();
  render(
    <MenuTrigger>
      <MenuButton aria-label="Actions">…</MenuButton>
      <Menu>
        <MenuItem disabled onAction={onAction}>
          Delete
        </MenuItem>
      </Menu>
    </MenuTrigger>
  );

  await user.click(screen.getByRole("button", { name: "Actions" }));
  await user.click(screen.getByRole("menuitem", { name: "Delete" }));
  expect(onAction).not.toHaveBeenCalled();
});

test("arrows walk the items and skip the disabled one", async () => {
  const user = userEvent.setup();
  render(
    <MenuTrigger>
      <MenuButton aria-label="Actions">…</MenuButton>
      <Menu>
        <MenuItem>First</MenuItem>
        <MenuItem disabled>Second</MenuItem>
        <MenuItem>Third</MenuItem>
      </Menu>
    </MenuTrigger>
  );

  await user.click(screen.getByRole("button", { name: "Actions" }));

  // A menu opened with the mouse puts focus on the list itself, not on the first
  // item: the item highlight appears only once the user reaches for the keyboard.
  // That is how react-aria behaves in a real browser (checked in Chromium), and
  // the first arrow press does not go "nowhere": it lands on the first item.
  // Opening from the keyboard highlights the first item at once, but jsdom does
  // not reproduce pressing Enter on the button (ADR-0012).
  expect(document.activeElement).toBe(screen.getByRole("menu"));

  await user.keyboard("{ArrowDown}");
  expect(document.activeElement?.textContent).toBe("First");

  await user.keyboard("{ArrowDown}");
  // "Second" is disabled and skipped: stopping on it would be a dead end. It
  // cannot be selected, and the arrow press has already moved past it.
  expect(document.activeElement?.textContent).toBe("Third");

  await user.keyboard("{ArrowUp}");
  expect(document.activeElement?.textContent).toBe("First");
});
