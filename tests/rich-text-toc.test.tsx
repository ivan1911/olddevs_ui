// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { createRef, useRef } from "react";
import { afterEach, beforeAll, beforeEach, expect, test, vi } from "vitest";
import {
  RichTextEditor,
  RichTextToc,
  RichTextView,
  type RichTextEditorHandle,
} from "../src/editor/index.js";
import { loadLazyBuiltins } from "./editor-lazy-builtins.js";

/**
 * Оглавление Документа (OLDSUI-264, ADR-0066). Проверки идут через публичную
 * пару компонентов: экран ставит `RichTextToc` рядом с `RichTextView` и отдаёт
 * ему ref Просмотра — ровно так, как это сделает потребитель.
 */

// Ленивые встроенные Редактора (OLDSUI-111): после загрузки чанков движок создаётся прямо в `render`.
beforeAll(loadLazyBuiltins);

beforeEach(() => {
  // В jsdom прокрутки нет: переход проверяется по фокусу, а вызов только
  // не должен падать.
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

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

test("levels leaves only those levels in the strip and the list; the indent counts from the largest left", async () => {
  const user = userEvent.setup();
  function Narrow() {
    const view = useRef<HTMLDivElement>(null);
    return (
      <div>
        <RichTextToc target={view} levels={[3, 4]} />
        <RichTextView ref={view} html={ARTICLE} />
      </div>
    );
  }
  render(<Narrow />);

  expect(strip().querySelectorAll("[data-toc-stroke]")).toHaveLength(2);
  const items = await openList(user);
  expect(items.map((item) => item.textContent)).toEqual(["How to read", "Neutrals"]);
  // H3 теперь самый крупный: глубина считается от него.
  expect(items.map((item) => item.getAttribute("data-depth"))).toEqual(["0", "1"]);
});

test("without levels every level is listed, and a change of levels rebuilds the list", async () => {
  const user = userEvent.setup();
  function Switch({ levels }: { levels?: readonly (1 | 2 | 3 | 4)[] }) {
    const view = useRef<HTMLDivElement>(null);
    return (
      <div>
        <RichTextToc target={view} levels={levels} />
        <RichTextView ref={view} html={ARTICLE} />
      </div>
    );
  }
  const { rerender } = render(<Switch />);
  expect(strip().querySelectorAll("[data-toc-stroke]")).toHaveLength(4);

  rerender(<Switch levels={[2]} />);
  await waitFor(() => expect(strip().querySelectorAll("[data-toc-stroke]")).toHaveLength(2));
  expect((await openList(user)).map((item) => item.textContent)).toEqual([
    "Palette",
    "What's next",
  ]);
});

test("the list is 240px wide by default", async () => {
  const user = userEvent.setup();
  render(<Screen html={ARTICLE} />);
  await openList(user);
  const panel = screen.getByRole("navigation", { name: "Table of contents" }).parentElement!;
  expect(panel.style.width).toBe("240px");
});

test("the heading of a jump flashes a background that fades out, leaving no trace in the Document", async () => {
  const user = userEvent.setup();
  const animate = vi.fn();
  Element.prototype.animate = animate;
  try {
    render(<Screen html={ARTICLE} />);
    const items = await openList(user);
    await user.click(items[1]!);

    const heading = screen.getByTestId("view").querySelector("h3")!;
    expect(animate).toHaveBeenCalledTimes(1);
    expect(animate.mock.contexts[0]).toBe(heading);
    const [keyframes] = animate.mock.calls[0]!;
    expect(keyframes[0].backgroundColor).toBeTruthy();
    expect(keyframes.at(-1).backgroundColor).toBe("transparent");
    // Ни класса, ни стиля в разметке Документа: подсветка живёт в анимации.
    expect(heading.getAttribute("class")).toBeNull();
    expect(heading.getAttribute("style")).toBeNull();
  } finally {
    Reflect.deleteProperty(Element.prototype, "animate");
  }
});

const strokes = () => strip().querySelectorAll("[data-toc-stroke]").length;

test("the list is rebuilt when the View gets a new html, in both directions", async () => {
  const view = render(<Screen html="<h2>Only one</h2><p>Text</p>" />);
  expect(screen.queryByRole("button", { name: "Table of contents" })).toBeNull();

  // Второй заголовок пришёл — полоса появилась.
  view.rerender(<Screen html="<h2>Only one</h2><h3>Second</h3><p>Text</p>" />);
  await waitFor(() => expect(strokes()).toBe(2));

  view.rerender(<Screen html={ARTICLE} />);
  await waitFor(() => expect(strokes()).toBe(4));

  // Остался один — полоса исчезла.
  view.rerender(<Screen html="<h2>Only one</h2>" />);
  await waitFor(() =>
    expect(screen.queryByRole("button", { name: "Table of contents" })).toBeNull()
  );
});

test("a burst of changes is rebuilt once, after a pause", async () => {
  vi.useFakeTimers();
  try {
    const view = render(<Screen html={ARTICLE} />);
    await act(async () => {});
    expect(strokes()).toBe(4);

    view.rerender(<Screen html="<h2>A</h2><h2>B</h2>" />);
    // Наблюдатель DOM отвечает микрозадачей — дать ему отработать до таймера.
    await act(async () => {});
    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    // Пауза ещё не прошла: список прежний.
    expect(strokes()).toBe(4);

    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    expect(strokes()).toBe(2);
  } finally {
    vi.useRealTimers();
  }
});

test("the jump itself does not rebuild the list", async () => {
  const user = userEvent.setup();
  render(<Screen html={ARTICLE} />);

  const items = await openList(user);
  await user.click(items[2]!);
  const heading = screen.getByTestId("view").querySelector("h4")!;
  expect(heading.getAttribute("tabindex")).toBe("-1");

  // Метка `tabindex` ставится и снимается на переходе; пересборка по ней
  // подменила бы узлы пунктов и сбросила бы фокус в списке.
  await new Promise((resolve) => setTimeout(resolve, 300));
  expect(document.activeElement).toBe(heading);
  expect(
    screen.getByRole("navigation", { name: "Table of contents" }).querySelectorAll("button")
  ).toHaveLength(4);
});

// --- Редактор как цель -------------------------------------------------------

function EditorScreen({
  html,
  readOnly,
  handle,
}: {
  html: string;
  readOnly?: boolean;
  handle?: React.RefObject<RichTextEditorHandle | null>;
}) {
  const own = useRef<RichTextEditorHandle>(null);
  const editor = handle ?? own;
  return (
    <div>
      <RichTextToc target={editor} />
      <RichTextEditor ref={editor} aria-label="Body" defaultValue={html} readOnly={readOnly} />
    </div>
  );
}

test("a read-only Editor lists its headings like a View does", async () => {
  const user = userEvent.setup();
  render(<EditorScreen html={ARTICLE} readOnly />);

  expect(strokes()).toBe(4);
  const items = await openList(user);
  expect(items.map((item) => item.textContent)).toEqual([
    "Palette",
    "How to read",
    "Neutrals",
    "What's next",
  ]);

  await user.click(items[2]!);
  const heading = screen.getByRole("textbox", { name: "Body" }).querySelector("h4")!;
  expect(document.activeElement).toBe(heading);
  expect(heading.scrollIntoView).toHaveBeenCalled();
});

test("the list is rebuilt after the Editor content is replaced from outside", async () => {
  const handle = createRef<RichTextEditorHandle>();
  render(<EditorScreen html="<h2>Only one</h2><p>Text</p>" handle={handle} />);
  expect(screen.queryByRole("button", { name: "Table of contents" })).toBeNull();

  act(() => {
    handle.current!.editor!.commands.setContent(ARTICLE);
  });
  await waitFor(() => expect(strokes()).toBe(4));
});

test("editing an editable Editor rebuilds the list, a new heading and a changed text alike", async () => {
  const user = userEvent.setup();
  const handle = createRef<RichTextEditorHandle>();
  render(<EditorScreen html="<h2>First</h2><p>Text</p>" handle={handle} />);
  expect(screen.queryByRole("button", { name: "Table of contents" })).toBeNull();

  act(() => {
    handle.current!.insertHTML("<h3>Second</h3>");
  });
  await waitFor(() => expect(strokes()).toBe(2));

  const items = await openList(user);
  expect(items.map((item) => item.textContent)).toEqual(["Second", "First"]);

  // Набор внутри заголовка — меняется пункт, а число штрихов остаётся.
  act(() => {
    handle.current!.editor!.commands.insertContentAt(1, "New ");
  });
  await waitFor(() =>
    expect(
      within(screen.getByRole("navigation", { name: "Table of contents" }))
        .getAllByRole("button")
        .map((item) => item.textContent)
    ).toEqual(["New Second", "First"])
  );
});

test("a jump in an editable Editor leaves the selection where it was", async () => {
  const user = userEvent.setup();
  const handle = createRef<RichTextEditorHandle>();
  render(<EditorScreen html={ARTICLE} handle={handle} />);

  const editor = handle.current!.editor!;
  act(() => void editor.commands.setTextSelection(10));
  const before = editor.state.selection.toJSON();

  const items = await openList(user);
  await user.click(items[3]!);

  const heading = screen.getByRole("textbox", { name: "Body" }).querySelectorAll("h2")[1]!;
  // Каретка осталась в Документе, а заголовок не обзавёлся меткой фокуса.
  expect(heading.hasAttribute("tabindex")).toBe(false);
  expect(heading.scrollIntoView).toHaveBeenCalled();
  expect(editor.state.selection.toJSON()).toEqual(before);
  expect(editor.getHTML()).not.toContain("tabindex");
});

// --- Длинный Документ --------------------------------------------------------

const longArticle = (count: number) =>
  Array.from(
    { length: count },
    (_, index) => `<h${(index % 3) + 2}>Section ${index}</h${(index % 3) + 2}><p>Text</p>`
  ).join("");

test("the strip gap shrinks so that a long Document fits the window", async () => {
  const height = window.innerHeight;
  try {
    window.innerHeight = 300;
    const view = render(<Screen html={longArticle(8)} />);
    // Мало заголовков — обычный шаг.
    expect(strip().style.rowGap).toBe("6px");

    view.rerender(<Screen html={longArticle(60)} />);
    await waitFor(() => expect(strokes()).toBe(60));
    const gap = parseFloat(strip().style.rowGap);
    expect(gap).toBeGreaterThan(0);
    expect(gap).toBeLessThan(6);

    // Совсем много — шаг не уходит ниже нуля, штрих остаётся на каждый заголовок.
    view.rerender(<Screen html={longArticle(150)} />);
    await waitFor(() => expect(strokes()).toBe(150));
    expect(parseFloat(strip().style.rowGap)).toBe(0);

    // Окно выросло — шаг вернулся.
    window.innerHeight = 2000;
    await act(async () => {
      window.dispatchEvent(new Event("resize"));
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });
    expect(strip().style.rowGap).toBe("6px");
  } finally {
    window.innerHeight = height;
  }
});

test("the opened list of a long Document scrolls to the current item", async () => {
  const user = userEvent.setup();
  render(<Screen html={longArticle(40)} />);

  // Двадцать пять заголовков ушли выше края окна — текущий двадцать пятый.
  const headings = [...screen.getByTestId("view").querySelectorAll("h2, h3, h4")];
  headings.forEach((heading, index) => {
    heading.getBoundingClientRect = () => ({ top: (index - 24) * 100 }) as DOMRect;
  });
  Object.defineProperty(document.documentElement, "scrollHeight", {
    value: 90000,
    configurable: true,
  });
  await act(async () => {
    fireEvent.scroll(document);
    await new Promise((resolve) => requestAnimationFrame(resolve));
  });

  // Строки списка по 22px, видимая часть списка — 300px: двадцать пятый пункт
  // ниже её края.
  const original = HTMLElement.prototype.getBoundingClientRect;
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
    this: HTMLElement
  ) {
    const row = this.closest("li");
    if (this.tagName === "BUTTON" && row) {
      const index = [...row.parentElement!.children].indexOf(row);
      const top = index * 22 - (row.closest("nav")!.parentElement!.scrollTop ?? 0);
      return { top, bottom: top + 22 } as DOMRect;
    }
    if (this.querySelector(":scope > nav")) return { top: 0, bottom: 300 } as DOMRect;
    return original.call(this);
  });

  const items = await openList(user);
  expect(items[24]!.getAttribute("aria-current")).toBe("location");
  const box = items[24]!.closest("nav")!.parentElement!;
  // Прокручен ровно сам список, чтобы пункт встал к его нижнему краю.
  expect(box.scrollTop).toBe(25 * 22 - 300);
  // Страницу (scrollIntoView предков) Оглавление не двигает.
  expect(vi.mocked(Element.prototype.scrollIntoView)).not.toHaveBeenCalled();
});

test("a screen reader click without a key (detail 0) opens the list and moves focus into it", async () => {
  render(<Screen html={ARTICLE} />);
  await act(async () => {
    fireEvent.click(strip(), { detail: 0 });
  });
  const nav = screen.getByRole("navigation", { name: "Table of contents" });
  expect(nav.contains(document.activeElement)).toBe(true);
});

test("empty headings are not items", async () => {
  const user = userEvent.setup();
  render(<Screen html="<h2>One</h2><h2> </h2><h3></h3><h2>Two</h2>" />);
  const items = await openList(user);
  expect(items.map((item) => item.textContent)).toEqual(["One", "Two"]);
});

test("scrolling the list itself neither recomputes the highlight nor drops the jumped section", async () => {
  const user = userEvent.setup();
  render(<Screen html={ARTICLE} />);
  Object.defineProperty(document.documentElement, "scrollHeight", {
    value: 600,
    configurable: true,
  });
  const headings = [...screen.getByTestId("view").querySelectorAll("h2, h3, h4")];
  [-50, 100, 200, 300].forEach((top, index) => {
    headings[index]!.getBoundingClientRect = () => ({ top }) as DOMRect;
  });
  const items = await openList(user);
  await user.click(items[1]!);
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 200));
  });
  // Колесо над списком: прокручивается он, а не Документ.
  const list = screen.getByRole("navigation", { name: "Table of contents" }).parentElement!;
  await act(async () => {
    fireEvent.scroll(list);
    await new Promise((resolve) => requestAnimationFrame(resolve));
  });
  expect(items[1]!.getAttribute("aria-current")).toBe("location");
});

test("the section chosen by a jump stays current while the jump scrolls, even at the end of the Document", async () => {
  const user = userEvent.setup();
  render(<Screen html={ARTICLE} />);

  // Документ докручен до конца, все заголовки в окне: правило конца отдало бы
  // подсветку последнему.
  Object.defineProperty(document.documentElement, "scrollHeight", {
    value: 600,
    configurable: true,
  });
  const headings = [...screen.getByTestId("view").querySelectorAll("h2, h3, h4")];
  [-50, 100, 200, 300].forEach((top, index) => {
    headings[index]!.getBoundingClientRect = () => ({ top }) as DOMRect;
  });
  const scroll = () =>
    act(async () => {
      fireEvent.scroll(document);
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });
  await scroll();
  const items = await openList(user);
  expect(items[3]!.getAttribute("aria-current")).toBe("location");

  await user.click(items[1]!);
  expect(items[1]!.getAttribute("aria-current")).toBe("location");
  // Прокрутка от самого перехода подсветку не трогает.
  await scroll();
  await scroll();
  expect(items[1]!.getAttribute("aria-current")).toBe("location");

  // Переход улёгся, читатель прокрутил сам — подсветка снова считается.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 200));
  });
  await scroll();
  expect(items[3]!.getAttribute("aria-current")).toBe("location");
});

test("after a mouse jump in an editable Editor the list does not hold focus, so leaving it closes it", async () => {
  const user = userEvent.setup();
  function Editable() {
    const editor = useRef<RichTextEditorHandle>(null);
    return (
      <div>
        <RichTextToc target={editor} />
        <RichTextEditor ref={editor} aria-label="Body" defaultValue={ARTICLE} />
      </div>
    );
  }
  render(<Editable />);
  await waitFor(() => expect(strip()).toBeTruthy());

  const items = await openList(user);
  await user.click(items[2]!);
  const nav = screen.getByRole("navigation", { name: "Table of contents" });
  expect(nav.contains(document.activeElement)).toBe(false);
});

// --- Переход без шапки (OLDSUI-275) -------------------------------------------

/** Документ в своей прокручиваемой области; шапка (`--topbar-h`) не задана. */
function ScrollBoxScreen() {
  const view = useRef<HTMLDivElement>(null);
  return (
    <div>
      <RichTextToc target={view} />
      <div data-testid="box" style={{ overflowY: "auto", maxHeight: 320 }}>
        <RichTextView ref={view} html={ARTICLE} data-testid="view" />
      </div>
    </div>
  );
}

test("without a sticky header a jump scrolls the nearest scrollable box and leaves the window alone", async () => {
  const user = userEvent.setup();
  const windowScroll = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  render(<ScrollBoxScreen />);

  const box = screen.getByTestId("box");
  Object.defineProperty(box, "scrollHeight", { value: 2000, configurable: true });
  Object.defineProperty(box, "clientHeight", { value: 320, configurable: true });
  box.scrollTo = vi.fn();
  box.getBoundingClientRect = () => ({ top: 100 }) as DOMRect;
  const heading = screen.getByTestId("view").querySelector("h4")!;
  heading.getBoundingClientRect = () => ({ top: 500 }) as DOMRect;

  const items = await openList(user);
  await user.click(items[2]!);

  // Заголовок на 400 px ниже верха области; область была прокручена на 0.
  expect(box.scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 400 }));
  expect(windowScroll).not.toHaveBeenCalled();
  expect(heading.scrollIntoView).not.toHaveBeenCalled();
});

test("without a sticky header the heading stops below its scroll-margin-top inside the box", async () => {
  const user = userEvent.setup();
  render(<ScrollBoxScreen />);

  const box = screen.getByTestId("box");
  Object.defineProperty(box, "scrollHeight", { value: 2000, configurable: true });
  Object.defineProperty(box, "clientHeight", { value: 320, configurable: true });
  Object.defineProperty(box, "scrollTop", { value: 50, configurable: true });
  box.scrollTo = vi.fn();
  box.getBoundingClientRect = () => ({ top: 100 }) as DOMRect;
  const heading = screen.getByTestId("view").querySelector("h4")!;
  heading.style.scrollMarginTop = "24px";
  heading.getBoundingClientRect = () => ({ top: 500 }) as DOMRect;

  const items = await openList(user);
  await user.click(items[2]!);

  expect(box.scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 50 + 400 - 24 }));
});

test("without a sticky header and without a scrollable box the window scrolls to the heading, honoring scroll-margin-top", async () => {
  const user = userEvent.setup();
  const windowScroll = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  render(<Screen html={ARTICLE} />);

  const items = await openList(user);
  await user.click(items[2]!);

  // Отступ учитывает сам браузер: `scrollIntoView` читает `scroll-margin-top`.
  const heading = screen.getByTestId("view").querySelector("h4")!;
  expect(heading.scrollIntoView).toHaveBeenCalledWith(expect.objectContaining({ block: "start" }));
  expect(windowScroll).not.toHaveBeenCalled();
});
