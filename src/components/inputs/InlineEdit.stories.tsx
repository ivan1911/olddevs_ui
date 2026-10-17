import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { InlineEdit, type InlineEditProps } from "./InlineEdit.js";

const meta = {
  title: "Inputs/InlineEdit",
  component: InlineEdit,
  parameters: { layout: "padded" },
  tags: ["periphery"],
} satisfies Meta<InlineEditProps>;

export default meta;
type Story = StoryObj<InlineEditProps>;

export const Playground: Story = {
  render: function Render() {
    const [value, setValue] = useState("Daily collection");
    return (
      <div className="w-[360px]">
        <InlineEdit value={value} onChange={setValue} label="Name" />
      </div>
    );
  },
};

/** An empty value: the button shows an empty-state label, not an empty hit area. */
export const Empty: Story = {
  render: function Render() {
    const [value, setValue] = useState("");
    return (
      <div className="w-[360px]">
        <InlineEdit value={value} onChange={setValue} label="Description" />
      </div>
    );
  },
};

/** A list of inline edits is the typical case: a card with properties. */
export const List: Story = {
  render: function Render() {
    const [values, setValues] = useState({
      title: "Night city",
      author: "Ada Lovelace",
      license: "CC BY 4.0",
    });
    return (
      <dl className="w-[420px]">
        {(
          [
            ["title", "Name"],
            ["author", "Author"],
            ["license", "Licence"],
          ] as const
        ).map(([key, label]) => (
          <div key={key} className="flex items-center gap-4">
            <dt className="text-fg-2 w-24 shrink-0 text-[11px] font-bold tracking-wide uppercase">
              {label}
            </dt>
            <dd className="min-w-0 flex-1">
              <InlineEdit
                value={values[key]}
                onChange={(next) => setValues((prev) => ({ ...prev, [key]: next }))}
                label={label}
              />
            </dd>
          </div>
        ))}
      </dl>
    );
  },
};

export const Disabled: Story = {
  render: () => (
    <div className="w-[360px]">
      <InlineEdit value="Daily collection" onChange={() => {}} label="Name" disabled />
    </div>
  ),
};
