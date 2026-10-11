// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { ErrorState } from "../src/components/content/ErrorState.js";

afterEach(cleanup);

test("a failure is announced by a live region, an empty screen is not", () => {
  render(<ErrorState description="Could not load the collections." />);
  // Ровно этого не было ни в одной из четырёх рукописных копий во фронте:
  // без роли пользователь скринридера остаётся с тишиной вместо ответа.
  const alert = screen.getByRole("alert");
  expect(alert.textContent).toContain("Failed to load");
  expect(alert.textContent).toContain("Could not load the collections.");
});

test("the default title is overridden by a custom one", () => {
  render(<ErrorState title="Channel unavailable" />);
  expect(screen.getByRole("alert").textContent).toContain("Channel unavailable");
  expect(screen.queryByText("Failed to load")).toBeNull();
});

test("the action renders as given", () => {
  render(<ErrorState action={<button type="button">Try again</button>} />);
  expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
});

test("null removes the icon, undefined puts the standard one", () => {
  const { container, unmount } = render(<ErrorState icon={null} />);
  expect(container.querySelector("svg")).toBeNull();
  unmount();

  const { container: withIcon } = render(<ErrorState />);
  const svg = withIcon.querySelector("svg");
  expect(svg).toBeTruthy();
  // Иконка декоративна: имя состояния несёт заголовок, а не она.
  expect(svg?.closest("[aria-hidden]")).toBeTruthy();
});
