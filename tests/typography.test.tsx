// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { Heading } from "../src/components/content/Heading.js";
import { Text } from "../src/components/content/Text.js";

afterEach(cleanup);

test("as changes the tag without changing the look", () => {
  const { container: paragraph } = render(<Text size="lg">text</Text>);
  const p = paragraph.firstElementChild!;

  cleanup();

  const { container: line } = render(
    <Text size="lg" as="span">
      text
    </Text>
  );
  const span = line.firstElementChild!;

  expect(p.tagName).toBe("P");
  expect(span.tagName).toBe("SPAN");
  // The look stays the same: `as` controls markup, not styling.
  expect(span.className).toBe(p.className);
});

test("tone overrides muting instead of blending with it", () => {
  const { container } = render(
    <Text tone="danger" level={3}>
      failed
    </Text>
  );

  const el = container.firstElementChild!;
  expect(el.className).toContain("text-danger-strong");
  // There is no second paint over the tone: there is nothing to mute a calibrated tone with —
  // it is tuned for exactly 4.5.
  expect(el.className).not.toContain("text-fg-2");
});

test("the heading level sets the tag", () => {
  render(<Heading level={3}>Exceptions</Heading>);

  expect(screen.getByRole("heading", { level: 3, name: "Exceptions" })).toBeTruthy();
});

test("size does not drag the level along", () => {
  const { container } = render(
    <Heading level={4} size="2xl">
      label
    </Heading>
  );

  const el = container.firstElementChild!;
  // The tag stays at the fourth level, so the document outline is not broken, while the size is
  // taken from the page heading.
  expect(el.tagName).toBe("H4");
  expect(el.className).toContain("text-2xl");
});

test("as on a heading changes the tag but not the size", () => {
  const { container } = render(
    <Heading level={2} as="h4">
      Schedule
    </Heading>
  );

  const el = container.firstElementChild!;
  expect(el.tagName).toBe("H4");
  // The size still comes from `level`, not from the tag: moving a card into a dialog changes its
  // place in the outline, not its appearance.
  expect(el.className).toContain("text-xl");
});

test("multi-line truncation is set by style, not by a built class", () => {
  const { container } = render(<Text truncate={3}>long text</Text>);

  const el = container.firstElementChild as HTMLElement;
  // The line count goes into an inline style: a class `line-clamp-${n}` assembled at runtime would
  // not be seen by Tailwind, which scans the sources as text.
  expect(el.style.webkitLineClamp).toBe("3");
  expect(el.className).toContain("[display:-webkit-box]");
});

test("the caption step is not eaten by class merging", () => {
  const { container } = render(
    <Text size="caption" level={3}>
      label
    </Text>
  );

  // `caption` is not a t-shirt size, and the stock `twMerge` put `text-caption` into the COLOR group,
  // where it conflicted with `text-fg-2`: one of the two silently disappeared, and which one depended
  // on argument order. The fix is extending the groups dictionary in `lib/cn.ts`.
  const el = container.firstElementChild!;
  expect(el.className).toContain("text-caption");
  expect(el.className).toContain("text-fg-2");
});

test("truncate={0} does not hide the text", () => {
  const { container } = render(<Text truncate={0}>visible text</Text>);

  const el = container.firstElementChild as HTMLElement;
  // `-webkit-line-clamp: 0` on a box with `overflow: hidden` shows nothing. We treat this as a typo
  // and clamp to one line.
  expect(el.style.webkitLineClamp).toBe("");
  expect(el.className).toContain("truncate");
});

test("numeric='tabular' gives equal-width digits without a second font", () => {
  const { container } = render(
    <Text as="span" numeric="tabular">
      0:11
    </Text>
  );

  const el = container.firstElementChild!;
  expect(el.className).toContain("tabular-nums");
  // We change the width of the digits, not the typeface: `font-mono` on a timer would mean a second
  // font on screen, while what was asked for is the digits of its own typeface.
  expect(el.className).not.toContain("font-mono");
});

test("digits stay proportional unless numeric is asked for", () => {
  const { container } = render(<Text>0:11</Text>);

  // The default does not change: ordinary text keeps ordinary digits.
  expect(container.firstElementChild!.className).not.toContain("tabular-nums");
});

test("a heading takes the same digit axis", () => {
  const { container } = render(
    <Heading level={2} numeric="tabular">
      1 280
    </Heading>
  );

  expect(container.firstElementChild!.className).toContain("tabular-nums");
});

test("the digit axis covers a semantic child, not just the text", () => {
  const { container } = render(
    <Text as="span" numeric="tabular">
      <time dateTime="PT11S">0:11</time>
    </Text>
  );

  // That is why the axis exists: the consumer wraps a machine-readable `time` in it as intended,
  // instead of hanging the utility on a semantic element by hand. `font-variant-numeric` is
  // inherited, so the class must stay on the wrapper, and the component adds no markup inside.
  const wrapper = container.firstElementChild!;
  const time = screen.getByText("0:11");
  expect(wrapper.className).toContain("tabular-nums");
  expect(time.tagName).toBe("TIME");
  expect(time.className).toBe("");
});
