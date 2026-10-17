// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { createRef, useState } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { Carousel } from "../src/index.js";

/**
 * The carousel: names, buttons, edges, `onIndexChange`, modes.
 *
 * jsdom does not compute layout and does not know `scrollTo` on elements, so the
 * position is stubbed with exactly the three numbers the component reads: `scrollLeft`,
 * `scrollWidth`, `clientWidth`. Snapping to a slide, the gesture, and the slide width
 * computed at the breakpoints cannot be checked in jsdom: the browser measures them
 * (manual check in the showcase), and `tests/class-coverage.test.ts` guards through the
 * matrix that every width class reaches the CSS.
 */

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** The slide width and the slide count in the stubbed layout. */
const SLIDE = 300;

interface Layout {
  scrollLeft: number;
  scrollWidth: number;
  clientWidth: number;
}

let layout: Layout;
let scrollTo: ReturnType<typeof vi.fn>;
/**
 * Whether the stubbed scroll is instant. `false` means smooth: the position holds
 * until the test moves it.
 */
let jumps: boolean;

/** A track of `count` slides, each `SLIDE` wide, with `perView` in view. */
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

/** The track is the slides' parent: it has no role, and the consumer does not need one. */
const viewport = () => screen.getAllByRole("group")[0]!.parentElement!;

/** The user released the track at position `left`: a scroll event with the new offset. */
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
    // The types are part of the contract: without a name the region is announced as an
    // unnamed "carousel", and two name sources drift apart silently when edited.
    // @ts-expect-error — no name
    render(<Carousel>{slides(1)}</Carousel>);
    cleanup();
    render(
      // @ts-expect-error — both name sources at once
      <Carousel aria-label="A" aria-labelledby="b">
        {slides(1)}
      </Carousel>
    );
    cleanup();
    // @ts-expect-error — in the kit `label` means a visible caption, and a carousel has none
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

    // There is no autoplay, and the track is read as a whole: hiding the off-screen slides
    // would hide from the screen reader what it must find.
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
    // The smooth scroll has not moved yet: the position stays at zero.
    // The clicks are synchronous: not even a millisecond passes between them, and the
    // stop timer does not interfere.
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

    // Past slide 3 the track does not move: slides 4 and 5 are in view.
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

    // The track width is unchanged, so `ResizeObserver` stays silent; the slide width
    // changes, and all three are now in view.
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

    // The last step forward: the button is disabled while it has focus.
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

    // The track moved past slides 1 and 2 without stopping and came to rest on the third.
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
    // The stub scrolls instantly, and the browser's scroll event follows.
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

    // It jittered by a couple of pixels and came back.
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
    // The parent accepted the index the track already shows: there is no second scroll.
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
    // A hidden container (a tab, a window before its animation, `display: none`) has no layout.
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

    // `display: none` removes the layout and resets the scroll to zero.
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

    // Slide 4 is unreachable with three in view: the track stops at 2 instead of moving
    // into empty space.
    expect(scrollTo).toHaveBeenCalledWith({ left: 2 * SLIDE, behavior: "instant" });
    // The stop at 2 is the result of our own scroll, not a user gesture.
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

    // The user scrolled to the third slide, but the parent does not change the index.
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

    // A scrollable region without a place in the tab order violates `scrollable-region-focusable`.
    expect(viewport().getAttribute("tabindex")).toBe("0");
  });
});
