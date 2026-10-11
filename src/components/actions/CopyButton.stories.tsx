import type { Meta, StoryObj } from "@storybook/react-vite";
import { CopyButton, type CopyButtonProps } from "./CopyButton.js";

const meta = {
  title: "Actions/CopyButton",
  component: CopyButton,
  parameters: { layout: "padded" },
  tags: ["periphery"],
  args: { value: "ACME-4217" },
} satisfies Meta<CopyButtonProps>;

export default meta;
type Story = StoryObj<CopyButtonProps>;

export const Playground: Story = {
  render: (args) => (
    <div className="flex items-center gap-2">
      <code className="bg-bg-2 border-line-soft rounded px-2 py-1 font-mono text-[13px]">
        ACME-4217
      </code>
      <CopyButton {...args} size="sm" variant="ghost" />
    </div>
  ),
};

/** С подписью кнопка перестаёт быть иконочной. */
export const WithLabel: Story = {
  render: (args) => (
    <CopyButton {...args} size="sm" variant="outline">
      Copy the key
    </CopyButton>
  ),
};

/**
 * Отказ буфера — законный исход, а не исключение: в небезопасном контексте
 * `navigator.clipboard` отсутствует вовсе. Кнопка говорит об этом, а не
 * притворяется успешной.
 */
export const CopyFailed: Story = {
  render: () => (
    <div className="flex flex-col gap-2">
      <CopyButton value="ACME-4217" size="sm" variant="outline">
        Check it in an http context
      </CopyButton>
      <span className="text-fg-3 text-[11px]">
        Copying works in a secure context; the failure shows where the API is unavailable.
      </span>
    </div>
  ),
};
