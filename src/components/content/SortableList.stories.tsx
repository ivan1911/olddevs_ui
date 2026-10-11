import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import type { Key } from "react-aria-components";
import { UiProvider } from "../../i18n/UiProvider.js";
import ru from "../../locales/ru.js";
import { EmptyState } from "./EmptyState.js";
import {
  SortableList,
  type SortableItem,
  type SortableListProps,
  type SortableMove,
} from "./SortableList.js";

const meta = {
  title: "Content/SortableList",
  component: SortableList,
  parameters: { layout: "padded" },
  tags: ["periphery"],
} satisfies Meta<SortableListProps>;

export default meta;
type Story = StoryObj<SortableListProps>;

const INITIAL: SortableItem[] = [
  { id: "1", label: "Overview" },
  { id: "2", label: "Campaigns" },
  { id: "3", label: "Schedule" },
  { id: "4", label: "Reports" },
  { id: "5", label: "Settings" },
];

function Demo({ locale }: { locale?: string }) {
  const [items, setItems] = useState(INITIAL);
  const reorder = (ids: Key[]) =>
    setItems(ids.map((id) => items.find((i) => i.id === id)!).filter(Boolean));

  const list = (
    <div className="w-[320px]">
      <SortableList items={items} onReorder={reorder} aria-label="Section order" />
      <p className="text-fg-3 mt-2 text-[11px]" data-testid="order">
        {items.map((i) => i.id).join(",")}
      </p>
    </div>
  );

  // Локаль передаётся вместе с каталогом: react-aria возьмёт из неё свои
  // объявления, кит — свои подписи. Одну без другого показывать нечестно.
  return locale ? (
    <UiProvider locale={locale} messages={ru}>
      {list}
    </UiProvider>
  ) : (
    list
  );
}

/**
 * Перетащите мышью — или возьмите с клавиатуры: стрелка вправо переводит фокус
 * на ручку, Enter начинает перетаскивание, Tab выбирает цель, Enter применяет,
 * Escape отменяет.
 */
export const Playground: Story = { render: () => <Demo /> };

/**
 * Под русской локалью объявления react-aria приходят по-русски: «Начато
 * перетаскивание. Нажмите клавишу Tab для выбора цели…». Своей живой области у
 * списка нет — она дублировала бы эти строки.
 */
export const RussianLocale: Story = { render: () => <Demo locale="ru-RU" /> };

export const Empty: Story = {
  render: () => (
    <div className="w-[320px]">
      <SortableList
        items={[]}
        onReorder={() => {}}
        aria-label="Section order"
        emptyText={<EmptyState title="Nothing to sort" />}
      />
    </div>
  ),
};

type Column = { id: string; label: string; items: SortableItem[] };

const BOARD: Column[] = [
  {
    id: "todo",
    label: "To do",
    items: [
      { id: "a", label: "Write the brief" },
      { id: "b", label: "Pick the venue" },
    ],
  },
  { id: "doing", label: "In progress", items: [{ id: "c", label: "Book the speakers" }] },
  { id: "done", label: "Done", items: [] },
];

function BoardDemo() {
  const [columns, setColumns] = useState(BOARD);

  const reorderIn = (column: string) => (ids: Key[]) =>
    setColumns((all) =>
      all.map((c) =>
        c.id === column ? { ...c, items: ids.map((id) => c.items.find((i) => i.id === id)!) } : c
      )
    );

  // Состав колонок хранит экран: строка уходит из `from` и встаёт в `to` за один шаг.
  const move = ({ id, from, to, index }: SortableMove) =>
    setColumns((all) => {
      const row = all.find((c) => c.id === from)?.items.find((i) => i.id === id);
      if (!row) return all;
      return all.map((c) => {
        const items = c.items.filter((i) => i.id !== id);
        return c.id === to
          ? { ...c, items: [...items.slice(0, index), row, ...items.slice(index)] }
          : { ...c, items };
      });
    });

  return (
    <div>
      <div className="grid w-[720px] grid-cols-3 gap-3">
        {columns.map((column) => (
          <section key={column.id} aria-label={column.label} className="flex flex-col gap-2">
            <h3 className="text-[13px] font-semibold">{column.label}</h3>
            <SortableList
              id={column.id}
              group="board"
              items={column.items}
              onReorder={reorderIn(column.id)}
              onMove={move}
              aria-label={column.label}
              emptyText={<EmptyState size="sm" title="Drop a card here" />}
              className="min-h-24"
            />
          </section>
        ))}
      </div>
      <p className="text-fg-3 mt-2 text-[11px]" data-testid="board">
        {columns.map((c) => `${c.id}:${c.items.map((i) => i.id).join(",")}`).join(" ")}
      </p>
    </div>
  );
}

/**
 * Списки одной `group` обмениваются строками: перетащите карточку в соседнюю
 * колонку — или возьмите её с клавиатуры и Tab'ом перейдите к другому списку.
 * Пустая колонка принимает строку броском на сам список.
 */
export const Board: Story = { render: () => <BoardDemo /> };
