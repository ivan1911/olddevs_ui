import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "../actions/Button.js";
import { ModalOverlay } from "./ModalOverlay.js";
import { Tooltip, TooltipProvider } from "./Tooltip.js";

const meta = {
  title: "Overlays/Tooltip",
  component: Tooltip,
  parameters: { layout: "centered" },
  decorators: [
    (Story) => (
      <TooltipProvider delayDuration={0}>
        <Story />
      </TooltipProvider>
    ),
  ],
  args: { content: "Notifications" },
} satisfies Meta<typeof Tooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  args: { children: <Button variant="soft">Hover here</Button> },
  render: (args) => (
    <Tooltip {...args}>
      <Button variant="soft">Hover here</Button>
    </Tooltip>
  ),
};

/**
 * A matrix of sides. The tooltip lives in a portal and appears on hover, so it is not visible
 * in the snapshot: the matrix shows the anchors and the fact that the wrapper does not break the
 * layout. Showing and positioning are checked by hand in the showcase: a hover never produces
 * a deterministic snapshot.
 */
export const Matrix: Story = {
  args: { children: <Button variant="outline">Anchor</Button> },
  parameters: { layout: "padded" },
  render: () => (
    <div className="flex flex-wrap gap-4">
      {(["top", "right", "bottom", "left"] as const).map((side) => (
        <Tooltip key={side} content={`Tooltip below ${side}`} side={side}>
          <Button variant="outline" tone="neutral">
            side={side}
          </Button>
        </Tooltip>
      ))}
      <Tooltip content="">
        <Button variant="ghost">No tooltip</Button>
      </Tooltip>
    </div>
  ),
};

/**
 * A tooltip inside a modal window.
 *
 * This checks the layer: with `z-[60]` the tooltip went under the scrim (`z-90`), so it is in the
 * markup but not on screen. Hover it by hand, since a hover has no snapshot; check that the tooltip
 * appears ABOVE the window, not behind it.
 */
export const UnderOverlay: Story = {
  args: { children: <Button variant="soft">Hover here</Button> },
  parameters: { layout: "fullscreen" },
  render: () => (
    // A wrapper with a height is required: the scrim is positioned `fixed`, and without
    // it the root of the showcase stays a box of zero height, that is, "hidden"
    // to Playwright, and the run fails by timeout instead of checking anything.
    <div className="h-[320px]">
      <ModalOverlay
        onClose={() => {}}
        className="border-line bg-bg-1 w-full max-w-[380px] rounded-lg border p-5"
      >
        <p className="text-fg-1 m-0 mb-4 text-[13px]">
          Hover the button: the tooltip must sit above the window.
        </p>
        <Tooltip content="Visible above the backdrop">
          <Button variant="solid" tone="accent">
            A button inside the window
          </Button>
        </Tooltip>
      </ModalOverlay>
    </div>
  ),
};
