import type { Meta, StoryObj } from "@storybook/react-vite";
import { Card } from "./Card.js";
import { Button } from "../actions/Button.js";
import { StatusBadge } from "../actions/StatusBadge.js";

const meta = {
  title: "Content/Card",
  component: Card,
  parameters: { layout: "centered" },
  args: { children: "Card content" },
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A single card with live controls. Tweak the props. */
export const Playground: Story = {
  args: { size: "md" },
};

/** Content that shows the padding and how the text sits inside. */
function CardBody() {
  return (
    <div className="flex w-56 flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-fg-0 text-md font-semibold">Publishing</span>
        <StatusBadge tone="success">OK</StatusBadge>
      </div>
      <p className="text-fg-2 text-xs">
        Two padding steps: cards in the schedule grid are denser than cards on a page.
      </p>
      <Button size="sm" variant="soft" tone="neutral">
        Open
      </Button>
    </div>
  );
}

/**
 * Size matrix. A card has one axis, and a single instance says nothing along it. The difference
 * between `sm` and `md` (padding and radius move as a pair) is visible only side by side, with
 * identical content.
 */
export const Matrix: Story = {
  parameters: { layout: "padded" },
  render: () => (
    <div className="flex flex-wrap items-start gap-6">
      {(["sm", "md"] as const).map((size) => (
        <div key={size} className="flex flex-col gap-2">
          <span className="text-fg-2 font-mono text-xs">{size}</span>
          <Card size={size}>
            <CardBody />
          </Card>
        </div>
      ))}
    </div>
  ),
};

/** A card on a card: a check that the border and shadow don't merge when nested. */
export const Nesting: Story = {
  parameters: { layout: "padded" },
  render: () => (
    <Card size="md" className="max-w-md">
      <div className="flex flex-col gap-3">
        <span className="text-fg-0 text-md font-semibold">Outer card</span>
        <Card size="sm">
          <span className="text-fg-2 text-xs">Nested card, size sm</span>
        </Card>
        <Card size="sm">
          <span className="text-fg-2 text-xs">One more</span>
        </Card>
      </div>
    </Card>
  ),
};

/**
 * `asChild` — a card that the user presses.
 *
 * Before this prop, such cards were built as `<div onClick>`: unreachable from the keyboard,
 * with no role, and screen readers do not announce the press. Here the look moves onto a real
 * button or link, and the cursor, the border highlight and the focus ring move with it.
 */
export const Pressable: Story = {
  parameters: { layout: "padded" },
  render: () => (
    <div className="flex flex-wrap items-start gap-6">
      <Card asChild size="md" className="max-w-[260px]">
        <button type="button">
          <span className="text-fg-0 text-md font-semibold">City views</span>
          <span className="text-fg-3 mt-px block text-[11px]">142 photos</span>
        </button>
      </Card>
      <Card asChild size="md" className="max-w-[260px]">
        <a href="#collection">
          <span className="text-fg-0 text-md font-semibold">Card as a link</span>
          <span className="text-fg-3 mt-px block text-[11px]">opens in a new tab</span>
        </a>
      </Card>
      <Card size="md" className="max-w-[260px]">
        <span className="text-fg-2 text-xs">A plain container card next to it</span>
      </Card>
    </div>
  ),
};

/**
 * `interactive` — a card with a primary action and secondary actions next to it.
 *
 * A button cannot be nested inside a button, so a card with a "More" menu cannot be a button as a
 * whole. The primary action is a link stretched over the card's area (`after:absolute after:inset-0`).
 * The menu sits higher in the stacking layer and remains a separate target for mouse and keyboard.
 */
export const WithMenuInside: Story = {
  parameters: { layout: "padded" },
  render: () => (
    <div className="flex flex-wrap items-start gap-6">
      <Card interactive size="md" className="w-[260px]">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <a href="#collection" className="after:absolute after:inset-0">
              <span className="text-fg-0 text-md font-semibold">City views</span>
            </a>
            <span className="text-fg-3 mt-px block text-[11px]">142 photos</span>
          </div>
          <div className="relative z-10">
            <Button variant="ghost" iconOnly size="sm" aria-label="More" icon={<span>⋯</span>} />
          </div>
        </div>
      </Card>
    </div>
  ),
};
