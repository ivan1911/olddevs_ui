import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Button } from "../actions/Button.js";
import { Stepper } from "./Stepper.js";

/** Wave 9: navigation primitives for the lighter bar. */
const meta = {
  title: "Navigation/Stepper",
  component: Stepper,
  parameters: { layout: "padded" },
  tags: ["periphery"],
} satisfies Meta<typeof Stepper>;

export default meta;
type Story = StoryObj;

export const Steps: Story = {
  render: function Render() {
    const [step, setStep] = useState(1);
    return (
      <div className="flex w-[560px] flex-col gap-6">
        <Stepper
          steps={[
            { id: "files", label: "Files", hint: "12 photos" },
            { id: "meta", label: "Description" },
            { id: "schedule", label: "Schedule" },
          ]}
          current={step}
          onStepClick={setStep}
        />
        <Button size="sm" onClick={() => setStep((s) => Math.min(2, s + 1))}>
          Next
        </Button>
      </div>
    );
  },
};
