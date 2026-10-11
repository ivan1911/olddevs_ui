import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { FormField } from "./FormField.js";
import { MaskedInput, type MaskedInputProps } from "./MaskedInput.js";

const meta = {
  title: "Inputs/MaskedInput",
  component: MaskedInput,
  parameters: { layout: "padded" },
  tags: ["periphery"],
} satisfies Meta<MaskedInputProps>;

export default meta;
type Story = StoryObj<MaskedInputProps>;

export const Playground: Story = {
  render: function Render() {
    const [value, setValue] = useState("");
    return (
      <div className="flex w-[360px] flex-col gap-2">
        <FormField label="Phone" htmlFor="mi-phone">
          <MaskedInput
            id="mi-phone"
            mask="+7 (999) 999-99-99"
            value={value}
            onChange={setValue}
            shellClassName="w-full"
          />
        </FormField>
        <p className="text-fg-3 text-[11px]">Raw value: {value || "empty"}</p>
      </div>
    );
  },
};

/** Другие маски: дата, серия и номер, код. Кит о предметной области не знает. */
export const OtherMasks: Story = {
  render: function Render() {
    const [date, setDate] = useState("");
    const [passport, setPassport] = useState("");
    const [code, setCode] = useState("");
    return (
      <div className="flex w-[360px] flex-col gap-4">
        <FormField label="Date" htmlFor="mi-date">
          <MaskedInput
            id="mi-date"
            mask="99.99.9999"
            value={date}
            onChange={setDate}
            shellClassName="w-full"
          />
        </FormField>
        <FormField label="Passport" htmlFor="mi-passport">
          <MaskedInput
            id="mi-passport"
            mask="99 99 999999"
            value={passport}
            onChange={setPassport}
            shellClassName="w-full"
          />
        </FormField>
        <FormField label="Code" htmlFor="mi-code" hint="Two letters and four characters">
          <MaskedInput
            id="mi-code"
            mask="aa-****"
            value={code}
            onChange={setCode}
            shellClassName="w-full"
          />
        </FormField>
      </div>
    );
  },
};

export const Filled: Story = {
  render: function Render() {
    const [value, setValue] = useState("9161234567");
    return (
      <div className="w-[360px]">
        <MaskedInput
          mask="+7 (999) 999-99-99"
          value={value}
          onChange={setValue}
          aria-label="Phone"
          shellClassName="w-full"
        />
      </div>
    );
  },
};

export const Disabled: Story = {
  render: () => (
    <div className="w-[360px]">
      <MaskedInput
        mask="+7 (999) 999-99-99"
        value="9161234567"
        onChange={() => {}}
        aria-label="Phone"
        disabled
        shellClassName="w-full"
      />
    </div>
  ),
};

/**
 * Трафарет маски выключен.
 *
 * Умолчание — включённый трафарет: без него поле не сообщало формат вовсе.
 * Выключается там, где формат уже сказан рядом и повторять его в поле — шум:
 * короткая известная маска в плотной таблице, поле под подписью с примером.
 *
 * Рядом стоит поле с трафаретом: разница видна только в сравнении, а история из
 * одного пустого прямоугольника не показывает ничего.
 */
export const WithoutSkeleton: Story = {
  render: function Render() {
    const [withSkeleton, setWithSkeleton] = useState("");
    const [withoutSkeleton, setWithoutSkeleton] = useState("");
    return (
      <div className="flex w-[360px] flex-col gap-3">
        <FormField
          label="With a skeleton"
          htmlFor="mi-with"
          hint="The format is visible in the field itself"
        >
          <MaskedInput
            id="mi-with"
            mask="99.99.9999"
            value={withSkeleton}
            onChange={setWithSkeleton}
            shellClassName="w-full"
          />
        </FormField>
        <FormField label="Without a skeleton" htmlFor="mi-without" hint="For example, 31.03.1984">
          <MaskedInput
            id="mi-without"
            mask="99.99.9999"
            value={withoutSkeleton}
            onChange={setWithoutSkeleton}
            showMask={false}
            shellClassName="w-full"
          />
        </FormField>
      </div>
    );
  },
};
