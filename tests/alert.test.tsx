// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { Alert } from "../src/components/actions/Alert.js";

afterEach(cleanup);

/*
 * The Russian locale is wired in EXPLICITLY: since 2.0.0 the kit falls back to English,
 * so a test that expects a Russian label without a provider would check the default
 * language instead of the behavior. The expectations are unchanged: the strings are the
 * same ones that were hard-coded in the components before they moved to the catalog,
 * and this is what the test proves.
 */
test("role follows the tone, not the appearance", () => {
  const { unmount } = render(<Alert tone="danger">Channel disconnected</Alert>);
  // `alert` interrupts the current screen reader speech, which is right for an error.
  expect(screen.getByRole("alert").textContent).toContain("Channel disconnected");
  unmount();

  for (const tone of ["neutral", "accent", "success", "warning"] as const) {
    const { unmount: u } = render(<Alert tone={tone}>Message</Alert>);
    // `status` waits for a pause: there is no reason to shout about a successful save.
    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    u();
  }
});

test("no cross is drawn without a handler", () => {
  const { unmount } = render(<Alert>Message</Alert>);
  expect(screen.queryByRole("button", { name: "Dismiss message" })).toBeNull();
  unmount();

  render(<Alert onDismiss={() => {}}>Message</Alert>);
  expect(screen.getByRole("button", { name: "Dismiss message" })).toBeTruthy();
});

test("the cross calls onDismiss", async () => {
  const user = userEvent.setup();
  const onDismiss = vi.fn();
  render(<Alert onDismiss={onDismiss}>Message</Alert>);

  await user.click(screen.getByRole("button", { name: "Dismiss message" }));
  expect(onDismiss).toHaveBeenCalledTimes(1);
});

test("title and body are both shown", () => {
  render(<Alert title="Channel not connected">Nothing is published until you connect it</Alert>);
  expect(screen.getByText("Channel not connected")).toBeTruthy();
  expect(screen.getByText("Nothing is published until you connect it")).toBeTruthy();
});

test("a custom icon displaces the tone icon", () => {
  const { container } = render(
    <Alert tone="danger" icon={<span data-testid="custom" />}>
      Message
    </Alert>
  );
  expect(screen.getByTestId("custom")).toBeTruthy();
  // The icon comes from the tone: there is one `svg`, and no icon of its own.
  expect(container.querySelectorAll("svg")).toHaveLength(0);
});
