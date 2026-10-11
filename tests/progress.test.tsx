// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { Progress } from "../src/components/actions/Progress.js";
import { Spinner } from "../src/components/actions/Spinner.js";

afterEach(cleanup);

test("unknown progress does not pretend to be zero", () => {
  render(<Progress value={null} label="File upload" />);

  const bar = screen.getByRole("progressbar", { name: "File upload" });
  // Атрибута НЕТ вовсе — так ARIA отличает «полоса на нуле» от «идёт неизвестно
  // сколько». Ноль на этом месте сообщал бы скринридеру неправду.
  expect(bar.hasAttribute("aria-valuenow")).toBe(false);
});

test("zero is a real zero, not unknown", () => {
  render(<Progress value={0} label="File upload" />);

  const bar = screen.getByRole("progressbar", { name: "File upload" });
  expect(bar.getAttribute("aria-valuenow")).toBe("0");
});

test("the value reaches the attribute", () => {
  render(<Progress value={42} label="File upload" />);
  expect(
    screen.getByRole("progressbar", { name: "File upload" }).getAttribute("aria-valuenow")
  ).toBe("42");
});

test("the spinner announces itself instead of staying silent", () => {
  render(<Spinner label="Saving" />);
  // Без имени вращающийся кружок для скринридера просто не существует.
  expect(screen.getByRole("status").textContent).toBe("Saving");
});

test("the spinner has a default name", () => {
  render(<Spinner />);
  expect(screen.getByRole("status").textContent).toBe("Loading");
});
