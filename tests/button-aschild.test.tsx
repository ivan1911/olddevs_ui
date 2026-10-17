// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { Button } from "../src/components/actions/Button.js";

afterEach(cleanup);

test("asChild gives the appearance to the link instead of wrapping it in a button", () => {
  render(
    <Button asChild variant="solid" tone="accent">
      <a href="/campaigns/new">New campaign</a>
    </Button>
  );

  const link = screen.getByRole("link", { name: "New campaign" });
  // There is no button in the markup at all: nested interactive content is not allowed,
  // and a link inside a button is exactly that case.
  expect(screen.queryByRole("button")).toBeNull();
  expect(link.className).toContain("bg-accent");
});

test("type=button does not leak into the link markup", () => {
  render(
    <Button asChild>
      <a href="/schedule">Schedule</a>
    </Button>
  );

  // An `a` has no such attribute at all, and React would render it as garbage.
  expect(screen.getByRole("link").hasAttribute("type")).toBe(false);
});

test("a plain button still gets type=button", () => {
  render(<Button>Save</Button>);

  // The default keeps the old defect closed: without it, a button inside a form
  // submits the form.
  expect(screen.getByRole("button")).toHaveProperty("type", "button");
});

test("the icon is not lost with asChild", () => {
  render(
    <Button asChild icon={<svg data-testid="icon" />}>
      <a href="/upload">Upload</a>
    </Button>
  );

  const link = screen.getByRole("link", { name: "Upload" });
  // The icon moved INSIDE the link instead of staying outside next to it.
  expect(link.querySelector('[data-testid="icon"]')).not.toBeNull();
});

test("handlers merge with the child", async () => {
  const onButton = vi.fn();
  const onLink = vi.fn();

  render(
    <Button asChild onClick={onButton}>
      <a href="#" onClick={onLink}>
        Open
      </a>
    </Button>
  );

  const user = userEvent.setup();
  await user.click(screen.getByRole("link", { name: "Open" }));

  expect(onButton).toHaveBeenCalledTimes(1);
  expect(onLink).toHaveBeenCalledTimes(1);
});

test("disabled on a link is expressed by role, not by a non-existent attribute", () => {
  render(
    <Button asChild disabled>
      <a href="/campaigns/new">New campaign</a>
    </Button>
  );

  const link = screen.getByRole("link", { name: "New campaign" });
  // `<a disabled>` stays focusable and navigable, and `disabled:opacity-50` does not
  // apply: `:disabled` is a form-field pseudo-class. A link that looks disabled but
  // works is the worst possible outcome.
  expect(link.hasAttribute("disabled")).toBe(false);
  expect(link.getAttribute("aria-disabled")).toBe("true");
  expect(link.className).toContain("pointer-events-none");
});

test("selected does not put aria-pressed on a link", () => {
  render(
    <Button asChild selected>
      <a href="/schedule">Schedule</a>
    </Button>
  );

  // The `link` role does not allow this attribute: the axe audit flags it as
  // `aria-allowed-attr`. A pressed link does not exist: if the state is needed, it is a button.
  expect(screen.getByRole("link").hasAttribute("aria-pressed")).toBe(false);
});

test("a plain button still reports the pressed state", () => {
  render(<Button selected>Filters</Button>);

  expect(screen.getByRole("button").getAttribute("aria-pressed")).toBe("true");
});

/**
 * A disabled link must be disabled FOR THE KEYBOARD too.
 *
 * With `asChild`, disabled was expressed only by `aria-disabled`, a hint attribute, and by
 * the `pointer-events-none` class, which blocks the pointer alone. The link stayed in the
 * tab order and fired on Enter: a keyboard user reached a visually faded "Pay" button during
 * form submission and left the page. The tests checked only the attributes.
 */
test("a disabled asChild link is out of the tab order", () => {
  render(
    <Button asChild disabled>
      <a href="/pay">Pay</a>
    </Button>
  );

  expect(screen.getByRole("link").getAttribute("tabindex")).toBe("-1");
});

test("Enter on a disabled asChild link does nothing", async () => {
  const user = userEvent.setup();
  const onClick = vi.fn();

  render(
    <Button asChild loading onClick={onClick}>
      <a href="/pay">Pay</a>
    </Button>
  );

  const link = screen.getByRole("link");
  link.focus();
  await user.keyboard("{Enter}");

  expect(onClick).not.toHaveBeenCalled();
});

test("an enabled asChild link still works", async () => {
  const user = userEvent.setup();
  const onClick = vi.fn();

  render(
    <Button asChild onClick={onClick}>
      <a href="/pay">Pay</a>
    </Button>
  );

  await user.click(screen.getByRole("link"));
  expect(onClick).toHaveBeenCalled();
});

/**
 * The child's own `tabIndex` does not override the disabled state.
 *
 * `Slot` gives priority to the CHILD's props regardless of spread order, so a link with
 * `tabIndex={0}` simply overrode the `tabIndex: -1` passed to the button, and stayed
 * reachable by Tab even though it looked disabled. The comment next to it claimed that
 * the spread order was what protected it.
 */
test("a child tabIndex does not defeat the disabled guard", () => {
  render(
    <Button asChild disabled>
      <a href="/pay" tabIndex={0}>
        Pay
      </a>
    </Button>
  );

  expect(screen.getByRole("link").getAttribute("tabindex")).toBe("-1");
});

test("an enabled asChild child keeps its own tabIndex", () => {
  render(
    <Button asChild>
      <a href="/pay" tabIndex={3}>
        Pay
      </a>
    </Button>
  );

  // Cloning is switched on only by the disabled state: the component does not rewrite
  // the caller's regular markup.
  expect(screen.getByRole("link").getAttribute("tabindex")).toBe("3");
});
