import type { Meta, StoryObj } from "@storybook/react-vite";
import { Accordion, AccordionItem } from "./Accordion.js";

/** Волна 9: примитивы навигации по облегчённой планке. */
const meta = {
  title: "Navigation/Accordion",
  component: Accordion,
  parameters: { layout: "padded" },
  tags: ["periphery"],
} satisfies Meta<typeof Accordion>;

export default meta;
type Story = StoryObj;

export const AccordionSingle: Story = {
  render: () => (
    <div className="w-[480px]">
      <Accordion defaultExpandedKeys={["schedule"]}>
        <AccordionItem id="schedule" title="Schedule">
          Publishing runs on weekdays at 09:00 and 18:00.
        </AccordionItem>
        <AccordionItem id="filters" title="Filters">
          Drafts and the archive do not reach the feed.
        </AccordionItem>
        <AccordionItem id="off" title="Unavailable" disabled>
          The section is disabled.
        </AccordionItem>
      </Accordion>
    </div>
  ),
};

export const AccordionMultiple: Story = {
  render: () => (
    <div className="w-[480px]">
      <Accordion multiple defaultExpandedKeys={["a", "b"]}>
        <AccordionItem id="a" title="First">
          Both are open — that is how section contents are compared.
        </AccordionItem>
        <AccordionItem id="b" title="Second">
          The default is different: usually one is open.
        </AccordionItem>
      </Accordion>
    </div>
  ),
};
