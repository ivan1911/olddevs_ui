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
 * There is no active view. In the client's app this is the "default view", a reset address.
 * Returning to it is done with a view that the consumer adds to the list itself: the kit does not
 * introduce its own concept of "reset", because it does not know what counts as empty for the app.
 */
export const WithoutActive: Story = {
  args: { activeId: null },
};

/**
 * Live switching: the snapshot arrives whole in a single call, and the consumer applies it:
 * here into the story's local state, in the client's app into the address bar.
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
            // One call, the whole snapshot. Parsing by key is the consumer's knowledge.
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

/** A long list wraps by rows instead of being cut off or scrolled. */
export const ManyViews: Story = {
  // A narrow frame: in a wide frame all views fit on one row, so the wrapping does not show.
  decorators: [
    (Story) => (
      <div className="max-w-sm">
        <Story />
      </div>
    ),
  ],
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
