// @vitest-environment jsdom
import { TooltipProvider } from "@radix-ui/react-tooltip";
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { NavItem } from "../src/components/app-shell/NavItem.js";
import { NavGroup, SideNav } from "../src/components/app-shell/SideNav.js";

afterEach(cleanup);

/**
 * `TooltipProvider` — требование схлопнутого режима, а не удобство теста:
 * пункт разворачивает в нём подсказку, и без провайдера Radix бросает.
 */
const shell = (ui: React.ReactNode) => render(<TooltipProvider>{ui}</TooltipProvider>);

const items = (
  <NavGroup label="Work">
    <NavItem label="Dashboard" href="/dashboard" active />
    <NavItem label="Documents" href="/docs" />
  </NavGroup>
);

describe("SideNav", () => {
  test("it is a landmark named from the message catalog", () => {
    shell(<SideNav>{items}</SideNav>);
    expect(screen.getByRole("navigation", { name: "Main navigation" })).toBeTruthy();
  });

  test("a custom name overrides the catalog", () => {
    shell(<SideNav label="Report sections">{items}</SideNav>);
    expect(screen.getByRole("navigation", { name: "Report sections" })).toBeTruthy();
  });
});

describe("SideNav: who owns collapsing", () => {
  test("uncontrolled mode holds the state itself", async () => {
    const user = userEvent.setup();
    shell(<SideNav>{items}</SideNav>);

    expect(screen.getByText("Dashboard").className).not.toContain("sr-only");
    await user.click(screen.getByRole("button", { name: "Collapse navigation" }));
    expect(screen.getByText("Dashboard").className).toContain("sr-only");
    // Кнопка сменила действие, а не только значок.
    expect(screen.getByRole("button", { name: "Expand navigation" })).toBeTruthy();
  });

  test("defaultCollapsed sets the initial state", () => {
    shell(<SideNav defaultCollapsed>{items}</SideNav>);
    expect(screen.getByText("Dashboard").className).toContain("sr-only");
  });

  /**
   * Управляемым режим делает НАЛИЧИЕ пропа, а не его значение. Если перепутать,
   * `collapsed={false}` начнёт вести себя как «управления нет», и внешняя
   * кнопка перестанет работать — молча.
   */
  test("controlled mode does not change the state itself", async () => {
    const user = userEvent.setup();
    const onCollapsedChange = vi.fn();
    shell(
      <SideNav collapsed={false} onCollapsedChange={onCollapsedChange}>
        {items}
      </SideNav>
    );

    await user.click(screen.getByRole("button", { name: "Collapse navigation" }));
    expect(onCollapsedChange).toHaveBeenCalledWith(true);
    // Вызывающий не применил — компонент остался развёрнутым.
    expect(screen.getByText("Dashboard").className).not.toContain("sr-only");
  });

  test("controlled mode obeys the caller", async () => {
    const user = userEvent.setup();
    function Controlled() {
      const [collapsed, setCollapsed] = useState(false);
      return (
        <SideNav collapsed={collapsed} onCollapsedChange={setCollapsed}>
          {items}
        </SideNav>
      );
    }
    shell(<Controlled />);

    await user.click(screen.getByRole("button", { name: "Collapse navigation" }));
    expect(screen.getByText("Dashboard").className).toContain("sr-only");
  });

  test("collapsible=false removes the built-in button", () => {
    shell(<SideNav collapsible={false}>{items}</SideNav>);
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("NavGroup", () => {
  test("the group is named by the section heading", () => {
    shell(<SideNav>{items}</SideNav>);
    expect(screen.getByRole("group", { name: "Work" })).toBeTruthy();
  });

  test("when collapsed the heading leaves the screen and the group name stays", () => {
    shell(<SideNav defaultCollapsed>{items}</SideNav>);
    expect(screen.getByRole("group", { name: "Work" })).toBeTruthy();
    expect(screen.queryByText("Work")).toBeNull();
  });
});
