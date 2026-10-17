import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactNode } from "react";
import { Grid, type GridGap, type GridProps } from "./Grid.js";

const meta = {
  title: "Content/Grid",
  component: Grid,
  parameters: { layout: "padded" },
  tags: ["periphery"],
} satisfies Meta<GridProps>;

export default meta;
type Story = StoryObj<GridProps>;

/** Placeholder cell: the column edges and the gap are visible, nothing domain-specific. */
function Tile({ children, as = "div" }: { children: ReactNode; as?: "div" | "li" }) {
  const Comp = as;
  return (
    <Comp className="border-line-soft bg-bg-2 text-fg-1 rounded-lg border px-4 py-6 text-sm">
      {children}
    </Comp>
  );
}

const tiles = (count: number, as?: "div" | "li") =>
  Array.from({ length: count }, (_, i) => (
    <Tile key={i} as={as}>
      Item {i + 1}
    </Tile>
  ));

/**
 * A column count as a single number is a responsive ladder: one on a phone, two from `sm`,
 * and the given number from `lg`. Narrow the window to see the transitions.
 */
export const Playground: Story = {
  args: { columns: 4, gap: "md" },
  render: (args: GridProps) => (
    <Grid {...args} data-testid="grid">
      {tiles(8)}
    </Grid>
  ),
};

/**
 * The exact column count from each breakpoint: 1 → 2 from `sm` → 3 from `md` → 6 from
 * `xl`. An unchanged count at any width is an object with a single `base` key.
 */
export const Breakpoints: Story = {
  render: () => (
    <div className="flex flex-col gap-8">
      <Grid columns={{ base: 1, sm: 2, md: 3, xl: 6 }} data-testid="responsive">
        {tiles(6)}
      </Grid>
      <Grid columns={{ base: 3 }} gap="sm" data-testid="fixed">
        {tiles(3)}
      </Grid>
    </div>
  ),
};

/**
 * A minimum cell width instead of a column count: the row fills itself. Empty tracks remain
 * (`auto-fill`), so three cells do not stretch across the full width, and they are the same
 * size as the cells of a full row.
 */
export const AutoFill: Story = {
  render: () => (
    <div className="flex flex-col gap-8">
      <Grid minItemWidth={200} data-testid="autofill">
        {tiles(10)}
      </Grid>
      <Grid minItemWidth={200} data-testid="autofill-short">
        {tiles(3)}
      </Grid>
    </div>
  ),
};

const GAPS: GridGap[] = ["none", "xs", "sm", "md", "lg", "xl"];

/** Gap is a step on the scale: none, 8, 12, 16, 24, or 32 pixels. */
export const Gaps: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      {GAPS.map((gap) => (
        <div key={gap} className="flex flex-col gap-2">
          <span className="text-fg-2 text-caption">gap=&quot;{gap}&quot;</span>
          <Grid columns={{ base: 4 }} gap={gap}>
            {tiles(4)}
          </Grid>
        </div>
      ))}
    </div>
  ),
};

/** A set that is itself a list: a screen reader announces it along with the item count. */
export const AsList: Story = {
  render: () => (
    <Grid as="ul" aria-label="Plans" columns={3}>
      {tiles(3, "li")}
    </Grid>
  ),
};
