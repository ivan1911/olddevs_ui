import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Radio, RadioGroup } from "./RadioGroup.js";
import { PaymentIcon, SecurityIcon, StorageIcon } from "../../icons.js";
import { TONE_TOKENS, type Tone } from "../../lib/variants.js";

const meta = {
  title: "Inputs/RadioGroup",
  component: RadioGroup,
  parameters: { layout: "padded" },
  args: { label: "How to publish", value: null, onChange: () => {} },
} satisfies Meta<typeof RadioGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

function LiveDemo({
  initial = "later",
  ...rest
}: { initial?: string | null } & Partial<
  Omit<React.ComponentProps<typeof RadioGroup>, "value" | "onChange" | "children">
>) {
  const [value, setValue] = useState<string | null>(initial);
  return (
    <RadioGroup label="How to publish" value={value} onChange={setValue} {...rest}>
      <Radio value="now">Right away</Radio>
      <Radio value="later" description="In the next free slot">
        On schedule
      </Radio>
      <Radio value="manual" disabled>
        Manually — no rights
      </Radio>
    </RadioGroup>
  );
}

export const Playground: Story = {
  render: () => <LiveDemo description="The choice affects the whole set of posts" />,
};

/** Horizontal layout: for two or three short options. */
export const Horizontal: Story = {
  render: () => <LiveDemo orientation="horizontal" />,
};

/**
 * Matrix of tone × size.
 *
 * It shows what cannot be seen on a single set: an unselected option is neutral in any tone,
 * and the tone and size come from the group, so there is nothing that could drift apart
 * within one set.
 */
export const Matrix: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      {(Object.keys(TONE_TOKENS) as Tone[]).map((tone) => (
        <div key={tone} className="flex items-start gap-8">
          <LiveDemo tone={tone} orientation="horizontal" />
          <LiveDemo tone={tone} size="sm" orientation="horizontal" />
        </div>
      ))}
    </div>
  ),
};

/** An error replaces the hint: the same rule as for `CheckboxGroup`. */
export const WithError: Story = {
  render: () => (
    <LiveDemo
      initial={null}
      description="The choice affects the whole set of posts"
      errorMessage="Pick a publishing method"
    />
  ),
};

function CardsDemo({
  initial = "team",
  ...rest
}: { initial?: string | null } & Partial<
  Omit<React.ComponentProps<typeof RadioGroup>, "value" | "onChange" | "children">
>) {
  const [value, setValue] = useState<string | null>(initial);
  return (
    <RadioGroup
      label="Plan"
      appearance="card"
      value={value}
      onChange={setValue}
      description="You can change the plan later"
      {...rest}
    >
      <Radio value="free" icon={<StorageIcon size={20} />} description="Up to 3 projects">
        Starter
      </Radio>
      <Radio value="team" icon={<PaymentIcon size={20} />} description="Unlimited projects">
        Team
      </Radio>
      <Radio
        value="enterprise"
        icon={<SecurityIcon size={20} />}
        description="Contact sales"
        disabled
      >
        Enterprise
      </Radio>
    </RadioGroup>
  );
}

/** Choice cards: the whole card is the hit area; the selected one gets an outline and the radio dot. */
export const Cards: Story = {
  render: () => <CardsDemo />,
};

/** Cards in a row, with wrapping. */
export const CardsHorizontal: Story = {
  render: () => <CardsDemo orientation="horizontal" />,
};

/** An error and a disabled set: the same as for an ordinary radio group. */
export const CardsStates: Story = {
  render: () => (
    <div className="flex flex-col gap-8">
      <CardsDemo initial={null} errorMessage="Pick a plan" />
      <CardsDemo disabled />
    </div>
  ),
};

/** The tone colors the outline of the selected card; unselected cards are neutral. */
export const CardsTones: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      {(Object.keys(TONE_TOKENS) as Tone[]).map((tone) => (
        <CardsDemo key={tone} tone={tone} orientation="horizontal" size="sm" />
      ))}
    </div>
  ),
};
