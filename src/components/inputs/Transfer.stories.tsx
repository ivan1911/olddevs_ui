import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Transfer, type TransferItem } from "./Transfer.js";

const RIGHTS: TransferItem[] = [
  { id: "reports", label: "View reports" },
  { id: "export", label: "Export data" },
  { id: "roles", label: "Manage roles" },
  { id: "delete", label: "Delete records", disabled: true },
  { id: "hooks", label: "Configure webhooks" },
  { id: "billing", label: "Manage billing" },
  { id: "invite", label: "Invite teammates" },
];

const meta = {
  title: "Inputs/Transfer",
  component: Transfer,
  parameters: { layout: "padded" },
  args: { items: RIGHTS, value: [], onChange: () => {} },
  render: (args) => {
    const [value, setValue] = useState(args.value);
    return <Transfer {...args} value={value} onChange={setValue} />;
  },
} satisfies Meta<typeof Transfer>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Живой перенос. «Delete records» выключен: показан, но не переносится —
 * скрыть его значило бы соврать про состав прав, а перенести — обойти запрет.
 */
export const Playground: Story = {
  args: { value: ["reports"] },
};

/**
 * Поиск в каждой колонке. Имя поля параметризовано подписью колонки: полей два,
 * и «Поиск» у обоих не различает их ничем.
 */
export const Searchable: Story = {
  args: { value: ["reports", "billing"], searchable: true },
};

/**
 * Свои подписи колонок. Домен остаётся у потребителя — кит не знает, что
 * именно раскладывают по колонкам.
 */
export const CustomLabels: Story = {
  args: {
    value: ["export"],
    sourceLabel: "All permissions",
    targetLabel: "Granted to the role",
  },
};

/** Пустая целевая колонка говорит «пусто», а не показывает голую рамку. */
export const Empty: Story = {
  args: { value: [] },
};
