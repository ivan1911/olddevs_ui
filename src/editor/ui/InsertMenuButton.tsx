"use client";

import type { Editor } from "@tiptap/react";
import {
  Menu,
  MenuButton,
  MenuItem,
  MenuSection,
  MenuTrigger,
} from "../../components/overlays/Menu.js";
import { useMessages, useUiLocale } from "../../i18n/useMessages.js";
import { AddIcon } from "../../icons.js";
import { useLockableMenu } from "./lockableMenu.js";
import {
  applyInsertItem,
  INSERT_SECTIONS,
  insertItemHint,
  type InsertItem,
} from "../core/insertItems.js";
import { GLASS_MENU_CLASS } from "../styles/glass.js";

export interface InsertMenuButtonProps {
  editor: Editor;
  items: readonly InsertItem[];
  disabled: boolean;
  /** `aria-disabled`: stays in the arrow-key navigation but does not open the menu (Source mode). */
  unavailable?: boolean;
  /** Shortcut label, supplied by the Toolbar, which knows whether this is an Apple device. */
  shortcut: (keys: readonly string[]) => string;
}

/**
 * The "+" button on the Toolbar is a second entry point to the Slash menu, for the mouse and for
 * those who do not know about `/`. The items are the same as in the `/` list, from the same
 * registry (`insertItems.ts`), and are applied by the same `applyInsertItem`, but to the
 * selection rather than to a typed query.
 *
 * This is the kit's `Menu`, not a list at the caret: focus moves from the field to the button,
 * and a menu with its own focus is the usual APG menu button pattern (`aria-haspopup`, arrow keys,
 * Escape through the layer stack, ADR-0041, as in the "¶" menu). It has no filter: there is nowhere
 * to type a query, and the first letter of a label already leads to an item (react-aria typeahead).
 */
export function InsertMenuButton({
  editor,
  items,
  disabled,
  unavailable = false,
  shortcut,
}: InsertMenuButtonProps) {
  const messages = useMessages().editor;
  const locale = useUiLocale();
  // As with the format menus: an unavailable menu button does not open the menu.
  const menu = useLockableMenu(unavailable);
  return (
    <MenuTrigger {...menu.trigger}>
      <MenuButton
        variant="ghost"
        size="sm"
        iconOnly
        disabled={disabled}
        aria-label={messages.insertMenu}
        icon={<AddIcon size={16} aria-hidden />}
        {...menu.button}
      />
      <Menu
        aria-label={messages.insertMenu}
        className={GLASS_MENU_CLASS}
        onAction={(key) => {
          const item = items.find((candidate) => candidate.id === key);
          if (item) applyInsertItem(editor, item, null);
        }}
      >
        {INSERT_SECTIONS.map((section) => {
          const rows = items.filter((item) => item.section === section);
          if (rows.length === 0) return null;
          return (
            <MenuSection
              key={section}
              id={section}
              label={section === "insert" ? messages.insertSection : messages.turnIntoSection}
            >
              {rows.map((item) => {
                const Icon = item.icon;
                const label = item.label(messages, locale);
                return (
                  <MenuItem
                    key={item.id}
                    id={item.id}
                    textValue={label}
                    icon={<Icon size={14} aria-hidden />}
                    shortcut={insertItemHint(item, shortcut)}
                  >
                    {label}
                  </MenuItem>
                );
              })}
            </MenuSection>
          );
        })}
      </Menu>
    </MenuTrigger>
  );
}
