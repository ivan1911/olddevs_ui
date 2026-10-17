import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { FormField } from "./FormField.js";
import { NumberInput } from "./NumberInput.js";
import { TextControl } from "./TextControl.js";

const meta = {
  title: "Inputs/NumberInput",
  component: NumberInput,
  parameters: { layout: "padded" },
  args: { label: "Count", value: 10, onChange: () => {} },
} satisfies Meta<typeof NumberInput>;

export default meta;
type Story = StoryObj<typeof meta>;

function LiveDemo({
  initial = 10,
  ...rest
}: { initial?: number | null } & Partial<
  Omit<React.ComponentProps<typeof NumberInput>, "value" | "onChange">
>) {
  const [value, setValue] = useState<number | null>(initial);
  return (
    <NumberInput
      label="Count"
      value={value}
      onChange={setValue}
      shellClassName="w-[180px]"
      {...rest}
    />
  );
}

export const Playground: Story = { render: () => <LiveDemo /> };

/** The display format is the job of `Intl.NumberFormat`, not of the component. */
export const Formats: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4">
      <LiveDemo initial={0.25} formatOptions={{ style: "percent" }} />
      <LiveDemo initial={1499} formatOptions={{ style: "currency", currency: "RUB" }} />
      <LiveDemo initial={1024} formatOptions={{ style: "unit", unit: "megabyte" }} />
    </div>
  ),
};

/**
 * Next to `TextControl` is the component's main check.
 *
 * The shell is the same for both, from `lib/field.ts`: the outline, the focus highlight and
 * the disabled dimming must match pixel for pixel. Copy-pasted classes would drift apart,
 * and this could be seen only by placing the fields side by side, which is what this story does.
 */
export const NextToTextControl: Story = {
  render: function Render() {
    const [count, setCount] = useState<number | null>(3);
    const [name, setName] = useState("Daily collection");
    return (
      <div className="flex w-[320px] flex-col gap-3">
        <FormField label="Name" htmlFor="ni-name">
          <TextControl
            id="ni-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            shellClassName="w-full"
          />
        </FormField>
        <FormField label="Posts per day">
          <NumberInput
            label="Posts per day"
            value={count}
            onChange={setCount}
            min={1}
            max={24}
            shellClassName="w-full"
          />
        </FormField>
      </div>
    );
  },
};

/** State matrix: normal, at the limit, invalid, disabled, empty. */
export const Matrix: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4">
      <LiveDemo />
      <LiveDemo initial={24} min={1} max={24} />
      <LiveDemo invalid />
      <LiveDemo disabled />
      <LiveDemo initial={null} placeholder="—" />
    </div>
  ),
};
