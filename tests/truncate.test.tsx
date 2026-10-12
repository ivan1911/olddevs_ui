// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { Truncate } from "../src/components/actions/Truncate.js";
import { TooltipProvider } from "../src/components/overlays/Tooltip.js";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/*
  В jsdom нет раскладки: `scrollWidth` и `clientWidth` всегда нули, и текст
  никогда не выглядит обрезанным. Поэтому обрезанность подделывается прямо на
  прототипе — иначе проверить главное правило («подсказка только у обрезанного»)
  в jsdom нельзя вовсе. Настоящий замер ширины — в браузере.
*/
function fakeOverflow(overflowing: boolean) {
  vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(overflowing ? 200 : 100);
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(100);
  vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(20);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(20);
}

test("untruncated text gets no tooltip", () => {
  fakeOverflow(false);
  render(
    <TooltipProvider>
      <Truncate>Short</Truncate>
    </TooltipProvider>
  );

  // Подсказка на неусечённом тексте — шум: она повторяет то, что и так видно,
  // и приучает её игнорировать.
  const text = screen.getByText("Short");
  expect(text.hasAttribute("tabindex")).toBe(false);
  expect(text.hasAttribute("data-state")).toBe(false);
});

test("truncated text gets focus and a tooltip", () => {
  fakeOverflow(true);
  render(
    <TooltipProvider>
      <Truncate>A very long value that does not fit</Truncate>
    </TooltipProvider>
  );

  // Без фокуса полное значение было бы доступно только мышью — то есть
  // недоступно вовсе тому, кто мышью не пользуется.
  const text = screen.getByText("A very long value that does not fit");
  expect(text.getAttribute("tabindex")).toBe("0");
});

test("the text sits in the DOM in full: truncation is visual", () => {
  fakeOverflow(true);
  render(
    <TooltipProvider>
      <Truncate>Full value</Truncate>
    </TooltipProvider>
  );

  // Скринридер читает строку целиком и без нашей помощи.
  expect(screen.getByText("Full value").textContent).toBe("Full value");
});

test("one line is truncated with an ellipsis, several by line count", () => {
  fakeOverflow(true);
  const { rerender } = render(
    <TooltipProvider>
      <Truncate>Value</Truncate>
    </TooltipProvider>
  );
  expect(screen.getByText("Value").className).toContain("truncate");

  rerender(
    <TooltipProvider>
      <Truncate lines={3}>Value</Truncate>
    </TooltipProvider>
  );
  const multi = screen.getByText("Value");
  expect(multi.className).toContain("[display:-webkit-box]");
  // `block` стоит в CSS позже и перебил бы `-webkit-box`: строки не обрезались бы.
  expect(multi.classList.contains("block")).toBe(false);
  expect(multi.style.webkitLineClamp).toBe("3");
});

test("after truncation the observer watches the new node, not a dead one", async () => {
  // Обёртка в `Tooltip` пересоздаёт `span`. Наблюдатель, оставшийся на старом
  // узле, не увидел бы расширения колонки — нашло ревью 2.5.0.
  let scrollWidth = 100;
  vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockImplementation(() => scrollWidth);
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(100);
  vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(20);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(20);

  const observed: Element[] = [];
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe(el: Element) {
        observed.push(el);
      }
      disconnect() {}
    }
  );

  const { rerender } = render(
    <TooltipProvider>
      <Truncate>Text</Truncate>
    </TooltipProvider>
  );
  scrollWidth = 200;
  rerender(
    <TooltipProvider>
      <Truncate>Text!</Truncate>
    </TooltipProvider>
  );
  await act(async () => {});

  const current = screen.getByText("Text!");
  expect(current.getAttribute("tabindex")).toBe("0");
  expect(observed[observed.length - 1]).toBe(current);
  vi.unstubAllGlobals();
});
