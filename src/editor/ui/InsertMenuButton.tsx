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
  /** `aria-disabled`: в обходе стрелками, но меню не открывает (HTML-режим). */
  unavailable?: boolean;
  /** Подпись сочетания — от Панели: она знает, Apple ли это. */
  shortcut: (keys: readonly string[]) => string;
}

/**
 * «+» на Панели — второй вход в Меню вставки, для мыши и для тех, кто не знает
 * про `/`. Пункты те же, что у списка по `/`, из того же реестра
 * (`insertItems.ts`), и применяются тем же `applyInsertItem` — только к
 * выделению, а не к набранному запросу.
 *
 * Здесь это `Menu` кита, а не список у курсора: фокус уходит из поля на кнопку,
 * и меню с собственным фокусом — обычный паттерн APG «кнопка меню»
 * (`aria-haspopup`, стрелки, Escape — через стек слоёв ADR-0041, как у меню
 * «¶»). Фильтра у него нет: набирать запрос негде, а первая буква
 * подписи и так ведёт к пункту (typeahead react-aria).
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
  // Как у меню форматирования: недоступная кнопка меню не открывает.
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
