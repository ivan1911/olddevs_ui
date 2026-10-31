import type { Meta, StoryObj } from "@storybook/react-vite";
import { BubbleExample, type BubbleMessage } from "../../../.storybook/recipes/BubbleExample.js";
import { MarkdownView } from "../../markdown.js";

const BASE = Date.parse("2026-10-31T12:00:00Z");
const single: BubbleMessage[] = [
  {
    id: "user",
    authorId: "you",
    author: "You",
    speaker: "user",
    createdAt: BASE,
    displayTime: "12:00",
    text: "Yes.",
  },
  {
    id: "assistant",
    authorId: "assistant",
    author: "Assistant",
    speaker: "assistant",
    createdAt: BASE + 1000,
    displayTime: "12:00",
    text: "Ready.",
    actionLabel: "Copy this answer",
  },
];
const grouped: BubbleMessage[] = [
  ...["First short question.", "A little more context for the same question.", "That is all."].map(
    (text, index) => ({
      id: `user-${index}`,
      authorId: "you",
      author: "You",
      speaker: "user" as const,
      createdAt: BASE + index * 60000,
      displayTime: `12:0${index}`,
      text,
    })
  ),
  ...["First step.", "The same author can add another step without another tail.", "Finished."].map(
    (text, index) => ({
      id: `assistant-${index}`,
      authorId: "assistant",
      author: "Assistant",
      speaker: "assistant" as const,
      createdAt: BASE + index * 60000,
      displayTime: `12:0${index}`,
      text,
    })
  ),
];

const meta = {
  title: "Content/ChatMessage/Bubbles",
  component: BubbleExample,
  parameters: { layout: "padded" },
  args: { messages: single },
} satisfies Meta<typeof BubbleExample>;
export default meta;
type Story = StoryObj<typeof meta>;

export const SingleBubbles: Story = {};
export const GroupedBubbles: Story = { args: { messages: grouped } };

const cases = [
  { label: "Exactly five minutes joins", first: BASE, second: BASE + 300000 },
  { label: "Five minutes plus one millisecond breaks", first: BASE, second: BASE + 300001 },
  { label: "Unknown time breaks", first: undefined, second: BASE },
  { label: "Invalid time breaks", first: NaN, second: BASE },
  { label: "Backward time breaks", first: BASE + 1000, second: BASE },
  { label: "Different author identity breaks", first: BASE, second: BASE + 1000, different: true },
];
export const TimeBoundaries: Story = {
  args: {
    messages: cases.flatMap((item, index) => [
      {
        id: `${index}-a`,
        authorId: `author-${index}`,
        author: "Assistant",
        speaker: "assistant" as const,
        createdAt: item.first,
        displayTime: "12:00",
        text: `${item.label}: first.`,
      },
      {
        id: `${index}-b`,
        authorId: item.different ? "another-author" : `author-${index}`,
        author: "Assistant",
        speaker: "assistant" as const,
        createdAt: item.second,
        displayTime: "12:00",
        text: `${item.label}: second.`,
      },
    ]),
  },
};

const wideTable = `| ${Array.from({ length: 12 }, (_, index) => `Column ${index + 1}`).join(" | ")} |\n| ${Array.from({ length: 12 }, () => "---").join(" | ")} |\n| ${Array.from({ length: 12 }, () => "Value").join(" | ")} |\n\n\`\`\`text\n${"long-code-".repeat(35)}\n\`\`\``;
export const NarrowContent: Story = {
  tags: ["viewport-phone"],
  args: {
    messages: [
      { ...single[0]!, text: "unbroken-".repeat(80) },
      { ...single[1]!, text: "Markdown answer", body: <MarkdownView content={wideTable} /> },
    ],
  },
};

export const RadiusPresets: Story = {
  render: () => (
    <div className="max-w-3xl space-y-6">
      {["none", "small", "medium", "large"].map((radius) => (
        <section key={radius} data-radius={radius} aria-label={`${radius} radius`}>
          <h2 className="text-fg-0 mb-2 font-semibold">{radius} radius</h2>
          <BubbleExample messages={single} />
        </section>
      ))}
    </div>
  ),
};
