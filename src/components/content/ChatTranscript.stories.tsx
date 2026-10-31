import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "../actions/Button.js";
import { ChatMessage } from "./ChatMessage.js";
import { ChatTranscript } from "./ChatTranscript.js";

const meta = {
  title: "Content/ChatTranscript",
  component: ChatTranscript,
  parameters: { layout: "padded" },
} satisfies Meta<typeof ChatTranscript>;
export default meta;
type Story = StoryObj<typeof ChatTranscript>;
function ReadingExample() {
  const [growth, setGrowth] = useState(0);
  const [compact, setCompact] = useState(false);
  return (
    <div className="flex max-w-xl flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setGrowth((value) => value + 1)}>Grow answer</Button>
        <Button onClick={() => setCompact((value) => !value)}>Resize viewport</Button>
      </div>
      <ChatTranscript label="Conversation" className={compact ? "h-[240px]" : "h-[360px]"}>
        {Array.from({ length: 20 }, (_, index) => (
          <ChatMessage
            key={index}
            author={index % 2 ? "Assistant" : "You"}
            speaker={index % 2 ? "assistant" : "user"}
          >
            <p>{`Message ${index + 1}: ${"A readable paragraph in the conversation. ".repeat(4)}`}</p>
            <details>
              <summary className="mt-2 cursor-pointer">Details for message {index + 1}</summary>
              <p>{"Expanded details. ".repeat(30)}</p>
            </details>
            {index === 19 && <p>{"The answer grows while you read. ".repeat(growth * 10)}</p>}
          </ChatMessage>
        ))}
      </ChatTranscript>
    </div>
  );
}
export const ReadingHistory: Story = { render: () => <ReadingExample /> };
