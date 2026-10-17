// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { I18nProvider } from "react-aria-components";
import { afterEach, expect, test } from "vitest";
import {
  Menu,
  MenuButton,
  MenuItem,
  MenuTrigger,
  SubmenuTrigger,
} from "../src/components/overlays/Menu.js";

/*
  Placement of the `Menu` submenu (OLDSUI-254). jsdom cannot compute the layout,
  but react-aria writes the final placement onto the popover in the
  `data-placement` attribute, and `data-trigger` says whether the popover is the
  root or a submenu. That is enough to see the default the way a consumer sees
  it. The real geometry, including the flip at the edge, is checked in
  `tests-visual/menu-submenu.spec.ts`.
*/

// `CSS.escape` shim: see `tests/menu.test.tsx`.
if (typeof globalThis.CSS === "undefined")
  (globalThis as unknown as { CSS: { escape: (v: string) => string } }).CSS = {
    escape: (value: string) => String(value).replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`),
  };

function mockWidth(narrow: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: (query: string) => ({
      matches: query === "(max-width: 639px)" ? narrow : false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  });
}

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(window, "matchMedia");
});

function Nested({ placement }: { placement?: "bottom end" | "left top" }) {
  return (
    <MenuTrigger>
      <MenuButton>Actions</MenuButton>
      <Menu>
        <SubmenuTrigger>
          <MenuItem>Move to…</MenuItem>
          <Menu placement={placement}>
            <MenuItem>Nature</MenuItem>
          </Menu>
        </SubmenuTrigger>
      </Menu>
    </MenuTrigger>
  );
}

/** Opens the root menu and the submenu from the keyboard; returns both popovers. */
async function openBoth() {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Actions" }));
  await user.keyboard("{ArrowDown}");
  await user.keyboard("{ArrowRight}");
  const root = document.querySelector<HTMLElement>('[data-trigger="MenuTrigger"]');
  const submenu = document.querySelector<HTMLElement>('[data-trigger="SubmenuTrigger"]');
  if (!root || !submenu) throw new Error("the menu and the submenu are expected to be open");
  return { root, submenu };
}

test("a nested menu without placement opens beside its item", async () => {
  mockWidth(false);
  render(<Nested />);
  const { submenu } = await openBoth();
  expect(submenu.getAttribute("data-placement")).toBe("right");
});

test("the root menu keeps opening below its button", async () => {
  mockWidth(false);
  render(<Nested />);
  const { root } = await openBoth();
  expect(root.getAttribute("data-placement")).toBe("bottom");
});

test("an explicit placement wins over the submenu default", async () => {
  mockWidth(false);
  render(<Nested placement="left top" />);
  const { submenu } = await openBoth();
  expect(submenu.getAttribute("data-placement")).toBe("left");
});

test("on a narrow screen a nested menu without placement opens below its item", async () => {
  mockWidth(true);
  render(<Nested />);
  const { submenu } = await openBoth();
  expect(submenu.getAttribute("data-placement")).toBe("bottom");
});

test("on a narrow screen an explicit placement still wins", async () => {
  mockWidth(true);
  render(<Nested placement="left top" />);
  const { submenu } = await openBoth();
  expect(submenu.getAttribute("data-placement")).toBe("left");
});

/*
  Logical sides in an explicit `placement` (OLDSUI-262): the side at the end of
  the line is the same default as the kit's submenu. It can also be set by hand,
  and in a right-to-left script it lands on the left.
*/

function NestedLogical({ placement }: { placement: "end top" | "start top" }) {
  return (
    <MenuTrigger>
      <MenuButton>Actions</MenuButton>
      <Menu>
        <SubmenuTrigger>
          <MenuItem>Move to…</MenuItem>
          <Menu placement={placement}>
            <MenuItem>Nature</MenuItem>
          </Menu>
        </SubmenuTrigger>
      </Menu>
    </MenuTrigger>
  );
}

test("an explicit logical placement is accepted: start top opens on the start side", async () => {
  mockWidth(false);
  render(<NestedLogical placement="start top" />);
  const { submenu } = await openBoth();
  expect(submenu.getAttribute("data-placement")).toBe("left");
});

test("an explicit end top follows the writing direction", async () => {
  mockWidth(false);
  render(
    <I18nProvider locale="he-IL">
      <NestedLogical placement="end top" />
    </I18nProvider>
  );
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Actions" }));
  await user.keyboard("{ArrowDown}");
  await user.keyboard("{ArrowLeft}");
  const submenu = document.querySelector<HTMLElement>('[data-trigger="SubmenuTrigger"]');
  expect(submenu?.getAttribute("data-placement")).toBe("left");
});
