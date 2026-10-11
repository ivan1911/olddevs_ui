import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Toggle, type ToggleProps } from "./Toggle.js";

/**
 * Toggle управляемый: он не хранит своё состояние и без внешнего стейта на клик
 * не отзовётся. Поэтому истории оборачивают его в локальный `useState`, а проп
 * `checked` задаёт только начальное положение.
 */
function ControlledToggle({
  checked = false,
  ...rest
}: Omit<ToggleProps, "checked" | "onCheckedChange"> & { checked?: boolean }) {
  const [on, setOn] = useState(checked);
  return <Toggle checked={on} onCheckedChange={setOn} {...rest} />;
}

const meta = {
  title: "Actions/Toggle",
  component: Toggle,
  parameters: { layout: "centered" },
  // `label` обязателен по типам, поэтому задаётся здесь — иначе Storybook
  // потребует его в args каждой истории, включая те, что рендерят матрицу.
  args: { checked: false, onCheckedChange: () => {}, label: "Switch" },
} satisfies Meta<typeof Toggle>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Живой переключатель: контрол `checked` задаёт стартовое положение. */
export const Playground: Story = {
  args: { checked: false, disabled: false, label: "Auto-publishing" },
  render: (args) => (
    <ControlledToggle
      checked={args.checked}
      disabled={args.disabled}
      label={args.label ?? "Switch"}
    />
  ),
};

/**
 * Матрица состояние × доступность. Одиночный переключатель не покажет, что
 * выключенный `disabled` во включённом положении гасится прозрачностью и в
 * светлой теме почти неотличим от выключенного положения — матрица покажет.
 */
export const Matrix: Story = {
  parameters: { layout: "padded" },
  render: () => (
    <table className="border-separate border-spacing-4">
      <thead>
        <tr>
          <th>
            <span className="sr-only">Variant</span>
          </th>
          <th className="text-fg-2 font-mono text-xs font-semibold">plain</th>
          <th className="text-fg-2 font-mono text-xs font-semibold">disabled</th>
        </tr>
      </thead>
      <tbody>
        {[false, true].map((checked) => (
          <tr key={String(checked)}>
            <td className="text-fg-2 pr-2 text-right font-mono text-xs">
              {checked ? "checked" : "unchecked"}
            </td>
            <td>
              <ControlledToggle checked={checked} label="Switch" />
            </td>
            <td>
              <ControlledToggle checked={checked} disabled label="Switch, disabled" />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  ),
};

/**
 * Подпись на экране — через `children`: она же доступное имя, нажатие по ней
 * переключает. Без подписи (`label`) переключатель остаётся голой дорожкой.
 */
export const WithLabel: Story = {
  parameters: { layout: "padded" },
  render: () => (
    <div className="flex w-[360px] flex-col gap-3">
      <ControlledToggle checked>Auto-publishing</ControlledToggle>
      <ControlledToggle>Notify about errors</ControlledToggle>
      <ControlledToggle disabled>Unavailable on the current plan</ControlledToggle>
    </div>
  ),
};

/**
 * Строка настройки: заголовок и пояснение слева, переключатель справа. Описание
 * связано с переключателем через `aria-describedby`, нажатие по любому из двух
 * текстов переключает.
 */
export const SettingRow: Story = {
  parameters: { layout: "padded" },
  render: () => (
    <div className="border-line-soft bg-bg-2 flex w-[420px] flex-col gap-4 rounded-lg border p-4">
      <ControlledToggle checked description="Everyone confirms a code on top of the password.">
        Require two-factor sign-in
      </ControlledToggle>
      <ControlledToggle description="Guests see only the projects they are added to.">
        Members can invite guests
      </ControlledToggle>
      <ControlledToggle disabled description="Available on the Business plan.">
        Single sign-on
      </ControlledToggle>
    </div>
  ),
};
