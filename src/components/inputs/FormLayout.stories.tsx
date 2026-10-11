import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "../actions/Button.js";
import { FormField } from "./FormField.js";
import { FieldRow, FormLayout, type FormLayoutProps } from "./FormLayout.js";
import { PasswordInput } from "./PasswordInput.js";
import { TextControl } from "./TextControl.js";

const meta = {
  title: "Inputs/FormLayout",
  component: FormLayout,
  parameters: { layout: "padded" },
  tags: ["periphery"],
} satisfies Meta<FormLayoutProps>;

export default meta;
type Story = StoryObj<FormLayoutProps>;

export const Playground: Story = {
  render: () => (
    <div className="w-[640px]">
      <FormLayout columns={2}>
        <FormField label="First name" htmlFor="fl-name">
          <TextControl id="fl-name" shellClassName="w-full" />
        </FormField>
        <FormField label="Last name" htmlFor="fl-surname">
          <TextControl id="fl-surname" shellClassName="w-full" />
        </FormField>
        <FieldRow>
          <FormField label="Address" htmlFor="fl-address" hint="Street, building, flat">
            <TextControl id="fl-address" shellClassName="w-full" />
          </FormField>
        </FieldRow>
      </FormLayout>
    </div>
  ),
};

/** Подписи слева: ось приходит полям контекстом, ширина колонки — пропом. */
export const LabelsOnLeft: Story = {
  render: () => (
    <div className="w-[640px]">
      <FormLayout labels="side" labelWidth="10rem">
        <FormField label="Email" htmlFor="fl-email" required>
          <TextControl id="fl-email" type="email" shellClassName="w-full" />
        </FormField>
        <FormField label="Password" htmlFor="fl-pwd" hint="At least eight characters">
          <PasswordInput id="fl-pwd" autoComplete="new-password" shellClassName="w-full" />
        </FormField>
        <FormField label="A very long label that does not break the row" htmlFor="fl-long">
          <TextControl id="fl-long" shellClassName="w-full" />
        </FormField>
      </FormLayout>
    </div>
  ),
};

/** Две колонки и подписи слева вместе — типичная форма редактирования. */
export const EditForm: Story = {
  render: () => (
    <div className="w-[760px]">
      <FormLayout columns={2} labels="side" labelWidth="8rem">
        <FormField label="First name" htmlFor="fe-name">
          <TextControl id="fe-name" defaultValue="Ada" shellClassName="w-full" />
        </FormField>
        <FormField label="Last name" htmlFor="fe-surname">
          <TextControl id="fe-surname" defaultValue="Lovelace" shellClassName="w-full" />
        </FormField>
        <FormField label="Email" htmlFor="fe-email" required error="The address is required">
          <TextControl id="fe-email" shellClassName="w-full" />
        </FormField>
        <FormField label="Phone" htmlFor="fe-phone">
          <TextControl id="fe-phone" shellClassName="w-full" />
        </FormField>
        <FieldRow>
          <FormField label="About" htmlFor="fe-about">
            <TextControl as="textarea" id="fe-about" rows={3} shellClassName="w-full" />
          </FormField>
        </FieldRow>
        <FieldRow>
          <div className="flex justify-end gap-2">
            <Button variant="ghost">Cancel</Button>
            <Button>Save</Button>
          </div>
        </FieldRow>
      </FormLayout>
    </div>
  ),
};

/** Раскладка работает и с чужими полями: она задаёт позицию, а не подписи. */
export const ForeignFields: Story = {
  render: () => (
    <div className="w-[640px]">
      <FormLayout columns={2}>
        <input
          aria-label="A foreign field"
          className="border-line rounded-control border px-3 py-2"
        />
        <input aria-label="And one more" className="border-line rounded-control border px-3 py-2" />
      </FormLayout>
    </div>
  ),
};
