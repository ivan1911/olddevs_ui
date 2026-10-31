import type { Meta, StoryObj } from "@storybook/react-vite";
import { BasicChatDemo } from "../../.storybook/recipes/BasicChatDemo.js";
import { AutomaticChatDemo } from "../../.storybook/recipes/AutomaticChatDemo.js";

const meta = {
  title: "Recipes/Chat",
  component: BasicChatDemo,
  parameters: { layout: "padded" },
} satisfies Meta<typeof BasicChatDemo>;
export default meta;
type Story = StoryObj<typeof meta>;
export const BasicTextChat: Story = {};
export const StreamingResponse: Story = { args: { streaming: true } };
export const ReadingDuringStream: Story = { render: () => <AutomaticChatDemo /> };
