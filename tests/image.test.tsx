// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { Image } from "../src/components/content/Image.js";

afterEach(() => {
  cleanup();
  // Без этого шпион на `complete` переживает упавшее утверждение и утекает в
  // следующий тест: тот видит «картинка уже готова» и падает по причине,
  // не имеющей отношения к тому, что он проверяет.
  vi.restoreAllMocks();
});

test("a broken URL shows the fallback instead of the browser broken-image icon", () => {
  const { container } = render(<Image src="/none.png" alt="Night city" />);

  fireEvent.error(container.querySelector("img") as HTMLImageElement);

  // Самой картинки в разметке больше нет — вместо неё фолбэк, и он названный:
  // подпись объекта отказ загрузки переживает (значок внутри при этом свой
  // `aria-hidden` сохраняет, он декоративен).
  expect(container.querySelector("img")).toBeNull();
  expect(screen.getByRole("img", { name: "Night city" })).toBeTruthy();
});

test("changing the URL resets the failure", () => {
  const { container, rerender } = render(<Image src="/none.png" alt="Photo" />);
  fireEvent.error(container.querySelector("img") as HTMLImageElement);
  expect(container.querySelector("img")).toBeNull();

  // Без сброса узел, переиспользованный под другой обой (виртуализованная
  // сетка так и делает), навсегда остался бы с фолбэком.
  rerender(<Image src="/other.png" alt="Photo" />);
  expect(container.querySelector("img")).toBeTruthy();
});

test("an empty URL goes straight to the fallback, without trying to load", () => {
  const { container } = render(<Image src={null} alt="No preview" />);
  expect(container.querySelector("img")).toBeNull();
  // Запроса нет, а объект остаётся названным.
  expect(screen.getByRole("img", { name: "No preview" })).toBeTruthy();
});

test("loading defaults are set and laziness can be turned off", () => {
  const { rerender } = render(<Image src="/a.png" alt="a" />);
  const img = screen.getByRole("img", { name: "a" });
  expect(img.getAttribute("loading")).toBe("lazy");
  expect(img.getAttribute("decoding")).toBe("async");

  // Картинка первого экрана, отложенная браузером, роняет LCP.
  rerender(<Image src="/a.png" alt="a" eager />);
  expect(screen.getByRole("img", { name: "a" }).getAttribute("loading")).toBe("eager");
});

test("custom onLoad and onError are called alongside the internal ones", () => {
  const onError = vi.fn();
  const onLoad = vi.fn();
  const { rerender } = render(<Image src="/a.png" alt="a" onError={onError} onLoad={onLoad} />);

  fireEvent.load(screen.getByRole("img", { name: "a" }));
  expect(onLoad).toHaveBeenCalledTimes(1);

  rerender(<Image src="/b.png" alt="a" onError={onError} onLoad={onLoad} />);
  fireEvent.error(screen.getByRole("img", { name: "a" }));
  expect(onError).toHaveBeenCalledTimes(1);
});

test("a cached image leaves no dead skeleton", () => {
  // По готовой картинке события `load` не будет вовсе, и без проверки
  // `complete` скелетон оставался бы в разметке навсегда. На экране библиотеки
  // так вышло у 33 плиток из 58 — не видно глазом, потому что скелетон лежит
  // под непрозрачным превью.
  const complete = vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(true);
  const natural = vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(320);

  const { container } = render(<Image src="/cached.png" alt="a" />);
  expect(container.querySelector(".skeleton")).toBeNull();
  expect(screen.getByRole("img", { name: "a" })).toBeTruthy();

  complete.mockRestore();
  natural.mockRestore();
});

test("a complete but zero-sized image counts as a failure right away", () => {
  const complete = vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(true);
  const natural = vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(0);

  const { container } = render(<Image src="/none.png" alt="a" />);
  expect(container.querySelector("img")).toBeNull();

  complete.mockRestore();
  natural.mockRestore();
});

test("the skeleton goes away after loading", () => {
  const { container } = render(<Image src="/a.png" alt="a" />);
  expect(container.querySelector(".skeleton")).toBeTruthy();

  fireEvent.load(screen.getByRole("img", { name: "a" }));
  expect(container.querySelector(".skeleton")).toBeNull();
});

test("intrinsic does not impose the box size on the image", () => {
  // Дефект, найденный ревью: в режиме `fill` картинке проставлены h-full/w-full,
  // то есть проценты от коробки. У коробки без своего размера они дают ноль —
  // и просмотр кадра схлопывался в 0×0, а ленивая загрузка не стартовала вовсе,
  // потому что показывать было нечего.
  const { container, rerender } = render(<Image src="/a.png" alt="Frame" sizing="intrinsic" />);
  const img = screen.getByRole("img", { name: "Frame" });
  expect(img.className).not.toContain("h-full");
  expect(img.className).not.toContain("w-full");
  expect((container.firstElementChild as HTMLElement).className).toContain("inline-block");

  rerender(<Image src="/a.png" alt="Frame" />);
  expect(screen.getByRole("img", { name: "Frame" }).className).toContain("h-full");
});

test("intrinsic draws no skeleton: there is nothing to stretch it to", () => {
  const { container } = render(<Image src="/a.png" alt="" sizing="intrinsic" />);
  expect(container.querySelector(".skeleton")).toBeNull();
});

test("a meaningful label survives a load failure", () => {
  const { container } = render(<Image src="/none.png" alt="Night city" />);
  fireEvent.error(container.querySelector("img") as HTMLImageElement);

  // Картинки больше нет, но объект остаётся названным: иначе отказ превращает
  // его в пустое место, о котором скринридер не сообщает.
  expect(screen.getByRole("img", { name: "Night city" })).toBeTruthy();
});

test("a decorative image stays decorative even in failure", () => {
  const { container } = render(<Image src="/none.png" alt="" />);
  fireEvent.error(container.querySelector("img") as HTMLImageElement);

  expect(screen.queryByRole("img")).toBeNull();
  expect(container.querySelector("[aria-hidden]")).toBeTruthy();
});

test("the default fallback carries its own backdrop, a custom one does not", () => {
  // Обёртка даёт только место и центровку: свой фолбэк красится вызывающим
  // (буква категории — по её имени), и подложка умолчания закрыла бы его.
  // Расхождение реализации с документацией нашло ревью: подложки не было
  // вовсе, а страница компонента обещала «значок на приглушённой подложке».
  const { container, rerender } = render(<Image src={null} alt="" />);
  expect(container.querySelector(".bg-bg-2")).toBeTruthy();

  rerender(<Image src={null} alt="" fallback={<span data-testid="custom">No preview</span>} />);
  expect(container.querySelector(".bg-bg-2")).toBeNull();
  expect(screen.getByTestId("custom")).toBeTruthy();
});
