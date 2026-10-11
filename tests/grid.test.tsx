// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { createRef, type ReactElement } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { Grid } from "../src/index.js";
import { resetDevWarnings } from "../src/lib/dev-warn.js";

/**
 * Сетка равных колонок: тег, роли и проброс атрибутов.
 *
 * Число колонок здесь НЕ проверяется: в jsdom нет ни раскладки, ни
 * медиазапросов, и `grid-template-columns` он не вычисляет. Колонки меряются в
 * живом браузере на разной ширине окна (`tests-visual/interactions.spec.ts`), а
 * то, что каждый класс словаря попадает в собранный CSS, стережёт
 * `tests/class-coverage.test.ts` через матрицу.
 */

// Предупреждение показывается один раз на модуль — без сброса порядок тестов
// решал бы, какой из них его увидит.
beforeEach(resetDevWarnings);
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

/** Так передаст потребитель на JS: тип запись с обеими осями не пропускает. */
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
  // Тег по умолчанию — `div`: сетка ничего не объявляет, пока её об этом не
  // попросили. Набор карточек не обязан быть списком.
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
  // Роль явная: preflight Tailwind снимает маркеры, и без неё WebKit с
  // VoiceOver не объявляет такой список списком.
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
  // Класс потребителя не теряется при слиянии со словарём.
  expect(grid.classList.contains("consumer-class")).toBe(true);
});

test("columns and minItemWidth exclude each other in the type", () => {
  // Обе оси сразу — противоречие: колонок либо столько, сколько сказано, либо
  // столько, сколько влезает. Тип запрещает такую запись, а не выбирает
  // победителя молча.
  // @ts-expect-error — columns и minItemWidth взаимоисключающие
  const both = <Grid columns={2} minItemWidth={200} />;
  expect(both).toBeTruthy();

  // Вне закрытого набора значений тип тоже не пропускает.
  // @ts-expect-error — колонок от одной до шести
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
