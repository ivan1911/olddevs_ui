// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useRef } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { RichTextToc, RichTextView } from "../src/editor/index.js";

/**
 * Оглавление Документа (OLDSUI-264, ADR-0066). Проверки идут через публичную
 * пару компонентов: экран ставит `RichTextToc` рядом с `RichTextView` и отдаёт
 * ему ref Просмотра — ровно так, как это сделает потребитель.
 */

beforeEach(() => {
  // В jsdom прокрутки нет: переход проверяется по фокусу, а вызов только
  // не должен падать.
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(cleanup);

function Screen({ html }: { html: string }) {
  const view = useRef<HTMLDivElement>(null);
  return (
    <div>
      <RichTextToc target={view} />
      <RichTextView ref={view} html={html} data-testid="view" />
    </div>
  );
}

const ARTICLE =
  "<h2>Palette</h2><p>Intro</p>" +
  "<h3>How to read</h3><p>Text</p>" +
  "<h4>Neutrals</h4><p>Text</p>" +
  "<h2>What's next</h2><p>Outro</p>";

const strip = () => screen.getByRole("button", { name: "Table of contents" });

/** Открыть список и вернуть его пункты. */
async function openList(user: ReturnType<typeof userEvent.setup>) {
  await user.click(strip());
  const nav = screen.getByRole("navigation", { name: "Table of contents" });
  return within(nav).getAllByRole("button");
}

test("the strip has one stroke per heading and opens the list of headings", async () => {
  const user = userEvent.setup();
  render(<Screen html={ARTICLE} />);

  expect(strip().getAttribute("aria-expanded")).toBe("false");
  expect(strip().querySelectorAll("[data-toc-stroke]")).toHaveLength(4);

  const items = await openList(user);
  expect(strip().getAttribute("aria-expanded")).toBe("true");
  expect(items.map((item) => item.textContent)).toEqual([
    "Palette",
    "How to read",
    "Neutrals",
    "What's next",
  ]);
});

test("headings come from the top level and Wrappers, not from Layout columns or custom Blocks", async () => {
  const user = userEvent.setup();
  render(
    <Screen
      html={
        "<h1>Top</h1>" +
        '<div data-block="wrapper" data-tone="accent"><h2>In wrapper</h2><p>x</p></div>' +
        '<div data-block="layout" data-layout="50-50"><div data-block="column"><h2>Left</h2></div>' +
        '<div data-block="column"><h2>Right</h2></div></div>' +
        '<div data-block="acme_card"><h3>In custom block</h3></div>' +
        "<h5>Too deep</h5><h4>Last</h4>"
      }
    />
  );

  const items = await openList(user);
  expect(items.map((item) => item.textContent)).toEqual(["Top", "In wrapper", "Last"]);
});

test("fewer than two headings render nothing", () => {
  render(<Screen html="<h2>Only one</h2><p>Text</p>" />);
  expect(screen.queryByRole("button", { name: "Table of contents" })).toBeNull();
});

test("the indent and stroke length follow the level relative to the largest heading", async () => {
  const user = userEvent.setup();
  // Самый крупный здесь — H2: он без отступа, хотя H1 в Схеме есть.
  render(<Screen html="<h2>A</h2><h3>B</h3><h4>C</h4>" />);

  const depths = [...strip().querySelectorAll("[data-toc-stroke]")].map((stroke) =>
    stroke.getAttribute("data-depth")
  );
  expect(depths).toEqual(["0", "1", "2"]);

  const items = await openList(user);
  expect(items.map((item) => item.getAttribute("data-depth"))).toEqual(["0", "1", "2"]);
});

test("every deeper level gets a shorter stroke", () => {
  render(<Screen html="<h1>A</h1><h2>B</h2><h3>C</h3><h4>D</h4>" />);

  // Первый штрих — текущий раздел, у него своя длина; уровни сверяются по остальным.
  const widths = [...strip().querySelectorAll("[data-toc-stroke]:not([data-current])")].map(
    (stroke) => Number(stroke.className.match(/\bw-([\d.]+)\b/)?.[1])
  );
  expect(widths).toHaveLength(3);
  expect(widths[0]).toBeGreaterThan(widths[1]!);
  expect(widths[1]).toBeGreaterThan(widths[2]!);
});

test("a click on an item focuses the heading without touching the address or ids", async () => {
  const user = userEvent.setup();
  const before = window.location.href;
  render(<Screen html={ARTICLE} />);

  const items = await openList(user);
  await user.click(items[2]!);

  const heading = screen.getByTestId("view").querySelector("h4")!;
  expect(document.activeElement).toBe(heading);
  expect(heading.getAttribute("tabindex")).toBe("-1");
  expect(heading.scrollIntoView).toHaveBeenCalled();
  // Список не пропадает от выбора: его закрывает уход курсора.
  expect(screen.getByRole("navigation", { name: "Table of contents" })).toBeTruthy();
  expect(window.location.href).toBe(before);
  expect(screen.getByTestId("view").querySelector("[id]")).toBeNull();
});

test("the heading drops its tabindex once focus leaves it", async () => {
  const user = userEvent.setup();
  render(<Screen html={ARTICLE} />);

  const items = await openList(user);
  await user.click(items[0]!);
  const heading = screen.getByTestId("view").querySelector("h2")!;
  expect(document.activeElement).toBe(heading);

  heading.blur();
  expect(heading.hasAttribute("tabindex")).toBe(false);
});

test("Escape closes the list and returns focus to the strip", async () => {
  const user = userEvent.setup();
  render(<Screen html={ARTICLE} />);

  await openList(user);
  await user.keyboard("{Escape}");

  expect(screen.queryByRole("navigation", { name: "Table of contents" })).toBeNull();
  expect(document.activeElement).toBe(strip());
});

test("Enter on the strip opens the list", async () => {
  const user = userEvent.setup();
  render(<Screen html={ARTICLE} />);

  strip().focus();
  await user.keyboard("{Enter}");
  expect(screen.getByRole("navigation", { name: "Table of contents" })).toBeTruthy();
});

test("a click outside closes the list", async () => {
  const user = userEvent.setup();
  render(<Screen html={ARTICLE} />);

  await openList(user);
  await user.click(screen.getByTestId("view"));
  expect(screen.queryByRole("navigation", { name: "Table of contents" })).toBeNull();
});

test("Enter opens the list with focus on the current item, arrows move between items", async () => {
  const user = userEvent.setup();
  render(<Screen html={ARTICLE} />);

  strip().focus();
  await user.keyboard("{Enter}");
  const nav = screen.getByRole("navigation", { name: "Table of contents" });
  const items = within(nav).getAllByRole("button");
  const current = items.find((item) => item.getAttribute("aria-current") === "location")!;
  expect(document.activeElement).toBe(current);

  await user.keyboard("{Home}");
  expect(document.activeElement).toBe(items[0]);
  await user.keyboard("{ArrowDown}");
  expect(document.activeElement).toBe(items[1]);
  await user.keyboard("{End}");
  expect(document.activeElement).toBe(items[3]);
  await user.keyboard("{ArrowUp}");
  expect(document.activeElement).toBe(items[2]);

  await user.keyboard("{Escape}");
  expect(screen.queryByRole("navigation", { name: "Table of contents" })).toBeNull();
  expect(document.activeElement).toBe(strip());
});

test("hovering the strip opens the list after a delay", async () => {
  vi.useFakeTimers();
  try {
    render(<Screen html={ARTICLE} />);
    await act(async () => {});
    fireEvent.pointerEnter(strip(), { pointerType: "mouse" });
    expect(screen.queryByRole("navigation", { name: "Table of contents" })).toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(250);
    });
    expect(screen.getByRole("navigation", { name: "Table of contents" })).toBeTruthy();
    // Наведение не уводит фокус с места.
    expect(document.activeElement).toBe(document.body);
  } finally {
    vi.useRealTimers();
  }
});

test("the section whose heading passed the top edge is current in the strip and the list", async () => {
  const user = userEvent.setup();
  render(<Screen html={ARTICLE} />);

  // Первые два заголовка ушли выше края окна, третий и четвёртый ниже.
  const tops = [-400, -100, 300, 900];
  const headings = [...screen.getByTestId("view").querySelectorAll("h2, h3, h4")];
  headings.forEach((heading, index) => {
    heading.getBoundingClientRect = () => ({ top: tops[index]! }) as DOMRect;
  });
  Object.defineProperty(document.documentElement, "scrollHeight", {
    value: 5000,
    configurable: true,
  });
  await act(async () => {
    fireEvent.scroll(document);
    await new Promise((resolve) => requestAnimationFrame(resolve));
  });

  const strokes = [...strip().querySelectorAll("[data-toc-stroke]")];
  expect(strokes.map((stroke) => stroke.hasAttribute("data-current"))).toEqual([
    false,
    true,
    false,
    false,
  ]);

  const items = await openList(user);
  expect(items.map((item) => item.getAttribute("aria-current"))).toEqual([
    null,
    "location",
    null,
    null,
  ]);
});

test("a click on the strip keeps the list that hover has opened", async () => {
  const user = userEvent.setup();
  render(<Screen html={ARTICLE} />);

  await openList(user);
  await user.click(strip());
  expect(screen.getByRole("navigation", { name: "Table of contents" })).toBeTruthy();
});

test("the list stays open after a jump and closes once the pointer leaves it", async () => {
  vi.useFakeTimers();
  try {
    render(<Screen html={ARTICLE} />);
    await act(async () => {});
    fireEvent.pointerEnter(strip(), { pointerType: "mouse" });
    await act(async () => {
      vi.advanceTimersByTime(250);
    });
    const nav = screen.getByRole("navigation", { name: "Table of contents" });
    const panel = nav.parentElement!;
    fireEvent.pointerLeave(strip(), { pointerType: "mouse" });
    fireEvent.pointerEnter(panel, { pointerType: "mouse" });

    await act(async () => {
      within(nav).getAllByRole("button")[2]!.click();
    });
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(document.activeElement?.tagName).toBe("H4");
    expect(screen.getByRole("navigation", { name: "Table of contents" })).toBeTruthy();

    fireEvent.pointerLeave(panel, { pointerType: "mouse" });
    await act(async () => {
      vi.advanceTimersByTime(400);
    });
    expect(screen.queryByRole("navigation", { name: "Table of contents" })).toBeNull();
  } finally {
    vi.useRealTimers();
  }
});

test("the strip hides itself when it would overlap the text or leave the window", async () => {
  render(<Screen html={ARTICLE} />);
  const root = strip().closest("div")!;
  expect(root.className).not.toMatch(/\binvisible\b/);

  // Поле слева сузилось: полоса наползает на текст.
  strip().getBoundingClientRect = () => ({ left: 40, right: 70 }) as DOMRect;
  screen.getByTestId("view").getBoundingClientRect = () => ({ left: 60 }) as DOMRect;
  await act(async () => {
    window.dispatchEvent(new Event("resize"));
    await new Promise((resolve) => requestAnimationFrame(resolve));
  });
  expect(root.className).toMatch(/\binvisible\b/);

  // Окно расширили — полоса снова на месте.
  screen.getByTestId("view").getBoundingClientRect = () => ({ left: 120 }) as DOMRect;
  await act(async () => {
    window.dispatchEvent(new Event("resize"));
    await new Promise((resolve) => requestAnimationFrame(resolve));
  });
  expect(root.className).not.toMatch(/\binvisible\b/);
});

test("the list has a fixed width that listWidth changes; long titles are cut with an ellipsis", async () => {
  const user = userEvent.setup();
  const long = "A heading so long that it can never fit into the list of the table of contents";
  function Wide() {
    const view = useRef<HTMLDivElement>(null);
    return (
      <div>
        <RichTextToc target={view} listWidth="20rem" />
        <RichTextView ref={view} html={`<h2>${long}</h2><h2>Short</h2>`} />
      </div>
    );
  }
  render(<Wide />);

  const [first] = await openList(user);
  const panel = screen.getByRole("navigation", { name: "Table of contents" }).parentElement!;
  expect(panel.style.width).toBe("20rem");
  const title = first!.querySelector("[title]")!;
  expect(title.getAttribute("title")).toBe(long);
  expect(title.className).toMatch(/\btruncate\b/);
});

test("the list is 240px wide by default", async () => {
  const user = userEvent.setup();
  render(<Screen html={ARTICLE} />);
  await openList(user);
  const panel = screen.getByRole("navigation", { name: "Table of contents" }).parentElement!;
  expect(panel.style.width).toBe("240px");
});
