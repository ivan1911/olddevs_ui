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
 * The fields come in as a prop: no domain vocabulary appears in the kit. This is what distinguishes
 * the component from `LibraryFilterBar` in the front end, where 373 lines consist of hard-coded
 * groups and product pickers. What gets carried over is the shape, not the code.
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

/** Fields with ranges and values mixed together: the `kind` sets the look of the field. */
const RANGE_FIELDS: FilterField[] = [
  { id: "amount", label: "Amount", kind: "number-range", values: [] },
  { id: "created", label: "Created", kind: "date-range", values: [] },
  FIELDS[1]!,
];

/** Tokens and the add control together: the whole working set. */
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

/** Empty: only the add button remains. */
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
 * Two filters on one field. Their labels look alike, and one of them can be removed only
 * because the token has its own `id`, not a "field + value" pair.
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
 * Ranges: an amount and a date instead of buckets ("under $50", "last 7 days"), ADR-0063.
 *
 * `kind: "number-range"` and `"date-range"` give the popover two fields, "From" and "To".
 * One bound is enough: the token reads "Amount: from 50" or "Created: to
 * March 12, 2026". The filter carries `to`: an empty string means an open bound.
 * The consumer computes the filtered rows for such a filter; the kit describes only its shape.
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

/** Ranges from an empty set: adding them and setting their bounds from scratch. */
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
