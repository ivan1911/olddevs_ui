import type { Meta, StoryObj } from "@storybook/react-vite";
import { DescriptionList } from "./DescriptionList.js";

/** Волна 10: данные. Облегчённая планка, снимков нет. */
const meta = {
  title: "Content/DescriptionList",
  component: DescriptionList,
  parameters: { layout: "padded" },
  tags: ["periphery"],
} satisfies Meta<typeof DescriptionList>;

export default meta;
type Story = StoryObj;

export const Properties: Story = {
  render: () => (
    <div className="flex w-[420px] flex-col gap-6">
      <DescriptionList
        items={[
          { label: "Resolution", value: "1080 × 2400" },
          { label: "Size", value: "2.4 MB" },
          { label: "Category", value: "Night city" },
          { label: "Uploaded", value: "5 August 2026" },
        ]}
      />
      <DescriptionList
        layout="stack"
        items={[
          { label: "Description", value: "A long value the column would be too narrow for." },
        ]}
      />
    </div>
  ),
};
