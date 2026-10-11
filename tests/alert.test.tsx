// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { Alert } from "../src/components/actions/Alert.js";

afterEach(cleanup);

/*
 * Русская локаль подключается ЯВНО: с 2.0.0 фолбэк кита английский, и тест,
 * ожидающий русскую подпись без провайдера, проверял бы не поведение, а язык
 * дефолта. Ожидания при этом не тронуты — строки те же, что были зашиты в
 * компонентах до переезда в каталог, и это здесь и доказывается.
 */
test("role follows the tone, not the appearance", () => {
  const { unmount } = render(<Alert tone="danger">Channel disconnected</Alert>);
  // `alert` перебивает текущую речь скринридера — это уместно для ошибки.
  expect(screen.getByRole("alert").textContent).toContain("Channel disconnected");
  unmount();

  for (const tone of ["neutral", "accent", "success", "warning"] as const) {
    const { unmount: u } = render(<Alert tone={tone}>Message</Alert>);
    // `status` дожидается паузы: орать про успешное сохранение незачем.
    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    u();
  }
});

test("no cross is drawn without a handler", () => {
  const { unmount } = render(<Alert>Message</Alert>);
  expect(screen.queryByRole("button", { name: "Dismiss message" })).toBeNull();
  unmount();

  render(<Alert onDismiss={() => {}}>Message</Alert>);
  expect(screen.getByRole("button", { name: "Dismiss message" })).toBeTruthy();
});

test("the cross calls onDismiss", async () => {
  const user = userEvent.setup();
  const onDismiss = vi.fn();
  render(<Alert onDismiss={onDismiss}>Message</Alert>);

  await user.click(screen.getByRole("button", { name: "Dismiss message" }));
  expect(onDismiss).toHaveBeenCalledTimes(1);
});

test("title and body are both shown", () => {
  render(<Alert title="Channel not connected">Nothing is published until you connect it</Alert>);
  expect(screen.getByText("Channel not connected")).toBeTruthy();
  expect(screen.getByText("Nothing is published until you connect it")).toBeTruthy();
});

test("a custom icon displaces the tone icon", () => {
  const { container } = render(
    <Alert tone="danger" icon={<span data-testid="custom" />}>
      Message
    </Alert>
  );
  expect(screen.getByTestId("custom")).toBeTruthy();
  // Значок по тону — один `svg`; со своим значком его быть не должно.
  expect(container.querySelectorAll("svg")).toHaveLength(0);
});
