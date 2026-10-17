import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Button } from "../actions/Button.js";
import { Dialog } from "./Dialog.js";
import { Drawer } from "./Drawer.js";
import { FormField } from "../inputs/FormField.js";
import { TextControl } from "../inputs/TextControl.js";
import type { Selection } from "react-aria-components";
import {
  Menu,
  MenuButton,
  MenuItem,
  MenuSection,
  MenuSeparator,
  MenuTrigger,
  SubmenuTrigger,
} from "./Menu.js";
import {
  ArchiveIcon,
  CopyIcon,
  DeleteIcon,
  EditIcon,
  FolderIcon,
  GridDenseIcon,
  MoreIcon,
} from "../../icons.js";

const meta = {
  title: "Overlays/Menu",
  component: Menu,
  parameters: { layout: "centered" },
} satisfies Meta<typeof Menu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: () => (
    <MenuTrigger>
      <MenuButton icon={<MoreIcon size={16} />} iconOnly aria-label="Actions" />
      <Menu>
        <MenuItem icon={<EditIcon size={14} />} onAction={() => {}}>
          Rename
        </MenuItem>
        <MenuItem icon={<CopyIcon size={14} />} shortcut="⌘D" onAction={() => {}}>
          Duplicate
        </MenuItem>
        <MenuItem icon={<ArchiveIcon size={14} />} disabled>
          Archive — no rights
        </MenuItem>
        <MenuSeparator />
        <MenuItem tone="danger" icon={<DeleteIcon size={14} />} onAction={() => {}}>
          Delete
        </MenuItem>
      </Menu>
    </MenuTrigger>
  ),
};

/**
 * Sections, toggles, and submenus.
 *
 * Toggles are a selection at the SECTION level, not a `checked` prop on the item: react-aria sets
 * the `menuitemcheckbox`/`menuitemradio` roles and `aria-checked` itself, and setting them by hand
 * would repeat work that is already done.
 */
export const SectionsAndSubmenus: Story = {
  render: function Render() {
    const [view, setView] = useState<Selection>(new Set(["dense"]));
    const [sort, setSort] = useState<Selection>(new Set(["date"]));

    return (
      <MenuTrigger>
        <MenuButton icon={<MoreIcon size={16} />}>View</MenuButton>
        <Menu>
          <MenuSection
            label="Density"
            selectionMode="multiple"
            selectedKeys={view}
            onSelectionChange={setView}
          >
            <MenuItem id="dense" icon={<GridDenseIcon size={14} />}>
              Dense grid
            </MenuItem>
            <MenuItem id="meta">Show labels</MenuItem>
          </MenuSection>
          <MenuSeparator />
          <MenuSection
            label="Sort"
            selectionMode="single"
            selectedKeys={sort}
            onSelectionChange={setSort}
          >
            <MenuItem id="date">By date</MenuItem>
            <MenuItem id="name">By name</MenuItem>
          </MenuSection>
          <MenuSeparator />
          <SubmenuTrigger>
            <MenuItem icon={<FolderIcon size={14} />}>Move to…</MenuItem>
            <Menu>
              <MenuItem onAction={() => {}}>Nature</MenuItem>
              <MenuItem onAction={() => {}}>City</MenuItem>
              <MenuItem onAction={() => {}}>Abstract</MenuItem>
            </Menu>
          </SubmenuTrigger>
        </Menu>
      </MenuTrigger>
    );
  },
};

/**
 * A matrix of item tones and states.
 *
 * The menu is forced open (`isOpen`); otherwise the snapshot would show only the button.
 * The panel is drawn in a portal, so the story reserves space for it at the height of the frame
 * (`layout: "padded"`, not centered).
 */
export const Matrix: Story = {
  parameters: { layout: "padded" },
  render: () => (
    <div className="h-[420px]">
      <MenuTrigger isOpen>
        <MenuButton icon={<MoreIcon size={16} />} iconOnly aria-label="Actions" />
        <Menu>
          <MenuSection label="Section">
            <MenuItem icon={<EditIcon size={14} />}>Plain</MenuItem>
            <MenuItem icon={<CopyIcon size={14} />} shortcut="⌘D">
              With a shortcut
            </MenuItem>
            <MenuItem disabled icon={<ArchiveIcon size={14} />}>
              Disabled
            </MenuItem>
          </MenuSection>
          <MenuSeparator />
          <MenuSection label="Tones">
            <MenuItem tone="accent">Accent</MenuItem>
            <MenuItem tone="success">Success</MenuItem>
            <MenuItem tone="warning">Warning</MenuItem>
            <MenuItem tone="danger" icon={<DeleteIcon size={14} />}>
              Danger
            </MenuItem>
          </MenuSection>
        </Menu>
      </MenuTrigger>
    </div>
  ),
};

/**
 * THE JUNCTION OF TWO LIBRARIES: a react-aria menu inside a Radix dialog.
 *
 * The only place in the package where two independent focus managers meet on one screen, and the
 * only way to find out whether the mixed kit works at all. The dialog holds a focus trap and listens
 * for Escape; the menu holds its own focus trap and listens for Escape too. The expected behavior:
 *
 *   — Escape with the menu open closes the MENU, not the dialog;
 *   — Escape again closes the dialog;
 *   — after the menu closes, focus returns to the dialog, not to `<body>`;
 *   — Tab does not leave the dialog while the menu is open.
 *
 * Verified in a browser (`tests-visual/interactions.spec.ts`): jsdom does not move focus on Tab the
 * way a browser does, and a focus-trap check there would pass anyway, so it would check nothing (ADR-0012).
 */
export const MenuInsideDialog: Story = {
  parameters: { layout: "padded" },
  render: function Render() {
    const [open, setOpen] = useState(true);
    const [name, setName] = useState("Daily collection");
    // The row appears only after an action, so the story's original snapshot
    // does not change, while a mouse click on an item gets a visible result.
    const [action, setAction] = useState<string | null>(null);
    return (
      <div className="h-[420px]">
        <Button onClick={() => setOpen(true)}>Open the window</Button>
        <Dialog
          open={open}
          onClose={() => setOpen(false)}
          title="Collection settings"
          className="w-full max-w-[420px]"
        >
          <div className="flex flex-col gap-4 px-5 py-4">
            <FormField label="Name" htmlFor="md-name">
              <TextControl
                id="md-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                shellClassName="w-full"
              />
            </FormField>
            <div className="flex justify-between">
              <MenuTrigger>
                <MenuButton icon={<MoreIcon size={16} />}>Actions</MenuButton>
                <Menu>
                  <MenuItem icon={<CopyIcon size={14} />} onAction={() => setAction("Duplicate")}>
                    Duplicate
                  </MenuItem>
                  <MenuSeparator />
                  <MenuItem
                    tone="danger"
                    icon={<DeleteIcon size={14} />}
                    onAction={() => setAction("Delete")}
                  >
                    Delete
                  </MenuItem>
                </Menu>
              </MenuTrigger>
              <Button variant="solid" tone="accent" onClick={() => setOpen(false)}>
                Save
              </Button>
            </div>
            {action != null ? <p>Last action: {action}</p> : null}
          </div>
        </Dialog>
      </div>
    );
  },
};

/**
 * A react-aria menu inside a drawer: the same junction as with `Dialog`, since `Drawer` sits
 * on the same modal layer of Radix.
 *
 * A separate story for the mouse click. The modal Radix sets `pointer-events` to none on `<body>`,
 * while the menu panel lives in a portal right under it. Until the kit handed the pointer back to it,
 * an item could only be chosen from the keyboard.
 * Checked in `tests-visual/interactions.spec.ts`.
 */
export const MenuInsideDrawer: Story = {
  parameters: { layout: "padded" },
  render: function Render() {
    const [open, setOpen] = useState(true);
    const [action, setAction] = useState<string | null>(null);
    return (
      <div className="h-[420px]">
        <Button onClick={() => setOpen(true)}>Open the panel</Button>
        <Drawer open={open} onClose={() => setOpen(false)} title="Collection settings">
          <div className="flex flex-col items-start gap-4">
            <MenuTrigger>
              <MenuButton icon={<MoreIcon size={16} />}>Actions</MenuButton>
              <Menu>
                <MenuItem icon={<CopyIcon size={14} />} onAction={() => setAction("Duplicate")}>
                  Duplicate
                </MenuItem>
                <MenuItem icon={<ArchiveIcon size={14} />} onAction={() => setAction("Archive")}>
                  Archive
                </MenuItem>
              </Menu>
            </MenuTrigger>
            {action != null ? <p>Last action: {action}</p> : null}
          </div>
        </Drawer>
      </div>
    );
  },
};
