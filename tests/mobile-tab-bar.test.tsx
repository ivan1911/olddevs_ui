// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { createRef, type ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { AppShell } from "../src/components/app-shell/AppShell.js";
import {
  BACKDROP_CLASS,
  MobileTabBar,
  MobileTabBarItem,
} from "../src/components/app-shell/MobileTabBar.js";
import { resetDevWarnings } from "../src/lib/dev-warn.js";

// The warning is shown once per module: without a reset, the order of the tests
// would decide which of them sees it.
beforeEach(resetDevWarnings);
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("MobileTabBar", () => {
  test("it is a landmark named from the message catalog", () => {
    render(
      <MobileTabBar>
        <MobileTabBarItem label="Home" href="/" />
      </MobileTabBar>
    );
    expect(screen.getByRole("navigation", { name: "Sections" })).toBeTruthy();
  });

  test("aria-label overrides the catalog", () => {
    render(
      <MobileTabBar aria-label="Workspace">
        <MobileTabBarItem label="Home" href="/" />
      </MobileTabBar>
    );
    expect(screen.getByRole("navigation", { name: "Workspace" })).toBeTruthy();
  });

  test("aria-labelledby names it by a visible heading, and the catalog name steps aside", () => {
    render(
      <>
        <h2 id="sections-heading">Workspace</h2>
        <MobileTabBar aria-labelledby="sections-heading">
          <MobileTabBarItem label="Home" href="/" />
        </MobileTabBar>
      </>
    );
    const nav = screen.getByRole("navigation", { name: "Workspace" });
    // There is no second name source: the catalog string does not sit next to it as dead weight.
    expect(nav.getAttribute("aria-label")).toBeNull();
  });

  test("an empty aria-label is not a name: the catalog default speaks instead", () => {
    render(
      <MobileTabBar aria-label="">
        <MobileTabBarItem label="Home" href="/" />
      </MobileTabBar>
    );
    expect(screen.getByRole("navigation", { name: "Sections" })).toBeTruthy();
  });

  test("the name is at most one of aria-label and aria-labelledby, and label is not a prop", () => {
    render(
      // @ts-expect-error — both name sources at once
      <MobileTabBar aria-label="A" aria-labelledby="b">
        <MobileTabBarItem label="Home" href="/" />
      </MobileTabBar>
    );
    cleanup();
    render(
      // @ts-expect-error — in the kit `label` means a visible caption, and the bar has none
      <MobileTabBar label="Workspace">
        <MobileTabBarItem label="Home" href="/" />
      </MobileTabBar>
    );
    expect(screen.queryByRole("navigation", { name: "Workspace" })).toBeNull();
  });

  test("forwards a ref to the navigation landmark", () => {
    const ref = createRef<HTMLElement>();
    render(
      <MobileTabBar ref={ref}>
        <MobileTabBarItem label="Home" href="/" />
      </MobileTabBar>
    );
    expect(ref.current).toBe(screen.getByRole("navigation"));
  });

  test("items are links reachable by Tab in reading order", async () => {
    const user = userEvent.setup();
    render(
      <MobileTabBar>
        <MobileTabBarItem label="Home" href="/" />
        <MobileTabBarItem label="Search" href="/search" />
      </MobileTabBar>
    );
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("link", { name: "Home" }));
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("link", { name: "Search" }));
  });

  test("an item link follows its href when clicked", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn((event: React.MouseEvent) => event.preventDefault());
    render(
      <MobileTabBar>
        <MobileTabBarItem label="Search" href="/search" onClick={onClick} />
      </MobileTabBar>
    );
    const link = screen.getByRole("link", { name: "Search" });
    expect(link.getAttribute("href")).toBe("/search");
    await user.click(link);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe("MobileTabBarItem", () => {
  test("the current item is marked with aria-current=page, not only by colour", () => {
    render(<MobileTabBarItem label="Home" href="/" active />);
    expect(screen.getByRole("link", { name: "Home" }).getAttribute("aria-current")).toBe("page");
  });

  test("a plain item carries no attribute — the axis is switched on by the prop", () => {
    render(<MobileTabBarItem label="Home" href="/" />);
    expect(screen.getByRole("link", { name: "Home" }).getAttribute("aria-current")).toBeNull();
  });

  test("asChild gives the appearance to the consumer element and keeps its href", () => {
    render(
      <MobileTabBarItem label="Documents" active asChild>
        {/* Stub in place of a router: the kit does not know about one — ADR-0018. */}
        <a href="/docs" data-testid="target" />
      </MobileTabBarItem>
    );
    const link = screen.getByRole("link", { name: "Documents" });
    expect(link.getAttribute("href")).toBe("/docs");
    expect(link.getAttribute("data-testid")).toBe("target");
    expect(link.getAttribute("aria-current")).toBe("page");
  });

  test("asChild without a child does not break the page and keeps the label", () => {
    // A JS consumer forgot the link inside: a Slot without a child would break the tree.
    expect(() => render(<MobileTabBarItem label="Inbox" asChild />)).not.toThrow();
    expect(screen.getByText("Inbox")).toBeTruthy();
  });

  test("without an icon the badge stands next to the label, not over an empty corner", () => {
    render(<MobileTabBarItem label="Inbox" href="/inbox" badge={3} />);
    // Without an icon there is nothing for the corner to attach to: the badge goes into the label row.
    const row = screen.getByText("Inbox").parentElement!;
    expect(row).not.toBe(screen.getByRole("link"));
    expect(row.contains(screen.getByText("3"))).toBe(true);
    expect(screen.getByRole("link", { name: "Inbox 3 new" })).toBeTruthy();
  });

  test("the icon is hidden from a screen reader: the label gives the name", () => {
    render(<MobileTabBarItem label="Home" href="/" icon={<svg data-testid="icon" />} />);
    expect(screen.getByRole("link", { name: "Home" })).toBeTruthy();
    expect(screen.getByTestId("icon").parentElement?.getAttribute("aria-hidden")).toBe("true");
  });

  test("a long label stays the full accessible name", () => {
    const label = "A very long section name that cannot fit a narrow tab";
    render(<MobileTabBarItem label={label} href="/long" />);
    expect(screen.getByRole("link", { name: label })).toBeTruthy();
  });
});

describe("MobileTabBarItem badge placement", () => {
  // jsdom does not compute the layout, so the binding classes are checked. How it
  // looks is checked by eye: App shell → MobileTabBar → Badges ("99+", "Beta", dot, "7").
  const badgeOf = (text: string | null) => {
    const icon = screen.getByTestId("icon").parentElement!;
    return icon.querySelector(text === null ? "span.size-2" : "span.absolute")!;
  };

  test.each([
    ["99+", 99_999],
    ["Beta", "Beta"],
  ])(
    "wide badge %s is pinned by its left edge to the icon corner and grows to the right",
    (_text, badge) => {
      render(
        <MobileTabBarItem label="Inbox" href="/" icon={<svg data-testid="icon" />} badge={badge} />
      );
      const cls = badgeOf("x").classList;
      expect(cls.contains("left-full")).toBe(true);
      expect(cls.contains("right-auto")).toBe(true);
      expect([...cls].some((c) => /^-?right-/.test(c) && c !== "right-auto")).toBe(false);
    }
  );

  test("the dot keeps its old place at the corner of the icon", () => {
    render(<MobileTabBarItem label="Inbox" href="/" icon={<svg data-testid="icon" />} badge />);
    expect(badgeOf(null).classList.contains("-ml-0.5")).toBe(true);
  });

  test("a short number overlaps the icon by the same 10px as before", () => {
    render(<MobileTabBarItem label="Inbox" href="/" icon={<svg data-testid="icon" />} badge={7} />);
    expect(badgeOf("7").classList.contains("-ml-2.5")).toBe(true);
  });
});

describe("MobileTabBarItem badge", () => {
  test("a number is shown and named for a screen reader with the real count", () => {
    render(<MobileTabBarItem label="Inbox" href="/inbox" badge={3} />);
    expect(screen.getByRole("link", { name: "Inbox 3 new" })).toBeTruthy();
    // A number is for the eye, a phrase is for the ear: the visible number is hidden from the screen reader.
    expect(screen.getByText("3").closest("[aria-hidden]")).toBeTruthy();
  });

  test("a number over the limit is shown capped, but the name keeps the real count", () => {
    render(<MobileTabBarItem label="Inbox" href="/inbox" badge={237} />);
    expect(screen.getByText("99+")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Inbox 237 new" })).toBeTruthy();
  });

  test("a dot carries a text for a screen reader", () => {
    render(<MobileTabBarItem label="Inbox" href="/inbox" badge />);
    expect(screen.getByRole("link", { name: "Inbox New" })).toBeTruthy();
  });

  test("badgeLabel replaces the default text", () => {
    render(
      <MobileTabBarItem label="Inbox" href="/inbox" badge={3} badgeLabel="3 unread messages" />
    );
    expect(screen.getByRole("link", { name: "Inbox 3 unread messages" })).toBeTruthy();
  });

  test("an empty badgeLabel is not a text: the default one speaks", () => {
    render(<MobileTabBarItem label="Inbox" href="/inbox" badge={3} badgeLabel="" />);
    expect(screen.getByRole("link", { name: "Inbox 3 new" })).toBeTruthy();
  });

  test("a string is shown in the badge pill and is its own text for a screen reader", () => {
    render(<MobileTabBarItem label="Inbox" href="/inbox" badge="Beta" />);
    expect(screen.getByRole("link", { name: "Inbox Beta" })).toBeTruthy();
    expect(screen.getByText("Beta", { selector: "[aria-hidden] *" })).toBeTruthy();
  });

  test("a custom element stands in the corner as is and speaks through badgeLabel", () => {
    render(
      <MobileTabBarItem
        label="Inbox"
        href="/inbox"
        badge={<span data-testid="custom-badge">!</span>}
        badgeLabel="Needs attention"
      />
    );
    expect(screen.getByTestId("custom-badge").closest("[aria-hidden]")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Inbox Needs attention" })).toBeTruthy();
  });

  test("a custom element without badgeLabel does not compile", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    // @ts-expect-error — a custom node must say what it means, otherwise it is heard as nothing
    render(<MobileTabBarItem label="Inbox" href="/inbox" badge={<span>!</span>} />);
    expect(screen.getByRole("link", { name: "Inbox" })).toBeTruthy();
  });

  test("zero and false show no badge and add nothing to the name", () => {
    render(
      <>
        <MobileTabBarItem label="Inbox" href="/inbox" badge={0} />
        <MobileTabBarItem label="Sent" href="/sent" badge={false} />
      </>
    );
    expect(screen.getByRole("link", { name: "Inbox" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Sent" })).toBeTruthy();
    expect(screen.queryByText("0")).toBeNull();
  });
});

/** The bar's backdrop: the first child of the navigation, hidden from the screen reader. */
const backdropOf = (nav: HTMLElement) => nav.querySelector(":scope > [aria-hidden]") as HTMLElement;

describe("MobileTabBar in the AppShell bottomBar slot", () => {
  test("it stands in the slot as the shell's own navigation landmark", () => {
    render(
      <AppShell
        bottomBar={
          <MobileTabBar>
            <MobileTabBarItem label="Home" href="/" active />
            <MobileTabBarItem label="Search" href="/search" />
          </MobileTabBar>
        }
      >
        Page
      </AppShell>
    );
    const nav = screen.getByRole("navigation", { name: "Sections" });
    expect(within(nav).getAllByRole("link")).toHaveLength(2);
  });

  // jsdom does not compute the backdrop height (it does not know `env()`), so the
  // contract is checked against the dictionary: the class here is the observable
  // (`docs/conventions.md`, "What the tests check").
  test("in the slot the backdrop reaches under the bar by the screen notch", () => {
    render(
      <AppShell
        bottomBar={
          <MobileTabBar>
            <MobileTabBarItem label="Home" href="/" />
          </MobileTabBar>
        }
      >
        Page
      </AppShell>
    );
    expect(backdropOf(screen.getByRole("navigation", { name: "Sections" })).className).toBe(
      BACKDROP_CLASS.inSlot
    );
  });

  test("outside the shell it is a plain row: the backdrop ends with the bar", () => {
    render(
      <MobileTabBar>
        <MobileTabBarItem label="Home" href="/" />
      </MobileTabBar>
    );
    expect(backdropOf(screen.getByRole("navigation")).className).toBe(BACKDROP_CLASS.standalone);
  });

  test("inside the shell but outside the slot it is a plain row too", () => {
    render(
      <AppShell>
        <MobileTabBar aria-label="Shortcuts">
          <MobileTabBarItem label="Home" href="/" />
        </MobileTabBar>
      </AppShell>
    );
    expect(backdropOf(screen.getByRole("navigation", { name: "Shortcuts" })).className).toBe(
      BACKDROP_CLASS.standalone
    );
  });
});

describe("MobileTabBarItem custom badge without badgeLabel", () => {
  // This is how a JS consumer passes it: the type does not let such a call through.
  const Untyped = MobileTabBarItem as unknown as (props: Record<string, unknown>) => ReactElement;
  const custom = <span data-testid="custom-badge">!</span>;

  test("warns in development: what was passed, what happens, the fix", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(<Untyped label="Inbox" href="/inbox" icon={<svg />} badge={custom} />);

    expect(warn).toHaveBeenCalledTimes(1);
    const text = String(warn.mock.calls[0]![0]);
    expect(text).toContain("MobileTabBarItem");
    expect(text).toContain("`badge`");
    expect(text).toContain("`badgeLabel`");
    expect(text).toMatch(/never announced/);
    // The badge is still visible: a warning, not a refusal.
    expect(screen.getByTestId("custom-badge")).toBeTruthy();
  });

  test("the warning is written once, however many items break the contract or re-render", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const bar = (
      <MobileTabBar>
        <Untyped label="One" href="/1" badge={custom} />
        <Untyped label="Two" href="/2" badge={custom} />
      </MobileTabBar>
    );
    const { rerender } = render(bar);
    rerender(bar);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  test("the warning is silent in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(<Untyped label="Inbox" href="/inbox" badge={custom} />);
    expect(warn).not.toHaveBeenCalled();
  });

  test("a custom badge with badgeLabel and a stock badge without it do not warn", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(
      <MobileTabBar>
        <MobileTabBarItem label="One" href="/1" badge={custom} badgeLabel="Needs attention" />
        <MobileTabBarItem label="Two" href="/2" badge={3} />
        <MobileTabBarItem label="Three" href="/3" />
      </MobileTabBar>
    );
    expect(warn).not.toHaveBeenCalled();
  });
});
