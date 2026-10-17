"use client";

import { useRef, useState } from "react";
import { Kbd } from "../../components/content/Kbd.js";
import { Popover, PopoverContent, PopoverTrigger } from "../../components/overlays/Popover.js";
import { Tooltip } from "../../components/overlays/Tooltip.js";
import { useMessages, useUiLocale } from "../../i18n/useMessages.js";
import { KeyboardIcon } from "../../icons.js";
import { buttonClasses } from "../../lib/button.js";
import { cn } from "../../lib/cn.js";
import { TOUCH_HIDDEN_CLASS } from "../../lib/touch.js";
import { FOCUS_TARGET } from "./focusWithin.js";
import { isApple, shortcutGroupsFor, shortcutLabel } from "../core/shortcuts.js";
import type { ToolList } from "../core/toolDescriptor.js";
import { GLASS_PANEL_CLASS } from "../styles/glass.js";

export interface ShortcutsButtonProps {
  tools: ToolList;
  /**
   * The field is disabled: the button stays visible but cannot be pressed, like the
   * other buttons on the Toolbar.
   */
  disabled: boolean;
}

const CLOSED_CLASS = buttonClasses({ variant: "ghost", size: "sm", iconOnly: true });
const OPEN_CLASS = buttonClasses({ variant: "ghost", size: "sm", iconOnly: true, selected: true });

/**
 * The keyboard shortcuts popover: a keyboard button at the right edge of the Toolbar
 * opens a read-only list of "command — shortcut" pairs.
 *
 * CONTENTS COME FROM THE SHARED TABLE (`shortcuts.ts`), the same one that labels the
 * Toolbar buttons. A row exists only for a command of an enabled tool, and the shortcut
 * is labelled `⌘+⌥+⇧` on Apple and `Ctrl+Alt+Shift` elsewhere. The popover assigns no
 * shortcuts and runs no commands: it is not a command palette.
 *
 * MARKUP IS A TABLE. A screen reader reads a "command — shortcut" pair as a row with
 * column headers, not as two unrelated lists. The shortcut is the kit's `Kbd`, that is,
 * a `<kbd>`.
 *
 * The kit's `Popover`: Radix keeps a stack of layers, so Escape inside a dialog closes
 * the popover, not the dialog around the Editor (the same as the link popover, ADR-0041).
 *
 * FOCUS. Closing returns focus to the button, on Escape and on a click outside. There is
 * one caveat for clicks: if the click itself placed focus on something the user works
 * with (the document, a neighboring field, a button), that focus is not taken back. Focus
 * returns to the button only when the click landed on empty space and focus stayed on the
 * page body or on the window.
 */
export function ShortcutsButton({ tools, disabled }: ShortcutsButtonProps) {
  const messages = useMessages().editor;
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip content={messages.shortcuts}>
        <PopoverTrigger asChild>
          <button
            ref={buttonRef}
            type="button"
            aria-label={messages.shortcuts}
            disabled={disabled}
            // There are no shortcuts on phones, so there is no popover either.
            // The button is pushed to the Toolbar's right edge by its group (`EditorToolbar`).
            className={cn(open ? OPEN_CLASS : CLOSED_CLASS, TOUCH_HIDDEN_CLASS)}
          >
            <KeyboardIcon size={16} aria-hidden />
          </button>
        </PopoverTrigger>
      </Tooltip>
      <PopoverContent
        align="end"
        aria-label={messages.shortcuts}
        // The width fits the longest row: a fixed 384px left an empty gap between
        // the command and the shortcut.
        className={cn(
          GLASS_PANEL_CLASS,
          "max-h-[min(32rem,var(--radix-popover-content-available-height))] w-max max-w-[calc(100vw-2rem)] overflow-y-auto p-3"
        )}
        onCloseAutoFocus={(event) => {
          // Radix does not return focus at all after a click outside. Here it is
          // returned, unless the click itself placed it on something the user works
          // with. Focus lands on the page body or on the window container from a
          // click on empty space.
          event.preventDefault();
          const active = document.activeElement;
          if (!active || !active.matches(FOCUS_TARGET)) buttonRef.current?.focus();
        }}
      >
        {open && <ShortcutsTable tools={tools} />}
      </PopoverContent>
    </Popover>
  );
}

function ShortcutsTable({ tools }: { tools: ToolList }) {
  const messages = useMessages().editor;
  const apple = isApple();
  const groups = shortcutGroupsFor(tools, useUiLocale());

  return (
    <table className="w-full border-collapse text-sm">
      <caption className="sr-only">{messages.shortcuts}</caption>
      <thead>
        <tr className="text-fg-2 text-left text-xs">
          <th scope="col" className="pr-3 pb-2 font-medium">
            {messages.shortcutsCommand}
          </th>
          <th scope="col" className="pb-2 text-right font-medium">
            {messages.shortcutsKeys}
          </th>
        </tr>
      </thead>
      {groups.map(({ group, commands }, index) => (
        <tbody key={group} className={cn(index > 0 && "border-line-soft border-t")}>
          {commands.map((command) => (
            <tr key={command.id}>
              <th scope="row" className="text-fg-0 py-1 pr-3 text-left font-normal">
                {command.label(messages)}
              </th>
              <td className="py-1 text-right whitespace-nowrap">
                <Kbd size="md">{shortcutLabel(command.keys, apple)}</Kbd>
              </td>
            </tr>
          ))}
        </tbody>
      ))}
    </table>
  );
}
