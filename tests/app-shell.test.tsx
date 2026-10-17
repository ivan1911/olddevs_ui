// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { StrictMode, useState } from "react";
import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import { AppShell, useAppShell } from "../src/components/app-shell/AppShell.js";
import { NavItem } from "../src/components/app-shell/NavItem.js";
import { NavGroup, SideNav, useNavCollapsed } from "../src/components/app-shell/SideNav.js";
import { TooltipProvider } from "../src/components/overlays/Tooltip.js";
import { TopBar } from "../src/components/app-shell/TopBar.js";

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("style");
  vi.restoreAllMocks();
});

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

describe("AppShell: layout and landmarks", () => {
  test("content sits inside <main>", () => {
    render(<AppShell>Page</AppShell>);
    expect(screen.getByRole("main").textContent).toBe("Page");
  });

  test("the skip link is the first focusable element and leads to <main>", async () => {
    const user = userEvent.setup();
    render(
      <AppShell>
        <button>First button on the page</button>
      </AppShell>
    );

    await user.tab();
    const skip = screen.getByRole("link", { name: "Skip to content" });
    expect(document.activeElement).toBe(skip);
    // The link target is `<main>` itself, not a neighboring node.
    expect(skip.getAttribute("href")).toBe(`#${screen.getByRole("main").id}`);
  });

  /**
   * The skip link's `focus:absolute` is positioned against the nearest positioned
   * ancestor: without `relative` on the root, a nested shell would show the link
   * somewhere on the page instead of above itself.
   */
  test("the root is positioned — the link floats above its own frame", () => {
    const { container } = render(<AppShell>Page</AppShell>);
    expect(container.firstElementChild?.className).toContain("relative");
  });

  test("absent slots do not reach the markup", () => {
    render(<AppShell>Page</AppShell>);
    expect(screen.queryByRole("complementary")).toBeNull();
    expect(screen.queryByRole("navigation")).toBeNull();
  });

  test("the aside appears only with content", () => {
    render(<AppShell aside={<div>Details</div>}>Page</AppShell>);
    expect(screen.getByRole("complementary").textContent).toBe("Details");
  });
});

/**
 * The bottom bar slot is wired without a component (ADR-0018): the shell has to know
 * that a bar taking height and safe-area can sit at the bottom. The test checks that
 * a missing bar takes no space, and a provided one gets its offset.
 */
describe("AppShell: bottom bar slot", () => {
  const SAFE_AREA = ".pb-\\[env\\(safe-area-inset-bottom\\,0px\\)\\]";

  test("without the bar no height is eaten", () => {
    const { container } = render(<AppShell>Page</AppShell>);
    expect(container.querySelector(SAFE_AREA)).toBeNull();
  });

  test("with the bar a safe-area inset appears", () => {
    const { container } = render(<AppShell bottomBar={<nav>Sections</nav>}>Page</AppShell>);
    const bar = container.querySelector(SAFE_AREA);
    expect(bar).toBeTruthy();
    expect(bar?.textContent).toBe("Sections");
  });
});

describe("AppShell: focus returns on route change", () => {
  function Routed() {
    const [route, setRoute] = useState("a");
    return (
      <AppShell routeKey={route}>
        <button onClick={() => setRoute("b")}>Go</button>
      </AppShell>
    );
  }

  test("focus is not taken on the first render", () => {
    render(<Routed />);
    // Otherwise the shell would steal focus from a user who has already started working.
    expect(document.activeElement).toBe(document.body);
  });

  test("changing the key moves focus into <main>", async () => {
    const user = userEvent.setup();
    render(<Routed />);

    await user.click(screen.getByRole("button", { name: "Go" }));
    expect(document.activeElement).toBe(screen.getByRole("main"));
  });

  /*
    In dev, StrictMode mounts the component, unmounts it, and mounts it again, so
    effects run twice. Skipping the first pass with a flag in a ref did not survive
    that: by the second run the flag was already reset, and focus moved to `<main>`
    on the first load, while the browser scrolled the page to it under the header
    (OLDSUI-201).
  */
  test("under StrictMode focus is not taken on the first render either", () => {
    render(
      <StrictMode>
        <Routed />
      </StrictMode>
    );
    expect(document.activeElement).toBe(document.body);
  });

  test("under StrictMode changing the key still moves focus into <main>", async () => {
    const user = userEvent.setup();
    render(
      <StrictMode>
        <Routed />
      </StrictMode>
    );

    await user.click(screen.getByRole("button", { name: "Go" }));
    expect(document.activeElement).toBe(screen.getByRole("main"));
  });

  test("focus moves into <main> without scrolling to it", async () => {
    // The router sets the scroll on navigation; focus must not do it too, or `<main>`
    // ends up under the sticky header. The bug lived under StrictMode.
    const focus = vi.spyOn(HTMLElement.prototype, "focus");
    const user = userEvent.setup();
    render(
      <StrictMode>
        <Routed />
      </StrictMode>
    );

    await user.click(screen.getByRole("button", { name: "Go" }));
    const main = screen.getByRole("main");
    expect(focus.mock.contexts).toContain(main);
    expect(focus.mock.calls[focus.mock.contexts.indexOf(main)]).toEqual([{ preventScroll: true }]);
  });

  test("without a route key focus is not touched at all", async () => {
    const user = userEvent.setup();
    render(
      <AppShell>
        <button>Button</button>
      </AppShell>
    );

    const button = screen.getByRole("button", { name: "Button" });
    await user.click(button);
    expect(document.activeElement).toBe(button);
  });
});

describe("AppShell and TopBar: the navigation button", () => {
  test("no navigation, no button", () => {
    render(
      <AppShell header={<TopBar />}>
        <div>Page</div>
      </AppShell>
    );
    expect(screen.queryByRole("button", { name: "Open navigation" })).toBeNull();
  });

  test("with navigation the header gets the button itself, without a slot", async () => {
    const user = userEvent.setup();
    render(
      <AppShell header={<TopBar />} sidebar={<nav aria-label="Sections">Items</nav>}>
        <div>Page</div>
      </AppShell>
    );

    await user.click(screen.getByRole("button", { name: "Open navigation" }));
    // The drawer with the navigation inside is the one meant here, not the column,
    // which has its own name.
    expect(screen.getByRole("dialog", { name: "Main navigation" })).toBeTruthy();
  });

  test("a header outside the frame draws no button", () => {
    render(<TopBar />);
    expect(screen.queryByRole("button", { name: "Open navigation" })).toBeNull();
  });
});

/**
 * Navigation in a drawer: the icon-only mode makes no sense there. It exists to give
 * the width back to the page content, and next to an overlay there is no page content.
 */
describe("SideNav inside the drawer", () => {
  const nav = (props: { collapsed?: boolean; defaultCollapsed?: boolean } = {}) => (
    <SideNav {...props}>
      <NavGroup label="Work">
        <NavItem label="Dashboard" href="/dashboard" active />
      </NavGroup>
    </SideNav>
  );

  const openDrawer = async (ui: React.ReactNode) => {
    const user = userEvent.setup();
    render(
      <TooltipProvider>
        <AppShell header={<TopBar />} sidebar={ui}>
          <div>Page</div>
        </AppShell>
      </TooltipProvider>
    );
    await user.click(screen.getByRole("button", { name: "Open navigation" }));
  };

  test("there is no collapse button inside the drawer", async () => {
    await openDrawer(nav());
    const drawer = screen.getByRole("dialog", { name: "Main navigation" });
    expect(within(drawer).queryByRole("button", { name: "Collapse navigation" })).toBeNull();
    expect(within(drawer).queryByRole("button", { name: "Expand navigation" })).toBeNull();
  });

  /**
   * The main half of the fix. Removing the button and keeping `collapsed` in force
   * would be WORSE than the original defect: a consumer that holds the collapsed state
   * from the outside would get icons in the drawer with no way to expand them.
   */
  test("outer collapsing has no effect inside the drawer — labels stay visible", async () => {
    await openDrawer(nav({ collapsed: true }));
    const drawer = screen.getByRole("dialog", { name: "Main navigation" });
    expect(within(drawer).getByText("Dashboard").className).not.toContain("sr-only");
    // The section heading comes back too: when collapsed, it was just a line.
    expect(within(drawer).getByText("Work")).toBeTruthy();
  });

  test("defaultCollapsed has no effect inside the drawer either", async () => {
    await openDrawer(nav({ defaultCollapsed: true }));
    const drawer = screen.getByRole("dialog", { name: "Main navigation" });
    expect(within(drawer).getByText("Dashboard").className).not.toContain("sr-only");
  });

  // Consumer slots see the same expanded mode as the items: otherwise the footer
  // in the drawer would render a lone avatar next to labeled items.
  test("slot content inside the drawer reads the expanded state", async () => {
    const Mode = () => <span>{useNavCollapsed() ? "icons" : "full"}</span>;
    await openDrawer(
      <SideNav collapsed footer={<Mode />}>
        <NavGroup label="Work">
          <NavItem label="Dashboard" href="/dashboard" active />
        </NavGroup>
      </SideNav>
    );
    const drawer = screen.getByRole("dialog", { name: "Main navigation" });
    expect(within(drawer).getByText("full")).toBeTruthy();
  });

  test("the column outside the drawer still collapses", () => {
    render(
      <TooltipProvider>
        <AppShell sidebar={nav({ defaultCollapsed: true })}>
          <div>Page</div>
        </AppShell>
      </TooltipProvider>
    );
    // The drawer is closed, so only the column is in the markup, and it is collapsed, as requested.
    expect(screen.getByText("Dashboard").className).toContain("sr-only");
    expect(screen.getByRole("button", { name: "Expand navigation" })).toBeTruthy();
  });
});

/**
 * Regression: `openNavigation` could only read the kit's `TopBar`, so a custom header
 * got navigation that cannot be opened below `md`: the column is hidden, nothing opens
 * the drawer, and there is no warning. The defect is silent: on a wide screen everything
 * works, and the section is unreachable only on a narrow one.
 */
describe("useAppShell: a custom header instead of the kit one", () => {
  function OwnHeader() {
    const { openNavigation } = useAppShell();
    return (
      <header>{openNavigation ? <button onClick={openNavigation}>Menu</button> : null}</header>
    );
  }

  test("a custom header gets a way to open the navigation", async () => {
    const user = userEvent.setup();
    render(
      <AppShell header={<OwnHeader />} sidebar={<nav aria-label="Sections">Items</nav>}>
        <div>Page</div>
      </AppShell>
    );

    await user.click(screen.getByRole("button", { name: "Menu" }));
    expect(screen.getByRole("dialog", { name: "Main navigation" })).toBeTruthy();
  });

  test("without a sidebar there is no way — and nothing to draw a button for", () => {
    render(
      <AppShell header={<OwnHeader />}>
        <div>Page</div>
      </AppShell>
    );
    expect(screen.queryByRole("button", { name: "Menu" })).toBeNull();
  });

  test("outside the frame the hook returns an empty object instead of throwing", () => {
    render(<OwnHeader />);
    expect(screen.queryByRole("button", { name: "Menu" })).toBeNull();
  });
});

test("without the banners slot the markup does not change by a single node", () => {
  // The slot is added to the STABLE shell of wave 17, and the price of such a change
  // is a promise that without the slot the shell stays as it was. The whole markup is
  // compared: otherwise the promise would rest on our guess about which node to check.
  const shell = (props: { banners?: React.ReactNode }) => (
    <AppShell header={<div>Header</div>} {...props}>
      Content
    </AppShell>
  );

  const { container, rerender } = render(shell({}));
  const without = container.innerHTML;

  rerender(shell({ banners: undefined }));
  expect(container.innerHTML).toBe(without);
  // There is no empty `div` for banners in the markup: the node is not there at all.
  expect(without).not.toContain("banner");
});

test("banners sit above the header, not below it", () => {
  render(
    <AppShell
      banners={<div data-testid="bn">Maintenance in progress</div>}
      header={<div>Header</div>}
    >
      Content
    </AppShell>
  );

  // Markup order is screen order: a banner under the header would put an app-state
  // message below the navigation it refers to.
  const column = screen.getByTestId("bn").parentElement!;
  const nodes = Array.from(column.children).map((n) => n.textContent);
  expect(nodes[0]).toBe("Maintenance in progress");
  expect(nodes[1]).toBe("Header");
});

test("the header under banners stays sticky at zero", () => {
  render(
    <AppShell banners={<div>Maintenance in progress</div>} header={<TopBar label="Header" />}>
      Content
    </AppShell>
  );

  // The `--topbar-h` contract is left as is: a sticky stack of banners would need a
  // second offset variable, and everything computed from `--topbar-h` would have to
  // add its height (ADR-0027).
  expect(screen.getByRole("banner").className).toContain("sticky");
  expect(screen.getByRole("banner").className).toContain("top-0");
});
