"use client";

import { LinkIcon } from "../../../icons.js";
import { RichLink } from "./link.js";
import { LinkForm } from "./LinkPopover.js";
import type { ToolDescriptor } from "../../core/toolDescriptor.js";

/**
 * Link on the Tool descriptor (ADR-0058, item 10.4): the button, the Bubble menu entry and
 * the shortcut are declared in the same form a custom Tool uses.
 *
 * The button does not apply the Mark itself. It opens the address popover, both on click
 * and on `Mod+K`. `aria-pressed` means the caret is inside a link: the popover then edits
 * its address. Kit-specific exceptions: the "Link" group of the shortcuts reference and the
 * popover frame belong to the selection, not to the button (see `LinkPopover.tsx` for why).
 */
export const LINK_TOOL: ToolDescriptor = {
  name: "link",
  engine: () => [RichLink],
  kitTags: ["a"],
  buttons: [
    {
      id: "link",
      label: ({ messages }) => messages.link,
      icon: LinkIcon,
      can: () => true,
      isActive: (editor) => editor.isActive("link"),
      selectionMenu: true,
      shortcut: ["mod", "K"],
      shortcutGroup: "link",
      popover: ({ editor, close }) => <LinkForm editor={editor} onDone={close} />,
      popoverFrame: { anchor: "selection", className: "w-80 p-3" },
    },
  ],
};
