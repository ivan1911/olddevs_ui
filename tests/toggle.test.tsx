// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { Toggle, type ToggleProps } from "../src/components/actions/Toggle.js";
import { resetDevWarnings } from "../src/lib/dev-warn.js";
import { FormField } from "../src/components/inputs/FormField.js";

afterEach(cleanup);

function Controlled({ onClick }: { onClick?: () => void }) {
  const [on, setOn] = useState(false);
  return <Toggle checked={on} onCheckedChange={setOn} label="Notifications" onClick={onClick} />;
}

test("the switch announces its role and state", () => {
  render(<Toggle checked onCheckedChange={() => {}} label="Notifications" />);

  const toggle = screen.getByRole("switch", { name: "Notifications" });
  expect(toggle.getAttribute("aria-checked")).toBe("true");
});

/**
 * The role and the state are NOT OVERRIDDEN by the spread.
 *
 * The fix moved `{...rest}` forward for exactly this purpose, but no test passed `role`
 * or `aria-checked` through the spread: put the order back and all five tests stayed
 * green. A toggle that lost `role="switch"` stops being a switch.
 */
test("a consumer cannot overwrite the role or the state", () => {
  render(
    <Toggle
      checked
      onCheckedChange={() => {}}
      label="Notifications"
      {...({ role: "button", "aria-checked": "false" } as Record<string, string>)}
    />
  );

  expect(screen.getByRole("switch", { name: "Notifications" })).toBeTruthy();
  expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("true");
});

test("clicking flips the state", async () => {
  const user = userEvent.setup();
  render(<Controlled />);

  await user.click(screen.getByRole("switch"));
  expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("true");
});

/**
 * A consumer's `onClick` does NOT DISPLACE the toggling.
 *
 * `{...rest}` stood last and overrode the component's own `onClick`, `role` and
 * `aria-checked`. A call `<Toggle … onClick={track} />` compiled, the switch was drawn,
 * analytics fired — but `onCheckedChange` was NEVER called, which means the component was
 * dead, and no test caught it: `Toggle` had no tests at all.
 */
test("a consumer onClick does not displace the toggling", async () => {
  const user = userEvent.setup();
  const track = vi.fn();
  render(<Controlled onClick={track} />);

  await user.click(screen.getByRole("switch"));

  expect(track).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("true");
});

test("a consumer onClick can cancel the toggling deliberately", async () => {
  const user = userEvent.setup();
  const onClick = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
  const onCheckedChange = vi.fn();

  render(
    <Toggle
      checked={false}
      onCheckedChange={onCheckedChange}
      label="Notifications"
      onClick={onClick}
    />
  );

  await user.click(screen.getByRole("switch"));

  /*
    Three assertions, and not one extra.

    The previous version had no `expect()` at all: the guard was a throw inside
    `onCheckedChange`, so a handler that was NEVER called — that is, exactly the original
    defect — left the test green.
  */
  expect(onClick).toHaveBeenCalledTimes(1);
  expect(onCheckedChange).not.toHaveBeenCalled();
});

test("without preventDefault the same handler does not block toggling", async () => {
  const user = userEvent.setup();
  const onCheckedChange = vi.fn();

  render(
    <Toggle
      checked={false}
      onCheckedChange={onCheckedChange}
      label="Notifications"
      onClick={() => {}}
    />
  );

  await user.click(screen.getByRole("switch"));

  expect(onCheckedChange).toHaveBeenCalledWith(true);
});

test("a disabled switch does not toggle", async () => {
  const user = userEvent.setup();
  const onCheckedChange = vi.fn();
  render(
    <Toggle checked={false} onCheckedChange={onCheckedChange} label="Notifications" disabled />
  );

  await user.click(screen.getByRole("switch"));
  expect(onCheckedChange).not.toHaveBeenCalled();
});

/*
  Visible label and description: a settings row with "words on the left, switch on the
  right". The label and the description belong to the switch, not to the screen, so the
  name, the description and a click on the text must work without assembling them by hand.
*/
function Row({ onClick }: { onClick?: () => void }) {
  const [on, setOn] = useState(false);
  return (
    <Toggle checked={on} onCheckedChange={setOn} description="Monday summary" onClick={onClick}>
      Weekly digest
    </Toggle>
  );
}

test("the visible label is the accessible name of the switch", () => {
  render(<Row />);

  expect(screen.getByRole("switch", { name: "Weekly digest" })).toBeTruthy();
  expect(screen.getByText("Weekly digest")).toBeTruthy();
});

test("the description is linked to the switch through aria-describedby", () => {
  render(<Row />);

  const toggle = screen.getByRole("switch");
  const id = toggle.getAttribute("aria-describedby");
  expect(id).toBeTruthy();
  expect(document.getElementById(id!)?.textContent).toBe("Monday summary");
});

test("a click on the text flips the switch", async () => {
  const user = userEvent.setup();
  render(<Row />);

  await user.click(screen.getByText("Weekly digest"));
  expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("true");

  await user.click(screen.getByText("Monday summary"));
  expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("false");
});

test("a click on the description does not toggle a disabled switch", async () => {
  const user = userEvent.setup();
  const onCheckedChange = vi.fn();
  render(
    <Toggle checked={false} onCheckedChange={onCheckedChange} disabled description="Plan limit">
      Guests
    </Toggle>
  );

  await user.click(screen.getByText("Guests"));
  expect(onCheckedChange).not.toHaveBeenCalled();
});

test("a visible label without a description adds no aria-describedby", () => {
  render(
    <Toggle checked={false} onCheckedChange={() => {}}>
      Guests
    </Toggle>
  );

  expect(screen.getByRole("switch", { name: "Guests" }).hasAttribute("aria-describedby")).toBe(
    false
  );
});

test("the description joins the consumer's own aria-describedby, it does not replace it", () => {
  render(
    <>
      <p id="extra">Extra note</p>
      <Toggle
        checked={false}
        onCheckedChange={() => {}}
        description="Monday"
        aria-describedby="extra"
      >
        Digest
      </Toggle>
    </>
  );

  const ids = screen.getByRole("switch").getAttribute("aria-describedby")!.split(" ");
  expect(ids).toHaveLength(2);
  expect(ids).toContain("extra");
});

test("inside FormField the form's hint is still linked next to the description", () => {
  render(
    <FormField label="Digest" hint="Sent on Mondays">
      <Toggle checked={false} onCheckedChange={() => {}} description="Summary">
        Weekly digest
      </Toggle>
    </FormField>
  );

  const ids = screen.getByRole("switch").getAttribute("aria-describedby")!.split(" ");
  expect(ids.map((id) => document.getElementById(id)?.textContent).sort()).toEqual([
    "Sent on Mondays",
    "Summary",
  ]);
});

test("the plain form with a label attribute is unchanged: no row, no visible text", () => {
  const { container } = render(<Toggle checked={false} onCheckedChange={() => {}} label="Quiet" />);

  expect(container.firstElementChild?.tagName).toBe("BUTTON");
  expect(screen.getByRole("switch", { name: "Quiet" })).toBeTruthy();
});

test("an empty visible label falls back to the plain form", () => {
  const { container } = render(
    <Toggle checked={false} onCheckedChange={() => {}}>
      {""}
    </Toggle>
  );

  expect(container.firstElementChild?.tagName).toBe("BUTTON");
});

test("className goes to the row when the label is visible", () => {
  const { container } = render(
    <Toggle checked={false} onCheckedChange={() => {}} className="row-marker">
      Guests
    </Toggle>
  );

  expect(container.firstElementChild?.classList.contains("row-marker")).toBe(true);
  expect(screen.getByRole("switch").classList.contains("row-marker")).toBe(false);
});

test("the name rule is checked in development: none, both, or a description without a label", () => {
  // The type does not check this: a union of `label | children` would break
  // `extends ToggleProps` and `Omit<ToggleProps, …>` for the consumer.
  resetDevWarnings();
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  render(<Toggle checked onCheckedChange={() => {}} />);
  render(
    <Toggle checked onCheckedChange={() => {}} label="A">
      B
    </Toggle>
  );
  render(<Toggle checked onCheckedChange={() => {}} label="A" description="B" />);
  const messages = warn.mock.calls.map((call) => String(call[0]));
  expect(messages.some((m) => m.includes("no accessible name"))).toBe(true);
  expect(messages.some((m) => m.includes("both `label` and visible `children`"))).toBe(true);
  expect(messages.some((m) => m.includes("`description` needs a visible label"))).toBe(true);
  warn.mockRestore();
});

test("ToggleProps stays an object type: a consumer can extend it and Omit from it", () => {
  // Type test: the compiler must accept both familiar kinds of wrapper.
  interface Labeled extends ToggleProps {
    hint?: string;
  }
  const Wrapper = ({
    checked: _c,
    ...rest
  }: Omit<ToggleProps, "onCheckedChange"> & { checked: boolean }) => (
    <Toggle checked={_c} onCheckedChange={() => {}} {...rest} />
  );
  const props: Labeled = { checked: true, onCheckedChange: () => {}, label: "A" };
  render(<Wrapper {...props} />);
  expect(screen.getByRole("switch", { name: "A" })).toBeTruthy();
});
