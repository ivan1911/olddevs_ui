import type { Meta, StoryObj } from "@storybook/react-vite";
import { DownloadIcon } from "../../icons.js";
import { MenuItem, MenuSeparator } from "../overlays/Menu.js";
import { SplitButton } from "./SplitButton.js";

const meta = {
  title: "Actions/SplitButton",
  component: SplitButton,
  parameters: { layout: "centered" },
  args: {
    label: "Export",
    onClick: () => {},
    children: [
      <MenuItem key="xlsx">Export to XLSX</MenuItem>,
      <MenuItem key="json">Export to JSON</MenuItem>,
      <MenuSeparator key="sep" />,
      <MenuItem key="selected">Selected rows only</MenuItem>,
    ],
  },
} satisfies Meta<typeof SplitButton>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Главное действие слева, его родня — в меню справа. Стрелка открывает меню и
 * не зовёт действие; клик по подписи зовёт действие и не открывает меню.
 */
export const Playground: Story = {
  args: { variant: "solid", tone: "accent", icon: <DownloadIcon aria-hidden /> },
};

/**
 * Оси `variant` и `tone` — те же, что у `Button`, и значат то же самое. Своей
 * палитры компонент не заводит: разойтись с кнопкой ему нечем.
 */
export const Variants: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-4">
      <SplitButton {...args} variant="solid" tone="accent" />
      <SplitButton {...args} variant="outline" label="Create" />
      <SplitButton {...args} variant="soft" label="Publish" />
      <SplitButton {...args} variant="solid" tone="danger" label="Delete" />
    </div>
  ),
};

/**
 * Три размера. Стрелка — квадрат той же высоты, что и главное действие.
 *
 * Подписи разные намеренно: смысл компонента в том, что раскрыватели
 * различимы в речи, и витрина из трёх одинаковых «More actions: Export»
 * показывала бы обратное.
 */
export const Sizes: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-4">
      <SplitButton {...args} size="sm" label="Export" />
      <SplitButton {...args} size="md" label="Create" />
      <SplitButton {...args} size="lg" label="Publish" />
    </div>
  ),
};

/**
 * Обе кнопки гаснут вместе, и раздельной выключенности здесь нет намеренно.
 *
 * Живая стрелка при мёртвом действии предлагает варианты того, что сделать
 * нельзя; `loading` гасит её по той же причине — открытое меню посреди отправки
 * предлагает второй способ сделать то, что уже делается.
 */
export const DisabledAndLoading: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-4">
      <SplitButton {...args} variant="solid" tone="accent" disabled />
      {/*
        Иконка здесь обязательна: у кнопки без неё кольцо отправки добавляет
        слот, и подпись сдвигается. Витрина не должна закреплять этот сдвиг
        снимком как канон — предупреждение об этом стоит в докстроке `Button`.
      */}
      <SplitButton
        {...args}
        variant="solid"
        tone="accent"
        loading
        label="Exporting"
        icon={<DownloadIcon aria-hidden />}
      />
    </div>
  ),
};
