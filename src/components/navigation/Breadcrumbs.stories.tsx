import type { Meta, StoryObj } from "@storybook/react-vite";
import { Breadcrumbs } from "./Breadcrumbs.js";

/** Wave 9: navigation primitives for the lighter bar. */
const meta = {
  title: "Navigation/Breadcrumbs",
  component: Breadcrumbs,
  parameters: { layout: "padded" },
  tags: ["periphery"],
} satisfies Meta<typeof Breadcrumbs>;

export default meta;
type Story = StoryObj;

export const Crumbs: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <Breadcrumbs
        items={[
          { label: "Library", href: "#" },
          { label: "Nature", href: "#" },
          { label: "Sunsets" },
        ]}
      />
      <Breadcrumbs
        items={[
          { label: "Library", href: "#" },
          { label: "Collections", href: "#" },
          { label: "Nature", href: "#" },
          { label: "Mountains", href: "#" },
          { label: "Fog in the valley" },
        ]}
      />
    </div>
  ),
};
