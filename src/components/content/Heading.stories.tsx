import type { Meta, StoryObj } from "@storybook/react-vite";
import { Heading, type HeadingProps } from "./Heading.js";
import { Text } from "./Text.js";

const meta = {
  title: "Content/Heading",
  component: Heading,
  parameters: { layout: "padded" },
  args: { level: 2, children: "Publishing schedule" },
} satisfies Meta<HeadingProps>;

export default meta;
type Story = StoryObj<HeadingProps>;

export const Playground: Story = {};

/** The level sets both the tag and the font size. */
export const Levels: Story = {
  render: (args) => (
    <div className="flex flex-col gap-4">
      <Heading {...args} level={1}>
        Level 1 — page title
      </Heading>
      <Heading {...args} level={2}>
        Level 2 — section title
      </Heading>
      <Heading {...args} level={3}>
        Level 3 — subheading
      </Heading>
      <Heading {...args} level={4}>
        Level 4 — block label
      </Heading>
    </div>
  ),
};

/**
 * Level and size are decoupled: the order of headings in the document stays continuous,
 * and the font size is the one the screen needs.
 */
export const SizeApartFromLevel: Story = {
  render: (args) => (
    <div className="flex flex-col gap-4">
      <Heading {...args} level={2} size="2xl">
        h2 at page-title size
      </Heading>
      <Heading {...args} level={3} size="xl">
        h3 at section size
      </Heading>
      <Heading {...args} level={4} size="lg">
        h4 at subheading size
      </Heading>
    </div>
  ),
};

/**
 * A continuous ladder of levels is what the screen reader reads. The axe audit checks exactly
 * this story: it flags a jump from `h2` to `h4` as a violation.
 */
export const InDocument: Story = {
  render: () => (
    <article className="flex max-w-[520px] flex-col gap-3">
      <Heading level={1}>The “Night city” campaign</Heading>
      <Text level={2}>Twelve photos, published on weekdays at 09:00.</Text>
      <Heading level={2}>Schedule</Heading>
      <Text level={2}>The slots fill the next two weeks.</Text>
      <Heading level={3}>Exceptions</Heading>
      <Text level={2}>Weekends are skipped, holidays are not.</Text>
      <Heading level={4}>What counts as a holiday</Heading>
      <Text level={3} size="sm">
        The list comes from the channel settings.
      </Text>
    </article>
  ),
};

/**
 * Tabular numerals are on the same axis as `Text`. On the left the summary is recalculated and
 * changes width on every recalculation; on the right the number stays in place.
 */
export const Numerals: Story = {
  render: (args) => (
    <div className="flex gap-12">
      {([undefined, "tabular"] as const).map((numeric) => (
        <div key={numeric ?? "default"} className="flex flex-col items-start gap-1">
          <Text size="caption" level={3}>
            {numeric ?? "default"}
          </Text>
          {["1 180", "1 280", "8 111"].map((total) => (
            <span key={total} className="border-line border-r pr-2">
              <Heading {...args} level={2} numeric={numeric}>
                {total}
              </Heading>
            </span>
          ))}
        </div>
      ))}
    </div>
  ),
};
