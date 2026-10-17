// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { Pagination, pageRange } from "../src/components/navigation/Pagination.js";

afterEach(cleanup);

/**
 * Until wave 26 the component had no coverage at all: neither `tests/` nor
 * `tests-visual/`. Its JSDoc meanwhile claimed: "The row width stays constant:
 * at most `2×siblings + 5` cells, and the buttons under the cursor do not jump
 * when moving to the adjacent page". Only the maximum was constant.
 */
describe("the row keeps a constant width", () => {
  test("every page of a long range yields the same number of cells", () => {
    const widths = new Set<number>();
    for (let page = 1; page <= 10; page += 1) widths.add(pageRange(page, 10, 1).length);

    // It used to be 4→5→6→7→7→6→5→4: the 4→5 step moved the "5" button to the
    // left, so a repeated click at the same spot on screen landed on "4".
    expect([...widths]).toEqual([7]);
  });

  test("the width matches the documented formula", () => {
    expect(pageRange(5, 20, 1)).toHaveLength(2 * 1 + 5);
    expect(pageRange(5, 20, 2)).toHaveLength(2 * 2 + 5);
  });

  test("a short range is not padded beyond its pages", () => {
    // Nothing to pad with, and no need to: there are fewer pages than cells in the row.
    expect(pageRange(1, 3, 1)).toEqual([1, 2, 3]);
    expect(pageRange(2, 4, 1)).toEqual([1, 2, 3, 4]);
  });
});

describe("boundaries", () => {
  test("a single page yields a single cell", () => {
    expect(pageRange(1, 1, 1)).toEqual([1]);
  });

  test("a page outside the range is clamped, not walked to", () => {
    const cells = pageRange(99, 5, 1);

    // A guard against vacuous passing: a loop over an empty array passes on
    // nothing. Same technique as in `data-table.test.tsx`.
    expect(cells.length).toBeGreaterThan(0);
    for (const cell of cells) {
      if (cell !== "gap") expect(cell).toBeLessThanOrEqual(5);
      if (cell !== "gap") expect(cell).toBeGreaterThanOrEqual(1);
    }
  });

  test("a huge page number returns immediately instead of hanging", () => {
    // The function is public, and `?page=` comes from the URL. The padding step
    // is one page per iteration: without the clamp, `page=1e9` never finished.
    const started = Date.now();
    expect(pageRange(1_000_000_000, 10, 1)).toHaveLength(7);
    expect(Date.now() - started).toBeLessThan(100);
  });

  test("siblings=0 still keeps the current page visible", () => {
    expect(pageRange(5, 20, 0)).toContain(5);
  });
});

describe("the rendered control", () => {
  test("a single page renders nothing at all", () => {
    const { container } = render(<Pagination page={1} pageCount={1} onChange={() => {}} />);
    expect(container.firstElementChild).toBeNull();
  });

  test("the current page is marked for the screen reader", () => {
    render(<Pagination page={3} pageCount={10} onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "3" }).getAttribute("aria-current")).toBe("page");
  });

  test("clicking a page reports it", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Pagination page={3} pageCount={10} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "4" }));
    expect(onChange).toHaveBeenCalledWith(4);
  });
});
