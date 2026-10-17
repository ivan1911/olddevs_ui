// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { hasContent, isShowableNumber } from "../src/lib/empty.js";
import { Avatar } from "../src/components/content/Avatar.js";
import { CodeView } from "../src/components/content/CodeView.js";
import { NotificationList } from "../src/components/content/NotificationList.js";
import { Progress } from "../src/components/actions/Progress.js";
import { CopyButton } from "../src/components/actions/CopyButton.js";
import { Segmented } from "../src/components/actions/Segmented.js";
import { ToggleGroup } from "../src/components/actions/ToggleGroup.js";
import { TooltipProvider } from "../src/components/overlays/Tooltip.js";
import { AddIcon } from "../src/icons.js";

afterEach(cleanup);

/**
 * The family of "empty is more than just `null`".
 *
 * The kit caught this defect five times in five components, and each time fixed one
 * spot: `Segmented` gave itself a local `hasLabel`, while `CopyButton`, `ToggleGroup`,
 * `NotificationList` and `Progress` stayed on `== null`. The test lists the components
 * that must follow the rule, so that a sixth case is caught here and not in the consumer's app.
 *
 * The test checks the OBSERVABLE effect, not a call of the predicate: the accessible name of a
 * button, the empty-state slot of a list, the validity of the attributes on a progress bar.
 * A check of "does the component call `hasContent`" would break on a harmless refactor
 * and say nothing about the user.
 */
describe("the predicate itself", () => {
  test.each([null, undefined, "", false, [], [null, false]])("%o counts as empty", (value) => {
    expect(hasContent(value as never)).toBe(false);
  });

  test.each([0, "0", "text", ["", "text"]])("%o counts as content", (value) => {
    // Zero is a legitimate counter value, not emptiness: `<Badge>{0}</Badge>`
    // must render zero.
    expect(hasContent(value as never)).toBe(true);
  });

  test.each([Number.NaN, Number.POSITIVE_INFINITY, null, undefined])(
    "%o is not a showable number",
    (value) => {
      expect(isShowableNumber(value)).toBe(false);
    }
  );

  test.each([0, 42, -1, 99.9])("%o is a showable number", (value) => {
    expect(isShowableNumber(value)).toBe(true);
  });
});

describe("an empty label is an absent label, not a label", () => {
  test("Segmented: an icon-only option keeps its accessible name", () => {
    render(
      <TooltipProvider>
        <Segmented
          value="grid"
          onChange={() => {}}
          options={[{ value: "grid", label: "", icon: <AddIcon />, tooltip: "Grid" }]}
        />
      </TooltipProvider>
    );

    expect(screen.getByRole("button", { name: "Grid" })).toBeDefined();
  });

  test("CopyButton: an empty child does not leave the button nameless", () => {
    // `children == null` does not catch `""`: `iconOnly` became false, `aria-label`
    // was not set, and a button with one decorative icon and an empty accessible name
    // was rendered, a critical-level `button-name` violation in axe.
    // The real call shape is a label from the config that arrived empty.
    render(<CopyButton value="token">{""}</CopyButton>);

    expect(screen.getByRole("button").getAttribute("aria-label")).toBeTruthy();
  });

  test("ToggleGroup: an empty label makes an icon-only button, as in Segmented", () => {
    // `{ label: "", icon }` is the standard way, per the `Segmented` vocabulary, to say
    // "icon only". In `ToggleGroup` it gave a button with text padding and an empty `<span>`
    // inside: side by side in one panel, they came out misaligned.
    render(
      <ToggleGroup
        value={["add"]}
        onChange={() => {}}
        options={[{ id: "add", label: "", icon: <AddIcon />, "aria-label": "Add" }]}
      />
    );

    const button = screen.getByRole("button", { name: "Add" });
    expect(button.querySelector("span:empty")).toBeNull();
  });
});

describe("an empty name is an absent name", () => {
  test("Avatar: an empty name falls back instead of rendering a blank circle", () => {
    // The fallback fired only for `undefined`. For `""`,
    // `"".charCodeAt(0)` gives `NaN`, the gradient became `oklch(0.55 0.13 NaN)`,
    // the browser dropped it whole, and on the light theme the result was an empty
    // circle, white on white.
    const { container } = render(<Avatar name="" />);
    const root = container.firstElementChild as HTMLElement;

    expect(root.getAttribute("style") ?? "").not.toContain("NaN");
    expect(root.textContent).not.toBe("");
  });
});

describe("empty content is an empty list, not a rendered one", () => {
  test("NotificationList: an empty array of children shows the empty slot", () => {
    // `children == null` does not treat `[]` as empty, and the main way to call it is
    // exactly `{items.map(...)}`. With empty `items` a `<div role=group>` was rendered
    // with an empty `<ul>` inside, and the `empty` slot did not appear at all.
    const items: string[] = [];
    render(
      <NotificationList empty={<span>Nothing here</span>}>
        {items.map((id) => (
          <span key={id} />
        ))}
      </NotificationList>
    );

    expect(screen.getByText("Nothing here")).toBeDefined();
  });

  test("CodeView: a falsy child falls back to the plain code, with its gutter", () => {
    // `children === undefined` and `children ?? code` diverged on `null` and
    // `false`. The idiom `{ready && <Highlighted/>}` with a falsy `ready` gave
    // `false ?? code`, that is `false`, and the panel came out empty.
    const ready = false;
    render(
      <CodeView code={"const a = 1;\nconst b = 2;"} lineNumbers>
        {ready && <span>highlighted</span>}
      </CodeView>
    );

    expect(screen.getByText(/const a = 1/)).toBeDefined();
  });
});

describe("a number that cannot be shown is not a value", () => {
  test("Progress: NaN behaves as unknown progress, not as a full bar", () => {
    // `loaded / total * 100` with a zero `total` gives `NaN`. The check
    // `value == null` does not catch it, and neither does `?? 0`: `??` catches only
    // null/undefined. The markup got `width: NaN%`: the declaration was dropped,
    // and the block div stretched across the full width of the container.
    const { container } = render(<Progress label="Upload" value={Number.NaN} />);

    expect(container.innerHTML).not.toContain("NaN");
  });
});
