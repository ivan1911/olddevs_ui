import type { Meta, StoryObj } from "@storybook/react-vite";
import { HelpTooltip } from "./HelpTooltip.js";

const meta = {
  title: "Overlays/HelpTooltip",
  component: HelpTooltip,
  parameters: { layout: "centered" },
  args: {
    label: "What the dashboard shows",
    title: "Dashboard overview",
    children: (
      <p className="text-fg-2 m-0 text-[13px] leading-relaxed">
        The cards at the top show the state of the library and the schedule over the last day. The
        numbers refresh once a minute.
      </p>
    ),
  },
} satisfies Meta<typeof HelpTooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Триггер в покое. Раскрывается по клику — поповер живёт в портале. */
export const Playground: Story = {};

/**
 * С подсказкой о горячей клавише. Комбинация приходит строкой целиком:
 * модификатор зависит от платформы, и знает о ней потребитель, а не пакет.
 */
export const WithShortcut: Story = {
  args: {
    shortcut: "⌘+Shift+D",
    shortcutLabel: "Open the section",
  },
};

/** Узкая подсказка без заголовка — только текст. */
export const WithoutTitle: Story = {
  args: {
    title: undefined,
    widthClassName: "w-[240px]",
    children: <p className="text-fg-2 m-0 text-[13px]">Only unpublished photos are shown.</p>,
  },
};
