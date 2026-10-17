import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useState } from "react";
import { Button } from "../actions/Button.js";
import { Kbd } from "../content/Kbd.js";
import { ShortcutsHelp, type ShortcutGroup, type ShortcutsHelpProps } from "./ShortcutsHelp.js";
import { TextControl } from "../inputs/TextControl.js";

const meta = {
  title: "Overlays/ShortcutsHelp",
  component: ShortcutsHelp,
  parameters: { layout: "padded" },
  tags: ["periphery"],
} satisfies Meta<ShortcutsHelpProps>;

export default meta;
type Story = StoryObj<ShortcutsHelpProps>;

const GROUPS: ShortcutGroup[] = [
  {
    id: "navigation",
    label: "Navigation",
    items: [
      { keys: ["Ctrl", "K"], description: "Open the command palette" },
      { keys: ["G", "H"], description: "Go to the home page" },
      { keys: ["G", "S"], description: "Go to settings" },
    ],
  },
  {
    id: "editing",
    label: "Editing",
    items: [
      { keys: ["Ctrl", "Shift", "D"], description: "Duplicate the selection" },
      { keys: ["Delete"], description: "Delete the selection" },
    ],
  },
  {
    id: "general",
    label: "General",
    items: [
      { keys: ["?"], description: "Show this window" },
      { keys: ["Esc"], description: "Close the window" },
    ],
  },
];

/** Opened by a button: after closing, focus returns to it. */
export const Playground: Story = {
  args: { open: false, onOpenChange: () => {}, groups: GROUPS },
  render: (args: ShortcutsHelpProps) => {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button onClick={() => setOpen(true)}>Keyboard shortcuts</Button>
        <ShortcutsHelp {...args} open={open} onOpenChange={setOpen} />
      </>
    );
  },
};

/** The window is open from the start, so it can be seen without any interaction. */
export const Open: Story = {
  args: { open: true, onOpenChange: () => {}, groups: GROUPS },
};

/**
 * Recipe: open on "?". The kit does not bind global keys: the handler lives with the consumer,
 * and it must do the following:
 *
 * - match the character, not the key position (`event.key`): "?" sits on different keys
 *   (Shift+/ on a Latin layout, Shift+7 on a Russian one), and the user presses the character
 *   itself. For letters ("G, H") it is the opposite: the position (`event.code`);
 * - stay silent in input fields, otherwise a question mark cannot be typed;
 * - do not intercept Ctrl, Alt, and Meta combinations, auto-repeat, or IME input.
 */
export const OpenWithQuestionMark: Story = {
  args: { open: false, onOpenChange: () => {}, groups: GROUPS },
  render: (args: ShortcutsHelpProps) => {
    const [open, setOpen] = useState(false);

    useEffect(() => {
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key !== "?" || event.isComposing || event.repeat) return;
        if (event.ctrlKey || event.altKey || event.metaKey) return;
        const target = event.target;
        if (
          target instanceof HTMLElement &&
          (target.isContentEditable || /^(input|textarea|select)$/i.test(target.tagName))
        ) {
          return;
        }
        event.preventDefault();
        setOpen(true);
      };
      document.addEventListener("keydown", onKeyDown);
      return () => document.removeEventListener("keydown", onKeyDown);
    }, []);

    return (
      <div className="flex max-w-sm flex-col gap-3">
        <p className="text-fg-1 m-0 text-[13px]">
          Press <Kbd>?</Kbd> anywhere on the page to open the window.
        </p>
        <TextControl aria-label="Try typing a question mark" placeholder="Typing here is safe" />
        <ShortcutsHelp {...args} open={open} onOpenChange={setOpen} />
      </div>
    );
  },
};

/** A title from the prop instead of the catalog default. */
export const CustomTitle: Story = {
  args: { open: true, onOpenChange: () => {}, title: "Cheat sheet", groups: GROUPS },
};

/** A long list of shortcuts: the header with the close button stays in place, and the list scrolls. */
export const LongList: Story = {
  args: {
    open: true,
    onOpenChange: () => {},
    groups: Array.from({ length: 6 }, (_, groupIndex) => ({
      id: `group-${groupIndex}`,
      label: `Section ${groupIndex + 1}`,
      items: Array.from({ length: 6 }, (_, itemIndex) => ({
        keys: ["Alt", String(itemIndex + 1)],
        description: `Action ${groupIndex + 1}.${itemIndex + 1}`,
      })),
    })),
  },
};
