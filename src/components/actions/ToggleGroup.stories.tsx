import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { ToggleGroup } from "./ToggleGroup.js";
import { Text } from "../content/Text.js";

/** Волна 9, облегчённая планка: шла вместе с примитивами навигации. */
const meta = {
  title: "Actions/ToggleGroup",
  component: ToggleGroup,
  parameters: { layout: "padded" },
  tags: ["periphery"],
} satisfies Meta<typeof ToggleGroup>;

export default meta;
type Story = StoryObj;

export const Toggles: Story = {
  render: function Render() {
    const [value, setValue] = useState<string[]>(["draft"]);
    return (
      <div className="flex flex-col gap-4">
        <ToggleGroup
          aria-label="Statuses"
          options={[
            { id: "draft", label: "Drafts" },
            { id: "queued", label: "Queued" },
            { id: "published", label: "Published" },
          ]}
          value={value}
          onChange={(v) => setValue(v as string[])}
        />
        <Text size="sm" level={3}>
          Picked: {value.length ? value.join(", ") : "nothing — a legal state"}
        </Text>
      </div>
    );
  },
};
