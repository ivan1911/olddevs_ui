import type { Meta, StoryObj } from "@storybook/react-vite";
import { Kbd } from "./Kbd.js";
import { Text } from "./Text.js";

const meta = {
  title: "Content/Kbd",
  component: Kbd,
  parameters: { layout: "padded" },
} satisfies Meta<typeof Kbd>;

export default meta;
type Story = StoryObj;

export const Keys: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Text level={2}>Open search</Text>
        <Kbd>⌘</Kbd>
        <Kbd>K</Kbd>
      </div>
      <div className="flex items-center gap-2">
        <Text level={2}>Shortcut cheat sheet</Text>
        <Kbd size="md">⇧</Kbd>
        <Kbd size="md">?</Kbd>
      </div>
      <div className="flex items-center gap-2">
        <Text level={2}>Long label</Text>
        <Kbd size="md">Esc</Kbd>
        <Kbd size="md">Enter</Kbd>
      </div>
    </div>
  ),
};
