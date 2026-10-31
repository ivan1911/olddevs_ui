import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { PromptInput } from "./PromptInput.js";

const meta = {
  title: "Inputs/PromptInput",
  component: PromptInput,
  parameters: { layout: "padded" },
} satisfies Meta<typeof PromptInput>;
export default meta;
type Story = StoryObj<typeof PromptInput>;
function Example({
  canSubmit = true,
  disabled = false,
}: {
  canSubmit?: boolean;
  disabled?: boolean;
}) {
  const [value, setValue] = useState("");
  const [submitted, setSubmitted] = useState("");
  return (
    <div className="max-w-xl">
      <PromptInput
        label="Message"
        value={value}
        onValueChange={setValue}
        onSubmit={setSubmitted}
        canSubmit={canSubmit}
        disabled={disabled}
      >
        <p className="text-fg-2 text-sm">
          Submitted: <output>{submitted}</output>
        </p>
      </PromptInput>
    </div>
  );
}
export const Playground: Story = { render: () => <Example /> };
export const NextDraft: Story = { render: () => <Example canSubmit={false} /> };
export const Disabled: Story = { render: () => <Example disabled /> };
