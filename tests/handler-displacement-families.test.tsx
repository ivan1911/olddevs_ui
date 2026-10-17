// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { Toggle } from "../src/components/actions/Toggle.js";

afterEach(cleanup);

/**
 * Family: "a consumer handler does not displace the component's own".
 *
 * `{...rest}` placed after the component's own props overrides them. For styling
 * this is harmless and often even NEEDED: the consumer may override `aria-label`.
 * For a handler that the component uses to do its work, it is fatal: a `Toggle`
 * with a foreign `onClick` rendered, responded to clicks, called analytics and
 * never toggled.
 *
 * Separately, `onClick={undefined}` is checked: the key still ends up in `rest`
 * and overwrites the component's own handler, so the defect is caught even without
 * a real handler — by an optional prop alone, passed through from the consumer's
 * wrapper.
 *
 * The rule is not "spread always goes first": `MaskedInput` keeps the spread last
 * and is correct, because it pulls `onChange` and `onKeyDown` out of `rest` by
 * destructuring. What is checked is the CONSEQUENCE, not the order of the lines.
 *
 * Listed here are the components that have BOTH their own click behavior AND accept
 * a foreign handler. The wave 26 audit found exactly one such component, `Toggle`;
 * the list is kept so that a second one is caught here and not in an application.
 *
 * Two other ways of not having this defect are legitimate and are not listed here:
 * pull the handler out of `rest` by destructuring (`MaskedInput`), or do not accept
 * it at all by removing it from the props with `Omit` (`CopyButton`) — there is
 * nothing to displace in those cases.
 */
const CASES = [
  {
    name: "Toggle",
    render: (onClick: () => void) => (
      <Toggle checked={false} onCheckedChange={vi.fn()} label="Notifications" onClick={onClick} />
    ),
    role: "switch",
  },
] as const;

describe("a consumer handler runs without displacing the component's own", () => {
  test.each(CASES)("$name calls the consumer handler", async ({ render: renderCase, role }) => {
    const user = userEvent.setup();
    const consumer = vi.fn();
    render(renderCase(consumer));

    await user.click(screen.getByRole(role));

    expect(consumer).toHaveBeenCalledTimes(1);
  });
});

describe("an undefined handler prop does not erase the component's own", () => {
  test("Toggle still toggles when onClick is explicitly undefined", async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(
      <Toggle
        checked={false}
        onCheckedChange={onCheckedChange}
        label="Notifications"
        onClick={undefined}
      />
    );

    await user.click(screen.getByRole("switch"));

    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });
});
