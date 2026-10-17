import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Avatar } from "../content/Avatar.js";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "./HoverCard.js";

const meta = {
  title: "Overlays/HoverCard",
  component: HoverCard,
  parameters: { layout: "padded" },
  args: { children: null },
} satisfies Meta<typeof HoverCard>;

export default meta;
type Story = StoryObj<typeof meta>;

const Preview = () => (
  <div className="flex w-[280px] gap-3 p-3">
    <Avatar name="Ada Lovelace" />
    <div>
      <div className="text-fg-0 text-[13px] font-bold">Ada Lovelace</div>
      <div className="text-fg-2 text-[13px]">
        Mathematician. Wrote the first published algorithm for a machine.
      </div>
    </div>
  </div>
);

const Trigger = () => (
  <HoverCardTrigger asChild>
    <a href="#ada" className="text-accent-strong text-[14px] underline underline-offset-2">
      Ada Lovelace
    </a>
  </HoverCardTrigger>
);

/**
 * Open by default: the snapshot must be deterministic, and a closed
 * card is simply absent from it.
 */
export const Playground: Story = {
  render: () => (
    <div className="flex h-[200px] items-start">
      <HoverCard defaultOpen>
        <Trigger />
        <HoverCardContent>
          <Preview />
        </HoverCardContent>
      </HoverCard>
    </div>
  ),
};

/**
 * Closed: hover over the link or move focus to it with the Tab key. The card
 * opens after 700 ms, and the pointer can move onto it: it will not close.
 */
export const HoverOrFocus: Story = {
  render: () => (
    <p className="text-fg-1 text-[14px]">
      The report was written by{" "}
      <HoverCard>
        <Trigger />
        <HoverCardContent>
          <Preview />
        </HoverCardContent>
      </HoverCard>{" "}
      and reviewed by the whole team.
    </p>
  ),
};

/** Delays are props: here the card opens at once and closes after a second. */
export const CustomDelays: Story = {
  render: () => (
    <HoverCard openDelay={0} closeDelay={1000}>
      <Trigger />
      <HoverCardContent side="bottom" align="center">
        <Preview />
      </HoverCardContent>
    </HoverCard>
  ),
};

function ControlledHost() {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col items-start gap-3">
      <HoverCard open={open} onOpenChange={setOpen}>
        <Trigger />
        <HoverCardContent>
          <Preview />
        </HoverCardContent>
      </HoverCard>
      <div className="text-fg-2 text-[13px]">Card is {open ? "open" : "closed"}</div>
    </div>
  );
}

/** Controlled mode: the state lives outside, while the component still computes the delays. */
export const Controlled: Story = {
  render: () => <ControlledHost />,
};
