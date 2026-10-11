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
    // Прогресс неизвестен: у ответа нет длины. Это не то же самое, что ноль.
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
 * Доменный статус поверх механического: файл дошёл до сервера (`success`), но
 * это дубль, и зелёный бейдж был бы неправдой. Тон задаёт приложение, без него
 * цвет по-прежнему выводится из `state`.
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
        // Цвет текста ошибки следует `state`, а не `tone`.
        meta: "The server rejected the file: too large",
      },
    ],
  },
};

/** Пустая очередь: что показывать — решает потребитель. Итог при этом молчит. */
export const Empty: Story = {
  args: {
    items: [],
    empty: <EmptyState title="The queue is empty" description="Drag files in or pick them." />,
  },
};

/**
 * Граница с `FileDropzone`: область — это ВЫБОР файла, очередь — его судьба.
 * На экране они стоят рядом, и путают их именно поэтому.
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
