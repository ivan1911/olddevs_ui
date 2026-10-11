import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "../actions/Button.js";
import { SectionHeader } from "./SectionHeader.js";

const meta = {
  title: "Navigation/SectionHeader",
  component: SectionHeader,
  parameters: { layout: "padded" },
  args: { title: "Post contents" },
} satisfies Meta<typeof SectionHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = { args: { size: "md" } };

/** Матрица размер × наполнение правой части. */
export const Matrix: Story = {
  render: () => (
    <div className="flex w-[520px] flex-col gap-6">
      {(["sm", "md"] as const).map((size) => (
        <div key={size} className="flex flex-col gap-3">
          <div className="text-fg-2 font-mono text-xs">{size}</div>
          <SectionHeader size={size} title="Title only" />
          <SectionHeader
            size={size}
            title="With a right-hand note"
            right={<span className="text-fg-2 text-[11px]">updated yesterday</span>}
          />
          <SectionHeader
            size={size}
            title="With a button"
            right={
              <Button size="sm" variant="soft" tone="neutral">
                Add
              </Button>
            }
          />
          <SectionHeader
            size={size}
            title={
              <span className="flex items-center gap-2">
                <span aria-hidden>★</span> Title as markup
              </span>
            }
          />
        </div>
      ))}
    </div>
  ),
};
