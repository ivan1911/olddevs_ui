// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { FilterBar } from "../src/components/table/FilterBar.js";
import { FilterBarAdd, type FilterField } from "../src/components/table/FilterBarAdd.js";
import type { TableFilter } from "../src/lib/table-state.js";

afterEach(cleanup);

/**
 * Диапазоны в фильтрах (ADR-0063): `FilterField.kind` и необязательное `to`
 * у `TableFilter`. Выборку считает потребитель — здесь проверяется только форма
 * фильтра, который кит собирает, и подпись его токена.
 */
const FIELDS: FilterField[] = [
  { id: "amount", label: "Amount", kind: "number-range", values: [] },
  { id: "created", label: "Created", kind: "date-range", values: [] },
  {
    id: "status",
    label: "Status",
    values: [
      { id: "paid", label: "Paid" },
      { id: "open", label: "Open" },
    ],
  },
];

async function pickField(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(screen.getByRole("button", { name: /Add filter/ }));
  await user.click(screen.getByRole("button", { name: /Field/ }));
  await user.click(screen.getByRole("option", { name }));
}

const applyButton = () => screen.getByRole("button", { name: /Apply/ }) as HTMLButtonElement;

describe("a number range in FilterBarAdd", () => {
  test("a number field shows two inputs instead of a value list", async () => {
    const user = userEvent.setup();
    render(<FilterBarAdd fields={FIELDS} filters={[]} onAdd={() => {}} />);

    await pickField(user, "Amount");

    expect(screen.getByRole("textbox", { name: "From" })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "To" })).toBeTruthy();
    // Список значений здесь не нужен: «Значение» остаётся только у `values`.
    expect(screen.queryByRole("button", { name: /Value/ })).toBeNull();
  });

  test("Apply is disabled until at least one bound is set", async () => {
    const user = userEvent.setup();
    render(<FilterBarAdd fields={FIELDS} filters={[]} onAdd={() => {}} />);

    await pickField(user, "Amount");
    expect(applyButton().disabled).toBe(true);

    await user.type(screen.getByRole("textbox", { name: "To" }), "100");
    await user.tab();
    // Одной границы достаточно: «до 100» — полноправный фильтр.
    expect(applyButton().disabled).toBe(false);
  });

  test("both bounds yield a range with a “50–100” label", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(<FilterBarAdd fields={FIELDS} filters={[]} onAdd={onAdd} />);

    await pickField(user, "Amount");
    await user.type(screen.getByRole("textbox", { name: "From" }), "50");
    await user.tab();
    await user.type(screen.getByRole("textbox", { name: "To" }), "100");
    await user.click(applyButton());

    expect(onAdd).toHaveBeenCalledWith({
      id: "amount:range",
      field: "amount",
      value: "50",
      to: "100",
      label: "Amount: 50–100",
    });
  });

  test("only the lower bound: an open range “from 50” with an empty `to`", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(<FilterBarAdd fields={FIELDS} filters={[]} onAdd={onAdd} />);

    await pickField(user, "Amount");
    await user.type(screen.getByRole("textbox", { name: "From" }), "50");
    await user.click(applyButton());

    // `to: ""`, а не отсутствие ключа: без него токен стал бы равенством.
    expect(onAdd).toHaveBeenCalledWith({
      id: "amount:range",
      field: "amount",
      value: "50",
      to: "",
      label: "Amount: from 50",
    });
  });

  test("only the upper bound: an open range “to 100” with an empty `value`", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(<FilterBarAdd fields={FIELDS} filters={[]} onAdd={onAdd} />);

    await pickField(user, "Amount");
    await user.type(screen.getByRole("textbox", { name: "To" }), "100");
    await user.click(applyButton());

    expect(onAdd).toHaveBeenCalledWith({
      id: "amount:range",
      field: "amount",
      value: "",
      to: "100",
      label: "Amount: to 100",
    });
  });

  test("an inverted range cannot be applied", async () => {
    const user = userEvent.setup();
    render(<FilterBarAdd fields={FIELDS} filters={[]} onAdd={() => {}} />);

    await pickField(user, "Amount");
    await user.type(screen.getByRole("textbox", { name: "From" }), "100");
    await user.tab();
    await user.type(screen.getByRole("textbox", { name: "To" }), "50");
    await user.tab();

    // «От 100 до 50» не выберет ничего, и пользователь прочтёт пустоту как
    // «данных нет».
    expect(applyButton().disabled).toBe(true);
  });

  test("a clean zero is a bound, not an empty field", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(<FilterBarAdd fields={FIELDS} filters={[]} onAdd={onAdd} />);

    await pickField(user, "Amount");
    await user.type(screen.getByRole("textbox", { name: "From" }), "0");
    await user.click(applyButton());

    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ value: "0", to: "" }));
  });

  test("a range field that is already applied is not offered again", async () => {
    const user = userEvent.setup();
    render(
      <FilterBarAdd
        fields={FIELDS}
        filters={[{ id: "amount:range", field: "amount", value: "1", to: "2" }]}
        onAdd={() => {}}
      />
    );

    await user.click(screen.getByRole("button", { name: /Add filter/ }));
    await user.click(screen.getByRole("button", { name: /Field/ }));

    // Два диапазона по одному полю — это пересечение, а не добавление; второго
    // токена пользователь бы не отличил от первого.
    expect(screen.queryByRole("option", { name: "Amount" })).toBeNull();
    expect(screen.getByRole("option", { name: "Created" })).toBeTruthy();
  });

  test("when only applied range fields remain, the button is disabled", () => {
    render(
      <FilterBarAdd
        fields={[FIELDS[0]!]}
        filters={[{ id: "amount:range", field: "amount", value: "1", to: "" }]}
        onAdd={() => {}}
      />
    );

    expect((screen.getByRole("button", { name: /Add filter/ }) as HTMLButtonElement).disabled).toBe(
      true
    );
  });

  test("the default `kind` stays a value list", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(<FilterBarAdd fields={FIELDS} filters={[]} onAdd={onAdd} />);

    await pickField(user, "Status");
    await user.click(screen.getByRole("button", { name: /Value/ }));
    await user.click(screen.getByRole("option", { name: "Paid" }));
    await user.click(applyButton());

    expect(onAdd).toHaveBeenCalledWith({
      id: "status:paid",
      field: "status",
      value: "paid",
      label: "Status: Paid",
    });
  });

  test("switching the field clears the typed bounds", async () => {
    const user = userEvent.setup();
    render(<FilterBarAdd fields={FIELDS} filters={[]} onAdd={() => {}} />);

    await pickField(user, "Amount");
    await user.type(screen.getByRole("textbox", { name: "From" }), "50");
    await user.tab();
    await user.click(screen.getByRole("button", { name: /Amount/ }));
    await user.click(screen.getByRole("option", { name: "Status" }));

    expect(applyButton().disabled).toBe(true);
  });

  test("focus returns to the trigger after adding a range", async () => {
    const user = userEvent.setup();
    render(<FilterBarAdd fields={FIELDS} filters={[]} onAdd={() => {}} />);
    const trigger = screen.getByRole("button", { name: /Add filter/ });

    await pickField(user, "Amount");
    await user.type(screen.getByRole("textbox", { name: "From" }), "1");
    await user.click(applyButton());

    expect(document.activeElement).toBe(trigger);
  });
});

describe("a date range in FilterBarAdd", () => {
  const MONTH = new Date();
  const iso = `${MONTH.getFullYear()}-${String(MONTH.getMonth() + 1).padStart(2, "0")}-15`;
  const longDate = (locale: string) =>
    new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" }).format(
      new Date(MONTH.getFullYear(), MONTH.getMonth(), 15)
    );

  /** Выбрать 15-е число текущего месяца в открытом календаре. */
  async function pickFifteenth(user: ReturnType<typeof userEvent.setup>) {
    const grid = screen.getByRole("grid");
    const cell = within(grid)
      .getAllByRole("button")
      .find((b) => b.textContent === "15" && !b.hasAttribute("aria-disabled"));
    await user.click(cell!);
  }

  test("two date triggers named “From” and “To” appear", async () => {
    const user = userEvent.setup();
    render(<FilterBarAdd fields={FIELDS} filters={[]} onAdd={() => {}} />);

    await pickField(user, "Created");

    expect(screen.getByRole("group", { name: "From" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "To" })).toBeTruthy();
  });

  test("the picked date goes out as an ISO string, the label is in the provider locale", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(<FilterBarAdd fields={FIELDS} filters={[]} onAdd={onAdd} />);

    await pickField(user, "Created");
    await user.click(within(screen.getByRole("group", { name: "To" })).getByRole("button"));
    await pickFifteenth(user);
    await user.click(applyButton());

    // Календарь вложен в поповер добавления, и выбор даты не закрыл его:
    // «Применить» остался на месте.
    expect(onAdd).toHaveBeenCalledWith({
      id: "created:range",
      field: "created",
      value: "",
      to: iso,
      label: `Created: to ${longDate("en-US")}`,
    });
  });
});

describe("a range token in FilterBar", () => {
  test("the token shows the label the kit built and is removed like any other", async () => {
    const user = userEvent.setup();
    const filters: TableFilter[] = [
      { id: "amount:range", field: "amount", value: "50", to: "100", label: "Amount: 50–100" },
      { id: "status:paid", field: "status", value: "paid", label: "Status: Paid" },
    ];
    const onFiltersChange = vi.fn();
    render(<FilterBar filters={filters} onFiltersChange={onFiltersChange} />);

    expect(screen.getByText("Amount: 50–100")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Remove filter Amount: 50–100" }));
    expect(onFiltersChange).toHaveBeenCalledWith([filters[1]]);
  });

  test.each([
    ["both bounds", { value: "50", to: "100" }, "amount: 50–100"],
    ["lower bound", { value: "50", to: "" }, "amount: from 50"],
    ["upper bound", { value: "", to: "100" }, "amount: to 100"],
  ])("without a label a range token is assembled by the kit: %s", (_name, bounds, text) => {
    render(
      <FilterBar filters={[{ id: "r", field: "amount", ...bounds }]} onFiltersChange={() => {}} />
    );

    // Раньше здесь вышло бы «amount: 50» — диапазон выглядел равенством.
    expect(screen.getByText(text)).toBeTruthy();
  });

  test("an equality filter with no `to` keeps its “field: value” label", () => {
    render(
      <FilterBar filters={[{ id: "f", field: "amount", value: "50" }]} onFiltersChange={() => {}} />
    );
    expect(screen.getByText("amount: 50")).toBeTruthy();
  });

  test("added through FilterBarAdd, a range shows up as a token", async () => {
    const user = userEvent.setup();
    function Live() {
      const [filters, setFilters] = useState<TableFilter[]>([]);
      return (
        <FilterBar filters={filters} onFiltersChange={setFilters}>
          <FilterBarAdd
            fields={FIELDS}
            filters={filters}
            onAdd={(f) => setFilters((prev) => [...prev, f])}
          />
        </FilterBar>
      );
    }
    render(<Live />);

    await pickField(user, "Amount");
    await user.type(screen.getByRole("textbox", { name: "From" }), "50");
    await user.tab();
    await user.type(screen.getByRole("textbox", { name: "To" }), "100");
    await user.click(applyButton());

    expect(screen.getByText("Amount: 50–100")).toBeTruthy();
  });
});
