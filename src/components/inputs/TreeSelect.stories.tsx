import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import type { Key } from "react-aria-components";
import { TreeSelect } from "./TreeSelect.js";
import type { TreeNode } from "../navigation/TreeView.js";

const ORG: TreeNode[] = [
  {
    id: "company",
    label: "Company",
    children: [
      {
        id: "sales",
        label: "Sales",
        children: [
          { id: "direct", label: "Direct sales" },
          { id: "partners", label: "Partner network" },
        ],
      },
      { id: "logistics", label: "Logistics" },
      {
        id: "finance",
        label: "Finance",
        children: [
          { id: "payroll", label: "Payroll" },
          { id: "treasury", label: "Treasury", disabled: true },
        ],
      },
    ],
  },
];

const meta = {
  title: "Inputs/TreeSelect",
  component: TreeSelect,
  // Периферия по ADR-0038: композиция готовых `TreeView` и `Popover`. Метка
  // снимает снимки — они сторожили бы атомы, уже посторожённые ядром.
  tags: ["periphery"],
  parameters: { layout: "centered" },
  args: {
    items: ORG,
    value: [],
    onChange: () => {},
    "aria-label": "Division",
    defaultExpandedKeys: ["company", "sales"],
  },
  decorators: [
    (Story) => (
      <div className="w-[320px]">
        <Story />
      </div>
    ),
  ],
  render: (args) => {
    const [value, setValue] = useState<Key[]>(args.value);
    return <TreeSelect {...args} value={value} onChange={setValue} />;
  },
} satisfies Meta<typeof TreeSelect>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Одиночный выбор: узел выбран — поповер закрылся, цель достигнута. */
export const Playground: Story = {
  args: { value: ["logistics"] },
};

/**
 * Множественный выбор: чипы в закрытом поле, поповер остаётся открытым — выбор
 * ещё не закончен, и закрытие требовало бы открывать заново на каждый узел.
 */
export const Multiple: Story = {
  args: { multiple: true, value: ["direct", "logistics"] },
};

/** Больше трёх выбранных: хвост сворачивается, поле не растёт на пять строк. */
export const ManySelected: Story = {
  args: { multiple: true, value: ["direct", "partners", "logistics", "payroll"] },
};

/**
 * Очистка — настоящая кнопка рядом с триггером, как у `Select`: вложенная
 * кнопка была бы `nested-interactive`, а `aria-hidden`-крестик внутри выпадал бы
 * из дерева доступности целиком. С клавиатуры поле очищают ещё и Delete или
 * Backspace.
 */
export const Clearable: Story = {
  args: { clearable: true, value: ["partners"] },
};

/** Пустое поле показывает подсказку из каталога, если своей не передали. */
export const Empty: Story = {};

/** Выключенное поле не раскрывается. */
export const Disabled: Story = {
  args: { disabled: true, value: ["finance"] },
};
