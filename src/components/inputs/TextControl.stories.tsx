import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Button } from "../actions/Button.js";
import { SearchControl } from "./SearchControl.js";
import { Select } from "./Select.js";
import { TextControl } from "./TextControl.js";

const meta = {
  title: "Inputs/TextControl",
  component: TextControl,
  parameters: { layout: "centered" },
  args: { placeholder: "Photo name", "aria-label": "Photo name" },
} satisfies Meta<typeof TextControl>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = { args: { as: "input" } };

/**
 * A matrix of "appearance × state". The states are shown with real attributes
 * (`disabled`, `readOnly`), not classes: if the styling drifts apart from the
 * field's actual state, the matrix will show it.
 */
export const Matrix: Story = {
  parameters: { layout: "padded" },
  render: () => (
    <div className="flex w-[420px] flex-col gap-5">
      {(
        [
          ["plain", {}],
          ["with text", { defaultValue: "Sunset over the city" }],
          ["disabled", { disabled: true, defaultValue: "Unavailable" }],
          ["read only", { readOnly: true, defaultValue: "Read only" }],
        ] as const
      ).map(([label, props]) => (
        <label key={label} className="flex flex-col gap-1.5">
          <span className="text-fg-2 font-mono text-xs">{label}</span>
          <TextControl placeholder="Photo name" {...props} />
        </label>
      ))}
      <label className="flex flex-col gap-1.5">
        <span className="text-fg-2 font-mono text-xs">textarea, rows=3</span>
        <TextControl as="textarea" rows={3} placeholder="Description" />
      </label>
    </div>
  ),
};

/**
 * A growing field with a character counter.
 *
 * The browser computes the height, not JS: an invisible twin with the same typography
 * sits in the same grid cell and sets its height. The usual approach, reading
 * `scrollHeight` on every keystroke, forces a layout recalculation on each character.
 *
 * With `autosize`, `rows` is the minimum and `maxRows` is the limit, after which
 * scrolling kicks in.
 */
export const Growing: Story = {
  parameters: { layout: "padded" },
  render: function Render() {
    const [short, setShort] = useState("One line");
    const [long, setLong] = useState(
      "First line\nsecond line\nthird line\nfourth line\nfifth line"
    );
    return (
      <div className="flex w-[360px] flex-col gap-4">
        <TextControl
          as="textarea"
          autosize
          rows={2}
          value={short}
          onChange={(e) => setShort(e.target.value)}
          aria-label="Grows with content"
          shellClassName="w-full"
        />
        <TextControl
          as="textarea"
          autosize
          rows={2}
          maxRows={4}
          value={long}
          onChange={(e) => setLong(e.target.value)}
          aria-label="Grows to a limit, then scrolls"
          shellClassName="w-full"
        />
      </div>
    );
  },
};

/** Counter: with `maxLength` it shows "N/M", without it just "N". */
export const WithCounter: Story = {
  parameters: { layout: "padded" },
  render: function Render() {
    const [name, setName] = useState("Daily collection");
    const [text, setText] = useState("A short caption");
    return (
      <div className="flex w-[360px] flex-col gap-4">
        <TextControl
          showCount
          maxLength={40}
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="With a limit"
          shellClassName="w-full"
        />
        <TextControl
          as="textarea"
          autosize
          rows={2}
          showCount
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label="Without a limit"
          shellClassName="w-full"
        />
      </div>
    );
  },
};

/**
 * The size step next to its neighbors in a row.
 *
 * `sm` is 36 px, exactly the height of `Button size="md"` and the `Select` trigger pill.
 * In a control bar, a field below this step used to fall out of the row on its own. `md` is
 * the previous 42 px, which is the right height in a form.
 *
 * The story exists for measurement: a six-pixel difference is visible in a static frame
 * only next to the thing the field has to match.
 */
export const Sizes: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2" data-testid="compact-row">
        <Button>New task</Button>
        <TextControl aria-label="Compact search" size="sm" placeholder="sm — 36" />
        {/* The size is passed through to search as well: it sits on the same field. */}
        <SearchControl label="Search tasks" size="sm" value="" onChange={() => {}} />
        <Select
          items={[{ id: "all", label: "All projects" }]}
          value={null}
          onChange={() => {}}
          placeholder="Project"
          highlightSelected={false}
        />
      </div>
      <div className="flex items-center gap-2">
        <TextControl aria-label="Form field" placeholder="md — 42, the default" />
      </div>
    </div>
  ),
};
