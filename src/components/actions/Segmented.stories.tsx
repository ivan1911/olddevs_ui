import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Segmented } from "./Segmented.js";
import { TooltipProvider } from "../overlays/Tooltip.js";

const meta = {
  title: "Actions/Segmented",
  component: Segmented,
  parameters: { layout: "centered" },
  decorators: [
    (Story) => (
      <TooltipProvider delayDuration={0}>
        <Story />
      </TooltipProvider>
    ),
  ],
  args: {
    value: "exact",
    onChange: () => {},
    options: [
      { value: "exact", label: "Exact" },
      { value: "semantic", label: "Semantic" },
    ],
  },
} satisfies Meta<typeof Segmented>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A live switch: the state is real, not drawn. */
export const Playground: Story = {
  render: (args) => {
    const [value, setValue] = useState(args.value);
    return <Segmented {...args} value={value} onChange={setValue} />;
  },
};

/**
 * An unavailable segment. The mode exists, but it can't be applied right now, for example
 * semantic search while embeddings are turned off. Such a segment must not be removed from
 * the set: a vanished mode looks like a bug, while a dimmed one honestly says it is there,
 * just not right now.
 */
export const Disabled: Story = {
  args: {
    options: [
      { value: "exact", label: "Exact" },
      { value: "semantic", label: "Semantic", disabled: true },
    ],
  },
};

/**
 * Content matrix: labels, icons with tooltips, a mixed set, and one row for each selected
 * segment, so you can see the selection move rather than being painted on the first one.
 */
export const Matrix: Story = {
  parameters: { layout: "padded" },
  render: () => (
    <table className="border-separate border-spacing-3">
      <tbody>
        {(
          [
            [
              "labels",
              [
                { value: "exact", label: "Exact" },
                { value: "semantic", label: "Semantic" },
              ],
            ],
            [
              "icons only",
              [
                { value: "phone", icon: <span aria-hidden>▯</span>, tooltip: "Phone" },
                { value: "desktop", icon: <span aria-hidden>▭</span>, tooltip: "Desktop" },
              ],
            ],
            [
              "icon with a label",
              [
                { value: "grid", icon: <span aria-hidden>▦</span>, label: "Grid" },
                { value: "list", icon: <span aria-hidden>▤</span>, label: "List" },
              ],
            ],
          ] as const
        ).flatMap(([label, options]) =>
          options.map((opt, i) => (
            <tr key={`${label}-${i}`}>
              <td className="text-fg-2 pr-2 text-right align-middle font-mono text-xs">
                {i === 0 ? label : ""}
              </td>
              <td>
                <Segmented value={opt.value} onChange={() => {}} options={[...options]} />
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  ),
};

/**
 * Five segments in a column the width of a phone. Segments do not shrink, so the extra ones
 * wrap onto a second row. Without that, the only outcome would be horizontal scrolling,
 * which violates WCAG 1.4.10.
 *
 * The frame around it is not part of the control but a measurement: it shows the boundary
 * of the available width that the switch must not exceed.
 */
export const Wrapping: Story = {
  parameters: { layout: "padded" },
  render: () => (
    <div className="border-line-soft w-[359px] border border-dashed p-2">
      <Segmented
        value="available"
        onChange={() => {}}
        options={[
          { value: "active", icon: <span aria-hidden>▤</span>, label: "Active" },
          { value: "deferred", icon: <span aria-hidden>▷</span>, label: "Deferred" },
          { value: "done", icon: <span aria-hidden>▪</span>, label: "Done" },
          { value: "dropped", icon: <span aria-hidden>▫</span>, label: "Dropped" },
          { value: "available", icon: <span aria-hidden>◎</span>, label: "Available now" },
        ]}
      />
    </div>
  ),
};

/**
 * The "icons only on a narrow screen" mode (`mobileIconOnly`).
 *
 * NARROW THE WINDOW TO 640 PIXELS. Otherwise both switches look the same. That is not a
 * defect of the story but the point of the mode: the threshold is taken from the SCREEN
 * WIDTH, not from the width of the parent. The 359-pixel frame around is a measurement of
 * the available width; it does not affect the breakpoint, because the media query knows
 * nothing about it.
 *
 * On a wide screen the right one must be exactly the same as the left one, with labels in
 * place. On a narrow screen the left one keeps three rows, and the right one has one.
 */
export const MobileIconOnly: Story = {
  parameters: { layout: "padded" },
  render: () => {
    const options = [
      { value: "active", icon: <span aria-hidden>▤</span>, label: "Active" },
      { value: "deferred", icon: <span aria-hidden>▷</span>, label: "Deferred" },
      { value: "done", icon: <span aria-hidden>▪</span>, label: "Done" },
      { value: "dropped", icon: <span aria-hidden>▫</span>, label: "Dropped" },
      { value: "available", icon: <span aria-hidden>◎</span>, label: "Available now" },
    ];
    return (
      // Stacked in a column, not side by side: on a phone two 359-pixel frames
      // would not fit next to each other and would shrink, leaving nothing to compare.
      <div className="flex flex-col items-start gap-6">
        <div className="border-line-soft w-[359px] max-w-full border border-dashed p-2">
          {/* As before: labels are always visible. */}
          <Segmented value="available" onChange={() => {}} options={options} />
        </div>
        <div className="border-line-soft w-[359px] max-w-full border border-dashed p-2">
          <Segmented value="available" onChange={() => {}} options={options} mobileIconOnly />
        </div>
      </div>
    );
  },
};
