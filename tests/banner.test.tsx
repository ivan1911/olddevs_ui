// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { Banner } from "../src/components/actions/Banner.js";

afterEach(cleanup);

test("danger interrupts speech, other tones wait for a pause", () => {
  const { rerender } = render(<Banner tone="danger">Service unavailable</Banner>);
  // Роль выбирается по тону тем же правилом, что в `Alert`: путать их значит
  // либо потерять сообщение об отказе, либо орать про успешное сохранение.
  expect(screen.getByRole("alert").textContent).toContain("Service unavailable");

  rerender(<Banner tone="success">Everything is back</Banner>);
  expect(screen.getByRole("status").textContent).toContain("Everything is back");
});

test("without a handler there is no close button at all", () => {
  render(<Banner>Maintenance in progress</Banner>);
  expect(screen.queryByRole("button")).toBeNull();
});

test("closing calls the handler and is announced with catalog words", async () => {
  const user = userEvent.setup();
  const onDismiss = vi.fn();
  render(<Banner onDismiss={onDismiss}>Maintenance in progress</Banner>);

  // Подпись своя, а не общая «Закрыть»: баннер закрывает сообщение уровня
  // приложения, и скринридер обязан сказать, что именно скрывается.
  await user.click(screen.getByRole("button", { name: "Dismiss announcement" }));
  expect(onDismiss).toHaveBeenCalledTimes(1);
});

test("a custom close label overrides the catalog", () => {
  render(
    <Banner onDismiss={() => {}} closeLabel="Hide until tomorrow">
      Maintenance in progress
    </Banner>
  );
  expect(screen.getByRole("button", { name: "Hide until tomorrow" })).toBeTruthy();
});

test("a stack is adjacent banners, each with its own button", async () => {
  const user = userEvent.setup();
  const first = vi.fn();
  const second = vi.fn();
  render(
    <>
      <Banner tone="danger" onDismiss={first}>
        Service unavailable
      </Banner>
      <Banner tone="accent" onDismiss={second}>
        New version
      </Banner>
    </>
  );

  // Своей очереди у компонента нет: она была бы состоянием, а состояние в ките
  // не живёт. Стопка — это просто два соседа.
  const buttons = screen.getAllByRole("button");
  expect(buttons).toHaveLength(2);
  await user.click(buttons[1]!);
  expect(second).toHaveBeenCalledTimes(1);
  expect(first).not.toHaveBeenCalled();
});

test("action and title sit next to the body", () => {
  render(
    <Banner title="Subscription is expiring" action={<button type="button">Renew</button>}>
      Publishing stops in three days.
    </Banner>
  );

  const banner = screen.getByRole("status");
  expect(banner.textContent).toContain("Subscription is expiring");
  expect(banner.textContent).toContain("in three days");
  expect(screen.getByRole("button", { name: "Renew" })).toBeTruthy();
});

test("no rounding: a banner is a strip across the application, not a card", () => {
  const { container } = render(<Banner>Maintenance in progress</Banner>);
  const banner = container.firstElementChild as HTMLElement;

  // Скруглённые углы читались бы как блок содержимого, то есть как `Alert`.
  expect(banner.className).toContain("w-full");
  expect(banner.className).not.toContain("rounded-md");
});
