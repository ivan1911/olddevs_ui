import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { PaymentIcon, SecurityIcon, StorageIcon } from "../../icons.js";
import type { Tone } from "../../lib/variants.js";
import { Checkbox } from "./Checkbox.js";
import { CheckboxGroup } from "./CheckboxGroup.js";

const meta = {
  title: "Inputs/CheckboxGroup",
  component: CheckboxGroup,
  parameters: { layout: "padded" },
  args: { label: "Where to publish", value: [], onChange: () => {} },
} satisfies Meta<typeof CheckboxGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

function LiveDemo({
  orientation,
  disabled,
  errorMessage,
  description,
  initial = ["tg"],
}: {
  orientation?: "vertical" | "horizontal";
  disabled?: boolean;
  errorMessage?: string;
  description?: string;
  initial?: string[];
}) {
  const [value, setValue] = useState(initial);
  return (
    <CheckboxGroup
      label="Where to publish"
      value={value}
      onChange={setValue}
      orientation={orientation}
      disabled={disabled}
      errorMessage={errorMessage}
      description={description}
    >
      <Checkbox value="tg">Telegram</Checkbox>
      <Checkbox value="vk">VK</Checkbox>
      <Checkbox value="ok" disabled>
        OK — channel not connected
      </Checkbox>
    </CheckboxGroup>
  );
}

export const Playground: Story = {
  render: () => <LiveDemo description="Pick more than one" />,
};

/** Horizontal layout: for two or three short labels. */
export const Horizontal: Story = {
  render: () => <LiveDemo orientation="horizontal" />,
};

/**
 * Matrix of the group's three states.
 *
 * It shows what cannot be seen on a single group: an individual `disabled` dims one item,
 * a group-level one dims all of them, including items without their own `disabled`;
 * and an error replaces the hint instead of sitting under it.
 */
export const Matrix: Story = {
  render: () => (
    <div className="flex flex-col gap-8">
      <LiveDemo description="Pick more than one" />
      <LiveDemo disabled />
      <LiveDemo errorMessage="Pick at least one channel" description="Pick more than one" />
    </div>
  ),
};

function CardsDemo({
  orientation,
  disabled,
  errorMessage,
  tone,
  label = "Modules",
  initial = ["billing"],
}: {
  orientation?: "vertical" | "horizontal";
  disabled?: boolean;
  errorMessage?: string;
  tone?: Tone;
  label?: string;
  initial?: string[];
}) {
  const [value, setValue] = useState(initial);
  return (
    <CheckboxGroup
      label={label}
      appearance="card"
      value={value}
      onChange={setValue}
      tone={tone}
      orientation={orientation}
      disabled={disabled}
      errorMessage={errorMessage}
      description="Pick as many as you need"
    >
      <Checkbox
        value="billing"
        icon={<PaymentIcon size={20} />}
        description="Invoices and payments"
      >
        Billing
      </Checkbox>
      <Checkbox value="storage" icon={<StorageIcon size={20} />} description="Files and backups">
        Storage
      </Checkbox>
      <Checkbox
        value="audit"
        icon={<SecurityIcon size={20} />}
        description="Not on your plan"
        disabled
      >
        Audit log
      </Checkbox>
    </CheckboxGroup>
  );
}

/** Choice cards: Space toggles a card, and the whole card is the hit area. */
export const Cards: Story = {
  render: () => <CardsDemo />,
};

/** Cards in a row, with wrapping. */
export const CardsHorizontal: Story = {
  render: () => <CardsDemo orientation="horizontal" />,
};

/** An error and a disabled group: the same as for an ordinary checkbox group. */
export const CardsStates: Story = {
  render: () => (
    <div className="flex flex-col gap-8">
      <CardsDemo initial={[]} errorMessage="Pick at least one module" />
      <CardsDemo disabled />
    </div>
  ),
};

const TONES: Tone[] = ["neutral", "accent", "success", "warning", "danger"];

/**
 * The group's tone colors the outline of the selected card and its check mark. A `tone` set
 * on the group is one for the whole set and overrides the `tone` of individual checkboxes.
 * The last group, without a `tone`, colors each checkbox with its own tone.
 */
export const CardsTones: Story = {
  render: () => (
    <div className="flex flex-col gap-8">
      {TONES.map((tone) => (
        <CardsDemo
          key={tone}
          tone={tone}
          label={`Modules — ${tone}`}
          initial={["billing", "storage"]}
        />
      ))}
      <CheckboxGroup
        label="Without a group tone"
        appearance="card"
        value={["a", "b"]}
        onChange={() => {}}
      >
        <Checkbox value="a" tone="success" description="Own tone: success">
          First
        </Checkbox>
        <Checkbox value="b" tone="danger" description="Own tone: danger">
          Second
        </Checkbox>
      </CheckboxGroup>
    </div>
  ),
};

/** The group's tone applies to plain rows too: the box of a checked checkbox takes it. */
export const Tones: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      {TONES.map((tone) => (
        <CheckboxGroup
          key={tone}
          label={`Tone — ${tone}`}
          tone={tone}
          value={["a"]}
          onChange={() => {}}
          orientation="horizontal"
        >
          <Checkbox value="a">Checked</Checkbox>
          <Checkbox value="b">Unchecked</Checkbox>
        </CheckboxGroup>
      ))}
    </div>
  ),
};
