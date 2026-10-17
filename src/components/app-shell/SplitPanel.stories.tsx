import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { useMediaQuery } from "../../hooks/useMediaQuery.js";
import { Button } from "../actions/Button.js";
import { SplitPanel } from "./SplitPanel.js";

const ORDERS = ["#4821", "#4820", "#4816", "#4809", "#4802"];

function List() {
  return (
    <ul className="text-fg-1 flex flex-col gap-1 p-3 text-[13px]">
      {ORDERS.map((id) => (
        <li key={id} className="rounded-md px-2 py-1.5">
          Order {id}
        </li>
      ))}
    </ul>
  );
}

function Details() {
  return (
    <div className="text-[13px]">
      {/*
        The heading sits OUTSIDE the `dl`: a definition list allows only `dt`/`dd` pairs
        and wrappers around them as direct children, and a `div` with a single text node
        failed the axe `definition-list` audit.
      */}
      <div className="text-fg-0 mb-3 font-semibold">Order #4821</div>
      <dl>
        {[
          ["Customer", "Veter LLC"],
          ["Total", "148 200 ₽"],
          ["Status", "In assembly"],
        ].map(([key, value]) => (
          <div key={key} className="flex justify-between py-1">
            <dt className="text-fg-2">{key}</dt>
            <dd className="text-fg-0">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

const meta = {
  title: "App shell/SplitPanel",
  component: SplitPanel,
  parameters: { layout: "padded" },
  args: {
    "aria-label": "Order details",
    children: <List />,
    panel: <div className="p-4">{<Details />}</div>,
  },
  decorators: [
    (Story) => (
      <div className="border-line bg-bg-0 h-[260px] overflow-hidden rounded-lg border">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SplitPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A side panel: the width is stretched, and the handle is vertical. */
export const Side: Story = {
  args: { position: "side", defaultSize: 260 },
};

/**
 * A bottom panel: the height is stretched, and the handle is horizontal. It is the same
 * component; the only difference is the layout axis.
 */
export const Bottom: Story = {
  args: { position: "bottom", defaultSize: 170, minSize: 80, maxSize: 200 },
};

/**
 * A collapsed panel. The content stays in the DOM, so form state inside it survives
 * the collapse, but it leaves the accessibility tree. A panel that Tab can reach and
 * that is not visible would send focus nowhere. The handle disappears with it: there is
 * nothing to drag.
 */
export const Collapsed: Story = {
  args: { position: "side", collapsed: true },
};

/**
 * Narrow screen: the panel collapses below `lg`, leaving one area. The component has no
 * built-in adaptive mode. The width is queried by `useMediaQuery`, and the existing
 * `collapsed` prop does the collapsing. Until hydration the hook reports "narrow", so the
 * first frame on the server is a single area.
 */
export const Adaptive: Story = {
  render: (args) => {
    const wide = useMediaQuery("(min-width: 1024px)");
    return (
      <SplitPanel
        {...args}
        collapsed={!wide}
        panel={
          <div className="p-3" data-testid="adaptive-panel">
            <Details />
          </div>
        }
      >
        <List />
      </SplitPanel>
    );
  },
  args: { position: "side", defaultSize: 260, "aria-label": "Order details" },
};

/**
 * Controlled size. The kit provides the shape, and the consumer holds the state: the same
 * split as with the table state. In the consumer's app the size usually already lives in the
 * page URL, and a second store inside the kit would silently drift apart from the first.
 */
export const Controlled: Story = {
  render: (args) => {
    const [size, setSize] = useState(220);
    return (
      <div className="flex h-full flex-col">
        <div className="border-line flex items-center gap-3 border-b p-2">
          <span className="text-fg-1 text-xs">Size: {size} px</span>
          <Button size="sm" variant="outline" onClick={() => setSize(220)}>
            Reset
          </Button>
          <Button size="sm" variant="outline" onClick={() => setSize(420)}>
            Widen
          </Button>
        </div>
        <div className="min-h-0 flex-1">
          <SplitPanel {...args} size={size} onSizeChange={setSize} maxSize={460} />
        </div>
      </div>
    );
  },
};

/**
 * Collapsing is driven by external state, NOT by a click.
 *
 * A click on the button moves focus onto it by itself, so there is nothing to hand off.
 * Collapsing also happens without a click, from a hotkey, a server response, or a layout
 * change. That is exactly when focus that was inside the panel gets lost.
 */
export const CollapseFromOutside: Story = {
  render: (args) => {
    const [collapsed, setCollapsed] = useState(false);
    return (
      <div className="flex h-full flex-col">
        <div className="border-line flex items-center gap-3 border-b p-2">
          <span className="text-fg-1 text-xs" data-testid="state">
            {collapsed ? "collapsed" : "open"}
          </span>
        </div>
        <div className="min-h-0 flex-1">
          <SplitPanel
            {...args}
            collapsed={collapsed}
            panel={
              <div className="p-3">
                <input aria-label="Note" data-testid="note" className="border-line border" />
                <button
                  type="button"
                  data-testid="collapse-later"
                  onClick={() => setTimeout(() => setCollapsed(true), 50)}
                >
                  Collapse in 50ms
                </button>
              </div>
            }
          />
        </div>
      </div>
    );
  },
};
