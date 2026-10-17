import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import type { Key } from "react-aria-components";
import { Combobox, type ComboboxProps } from "./Combobox.js";
import { Dialog } from "../overlays/Dialog.js";
import { Drawer } from "../overlays/Drawer.js";
import { FormField } from "./FormField.js";
import { Text } from "../content/Text.js";

const CATEGORIES = [
  { id: "nature", label: "Nature", meta: 128 },
  { id: "city", label: "City", meta: 64 },
  { id: "space", label: "Space", meta: 41 },
  { id: "abstract", label: "Abstract", meta: 12 },
  { id: "minimal", label: "Minimal", meta: 7 },
];

const meta = {
  title: "Inputs/Combobox",
  component: Combobox,
  parameters: { layout: "padded" },
  // Periphery: no snapshots; the bar is set by ADR-0014.
  tags: ["periphery"],
  args: { items: CATEGORIES, placeholder: "Category" },
} satisfies Meta<ComboboxProps>;

export default meta;
type Story = StoryObj<ComboboxProps>;

export const Playground: Story = {
  render: (args) => (
    <div className="w-[320px]">
      <Combobox {...args} aria-label="Category" />
    </div>
  ),
};

/**
 * Free input is what sets `Combobox` apart from `Select`: the value may not match
 * any item.
 */
export const FreeInput: Story = {
  render: function Render(args) {
    const [value, setValue] = useState("");
    return (
      <div className="flex w-[320px] flex-col gap-2">
        <FormField label="Category" hint="You can type your own">
          <Combobox
            {...args}
            allowsCustomValue
            aria-label="Category"
            inputValue={value}
            onInputChange={setValue}
          />
        </FormField>
        <Text size="sm" level={3}>
          Value: {value || "—"}
        </Text>
      </div>
    );
  },
};

export const InForm: Story = {
  render: (args) => (
    <div className="flex w-[320px] flex-col gap-3">
      <FormField label="Category" htmlFor="cb-a">
        <Combobox {...args} id="cb-a" />
      </FormField>
      <FormField label="Disabled">
        <Combobox {...args} aria-label="Disabled" isDisabled />
      </FormField>
    </div>
  ),
};

/**
 * A suggestion list inside a modal Radix layer, that is, a `Dialog` or a `Drawer`.
 *
 * The list lives in a react-aria portal directly under `<body>`, while the modal Radix
 * switches off `pointer-events` on `<body>`. Until the kit gave the react-aria overlay
 * the pointer back, an option could be selected only from the keyboard, and a click fell
 * through to the backdrop. Checked in `tests-visual/interactions.spec.ts`.
 */
function InsideModal({ args, layer }: { args: ComboboxProps; layer: "dialog" | "drawer" }) {
  const [open, setOpen] = useState(true);
  const [picked, setPicked] = useState<Key | null>(null);
  const body = (
    <div className="flex flex-col gap-2">
      <FormField label="Category">
        <Combobox {...args} aria-label="Category" onSelectionChange={setPicked} />
      </FormField>
      <Text size="sm" level={3}>
        Picked: {picked ?? "—"}
      </Text>
    </div>
  );
  return layer === "dialog" ? (
    // The body's width and padding match the Dialog stories: `Dialog` itself has no defaults.
    <Dialog
      open={open}
      onClose={() => setOpen(false)}
      title="Collection settings"
      className="w-full max-w-[420px]"
    >
      <div className="px-5 py-4">{body}</div>
    </Dialog>
  ) : (
    <Drawer open={open} onClose={() => setOpen(false)} title="Collection settings">
      {body}
    </Drawer>
  );
}

export const InsideDialog: Story = {
  render: (args) => <InsideModal args={args} layer="dialog" />,
};

export const InsideDrawer: Story = {
  render: (args) => <InsideModal args={args} layer="drawer" />,
};
