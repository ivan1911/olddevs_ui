// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { CopyButton } from "../src/components/actions/CopyButton.js";

afterEach(cleanup);

/*
  The stub is set AFTER `userEvent.setup()`, and this is not a nitpick about order:
  setup itself replaces `navigator.clipboard` with its own implementation, and a
  stub set earlier is silently overwritten by it, so the failure test would pass
  as a success.
*/
function setup(writeText: () => Promise<void>) {
  const user = userEvent.setup();
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
  return user;
}

test("the value goes to the clipboard", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  const user = setup(writeText);
  render(<CopyButton value="OLDSUI-42" />);

  await user.click(screen.getByRole("button", { name: "Copy" }));
  expect(writeText).toHaveBeenCalledWith("OLDSUI-42");
});

test("the result is announced, not only reflected in the icon", async () => {
  const user = setup(vi.fn().mockResolvedValue(undefined));
  render(<CopyButton value="OLDSUI-42" />);

  // The checkmark is a visual signal; otherwise a screen reader user would not learn
  // whether the button worked.
  expect(screen.getByRole("status").textContent).toBe("");
  await user.click(screen.getByRole("button"));
  await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Copied"));
});

test("the button name changes with the state", async () => {
  const user = setup(vi.fn().mockResolvedValue(undefined));
  render(<CopyButton value="OLDSUI-42" />);

  await user.click(screen.getByRole("button", { name: "Copy" }));
  // A "Copied" label on a button that copied nothing is a lie.
  await waitFor(() => expect(screen.getByRole("button", { name: "Copied" })).toBeTruthy());
});

test("a clipboard failure is visible and does not break the button", async () => {
  const user = setup(vi.fn().mockRejectedValue(new Error("denied")));
  const onCopy = vi.fn();
  render(<CopyButton value="OLDSUI-42" onCopy={onCopy} />);

  // In an insecure context `navigator.clipboard` is missing altogether, and writing
  // can be blocked by permissions. Staying silent about this means showing a button
  // that does nothing.
  await user.click(screen.getByRole("button"));
  await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Could not copy"));
  expect(onCopy).toHaveBeenCalledWith(false);
});

test("a missing API is also a failure, not a crash", async () => {
  const user = userEvent.setup();
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
  render(<CopyButton value="OLDSUI-42" />);

  await user.click(screen.getByRole("button"));
  await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Could not copy"));
});

test("the state resets after the given time", async () => {
  const user = setup(vi.fn().mockResolvedValue(undefined));
  render(<CopyButton value="OLDSUI-42" resetDelay={50} />);

  await user.click(screen.getByRole("button"));
  await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Copied"));
  await waitFor(() => expect(screen.getByRole("status").textContent).toBe(""), { timeout: 2000 });
});

test("with a label the button is not icon-only and takes its name from the text", () => {
  render(<CopyButton value="OLDSUI-42">Copy the key</CopyButton>);
  expect(screen.getByRole("button", { name: "Copy the key" })).toBeTruthy();
});
