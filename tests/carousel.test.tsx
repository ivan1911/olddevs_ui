// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { createRef, useState } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { Carousel } from "../src/index.js";

/**
 * Лента слайдов: имена, кнопки, края, `onIndexChange`, режимы.
 *
 * jsdom раскладки не считает и `scrollTo` у элементов не знает, поэтому
 * положение подменяется ровно теми тремя числами, которые читает компонент:
 * `scrollLeft`, `scrollWidth`, `clientWidth`. Привязку к слайду, жест и
 * вычисленную ширину слайда на брейкпойнтах jsdom проверить не может — их
 * меряет браузер (ручная проверка витрины), а попадание каждого класса ширины в
 * CSS стережёт `tests/class-coverage.test.ts` через матрицу.
 */

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** Ширина слайда и число слайдов в подменённой раскладке. */
const SLIDE = 300;

interface Layout {
  scrollLeft: number;
  scrollWidth: number;
  clientWidth: number;
}

let layout: Layout;
let scrollTo: ReturnType<typeof vi.fn>;
/** Мгновенная ли прокрутка в подмене: `false` — как плавная, положение стоит, пока тест его не сдвинет. */
let jumps: boolean;

/** Лента из `count` слайдов шириной `SLIDE`, в кадре — `perView`. */
function setLayout(count: number, perView = 1) {
  layout = { scrollLeft: 0, scrollWidth: count * SLIDE, clientWidth: perView * SLIDE };
}

beforeEach(() => {
  jumps = true;
  setLayout(5);
  scrollTo = vi.fn((options: ScrollToOptions) => {
    if (jumps) layout.scrollLeft = options.left ?? 0;
  });
  Object.defineProperty(HTMLElement.prototype, "scrollWidth", {
    configurable: true,
    get: () => layout.scrollWidth,
  });
  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true,
    get: () => layout.clientWidth,
  });
  Object.defineProperty(HTMLElement.prototype, "scrollLeft", {
    configurable: true,
    get: () => layout.scrollLeft,
    set: (value: number) => {
      layout.scrollLeft = value;
    },
  });
  Object.defineProperty(HTMLElement.prototype, "scrollTo", {
    configurable: true,
    value: scrollTo,
  });
});

/** Лента — родитель слайдов: у неё нет роли, и потребителю она не нужна. */
const viewport = () => screen.getAllByRole("group")[0]!.parentElement!;

/** Пользователь отпустил ленту на положении `left`: событие прокрутки с новым смещением. */
function scrollLeftTo(left: number) {
  layout.scrollLeft = left;
  fireEvent.scroll(viewport());
}

const slides = (count: number) =>
  Array.from({ length: count }, (_, i) => <div key={i}>Slide {i + 1}</div>);

describe("accessible structure", () => {
  test("the region is a named carousel", () => {
    render(<Carousel aria-label="Featured">{slides(3)}</Carousel>);

    const region = screen.getByRole("region", { name: "Featured" });
    expect(region.getAttribute("aria-roledescription")).toBe("carousel");
  });

  test("aria-labelledby names the region by a visible heading", () => {
    render(
      <>
        <h2 id="featured-heading">Featured</h2>
        <Carousel aria-labelledby="featured-heading">{slides(3)}</Carousel>
      </>
    );

    expect(screen.getByRole("region", { name: "Featured" })).toBeTruthy();
  });

  test("the name is one of aria-label and aria-labelledby, and label is not a prop", () => {
    // Типы — часть контракта: без имени регион звучит как безымянная «карусель»,
    // а два источника имени при правке расходятся молча.
    // @ts-expect-error — имени нет
    render(<Carousel>{slides(1)}</Carousel>);
    cleanup();
    render(
      // @ts-expect-error — оба источника имени сразу
      <Carousel aria-label="A" aria-labelledby="b">
        {slides(1)}
      </Carousel>
    );
    cleanup();
    // @ts-expect-error — `label` в ките значит видимую подпись, а у карусели её нет
    render(<Carousel label="Featured">{slides(1)}</Carousel>);
    expect(screen.queryByRole("region", { name: "Featured" })).toBeNull();
  });

  test("every slide is a group named by its position, and empty children are not slides", () => {
    render(
      <Carousel aria-label="Featured">
        {slides(3)}
        {null}
        {false}
        {""}
      </Carousel>
    );

    const groups = screen.getAllByRole("group");
    expect(groups.map((g) => g.getAttribute("aria-label"))).toEqual(["1 of 3", "2 of 3", "3 of 3"]);
    for (const group of groups) expect(group.getAttribute("aria-roledescription")).toBe("slide");
  });

  test("slide content stays readable: slides outside the frame are not hidden", () => {
    render(<Carousel aria-label="Featured">{slides(3)}</Carousel>);

    // Автопрокрутки нет, и лента читается целиком — скрыть невидимые слайды
    // значило бы спрятать от скринридера то, что он обязан найти.
    expect(screen.getByText("Slide 3")).toBeTruthy();
    for (const group of screen.getAllByRole("group")) {
      expect(group.closest("[aria-hidden='true']")).toBeNull();
    }
  });
});

describe("buttons", () => {
  test("at the start only 'next' is enabled", () => {
    render(<Carousel aria-label="Featured">{slides(3)}</Carousel>);

    expect(screen.getByRole("button", { name: "Previous slide" }).hasAttribute("disabled")).toBe(
      true
    );
    expect(screen.getByRole("button", { name: "Next slide" }).hasAttribute("disabled")).toBe(false);
  });

  test("'next' scrolls to the next slide smoothly", async () => {
    setLayout(3);
    const user = userEvent.setup();
    render(<Carousel aria-label="Featured">{slides(3)}</Carousel>);

    await user.click(screen.getByRole("button", { name: "Next slide" }));

    expect(scrollTo).toHaveBeenCalledWith({ left: SLIDE, behavior: "smooth" });
  });

  test("with prefers-reduced-motion the same scroll is instant", async () => {
    setLayout(3);
    vi.stubGlobal(
      "matchMedia",
      (query: string) => ({ matches: query.includes("reduce"), media: query }) as MediaQueryList
    );
    const user = userEvent.setup();
    render(<Carousel aria-label="Featured">{slides(3)}</Carousel>);

    await user.click(screen.getByRole("button", { name: "Next slide" }));

    expect(scrollTo).toHaveBeenCalledWith({ left: SLIDE, behavior: "auto" });
  });

  test("'previous' goes back one slide", async () => {
    const user = userEvent.setup();
    render(
      <Carousel aria-label="Featured" defaultIndex={2}>
        {slides(5)}
      </Carousel>
    );
    scrollTo.mockClear();

    await user.click(screen.getByRole("button", { name: "Previous slide" }));

    expect(scrollTo).toHaveBeenCalledWith({ left: SLIDE, behavior: "smooth" });
  });

  test("fast clicks accumulate from the target of the scroll in flight, not from where it started", () => {
    // Плавная прокрутка не успела сдвинуться: положение стоит на нуле.
    // Клики синхронные: между ними не проходит и миллисекунды, и таймер остановки не вмешивается.
    jumps = false;
    render(<Carousel aria-label="Featured">{slides(5)}</Carousel>);
    const next = screen.getByRole("button", { name: "Next slide" });

    fireEvent.click(next);
    fireEvent.click(next);

    expect(scrollTo).toHaveBeenNthCalledWith(1, { left: SLIDE, behavior: "smooth" });
    expect(scrollTo).toHaveBeenNthCalledWith(2, { left: 2 * SLIDE, behavior: "smooth" });
  });

  test("reaching the end disables 'next' and enables 'previous'", () => {
    setLayout(3);
    render(<Carousel aria-label="Featured">{slides(3)}</Carousel>);

    scrollLeftTo(2 * SLIDE);

    expect(screen.getByRole("button", { name: "Next slide" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "Previous slide" }).hasAttribute("disabled")).toBe(
      false
    );
  });

  test("the edge is where the last slide ends, however many slides are in the frame", () => {
    setLayout(5, 2);
    render(
      <Carousel aria-label="Featured" slidesPerView={2}>
        {slides(5)}
      </Carousel>
    );
    const next = screen.getByRole("button", { name: "Next slide" });

    scrollLeftTo(2 * SLIDE);
    expect(next.hasAttribute("disabled")).toBe(false);

    // Дальше слайда 3 лента не едет: в кадре слайды 4 и 5.
    scrollLeftTo(3 * SLIDE);
    expect(next.hasAttribute("disabled")).toBe(true);
  });

  test("a new slidesPerView recomputes the edges without a scroll or a resize of the strip", () => {
    setLayout(3, 1);
    const { rerender } = render(
      <Carousel aria-label="Featured" slidesPerView={1}>
        {slides(3)}
      </Carousel>
    );
    const next = screen.getByRole("button", { name: "Next slide" });
    expect(next.hasAttribute("disabled")).toBe(false);

    // Ширина ленты прежняя, поэтому `ResizeObserver` молчит; меняется ширина
    // слайдов, и все три теперь в кадре.
    setLayout(3, 3);
    rerender(
      <Carousel aria-label="Featured" slidesPerView={3}>
        {slides(3)}
      </Carousel>
    );
    expect(next.hasAttribute("disabled")).toBe(true);
  });

  test("when everything fits in the frame there is nowhere to go and both buttons are off", () => {
    setLayout(2, 2);
    render(
      <Carousel aria-label="Featured" slidesPerView={2}>
        {slides(2)}
      </Carousel>
    );

    expect(screen.getByRole("button", { name: "Previous slide" }).hasAttribute("disabled")).toBe(
      true
    );
    expect(screen.getByRole("button", { name: "Next slide" }).hasAttribute("disabled")).toBe(true);
  });

  test("a button that becomes disabled at the edge hands its focus to the other one", async () => {
    setLayout(3);
    const user = userEvent.setup();
    render(<Carousel aria-label="Featured">{slides(3)}</Carousel>);
    const next = screen.getByRole("button", { name: "Next slide" });
    next.focus();

    // Последний шаг вперёд: кнопка выключается, пока на ней фокус.
    await user.keyboard("{Enter}");
    scrollLeftTo(2 * SLIDE);

    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Previous slide" }));
  });
});

describe("onIndexChange", () => {
  test("reports the slide the manual scroll stopped on, once, not every frame", async () => {
    const onIndexChange = vi.fn();
    render(
      <Carousel aria-label="Featured" onIndexChange={onIndexChange}>
        {slides(5)}
      </Carousel>
    );

    // Лента проехала слайды 1 и 2 без остановки и встала на третьем.
    scrollLeftTo(SLIDE);
    scrollLeftTo(2 * SLIDE);
    expect(onIndexChange).not.toHaveBeenCalled();

    await waitFor(() => expect(onIndexChange).toHaveBeenCalledTimes(1));
    expect(onIndexChange).toHaveBeenCalledWith(2);
  });

  test("a scroll that stops half-way reports the nearest slide", async () => {
    const onIndexChange = vi.fn();
    render(
      <Carousel aria-label="Featured" onIndexChange={onIndexChange}>
        {slides(5)}
      </Carousel>
    );

    scrollLeftTo(SLIDE * 1.4);

    await waitFor(() => expect(onIndexChange).toHaveBeenCalledWith(1));
  });

  test("the buttons report the new slide once the scroll has settled", async () => {
    const onIndexChange = vi.fn();
    const user = userEvent.setup();
    render(
      <Carousel aria-label="Featured" onIndexChange={onIndexChange}>
        {slides(5)}
      </Carousel>
    );

    await user.click(screen.getByRole("button", { name: "Next slide" }));
    // Подмена прокручивает мгновенно, событие прокрутки браузера — следом.
    fireEvent.scroll(viewport());

    await waitFor(() => expect(onIndexChange).toHaveBeenCalledWith(1));
  });

  test("with several slides in the frame the index is the leftmost visible one", async () => {
    setLayout(5, 3);
    const onIndexChange = vi.fn();
    render(
      <Carousel aria-label="Featured" slidesPerView={3} onIndexChange={onIndexChange}>
        {slides(5)}
      </Carousel>
    );

    scrollLeftTo(2 * SLIDE);

    await waitFor(() => expect(onIndexChange).toHaveBeenCalledWith(2));
  });

  test("does not report a scroll that ends on the slide already known", async () => {
    const onIndexChange = vi.fn();
    render(
      <Carousel aria-label="Featured" onIndexChange={onIndexChange}>
        {slides(5)}
      </Carousel>
    );

    // Дрогнула на пару пикселей и вернулась.
    scrollLeftTo(12);
    scrollLeftTo(0);
    await act(() => new Promise((resolve) => setTimeout(resolve, 200)));

    expect(onIndexChange).not.toHaveBeenCalled();
  });
});

describe("controlled and uncontrolled modes", () => {
  test("defaultIndex opens the carousel on that slide without animation and without a callback", async () => {
    const onIndexChange = vi.fn();
    render(
      <Carousel aria-label="Featured" defaultIndex={3} onIndexChange={onIndexChange}>
        {slides(5)}
      </Carousel>
    );

    expect(scrollTo).toHaveBeenCalledWith({ left: 3 * SLIDE, behavior: "instant" });
    fireEvent.scroll(viewport());
    await act(() => new Promise((resolve) => setTimeout(resolve, 200)));
    expect(onIndexChange).not.toHaveBeenCalled();
  });

  test("a changed index scrolls to that slide and does not echo back through onIndexChange", async () => {
    const onIndexChange = vi.fn();
    function Controlled() {
      const [index, setIndex] = useState(0);
      return (
        <>
          <button onClick={() => setIndex(3)}>Go to 4</button>
          <Carousel
            aria-label="Featured"
            index={index}
            onIndexChange={(next) => {
              onIndexChange(next);
              setIndex(next);
            }}
          >
            {slides(5)}
          </Carousel>
        </>
      );
    }
    const user = userEvent.setup();
    render(<Controlled />);

    await user.click(screen.getByRole("button", { name: "Go to 4" }));
    expect(scrollTo).toHaveBeenCalledWith({ left: 3 * SLIDE, behavior: "smooth" });

    fireEvent.scroll(viewport());
    await act(() => new Promise((resolve) => setTimeout(resolve, 200)));
    expect(onIndexChange).not.toHaveBeenCalled();
  });

  test("a manual scroll in controlled mode asks the parent, which moves the index", async () => {
    const seen: number[] = [];
    function Controlled() {
      const [index, setIndex] = useState(0);
      return (
        <>
          <output data-testid="index">{index}</output>
          <Carousel
            aria-label="Featured"
            index={index}
            onIndexChange={(next) => {
              seen.push(next);
              setIndex(next);
            }}
          >
            {slides(5)}
          </Carousel>
        </>
      );
    }
    render(<Controlled />);

    scrollLeftTo(SLIDE);

    await waitFor(() => expect(screen.getByTestId("index").textContent).toBe("1"));
    expect(seen).toEqual([1]);
    // Родитель принял индекс, который лента уже показывает: второй прокрутки нет.
    expect(scrollTo).not.toHaveBeenCalled();
  });

  test("mounted hidden (display: none), it opens on defaultIndex once it gets a size", async () => {
    const observers: ResizeObserverCallback[] = [];
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: ResizeObserverCallback) {
          observers.push(callback);
        }
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    );
    // Скрытый контейнер — вкладка, окно до анимации, `display: none`: раскладки нет.
    layout = { scrollLeft: 0, scrollWidth: 0, clientWidth: 0 };
    const onIndexChange = vi.fn();
    render(
      <Carousel aria-label="Featured" defaultIndex={3} onIndexChange={onIndexChange}>
        {slides(5)}
      </Carousel>
    );
    expect(scrollTo).not.toHaveBeenCalled();

    setLayout(5);
    act(() => {
      for (const callback of observers) callback([], {} as ResizeObserver);
    });

    expect(scrollTo).toHaveBeenCalledWith({ left: 3 * SLIDE, behavior: "instant" });
    fireEvent.scroll(viewport());
    await act(() => new Promise((resolve) => setTimeout(resolve, 200)));
    expect(onIndexChange).not.toHaveBeenCalled();
  });

  test("hidden after mount and shown again, it comes back to its slide, not the first", () => {
    const observers: ResizeObserverCallback[] = [];
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: ResizeObserverCallback) {
          observers.push(callback);
        }
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    );
    const resize = () =>
      act(() => {
        for (const callback of observers) callback([], {} as ResizeObserver);
      });
    render(
      <Carousel aria-label="Featured" defaultIndex={2}>
        {slides(5)}
      </Carousel>
    );
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 2 * SLIDE, behavior: "instant" });
    scrollTo.mockClear();

    // `display: none` убирает раскладку и сбрасывает прокрутку в ноль.
    layout = { scrollLeft: 0, scrollWidth: 0, clientWidth: 0 };
    resize();
    setLayout(5);
    resize();

    expect(scrollTo).toHaveBeenCalledWith({ left: 2 * SLIDE, behavior: "instant" });
  });

  test("an index past the reachable end settles on the last reachable slide, with no callback", async () => {
    setLayout(5, 3);
    const onIndexChange = vi.fn();
    render(
      <Carousel aria-label="Featured" slidesPerView={3} index={4} onIndexChange={onIndexChange}>
        {slides(5)}
      </Carousel>
    );

    // Слайд 4 недостижим при трёх в кадре: лента встаёт на 2, а не едет в пустоту.
    expect(scrollTo).toHaveBeenCalledWith({ left: 2 * SLIDE, behavior: "instant" });
    // Остановка на 2 — результат нашей же прокрутки, а не жест пользователя.
    fireEvent.scroll(viewport());
    await act(() => new Promise((resolve) => setTimeout(resolve, 200)));
    expect(onIndexChange).not.toHaveBeenCalled();
  });

  test("a parent that rejects the change gets the strip back on its index", async () => {
    const onIndexChange = vi.fn();
    render(
      <Carousel aria-label="Featured" index={0} onIndexChange={onIndexChange}>
        {slides(5)}
      </Carousel>
    );

    // Пользователь пролистал на третий слайд, а родитель индекс не меняет.
    scrollLeftTo(2 * SLIDE);

    await waitFor(() => expect(onIndexChange).toHaveBeenCalledWith(2));
    await waitFor(() => expect(scrollTo).toHaveBeenCalledWith({ left: 0, behavior: "smooth" }));
  });
});

describe("component contract", () => {
  test("passes className and data attributes to the region", () => {
    render(
      <Carousel aria-label="Featured" data-testid="carousel" className="max-w-md">
        {slides(2)}
      </Carousel>
    );

    const region = screen.getByTestId("carousel");
    expect(region.className).toContain("max-w-md");
    expect(region.tagName).toBe("SECTION");
  });

  test("forwards a ref to the region", () => {
    const ref = createRef<HTMLElement>();
    render(
      <Carousel ref={ref} aria-label="Featured">
        {slides(2)}
      </Carousel>
    );

    expect(ref.current).toBe(screen.getByRole("region", { name: "Featured" }));
  });

  test("the scrolling strip is reachable from the keyboard", () => {
    render(<Carousel aria-label="Featured">{slides(2)}</Carousel>);

    // Прокручиваемый блок без места в обходе — нарушение `scrollable-region-focusable`.
    expect(viewport().getAttribute("tabindex")).toBe("0");
  });
});
