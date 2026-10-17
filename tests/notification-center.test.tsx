// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { NotificationCenter } from "../src/components/content/NotificationCenter.js";
import { NotificationItem, NotificationList } from "../src/components/content/NotificationList.js";

afterEach(cleanup);

const feed = (
  <NotificationList>
    <NotificationItem title="Event" unread />
  </NotificationList>
);

test("the count arrives as a prop instead of being counted from rows", () => {
  render(
    <NotificationCenter unreadCount={300}>
      <NotificationList>
        <NotificationItem title="One" unread />
        <NotificationItem title="Two" unread />
      </NotificationList>
    </NotificationCenter>
  );

  // A list can be a collection page: "2" instead of "300" is not rounding, it is a lie.
  //
  // To the eye, `Badge` truncates the large number to "99+", but the NAME stays
  // exact: truncation saves space and does not lose data, and a screen reader
  // hears the real count.
  /*
    The TEXT that is actually spoken is checked, not an attribute.

    It was `getByLabelText("300 unread")`, but the name sat as an `aria-label` on
    `Badge`, that is on a `<span>` with no role. A `generic` role does not support
    an author-given name, the browser discards it, and the screen reader announced
    a bare "3". A labelText query reads the DOM attribute directly and passed
    whether or not the accessibility tree recognised it: the same kind of false
    confidence as the `offsetHeight` and `IntersectionObserver` stubs.
  */
  expect(screen.getByText("300 unread")).toBeTruthy();
  // To the eye the number is truncated, and it is hidden from speech so it is not read twice.
  expect(screen.getByText("99+").getAttribute("aria-hidden")).toBe("true");
});

test("a zero count is not drawn at all", () => {
  render(<NotificationCenter unreadCount={0}>{feed}</NotificationCenter>);
  expect(screen.queryByText("0")).toBeNull();
});

test("without selection there is no bulk-actions bar", () => {
  render(<NotificationCenter>{feed}</NotificationCenter>);
  expect(screen.queryByRole("group", { name: /Selected|Selected/ })).toBeNull();
});

test("bulk actions go through SelectionBar, not through a bar of its own", async () => {
  const user = userEvent.setup();
  const onClear = vi.fn();
  render(
    <NotificationCenter
      selectedCount={3}
      onClearSelection={onClear}
      selectionActions={<button type="button">Mark as read</button>}
    >
      {feed}
    </NotificationCenter>
  );

  expect(screen.getByText("3 selected")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Mark as read" })).toBeTruthy();

  await user.click(screen.getByRole("button", { name: "Clear selection" }));
  expect(onClear).toHaveBeenCalledTimes(1);
});

test("the selection bar does not stick: there is nothing to stick to in a popover", () => {
  const { container } = render(<NotificationCenter selectedCount={1}>{feed}</NotificationCenter>);
  // A hard-coded `--topbar-h` would push the bar under someone else's app header.
  const bar = container.querySelector('[role="group"][class*="border"]') as HTMLElement;
  expect(bar.className).not.toContain("sticky");
});

test("the centre neither opens nor closes itself", () => {
  const { container } = render(<NotificationCenter>{feed}</NotificationCenter>);

  // The center has no surface of its own: it is the content of a `Popover`, a `Drawer`, or a page.
  expect(container.querySelector('[role="dialog"]')).toBeNull();
  expect(screen.queryByRole("button", { name: /close|close/i })).toBeNull();
});

test("filters, actions and the footer are slots", () => {
  render(
    <NotificationCenter
      title="Events"
      filters={<button type="button">Unread only</button>}
      actions={<button type="button">Mark all read</button>}
      footer={<a href="#all">Show all</a>}
    >
      {feed}
    </NotificationCenter>
  );

  expect(screen.getByText("Events")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Unread only" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Mark all read" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Show all" })).toBeTruthy();
});

test("without the new props the title stays a plain text node, not a heading", () => {
  const { container } = render(<NotificationCenter title="Events">{feed}</NotificationCenter>);

  // Without `level` and `titleId` the markup does not change: no heading, no id.
  expect(screen.queryByRole("heading")).toBeNull();
  expect(screen.getByText("Events").tagName).toBe("SPAN");
  expect(container.querySelector("[id]")).toBeNull();
});

test.each([2, 3, 4] as const)("level=%i makes the title a real heading", (level) => {
  render(
    <NotificationCenter title="Events" level={level}>
      {feed}
    </NotificationCenter>
  );

  expect(screen.getByRole("heading", { name: "Events", level })).toBeTruthy();
});

test("the default title is a heading too when a level is given", () => {
  render(<NotificationCenter level={3}>{feed}</NotificationCenter>);
  expect(screen.getByRole("heading", { name: "Notifications", level: 3 })).toBeTruthy();
});

test("titleId lands on the heading so a popover can be named by it", () => {
  render(
    <div role="dialog" aria-labelledby="bell-title">
      <NotificationCenter titleId="bell-title" level={2}>
        {feed}
      </NotificationCenter>
    </div>
  );

  const heading = screen.getByRole("heading", { level: 2 });
  expect(heading.id).toBe("bell-title");
  // The popover's name comes from the heading, not from an `aria-label` next to it.
  expect(screen.getByRole("dialog", { name: "Notifications" })).toBeTruthy();
});

test("titleId without level goes on the plain title element", () => {
  render(
    <div role="dialog" aria-labelledby="bell-title">
      <NotificationCenter titleId="bell-title" title="Events">
        {feed}
      </NotificationCenter>
    </div>
  );

  // No level is set: the center leaves the heading structure alone, but it still supplies the name.
  expect(screen.queryByRole("heading")).toBeNull();
  expect(screen.getByRole("dialog", { name: "Events" })).toBeTruthy();
});

test("an empty title is not a title: the catalog default names the centre", () => {
  render(
    <NotificationCenter title="" level={2}>
      {feed}
    </NotificationCenter>
  );

  expect(screen.getByRole("heading", { name: "Notifications", level: 2 })).toBeTruthy();
});

test("a level outside 2-4 falls back to plain text instead of a bogus element", () => {
  render(
    // Types forbid it, so a JS consumer will pass it this way.
    <NotificationCenter title="Events" level={7 as never}>
      {feed}
    </NotificationCenter>
  );

  expect(screen.queryByRole("heading")).toBeNull();
  expect(screen.getByText("Events").tagName).toBe("SPAN");
});
