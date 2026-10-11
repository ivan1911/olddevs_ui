import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { ProfileIcon, SettingsIcon, WarningIcon } from "../../icons.js";
import { Tabs, type TabsProps } from "./Tabs.js";

const meta = {
  title: "Navigation/Tabs",
  component: Tabs,
  parameters: { layout: "padded" },
  args: { onChange: () => {} },
} satisfies Meta<TabsProps>;

export default meta;
type Story = StoryObj<TabsProps>;

const ITEMS = [
  { id: "profile", label: "Profile", icon: <ProfileIcon size={15} /> },
  { id: "system", label: "System", icon: <SettingsIcon size={15} /> },
  { id: "danger", label: "Danger zone", icon: <WarningIcon size={15} /> },
];

export const Vertical: Story = {
  render: (args) => {
    const [tab, setTab] = useState("profile");
    return (
      <div className="flex gap-4">
        <Tabs
          {...args}
          orientation="vertical"
          items={ITEMS}
          value={tab}
          onChange={setTab}
          className="w-[200px]"
        />
        <div id={`${tab}-panel`} role="tabpanel" className="text-fg-2 text-[13px]">
          The “{ITEMS.find((t) => t.id === tab)?.label}” panel
        </div>
      </div>
    );
  },
};

export const Horizontal: Story = {
  render: (args) => {
    const [tab, setTab] = useState("profile");
    return (
      <div className="flex w-[320px] flex-col gap-3">
        <Tabs {...args} items={ITEMS} value={tab} onChange={setTab} />
        <div id={`${tab}-panel`} role="tabpanel" className="text-fg-2 text-[13px]">
          The “{ITEMS.find((t) => t.id === tab)?.label}” panel
        </div>
      </div>
    );
  },
};

export const WithoutIcons: Story = {
  render: (args) => {
    const [tab, setTab] = useState("profile");
    return (
      <div className="flex w-[320px] flex-col gap-3">
        <Tabs
          {...args}
          items={ITEMS.map(({ id, label }) => ({ id, label }))}
          value={tab}
          onChange={setTab}
        />
        {/* Панель обязательна: на неё ссылается `aria-controls` активной вкладки. */}
        <div id={`${tab}-panel`} role="tabpanel" className="text-fg-2 text-[13px]">
          The “{ITEMS.find((t) => t.id === tab)?.label}” panel
        </div>
      </div>
    );
  },
};
