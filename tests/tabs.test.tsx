// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { Tabs, type TabItem } from "../src/components/navigation/Tabs.js";

/**
 * Клавиатура и roving tabindex — то, ради чего вкладки переехали в пакет:
 * самодельные кнопки в SettingsModal были кликабельны, но стрелки по ним
 * не ходили, а таб останавливался на каждой. Проверяется контракт WAI-ARIA:
 * фокус — только на активной, стрелки двигают и фокус, и выбор.
 */

afterEach(cleanup);

const ITEMS: TabItem[] = [
  { id: "profile", label: "Profile" },
  { id: "system", label: "System" },
  { id: "danger", label: "Danger zone" },
];

/** Управляемая обёртка: automatic activation виден только с живым стейтом. */
function Controlled({
  orientation,
  onChange,
}: {
  orientation?: "vertical" | "horizontal";
  onChange?: (id: string) => void;
}) {
  const [tab, setTab] = useState("profile");
  return (
    <Tabs
      items={ITEMS}
      value={tab}
      orientation={orientation}
      onChange={(id) => {
        setTab(id);
        onChange?.(id);
      }}
    />
  );
}

describe("Tabs", () => {
  test("a click selects the tab", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);

    await user.click(screen.getByRole("tab", { name: "System" }));
    expect(onChange).toHaveBeenCalledWith("system");
  });

  test("tab reaches only the active tab — roving tabindex", () => {
    render(<Controlled />);

    expect(screen.getByRole("tab", { name: "Profile" }).tabIndex).toBe(0);
    expect(screen.getByRole("tab", { name: "System" }).tabIndex).toBe(-1);
    expect(screen.getByRole("tab", { name: "Danger zone" }).tabIndex).toBe(-1);
  });

  test("the right arrow moves both focus and selection (automatic activation)", async () => {
    const user = userEvent.setup();
    render(<Controlled />);

    await user.click(screen.getByRole("tab", { name: "Profile" }));
    await user.keyboard("{ArrowRight}");

    const system = screen.getByRole("tab", { name: "System" });
    expect(system.getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(system);
  });

  test("in vertical orientation ↑↓ work, not ←→", async () => {
    const user = userEvent.setup();
    render(<Controlled orientation="vertical" />);

    await user.click(screen.getByRole("tab", { name: "Profile" }));
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Profile" }).getAttribute("aria-selected")).toBe("true");

    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("tab", { name: "System" }).getAttribute("aria-selected")).toBe("true");
  });

  test("the edges do not wrap, Home/End go to the first/last", async () => {
    const user = userEvent.setup();
    render(<Controlled />);

    await user.click(screen.getByRole("tab", { name: "Profile" }));
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("tab", { name: "Profile" }).getAttribute("aria-selected")).toBe("true");

    await user.keyboard("{End}");
    expect(screen.getByRole("tab", { name: "Danger zone" }).getAttribute("aria-selected")).toBe(
      "true"
    );
    await user.keyboard("{Home}");
    expect(screen.getByRole("tab", { name: "Profile" }).getAttribute("aria-selected")).toBe("true");
  });

  test("only the active tab references the panel", () => {
    render(<Controlled />);

    expect(screen.getByRole("tab", { name: "Profile" }).getAttribute("aria-controls")).toBe(
      "profile-panel"
    );
    // У неактивных ссылки нет: их панели в разметке не существует, и
    // `aria-controls` на отсутствующий id — невалидное значение (axe: critical).
    expect(screen.getByRole("tab", { name: "System" }).getAttribute("aria-controls")).toBeNull();
  });
});
