import type { Meta, StoryObj } from "@storybook/react-vite";
import { BasicChatDemo } from "../../.storybook/recipes/BasicChatDemo.js";

const meta = {
  title: "Recipes/Chat",
  component: BasicChatDemo,
  parameters: { layout: "padded" },
} satisfies Meta<typeof BasicChatDemo>;
export default meta;
type Story = StoryObj<typeof meta>;
export const BasicTextChat: Story = {};
