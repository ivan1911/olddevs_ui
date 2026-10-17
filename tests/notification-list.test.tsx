// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import type { ComponentType } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { NotificationItem, NotificationList } from "../src/components/content/NotificationList.js";
import { resetDevWarnings } from "../src/lib/dev-warn.js";

// The warning is shown once per module: without a reset, the order of the tests
// would decide which of them sees it.
beforeEach(resetDevWarnings);
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

test("unread is audible, not only visible", () => {
  render(
    <NotificationList>
      <NotificationItem title="Publishing failed" unread />
      <NotificationItem title="Channel connected" />
    </NotificationList>
  );

  const rows = screen.getAllByRole("listitem");
  // The dot and the tint are signals for the eye. Without the word, a person who
  // cannot see them would not tell a new event from an old one at all.
  expect(within(rows[0]!).getByText("Unread")).toBeTruthy();
  expect(within(rows[1]!).queryByText("Unread")).toBeNull();
});

test("the unread dot is not read aloud separately", () => {
  const { container } = render(
    <NotificationList>
      <NotificationItem title="Event" unread />
    </NotificationList>
  );

  // Otherwise a screen reader would announce it as an unnamed node next to the word.
  const dot = container.querySelector('[aria-hidden="true"]');
  expect(dot).toBeTruthy();
  expect(dot!.textContent).toBe("");
});

test("the list is named and announces the number of rows", () => {
  render(
    <NotificationList>
      <NotificationItem title="One" />
      <NotificationItem title="Two" />
    </NotificationList>
  );

  expect(screen.getByRole("group", { name: "Notifications" })).toBeTruthy();
  expect(screen.getAllByRole("listitem")).toHaveLength(2);
});

test("groups arrive ready-made and are announced by a label", () => {
  render(
    <NotificationList
      groups={[
        { id: "today", label: "Today", children: <NotificationItem title="One" /> },
        { id: "older", label: "Earlier", children: <NotificationItem title="Two" /> },
      ]}
    />
  );

  // What "yesterday" means is known to the consumer's locale and time zone, not to the kit.
  const today = screen.getByRole("group", { name: "Today" });
  expect(within(today).getByText("One")).toBeTruthy();
  expect(screen.getByRole("group", { name: "Earlier" })).toBeTruthy();
});

test("a group does not take a heading level", () => {
  render(
    <NotificationList
      groups={[{ id: "today", label: "Today", children: <NotificationItem title="One" /> }]}
    />
  );

  // The level depends on where the list sits (in a popover, in a drawer, or on a
  // page), and the kit does not know that.
  expect(screen.queryByRole("heading")).toBeNull();
});

test("an empty list yields its own state and draws no list", () => {
  render(<NotificationList groups={[]} empty={<p>Quiet for now</p>} />);

  expect(screen.getByText("Quiet for now")).toBeTruthy();
  expect(screen.queryByRole("list")).toBeNull();
});

test("a list without rows counts as empty too", () => {
  render(<NotificationList empty={<p>Quiet for now</p>} />);
  expect(screen.getByText("Quiet for now")).toBeTruthy();
});

test("a row neither marks itself read nor navigates", () => {
  render(
    <NotificationList>
      <NotificationItem
        title="Event"
        actions={<button type="button">Read</button>}
        description="Details"
        time="5 minutes ago"
      />
    </NotificationList>
  );

  // Actions come from outside: both the navigation and the marking belong to the application.
  expect(screen.getByRole("button", { name: "Read" })).toBeTruthy();
  expect(screen.getByText("5 minutes ago")).toBeTruthy();
  expect(screen.getByText("Details")).toBeTruthy();
});

test("media sits beside the text and does not replace the icon", () => {
  render(
    <NotificationList>
      <NotificationItem
        title="Event"
        icon={<span data-testid="icon" />}
        media={<img data-testid="media" alt="" src="data:," />}
      />
    </NotificationList>
  );

  // The icon is the event type, the preview is the object it is about. Two independent slots.
  const row = screen.getByRole("listitem");
  expect(within(row).getByTestId("icon")).toBeTruthy();
  expect(within(row).getByTestId("media")).toBeTruthy();
});

test("an empty media is no media: no blank slot beside the text", () => {
  render(
    <NotificationList>
      <NotificationItem title="Event" media="" />
    </NotificationList>
  );

  // An empty slot is an extra gap before the heading: the row looks shifted.
  const row = screen.getByRole("listitem");
  expect(row.querySelector("span:empty")).toBeNull();
});

test("without onAction the row has no button of its own", () => {
  render(
    <NotificationList>
      <NotificationItem title="Event" />
    </NotificationList>
  );

  expect(screen.queryByRole("button")).toBeNull();
});

test("onAction turns the whole row into one button named by the title", () => {
  render(
    <NotificationList>
      <NotificationItem
        title="Publishing failed"
        description="The channel is disconnected."
        time="5 minutes ago"
        unread
        onAction={() => {}}
      />
    </NotificationList>
  );

  // The row stays a list item; the button sits inside it.
  const row = screen.getByRole("listitem");
  const button = within(row).getByRole("button", { name: "Publishing failed Unread" });
  // The name is the title and the word "unread", not the whole content of the row.
  expect(button.getAttribute("aria-label")).toBeNull();
  expect(screen.queryByRole("button", { name: /disconnected/ })).toBeNull();
  // The rest of the text is not lost: it is the button's description.
  expect(button.getAttribute("aria-describedby")).toBeTruthy();
  expect(screen.getByRole("button", { description: /disconnected.*5 minutes ago/ })).toBe(button);
});

test("a read row with onAction is named by the title alone", () => {
  render(
    <NotificationList>
      <NotificationItem title="Report ready" onAction={() => {}} />
    </NotificationList>
  );

  expect(screen.getByRole("button", { name: "Report ready" })).toBeTruthy();
});

test("the row button is activated by click, Enter and Space", async () => {
  const user = userEvent.setup();
  const onAction = vi.fn();
  render(
    <NotificationList>
      <NotificationItem title="Event" onAction={onAction} />
    </NotificationList>
  );

  // The keyboard is the standard button behavior, with no key handler of its own.
  await user.tab();
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Event" }));
  await user.keyboard("{Enter}");
  expect(onAction).toHaveBeenCalledTimes(1);
  await user.keyboard(" ");
  expect(onAction).toHaveBeenCalledTimes(2);

  await user.click(screen.getByRole("button", { name: "Event" }));
  expect(onAction).toHaveBeenCalledTimes(3);
});

test("the row button holds no nested interactive elements", () => {
  render(
    <NotificationList>
      <NotificationItem
        title="Event"
        description="Details"
        icon={<span>!</span>}
        media={<img alt="" src="data:," />}
        onAction={() => {}}
      />
    </NotificationList>
  );

  const button = screen.getByRole("button");
  expect(button.querySelector("a, button, input, select, textarea, [tabindex]")).toBeNull();
  // Only phrasing content is allowed inside a button.
  expect(button.querySelector("div, p, ul, h1, h2, h3, h4")).toBeNull();
});

test("onAction together with actions (plain JS): actions win, the page does not crash", async () => {
  const user = userEvent.setup();
  const onAction = vi.fn();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  render(
    <NotificationList>
      <Untyped title="Event" onAction={onAction} actions={<button type="button">Read</button>} />
    </NotificationList>
  );

  // A nested button inside a button is invalid, and `actions` is the only path to
  // an action that the consumer might not have duplicated. We drop `onAction`
  // rather than hide the controls.
  const buttons = screen.getAllByRole("button");
  expect(buttons.map((b) => b.textContent)).toEqual(["Read"]);
  await user.click(buttons[0]!);
  expect(onAction).not.toHaveBeenCalled();
});

// Untyped: this is how a JS consumer passes it, and the types forbid the combination.
const Untyped = NotificationItem as unknown as ComponentType<Record<string, unknown>>;

test("onAction together with actions warns in development: what was passed, who won, the fix", () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  render(
    <NotificationList>
      <Untyped title="Event" onAction={() => {}} actions={<button type="button">Read</button>} />
    </NotificationList>
  );

  expect(warn).toHaveBeenCalledTimes(1);
  const text = String(warn.mock.calls[0]![0]);
  expect(text).toContain("NotificationItem");
  expect(text).toContain("onAction");
  expect(text).toContain("actions");
  expect(text).toMatch(/wins/);
  expect(text).toMatch(/Pass only one/);
});

test("the warning is written once, however many rows break the contract or re-render", () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const rows = (
    <NotificationList>
      <Untyped title="One" onAction={() => {}} actions={<span />} />
      <Untyped title="Two" onAction={() => {}} actions={<span />} />
    </NotificationList>
  );
  const { rerender } = render(rows);
  rerender(rows);
  rerender(
    <NotificationList>
      <Untyped title="Three" onAction={() => {}} actions={<span />} />
    </NotificationList>
  );

  expect(warn).toHaveBeenCalledTimes(1);
});

test("the warning is silent in production", () => {
  vi.stubEnv("NODE_ENV", "production");
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  render(
    <NotificationList>
      <Untyped title="Event" onAction={() => {}} actions={<span />} />
    </NotificationList>
  );

  expect(warn).not.toHaveBeenCalled();
});

test("one of the two props is not a contract violation: no warning", () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  render(
    <NotificationList>
      <NotificationItem title="With button" onAction={() => {}} />
      <NotificationItem title="With actions" actions={<button type="button">Read</button>} />
      <NotificationItem title="Plain" />
    </NotificationList>
  );

  expect(warn).not.toHaveBeenCalled();
});

test("types forbid onAction together with actions", () => {
  // Checked at the `typecheck` stage: the directive fails if the combination is ever allowed.
  const element = (
    // @ts-expect-error — `actions` and `onAction` are mutually exclusive
    <NotificationItem title="Event" onAction={() => {}} actions={<span />} />
  );
  expect(element).toBeTruthy();
});

test("an empty description is not referenced by the button", () => {
  render(
    <NotificationList>
      <NotificationItem title="Event" description="" time={false} onAction={() => {}} />
    </NotificationList>
  );

  expect(screen.getByRole("button").getAttribute("aria-describedby")).toBeNull();
});
