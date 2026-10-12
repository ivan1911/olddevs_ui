import type { Meta, StoryObj } from "@storybook/react-vite";
import { Text, type TextProps, type TextSize } from "./Text.js";
import type { Tone } from "../../lib/variants.js";

const meta = {
  title: "Content/Text",
  component: Text,
  parameters: { layout: "padded" },
  args: { children: "Photos are published on schedule" },
} satisfies Meta<TextProps>;

export default meta;
type Story = StoryObj<TextProps>;

const SIZES: TextSize[] = ["caption", "xs", "sm", "md", "lg"];
const TONES: Tone[] = ["neutral", "accent", "success", "warning", "danger"];

export const Playground: Story = {};

/** Пять ступеней шкалы, доступных тексту. */
export const Sizes: Story = {
  render: (args) => (
    <div className="flex flex-col gap-3">
      {SIZES.map((size) => (
        <div key={size} className="flex items-baseline gap-4">
          <code className="text-fg-2 text-caption w-20 shrink-0">{size}</code>
          <Text {...args} size={size} />
        </div>
      ))}
    </div>
  ),
};

/** Приглушённость: основной, вторичный, служебный. */
export const Muting: Story = {
  render: (args) => (
    <div className="flex flex-col gap-2">
      <Text {...args} level={1}>
        Level 1 — body text
      </Text>
      <Text {...args} level={2}>
        Level 2 — secondary text
      </Text>
      <Text {...args} level={3}>
        Level 3 — utility label
      </Text>
    </div>
  ),
};

/** Тон перекрывает приглушённость: у окрашенного текста вторичности нет. */
export const Tones: Story = {
  render: (args) => (
    <div className="flex flex-col gap-2">
      {TONES.map((tone) => (
        <Text key={tone} {...args} tone={tone}>
          {tone} — a semantic colour, not a shade
        </Text>
      ))}
    </div>
  ),
};

export const Weights: Story = {
  render: (args) => (
    <div className="flex flex-col gap-2">
      <Text {...args} weight="regular">
        regular — body text
      </Text>
      <Text {...args} weight="medium">
        medium — emphasised
      </Text>
      <Text {...args} weight="bold">
        bold — a label or a total
      </Text>
    </div>
  ),
};

/** Обрезка: одной строкой и на заданном числе строк. */
export const Truncation: Story = {
  render: (args) => (
    <div className="flex w-[280px] flex-col gap-4">
      <div>
        <Text {...args} size="caption" level={3}>
          truncate
        </Text>
        <Text {...args} truncate>
          Abstract gradients and neon sunsets over a night city
        </Text>
      </div>
      <div>
        <Text {...args} size="caption" level={3}>
          truncate={2}
        </Text>
        <Text {...args} truncate={2}>
          Abstract gradients and neon sunsets over a night city, gathered into one album for those
          who like calm photos without detail
        </Text>
      </div>
    </div>
  ),
};

/** Матрица размер × уровень: три уровня цвета и жирное начертание на каждом размере. */
export const Matrix: Story = {
  render: (args) => (
    <div className="flex flex-col gap-6">
      {SIZES.map((size) => (
        <div key={size} className="flex flex-col gap-1.5">
          <code className="text-fg-2 text-caption">{size}</code>
          <div className="flex flex-col gap-1">
            <Text {...args} size={size} level={1} />
            <Text {...args} size={size} level={2} />
            <Text {...args} size={size} level={3} />
            <Text {...args} size={size} weight="bold" />
          </div>
        </div>
      ))}
    </div>
  ),
};

const TICKS = ["0:00", "0:11", "1:38", "8:21"];

/**
 * Цифры равной ширины. Слева строки одной длины кончаются в разных местах —
 * именно так таймер и ездит на каждом тике; справа правый край стоит.
 */
export const Numerals: Story = {
  render: (args) => (
    <div className="flex gap-10">
      {([undefined, "tabular"] as const).map((numeric) => (
        <div key={numeric ?? "default"} className="flex flex-col items-start gap-1">
          <Text {...args} size="caption" level={3}>
            {numeric ?? "default"}
          </Text>
          {TICKS.map((tick) => (
            <span key={tick} className="border-line border-r pr-2">
              <Text {...args} as="span" weight="medium" numeric={numeric}>
                {tick}
              </Text>
            </span>
          ))}
        </div>
      ))}
    </div>
  ),
};
