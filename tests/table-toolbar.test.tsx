// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { TableToolbar } from "../src/components/table/TableToolbar.js";

afterEach(cleanup);

describe("TableToolbar", () => {
  test("absent slots do not reach the markup", () => {
    const { container } = render(<TableToolbar />);
    // An empty strip must not leave empty layout nodes behind it.
    expect(container.textContent).toBe("");
    expect(container.querySelectorAll("div").length).toBe(1);
  });

  test("the title, the count and the actions render", () => {
    render(<TableToolbar title="Documents" count={12} actions={<button>Create</button>} />);
    expect(screen.getByText("Documents")).toBeTruthy();
    expect(screen.getByText("12 records")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Create" })).toBeTruthy();
  });

  test("countLabel overrides the catalog when the entity needs naming", () => {
    render(<TableToolbar count={12} countLabel={(n) => `${n} documents`} />);
    expect(screen.getByText("12 documents")).toBeTruthy();
    expect(screen.queryByText("12 records")).toBeNull();
  });

  test("zero is shown, not hidden", () => {
    render(<TableToolbar count={0} />);
    // Zero is a result, not the absence of one: "0 records" answers the question,
    // while an empty place leaves it open.
    expect(screen.getByText("0 records")).toBeTruthy();
  });

  /**
   * The `toolbar` role obliges arrow-key navigation, and ARIA does not provide it itself.
   * Declaring the role without implementing the behavior deceives the screen reader.
   */
  test("there is no toolbar role: no promise of keyboard navigation is made", () => {
    render(<TableToolbar title="Documents" actions={<button>Create</button>} />);
    expect(screen.queryByRole("toolbar")).toBeNull();
  });

  test("the filters slot stands on its own row and works without the rest", () => {
    render(<TableToolbar filters={<div>Filters</div>} />);
    expect(screen.getByText("Filters")).toBeTruthy();
  });
});
