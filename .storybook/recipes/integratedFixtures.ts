import type { DemoMessage } from "./useChatDemo.js";
import type { DemoOperation, DemoSource } from "./ToolsSourcesPresentation.js";

export const SHRINK_LINK_FRAGMENT = `[Short link](https://example.com/${"segment/".repeat(150)}`;

export const MARKDOWN_FRAGMENTS = [
  "A **small",
  " plan** starts with [one step](https://example.com/guide).\n\n| Step | Result |\n| --- | --- |\n| Read | Context |\n\n```ts\n  const plan = 'one step';\n",
  "\n  // Keep the original whitespace.\n```\n\n> Review, then continue.\n\n- One goal\n- One next step\n",
];
export const OPERATIONS: DemoOperation[] = [
  {
    id: "guidance",
    summary: "Search guidance",
    state: "waiting",
    details: "Look for a short guide to weekly planning.",
  },
  {
    id: "availability",
    summary: "Check availability",
    state: "waiting",
    details: "Check whether the reference service is available.",
  },
];
export const SOURCES: DemoSource[] = [
  {
    id: "planning-guide",
    title: "Planning guide",
    href: "https://example.com/planning",
    snippet: "Review your goals and select one achievable next step.",
  },
];
/** Cyrillic is deliberate consumer input data for wrapping and narrow-screen checks. */
export const RUSSIAN_TEXT =
  "Давайте составим подробный план поездки: сначала проверим доступность, затем сравним несколько вариантов и сохраним следующий шаг. ";
export const RUSSIAN_TOKEN = "ДлинноеСловоБезПробеловДляПроверкиПереноса".repeat(8);
const EPOCH = Date.parse("2026-10-31T13:00:00Z");
export function historyFixture(count = 20, mixed = false): DemoMessage[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `history-${index}`,
    speaker: index % 2 ? "assistant" : "user",
    authorId: index % 2 ? "demo-assistant" : "demo-user",
    createdAt: EPOCH + index * 60000,
    timestamp: new Date(EPOCH + index * 60000).toISOString().slice(11, 16),
    state: "complete",
    text:
      mixed && index % 2
        ? `Reply ${index}\n\n**One goal**, one step.\n\n| Step | Result |\n| --- | --- |\n| Read | Context |\n\n\`\`\`ts\n  const step = ${index};\n\`\`\`\n\n` +
          "Plan the next useful step. ".repeat(8)
        : `Message ${index}. ` + "A small plan keeps the next useful step clear. ".repeat(7),
  }));
}
export function groupFixture(): DemoMessage[] {
  return [0, 0, 300000, 600001, 600000, 600000, NaN].map((offset, index) => ({
    id: `group-${index}`,
    speaker: "assistant",
    authorId: index === 5 ? "another-assistant" : "demo-assistant",
    createdAt: EPOCH + offset,
    timestamp: `Group ${index + 1}`,
    text: `Boundary ${index + 1}`,
    state: "complete",
  }));
}
export type IntegratedScenario = "empty" | "reading" | "narrow" | "groups";
export function scenarioMessages(scenario: IntegratedScenario): DemoMessage[] {
  if (scenario === "reading") return historyFixture();
  if (scenario === "groups") return groupFixture();
  if (scenario === "narrow")
    return [
      {
        id: "russian-user",
        speaker: "user",
        authorId: "demo-user",
        createdAt: EPOCH,
        timestamp: "16:00",
        text: RUSSIAN_TEXT.repeat(3),
        state: "complete",
      },
      {
        id: "russian-answer",
        speaker: "assistant",
        authorId: "demo-assistant",
        createdAt: EPOCH + 1000,
        timestamp: "16:00",
        text: RUSSIAN_TEXT.repeat(4) + RUSSIAN_TOKEN + "\n\n" + MARKDOWN_FRAGMENTS.join(""),
        state: "complete",
      },
    ];
  return [];
}
