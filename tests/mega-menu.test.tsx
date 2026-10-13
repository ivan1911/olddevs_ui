// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { forwardRef, useState, type AnchorHTMLAttributes } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, expect, test, vi } from "vitest";
import {
  MegaMenu,
  MegaMenuCategory,
  MegaMenuGroup,
  MegaMenuLink,
} from "../src/components/navigation/MegaMenu.js";

/*
  Мегаменю — навигация по шаблону WAI-ARIA Disclosure Navigation: Категория
  с Витриной — кнопка, раскрывающая регион ссылок, а не пункт меню команд.
  Тесты смотрят только на то, что видно снаружи: роли, атрибуты, фокус,
  смонтированное содержимое.
*/

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function Catalog(props: Partial<Parameters<typeof MegaMenu>[0]> = {}) {
  return (
    <>
      <button type="button">before</button>
      <MegaMenu aria-label="Catalog" {...props}>
        <MegaMenuCategory id="electronics" label="Electronics" href="/electronics">
          <MegaMenuGroup title="Phones">
            <MegaMenuLink href="/phones/a">Phone A</MegaMenuLink>
            <MegaMenuLink href="/phones/b" current>
              Phone B
            </MegaMenuLink>
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
      <button type="button">after</button>
    </>
  );
}

const category = (name: string) => screen.getByRole("button", { name });

test("the catalog is a navigation landmark of disclosure buttons, each controlling a hidden region", () => {
  render(<Catalog />);

  expect(screen.getByRole("navigation", { name: "Catalog" })).toBeTruthy();
  const electronics = category("Electronics");
  expect(electronics.getAttribute("aria-expanded")).toBe("false");
  const panel = document.getElementById(electronics.getAttribute("aria-controls") ?? "");
  // Регион существует и закрытым: `aria-controls` не должен указывать в пустоту.
  expect(panel).not.toBeNull();
  expect(panel?.hidden).toBe(true);
  // Содержимое закрытой Витрины не смонтировано: каталог из сотни ссылок не
  // грузит всё сразу.
  expect(screen.queryByRole("link", { name: "Phone A" })).toBeNull();
});

test("hovering a category opens its showcase right away and only its content is mounted", async () => {
  const user = userEvent.setup();
  render(<Catalog />);

  await user.hover(category("Books"));

  expect(category("Books").getAttribute("aria-expanded")).toBe("true");
  const region = screen.getByRole("region", { name: "Books" });
  expect(region.hidden).toBe(false);
  expect(screen.getByRole("link", { name: "Novels" })).toBeTruthy();
  expect(screen.queryByRole("link", { name: "Phone A" })).toBeNull();

  await user.hover(category("Electronics"));
  expect(category("Books").getAttribute("aria-expanded")).toBe("false");
  expect(screen.getByRole("link", { name: "Phone A" })).toBeTruthy();
});

/*
  Без user-event: его `asyncWrapper` ждёт настоящий `setTimeout`, а под
  поддельными таймерами тот не наступает (тот же обход — в `hover-card`).
  `fireEvent.pointerEnter` у Testing Library шлёт и `pointerover`, из которого
  React собирает свой `onPointerEnter`.
*/
test("leaving both the column and the showcase closes it after a short grace, coming back cancels", () => {
  vi.useFakeTimers();
  render(<Catalog />);
  const nav = screen.getByRole("navigation", { name: "Catalog" });
  const pointer = (event: "pointerEnter" | "pointerLeave", element: Element) =>
    act(() => {
      fireEvent[event](element, { pointerType: "mouse" });
    });

  pointer("pointerEnter", nav);
  pointer("pointerEnter", category("Books"));
  expect(category("Books").getAttribute("aria-expanded")).toBe("true");

  pointer("pointerLeave", nav);
  act(() => vi.advanceTimersByTime(100));
  // Курсор вернулся в зазор — закрытие отменено.
  pointer("pointerEnter", nav);
  act(() => vi.advanceTimersByTime(200));
  expect(category("Books").getAttribute("aria-expanded")).toBe("true");

  pointer("pointerLeave", nav);
  act(() => vi.advanceTimersByTime(200));
  expect(category("Books").getAttribute("aria-expanded")).toBe("false");
});

test("the column is a single tab stop; arrows, Home and End move between categories and skip disabled ones", async () => {
  const user = userEvent.setup();
  render(<Catalog />);

  await user.click(screen.getByRole("button", { name: "before" }));
  await user.tab();
  expect(document.activeElement).toBe(category("Electronics"));

  await user.keyboard("{ArrowDown}");
  expect(document.activeElement).toBe(category("Books"));
  // «Garden» выключена — стрелка её пропускает.
  await user.keyboard("{ArrowDown}");
  expect(document.activeElement).toBe(screen.getByRole("link", { name: "Sale" }));
  await user.keyboard("{Home}");
  expect(document.activeElement).toBe(category("Electronics"));
  await user.keyboard("{End}");
  expect(document.activeElement).toBe(screen.getByRole("link", { name: "Sale" }));
  await user.keyboard("{ArrowUp}");
  expect(document.activeElement).toBe(category("Books"));

  // Одна остановка Tab: следующий Tab уходит со Столбца, а не на соседнюю Категорию.
  await user.tab();
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "after" }));
  // Вернувшись, пользователь попадает туда, где был.
  await user.tab({ shift: true });
  expect(document.activeElement).toBe(category("Books"));
});

test("Enter opens the showcase and moves focus to its first link; Escape brings focus back and closes it", async () => {
  const user = userEvent.setup();
  render(<Catalog />);

  category("Books").focus();
  await user.keyboard("{Enter}");

  expect(category("Books").getAttribute("aria-expanded")).toBe("true");
  expect(document.activeElement).toBe(screen.getByRole("link", { name: "Novels" }));

  await user.keyboard("{Escape}");
  expect(document.activeElement).toBe(category("Books"));
  expect(category("Books").getAttribute("aria-expanded")).toBe("false");
});

test("Enter on a category already opened by hover moves focus into its showcase", async () => {
  const user = userEvent.setup();
  render(<Catalog />);

  await user.hover(category("Books"));
  category("Books").focus();
  await user.keyboard("{Enter}");

  expect(document.activeElement).toBe(screen.getByRole("link", { name: "Novels" }));
});

test("the arrow towards the showcase opens it, the arrow back returns to the category and keeps it open", async () => {
  const user = userEvent.setup();
  render(<Catalog />);

  category("Electronics").focus();
  await user.keyboard("{ArrowRight}");
  // Первой в Витрине стоит ссылка самой Категории — у неё есть `href`.
  expect(document.activeElement).toBe(screen.getByRole("link", { name: "Electronics" }));

  await user.keyboard("{ArrowLeft}");
  expect(document.activeElement).toBe(category("Electronics"));
  expect(category("Electronics").getAttribute("aria-expanded")).toBe("true");
});

test("Tab past the last link of the showcase leaves the catalog and closes the showcase", async () => {
  const user = userEvent.setup();
  render(<Catalog />);

  category("Books").focus();
  await user.keyboard("{Enter}");
  await user.tab();

  expect(document.activeElement).toBe(screen.getByRole("button", { name: "after" }));
  expect(category("Books").getAttribute("aria-expanded")).toBe("false");
});

test("arrowing to another category while a showcase is open switches the showcase with it", async () => {
  const user = userEvent.setup();
  render(<Catalog />);

  category("Electronics").focus();
  await user.keyboard("{ArrowRight}{ArrowLeft}{ArrowDown}");

  expect(document.activeElement).toBe(category("Books"));
  expect(category("Books").getAttribute("aria-expanded")).toBe("true");
  expect(category("Electronics").getAttribute("aria-expanded")).toBe("false");
});

test("a category without a showcase is a plain link, and hovering it closes the open showcase", async () => {
  const user = userEvent.setup();
  render(<Catalog />);

  await user.hover(category("Books"));
  const sale = screen.getByRole("link", { name: "Sale" });
  expect(sale.getAttribute("href")).toBe("/sale");

  await user.hover(sale);
  expect(category("Books").getAttribute("aria-expanded")).toBe("false");
});

test("a disabled category is announced as unavailable and does not open", async () => {
  const user = userEvent.setup();
  render(<Catalog />);

  const garden = category("Garden");
  expect(garden.getAttribute("aria-disabled")).toBe("true");
  await user.hover(garden);
  await user.click(garden);
  expect(garden.getAttribute("aria-expanded")).toBe("false");
});

test("the current link is marked for assistive tech, the category link heads its showcase", async () => {
  const user = userEvent.setup();
  render(<Catalog />);

  await user.hover(category("Electronics"));

  expect(screen.getByRole("link", { name: "Phone B" }).getAttribute("aria-current")).toBe("page");
  expect(screen.getByRole("link", { name: "Phone A" }).getAttribute("aria-current")).toBeNull();
  expect(screen.getByRole("link", { name: "Electronics" }).getAttribute("href")).toBe(
    "/electronics"
  );
  // Колонка — список ссылок, подписанный своим заголовком.
  expect(screen.getByRole("list", { name: "Phones" })).toBeTruthy();
});

const RouterLink = forwardRef<HTMLAnchorElement, AnchorHTMLAttributes<HTMLAnchorElement>>(
  function RouterLink(props, ref) {
    return <a ref={ref} data-router="" {...props} />;
  }
);

test("links render as the router's element through asChild and the category's link prop", async () => {
  const user = userEvent.setup();
  render(
    <MegaMenu aria-label="Catalog">
      <MegaMenuCategory id="books" label="Books" link={<RouterLink href="/books" />}>
        <MegaMenuGroup title="Fiction">
          <MegaMenuLink asChild>
            <RouterLink href="/books/novels">Novels</RouterLink>
          </MegaMenuLink>
        </MegaMenuGroup>
      </MegaMenuCategory>
      <MegaMenuCategory id="sale" label="Sale" link={<RouterLink href="/sale" />} />
    </MegaMenu>
  );

  expect(screen.getByRole("link", { name: "Sale" }).hasAttribute("data-router")).toBe(true);
  await user.hover(category("Books"));
  const novels = screen.getByRole("link", { name: "Novels" });
  expect(novels.hasAttribute("data-router")).toBe(true);
  expect(novels.getAttribute("href")).toBe("/books/novels");
  expect(screen.getByRole("link", { name: "Books" }).hasAttribute("data-router")).toBe(true);
});

test("the open category can be controlled from outside", async () => {
  const user = userEvent.setup();
  const onValueChange = vi.fn();

  function Controlled() {
    const [value, setValue] = useState<string | null>("books");
    return (
      <>
        <button type="button" onClick={() => setValue(null)}>
          reset
        </button>
        <Catalog
          value={value}
          onValueChange={(next) => {
            onValueChange(next);
            setValue(next);
          }}
        />
      </>
    );
  }

  render(<Controlled />);
  expect(category("Books").getAttribute("aria-expanded")).toBe("true");

  await user.hover(category("Electronics"));
  expect(onValueChange).toHaveBeenLastCalledWith("electronics");
  expect(category("Electronics").getAttribute("aria-expanded")).toBe("true");

  await user.click(screen.getByRole("button", { name: "reset" }));
  expect(category("Electronics").getAttribute("aria-expanded")).toBe("false");
});

test("defaultValue opens a category initially without controlling it", () => {
  render(<Catalog defaultValue="electronics" />);
  expect(category("Electronics").getAttribute("aria-expanded")).toBe("true");
});

test("a pointer press outside the catalog closes the showcase", async () => {
  const user = userEvent.setup();
  render(<Catalog defaultValue="books" />);

  await user.click(screen.getByRole("button", { name: "after" }));
  expect(category("Books").getAttribute("aria-expanded")).toBe("false");
});

test("the catalog renders on the server", () => {
  const html = renderToString(<Catalog defaultValue="books" />);
  expect(html).toContain("Electronics");
  expect(html).toContain("Novels");
  expect(html).toContain('aria-label="Catalog"');
});
