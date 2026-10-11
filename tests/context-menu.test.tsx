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
 * До волны 26 у компонента не было ни одного теста — как и у `Toaster`,
 * `ModalOverlay` и `Popover`. Это ровно те компоненты, где отказ молчит: слой,
 * фокус, Escape.
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
 * Панель обязана лежать НА СЛОЕ поповеров.
 *
 * Radix берёт z-index из вычисленного стиля содержимого и получал `auto`:
 * правый клик внутри `Dialog` или `Drawer` рисовал меню ПОД затемнением
 * (`z-90`) — размытым и некликабельным. Разбор — ADR-0041.
 */
test("the panel sits on the popover layer, above the modal scrim", async () => {
  const user = userEvent.setup();
  render(<Menu />);

  await open(user);

  expect(screen.getByRole("menu").className).toContain(OVERLAY_LAYER.popover);
  expect(MENU_PANEL_CLASS).toContain(OVERLAY_LAYER.popover);
});

/*
  ОДИНОЧНЫЙ ВЫБОР ОБЪЯВЛЯЕТСЯ РОЛЬЮ, А НЕ ВИДОМ ГАЛОЧКИ.

  Ради этого Radix здесь и взят: `menuitemradio` и `aria-checked` у ВСЕХ
  пунктов группы, включая невыбранные. Набор обычных пунктов с нарисованной
  отметкой выглядит так же, а скринридеру сообщает список команд, среди
  которых не видно текущей.
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
