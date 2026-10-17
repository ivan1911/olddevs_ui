import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Button } from "../actions/Button.js";
import { EmptyState } from "../content/EmptyState.js";
import { FileDropzone } from "./FileDropzone.js";
import { UploadQueue, type UploadItem, type UploadQueueProps } from "./UploadQueue.js";

const meta = {
  title: "Inputs/UploadQueue",
  component: UploadQueue,
  parameters: { layout: "padded" },
  tags: ["periphery"],
} satisfies Meta<UploadQueueProps>;

export default meta;
type Story = StoryObj<UploadQueueProps>;

const ITEMS: UploadItem[] = [
  {
    id: "1",
    name: "march-report.pdf",
    size: "2.4 MB",
    state: "success",
    statusLabel: "Done",
    actions: (
      <Button size="sm" variant="ghost">
        Remove
      </Button>
    ),
  },
  {
    id: "2",
    name: "contract.docx",
    size: "840 KB",
    state: "running",
    progress: 62,
    actions: (
      <Button size="sm" variant="ghost">
        Cancel
      </Button>
    ),
  },
  {
    id: "3",
    name: "passport-scan.jpg",
    size: "5.1 MB",
    state: "running",
    // Progress is unknown: the response has no length. That is not the same as zero.
    progress: null,
    statusLabel: "Processing",
  },
  {
    id: "4",
    name: "estimate.xlsx",
    size: "1.2 MB",
    state: "failed",
    meta: "The server rejected the file: too large",
    actions: (
      <Button size="sm" variant="outline">
        Retry
      </Button>
    ),
  },
  { id: "5", name: "attachment-1.png", size: "320 KB", state: "pending", statusLabel: "Queued" },
];

export const Playground: Story = { args: { items: ITEMS } };

/**
 * A domain status on top of the mechanical one: the file reached the server (`success`), but
 * it is a duplicate, and a green badge would be misleading. The app sets the tone; without it,
 * the color is still derived from `state`.
 */
export const DomainToneOverState: Story = {
  args: {
    items: [
      { id: "1", name: "march-report.pdf", size: "2.4 MB", state: "success", statusLabel: "Done" },
      {
        id: "2",
        name: "march-report-copy.pdf",
        size: "2.4 MB",
        state: "success",
        progress: 100,
        statusLabel: "Duplicate",
        tone: "warning",
        actions: (
          <Button size="sm" variant="ghost">
            Remove
          </Button>
        ),
      },
      {
        id: "3",
        name: "estimate.xlsx",
        size: "1.2 MB",
        state: "failed",
        statusLabel: "Skipped",
        tone: "neutral",
        // The error text color follows `state`, not `tone`.
        meta: "The server rejected the file: too large",
      },
    ],
  },
};

/** An empty queue: the consumer decides what to show. The summary stays silent here. */
export const Empty: Story = {
  args: {
    items: [],
    empty: <EmptyState title="The queue is empty" description="Drag files in or pick them." />,
  },
};

/**
 * The boundary with `FileDropzone`: the area is for selecting a file, the queue is for what happens to it.
 * The two sit side by side on screen, which is exactly why they get confused.
 */
export const NextToDropzone: Story = {
  args: { items: [] },
  render: function Render() {
    const [items, setItems] = useState<UploadItem[]>([]);
    return (
      <div className="flex w-[520px] flex-col gap-3">
        <FileDropzone
          onFiles={(files) =>
            setItems((prev) => [
              ...prev,
              ...files.map((f, i) => ({
                id: `${Date.now()}-${i}`,
                name: f.name,
                size: `${Math.round(f.size / 1024)} KB`,
                state: "pending" as const,
                statusLabel: "Queued",
              })),
            ])
          }
        />
        <UploadQueue items={items} />
      </div>
    );
  },
};
