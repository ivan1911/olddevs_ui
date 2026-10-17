// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { Breadcrumbs } from "../src/components/navigation/Breadcrumbs.js";

afterEach(cleanup);

const TRAIL = [
  { label: "Home", href: "/" },
  { label: "Catalogue", href: "/c" },
  { label: "Section", href: "/c/s" },
  { label: "Collection", href: "/c/s/col" },
  { label: "Item" },
];

/**
 * Short chains.
 *
 * The collapsed view was always built as "first + … + last two" (three links), but
 * the condition fired already at `items.length > maxItems`. With two items and
 * `maxItems={1}`, the root landed both at the start and at the tail (it was rendered
 * TWICE), and the count of skipped links went negative: "Skipped links: −1". The input
 * is reachable per the docs: the page advises lowering `maxItems` in a narrow header.
 */
test.each([
  [1, 2],
  [1, 3],
  [2, 3],
])("maxItems=%i on a trail of %i renders each crumb once", (maxItems, length) => {
  render(<Breadcrumbs items={TRAIL.slice(0, length)} maxItems={maxItems} />);

  const texts = screen.getAllByRole("listitem").map((li) => li.textContent);
  const labels = TRAIL.slice(0, length).map((c) => c.label);
  for (const label of labels) {
    expect(texts.filter((t) => t?.includes(label))).toHaveLength(1);
  }
});

test("a long trail still collapses and reports a positive count", () => {
  const { container } = render(<Breadcrumbs items={TRAIL} maxItems={3} />);

  expect(container.textContent).toContain("…");
  expect(container.textContent).not.toContain("-1");
  expect(container.textContent).not.toContain("−1");
});

test("a trail that fits is not collapsed", () => {
  const { container } = render(<Breadcrumbs items={TRAIL.slice(0, 3)} maxItems={5} />);

  expect(container.textContent).not.toContain("…");
});
