// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { Button } from "../src/components/actions/Button.js";

afterEach(cleanup);

test("asChild gives the appearance to the link instead of wrapping it in a button", () => {
  render(
    <Button asChild variant="solid" tone="accent">
      <a href="/campaigns/new">New campaign</a>
    </Button>
  );

  const link = screen.getByRole("link", { name: "New campaign" });
  // Кнопки в разметке нет вовсе: вложенная интерактивность недопустима, и
  // ссылка внутри кнопки — именно она.
  expect(screen.queryByRole("button")).toBeNull();
  expect(link.className).toContain("bg-accent");
});

test("type=button does not leak into the link markup", () => {
  render(
    <Button asChild>
      <a href="/schedule">Schedule</a>
    </Button>
  );

  // У `a` такого атрибута нет вовсе, и React отрисовал бы его мусором.
  expect(screen.getByRole("link").hasAttribute("type")).toBe(false);
});

test("a plain button still gets type=button", () => {
  render(<Button>Save</Button>);

  // Умолчание держит старый дефект закрытым: кнопка внутри формы без него
  // отправляет форму.
  expect(screen.getByRole("button")).toHaveProperty("type", "button");
});

test("the icon is not lost with asChild", () => {
  render(
    <Button asChild icon={<svg data-testid="icon" />}>
      <a href="/upload">Upload</a>
    </Button>
  );

  const link = screen.getByRole("link", { name: "Upload" });
  // Иконка уехала ВНУТРЬ ссылки, а не осталась снаружи рядом с ней.
  expect(link.querySelector('[data-testid="icon"]')).not.toBeNull();
});

test("handlers merge with the child", async () => {
  const onButton = vi.fn();
  const onLink = vi.fn();

  render(
    <Button asChild onClick={onButton}>
      <a href="#" onClick={onLink}>
        Open
      </a>
    </Button>
  );

  const user = userEvent.setup();
  await user.click(screen.getByRole("link", { name: "Open" }));

  expect(onButton).toHaveBeenCalledTimes(1);
  expect(onLink).toHaveBeenCalledTimes(1);
});

test("disabled on a link is expressed by role, not by a non-existent attribute", () => {
  render(
    <Button asChild disabled>
      <a href="/campaigns/new">New campaign</a>
    </Button>
  );

  const link = screen.getByRole("link", { name: "New campaign" });
  // `<a disabled>` остаётся и фокусируемой, и переходимой, а `disabled:opacity-50`
  // не срабатывает: `:disabled` — псевдокласс полей формы. Выключенная на вид,
  // рабочая на деле ссылка — худший исход из возможных.
  expect(link.hasAttribute("disabled")).toBe(false);
  expect(link.getAttribute("aria-disabled")).toBe("true");
  expect(link.className).toContain("pointer-events-none");
});

test("selected does not put aria-pressed on a link", () => {
  render(
    <Button asChild selected>
      <a href="/schedule">Schedule</a>
    </Button>
  );

  // У роли `link` атрибут запрещён — аудит axe ловит его как `aria-allowed-attr`.
  // Нажатой ссылки не бывает: если состояние нужно, это кнопка.
  expect(screen.getByRole("link").hasAttribute("aria-pressed")).toBe(false);
});

test("a plain button still reports the pressed state", () => {
  render(<Button selected>Filters</Button>);

  expect(screen.getByRole("button").getAttribute("aria-pressed")).toBe("true");
});

/**
 * Выключенная ссылка обязана быть выключенной И ДЛЯ КЛАВИАТУРЫ.
 *
 * При `asChild` выключенность выражалась только `aria-disabled` — атрибутом
 * рекомендательным — и классом `pointer-events-none`, который гасит
 * исключительно указатель. Ссылка оставалась в порядке обхода и срабатывала по
 * Enter: пользователь клавиатуры доходил до визуально бледной кнопки «Оплатить»
 * во время отправки формы и уходил со страницы. Тесты проверяли только атрибуты.
 */
test("a disabled asChild link is out of the tab order", () => {
  render(
    <Button asChild disabled>
      <a href="/pay">Pay</a>
    </Button>
  );

  expect(screen.getByRole("link").getAttribute("tabindex")).toBe("-1");
});

test("Enter on a disabled asChild link does nothing", async () => {
  const user = userEvent.setup();
  const onClick = vi.fn();

  render(
    <Button asChild loading onClick={onClick}>
      <a href="/pay">Pay</a>
    </Button>
  );

  const link = screen.getByRole("link");
  link.focus();
  await user.keyboard("{Enter}");

  expect(onClick).not.toHaveBeenCalled();
});

test("an enabled asChild link still works", async () => {
  const user = userEvent.setup();
  const onClick = vi.fn();

  render(
    <Button asChild onClick={onClick}>
      <a href="/pay">Pay</a>
    </Button>
  );

  await user.click(screen.getByRole("link"));
  expect(onClick).toHaveBeenCalled();
});

/**
 * Собственный `tabIndex` потомка не перебивает выключённость.
 *
 * `Slot` отдаёт приоритет пропам ПОТОМКА независимо от порядка спреда, поэтому
 * `tabIndex: -1`, переданный кнопке, ссылка с `tabIndex={0}` попросту
 * перебивала — и оставалась достижимой табом, хотя выглядела выключённой.
 * Комментарий рядом при этом утверждал, что защиту бережёт порядок спреда.
 */
test("a child tabIndex does not defeat the disabled guard", () => {
  render(
    <Button asChild disabled>
      <a href="/pay" tabIndex={0}>
        Pay
      </a>
    </Button>
  );

  expect(screen.getByRole("link").getAttribute("tabindex")).toBe("-1");
});

test("an enabled asChild child keeps its own tabIndex", () => {
  render(
    <Button asChild>
      <a href="/pay" tabIndex={3}>
        Pay
      </a>
    </Button>
  );

  // Клонирование включается только выключённостью: обычную разметку
  // вызывающего компонент не переписывает.
  expect(screen.getByRole("link").getAttribute("tabindex")).toBe("3");
});
