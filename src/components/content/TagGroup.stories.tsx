import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { LABEL_HUES } from "../../lib/variants.js";
import { Button } from "../actions/Button.js";
import { Tag, TagGroup, type TagGroupProps } from "./TagGroup.js";

const meta = {
  title: "Content/TagGroup",
  component: TagGroup,
  parameters: { layout: "padded" },
  tags: ["periphery"],
} satisfies Meta<TagGroupProps>;

export default meta;
type Story = StoryObj<TagGroupProps>;

const NAMES: Record<(typeof LABEL_HUES)[number], string> = {
  blue: "Blue",
  violet: "Violet",
  teal: "Teal",
  green: "Green",
  amber: "Amber",
  red: "Red",
  pink: "Pink",
  steel: "Steel",
};

/** Tags for display: without a hue and with one. */
export const Playground: Story = {
  render: () => (
    <TagGroup label="Categories">
      <Tag id="design">Design</Tag>
      <Tag id="docs" hue="teal">
        Docs
      </Tag>
      <Tag id="ops" hue="amber">
        Operations
      </Tag>
    </TagGroup>
  ),
};

/** All eight hues of the palette: a dot next to the label, not a fill under it. */
export const Hues: Story = {
  render: () => (
    <TagGroup label="Label hues">
      {LABEL_HUES.map((hue) => (
        <Tag key={hue} id={hue} hue={hue}>
          {NAMES[hue]}
        </Tag>
      ))}
    </TagGroup>
  ),
};

/**
 * Removal: `onRemove` turns the buttons on, Delete and Backspace work from the keyboard,
 * and focus stays on the neighboring tag.
 */
export const Removable: Story = {
  render: () => {
    const [tags, setTags] = useState(LABEL_HUES.slice(0, 5));
    return (
      <div className="flex flex-col items-start gap-4">
        <TagGroup
          label="Removable categories"
          onRemove={(keys) => setTags((current) => current.filter((hue) => !keys.has(hue)))}
          empty="No categories"
        >
          {tags.map((hue) => (
            <Tag key={hue} id={hue} hue={hue}>
              {NAMES[hue]}
            </Tag>
          ))}
        </TagGroup>
        <Button variant="outline" size="sm" onClick={() => setTags(LABEL_HUES.slice(0, 5))}>
          Restore
        </Button>
      </div>
    );
  },
};

/** A link tag: Enter and a click go to the address. */
export const Links: Story = {
  render: () => (
    <TagGroup label="Related categories">
      <Tag id="design" hue="blue" href="#design">
        Design
      </Tag>
      <Tag id="docs" hue="green" href="#docs">
        Docs
      </Tag>
      <Tag id="plain">Without a link</Tag>
    </TagGroup>
  ),
};

/** An empty group shows `empty` instead of disappearing. */
export const Empty: Story = {
  render: () => <TagGroup label="No categories yet" empty="Nothing here yet" />,
};

/** The group wraps onto a new line tag by tag. */
export const Wrapping: Story = {
  render: () => (
    <div className="w-64">
      <TagGroup label="Narrow column" onRemove={() => {}}>
        {[...LABEL_HUES, ...LABEL_HUES].map((hue, index) => (
          <Tag key={index} id={index} hue={hue}>
            {`${NAMES[hue]} label`}
          </Tag>
        ))}
      </TagGroup>
    </div>
  ),
};
