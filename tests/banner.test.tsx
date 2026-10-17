// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { Banner } from "../src/components/actions/Banner.js";

afterEach(cleanup);

test("danger interrupts speech, other tones wait for a pause", () => {
  const { rerender } = render(<Banner tone="danger">Service unavailable</Banner>);
  // The role is chosen from the tone by the same rule as in `Alert`: mixing them up means
  // either losing an error message or shouting about a successful save.
  expect(screen.getByRole("alert").textContent).toContain("Service unavailable");

  rerender(<Banner tone="success">Everything is back</Banner>);
  expect(screen.getByRole("status").textContent).toContain("Everything is back");
});

test("without a handler there is no close button at all", () => {
  render(<Banner>Maintenance in progress</Banner>);
  expect(screen.queryByRole("button")).toBeNull();
});

test("closing calls the handler and is announced with catalog words", async () => {
  const user = userEvent.setup();
  const onDismiss = vi.fn();
  render(<Banner onDismiss={onDismiss}>Maintenance in progress</Banner>);

  // The label is specific, not a generic "Close": the banner closes an app-level message,
  // and the screen reader must say what is being dismissed.
  await user.click(screen.getByRole("button", { name: "Dismiss announcement" }));
  expect(onDismiss).toHaveBeenCalledTimes(1);
});

test("a custom close label overrides the catalog", () => {
  render(
    <Banner onDismiss={() => {}} closeLabel="Hide until tomorrow">
      Maintenance in progress
    </Banner>
  );
  expect(screen.getByRole("button", { name: "Hide until tomorrow" })).toBeTruthy();
});

test("a stack is adjacent banners, each with its own button", async () => {
  const user = userEvent.setup();
  const first = vi.fn();
  const second = vi.fn();
  render(
    <>
      <Banner tone="danger" onDismiss={first}>
        Service unavailable
      </Banner>
      <Banner tone="accent" onDismiss={second}>
        New version
      </Banner>
    </>
  );

  // The component has no queue of its own: a queue would be state, and state does not
  // live in the kit. A stack is just two neighbors.
  const buttons = screen.getAllByRole("button");
  expect(buttons).toHaveLength(2);
  await user.click(buttons[1]!);
  expect(second).toHaveBeenCalledTimes(1);
  expect(first).not.toHaveBeenCalled();
});

test("action and title sit next to the body", () => {
  render(
    <Banner title="Subscription is expiring" action={<button type="button">Renew</button>}>
      Publishing stops in three days.
    </Banner>
  );

  const banner = screen.getByRole("status");
  expect(banner.textContent).toContain("Subscription is expiring");
  expect(banner.textContent).toContain("in three days");
  expect(screen.getByRole("button", { name: "Renew" })).toBeTruthy();
});

test("no rounding: a banner is a strip across the application, not a card", () => {
  const { container } = render(<Banner>Maintenance in progress</Banner>);
  const banner = container.firstElementChild as HTMLElement;

  // Rounded corners would read as a content block, that is, like `Alert`.
  expect(banner.className).toContain("w-full");
  expect(banner.className).not.toContain("rounded-md");
});
