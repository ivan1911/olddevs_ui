import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "../actions/Button.js";
import { ChatMessage } from "./ChatMessage.js";

const meta = {
  title: "Content/ChatMessage",
  component: ChatMessage,
  parameters: { layout: "padded" },
} satisfies Meta<typeof ChatMessage>;
export default meta;
type Story = StoryObj<typeof ChatMessage>;
export const MessageStates: Story = {
  render: () => (
    <div className="flex max-w-xl flex-col gap-3">
      <ChatMessage author="You" speaker="user" timestamp="16:54" inputMethod="text">
        How should I start?
      </ChatMessage>
      <ChatMessage
        author="Assistant"
        speaker="assistant"
        timestamp="16:50"
        inputMethod="voice"
        state="interrupted"
        actions={
          <Button size="sm" onClick={() => {}}>
            Consumer action
          </Button>
        }
      >
        Keep the received part of this answer.
      </ChatMessage>
      <ChatMessage author="You" speaker="user" inputMethod="voice" state="provisional">
        An unfinished transcription…
      </ChatMessage>
      <ChatMessage author="Assistant" speaker="assistant" state="streaming">
        The next step is…
      </ChatMessage>
    </div>
  ),
};
