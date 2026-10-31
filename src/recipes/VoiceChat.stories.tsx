import type { Meta, StoryObj } from "@storybook/react-vite";
import { VoiceChatDemo } from "../../.storybook/recipes/VoiceChatDemo.js";

const meta = {
  title: "Recipes/VoiceChat",
  component: VoiceChatDemo,
  parameters: { layout: "padded" },
  argTypes: {
    visualizer: { control: false },
    initialMessages: { control: false },
    initialConnection: { control: false },
    initialAgent: { control: false },
    initialMuted: { control: false },
    initialExpanded: { control: false },
  },
} satisfies Meta<typeof VoiceChatDemo>;
export default meta;
type Story = StoryObj<typeof meta>;
const visualizer = (
  <div
    role="img"
    aria-label="Static consumer visualizer"
    className="text-fg-2 flex items-center gap-2 rounded-md p-2 text-xs"
  >
    <svg
      width="60"
      height="28"
      viewBox="0 0 60 28"
      aria-hidden="true"
      className="text-accent-strong shrink-0"
    >
      <path
        d="M4 11v6M16 5v18M28 9v10M40 2v24M52 7v14"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
      />
    </svg>
    Consumer-provided static visualization
  </div>
);
export const Playground: Story = {};
export const Connected: Story = {
  args: { assistantName: "Atlas", initialConnection: "ready", initialExpanded: true, visualizer },
};
export const Muted: Story = { args: { initialConnection: "ready", initialMuted: true } };
export const ConnectionError: Story = { args: { initialConnection: "error" } };
