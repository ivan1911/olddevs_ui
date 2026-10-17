import type { Meta, StoryObj } from "@storybook/react-vite";
import { Card } from "./Card.js";
import { Stat } from "./Stat.js";

/** Wave 10: data. A lighter bar, no snapshots. */
const meta = {
  title: "Content/Stat",
  component: Stat,
  parameters: { layout: "padded" },
  tags: ["periphery"],
} satisfies Meta<typeof Stat>;

export default meta;
type Story = StoryObj;

export const Stats: Story = {
  render: () => (
    <div className="grid grid-cols-3 gap-3">
      <Card>
        <Stat
          label="Subscribers"
          value="12 480"
          delta="+320"
          deltaTone="success"
          hint="this week"
        />
      </Card>
      <Card>
        <Stat
          label="Unsubscribes"
          value="184"
          delta="+12"
          deltaTone="danger"
          hint="growth is bad news"
        />
      </Card>
      <Card>
        <Stat label="Posts" value="36" delta="−2" hint="no judgement" />
      </Card>
    </div>
  ),
};
