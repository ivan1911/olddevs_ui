// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { FilterBar } from "../src/components/table/FilterBar.js";
import { FilterBarAdd, type FilterField } from "../src/components/table/FilterBarAdd.js";
import type { TableFilter } from "../src/lib/table-state.js";

afterEach(cleanup);

const FILTERS: TableFilter[] = [
  { id: "f1", field: "section", value: "contracts", label: "Section: Contracts" },
  { id: "f2", field: "section", value: "acts", label: "Section: Reports" },
];

describe("FilterBar", () => {
  test("an empty set leaves neither tokens nor a clear button", () => {
    render(<FilterBar filters={[]} onFiltersChange={() => {}} />);
    expect(screen.queryByRole("row")).toBeNull();
    expect(screen.queryByRole("button", { name: "Clear all" })).toBeNull();
  });

  test("the default token label is “field: value”", () => {
    render(
      <FilterBar
        filters={[{ id: "f", field: "section", value: "Contracts" }]}
        onFiltersChange={() => {}}
      />
    );
    expect(screen.getByText("section: Contracts")).toBeTruthy();
  });

  /**
   * Имя кнопки обязано называть фильтр — три «Снять» подряд скринридер читает
   * неразличимо. Но собирает его react-aria: подпись тега дописывается к нашей
   * автоматически, и своя вставка давала задвоение.
   */
  test("the remove button is named together with its filter", () => {
    render(<FilterBar filters={FILTERS} onFiltersChange={() => {}} />);
    expect(screen.getByRole("button", { name: "Remove filter Section: Contracts" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Remove filter Section: Reports" })).toBeTruthy();
    // И ровно один раз: своя вставка имени давала задвоение.
    expect(
      screen.queryByRole("button", { name: /Section: Contracts Section: Contracts/ })
    ).toBeNull();
  });

  test("removing by mouse reports outwards and removes the right one of two similar", async () => {
    const user = userEvent.setup();
    const onFiltersChange = vi.fn();
    render(<FilterBar filters={FILTERS} onFiltersChange={onFiltersChange} />);

    await user.click(screen.getByRole("button", { name: "Remove filter Section: Reports" }));
    // Снятие идёт по `id`, а не по подписи: у двух фильтров одно поле.
    expect(onFiltersChange).toHaveBeenCalledWith([FILTERS[0]]);
  });

  test("removal works from the keyboard", async () => {
    const user = userEvent.setup();
    const onFiltersChange = vi.fn();
    render(<FilterBar filters={FILTERS} onFiltersChange={onFiltersChange} />);

    await user.tab();
    await user.keyboard("{Delete}");
    expect(onFiltersChange).toHaveBeenCalled();
  });

  test("“clear all” appears from the second filter on", () => {
    const { rerender } = render(<FilterBar filters={[FILTERS[0]!]} onFiltersChange={() => {}} />);
    // При одном фильтре кнопка делает то же, что его крестик, и только
    // удлиняет обход с клавиатуры.
    expect(screen.queryByRole("button", { name: "Clear all" })).toBeNull();

    rerender(<FilterBar filters={FILTERS} onFiltersChange={() => {}} />);
    expect(screen.getByRole("button", { name: "Clear all" })).toBeTruthy();
  });

  test("a custom label overrides the default but not the id", async () => {
    const user = userEvent.setup();
    const onFiltersChange = vi.fn();
    render(
      <FilterBar
        filters={[{ id: "f1", field: "section", value: "contracts" }]}
        renderLabel={() => "Custom text"}
        onFiltersChange={onFiltersChange}
      />
    );

    await user.click(screen.getByRole("button", { name: "Remove filter Custom text" }));
    expect(onFiltersChange).toHaveBeenCalledWith([]);
  });
});

const FIELDS: FilterField[] = [
  {
    id: "section",
    label: "Section",
    values: [
      { id: "contracts", label: "Contracts" },
      { id: "acts", label: "Reports" },
    ],
  },
];

describe("FilterBarAdd", () => {
  test("the kit has no domain dictionary: fields arrive as a prop", async () => {
    const user = userEvent.setup();
    render(<FilterBarAdd fields={FIELDS} filters={[]} onAdd={() => {}} />);

    await user.click(screen.getByRole("button", { name: /Add filter/ }));
    expect(screen.getByRole("button", { name: /Field/ })).toBeTruthy();
  });

  test("an already applied value is not offered again", async () => {
    const user = userEvent.setup();
    render(
      <FilterBarAdd
        fields={FIELDS}
        filters={[{ id: "x", field: "section", value: "contracts" }]}
        onAdd={() => {}}
      />
    );

    await user.click(screen.getByRole("button", { name: /Add filter/ }));
    await user.click(screen.getByRole("button", { name: /Field/ }));
    await user.click(screen.getByRole("option", { name: "Section" }));
    await user.click(screen.getByRole("button", { name: /Value/ }));

    // «Договоры» уже применены: второй такой же токен выборку не изменит, а
    // различить их пользователь не сможет.
    expect(screen.getByRole("option", { name: "Reports" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "Contracts" })).toBeNull();
  });

  test("the “field + value” key does not glue: ab+c and a+bc are different pairs", async () => {
    const user = userEvent.setup();
    // Пары дают одну строку при склейке без разделителя: "ab" + "c" и "a" + "bc".
    // Если разделитель потеряется, применённая первая пара спрячет вторую.
    const crossFields: FilterField[] = [
      { id: "ab", label: "AB", values: [{ id: "c", label: "C" }] },
      { id: "a", label: "A", values: [{ id: "bc", label: "BC" }] },
    ];
    render(
      <FilterBarAdd
        fields={crossFields}
        filters={[{ id: "x", field: "ab", value: "c" }]}
        onAdd={() => {}}
      />
    );

    await user.click(screen.getByRole("button", { name: /Add filter/ }));
    await user.click(screen.getByRole("button", { name: /Field/ }));
    expect(screen.getByRole("option", { name: "A" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "AB" })).toBeNull();
  });

  test("when there is nothing to add the button is disabled", () => {
    render(
      <FilterBarAdd
        fields={FIELDS}
        filters={[
          { id: "a", field: "section", value: "contracts" },
          { id: "b", field: "section", value: "acts" },
        ]}
        onAdd={() => {}}
      />
    );
    const button = screen.getByRole("button", { name: /Add filter/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  test("adding yields a labelled token and returns focus to the button", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(<FilterBarAdd fields={FIELDS} filters={[]} onAdd={onAdd} />);

    const trigger = screen.getByRole("button", { name: /Add filter/ });
    await user.click(trigger);
    await user.click(screen.getByRole("button", { name: /Field/ }));
    await user.click(screen.getByRole("option", { name: "Section" }));
    await user.click(screen.getByRole("button", { name: /Value/ }));
    await user.click(screen.getByRole("option", { name: "Contracts" }));
    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(onAdd).toHaveBeenCalledWith({
      id: "section:contracts",
      field: "section",
      value: "contracts",
      label: "Section: Contracts",
    });
    // Потерянный фокус уезжает в начало документа, и обход страницы
    // начинается заново.
    expect(document.activeElement).toBe(trigger);
  });
});

describe("FilterBar and FilterBarAdd together", () => {
  test("an added filter appears as a token and can be removed", async () => {
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

    await user.click(screen.getByRole("button", { name: /Add filter/ }));
    await user.click(screen.getByRole("button", { name: /Field/ }));
    await user.click(screen.getByRole("option", { name: "Section" }));
    await user.click(screen.getByRole("button", { name: /Value/ }));
    await user.click(screen.getByRole("option", { name: "Reports" }));
    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(screen.getByText("Section: Reports")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Remove filter Section: Reports" }));
    expect(screen.queryByText("Section: Reports")).toBeNull();
  });
});
