import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import type { Key } from "react-aria-components";
import {
  AddIcon,
  CopyIcon,
  DeleteIcon,
  DownloadIcon,
  EditIcon,
  MoreIcon,
  SearchIcon,
} from "../../icons.js";
import { Button } from "./Button.js";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "../overlays/ContextMenu.js";
import { Menu, MenuButton, MenuItem, MenuTrigger } from "../overlays/Menu.js";
import { Popover, PopoverContent, PopoverTrigger } from "../overlays/Popover.js";
import { Separator } from "../content/Separator.js";
import { SplitButton } from "./SplitButton.js";
import { Toggle } from "./Toggle.js";
import { ToggleGroup } from "./ToggleGroup.js";
import { Toolbar, type ToolbarProps } from "./Toolbar.js";

const meta = {
  title: "Actions/Toolbar",
  component: Toolbar,
  parameters: { layout: "padded" },
  tags: ["periphery"],
} satisfies Meta<ToolbarProps>;

export default meta;
type Story = StoryObj<ToolbarProps>;

/** Text formatting: a set of toggles that are independent of each other. */
const FORMAT_OPTIONS = [
  { id: "bold", label: "B", "aria-label": "Bold" },
  { id: "italic", label: "I", "aria-label": "Italic" },
  { id: "underline", label: "U", "aria-label": "Underline" },
];

function Actions() {
  const [format, setFormat] = useState<Key[]>(["bold"]);
  const [wrap, setWrap] = useState(false);
  return (
    <>
      <ToggleGroup
        aria-label="Format"
        options={FORMAT_OPTIONS}
        value={format}
        onChange={setFormat}
        size="sm"
      />
      <Separator />
      <Button size="sm" variant="ghost" icon={<CopyIcon aria-hidden />}>
        Copy
      </Button>
      <Button size="sm" variant="ghost" icon={<EditIcon aria-hidden />}>
        Rename
      </Button>
      <Separator />
      <Toggle label="Wrap lines" checked={wrap} onCheckedChange={setWrap} />
      <Separator />
      <SplitButton label="Export" size="sm" icon={<DownloadIcon aria-hidden />}>
        <MenuItem>Export to PDF</MenuItem>
        <MenuItem>Export to PNG</MenuItem>
      </SplitButton>
    </>
  );
}

/**
 * One tab stop for the whole toolbar: Tab enters and leaves, arrow keys move between the
 * items, `Home` and `End` go to the edges, and returning lands on the last used action.
 * The separator between groups turned vertical on its own.
 */
export const Playground: Story = {
  args: { "aria-label": "Document tools" },
  render: (args: ToolbarProps) => (
    <div className="flex flex-col gap-3">
      <Button size="sm" variant="outline">
        Before the toolbar
      </Button>
      <Toolbar {...args}>
        <Actions />
      </Toolbar>
      <Button size="sm" variant="outline">
        After the toolbar
      </Button>
    </div>
  ),
};

/** A vertical toolbar at the edge of the canvas: arrows up and down, the divider is horizontal. */
export const Vertical: Story = {
  args: { "aria-label": "Canvas tools", orientation: "vertical" },
  render: (args: ToolbarProps) => (
    <Toolbar {...args}>
      <Button size="sm" variant="ghost" iconOnly aria-label="Add" icon={<AddIcon aria-hidden />} />
      <Button
        size="sm"
        variant="ghost"
        iconOnly
        aria-label="Search"
        icon={<SearchIcon aria-hidden />}
      />
      <Separator />
      <Button
        size="sm"
        variant="ghost"
        iconOnly
        aria-label="Delete"
        icon={<DeleteIcon aria-hidden />}
        tone="danger"
      />
      <Toggle label="Snap to grid" checked={false} onCheckedChange={() => {}} />
      <Separator />
      <ToggleGroup
        aria-label="Format"
        options={FORMAT_OPTIONS}
        value={["bold"]}
        onChange={() => {}}
        size="sm"
      />
    </Toolbar>
  ),
};

/**
 * Narrow column: actions wrap onto a second row instead of being hidden in a "more" menu.
 * The arrow-key order stays the reading order.
 */
export const Wrapping: Story = {
  args: { "aria-label": "Document tools" },
  render: (args: ToolbarProps) => (
    <div className="border-line-soft w-[22rem] rounded-lg border p-2" data-testid="narrow">
      <Toolbar {...args}>
        <Actions />
      </Toolbar>
    </div>
  ),
};

/**
 * Menus and popovers inside: the triggers of `Menu` (react-aria), `Popover` and
 * `ContextMenu` (Radix) are part of the arrow-key navigation, but the contents of their panels are not.
 */
export const WithOverlays: Story = {
  args: { "aria-label": "Row tools" },
  render: (args: ToolbarProps) => (
    <Toolbar {...args}>
      <MenuTrigger>
        <MenuButton size="sm" variant="outline" icon={<MoreIcon aria-hidden />}>
          Menu
        </MenuButton>
        <Menu>
          <MenuItem>Rename</MenuItem>
          <MenuItem>Duplicate</MenuItem>
        </Menu>
      </MenuTrigger>
      <Popover>
        <PopoverTrigger asChild>
          <Button size="sm" variant="outline">
            Popover
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-3 text-sm">Anything can go in here.</PopoverContent>
      </Popover>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <Button size="sm" variant="outline">
            Right-click me
          </Button>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem>Inspect</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </Toolbar>
  ),
};
