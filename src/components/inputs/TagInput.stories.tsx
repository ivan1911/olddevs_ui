import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { TagInput, type TagInputProps } from "./TagInput.js";

const meta = {
  title: "Inputs/TagInput",
  component: TagInput,
  parameters: { layout: "padded" },
  tags: ["periphery"],
} satisfies Meta<TagInputProps>;

export default meta;
type Story = StoryObj<TagInputProps>;

export const Playground: Story = {
  render: function Render() {
    const [tags, setTags] = useState(["sunset", "night city"]);
    return (
      <div className="w-[360px]">
        <TagInput value={tags} onChange={setTags} label="Tags" placeholder="Add a tag" />
      </div>
    );
  },
};

export const Empty: Story = {
  render: function Render() {
    const [tags, setTags] = useState<string[]>([]);
    return (
      <div className="w-[360px]">
        <TagInput value={tags} onChange={setTags} label="Tags" placeholder="Add a tag" />
      </div>
    );
  },
};

/** A limit: once it is reached, the input is disabled, while the tags stay removable. */
export const WithLimit: Story = {
  render: function Render() {
    const [tags, setTags] = useState(["sunset", "mountains", "fog"]);
    return (
      <div className="w-[360px]">
        <TagInput value={tags} onChange={setTags} label="Tags (three at most)" max={3} />
      </div>
    );
  },
};
