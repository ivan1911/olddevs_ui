import type { Meta, StoryObj } from "@storybook/react-vite";
import { IntegratedChatDemo } from "../../.storybook/recipes/IntegratedChatDemo.js";

const meta = {
  title: "Recipes/IntegratedChat",
  component: IntegratedChatDemo,
  parameters: { layout: "padded" },
  argTypes: {
    initialScenario: { control: false },
    initialMessages: { control: false },
    visualizer: { control: false },
  },
} satisfies Meta<typeof IntegratedChatDemo>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
export const ReadingHistory: Story = { args: { initialScenario: "reading" } };
export const Narrow: Story = { args: { initialScenario: "narrow" } };
export const BubbleBoundaries: Story = { args: { initialScenario: "groups" } };
