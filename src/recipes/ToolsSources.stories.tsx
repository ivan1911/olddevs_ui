import type { Meta, StoryObj } from "@storybook/react-vite";
import { ToolsSourcesDemo } from "../../.storybook/recipes/ToolsSourcesDemo.js";

const meta = {
  title: "Recipes/Tools and sources",
  component: ToolsSourcesDemo,
  parameters: { layout: "padded" },
} satisfies Meta<typeof ToolsSourcesDemo>;
export default meta;
type Story = StoryObj<typeof meta>;
export const OperationsAndSources: Story = {};
export const WithoutSources: Story = { args: { withSources: false } };
