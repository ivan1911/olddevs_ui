import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { FormField } from "./FormField.js";
import { PinInput, type PinInputProps } from "./PinInput.js";

const meta = {
  title: "Inputs/PinInput",
  component: PinInput,
  parameters: { layout: "padded" },
  tags: ["periphery"],
} satisfies Meta<PinInputProps>;

export default meta;
type Story = StoryObj<PinInputProps>;

export const Playground: Story = {
  render: function Render() {
    const [value, setValue] = useState("");
    return <PinInput value={value} onChange={setValue} label="SMS code" />;
  },
};

/** Заполненный код: значение — одна строка, а не шесть отдельных. */
export const Filled: Story = {
  render: function Render() {
    const [value, setValue] = useState("482913");
    return (
      <div className="flex flex-col gap-2">
        <PinInput value={value} onChange={setValue} label="SMS code" />
        <p className="text-fg-3 text-[11px]">Value: {value || "empty"}</p>
      </div>
    );
  },
};

/** Четыре поля — тот же компонент, другая длина. */
export const FourFields: Story = {
  render: function Render() {
    const [value, setValue] = useState("12");
    return <PinInput value={value} onChange={setValue} length={4} label="PIN" />;
  },
};

/** В форме: подпись и пояснение даёт `FormField`, как обычному полю. */
export const InForm: Story = {
  render: function Render() {
    const [value, setValue] = useState("");
    return (
      <div className="w-[360px]">
        <FormField label="Confirmation code" hint="Six digits from the SMS">
          <PinInput value={value} onChange={setValue} label="Confirmation code" />
        </FormField>
      </div>
    );
  },
};

export const Disabled: Story = {
  render: () => <PinInput value="4829" onChange={() => {}} label="SMS code" disabled />,
};

/** Ошибка: рамки полей красные, на каждом поле `aria-invalid`. Правило проверки — у потребителя. */
export const Invalid: Story = {
  render: function Render() {
    const [value, setValue] = useState("4829");
    return <PinInput value={value} onChange={setValue} label="SMS code" invalid />;
  },
};

/** Ошибка формы доходит до полей кода сама: `invalid` не нужен, хватает `error` у `FormField`. */
export const InFormWithError: Story = {
  render: function Render() {
    const [value, setValue] = useState("482913");
    return (
      <div className="w-[360px]">
        <FormField label="Confirmation code" error="The code is wrong or expired">
          <PinInput value={value} onChange={setValue} label="Confirmation code" />
        </FormField>
      </div>
    );
  },
};
