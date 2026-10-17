// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  MegaMenu,
  MegaMenuCategory,
  MegaMenuGroup,
  MegaMenuLink,
} from "../src/components/navigation/MegaMenu.js";

/*
  Menu aim in the mega menu (OLDSUI-256): a pointer cutting diagonally toward
  the open flyout does not hand it over to a neighboring category that the
  pointer crosses on the way.

  jsdom has no layout, so the flyout's rectangle is mocked: the category column
  is x 0…250, the flyout x 260…900, y 0…400. Time is faked too: both the
  thinning of pointer steps and the pointer coming to rest are measured by it.
  Events are fired directly, without user-event (its wrapper waits on a real
  `setTimeout`; see `hover-card`).
*/

const SHOWCASE = { left: 260, right: 900, top: 0, bottom: 400 };

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
    this: HTMLElement
  ) {
    const rect =
      this.tagName === "SECTION"
        ? SHOWCASE
        : this.tagName === "NAV"
          ? { left: 0, right: 250, top: 0, bottom: 400 }
          : { left: 0, right: 0, top: 0, bottom: 0 };
    return {
      ...rect,
      x: rect.left,
      y: rect.top,
      width: rect.right - rect.left,
      height: rect.bottom - rect.top,
      toJSON: () => rect,
    } as DOMRect;
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function Catalog() {
  return (
    <MegaMenu aria-label="Catalog">
      {["Alpha", "Beta", "Gamma"].map((name) => (
        <MegaMenuCategory key={name} id={name} label={name}>
          <MegaMenuGroup title={`${name} group`}>
            <MegaMenuLink href={`/${name}`}>{`${name} link`}</MegaMenuLink>
          </MegaMenuGroup>
        </MegaMenuCategory>
      ))}
      <MegaMenuCategory id="deals" label="Deals" href="/deals" />
    </MegaMenu>
  );
}

const category = (name: string) => screen.getByRole("button", { name });
const expanded = (name: string) => category(name).getAttribute("aria-expanded") === "true";

/** Hovers the mouse over a row: Testing Library's `pointerEnter` also sends `pointerover`. */
const enter = (element: Element, pointerType = "mouse") =>
  act(() => {
    fireEvent.pointerEnter(element, { pointerType });
  });

/** A pointer step. A frame goes between steps, otherwise the thinning would drop it. */
const move = (x: number, y: number, target: Element = document.body, pointerType = "mouse") =>
  act(() => {
    vi.advanceTimersByTime(20);
    fireEvent.pointerMove(target, { clientX: x, clientY: y, pointerType, bubbles: true });
  });

const tick = (ms: number) => act(() => vi.advanceTimersByTime(ms));

test("cutting diagonally across a neighbor towards the showcase keeps the open category", () => {
  render(<Catalog />);
  enter(category("Alpha"));
  expect(expanded("Alpha")).toBe(true);

  // Right and slightly down, into the sector towards the corners of the flyout's near edge.
  move(100, 20);
  move(130, 30);
  move(160, 40);
  enter(category("Beta"));

  expect(expanded("Alpha")).toBe(true);
  expect(expanded("Beta")).toBe(false);
});

test("when the pointer rests, the category under it opens after the settle delay", () => {
  render(<Catalog />);
  enter(category("Alpha"));
  move(100, 20);
  move(130, 30);
  enter(category("Beta"));

  tick(250);
  expect(expanded("Alpha")).toBe(true);
  tick(60);
  expect(expanded("Beta")).toBe(true);
});

test("moving straight down the column switches categories at once", () => {
  render(<Catalog />);
  enter(category("Alpha"));
  move(100, 20);
  move(100, 30);
  move(100, 40);
  enter(category("Beta"));

  expect(expanded("Beta")).toBe(true);
});

test("two steps away from the showcase end the aim and open the category under the pointer", () => {
  render(<Catalog />);
  enter(category("Alpha"));
  move(100, 20);
  move(130, 30);
  move(160, 40);
  enter(category("Beta"));
  expect(expanded("Alpha")).toBe(true);

  // One sideways move is forgiven…
  move(150, 60);
  expect(expanded("Alpha")).toBe(true);
  // …a second one in a row is not.
  move(140, 80);
  expect(expanded("Beta")).toBe(true);
});

test("reaching the showcase cancels the deferred switch", () => {
  render(<Catalog />);
  enter(category("Alpha"));
  move(100, 20);
  move(130, 30);
  enter(category("Beta"));

  const showcase = screen.getByRole("region", { name: "Alpha" });
  move(270, 40, showcase);
  tick(500);

  expect(expanded("Alpha")).toBe(true);
  expect(expanded("Beta")).toBe(false);
});

test("a click on a category opens it at once, even while the switch is deferred", () => {
  render(<Catalog />);
  enter(category("Alpha"));
  move(100, 20);
  move(130, 30);
  enter(category("Beta"));
  act(() => {
    fireEvent.click(category("Beta"));
  });

  expect(expanded("Beta")).toBe(true);
});

test("a link category under an aiming pointer does not close the showcase either", () => {
  render(<Catalog />);
  enter(category("Alpha"));
  move(100, 20);
  move(130, 30);
  enter(screen.getByRole("link", { name: "Deals" }));

  expect(expanded("Alpha")).toBe(true);
  tick(310);
  expect(expanded("Alpha")).toBe(false);
});

test("touch and pen do not aim: their moves never defer a switch", () => {
  render(<Catalog />);
  enter(category("Alpha"));
  move(100, 20, document.body, "touch");
  move(130, 30, document.body, "touch");
  move(160, 40, document.body, "pen");
  enter(category("Beta"));

  expect(expanded("Beta")).toBe(true);
});

test("near the end edge of the window the showcase flips, and the arrow towards it flips too", () => {
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(640);
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 1400 });
  // The category column is at the right edge: 150px to the right, 1000 to the left; the flyout needs 652.
  vi.mocked(HTMLElement.prototype.getBoundingClientRect).mockImplementation(function (
    this: HTMLElement
  ) {
    const rect =
      this.tagName === "NAV"
        ? { left: 1000, right: 1250, top: 0, bottom: 400 }
        : { left: 0, right: 0, top: 0, bottom: 0 };
    return { ...rect, x: rect.left, y: rect.top, width: 250, height: 400 } as DOMRect;
  });
  try {
    render(<Catalog />);
    category("Alpha").focus();
    act(() => {
      fireEvent.keyDown(category("Alpha"), { key: "ArrowRight" });
    });
    expect(expanded("Alpha")).toBe(false);

    act(() => {
      fireEvent.keyDown(category("Alpha"), { key: "ArrowLeft" });
    });
    expect(expanded("Alpha")).toBe(true);
    expect(document.activeElement).toBe(screen.getByRole("link", { name: "Alpha link" }));
  } finally {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1024 });
  }
});

test("a deferred switch that unmounts the focused showcase hands focus to its category", () => {
  render(<Catalog />);
  enter(category("Alpha"));
  move(100, 20);
  move(130, 30);
  enter(category("Beta"));
  // While the switch is deferred, the user tabbed into the open flyout.
  act(() => {
    screen.getByRole("link", { name: "Alpha link" }).focus();
  });
  tick(310);

  expect(expanded("Beta")).toBe(true);
  expect(document.activeElement).toBe(category("Alpha"));
});
