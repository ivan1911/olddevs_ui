// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { Breadcrumbs } from "../src/components/navigation/Breadcrumbs.js";
import { Pagination, pageRange } from "../src/components/navigation/Pagination.js";
import { Stepper } from "../src/components/navigation/Stepper.js";

afterEach(cleanup);

test("with a single page nothing is drawn", () => {
  const { container } = render(<Pagination page={1} pageCount={1} onChange={() => {}} />);

  // Пагинация из единственной кнопки сообщает о переходе там, где переходить
  // некуда.
  expect(container.firstChild).toBeNull();
});

test("page range: the edges are always visible, the middle collapses", () => {
  // Пять страниц помещаются в ряд целиком, и с волны 26 ряд добивается до
  // постоянной ширины: прятать за многоточием третью и четвёртую, когда для них
  // есть место, — это и есть та скачущая ширина, из-за которой кнопка уезжала
  // из-под курсора. Правило файла «одну пропущенную дешевле показать» здесь
  // просто доведено до конца.
  expect(pageRange(1, 5, 1)).toEqual([1, 2, 3, 4, 5]);
  expect(pageRange(12, 24, 1)).toEqual([1, "gap", 11, 12, 13, "gap", 24]);
  // Одну пропущенную страницу дешевле показать, чем спрятать за многоточием.
  // А здесь слева прячется ровно одна (вторая) — её показываем.
  expect(pageRange(4, 9, 1)).toEqual([1, 2, 3, 4, 5, "gap", 9]);
  expect(pageRange(3, 5, 1)).toEqual([1, 2, 3, 4, 5]);
});

test("the row width does not grow with the number of pages", () => {
  const narrow = pageRange(50, 100, 1).length;
  const wide = pageRange(50, 10000, 1).length;

  // Кнопки под курсором не должны прыгать при переходе на соседнюю страницу.
  expect(narrow).toBe(wide);
});

test("the last crumb is not a link", () => {
  render(<Breadcrumbs items={[{ label: "Library", href: "/lib" }, { label: "Sunsets" }]} />);

  // Ссылка на текущую страницу обещает переход, которого не будет.
  expect(screen.queryByRole("link", { name: "Sunsets" })).toBeNull();
  expect(screen.getByText("Sunsets").getAttribute("aria-current")).toBe("page");
  expect(screen.getByRole("link", { name: "Library" })).toBeTruthy();
});

test("a long trail collapses and the edges remain", () => {
  render(
    <Breadcrumbs
      items={[
        { label: "Root", href: "#" },
        { label: "Second", href: "#" },
        { label: "Third", href: "#" },
        { label: "Fourth", href: "#" },
        { label: "Current" },
      ]}
    />
  );

  expect(screen.getByRole("link", { name: "Root" })).toBeTruthy();
  expect(screen.getByText("Current")).toBeTruthy();
  // Середина пути не говорит о том, где пользователь находится.
  expect(screen.queryByRole("link", { name: "Second" })).toBeNull();
});

test("you can go back only to a completed step", async () => {
  const user = userEvent.setup();
  const onStep = vi.fn();

  render(
    <Stepper
      steps={[
        { id: "a", label: "Files" },
        { id: "b", label: "Description" },
        { id: "c", label: "Schedule" },
      ]}
      current={1}
      onStepClick={onStep}
    />
  );

  // Пройденный — кликается.
  await user.click(screen.getByRole("button", { name: /Files/ }));
  expect(onStep).toHaveBeenCalledWith(0);

  // Будущий — нет: он требует данных, которых ещё нет.
  expect(screen.queryByRole("button", { name: /Schedule/ })).toBeNull();
});

test("the current step is announced as a step, not as a page", () => {
  render(
    <Stepper
      steps={[
        { id: "a", label: "Files" },
        { id: "b", label: "Description" },
      ]}
      current={1}
    />
  );

  const current = screen.getByText("Description").closest("li");
  expect(current?.getAttribute("aria-current")).toBe("step");
});

/**
 * Состояние шага звучит, а не только рисуется.
 *
 * Кружок с номером или галочкой помечен `aria-hidden`, а больше признак
 * «пройден / текущий / впереди» нигде не выражен: у `li` есть только
 * `aria-current` у активного. Скринридер читал мастер из пяти одинаковых
 * пунктов и текущий — какие уже заполнены, а какие впереди, не сообщалось.
 */
test("each step announces whether it is done, current or upcoming", () => {
  render(
    <Stepper
      current={1}
      steps={[
        { id: "a", label: "Details" },
        { id: "b", label: "Files" },
        { id: "c", label: "Review" },
      ]}
    />
  );

  const items = screen.getAllByRole("listitem");
  const texts = items.map((li) => li.textContent ?? "");
  expect(texts[0]).toContain("completed");
  expect(texts[2]).toContain("not started");

  // Текущий шаг своей строки НЕ получает: его объявляет `aria-current`, и
  // вторая строка читалась бы как «current step, current step, Оплата».
  expect(items[1]?.getAttribute("aria-current")).toBe("step");
  expect(texts[1]).not.toContain("current step");
});
