// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { useScrollLock } from "../src/hooks/useScrollLock.js";

/**
 * Счётчик замков модульный, и проверяется здесь ровно то, ради чего он такой.
 *
 * Модалки вкладываются: поверх окна редактирования открывается подтверждение.
 * Закрываясь, вложенное окно не должно разблокировать прокрутку, пока внешнее
 * ещё открыто. Глазами этот дефект не виден — страница просто начинает
 * прокручиваться под открытым окном.
 */

function Lock({ locked }: { locked: boolean }) {
  useScrollLock(locked);
  return null;
}

const locked = () => document.body.classList.contains("scroll-locked");

afterEach(() => {
  cleanup();
  document.body.style.removeProperty("padding-right");
});

test("the lock is set and released", () => {
  const { rerender } = render(<Lock locked={false} />);
  expect(locked()).toBe(false);

  rerender(<Lock locked />);
  expect(locked()).toBe(true);

  rerender(<Lock locked={false} />);
  expect(locked()).toBe(false);
});

test("nested locks: the last to close releases, not the first", () => {
  const { rerender } = render(
    <>
      <Lock locked />
      <Lock locked />
    </>
  );
  expect(locked()).toBe(true);

  // Закрылось вложенное окно — внешнее ещё открыто.
  rerender(
    <>
      <Lock locked />
      <Lock locked={false} />
    </>
  );
  expect(locked()).toBe(true);

  rerender(
    <>
      <Lock locked={false} />
      <Lock locked={false} />
    </>
  );
  expect(locked()).toBe(false);
});

test("unmounting with the lock raised does not leave the page locked", () => {
  // Обычное дело: компонент с модалкой исчезает вместе с ней, и без снятия
  // замка на размонтировании счётчик залипал бы навсегда.
  const { unmount } = render(<Lock locked />);
  expect(locked()).toBe(true);

  unmount();
  expect(locked()).toBe(false);
});

/**
 * Свой inline-отступ приложения переживает замок.
 *
 * Компенсация ширины полосы прокрутки писалась в `body.style.paddingRight`, а
 * снималась присваиванием пустой строки — то есть замок не ВОЗВРАЩАЛ прежнее
 * значение, а стирал его. Приложение, держащее на `<body>` собственный
 * inline-отступ (например, под свою фиксированную панель), теряло его навсегда
 * после первого же открытого диалога кита.
 */
test("an inline padding of the application survives the lock", () => {
  document.body.style.paddingRight = "17px";

  const { rerender } = render(<Lock locked={false} />);
  rerender(<Lock locked />);
  rerender(<Lock locked={false} />);

  expect(document.body.style.paddingRight).toBe("17px");
});

test("without an inline padding nothing is left behind", () => {
  const { rerender } = render(<Lock locked={false} />);
  rerender(<Lock locked />);
  rerender(<Lock locked={false} />);

  expect(document.body.style.paddingRight).toBe("");
});

test("nested locks restore the original padding once, at the outermost release", () => {
  document.body.style.paddingRight = "17px";

  const outer = render(<Lock locked />);
  const inner = render(<Lock locked />);

  inner.rerender(<Lock locked={false} />);
  // Внешний замок ещё стоит — отступ приложения возвращать рано.
  expect(document.body.classList.contains("scroll-locked")).toBe(true);

  outer.rerender(<Lock locked={false} />);
  expect(document.body.style.paddingRight).toBe("17px");
});

test("a padding changed by the application while locked is not clobbered", () => {
  document.body.style.paddingRight = "17px";

  const { rerender } = render(<Lock locked />);
  // Приложение поменяло отступ, пока замок стоял: своя панель появилась поверх
  // открытого диалога. Восстанавливать «как было» тут уже нельзя.
  document.body.style.paddingRight = "33px";
  rerender(<Lock locked={false} />);

  expect(document.body.style.paddingRight).toBe("33px");
});

test("with no scrollbar the lock neither adds nor erases a padding", () => {
  // В jsdom `clientWidth` равен нулю, поэтому во всех остальных тестах ширина
  // полосы выходит 1024 и ветка «полосы нет» не исполняется ни разу — а это
  // самый частый случай у macOS с наложенными полосами прокрутки.
  const clientWidth = Object.getOwnPropertyDescriptor(Element.prototype, "clientWidth");
  Object.defineProperty(document.documentElement, "clientWidth", {
    configurable: true,
    get: () => window.innerWidth,
  });
  document.body.style.paddingRight = "17px";

  try {
    const { rerender } = render(<Lock locked />);
    expect(document.body.style.paddingRight).toBe("17px");
    rerender(<Lock locked={false} />);
    expect(document.body.style.paddingRight).toBe("17px");
  } finally {
    delete (document.documentElement as unknown as Record<string, unknown>).clientWidth;
    if (clientWidth) Object.defineProperty(Element.prototype, "clientWidth", clientWidth);
  }
});
