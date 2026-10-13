// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  MegaMenu,
  MegaMenuCategory,
  MegaMenuGroup,
  MegaMenuLink,
} from "../src/components/navigation/MegaMenu.js";
import { UiProvider } from "../src/index.js";
import { messages as en } from "../src/locales/en.js";
import { messages as ru } from "../src/locales/ru.js";

/*
  Касание и узкий экран мегаменю (OLDSUI-258).

  Касание (и перо) открывает Категорию сразу, без Прицела; повторное касание
  открытой Категории её не закрывает. На узком экране (тот же брейкпойнт, что
  у подменю кита) открытая Категория ЗАМЕНЯЕТ Столбец своей Витриной со строкой
  «Назад»; «Назад» и Escape возвращают Столбец и фокус на исходную Категорию.
  Ширина подменяется через `matchMedia`, как в `submenu-placement`.
*/

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

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  Reflect.deleteProperty(window, "matchMedia");
});

function Catalog() {
  return (
    <>
      <button type="button">before</button>
      <MegaMenu aria-label="Catalog">
        <MegaMenuCategory id="electronics" label="Electronics" href="/electronics">
          <MegaMenuGroup title="Phones">
            <MegaMenuLink href="/phones/a">Phone A</MegaMenuLink>
          </MegaMenuGroup>
        </MegaMenuCategory>
        <MegaMenuCategory id="books" label="Books">
          <MegaMenuGroup title="Fiction">
            <MegaMenuLink href="/books/novels">Novels</MegaMenuLink>
          </MegaMenuGroup>
        </MegaMenuCategory>
        <MegaMenuCategory id="sale" label="Sale" href="/sale" />
      </MegaMenu>
    </>
  );
}

const category = (name: string) => screen.getByRole("button", { name });
const expanded = (name: string) => category(name).getAttribute("aria-expanded") === "true";

/** Касание пальцем или пером: поток событий указателя, затем `click`, как в браузере. */
function tap(element: Element, pointerType: "touch" | "pen" = "touch") {
  act(() => {
    fireEvent.pointerEnter(element, { pointerType });
    fireEvent.pointerDown(element, { pointerType });
    fireEvent.pointerUp(element, { pointerType });
    fireEvent.click(element);
  });
}

test.each(["touch", "pen"] as const)("a %s tap opens the showcase at once, with no aim", (type) => {
  render(<Catalog />);
  tap(category("Electronics"), type);
  expect(expanded("Electronics")).toBe(true);
  expect(screen.getByRole("link", { name: "Phone A" })).toBeTruthy();

  // Другая Категория открывается сразу же, без ожидания остановки указателя.
  tap(category("Books"), type);
  expect(expanded("Books")).toBe(true);
  expect(expanded("Electronics")).toBe(false);
});

test("a second tap on the open category keeps its showcase open", () => {
  render(<Catalog />);
  tap(category("Electronics"));
  tap(category("Electronics"));
  expect(expanded("Electronics")).toBe(true);
  expect(screen.getByRole("link", { name: "Phone A" })).toBeTruthy();
});

test("a touch that leaves the column does not close the showcase", () => {
  render(<Catalog />);
  tap(category("Electronics"));
  act(() => {
    fireEvent.pointerLeave(screen.getByRole("navigation"), { pointerType: "touch" });
    vi.advanceTimersByTime(1000);
  });
  expect(expanded("Electronics")).toBe(true);
});

test("a wide screen keeps the column visible next to the showcase", () => {
  mockWidth(false);
  render(<Catalog />);
  tap(category("Electronics"));
  expect(category("Books")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
});

test("a narrow screen replaces the column with the category's showcase and a Back row", () => {
  mockWidth(true);
  render(<Catalog />);
  tap(category("Electronics"));

  // Столбец исчез: остальных Категорий нет в доступном дереве.
  expect(screen.queryByRole("button", { name: "Books" })).toBeNull();
  expect(screen.queryByRole("link", { name: "Sale" })).toBeNull();

  const region = screen.getByRole("region", { name: "Electronics" });
  expect(region.hidden).toBe(false);
  expect(screen.getByRole("link", { name: "Phone A" })).toBeTruthy();
  // Строка «Назад» показывает и имя Категории.
  const back = screen.getByRole("button", { name: "Back" });
  expect(region.contains(back)).toBe(true);
  expect(back.parentElement?.textContent).toContain("Electronics");
});

test("the category button keeps the disclosure semantics while the column is replaced", () => {
  mockWidth(true);
  render(<Catalog />);
  tap(category("Electronics"));
  const button = screen.getByRole("button", { hidden: true, expanded: true });
  expect(button.getAttribute("aria-expanded")).toBe("true");
  const region = screen.getByRole("region", { name: "Electronics" });
  expect(button.getAttribute("aria-controls")).toBe(region.id);
});

test("Back restores the column and puts focus on the category the user came from", () => {
  mockWidth(true);
  render(<Catalog />);
  tap(category("Books"));
  expect(screen.queryByRole("button", { name: "Electronics" })).toBeNull();

  act(() => {
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
  });
  expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
  expect(screen.getByRole("button", { name: "Electronics" })).toBeTruthy();
  expect(expanded("Books")).toBe(false);
  expect(document.activeElement).toBe(category("Books"));
});

test("opening a category moves focus into the replaced view, onto Back", () => {
  mockWidth(true);
  render(<Catalog />);
  tap(category("Electronics"));
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Back" }));
});

test("Enter on a category drills down; Escape from inside acts as Back", () => {
  mockWidth(true);
  render(<Catalog />);
  const electronics = category("Electronics");
  act(() => electronics.focus());
  act(() => {
    fireEvent.keyDown(electronics, { key: "Enter" });
  });
  expect(screen.queryByRole("button", { name: "Books" })).toBeNull();

  act(() => {
    fireEvent.keyDown(screen.getByRole("link", { name: "Phone A" }), { key: "Escape" });
  });
  expect(screen.getByRole("button", { name: "Books" })).toBeTruthy();
  expect(document.activeElement).toBe(category("Electronics"));
});

test("a narrow screen has no aim: hovering with a mouse does not swap the column", () => {
  mockWidth(true);
  render(<Catalog />);
  act(() => {
    fireEvent.pointerEnter(category("Electronics"), { pointerType: "mouse" });
  });
  expect(expanded("Electronics")).toBe(false);
  expect(category("Books")).toBeTruthy();
});

test("a mouse leaving the narrow catalog does not drop the drill-down", () => {
  mockWidth(true);
  render(<Catalog />);
  tap(category("Electronics"));
  act(() => {
    fireEvent.pointerLeave(screen.getByRole("navigation"), { pointerType: "mouse" });
    vi.advanceTimersByTime(1000);
  });
  expect(screen.getByRole("button", { name: "Back" })).toBeTruthy();
});

test("the Back label comes from the message catalog", () => {
  mockWidth(true);
  render(
    <UiProvider messages={ru}>
      <Catalog />
    </UiProvider>
  );
  tap(category("Electronics"));
  expect(screen.getByRole("button", { name: ru.megaMenu.back })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
});

test("the Back label follows the provider's catalog, English included", () => {
  mockWidth(true);
  render(
    <UiProvider messages={en}>
      <Catalog />
    </UiProvider>
  );
  tap(category("Electronics"));
  expect(screen.getByRole("button", { name: "Back" })).toBeTruthy();
});

test("a narrow screen replaces the column with an externally opened category too", () => {
  mockWidth(true);
  render(
    <MegaMenu aria-label="Catalog" defaultValue="books">
      <MegaMenuCategory id="electronics" label="Electronics">
        <MegaMenuLink href="/e">E</MegaMenuLink>
      </MegaMenuCategory>
      <MegaMenuCategory id="books" label="Books">
        <MegaMenuLink href="/b">B</MegaMenuLink>
      </MegaMenuCategory>
    </MegaMenu>
  );
  expect(screen.queryByRole("button", { name: "Electronics" })).toBeNull();
  expect(screen.getByRole("link", { name: "B" })).toBeTruthy();
});

test("a value that names no showcase leaves the column in place", () => {
  mockWidth(true);
  render(
    <MegaMenu aria-label="Catalog" value="missing">
      <MegaMenuCategory id="electronics" label="Electronics">
        <MegaMenuLink href="/e">E</MegaMenuLink>
      </MegaMenuCategory>
    </MegaMenu>
  );
  expect(screen.getByRole("button", { name: "Electronics" })).toBeTruthy();
});

test("the catalog renders on the server, where the screen width is unknown", () => {
  mockWidth(true);
  const html = renderToString(
    <MegaMenu aria-label="Catalog" defaultValue="books">
      <MegaMenuCategory id="electronics" label="Electronics">
        <MegaMenuLink href="/e">E</MegaMenuLink>
      </MegaMenuCategory>
      <MegaMenuCategory id="books" label="Books">
        <MegaMenuLink href="/b">B</MegaMenuLink>
      </MegaMenuCategory>
    </MegaMenu>
  );
  // Сервер ширины не знает: рисует широкий вид, Столбец на месте.
  expect(html).toContain("Electronics");
  expect(html).not.toContain("Back");
});
