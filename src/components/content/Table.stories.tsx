import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import type { Key, SortDescriptor } from "react-aria-components";
import { Table } from "./Table.js";

/** Wave 10: data. A lighter bar, no snapshots. */
const meta = {
  title: "Content/Table",
  component: Table,
  parameters: { layout: "padded" },
  tags: ["periphery"],
} satisfies Meta<typeof Table>;

export default meta;
type Story = StoryObj;

const PHOTOS = [
  { id: "1", name: "Night city", category: "City", size: 2400, status: "published" },
  { id: "2", name: "Sunset over the sea", category: "Nature", size: 1800, status: "queued" },
  { id: "3", name: "Fog in the mountains", category: "Nature", size: 3200, status: "draft" },
];

export const BasicTable: Story = {
  render: function Render() {
    const [sort, setSort] = useState<SortDescriptor>({ column: "name", direction: "ascending" });
    const [selected, setSelected] = useState<Set<Key>>(new Set(["2"]));

    return (
      <Table
        aria-label="Photos"
        items={PHOTOS}
        sort={sort}
        onSortChange={setSort}
        selectedKeys={selected}
        onSelectionChange={setSelected}
        columns={[
          { id: "name", header: "Name", cell: (w) => w.name, sortable: true },
          { id: "category", header: "Category", cell: (w) => w.category },
          {
            id: "size",
            header: "Size",
            cell: (w) => `${w.size} KB`,
            sortable: true,
            align: "end",
          },
        ]}
      />
    );
  },
};

/** Without the axis props there is no sorting and no checkboxes in the markup at all. */
export const TableWithoutAxes: Story = {
  render: () => (
    <Table
      aria-label="Photos without axes"
      items={PHOTOS}
      columns={[
        { id: "name", header: "Name", cell: (w) => w.name },
        { id: "category", header: "Category", cell: (w) => w.category },
      ]}
    />
  ),
};

/**
 * Row expansion is the `Table` axis (ADR-0022). It is the only one that required
 * touching the stable component: the detail row lives inside `<tbody>`, between the
 * react-aria collection rows, and it cannot be inserted from outside as a wrapper.
 *
 * As with the other axes, the table does not store the state: here the story holds it,
 * and in an app `useTableState` will hold it.
 */
export const TableWithExpansion: Story = {
  render: function ExpandDemo() {
    const [expanded, setExpanded] = useState<Set<string>>(new Set(["1"]));
    return (
      <Table
        aria-label="Photos with details"
        items={PHOTOS}
        columns={[
          { id: "name", header: "Name", cell: (w) => w.name },
          { id: "category", header: "Category", cell: (w) => w.category },
        ]}
        expandedKeys={expanded}
        onExpandedChange={(keys) => setExpanded(keys as Set<string>)}
        rowLabel={(w) => w.name}
        renderDetail={(w) => (
          <dl className="text-fg-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[13px]">
            <dt className="font-medium">Category</dt>
            <dd>{w.category}</dd>
            <dt className="font-medium">Identifier</dt>
            <dd>{w.id}</dd>
          </dl>
        )}
      />
    );
  },
};

export const EmptyTable: Story = {
  render: () => (
    <Table
      aria-label="Empty"
      items={[]}
      emptyText="No photos yet"
      columns={[{ id: "name", header: "Name", cell: () => null }]}
    />
  ),
};

/**
 * The two remaining axes: the sticky header and column resizing.
 *
 * The sticky header works only inside a container with its own height and scrolling:
 * the table itself does not know its height and cannot know it.
 */
export const StickyHeaderAndWidths: Story = {
  render: () => (
    <div className="border-line-soft rounded-control h-[220px] overflow-auto border">
      <Table
        aria-label="Many photos"
        stickyHeader
        resizable
        items={Array.from({ length: 20 }, (_, i) => ({
          id: String(i),
          name: `Photo #${i + 1}`,
          category: i % 2 ? "Nature" : "City",
          size: 1000 + i * 100,
          status: "published",
        }))}
        columns={[
          { id: "name", header: "Name", cell: (w) => w.name, width: "2fr" },
          { id: "category", header: "Category", cell: (w) => w.category, width: "1fr" },
          { id: "size", header: "Size", cell: (w) => `${w.size} KB`, width: "1fr", align: "end" },
        ]}
      />
    </div>
  ),
};

/**
 * A row action next to the selection: a click on the row and Enter "open" the record,
 * while the checkboxes check it. While nothing is selected, a click on the row is the
 * action; once a selection exists, a click on the row toggles it (the react-aria rule),
 * and the action stays on Enter.
 *
 * A link in a cell with `stopPropagation` is not needed for this.
 */
export const TableWithRowAction: Story = {
  render: function RowActionDemo() {
    const [selected, setSelected] = useState<Set<Key>>(new Set());
    const [opened, setOpened] = useState<string | null>(null);

    return (
      <div className="flex flex-col gap-3">
        <Table
          aria-label="Photos with a row action"
          items={PHOTOS}
          selectedKeys={selected}
          onSelectionChange={setSelected}
          onRowAction={(w) => setOpened(w.name)}
          columns={[
            { id: "name", header: "Name", cell: (w) => w.name },
            { id: "category", header: "Category", cell: (w) => w.category },
          ]}
        />
        <p aria-live="polite" className="text-fg-2 text-sm">
          {opened ? `Opened: ${opened}` : "Nothing opened"}
        </p>
      </div>
    );
  },
};
