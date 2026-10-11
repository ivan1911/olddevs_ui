import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { FilterBar } from "./FilterBar.js";
import { FilterBarAdd, type FilterField } from "./FilterBarAdd.js";
import type { TableFilter } from "../../lib/table-state.js";

const meta = {
  title: "Table/FilterBar",
  component: FilterBar,
  parameters: { layout: "padded" },
} satisfies Meta<typeof FilterBar>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Поля приходят пропом — доменного словаря в ките не появляется. Это и
 * отличает компонент от `LibraryFilterBar` во фронте, где 373 строки состоят
 * из зашитых групп и продуктовых пикеров: переносится форма, а не код.
 */
const FIELDS: FilterField[] = [
  {
    id: "section",
    label: "Section",
    values: [
      { id: "contracts", label: "Contracts" },
      { id: "acts", label: "Reports" },
      { id: "invoices", label: "Invoices" },
    ],
  },
  {
    id: "status",
    label: "Status",
    values: [
      { id: "draft", label: "Draft" },
      { id: "published", label: "Published" },
    ],
  },
];

/** Поля с диапазонами и значениями вперемешку: вид поля задаёт `kind`. */
const RANGE_FIELDS: FilterField[] = [
  { id: "amount", label: "Amount", kind: "number-range", values: [] },
  { id: "created", label: "Created", kind: "date-range", values: [] },
  FIELDS[1]!,
];

/** Токены и добавление вместе — рабочий набор целиком. */
export const Playground: Story = {
  args: { filters: [], onFiltersChange: () => {} },
  render: function Live() {
    const [filters, setFilters] = useState<TableFilter[]>([
      {
        id: "section:contracts",
        field: "section",
        value: "contracts",
        label: "Section: Contracts",
      },
    ]);

    return (
      <FilterBar filters={filters} onFiltersChange={setFilters}>
        <FilterBarAdd
          fields={FIELDS}
          filters={filters}
          onAdd={(f) => setFilters((prev) => [...prev, f])}
        />
      </FilterBar>
    );
  },
};

/** Пусто: остаётся только кнопка добавления. */
export const WithoutFilters: Story = {
  args: { filters: [], onFiltersChange: () => {} },
  render: function EmptyDemo() {
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
  },
};

/**
 * Два фильтра по одному полю. Подписи похожи, и снять нужный можно только
 * потому, что у токена свой `id`, а не пара «поле + значение».
 */
export const TwoOnOneField: Story = {
  args: {
    filters: [
      {
        id: "section:contracts",
        field: "section",
        value: "contracts",
        label: "Section: Contracts",
      },
      { id: "section:acts", field: "section", value: "acts", label: "Section: Reports" },
    ],
    onFiltersChange: () => {},
  },
};

/**
 * Диапазоны: сумма и дата вместо корзин («до $50», «последние 7 дней»), ADR-0063.
 *
 * `kind: "number-range"` и `"date-range"` дают в поповере два поля «От» и «До».
 * Достаточно одной границы: токен читается «Amount: from 50» или «Created: to
 * March 12, 2026». Фильтр несёт `to` — пустая строка означает открытую границу.
 * Выборку по такому фильтру считает потребитель, кит описывает только его форму.
 */
export const Ranges: Story = {
  args: { filters: [], onFiltersChange: () => {} },
  render: function RangesDemo() {
    const [filters, setFilters] = useState<TableFilter[]>([
      {
        id: "amount:range",
        field: "amount",
        value: "50",
        to: "100",
        label: "Amount: 50–100",
      },
    ]);

    return (
      <FilterBar filters={filters} onFiltersChange={setFilters}>
        <FilterBarAdd
          fields={RANGE_FIELDS}
          filters={filters}
          onAdd={(f) => setFilters((prev) => [...prev, f])}
        />
      </FilterBar>
    );
  },
};

/** Диапазоны с пустого набора: добавление и границы с нуля. */
export const RangesFromScratch: Story = {
  args: { filters: [], onFiltersChange: () => {} },
  render: function RangesEmptyDemo() {
    const [filters, setFilters] = useState<TableFilter[]>([]);
    return (
      <FilterBar filters={filters} onFiltersChange={setFilters}>
        <FilterBarAdd
          fields={RANGE_FIELDS}
          filters={filters}
          onAdd={(f) => setFilters((prev) => [...prev, f])}
        />
      </FilterBar>
    );
  },
};
