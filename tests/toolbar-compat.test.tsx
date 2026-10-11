// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { Button } from "../src/components/actions/Button.js";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "../src/components/overlays/ContextMenu.js";
import { Menu, MenuButton, MenuItem, MenuTrigger } from "../src/components/overlays/Menu.js";
import { Popover, PopoverContent, PopoverTrigger } from "../src/components/overlays/Popover.js";
import { SplitButton } from "../src/components/actions/SplitButton.js";
import { Toggle } from "../src/components/actions/Toggle.js";
import { ToggleGroup } from "../src/components/actions/ToggleGroup.js";
import { Toolbar } from "../src/components/actions/Toolbar.js";

/*
  ПЕРВЫЙ ТЕСТ ЗАДАЧИ OLDSUI-26: совместимость стрелок `Toolbar` react-aria с
  тем, что кит и Radix кладут внутрь. Стрелки там — не роуминг табиндекса, а
  перехват клавиш на погружении (`useToolbar`): всё, что фокусируемо в DOM
  панели, попадает в обход, а то, что вынесено порталом, — нет.
*/
if (typeof globalThis.CSS === "undefined")
  (globalThis as unknown as { CSS: { escape: (v: string) => string } }).CSS = {
    escape: (value: string) => String(value).replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`),
  };

afterEach(cleanup);

const focusedName = () => {
  const el = document.activeElement as HTMLElement;
  return el.getAttribute("aria-label") ?? el.textContent ?? "";
};

function Everything({ onSplit = () => {} }: { onSplit?: () => void }) {
  return (
    <>
      <button>before</button>
      <Toolbar aria-label="Tools">
        <Button>One</Button>
        <Toggle label="Two" checked={false} onCheckedChange={() => {}} />
        <ToggleGroup
          aria-label="Three"
          value={[]}
          onChange={() => {}}
          options={[
            { id: "a", label: "A" },
            { id: "b", label: "B" },
          ]}
        />
        <MenuTrigger>
          <MenuButton>Menu</MenuButton>
          <Menu>
            <MenuItem>Item</MenuItem>
          </Menu>
        </MenuTrigger>
        <SplitButton label="Split" onClick={onSplit}>
          <MenuItem>Other</MenuItem>
        </SplitButton>
        <Popover>
          <PopoverTrigger asChild>
            <Button>Pop</Button>
          </PopoverTrigger>
          <PopoverContent>
            <button>Inside popover</button>
          </PopoverContent>
        </Popover>
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <Button>Ctx</Button>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem>Do</ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      </Toolbar>
      <button>after</button>
    </>
  );
}

test("arrows walk through every kit control, including both SplitButton halves", async () => {
  const user = userEvent.setup();
  render(<Everything />);
  await user.tab();
  await user.tab();
  const walked = [focusedName()];
  for (let i = 0; i < 8; i++) {
    await user.keyboard("{ArrowRight}");
    walked.push(focusedName());
  }
  expect(walked).toEqual([
    "One",
    "Two",
    "A",
    "B",
    "Menu",
    "Split",
    "More actions: Split",
    "Pop",
    "Ctx",
  ]);
});

test("Tab enters the toolbar once and leaves it once", async () => {
  const user = userEvent.setup();
  render(<Everything />);
  await user.tab();
  expect(focusedName()).toBe("before");
  await user.tab();
  expect(focusedName()).toBe("One");
  await user.keyboard("{ArrowRight}");
  expect(focusedName()).toBe("Two");
  await user.tab();
  expect(focusedName()).toBe("after");
  await user.tab({ shift: true });
  // Возврат встаёт на то, с чего ушли, а не на край панели.
  expect(focusedName()).toBe("Two");
});

test("a RAC Menu inside opens by Enter, closes by Escape and gives focus back", async () => {
  const user = userEvent.setup();
  render(<Everything />);
  await user.tab();
  await user.tab();
  await user.keyboard("{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}");
  expect(focusedName()).toBe("Menu");
  await user.keyboard("{Enter}");
  expect(await screen.findByRole("menu")).toBeTruthy();
  // Стрелки внутри меню принадлежат меню: портал не входит в DOM панели.
  await user.keyboard("{ArrowRight}");
  expect(screen.getByRole("menu")).toBeTruthy();
  await user.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  // Фокус возвращается на триггер уже после закрытия, не вместе с ним.
  await waitFor(() => expect(focusedName()).toBe("Menu"));
  await user.keyboard("{ArrowRight}");
  expect(focusedName()).toBe("Split");
});

test("SplitButton inside: the action fires and the opener's menu opens", async () => {
  const user = userEvent.setup();
  const onSplit = vi.fn();
  render(<Everything onSplit={onSplit} />);
  await user.click(screen.getByRole("button", { name: "Split" }));
  expect(onSplit).toHaveBeenCalledTimes(1);
  await user.keyboard("{ArrowRight}");
  expect(focusedName()).toBe("More actions: Split");
  await user.keyboard("{Enter}");
  expect(await screen.findByRole("menu")).toBeTruthy();
  expect(screen.getByRole("menuitem", { name: "Other" })).toBeTruthy();
});

test("a Radix Popover trigger opens by Enter and its content keeps its own keys", async () => {
  const user = userEvent.setup();
  render(<Everything />);
  await user.tab();
  await user.tab();
  for (let i = 0; i < 7; i++) await user.keyboard("{ArrowRight}");
  expect(focusedName()).toBe("Pop");
  await user.keyboard("{Enter}");
  const inner = await screen.findByRole("button", { name: "Inside popover" });
  await waitFor(() => expect(document.activeElement).toBe(inner));
  await user.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("button", { name: "Inside popover" })).toBeNull());
  await waitFor(() => expect(focusedName()).toBe("Pop"));
  await user.keyboard("{ArrowRight}");
  expect(focusedName()).toBe("Ctx");
});

test("a Radix ContextMenu trigger inside opens on contextmenu and closes back onto it", async () => {
  const user = userEvent.setup();
  render(<Everything />);
  await user.tab();
  await user.tab();
  for (let i = 0; i < 8; i++) await user.keyboard("{ArrowRight}");
  expect(focusedName()).toBe("Ctx");
  fireEvent.contextMenu(document.activeElement as HTMLElement);
  const menu = await screen.findByRole("menu");
  expect(within(menu).getByRole("menuitem", { name: "Do" })).toBeTruthy();
  await user.keyboard("{ArrowDown}");
  await user.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  await waitFor(() => expect(focusedName()).toBe("Ctx"));
  await user.keyboard("{ArrowLeft}");
  expect(focusedName()).toBe("Pop");
});

test("a ContextMenu trigger without asChild is not a stop of the walk", async () => {
  const user = userEvent.setup();
  render(
    <Toolbar aria-label="Tools">
      <Button>One</Button>
      <ContextMenu>
        <ContextMenuTrigger>
          <span>Area</span>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem>Do</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      <Button>Three</Button>
    </Toolbar>
  );
  await user.tab();
  await user.keyboard("{ArrowRight}");
  // Клавиатурного пути к такому меню из панели нет — это записано на странице
  // справочника, и тест держит запись честной.
  expect(focusedName()).toBe("Three");
});
