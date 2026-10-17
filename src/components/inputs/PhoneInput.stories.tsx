import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { FormField } from "./FormField.js";
import { PhoneInput, type PhoneInputProps } from "./PhoneInput.js";

const meta = {
  title: "Inputs/PhoneInput",
  component: PhoneInput,
  parameters: { layout: "padded" },
  tags: ["periphery"],
} satisfies Meta<PhoneInputProps>;

export default meta;
type Story = StoryObj<PhoneInputProps>;

export const Playground: Story = {
  render: function Render() {
    const [value, setValue] = useState("");
    return (
      <div className="flex w-[360px] flex-col gap-2">
        <FormField label="Phone" htmlFor="ph-main">
          <PhoneInput id="ph-main" value={value} onChange={setValue} shellClassName="w-full" />
        </FormField>
        <p className="text-fg-3 text-[11px]">Raw value: {value || "empty"}</p>
      </div>
    );
  },
};

/**
 * A different format is set with a prop: the default is a choice, not a fact. A US number
 * `+1 (212) 555-0123` has 11 digits in the value, one for each position of the mask,
 * including the country code.
 */
export const ForeignFormat: Story = {
  render: function Render() {
    const [value, setValue] = useState("12125550123");
    return (
      <div className="w-[360px]">
        <FormField label="Phone (US)" htmlFor="ph-us">
          <PhoneInput
            id="ph-us"
            mask="+9 (999) 999-9999"
            value={value}
            onChange={setValue}
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
        <PhoneInput value={value} onChange={setValue} aria-label="Phone" shellClassName="w-full" />
      </div>
    );
  },
};
