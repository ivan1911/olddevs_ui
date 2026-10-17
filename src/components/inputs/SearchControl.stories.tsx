import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Dialog } from "../overlays/Dialog.js";
import { SearchControl } from "./SearchControl.js";

const meta = {
  title: "Inputs/SearchControl",
  component: SearchControl,
  parameters: { layout: "padded" },
  args: {
    label: "Search the library",
    placeholder: "Find photos…",
    value: "",
    onChange: () => {},
  },
} satisfies Meta<typeof SearchControl>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Live field: the clear button appears with the first character and returns focus to the field. */
export const Playground: Story = {
  render: (args) => {
    const [value, setValue] = useState("");
    return (
      <div className="w-[320px]">
        <SearchControl {...args} value={value} onChange={setValue} />
      </div>
    );
  },
};

/** Modeled on YouTube search: the panel opens from a button inside the field and changes the current text selection. */
export const OnScreenKeyboard: Story = {
  render: (args) => {
    const [value, setValue] = useState("sunset");
    const [layout, setLayout] = useState<"en" | "ru">("ru");
    return (
      <div className="h-[460px] w-[640px]">
        <SearchControl
          {...args}
          value={value}
          onChange={setValue}
          keyboard={{ layout, onLayoutChange: setLayout }}
        />
      </div>
    );
  },
};

/** A technical scenario for checking Escape in a Popover stack on top of a Dialog. */
export const KeyboardInDialog: Story = {
  tags: ["periphery"],
  render: (args) => {
    const [dialogOpen, setDialogOpen] = useState(true);
    const [value, setValue] = useState("sunset");
    const [layout, setLayout] = useState<"en" | "ru">("ru");
    return (
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="Search inside a dialog"
        className="w-full max-w-[700px]"
      >
        <div className="p-5">
          <SearchControl
            {...args}
            value={value}
            onChange={setValue}
            keyboard={{ layout, onLayoutChange: setLayout }}
          />
        </div>
      </Dialog>
    );
  },
};

/**
 * Matrix of state × shape. The geometry is set through `shellClassName`: the field has no
 * size axis of its own, just like `Select` with its `triggerClassName`, because the package
 * does not know the look of the surrounding form.
 *
 * The last row is the pill from the library's filter: the same primitive with a different
 * shell, not a second component.
 */
export const Matrix: Story = {
  render: (args) => (
    <div className="flex w-[420px] flex-col gap-5">
      {(
        [
          ["empty", { value: "" }],
          ["with a query", { value: "sunset" }],
          ["no clear", { value: "sunset", clearable: false }],
          ["disabled", { value: "sunset", disabled: true }],
        ] as const
      ).map(([label, props]) => (
        <div key={label} className="flex flex-col gap-1.5">
          <span className="text-fg-2 font-mono text-xs">{label}</span>
          <SearchControl {...args} {...props} />
        </div>
      ))}
      <div className="flex flex-col gap-1.5">
        <span className="text-fg-2 font-mono text-xs">pill, compact</span>
        <SearchControl
          {...args}
          value="mountains"
          shellClassName="rounded-full py-0"
          className="py-[7px] text-xs"
        />
      </div>
    </div>
  ),
};
