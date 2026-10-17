// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { Chip } from "../src/components/actions/Chip.js";
import { Segmented } from "../src/components/actions/Segmented.js";
import { TooltipProvider } from "../src/components/overlays/Tooltip.js";

afterEach(cleanup);

/*
 * A button with an icon instead of a label must keep its name.
 *
 * Both defects below were found by a front-end audit (73 `button-name` violations on one
 * screen), and neither was visible to the eye or to the types: the markup is valid, the
 * component works, the name is missing.
 */

test("Chip: iconOnly hides the label visually but keeps the name", () => {
  render(
    <Chip iconOnly icon={<span aria-hidden>📱</span>}>
      Phone
    </Chip>
  );

  // Previously `children` were not rendered AT ALL with `iconOnly`: there was no node,
  // and the button stayed nameless.
  expect(screen.getByRole("button", { name: "Phone" })).toBeTruthy();
});

test("Chip: mobileIconOnly hides the label with a class, not with display:none", () => {
  render(
    <Chip mobileIconOnly icon={<span aria-hidden>📱</span>}>
      Phone
    </Chip>
  );

  const label = screen.getByText("Phone");
  // `hidden` (display:none) would remove the node from the accessibility tree on a
  // narrow screen; `sr-only` keeps it readable at all times.
  expect(label.className).toContain("sr-only");
  expect(label.className).not.toContain("hidden");
  expect(screen.getByRole("button", { name: "Phone" })).toBeTruthy();
});

test("Segmented: an empty label counts as absent and the name comes from the tooltip", () => {
  render(
    // The provider is required around a `Segmented` with tooltips: it holds one shared
    // show delay for the whole group, rather than creating one for each segment.
    <TooltipProvider>
      <Segmented
        value="phone"
        onChange={() => {}}
        options={[
          {
            value: "phone",
            label: "",
            icon: <span aria-hidden>📱</span>,
            tooltip: "Phone preview",
          },
          { value: "desktop", label: "Desktop" },
        ]}
      />
    </TooltipProvider>
  );

  // The condition was `label == null`, and an empty string did not pass it:
  // `aria-label` was not set, and the button stayed nameless.
  expect(screen.getByRole("button", { name: "Phone preview" })).toBeTruthy();
  // A segment with a label takes its name from the label, not from the tooltip.
  expect(screen.getByRole("button", { name: "Desktop" })).toBeTruthy();
});

/*
 * The "icon only on a narrow screen" mode (OLDSUI-19).
 *
 * jsdom does not know the screen width at all: the breakpoint lives in CSS. So what is
 * checked here is NOT how it looks, but that the label stayed a node of the tree: exactly
 * the defect this mode exists in the kit to prevent. Appearance is measured in a browser
 * (`tests-visual/interactions.spec.ts`).
 */

test("Segmented: mobileIconOnly hides the label visually and keeps it the name", () => {
  render(
    <Segmented
      value="active"
      onChange={() => {}}
      mobileIconOnly
      options={[
        { value: "active", icon: <span aria-hidden>▤</span>, label: "Active" },
        { value: "done", icon: <span aria-hidden>▪</span>, label: "Done" },
      ]}
    />
  );

  const label = screen.getByText("Active");
  // `hidden` (display:none) would remove the node from the tree on a narrow screen;
  // `sr-only` keeps it readable at all times, and `sm:not-sr-only` brings it back on screen.
  expect(label.className).toContain("sr-only");
  expect(label.className).toContain("sm:not-sr-only");
  expect(label.className).not.toContain("hidden");
  expect(screen.getByRole("button", { name: "Active" })).toBeTruthy();
  // A tooltip is not needed in this mode: the label itself provides the name.
  expect(screen.getByRole("button", { name: "Active" }).getAttribute("aria-label")).toBeNull();
});

test("Segmented: without the prop the label is a plain visible label", () => {
  render(
    <Segmented
      value="active"
      onChange={() => {}}
      options={[{ value: "active", icon: <span aria-hidden>▤</span>, label: "Active" }]}
    />
  );

  expect(screen.getByText("Active").className).not.toContain("sr-only");
});

test("Segmented: a segment without an icon keeps its label even in the mode", () => {
  render(
    <Segmented
      value="active"
      onChange={() => {}}
      mobileIconOnly
      options={[
        { value: "active", icon: <span aria-hidden>▤</span>, label: "Active" },
        { value: "all", label: "All" },
      ]}
    />
  );

  // Hiding the label in favor of the icon would mean an empty button: the name is there,
  // but nothing is on screen. A row with one word among the icons reads worse than an
  // even row, but everything that is visible can still be pressed.
  expect(screen.getByText("All").className).not.toContain("sr-only");
  expect(screen.getByText("Active").className).toContain("sr-only");
});

test("Segmented: the selected segment is still marked by aria-pressed, not by colour", () => {
  render(
    <Segmented
      value="done"
      onChange={() => {}}
      mobileIconOnly
      options={[
        { value: "active", icon: <span aria-hidden>▤</span>, label: "Active" },
        { value: "done", icon: <span aria-hidden>▪</span>, label: "Done" },
      ]}
    />
  );

  // Without labels this matters more than usual: color stays the only thing that is visible.
  expect(screen.getByRole("button", { name: "Done" }).getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByRole("button", { name: "Active" }).getAttribute("aria-pressed")).toBe("false");
});
