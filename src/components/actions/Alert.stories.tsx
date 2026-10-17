import type { Meta, StoryObj } from "@storybook/react-vite";
import { Alert } from "./Alert.js";
import { Button } from "./Button.js";
import { TONE_TOKENS, type Tone } from "../../lib/variants.js";

const meta = {
  title: "Actions/Alert",
  component: Alert,
  parameters: { layout: "padded" },
  args: { children: "Channel not connected — nothing will be published." },
} satisfies Meta<typeof Alert>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  args: { tone: "warning", title: "Channel not connected" },
  render: (args) => (
    <div className="max-w-[520px]">
      <Alert {...args} />
    </div>
  ),
};

/** With an action and a close button. Both are nodes, not callbacks with a label. */
export const WithAction: Story = {
  render: () => (
    <div className="max-w-[520px]">
      <Alert
        tone="warning"
        title="Channel not connected"
        action={
          <Button size="sm" variant="solid" tone="warning">
            Connect
          </Button>
        }
        onDismiss={() => {}}
      >
        Nothing will be published until the channel is connected.
      </Alert>
    </div>
  ),
};

/**
 * Tone × variant matrix.
 *
 * `solid` and `ghost` are missing from the matrix on purpose: the type excludes
 * them. A solid fill across the full width of the block is a bar that overpowers
 * the content; `ghost` without a border or background stops reading as a message.
 */
export const Matrix: Story = {
  render: () => (
    <div className="flex max-w-[520px] flex-col gap-3">
      {(Object.keys(TONE_TOKENS) as Tone[]).map((tone) => (
        <div key={tone} className="flex flex-col gap-2">
          <Alert tone={tone} variant="soft" title={`${tone} / soft`}>
            A one-line message.
          </Alert>
          <Alert tone={tone} variant="outline" title={`${tone} / outline`} onDismiss={() => {}}>
            A one-line message.
          </Alert>
        </div>
      ))}
    </div>
  ),
};

/** Without a title, a short message on one line. */
export const WithoutTitle: Story = {
  render: () => (
    <div className="max-w-[520px]">
      <Alert tone="success">Settings saved.</Alert>
    </div>
  ),
};
