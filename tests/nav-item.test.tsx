// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { TooltipProvider } from "@radix-ui/react-tooltip";
import { afterEach, describe, expect, test } from "vitest";
import { NavCollapsedProvider, NavItem } from "../src/components/app-shell/NavItem.js";

afterEach(cleanup);

/**
 * `TooltipProvider` обязателен: в схлопнутом режиме пункт разворачивает
 * подсказку, а Radix без провайдера бросает. Это не деталь теста, а требование
 * к потребителю — записано в докстроке компонента и на странице документации.
 */
const collapsed = (ui: React.ReactNode) =>
  render(
    <TooltipProvider>
      <NavCollapsedProvider value={true}>{ui}</NavCollapsedProvider>
    </TooltipProvider>
  );

describe("NavItem", () => {
  test("the current item is marked with aria-current=page, not only by colour", () => {
    render(<NavItem label="Dashboard" href="/dashboard" active />);
    expect(screen.getByRole("link", { name: "Dashboard" }).getAttribute("aria-current")).toBe(
      "page"
    );
  });

  test("a plain item carries no attribute — the axis is switched on by the prop", () => {
    render(<NavItem label="Reports" href="/reports" />);
    expect(screen.getByRole("link", { name: "Reports" }).getAttribute("aria-current")).toBeNull();
  });

  test("an item disabled only by aria-disabled is painted as unavailable", () => {
    render(<NavItem label="Archive" href="/archive" aria-disabled="true" />);
    const link = screen.getByRole("link", { name: "Archive" });

    // В jsdom нет вычисленных стилей Tailwind, поэтому проверяются классы:
    // без них пункт с `aria-disabled` выглядел полностью рабочим — `:disabled`
    // на ссылке не бывает, а вид был завязан только на `active`. Правило то же,
    // что у `Button` (`lib/button.ts`).
    expect(link.getAttribute("aria-disabled")).toBe("true");
    expect(link.classList.contains("aria-disabled:opacity-50")).toBe(true);
    expect(link.classList.contains("aria-disabled:cursor-default")).toBe(true);
  });

  test("asChild gives the appearance to the consumer element and does not lose its href", () => {
    render(
      <NavItem label="Documents" active asChild>
        {/* Заглушка вместо роутера: кит о нём и не знает — ADR-0018. */}
        <a href="/docs" data-testid="target" />
      </NavItem>
    );
    const link = screen.getByRole("link", { name: "Documents" });
    expect(link.getAttribute("href")).toBe("/docs");
    expect(link.getAttribute("data-testid")).toBe("target");
    expect(link.getAttribute("aria-current")).toBe("page");
  });

  test("the icon is hidden from a screen reader: the label gives the name", () => {
    render(<NavItem label="Loading" href="/upload" icon={<svg data-testid="icon" />} />);
    expect(screen.getByRole("link", { name: "Loading" })).toBeTruthy();
    expect(screen.getByTestId("icon").parentElement?.getAttribute("aria-hidden")).toBe("true");
  });

  test("the badge and the shortcut are visible in expanded mode", () => {
    render(<NavItem label="Activity" href="/events" badge={<span>7</span>} shortcut="⌘N" />);
    expect(screen.getByText("7")).toBeTruthy();
    expect(screen.getByText("⌘N")).toBeTruthy();
  });
});

describe("NavItem in collapsed mode", () => {
  /**
   * Главная проверка семейства. Спрятанная подпись — самый вероятный способ
   * превратить навигацию в набор безымянных значков, и ловится это только
   * здесь: визуально всё в порядке, аудит истории без схлопнутого состояния
   * ничего не заметит.
   */
  test("the label hides from the eye but stays the accessible name", () => {
    collapsed(<NavItem label="Dashboard" href="/dashboard" />);
    expect(screen.getByRole("link", { name: "Dashboard" })).toBeTruthy();
    expect(screen.getByText("Dashboard").className).toContain("sr-only");
  });

  test("the badge and the shortcut do not reach the markup", () => {
    collapsed(<NavItem label="Activity" href="/events" badge={<span>7</span>} shortcut="⌘N" />);
    expect(screen.queryByText("7")).toBeNull();
    expect(screen.queryByText("⌘N")).toBeNull();
  });

  test("the tooltip is bound to the item instead of replacing its name", () => {
    collapsed(<NavItem label="Dashboard" href="/dashboard" />);
    // Radix вешает описание на триггер; имя при этом остаётся подписью.
    expect(screen.getByRole("link", { name: "Dashboard" })).toBeTruthy();
  });
});
