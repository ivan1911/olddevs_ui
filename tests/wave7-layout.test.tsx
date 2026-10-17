// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { AspectRatio } from "../src/components/content/AspectRatio.js";
import { Kbd } from "../src/components/content/Kbd.js";
import { ScrollArea } from "../src/components/content/ScrollArea.js";
import { Separator } from "../src/components/content/Separator.js";
import { VisuallyHidden } from "../src/components/content/VisuallyHidden.js";

afterEach(cleanup);

test("the separator announces its role and orientation", () => {
  const { container } = render(<Separator orientation="vertical" />);

  // The component is taken from react-aria for its role: a handwritten `border-t` tells the screen
  // reader neither the group's boundary nor its orientation.
  const rule = container.firstElementChild!;
  expect(rule.getAttribute("role")).toBe("separator");
  expect(rule.getAttribute("aria-orientation")).toBe("vertical");
});

test("the scroll area is reachable from the keyboard", () => {
  const { container } = render(<ScrollArea label="List">content</ScrollArea>);

  // A scrollable block without focus is unreachable for someone not using a mouse; axe catches this
  // too, with the `scrollable-region-focusable` rule.
  const area = container.firstElementChild as HTMLElement;
  expect(area.tabIndex).toBe(0);
  expect(area.getAttribute("role")).toBe("region");
});

test("without a name the area does not pretend to be a region", () => {
  const { container } = render(<ScrollArea>content</ScrollArea>);

  // A `role="region"` without a name is announced by a screen reader as the empty word "region".
  expect(container.firstElementChild!.getAttribute("role")).toBeNull();
});

test("a key is a kbd tag, not a span with a font", () => {
  const { container } = render(<Kbd>⌘</Kbd>);

  // A tag declares its content as user input; a `span` in a monospace font looks the same and means
  // nothing.
  expect(container.firstElementChild!.tagName).toBe("KBD");
});

test("the aspect ratio goes into the style, not into a built class", () => {
  const { container } = render(<AspectRatio ratio={16 / 9} />);

  const box = container.firstElementChild as HTMLElement;
  // jsdom normalizes the value into a "width / height" pair.
  expect(box.style.aspectRatio).toMatch(/^1\.777/);
});

test("hidden content stays in the accessibility tree", () => {
  render(
    <p>
      {/* `elementType="span"` is required inside a row: by default react-aria renders a
          `<div>`, and a `<div>` inside a `<p>` is invalid nesting. The test was green, while React
          logged a hydration error to stderr, and nobody saw it. */}
      Drafts<VisuallyHidden elementType="span"> — eight of them</VisuallyHidden>
    </p>
  );

  // Not `display: none`: that removes the node from the tree altogether, so the label would vanish
  // for screen readers too.
  expect(screen.getByText("— eight of them")).toBeTruthy();
});
