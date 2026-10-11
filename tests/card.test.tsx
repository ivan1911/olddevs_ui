// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { Card } from "../src/components/content/Card.js";

afterEach(cleanup);

test("a container card stays a div without a role", () => {
  const { container } = render(<Card>Content</Card>);
  const root = container.firstElementChild as HTMLElement;
  expect(root.tagName).toBe("DIV");
  expect(root.getAttribute("role")).toBeNull();
  // Вид контейнера не меняется от появления `asChild` у соседей.
  expect(root.className).not.toContain("cursor-pointer");
});

test("asChild gives the appearance to a button and makes the card keyboard-reachable", async () => {
  const user = userEvent.setup();
  const onClick = vi.fn();
  render(
    <Card asChild>
      <button type="button" onClick={onClick}>
        City views
      </button>
    </Card>
  );

  const button = screen.getByRole("button", { name: "City views" });
  expect(button.className).toContain("cursor-pointer");
  expect(button.className).toContain("rounded-lg");

  // Ровно то, чего не умел `<div onClick>`: срабатывание с клавиатуры.
  await user.tab();
  expect(document.activeElement).toBe(button);
  await user.keyboard("{Enter}");
  expect(onClick).toHaveBeenCalledTimes(1);
});

test("asChild with a link keeps the link role", () => {
  render(
    <Card asChild size="sm">
      <a href="#collection">Collection</a>
    </Card>
  );
  const link = screen.getByRole("link", { name: "Collection" });
  expect(link.className).toContain("p-[14px]");
});

test("interactive outlines the card only on focus of the stretched link", () => {
  const { container } = render(
    <Card interactive>
      <a href="#where" className="after:absolute after:inset-0">
        Collection
      </a>
    </Card>
  );
  const root = container.firstElementChild as HTMLElement;
  // Контейнер остаётся div: кнопку в кнопку вкладывать нельзя, а меню действий
  // живёт рядом со ссылкой.
  expect(root.tagName).toBe("DIV");
  expect(root.className).toContain("relative");
  // Кольцо привязано к ссылке, а не к любому потомку: фокус на меню «Ещё» не
  // должен обводить карточку целиком.
  expect(root.className).toContain("has-[a:focus-visible]:outline-2");
});
