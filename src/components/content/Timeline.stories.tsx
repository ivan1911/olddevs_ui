import type { Meta, StoryObj } from "@storybook/react-vite";
import { Timeline, type TimelineProps } from "./Timeline.js";

const meta = {
  title: "Content/Timeline",
  component: Timeline,
  parameters: { layout: "padded" },
} satisfies Meta<TimelineProps>;

export default meta;
type Story = StoryObj<TimelineProps>;

export const Running: Story = {
  args: {
    "aria-label": "Task steps",
    items: [
      { id: "1", label: "fetch_source", status: "success", time: "14:02:11" },
      { id: "2", label: "download", status: "success", time: "14:02:14" },
      { id: "3", label: "upload_s3", status: "running", statusLabel: "running" },
      { id: "4", label: "publish", status: "pending", statusLabel: "pending" },
    ],
  },
};

/** A failure: the label is bolder, and the details are colored with the danger tone. */
export const WithError: Story = {
  args: {
    "aria-label": "Task steps",
    items: [
      { id: "1", label: "fetch_source", status: "success", time: "14:02:11" },
      {
        id: "2",
        label: "download",
        status: "failed",
        statusLabel: "failed",
        details: "Not enough photos (2 needed, 0 received)",
        time: "14:02:19",
      },
      { id: "3", label: "publish", status: "pending", statusLabel: "pending" },
    ],
  },
};

export const Matrix: Story = {
  render: () => (
    <div className="flex flex-col gap-8">
      <Timeline
        aria-label="Every state"
        items={[
          { id: "1", label: "success", status: "success", statusLabel: "done" },
          { id: "2", label: "running", status: "running", statusLabel: "running" },
          {
            id: "3",
            label: "failed",
            status: "failed",
            statusLabel: "failed",
            details: "The failure reason in one line",
          },
          { id: "4", label: "pending", status: "pending", statusLabel: "pending" },
        ]}
      />
      <Timeline
        aria-label="One step"
        items={[{ id: "1", label: "single_step", status: "success" }]}
      />
    </div>
  ),
};
