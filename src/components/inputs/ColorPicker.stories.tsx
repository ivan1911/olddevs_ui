import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { ColorPicker } from "./ColorPicker.js";

const meta = {
  title: "Inputs/ColorPicker",
  component: ColorPicker,
  // Периферия по ADR-0038: обёртка над цветовыми компонентами react-aria,
  // своей математики цвета нет.
  tags: ["periphery"],
  parameters: { layout: "centered" },
  args: { value: "#4f7df3", onChange: () => {}, label: "Brand colour" },
  render: (args) => {
    const [value, setValue] = useState(args.value);
    return (
      <div className="flex items-center gap-3">
        <ColorPicker {...args} value={value} onChange={setValue} />
        <code className="text-fg-2 text-caption">{value}</code>
      </div>
    );
  },
} satisfies Meta<typeof ColorPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Область насыщенности, полоса тона и поле формата. */
export const Playground: Story = {};

/**
 * Заготовки. Умолчания у них нет намеренно: набор «фирменных» цветов — домен
 * потребителя, и подставить сюда значения токенов темы должен тот, кто знает,
 * какие из них применимы к его сущности.
 */
export const WithPresets: Story = {
  args: {
    presets: ["#4f7df3", "#7c5cf5", "#16a34a", "#f59e0b", "#e11d48", "#0ea5e9"],
  },
};

/**
 * Формат строки наружу. Поле ввода при этом остаётся шестнадцатеричным: `rgb` и
 * `hsl` — это три поля каналов, то есть другой контрол, а не другой формат
 * того же. Отсюда и имя пропа.
 */
export const RgbOutput: Story = {
  args: { outputFormat: "rgb" },
};

/** Выключенное поле не раскрывается. */
export const Disabled: Story = {
  args: { disabled: true },
};
