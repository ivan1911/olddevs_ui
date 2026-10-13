// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useState } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { Dialog } from "../src/components/overlays/Dialog.js";
import {
  MegaMenu,
  MegaMenuButton,
  MegaMenuCategory,
  MegaMenuGroup,
  MegaMenuLink,
  MegaMenuTrigger,
  type MegaMenuTriggerProps,
} from "../src/components/navigation/MegaMenu.js";
import { OVERLAY_LAYER } from "../src/lib/overlay-layer.js";

/*
  Выпадающий вид — та же разметка Категорий, обёрнутая в `MegaMenuTrigger`.
  Тесты смотрят только на то, что видно снаружи: роли, атрибуты, фокус.
*/

afterEach(cleanup);

// jsdom не умеет переходить по ссылкам: щелчок по `a[href]` печатает «not
// implemented: navigation». Переход здесь не предмет проверки.
beforeEach(() => {
  const stopNavigation = (event: Event) => event.preventDefault();
  document.addEventListener("click", stopNavigation);
  return () => document.removeEventListener("click", stopNavigation);
});

function Dropdown(props: Partial<MegaMenuTriggerProps> & { defaultValue?: string | null }) {
  const { defaultValue, ...trigger } = props;
  return (
    <>
      <button type="button">before</button>
      <MegaMenuTrigger {...trigger}>
        <MegaMenuButton>Catalog</MegaMenuButton>
        <MegaMenu aria-label="Catalog" defaultValue={defaultValue}>
          <MegaMenuCategory id="electronics" label="Electronics" href="/electronics">
            <MegaMenuGroup title="Phones" href="/phones">
              <MegaMenuLink href="/phones/a">Phone A</MegaMenuLink>
              <MegaMenuLink href="/phones/b">Phone B</MegaMenuLink>
            </MegaMenuGroup>
          </MegaMenuCategory>
          <MegaMenuCategory id="books" label="Books">
            <MegaMenuGroup title="Fiction">
              <MegaMenuLink href="/books/novels">Novels</MegaMenuLink>
            </MegaMenuGroup>
          </MegaMenuCategory>
          <MegaMenuCategory id="garden" label="Garden" disabled>
            <MegaMenuGroup title="Tools">
              <MegaMenuLink href="/garden/tools">Shovels</MegaMenuLink>
            </MegaMenuGroup>
          </MegaMenuCategory>
          <MegaMenuCategory id="sale" label="Sale" href="/sale" />
        </MegaMenu>
      </MegaMenuTrigger>
      <button type="button">after</button>
    </>
  );
}

const trigger = () => screen.getByRole("button", { name: "Catalog" });
const category = (name: string) => screen.getByRole("button", { name });
const menu = () => screen.queryByRole("navigation", { name: "Catalog" });

test("the closed dropdown renders only its button, also on the server", () => {
  const html = renderToString(<Dropdown />);

  expect(html).toContain("Catalog");
  expect(html).not.toContain("<nav");
  expect(html).toContain('aria-expanded="false"');
});

test("the button is a disclosure: aria-expanded and aria-controls, not a menu or dialog popup", async () => {
  const user = userEvent.setup();
  render(<Dropdown />);

  expect(trigger().getAttribute("aria-expanded")).toBe("false");
  expect(trigger().hasAttribute("aria-haspopup")).toBe(false);
  expect(menu()).toBeNull();

  await user.click(trigger());
  expect(trigger().getAttribute("aria-expanded")).toBe("true");
  expect(trigger().getAttribute("aria-controls")).toBeTruthy();
  expect(trigger().hasAttribute("aria-haspopup")).toBe(false);
});

test("the overlay is not announced as a dialog: the navigation stays a plain navigation landmark", async () => {
  const user = userEvent.setup();
  render(<Dropdown />);

  await user.click(trigger());

  expect(screen.queryByRole("dialog")).toBeNull();
  expect(menu()).not.toBeNull();
});

test("hovering the button does not open the catalog", async () => {
  const user = userEvent.setup();
  render(<Dropdown />);

  await user.hover(trigger());

  expect(menu()).toBeNull();
  expect(trigger().getAttribute("aria-expanded")).toBe("false");
});

test("a click opens the catalog under the button: focus goes to the first category, no showcase is open", async () => {
  const user = userEvent.setup();
  render(<Dropdown />);

  await user.click(trigger());

  expect(menu()).not.toBeNull();
  expect(trigger().getAttribute("aria-expanded")).toBe("true");
  // `aria-controls` указывает на содержимое оверлея.
  const panel = document.getElementById(trigger().getAttribute("aria-controls") ?? "");
  expect(panel?.contains(menu())).toBe(true);
  expect(document.activeElement).toBe(category("Electronics"));
  for (const name of ["Electronics", "Books", "Garden"])
    expect(category(name).getAttribute("aria-expanded")).toBe("false");
  expect(screen.queryByRole("link", { name: "Phone A" })).toBeNull();
});

test.each([["{Enter}"], [" "], ["{ArrowDown}"]])(
  "the key %j on the focused button opens the catalog and focuses the first category",
  async (key) => {
    const user = userEvent.setup();
    render(<Dropdown />);

    trigger().focus();
    await user.keyboard(key);

    expect(menu()).not.toBeNull();
    expect(document.activeElement).toBe(category("Electronics"));
  }
);

test("when a category is already open, focus goes to it instead of the first one", async () => {
  const user = userEvent.setup();
  render(<Dropdown defaultValue="books" />);

  await user.click(trigger());

  expect(document.activeElement).toBe(category("Books"));
  expect(category("Books").getAttribute("aria-expanded")).toBe("true");
});

test("the category column keeps working inside the overlay", async () => {
  const user = userEvent.setup();
  render(<Dropdown />);

  await user.click(trigger());
  await user.keyboard("{ArrowDown}");
  expect(document.activeElement).toBe(category("Books"));
  await user.keyboard("{Enter}");

  expect(document.activeElement).toBe(screen.getByRole("link", { name: "Novels" }));
});

test("Escape on a category closes the catalog and returns focus to the button", async () => {
  const user = userEvent.setup();
  render(<Dropdown />);

  await user.click(trigger());
  await user.keyboard("{Escape}");

  expect(menu()).toBeNull();
  expect(trigger().getAttribute("aria-expanded")).toBe("false");
  expect(document.activeElement).toBe(trigger());
});

test("the first Escape inside a showcase only closes the showcase and returns to its category", async () => {
  const user = userEvent.setup();
  render(<Dropdown />);

  await user.click(trigger());
  await user.keyboard("{ArrowDown}{Enter}");
  expect(document.activeElement).toBe(screen.getByRole("link", { name: "Novels" }));

  await user.keyboard("{Escape}");

  expect(menu()).not.toBeNull();
  expect(document.activeElement).toBe(category("Books"));
  expect(category("Books").getAttribute("aria-expanded")).toBe("false");

  await user.keyboard("{Escape}");
  expect(menu()).toBeNull();
  expect(document.activeElement).toBe(trigger());
});

test("a press outside closes the catalog", async () => {
  const user = userEvent.setup();
  render(<Dropdown />);

  await user.click(trigger());
  await user.click(screen.getByRole("button", { name: "after" }));

  expect(menu()).toBeNull();
  // Фокус остаётся там, куда нажал пользователь, а не отнимается кнопкой.
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "after" }));
});

test("a second click on the button closes the catalog and keeps focus on the button", async () => {
  const user = userEvent.setup();
  render(<Dropdown />);

  await user.click(trigger());
  await user.click(trigger());

  expect(menu()).toBeNull();
  expect(trigger().getAttribute("aria-expanded")).toBe("false");
  expect(document.activeElement).toBe(trigger());
});

test.each([
  ["a link-category", () => screen.getByRole("link", { name: "Sale" })],
  ["a showcase link", () => screen.getByRole("link", { name: "Phone A" })],
  ["a group title link", () => screen.getByRole("link", { name: "Phones" })],
  ["the category link atop a showcase", () => screen.getByRole("link", { name: "Electronics" })],
])("activating %s closes the catalog", async (_name, target) => {
  const user = userEvent.setup();
  render(<Dropdown />);

  await user.click(trigger());
  await user.hover(category("Electronics"));
  await user.click(target());

  expect(menu()).toBeNull();
  expect(trigger().getAttribute("aria-expanded")).toBe("false");
});

test("Enter on a link closes the catalog as well", async () => {
  const user = userEvent.setup();
  render(<Dropdown />);

  await user.click(trigger());
  await user.keyboard("{Enter}");
  expect(document.activeElement).toBe(screen.getByRole("link", { name: "Electronics" }));
  await user.keyboard("{Enter}");

  expect(menu()).toBeNull();
});

test("Tab past the last focusable element closes the catalog and moves on after the button", async () => {
  const user = userEvent.setup();
  render(<Dropdown />);

  await user.click(trigger());
  await user.tab();

  expect(menu()).toBeNull();
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "after" }));
});

test("Tab past the last link of an open showcase closes the catalog too", async () => {
  const user = userEvent.setup();
  render(<Dropdown />);

  await user.click(trigger());
  await user.keyboard("{ArrowDown}{Enter}");
  expect(document.activeElement).toBe(screen.getByRole("link", { name: "Novels" }));
  await user.tab();

  expect(menu()).toBeNull();
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "after" }));
});

test("Tab between the links of a showcase stays inside the catalog", async () => {
  const user = userEvent.setup();
  render(<Dropdown />);

  await user.click(trigger());
  await user.keyboard("{Enter}");
  expect(document.activeElement).toBe(screen.getByRole("link", { name: "Electronics" }));
  await user.tab();

  expect(menu()).not.toBeNull();
  expect(document.activeElement).toBe(screen.getByRole("link", { name: "Phones" }));
});

test("Shift+Tab before the first element closes the catalog and lands on the button", async () => {
  const user = userEvent.setup();
  render(<Dropdown />);

  await user.click(trigger());
  await user.tab({ shift: true });

  expect(menu()).toBeNull();
  expect(document.activeElement).toBe(trigger());
});

test("defaultOpen mounts the catalog open", async () => {
  render(<Dropdown defaultOpen />);

  expect(menu()).not.toBeNull();
  await waitFor(() => expect(document.activeElement).toBe(category("Electronics")));
});

test("onOpenChange reports every change; a controlled catalog follows only its owner", async () => {
  const user = userEvent.setup();
  const onOpenChange = vi.fn();

  function Controlled() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button type="button" onClick={() => setOpen(true)}>
          open from code
        </button>
        <Dropdown
          open={open}
          onOpenChange={(next) => {
            onOpenChange(next);
            // Владелец решает сам: закрыть можно, открыть щелчком по кнопке — нет.
            if (!next) setOpen(false);
          }}
        />
      </>
    );
  }

  render(<Controlled />);

  await user.click(trigger());
  expect(onOpenChange).toHaveBeenLastCalledWith(true);
  expect(menu()).toBeNull();

  await user.click(screen.getByRole("button", { name: "open from code" }));
  expect(menu()).not.toBeNull();

  await user.keyboard("{Escape}");
  expect(onOpenChange).toHaveBeenLastCalledWith(false);
  expect(menu()).toBeNull();
});

test("an uncontrolled catalog reports changes through onOpenChange too", async () => {
  const user = userEvent.setup();
  const onOpenChange = vi.fn();
  render(<Dropdown onOpenChange={onOpenChange} />);

  await user.click(trigger());
  await user.keyboard("{Escape}");

  expect(onOpenChange.mock.calls).toEqual([[true], [false]]);
});

test("the overlay sits on the popover layer, above a modal window's backdrop", async () => {
  const user = userEvent.setup();
  render(<Dropdown />);

  await user.click(trigger());

  const panel = document.getElementById(trigger().getAttribute("aria-controls") ?? "");
  expect(panel?.className).toContain(OVERLAY_LAYER.popover);
});

test("inside a Dialog the first Escape closes the catalog, the next one the window", async () => {
  const user = userEvent.setup();
  const onClose = vi.fn();
  render(
    <Dialog open onClose={onClose} title="Window">
      <MegaMenuTrigger>
        <MegaMenuButton>Catalog</MegaMenuButton>
        <MegaMenu aria-label="Catalog">
          <MegaMenuCategory id="books" label="Books">
            <MegaMenuGroup title="Fiction">
              <MegaMenuLink href="/books/novels">Novels</MegaMenuLink>
            </MegaMenuGroup>
          </MegaMenuCategory>
        </MegaMenu>
      </MegaMenuTrigger>
    </Dialog>
  );

  await user.click(trigger());
  expect(document.activeElement).toBe(category("Books"));

  await user.keyboard("{Escape}");
  expect(menu()).toBeNull();
  expect(onClose).not.toHaveBeenCalled();
  expect(document.activeElement).toBe(trigger());

  await user.keyboard("{Escape}");
  expect(onClose).toHaveBeenCalledTimes(1);
});

test("inside a Dialog, an Escape in a showcase closes the showcase, then the catalog, then the window", async () => {
  const user = userEvent.setup();
  const onClose = vi.fn();
  render(
    <Dialog open onClose={onClose} title="Window">
      <MegaMenuTrigger>
        <MegaMenuButton>Catalog</MegaMenuButton>
        <MegaMenu aria-label="Catalog">
          <MegaMenuCategory id="books" label="Books">
            <MegaMenuGroup title="Fiction">
              <MegaMenuLink href="/books/novels">Novels</MegaMenuLink>
            </MegaMenuGroup>
          </MegaMenuCategory>
        </MegaMenu>
      </MegaMenuTrigger>
    </Dialog>
  );

  await user.click(trigger());
  await user.keyboard("{Enter}");
  expect(document.activeElement).toBe(screen.getByRole("link", { name: "Novels" }));

  await user.keyboard("{Escape}");
  expect(menu()).not.toBeNull();
  expect(onClose).not.toHaveBeenCalled();

  await user.keyboard("{Escape}");
  expect(menu()).toBeNull();
  expect(onClose).not.toHaveBeenCalled();

  await user.keyboard("{Escape}");
  expect(onClose).toHaveBeenCalledTimes(1);
});

test("a disabled button never opens the catalog", async () => {
  const user = userEvent.setup();
  render(
    <MegaMenuTrigger>
      <MegaMenuButton disabled>Catalog</MegaMenuButton>
      <MegaMenu aria-label="Catalog" />
    </MegaMenuTrigger>
  );

  await user.click(trigger());

  expect(menu()).toBeNull();
});
