// @vitest-environment jsdom
import { TooltipProvider } from "@radix-ui/react-tooltip";
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { NavItem } from "../src/components/app-shell/NavItem.js";
import { NavGroup, SideNav, useNavCollapsed } from "../src/components/app-shell/SideNav.js";

afterEach(cleanup);

/**
 * `TooltipProvider` is a requirement of the collapsed mode, not a test convenience: the item shows
 * its hint there, and without the provider Radix throws.
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
    // The button changed its action, not only its icon.
    expect(screen.getByRole("button", { name: "Expand navigation" })).toBeTruthy();
  });

  test("defaultCollapsed sets the initial state", () => {
    shell(<SideNav defaultCollapsed>{items}</SideNav>);
    expect(screen.getByText("Dashboard").className).toContain("sr-only");
  });

  /**
   * Controlled mode is set by the PRESENCE of the prop, not by its value. If the two are mixed up,
   * `collapsed={false}` starts behaving as if there were no control, and the external button
   * silently stops working.
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
    // The caller did not apply the change, so the component stays expanded.
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

describe("SideNav: slots follow the mode", () => {
  /** Shows the mode as a word, so the test reads what a consumer would see. */
  const Mode = () => <span>{useNavCollapsed() ? "icons" : "full"}</span>;

  test("slot content reads the collapsed state", async () => {
    const user = userEvent.setup();
    shell(
      <SideNav header={<Mode />} footer={<Mode />}>
        {items}
      </SideNav>
    );

    expect(screen.getAllByText("full")).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: "Collapse navigation" }));
    expect(screen.getAllByText("icons")).toHaveLength(2);
  });

  test("outside SideNav the hook reports the expanded state", () => {
    shell(<Mode />);
    expect(screen.getByText("full")).toBeTruthy();
  });

  /**
   * The column narrows to an icon, and the consumer's slot may not know its width. Without
   * clipping, its text overflows onto the page content.
   */
  test("header and footer clip what does not fit", () => {
    shell(
      <SideNav defaultCollapsed header={<span>Brand</span>} footer={<span>Ada</span>}>
        {items}
      </SideNav>
    );

    expect(screen.getByText("Brand").parentElement!.className).toContain("overflow-x-clip");
    expect(screen.getByText("Ada").parentElement!.className).toContain("overflow-x-clip");
  });
});
