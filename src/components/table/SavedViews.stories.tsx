import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { SavedViews, type SavedView, type SavedViewsProps } from "./SavedViews.js";

interface Filters {
  status: string;
  page: number;
}

const views: SavedView<Filters>[] = [
  { id: "all", name: "All", state: { status: "", page: 1 } },
  { id: "mine", name: "Mine", state: { status: "mine", page: 1 } },
  { id: "drafts", name: "Drafts", state: { status: "draft", page: 1 } },
  { id: "failed", name: "Failed", state: { status: "failed", page: 1 } },
];

const meta = {
  title: "Table/SavedViews",
  component: SavedViews,
  args: {
    views,
    activeId: "all",
    onSelect: () => {},
  },
} satisfies Meta<SavedViewsProps<Filters>>;

export default meta;
type Story = StoryObj<SavedViewsProps<Filters>>;

export const Playground: Story = {};

/**
 * Активного вида нет — у заказчика это «вид по умолчанию», сброшенный адрес.
 * Возврат к нему делается видом, который потребитель кладёт в список сам:
 * своего понятия «сброс» кит не заводит, потому что не знает, что для
 * приложения пусто.
 */
export const WithoutActive: Story = {
  args: { activeId: null },
};

/**
 * Живое переключение: снимок приходит целиком за один вызов, и применяет его
 * потребитель — здесь в локальное состояние истории, у заказчика в адрес.
 */
export const WithApply: Story = {
  render: (args) => {
    const [active, setActive] = useState<string | null>("mine");
    const [applied, setApplied] = useState<Filters>(views[1]!.state);

    return (
      <div className="flex flex-col gap-3">
        <SavedViews
          {...args}
          activeId={active}
          onSelect={(view) => {
            // Один вызов, весь снимок. Разбор по ключу — знание потребителя.
            setActive(view.id);
            setApplied(view.state);
          }}
        />
        <pre className="text-fg-2 bg-bg-2 border-line-soft rounded-md border p-3 text-xs">
          {JSON.stringify(applied, null, 2)}
        </pre>
      </div>
    );
  },
};

/** Длинный список переносится по строкам, а не режется и не скроллится. */
export const ManyViews: Story = {
  args: {
    views: [
      ...views,
      { id: "week", name: "This week", state: { status: "", page: 1 } },
      { id: "month", name: "This month", state: { status: "", page: 1 } },
      { id: "archive", name: "Archive", state: { status: "archived", page: 1 } },
      { id: "long", name: "A very long saved view name", state: { status: "", page: 1 } },
    ],
    activeId: "week",
  },
};
