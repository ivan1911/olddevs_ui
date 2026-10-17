import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "../actions/Button.js";
import { Card } from "../content/Card.js";
import { ModalOverlay } from "./ModalOverlay.js";

const meta = {
  title: "Overlays/ModalOverlay",
  component: ModalOverlay,
  parameters: { layout: "fullscreen" },
  args: { onClose: () => {} },
} satisfies Meta<typeof ModalOverlay>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The overlay is open right in the story, not by a click: the snapshot must be
 * deterministic, and the "open" state is the only thing visible here.
 *
 * The background is built from blocks, not text, and this is not decoration. axe measures text
 * under the dimming through the scrim and correctly considers it unreadable. For content behind a
 * modal window that is normal, but the audit does not know that and would fail on every theme.
 * Blocks show the blur just as well.
 */
const Backdrop = () => (
  <div className="flex h-[420px] flex-col gap-3 p-6" aria-hidden>
    <div className="bg-bg-3 rounded-control h-8 w-64" />
    <div className="bg-bg-2 h-4 w-96 rounded" />
    <div className="flex gap-2">
      <div className="bg-accent rounded-control h-9 w-28" />
      <div className="bg-bg-2 border-line rounded-control h-9 w-24 border" />
    </div>
    <div className="mt-2 grid grid-cols-4 gap-3">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="bg-bg-2 h-40 rounded-md" />
      ))}
    </div>
  </div>
);

export const Centered: Story = {
  render: (args) => (
    <div className="relative">
      <Backdrop />
      <ModalOverlay {...args}>
        <Card>
          <div className="flex w-[320px] flex-col gap-3">
            <div className="text-fg-0 font-bold">Delete the photo?</div>
            <div className="text-fg-2 text-[13px]">This cannot be undone.</div>
            <div className="flex justify-end gap-2">
              <Button variant="soft">Cancel</Button>
              <Button variant="solid" tone="danger">
                Delete
              </Button>
            </div>
          </div>
        </Card>
      </ModalOverlay>
    </div>
  ),
};

/**
 * This primitive has no matrix, and not by oversight: the overlay is `position: fixed` across the
 * whole screen, so two of them in one frame would simply stack on top of each other. Checked: the
 * scrim of the second dims the card of the first, and the axe audit rightly flags the unreadable
 * text. That is why each alignment gets its own story.
 */
export const FromTop: Story = {
  render: (args) => (
    <div className="relative">
      <Backdrop />
      <ModalOverlay {...args} align="start">
        <Card>
          <div className="text-fg-0 w-[320px] font-mono text-xs">align=&quot;start&quot;</div>
        </Card>
      </ModalOverlay>
    </div>
  ),
};
