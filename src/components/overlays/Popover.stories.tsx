import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "../actions/Button.js";
import { Popover, PopoverContent, PopoverTrigger } from "./Popover.js";

const meta = {
  title: "Overlays/Popover",
  component: PopoverContent,
  parameters: { layout: "padded" },
} satisfies Meta<typeof PopoverContent>;

export default meta;
type Story = StoryObj<typeof meta>;

const Content = () => (
  <div className="w-[240px] p-3">
    <div className="text-fg-0 mb-1 text-[13px] font-bold">Panel</div>
    <div className="text-fg-2 text-[13px]">
      The caller supplies the content: the panel only positions it and closes on Escape.
    </div>
  </div>
);

/**
 * Open by default: the snapshot must be deterministic, and a closed panel is simply absent from it.
 */
export const Playground: Story = {
  render: () => (
    <div className="flex h-[280px] items-start">
      <Popover defaultOpen>
        <PopoverTrigger asChild>
          <Button variant="soft">Open the panel</Button>
        </PopoverTrigger>
        <PopoverContent>
          <Content />
        </PopoverContent>
      </Popover>
    </div>
  ),
};

/**
 * The panel has no matrix, for the same reason as `ModalOverlay`: the content lives in a portal
 * above the whole page, and two open panels in one frame would overlap each other. Here there is
 * one, anchored to the bottom edge. The anchor sits at the right edge of the frame: the panel's
 * right edge (`align="end"`) lines up with the button's right edge, and there is room for it on the left.
 */
export const BelowTrigger: Story = {
  render: () => (
    <div className="flex h-[280px] items-start justify-end">
      <Popover defaultOpen>
        <PopoverTrigger asChild>
          <Button variant="outline">Anchor</Button>
        </PopoverTrigger>
        <PopoverContent side="bottom" align="end">
          <Content />
        </PopoverContent>
      </Popover>
    </div>
  ),
};
