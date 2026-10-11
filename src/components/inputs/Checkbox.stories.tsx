import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Checkbox, type CheckboxProps } from "./Checkbox.js";
import { TONE_TOKENS, type Tone } from "../../lib/variants.js";

/**
 * Флажок управляемый, как и `Toggle`: своего состояния он не держит и без
 * внешнего стейта на клик не отзовётся. `checked` в историях задаёт только
 * стартовое положение.
 */
function ControlledCheckbox({
  checked = false,
  ...rest
}: Omit<CheckboxProps, "checked" | "onCheckedChange"> & { checked?: boolean }) {
  const [on, setOn] = useState(checked);
  return <Checkbox checked={on} onCheckedChange={setOn} {...rest} />;
}

const meta = {
  title: "Inputs/Checkbox",
  component: Checkbox,
  parameters: { layout: "centered" },
  args: { children: "Show in the feed" },
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  args: { children: "Show in the feed", disabled: false, invalid: false },
  render: (args) => (
    <ControlledCheckbox disabled={args.disabled} invalid={args.invalid}>
      {args.children}
    </ControlledCheckbox>
  ),
};

/** Пояснение под подписью — для согласий, где одной строки не хватает. */
export const WithDescription: Story = {
  render: () => (
    <ControlledCheckbox checked description="Arrives by email within a day">
      Send a publishing report
    </ControlledCheckbox>
  ),
};

/**
 * Без видимой подписи — в шапке таблицы и в строке списка. `label` в этом
 * случае обязателен, и это проверяет компилятор.
 */
export const WithoutLabel: Story = {
  render: () => <ControlledCheckbox label="Select all rows" />,
};

/**
 * Матрица состояние × тон × доступность.
 *
 * Одиночный флажок не покажет двух вещей, ради которых матрица и заводится:
 * что НЕотмеченный флажок нейтрален при любом тоне (тон окрашивает только
 * согласие, а не рамку), и что третье состояние visually перекрывает
 * отмеченное, а не складывается с ним.
 */
export const Matrix: Story = {
  parameters: { layout: "padded" },
  render: () => (
    <table className="border-separate border-spacing-4">
      <thead>
        <tr>
          <th>
            <span className="sr-only">Tone</span>
          </th>
          {["unchecked", "checked", "indeterminate", "disabled", "invalid"].map((h) => (
            <th key={h} className="text-fg-2 font-mono text-xs font-semibold">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {(Object.keys(TONE_TOKENS) as Tone[]).map((tone) => (
          <tr key={tone}>
            <td className="text-fg-2 pr-2 text-right font-mono text-xs">{tone}</td>
            <td>
              <Checkbox tone={tone} label={`${tone}, unchecked`} />
            </td>
            <td>
              <Checkbox tone={tone} checked label={`${tone}, checked`} />
            </td>
            <td>
              <Checkbox tone={tone} indeterminate label={`${tone}, indeterminate`} />
            </td>
            <td>
              <Checkbox tone={tone} checked disabled label={`${tone}, disabled`} />
            </td>
            <td>
              <Checkbox tone={tone} invalid label={`${tone}, invalid`} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  ),
};

/** Два размера рядом: подпись и коробка обязаны выравниваться по центру в обоих. */
export const Sizes: Story = {
  parameters: { layout: "padded" },
  render: () => (
    <div className="flex flex-col gap-3">
      <ControlledCheckbox size="sm" checked>
        Small
      </ControlledCheckbox>
      <ControlledCheckbox size="md" checked>
        Medium
      </ControlledCheckbox>
    </div>
  ),
};
