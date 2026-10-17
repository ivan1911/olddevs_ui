// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { createRef, type ReactElement } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { Grid } from "../src/index.js";
import { resetDevWarnings } from "../src/lib/dev-warn.js";

/**
 * Equal-column grid: tag, roles and pass-through of attributes.
 *
 * The column count is NOT checked here: jsdom has no layout and no media queries,
 * so it does not compute `grid-template-columns`. Columns are measured in a live
 * browser at different window widths (`tests-visual/interactions.spec.ts`), and
 * `tests/class-coverage.test.ts` guards, through a matrix, that every class from
 * the dictionary ends up in the built CSS.
 */

// The warning is shown once per module. Without the reset, the test order
// would decide which of them sees it.
beforeEach(resetDevWarnings);
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

/** How a consumer passes it from JS: the type does not let an entry with both axes through. */
const Untyped = Grid as unknown as (props: Record<string, unknown>) => ReactElement;

test("by default the grid is a plain block that keeps its children in order", () => {
  render(
    <Grid data-testid="grid" columns={3}>
      <div>First</div>
      <div>Second</div>
      <div>Third</div>
    </Grid>
  );

  const grid = screen.getByTestId("grid");
  // The default tag is `div`: the grid declares nothing until it is asked to.
  // A set of cards does not have to be a list.
  expect(grid.tagName).toBe("DIV");
  expect(grid.getAttribute("role")).toBeNull();
  expect([...grid.children].map((child) => child.textContent)).toEqual([
    "First",
    "Second",
    "Third",
  ]);
});

test("as='ul' announces the set as a list of its items", () => {
  render(
    <Grid as="ul" aria-label="Plans" columns={{ base: 1, md: 3 }}>
      <li>Basic</li>
      <li>Team</li>
      <li>Enterprise</li>
    </Grid>
  );

  const list = screen.getByRole("list", { name: "Plans" });
  expect(list.tagName).toBe("UL");
  // The role is explicit: Tailwind's preflight removes the list markers, and
  // without the role, WebKit with VoiceOver does not announce such a list as a list.
  expect(list.getAttribute("role")).toBe("list");
  expect(screen.getAllByRole("listitem")).toHaveLength(3);
});

test("as='ol' keeps the order meaningful", () => {
  render(
    <Grid as="ol" aria-label="Steps" minItemWidth={200}>
      <li>Upload</li>
      <li>Check</li>
    </Grid>
  );

  expect(screen.getByRole("list", { name: "Steps" }).tagName).toBe("OL");
});

test("the ref reaches the rendered element, whatever the tag", () => {
  const ref = createRef<HTMLElement>();
  render(
    <Grid as="ul" ref={ref} aria-label="Items">
      <li>One</li>
    </Grid>
  );

  expect(ref.current).toBe(screen.getByRole("list", { name: "Items" }));
});

test("the consumer's attributes and class reach the element", () => {
  render(
    <Grid id="cards" className="consumer-class" data-testid="grid" gap="lg">
      <div>Card</div>
    </Grid>
  );

  const grid = screen.getByTestId("grid");
  expect(grid.id).toBe("cards");
  // The consumer's class is not lost when it is merged with the dictionary.
  expect(grid.classList.contains("consumer-class")).toBe(true);
});

test("columns and minItemWidth exclude each other in the type", () => {
  // Both axes at once is a contradiction: there are either as many columns as
  // stated, or as many as fit. The type forbids such an entry rather than
  // silently picking a winner.
  // @ts-expect-error — columns and minItemWidth are mutually exclusive
  const both = <Grid columns={2} minItemWidth={200} />;
  expect(both).toBeTruthy();

  // Outside the closed set of values, the type does not let it through either.
  // @ts-expect-error — columns from one to six
  const seven = <Grid columns={7} />;
  expect(seven).toBeTruthy();
});

test("columns together with minItemWidth warns in development: what was passed, who won, the fix", () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  render(<Untyped columns={3} minItemWidth={200} />);

  expect(warn).toHaveBeenCalledTimes(1);
  const text = String(warn.mock.calls[0]![0]);
  expect(text).toContain("Grid");
  expect(text).toContain("`columns`");
  expect(text).toContain("`minItemWidth`");
  expect(text).toMatch(/`minItemWidth` wins/);
  expect(text).toMatch(/Pass only one/);
});

test("the warning is written once, however many grids break the contract or re-render", () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const grids = (
    <>
      <Untyped columns={2} minItemWidth={160} />
      <Untyped columns={4} minItemWidth={240} />
    </>
  );
  const { rerender } = render(grids);
  rerender(grids);
  expect(warn).toHaveBeenCalledTimes(1);
});

test("the warning is silent in production", () => {
  vi.stubEnv("NODE_ENV", "production");
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  render(<Untyped columns={3} minItemWidth={200} />);
  expect(warn).not.toHaveBeenCalled();
});

test("one of the two axes is not a contract violation: no warning", () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  render(
    <>
      <Grid columns={3} />
      <Grid minItemWidth={200} />
      <Grid />
    </>
  );
  expect(warn).not.toHaveBeenCalled();
});
