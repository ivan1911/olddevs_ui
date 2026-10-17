// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { Tabs, type TabItem } from "../src/components/navigation/Tabs.js";

/**
 * Keyboard handling and roving tabindex are the reason the tabs moved into the package:
 * the homemade buttons in SettingsModal could be clicked, but the arrows did not move
 * across them, and Tab stopped on every one. The WAI-ARIA contract is checked: focus
 * only on the active tab, and arrows move both focus and selection.
 */

afterEach(cleanup);

const ITEMS: TabItem[] = [
  { id: "profile", label: "Profile" },
  { id: "system", label: "System" },
  { id: "danger", label: "Danger zone" },
];

/** Controlled wrapper: automatic activation shows up only with live state. */
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
    // Inactive tabs have no link: their panels do not exist in the markup, and
    // `aria-controls` pointing at a missing id is an invalid value (axe: critical).
    expect(screen.getByRole("tab", { name: "System" }).getAttribute("aria-controls")).toBeNull();
  });
});
