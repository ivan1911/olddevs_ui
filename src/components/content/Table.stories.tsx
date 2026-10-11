import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import type { Key, SortDescriptor } from "react-aria-components";
import { Table } from "./Table.js";

/** Волна 10: данные. Облегчённая планка, снимков нет. */
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

/** Без пропов осей — ни сортировки, ни флажков в разметке нет вовсе. */
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
 * Раскрытие строки — ось `Table` (ADR-0022). Единственная, ради которой
 * пришлось трогать стабильный компонент: детальная строка живёт внутри
 * `<tbody>`, между строками коллекции react-aria, и вставить её надстройкой
 * снаружи невозможно.
 *
 * Состояние, как и у остальных осей, таблица не хранит — здесь его держит
 * история, в приложении будет держать `useTableState`.
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
 * Две оставшиеся оси: липкая шапка и изменение ширины колонок.
 *
 * Липкая шапка работает только внутри контейнера со своей высотой и
 * прокруткой — сама таблица высоты не знает и знать не может.
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
 * Действие по строке рядом с выделением: клик по строке и Enter «открывают»
 * запись, а отмечают её флажки. Пока ничего не выделено, клик по строке —
 * действие; когда выделение появилось, клик по строке его переключает (правило
 * react-aria), а действие остаётся на Enter.
 *
 * Ссылка в ячейке с `stopPropagation` для этого не нужна.
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
