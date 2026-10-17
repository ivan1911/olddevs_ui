import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Button } from "../actions/Button.js";
import { Checkbox } from "./Checkbox.js";
import { Form } from "./Form.js";
import { FormField } from "./FormField.js";
import { NumberInput } from "./NumberInput.js";
import { TextControl } from "./TextControl.js";

const meta = {
  title: "Inputs/Form",
  component: Form,
  parameters: { layout: "padded" },
  args: { onSubmit: () => {} },
} satisfies Meta<typeof Form>;

export default meta;
type Story = StoryObj<typeof meta>;

function FieldsDemo() {
  const [count, setCount] = useState<number | null>(3);
  return (
    <>
      <FormField label="Name" htmlFor="fs-title" required>
        <TextControl
          id="fs-title"
          name="title"
          defaultValue="Collection of the week"
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
      <Checkbox name="pin">Pin in the channel</Checkbox>
      <Button type="submit" variant="solid" tone="accent">
        Save
      </Button>
    </>
  );
}

export const Playground: Story = {
  render: () => (
    <div className="w-[320px]">
      <Form onSubmit={() => {}}>
        <FieldsDemo />
      </Form>
    </div>
  ),
};

/**
 * Submitting is in progress: the whole form is disabled through `<fieldset disabled>`.
 *
 * The check is not cosmetic. The `disabled` property of the fields stays `false` in this
 * case: being disabled is inherited, and only the `:disabled` pseudo-class sees it.
 * If the styles relied on the attribute, the fields would look working
 * while being non-functional.
 */
export const Submitting: Story = {
  render: () => (
    <div className="w-[320px]">
      <Form onSubmit={() => {}} pending>
        <FieldsDemo />
      </Form>
    </div>
  ),
};

/** Errors are passed as props of the fields, not through a magic channel of the form. */
export const WithErrors: Story = {
  render: () => (
    <div className="w-[320px]">
      <Form onSubmit={() => {}}>
        <FormField label="Name" htmlFor="fe-title" required error="Name is required">
          <TextControl id="fe-title" name="title" shellClassName="w-full" />
        </FormField>
        <Checkbox name="pin" invalid>
          Consent is required
        </Checkbox>
        <Button type="submit" variant="solid" tone="accent">
          Save
        </Button>
      </Form>
    </div>
  ),
};
