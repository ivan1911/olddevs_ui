import type { Meta, StoryObj } from "@storybook/react-vite";
import { FormField } from "./FormField.js";
import { PasswordInput, type PasswordInputProps } from "./PasswordInput.js";

const meta = {
  title: "Inputs/PasswordInput",
  component: PasswordInput,
  parameters: { layout: "padded" },
  tags: ["periphery"],
} satisfies Meta<PasswordInputProps>;

export default meta;
type Story = StoryObj<PasswordInputProps>;

export const Playground: Story = {
  render: () => (
    <div className="w-[360px]">
      <FormField label="Password" htmlFor="pwd-sandbox">
        <PasswordInput id="pwd-sandbox" autoComplete="current-password" />
      </FormField>
    </div>
  ),
};

/** Password change: two fields, each with its own `autocomplete`. */
export const ChangePassword: Story = {
  render: () => (
    <div className="flex w-[360px] flex-col gap-4">
      <FormField label="Current password" htmlFor="pwd-old">
        <PasswordInput id="pwd-old" autoComplete="current-password" />
      </FormField>
      <FormField label="New password" htmlFor="pwd-new" hint="At least eight characters">
        <PasswordInput id="pwd-new" autoComplete="new-password" />
      </FormField>
    </div>
  ),
};

/** An error paints the same shell as the other fields. */
export const WithError: Story = {
  render: () => (
    <div className="w-[360px]">
      <FormField label="Password" htmlFor="pwd-error" error="Wrong password">
        <PasswordInput id="pwd-error" aria-invalid defaultValue="secret" />
      </FormField>
    </div>
  ),
};

/** Without the Caps Lock warning: no keyboard handlers are added at all. */
export const WithoutWarning: Story = {
  render: () => (
    <div className="w-[360px]">
      <FormField label="Password" htmlFor="pwd-plain">
        <PasswordInput id="pwd-plain" capsLockWarning={false} />
      </FormField>
    </div>
  ),
};

export const Disabled: Story = {
  render: () => (
    <div className="w-[360px]">
      <FormField label="Password" htmlFor="pwd-disabled">
        <PasswordInput id="pwd-disabled" defaultValue="secret" disabled />
      </FormField>
    </div>
  ),
};
