import type { Meta, StoryObj } from "@storybook/react-vite";
import { DatePicker } from "../date-time/DatePicker.js";
import { DateRangePicker } from "../date-time/DateRangePicker.js";
import { FormField } from "./FormField.js";
import { SearchControl } from "./SearchControl.js";
import { Select } from "./Select.js";
import { TextControl } from "./TextControl.js";

/**
 * The look of a control inside a form: a neutral outline, width by column.
 *
 * The accent highlight of the selected value is turned off here on purpose. In the filter
 * panel it means "filter applied", and people look for it with their eyes; in a form the
 * same thing would mean "field filled in", which is the norm, not an event.
 */
const FORM_TRIGGER = "border-line bg-bg-2 w-full rounded-control px-3 py-2.5";

const meta = {
  title: "Inputs/FormField",
  component: FormField,
  parameters: { layout: "padded" },
  args: { label: "Name" },
} satisfies Meta<typeof FormField>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The canonical call: the block's `htmlFor` and the field's `id` are the same string.
 * A click on the label focuses the field, the screen reader names the field with its words,
 * and a separate `aria-label` on the field is not needed.
 */
export const Playground: Story = {
  args: {
    htmlFor: "field-title",
    hint: "Shown to channel subscribers",
    children: <TextControl id="field-title" placeholder="Sunset over the city" />,
  },
};

/**
 * Content matrix: with a hint and without, with different controls inside.
 *
 * The point of the sweep is the variety of content. `FormField` does not know what is
 * inside it: it gives a label, spacing and a hint to anything that takes up the width of
 * the column. A matrix of text fields alone did not show this and left the impression that
 * `FormField` and `TextControl` are the same thing seen from two sides.
 *
 * Not included here, and never will be: `Toggle`. A switch has its label to the left of
 * the control, not above it; putting it here would legitimize a layout that does not occur
 * in interfaces. Besides, it has its own required `label` (`aria-label` on `role="switch"`),
 * and inside `FormField` there would be two names: the visible one above and the one
 * the screen reader announces.
 */
export const Matrix: Story = {
  render: () => (
    <div className="flex w-[420px] flex-col gap-6">
      <FormField label="Label only">
        <TextControl aria-label="Label only" />
      </FormField>
      <FormField label="With a hint" hint="No longer than 120 characters">
        <TextControl aria-label="With a hint" />
      </FormField>
      <FormField label="Multiline" hint="Telegram markup is supported">
        <TextControl as="textarea" rows={3} aria-label="Multiline" />
      </FormField>
      <FormField label="Search" hint="The cross clears and returns focus to the field">
        <SearchControl label="Find photos" value="sunset" onChange={() => {}} />
      </FormField>
      <FormField label="Category" hint="Affects tag suggestions on upload">
        <Select
          items={[
            { id: "nature", label: "Nature", meta: 214 },
            { id: "space", label: "Space", meta: 87 },
          ]}
          value="nature"
          onChange={() => {}}
          placeholder="Category"
          highlightSelected={false}
          triggerClassName={FORM_TRIGGER}
        />
      </FormField>
      <FormField label="Publish date">
        <DatePicker value="2026-03-12" onChange={() => {}} triggerClassName={FORM_TRIGGER} />
      </FormField>
      <FormField label="Campaign period" hint="The preset stays relative tomorrow too">
        <DateRangePicker
          value={{ start: "2026-03-09", end: "2026-03-22" }}
          period={null}
          onChange={() => {}}
          triggerClassName={FORM_TRIGGER}
        />
      </FormField>
    </div>
  ),
};

/**
 * Error and required.
 *
 * An error REPLACES the hint rather than sitting under it: two lines under the field, one of
 * which contradicts the other, force the reader to read both to see which one still applies.
 */
export const ErrorAndRequired: Story = {
  parameters: { layout: "padded" },
  render: () => (
    <div className="flex w-[320px] flex-col gap-4">
      <FormField label="Name" htmlFor="ff-a" hint="How subscribers will see it">
        <TextControl id="ff-a" defaultValue="Daily collection" shellClassName="w-full" />
      </FormField>
      <FormField label="Name" htmlFor="ff-b" required hint="How subscribers will see it">
        <TextControl id="ff-b" shellClassName="w-full" />
      </FormField>
      <FormField
        label="Name"
        htmlFor="ff-c"
        required
        hint="How subscribers will see it"
        error="Name is required"
      >
        <TextControl id="ff-c" shellClassName="w-full" />
      </FormField>
    </div>
  ),
};

/**
 * Side layout: the label in a column on the left, the hint and the error under the field.
 *
 * The axis belongs to the field, not to the layout: `FormField` draws the label, and it
 * cannot be moved from outside. The column width is the `--form-label-w` variable.
 */
export const LabelOnLeft: Story = {
  parameters: { layout: "padded" },
  render: () => (
    <div className="flex w-[520px] flex-col gap-4">
      <FormField label="Name" htmlFor="ff-s1" layout="side" hint="How subscribers will see it">
        <TextControl id="ff-s1" defaultValue="Daily collection" shellClassName="w-full" />
      </FormField>
      <FormField
        label="Email for notifications"
        htmlFor="ff-s2"
        layout="side"
        required
        error="The address is required"
      >
        <TextControl id="ff-s2" shellClassName="w-full" />
      </FormField>
      <div style={{ "--form-label-w": "8rem" } as React.CSSProperties}>
        <FormField label="Narrow column" htmlFor="ff-s3" layout="side">
          <TextControl id="ff-s3" shellClassName="w-full" />
        </FormField>
      </div>
    </div>
  ),
};
