import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import type { Key, Selection } from "react-aria-components";
import { FolderIcon, ImageIcon } from "../../icons.js";
import { TreeView, type TreeNode, type TreeViewProps } from "./TreeView.js";

const meta = {
  title: "Navigation/TreeView",
  component: TreeView,
  parameters: { layout: "padded" },
  tags: ["periphery"],
} satisfies Meta<TreeViewProps>;

export default meta;
type Story = StoryObj<TreeViewProps>;

const CATEGORIES: TreeNode[] = [
  {
    id: "nature",
    label: "Nature",
    icon: <FolderIcon size={14} />,
    children: [
      { id: "forest", label: "Forest", icon: <ImageIcon size={14} /> },
      {
        id: "sea",
        label: "Sea",
        icon: <FolderIcon size={14} />,
        children: [
          { id: "sunset", label: "Sunset", icon: <ImageIcon size={14} /> },
          { id: "storm", label: "Storm", icon: <ImageIcon size={14} /> },
        ],
      },
    ],
  },
  {
    id: "city",
    label: "City",
    icon: <FolderIcon size={14} />,
    children: [
      { id: "night", label: "Night city", icon: <ImageIcon size={14} /> },
      { id: "arch", label: "Architecture", icon: <ImageIcon size={14} />, disabled: true },
    ],
  },
];

export const Playground: Story = {
  render: function Render() {
    const [expanded, setExpanded] = useState<Set<Key>>(new Set(["nature"]));
    return (
      <div className="w-[320px]">
        <TreeView
          items={CATEGORIES}
          aria-label="Categories"
          expandedKeys={expanded}
          onExpandedChange={setExpanded}
        />
      </div>
    );
  },
};

/** Selection: the axis is turned on by `selectionMode`, and the state lives outside. */
export const WithSelection: Story = {
  render: function Render() {
    const [expanded, setExpanded] = useState<Set<Key>>(new Set(["nature", "sea"]));
    const [selected, setSelected] = useState<Selection>(new Set(["forest"]));
    return (
      <div className="w-[320px]">
        <TreeView
          items={CATEGORIES}
          aria-label="Categories"
          expandedKeys={expanded}
          onExpandedChange={setExpanded}
          selectionMode="multiple"
          selectedKeys={selected}
          onSelectionChange={setSelected}
        />
      </div>
    );
  },
};

/** Without the selection props there are no checkboxes at all: the user simply moves across the nodes. */
export const WithoutSelection: Story = {
  render: () => (
    <div className="w-[320px]">
      <TreeView items={CATEGORIES} aria-label="Categories" defaultExpandedKeys={["city"]} />
    </div>
  ),
};

/**
 * Navigation: the current article is marked with `activeKey` (`aria-current="page"`), without
 * checkboxes. A leaf opens with `onAction`; a folder is expanded by its chevron or the Right Arrow
 * key, so expanding on a row click also goes through `onAction`.
 */
export const CurrentNode: Story = {
  render: function Render() {
    const [expanded, setExpanded] = useState<Set<Key>>(new Set(["nature", "sea"]));
    const [current, setCurrent] = useState<Key>("sunset");
    const folders = new Set<Key>(["nature", "sea", "city"]);
    return (
      <div className="w-[320px]">
        <TreeView
          items={CATEGORIES}
          aria-label="Articles"
          expandedKeys={expanded}
          onExpandedChange={setExpanded}
          activeKey={current}
          onAction={(id) => {
            if (!folders.has(id)) {
              setCurrent(id);
              return;
            }
            const next = new Set(expanded);
            if (!next.delete(id)) next.add(id);
            setExpanded(next);
          }}
        />
      </div>
    );
  },
};

export const Empty: Story = {
  render: () => (
    <div className="w-[320px]">
      <TreeView items={[]} aria-label="Categories" emptyText="No categories" />
    </div>
  ),
};
