// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { TableToolbar } from "../src/components/table/TableToolbar.js";

afterEach(cleanup);

describe("TableToolbar", () => {
  test("absent slots do not reach the markup", () => {
    const { container } = render(<TableToolbar />);
    // Пустая полоса не должна оставлять после себя пустых узлов раскладки.
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
    // Ноль — это результат, а не отсутствие результата: «0 записей» отвечает
    // на вопрос, а пустое место оставляет его открытым.
    expect(screen.getByText("0 records")).toBeTruthy();
  });

  /**
   * Роль `toolbar` обязывает к навигации стрелками, а ARIA её сама не даёт.
   * Объявить роль и не реализовать поведение — обмануть скринридер.
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
