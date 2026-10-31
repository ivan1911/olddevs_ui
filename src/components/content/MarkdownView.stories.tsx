import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button, ChatMessage, ChatTranscript } from "../../index.js";
import { MarkdownView } from "../../markdown.js";

const SUPPORTED = `A **readable answer** with *emphasis*, [a safe link](https://example.com) and \`inline code\`.

- First item
- Second item

1. Ordered item
2. Another item

> A quotation keeps its own visual boundary.

| Name | Value |
| --- | --- |
| Status | Ready |
| Count | 2 |

\`\`\`typescript
const message = "raw source";

\`\`\``;

const FRAMES = [
  "An **unfinished",
  "Read [the docs",
  "Read [the docs](https://exam",
  "| Name | Value |\n| --",
  "| Name | Value |\n| --- | --- |\n| A |",
  "```js\nconst value = 1",
  "```js\nconst value = 12;\n\n```",
];

const meta = {
  title: "Content/MarkdownView",
  component: MarkdownView,
  parameters: { layout: "padded" },
  args: { content: SUPPORTED },
  decorators: [
    (Story) => (
      <div className="max-w-2xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof MarkdownView>;
export default meta;
type Story = StoryObj<typeof meta>;

export const SupportedContent: Story = {};

export const StreamingFragments: Story = {
  render: function StreamingExample() {
    const [frame, setFrame] = useState(0);
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button onClick={() => setFrame((value) => (value + 1) % FRAMES.length)}>
            Next fragment
          </Button>
          <span className="text-fg-2 text-sm">
            Fragment {frame + 1} of {FRAMES.length}
          </span>
        </div>
        <MarkdownView content={FRAMES[frame]!} streaming />
      </div>
    );
  },
};

export const UnsupportedContent: Story = {
  args: {
    content: `<script>alert("ignored")</script>

<img src="https://image.example/raw.png" onerror="alert(1)">

[Unsafe link](javascript:alert%281%29) and [scheme-relative link](//evil.example).

![A remote chart](https://image.example/chart.png)

$x^2$ and $$x=1$$ remain text.

\`\`\`mermaid
graph TD; A-->B
\`\`\``,
  },
};

export const CustomHighlight: Story = {
  args: {
    content: "```txt\n  <b>& hello</b>\n\n\n```",
    renderCode: (code) => <span className="text-accent-strong">{code}</span>,
  },
};

export const InChat: Story = {
  render: () => (
    <ChatTranscript label="Conversation" className="h-[32rem]">
      <ChatMessage author="You" speaker="user" inputMethod="text">
        Show the response format.
      </ChatMessage>
      <ChatMessage author="Assistant" speaker="assistant" inputMethod="text">
        <MarkdownView content={SUPPORTED} />
      </ChatMessage>
    </ChatTranscript>
  ),
};

/** A narrow reader can scroll wide tables and long code without moving the whole page. */
export const WideContent: Story = {
  tags: ["viewport-phone"],
  args: {
    content: `| ${Array.from({ length: 20 }, (_, index) => `Column ${index + 1}`).join(" | ")} |\n| ${Array.from({ length: 20 }, () => "---").join(" | ")} |\n| ${Array.from({ length: 20 }, () => "Value").join(" | ")} |\n\n\`\`\`text\n${"a-long-code-line-".repeat(30)}\n\`\`\``,
  },
};
