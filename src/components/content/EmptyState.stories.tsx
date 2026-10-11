import type { Meta, StoryObj } from "@storybook/react-vite";
import { SearchIcon } from "../../icons.js";
import { Button } from "../actions/Button.js";
import { EmptyState, type EmptyStateProps } from "./EmptyState.js";

const meta = {
  title: "Content/EmptyState",
  component: EmptyState,
  parameters: { layout: "padded" },
  args: { title: "Nothing found" },
} satisfies Meta<EmptyStateProps>;

export default meta;
type Story = StoryObj<EmptyStateProps>;

export const AsPage: Story = {
  args: {
    icon: <SearchIcon size={28} strokeWidth={1.5} />,
    title: "Nothing found",
    description: "Try a different query or reset the filters.",
  },
};

export const WithAction: Story = {
  args: {
    icon: <SearchIcon size={28} strokeWidth={1.5} />,
    title: "Nothing found",
    description: "Try a different query or reset the filters.",
    action: (
      <Button size="sm" variant="soft">
        Reset filters
      </Button>
    ),
  },
};

export const Compact: Story = {
  args: {
    size: "sm",
    title: "Nothing found",
    description: "Narrow the query.",
  },
};

export const Matrix: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      <div className="border-line-soft rounded-xl border">
        <EmptyState
          icon={<SearchIcon size={28} strokeWidth={1.5} />}
          title="Nothing found"
          description="Try a different query or reset the filters."
          action={
            <Button size="sm" variant="soft">
              Reset filters
            </Button>
          }
        />
      </div>
      <div className="border-line-soft w-[260px] rounded-xl border">
        <EmptyState size="sm" title="Empty" description="No collections yet." />
      </div>
      <div className="border-line-soft w-[260px] rounded-xl border">
        <EmptyState size="sm" title="Nothing found" />
      </div>
    </div>
  ),
};
