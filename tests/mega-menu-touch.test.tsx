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
  Touch and narrow screen for the mega menu (OLDSUI-258).

  A touch (and a pen) opens a Category at once, with no menu aim. A repeated
  tap on an open Category does not close it. On a narrow screen (the same
  breakpoint as the kit's submenu) the open Category REPLACES the Column with its
  flyout, with a "Back" row. "Back" and Escape return the Column and focus to the
  originating Category. The width is switched through `matchMedia`, as in
  `submenu-placement`.
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

/** A finger or pen touch: a stream of pointer events, then `click`, as in a browser. */
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

  // The other Category opens at once, without waiting for the pointer to stop.
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

  // The Column is gone: the other Categories are not in the accessible tree.
  expect(screen.queryByRole("button", { name: "Books" })).toBeNull();
  expect(screen.queryByRole("link", { name: "Sale" })).toBeNull();

  const region = screen.getByRole("region", { name: "Electronics" });
  expect(region.hidden).toBe(false);
  expect(screen.getByRole("link", { name: "Phone A" })).toBeTruthy();
  // A Category with a link gets its name from the heading link below the "Back"
  // row, and only from that: showing the name twice in a row on a phone is not worth it.
  const back = screen.getByRole("button", { name: "Back" });
  expect(region.contains(back)).toBe(true);
  expect(back.parentElement?.textContent).not.toContain("Electronics");
  expect(screen.getByRole("link", { name: "Electronics" }).getAttribute("href")).toBe(
    "/electronics"
  );
});

test("without a link of its own, the category name stands in the Back row", () => {
  mockWidth(true);
  render(<Catalog />);
  tap(category("Books"));

  const back = screen.getByRole("button", { name: "Back" });
  expect(back.parentElement?.textContent).toContain("Books");
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
  // The server does not know the width: it renders the wide view, with the Column in place.
  expect(html).toContain("Electronics");
  expect(html).not.toContain("Back");
});

/*
  Categories that the Column does not see among its direct children (OLDSUI-262):
  wrapped by a consumer's component, or coming from a Next.js server component,
  where the element type on the client is a lazy wrapper rather than the function
  itself. The descent must rely on what the Categories report about themselves.
*/

function Wrapped({ id, label, href }: { id: string; label: string; href?: string }) {
  if (href) return <MegaMenuCategory id={id} label={label} href={href} />;
  return (
    <MegaMenuCategory id={id} label={label}>
      <MegaMenuLink href={`/${id}`}>{`${label} link`}</MegaMenuLink>
    </MegaMenuCategory>
  );
}

test("wrapped categories: a value naming a link-only category leaves the column in place", () => {
  mockWidth(true);
  render(
    <MegaMenu aria-label="Catalog" value="sale">
      <Wrapped id="books" label="Books" />
      <Wrapped id="sale" label="Sale" href="/sale" />
    </MegaMenu>
  );
  // Previously the Column was hidden entirely and there was nowhere to descend: an empty catalog.
  expect(screen.getByRole("button", { name: "Books" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Sale" })).toBeTruthy();
});

test("wrapped categories: an unknown value leaves the column in place", () => {
  mockWidth(true);
  render(
    <MegaMenu aria-label="Catalog" value="missing">
      <Wrapped id="books" label="Books" />
    </MegaMenu>
  );
  expect(screen.getByRole("button", { name: "Books" })).toBeTruthy();
});

test("wrapped categories still drill down on a narrow screen", () => {
  mockWidth(true);
  render(
    <MegaMenu aria-label="Catalog" defaultValue="books">
      <Wrapped id="electronics" label="Electronics" />
      <Wrapped id="books" label="Books" />
    </MegaMenu>
  );
  expect(screen.queryByRole("button", { name: "Electronics" })).toBeNull();
  expect(screen.getByRole("link", { name: "Books link" })).toBeTruthy();
});
