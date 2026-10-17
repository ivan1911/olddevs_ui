// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { MenuItem } from "../src/components/overlays/Menu.js";
import { SplitButton } from "../src/components/actions/SplitButton.js";

/*
  `CSS.escape` shim. It is the same as in `menu.test.tsx`, for the same reason: jsdom has no `CSS`
  object, and the react-aria popover calls `CSS.escape` when it opens. Without the shim, the menu
  does not open in any test.
*/
if (typeof globalThis.CSS === "undefined")
  (globalThis as unknown as { CSS: { escape: (v: string) => string } }).CSS = {
    escape: (value: string) => String(value).replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`),
  };

afterEach(cleanup);

function Export({
  onClick = () => {},
  onExport = () => {},
  disabled = false,
  loading = false,
}: {
  onClick?: () => void;
  onExport?: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <SplitButton label="Export" onClick={onClick} disabled={disabled} loading={loading}>
      <MenuItem onAction={onExport}>Export to XLSX</MenuItem>
      <MenuItem>Export to JSON</MenuItem>
    </SplitButton>
  );
}

test("the toggle opens the menu and the main action does not", async () => {
  const user = userEvent.setup();
  const onClick = vi.fn();
  render(<Export onClick={onClick} />);

  await user.click(screen.getByRole("button", { name: "Export" }));
  expect(onClick).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("menu")).toBeNull();

  await user.click(screen.getByRole("button", { name: /More actions/ }));
  expect(await screen.findByRole("menu")).toBeTruthy();
  // Opening the menu must not call the main action: these are two different outcomes.
  expect(onClick).toHaveBeenCalledTimes(1);
});

/*
  This is the component's only own decision, so it gets a separate test. Without the action's
  label, speech output reads "Export" and then an unnamed button with an arrow.
*/
test("the toggle name is built from the main action label", () => {
  render(<Export />);
  expect(screen.getByRole("button", { name: "More actions: Export" })).toBeTruthy();
});

test("a menu item calls its own action, not the main one", async () => {
  const user = userEvent.setup();
  const onClick = vi.fn();
  const onExport = vi.fn();
  render(<Export onClick={onClick} onExport={onExport} />);

  await user.click(screen.getByRole("button", { name: /More actions/ }));
  await user.click(await screen.findByRole("menuitem", { name: "Export to XLSX" }));

  expect(onExport).toHaveBeenCalledTimes(1);
  expect(onClick).not.toHaveBeenCalled();
});

/*
  The component's claim is "the menu cannot be opened", not "the button has an attribute". The test
  checks the first: how react-aria expresses being disabled is its own concern, and the test must
  not break when that detail changes.
*/
test("disabled turns off both buttons", async () => {
  const user = userEvent.setup();
  render(<Export disabled />);

  expect(screen.getByRole("button", { name: "Export" }).hasAttribute("disabled")).toBe(true);
  await user.click(screen.getByRole("button", { name: /More actions/ }));
  expect(screen.queryByRole("menu")).toBeNull();
});

/*
  Submitting disables the menu button for the same reason as `disabled`: an open menu in the middle
  of a submission offers a second way to do what is already in progress.
*/
/*
  The test also checks that the menu button itself is disabled, not only that the menu did not
  open. The `isOpen` guard alone satisfied the test, so a regression where the menu button looks
  alive but does nothing would have passed. That is worse than an honestly disabled button.
*/
test("loading turns off the toggle, not just the main action", async () => {
  const user = userEvent.setup();
  render(<Export loading />);

  const more = screen.getByRole("button", { name: /More actions/ });
  expect(more.hasAttribute("disabled") || more.getAttribute("aria-disabled") === "true").toBe(true);

  await user.click(more);
  expect(screen.queryByRole("menu")).toBeNull();
});

/*
  A gap found in review and reproduced before the fix: the uncontrolled `MenuTrigger` kept the
  open panel after the component was disabled, and the item kept firing. The component looked
  disabled, but the second way still worked.
*/
test("turning the component off closes a menu that is already open", async () => {
  const user = userEvent.setup();
  const onExport = vi.fn();

  // A toggle outside the component will not work: the open panel makes the rest of the page inert,
  // so the button cannot be reached by a click or a query. The state is changed directly, so the
  // test checks how the component reacts, not the path to the switch.
  let turnOff = () => {};
  function Switchable() {
    const [off, setOff] = useState(false);
    turnOff = () => setOff(true);
    return <Export onExport={onExport} disabled={off} />;
  }
  render(<Switchable />);

  await user.click(screen.getByRole("button", { name: /More actions/ }));
  expect(await screen.findByRole("menu")).toBeTruthy();

  act(() => turnOff());

  expect(screen.queryByRole("menu")).toBeNull();
  expect(screen.queryByRole("menuitem", { name: "Export to XLSX" })).toBeNull();
  expect(onExport).not.toHaveBeenCalled();
});

/*
  The second half of the same defect, hidden behind the first. `isOpen` prevents showing the menu,
  but a controlled change does not call `onOpenChange`, so `open` stayed `true`. The menu came back
  on its own when the disabled state was lifted.
*/
test("re-enabling does not bring the menu back on its own", async () => {
  const user = userEvent.setup();

  let setOff = (_: boolean) => {};
  function Switchable() {
    const [off, set] = useState(false);
    setOff = set;
    return <Export disabled={off} />;
  }
  render(<Switchable />);

  await user.click(screen.getByRole("button", { name: /More actions/ }));
  expect(await screen.findByRole("menu")).toBeTruthy();

  act(() => setOff(true));
  expect(screen.queryByRole("menu")).toBeNull();

  act(() => setOff(false));
  expect(screen.queryByRole("menu")).toBeNull();
});

/*
  The whole rationale for the component rests on the menu button being its own tab stop and
  opening from the keyboard. Without this test, "the second outcome cannot be reached from the
  keyboard" stays a claim in the docstring.
*/
test("the toggle is its own tab stop and opens from the keyboard", async () => {
  const user = userEvent.setup();
  render(<Export />);

  await user.tab();
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Export" }));

  await user.tab();
  const more = screen.getByRole("button", { name: /More actions/ });
  expect(document.activeElement).toBe(more);

  await user.keyboard("{Enter}");
  expect(await screen.findByRole("menu")).toBeTruthy();
  expect(more.getAttribute("aria-expanded")).toBe("true");
});

/*
  The panel gets its name from the trigger; the component does not give it its own `aria-label`.
  The test guards that the name exists at all: a menu that is silently unnamed is something only an
  audit or a listener would catch.
*/
test("the menu takes its accessible name from the toggle", async () => {
  const user = userEvent.setup();
  render(<Export />);

  await user.click(screen.getByRole("button", { name: /More actions/ }));
  expect(screen.getByRole("menu", { name: "More actions: Export" })).toBeTruthy();
});
