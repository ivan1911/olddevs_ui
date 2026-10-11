import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { LABEL_HUES } from "../../lib/variants.js";
import { SwatchGroup, type SwatchGroupProps, type SwatchOption } from "./SwatchGroup.js";
import { TooltipProvider } from "../overlays/Tooltip.js";

const meta = {
  title: "Inputs/SwatchGroup",
  component: SwatchGroup,
  parameters: { layout: "padded" },
} satisfies Meta<SwatchGroupProps>;

export default meta;
type Story = StoryObj<SwatchGroupProps>;

/** Имя оттенка словом — оно же имя варианта для скринридера. */
const NAMES: Record<(typeof LABEL_HUES)[number], string> = {
  blue: "Blue",
  violet: "Violet",
  teal: "Teal",
  green: "Green",
  amber: "Amber",
  red: "Red",
  pink: "Pink",
  steel: "Steel",
};

/** Девять вариантов потребителя: восемь оттенков и «без цвета». */
const OPTIONS: SwatchOption[] = [
  { value: "none", name: "No colour" },
  ...LABEL_HUES.map((hue) => ({ value: hue, hue, name: NAMES[hue] })),
];

/** Живой выбор: стрелки двигают его по сетке и применяют сразу. */
export const Playground: Story = {
  render: () => {
    const [value, setValue] = useState("teal");
    return (
      <SwatchGroup label="Project colour" value={value} onChange={setValue} options={OPTIONS} />
    );
  },
};

/**
 * Столбцы — число, а не `auto-fill`: по ним ходят вертикальные стрелки, и
 * набор обязан знать их количество. Слева шесть в ряду, справа три.
 */
export const Columns: Story = {
  render: () => (
    <div className="flex items-start gap-8">
      <SwatchGroup label="Six in a row" value="blue" onChange={() => {}} options={OPTIONS} />
      <SwatchGroup
        label="Three in a row"
        value="blue"
        onChange={() => {}}
        options={OPTIONS}
        columns={3}
      />
    </div>
  ),
};

/**
 * Выбранность — кольцо, а не второй цвет: акцентное кольцо вокруг синего
 * образца не читалось бы вовсе, а различать выбранное по одной насыщенности
 * нельзя.
 */
export const Selected: Story = {
  render: () => (
    <div className="flex items-start gap-8">
      {(["none", "blue", "amber", "steel"] as const).map((value) => (
        <SwatchGroup
          key={value}
          label={value}
          value={value}
          onChange={() => {}}
          options={OPTIONS}
          columns={3}
        />
      ))}
    </div>
  ),
};

/** Выключенный набор и выключенный вариант — разные вещи. */
export const Disabled: Story = {
  render: () => (
    <div className="flex items-start gap-8">
      <SwatchGroup
        label="The whole set"
        value="blue"
        onChange={() => {}}
        options={OPTIONS}
        columns={3}
        disabled
      />
      <SwatchGroup
        label="One option"
        value="blue"
        onChange={() => {}}
        columns={3}
        options={OPTIONS.map((option) =>
          option.value === "red" ? { ...option, disabled: true } : option
        )}
      />
    </div>
  ),
};

/**
 * Имя оттенка подсказкой: при наведении и при фокусе с клавиатуры.
 *
 * Слово берётся из того же `name`, которым вариант называется для скринридера,
 * — и вслух он по-прежнему называется ОДИН раз: описание Radix оседает на
 * обёртке, а не на самой радиокнопке.
 *
 * Провайдер здесь развёрнут историей. В приложении он один на корень, и это
 * требование к потребителю: без него Radix бросает на первом же варианте —
 * ровно поэтому подсказка и не включена по умолчанию.
 */
export const Tooltips: Story = {
  decorators: [
    (Story) => (
      <TooltipProvider delayDuration={0}>
        <Story />
      </TooltipProvider>
    ),
  ],
  render: () => (
    <div className="flex items-start gap-8">
      <SwatchGroup
        label="Hover or tab into it"
        value="teal"
        onChange={() => {}}
        options={OPTIONS}
        columns={3}
        tooltips
      />
      <SwatchGroup
        label="A disabled option is named too"
        value="teal"
        onChange={() => {}}
        columns={3}
        options={OPTIONS.map((option) =>
          option.value === "red" ? { ...option, disabled: true } : option
        )}
        tooltips
      />
    </div>
  ),
};
