import type { Meta, StoryObj } from "@storybook/react-vite";
import { RefreshIcon } from "../../icons.js";
import { Button } from "../actions/Button.js";
import { ErrorState, type ErrorStateProps } from "./ErrorState.js";

const meta = {
  title: "Content/ErrorState",
  component: ErrorState,
  parameters: { layout: "padded" },
} satisfies Meta<ErrorStateProps>;

export default meta;
type Story = StoryObj<ErrorStateProps>;

export const AsPage: Story = {
  args: {
    description: "Could not load the collections.",
    action: (
      <Button size="sm" icon={<RefreshIcon />}>
        Try again
      </Button>
    ),
  },
};

export const WithoutAction: Story = {
  args: { description: "Could not load photo data." },
};

export const Compact: Story = {
  args: { size: "sm", description: "The category list is unavailable." },
};

export const Matrix: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      <div className="border-line-soft rounded-xl border">
        <ErrorState
          description="Could not load the collections."
          action={
            <Button size="sm" icon={<RefreshIcon />}>
              Try again
            </Button>
          }
        />
      </div>
      <div className="border-line-soft w-[260px] rounded-xl border">
        <ErrorState size="sm" description="The category list is unavailable." />
      </div>
      <div className="border-line-soft w-[260px] rounded-xl border">
        <ErrorState size="sm" icon={null} title="The request failed" />
      </div>
    </div>
  ),
};
