import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Card } from "../content/Card.js";
import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "./ContextMenu.js";
import { Menu, MenuButton, MenuItem, MenuSection, MenuSeparator, MenuTrigger } from "./Menu.js";
import { ArchiveIcon, CopyIcon, DeleteIcon, EditIcon, MoreIcon } from "../../icons.js";

const meta = {
  title: "Overlays/ContextMenu",
  parameters: { layout: "padded" },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const Playground: Story = {
  render: function Render() {
    const [dense, setDense] = useState(true);
    return (
      <ContextMenu>
        <ContextMenuTrigger>
          <Card className="flex h-[160px] w-[320px] items-center justify-center select-none">
            Right-click here
          </Card>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuLabel>Actions</ContextMenuLabel>
          <ContextMenuItem icon={<EditIcon size={14} />}>Rename</ContextMenuItem>
          <ContextMenuItem icon={<CopyIcon size={14} />} shortcut="⌘D">
            Duplicate
          </ContextMenuItem>
          <ContextMenuItem icon={<ArchiveIcon size={14} />} disabled>
            Archive — no rights
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuCheckboxItem checked={dense} onCheckedChange={setDense}>
            Dense grid
          </ContextMenuCheckboxItem>
          <ContextMenuSeparator />
          <ContextMenuItem tone="danger" icon={<DeleteIcon size={14} />}>
            Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  },
};

/**
 * SINGLE CHOICE — not checkboxes and not items with a drawn check mark.
 *
 * The value is set on the group: "exactly one is selected" is a property of the group, and only
 * the group can set `aria-checked="false"` on the others. Here it is visible at a glance: one item
 * is marked. In the accessibility tree it shows up as the `menuitemradio` role, which is what the
 * test guards.
 */
export const SingleChoice: Story = {
  render: function Render() {
    const [project, setProject] = useState("none");
    return (
      <ContextMenu>
        <ContextMenuTrigger>
          <Card className="flex h-[160px] w-[320px] items-center justify-center select-none">
            Right-click here
          </Card>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuLabel>Project</ContextMenuLabel>
          <ContextMenuRadioGroup value={project} onValueChange={setProject}>
            <ContextMenuRadioItem value="none">No project</ContextMenuRadioItem>
            <ContextMenuSeparator />
            <ContextMenuRadioItem value="kitchen">Kitchen renovation</ContextMenuRadioItem>
            <ContextMenuRadioItem value="taxes">Taxes 2026</ContextMenuRadioItem>
            <ContextMenuRadioItem value="archive" disabled>
              Archive — no rights
            </ContextMenuRadioItem>
          </ContextMenuRadioGroup>
        </ContextMenuContent>
      </ContextMenu>
    );
  },
};

/**
 * TWO MENUS SIDE BY SIDE — the main check of both components.
 *
 * `ContextMenu` on Radix is on the left, `Menu` on react-aria is on the right. The libraries differ,
 * but they must look the same: the user must not see a "different" menu just because they opened it
 * with the right mouse button. The shared look table in `lib/menu.ts` is the only thing that keeps
 * them together, and it does so only because it speaks both dialects of state (`data-focused` in one,
 * `data-highlighted` in the other, and so on).
 *
 * The highlighted item on the right is the focus that react-aria sets on open; Radix has no focused
 * item without a pointer. This is state, not appearance.
 *
 * A mismatch here is visible by eye and is caught by the baseline snapshot. Reasoning does not catch
 * it at all: in one library the state may simply not apply, and the component will still look correct.
 */
export const TwoMenusSideBySide: Story = {
  render: () => (
    // Panels are drawn in portals and do not follow the layout: the react-aria menu
    // anchors to its own button, and a Radix menu without a pointer lands in a corner of the screen.
    // So the button is pushed to the right, and both panels are visible side by side instead of one
    // on top of the other. The highlighted item in react-aria is the focus it sets on open,
    // not a difference in look: without it, the focus ring would outline the whole panel.
    <div className="h-[420px]">
      <MenuTrigger isOpen>
        <MenuButton
          icon={<MoreIcon size={16} />}
          iconOnly
          aria-label="react-aria menu"
          className="ml-[300px]"
        />
        <Menu>
          <MenuSection label="Actions">
            <MenuItem icon={<EditIcon size={14} />}>Rename</MenuItem>
            <MenuItem icon={<CopyIcon size={14} />} shortcut="⌘D">
              Duplicate
            </MenuItem>
            <MenuItem icon={<ArchiveIcon size={14} />} disabled>
              Archive — no rights
            </MenuItem>
          </MenuSection>
          <MenuSeparator />
          <MenuItem tone="danger" icon={<DeleteIcon size={14} />}>
            Delete
          </MenuItem>
        </Menu>
      </MenuTrigger>

      <ContextMenu modal={false} open>
        <ContextMenuTrigger>
          <span className="sr-only">Radix menu</span>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuLabel>Actions</ContextMenuLabel>
          <ContextMenuItem icon={<EditIcon size={14} />}>Rename</ContextMenuItem>
          <ContextMenuItem icon={<CopyIcon size={14} />} shortcut="⌘D">
            Duplicate
          </ContextMenuItem>
          <ContextMenuItem icon={<ArchiveIcon size={14} />} disabled>
            Archive — no rights
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem tone="danger" icon={<DeleteIcon size={14} />}>
            Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </div>
  ),
};
