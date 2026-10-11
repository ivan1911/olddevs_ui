import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Rating } from "./Rating.js";

const meta = {
  title: "Inputs/Rating",
  component: Rating,
  parameters: { layout: "centered" },
  args: { value: 3, "aria-label": "Quality" },
} satisfies Meta<typeof Rating>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Живая оценка: стрелки меняют значение, вся группа — один табстоп. */
export const Playground: Story = {
  render: (args) => {
    const [value, setValue] = useState(args.value);
    return <Rating {...args} value={value} onChange={setValue} />;
  },
};

/** Все значения подряд, включая ноль: снять оценку — законное действие. */
export const Values: Story = {
  render: (args) => (
    <div className="flex flex-col gap-2">
      {[0, 1, 3, 5].map((value) => (
        <Rating {...args} key={value} value={value} onChange={() => {}} />
      ))}
    </div>
  ),
};

/**
 * Показ и запрет — разные состояния. `readOnly` показывает данные и не гасит
 * их: приглушить показанное значит спрятать то, что показано специально.
 * `disabled` гасит, потому что это недоступное сейчас действие.
 */
export const ReadOnlyAndDisabled: Story = {
  render: (args) => (
    <div className="flex flex-col gap-2">
      <Rating {...args} value={4} readOnly caption="4,2 · 128 ratings" />
      <Rating {...args} value={2} disabled onChange={() => {}} />
    </div>
  ),
};

/** Малый размер — для строки таблицы и карточки. */
export const Small: Story = {
  args: { size: "sm", value: 4 },
  render: (args) => <Rating {...args} onChange={() => {}} />,
};
