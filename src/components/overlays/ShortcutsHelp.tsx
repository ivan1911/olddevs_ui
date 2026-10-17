"use client";

import { Fragment, useId, type ReactNode } from "react";
import { useMessages } from "../../i18n/useMessages.js";
import { hasContent } from "../../lib/empty.js";
import { Dialog } from "./Dialog.js";
import { Kbd } from "../content/Kbd.js";
import { ScrollArea } from "../content/ScrollArea.js";

export interface ShortcutItem {
  /**
   * The keys of the shortcut, in order: `["Ctrl", "K"]`.
   *
   * One line per key, not "Ctrl+K" as a whole: each key is drawn with its own `Kbd`, and a
   * visible separator and a spoken word go between them. The kit does not try to split
   * the string on `+`, because the key itself can be the plus sign.
   */
  keys: string[];
  /** What the shortcut does: "Open search". */
  description: ReactNode;
}

export interface ShortcutGroup {
  /** Stable group key for the React list; it is not rendered into the markup as `id`. */
  id: string;
  /** Group label: "Navigation", "Editing". */
  label: ReactNode;
  /** The group's shortcuts, in display order. */
  items: ShortcutItem[];
}

export interface ShortcutsHelpProps {
  /** Whether the dialog with the summary is open. */
  open: boolean;
  /** The dialog asks to change state: the close button, Escape and a click outside pass `false`. */
  onOpenChange: (open: boolean) => void;
  /** Dialog title. Defaults to "Keyboard shortcuts" from the message catalog. */
  title?: ReactNode;
  /** The shortcut groups, already assembled: the application knows which action is bound to which key. */
  groups: ShortcutGroup[];
}

/**
 * A summary of keyboard shortcuts in a modal dialog.
 *
 * THE KIT DOES NOT KNOW THE SHORTCUTS AND DOES NOT BIND GLOBAL KEYS. Which keys the screen has,
 * and which one opens this summary ("?", as in GitHub and Linear), is decided by the application:
 * it also matches the key presses, and the kit can do nothing about that. Letter chords ("G, H")
 * should be matched by key position (`event.code`), otherwise they do not fire on a Cyrillic
 * layout; the "?" sign is matched by its character (`event.key`). A global key handler set up here
 * would fire both in an input field and over someone else's dialog: exactly where the consumer
 * knows what to do and the kit does not.
 *
 * THE CHORD IS BUILT BY `Kbd`, NOT `Keyboard`. The namesake `Keyboard` is an on-screen keyboard
 * for typing text, not a way to draw "Ctrl+K"; the task statement mixed them up because of the name.
 *
 * WHAT A SCREEN READER ANNOUNCES. The visible "+" between keys is removed from the accessibility
 * tree, and the word from the catalog is read instead: "Ctrl plus K". Whether the "+" is spoken
 * depends on the user's settings: NVDA at its default punctuation level skips it, and "Ctrl K"
 * would sound like two keys in a row, not a chord. Unlike `CommandPalette`, where the whole chord
 * of an item is `aria-hidden`: there it is a hint next to an item the user selects anyway. Here
 * the chord is the only content of the dialog; hiding it would mean showing a blind user an
 * empty cheat sheet.
 *
 * AN ITEM IS A LIST ITEM, NOT A `dl`. Term–definition pairs look more precise, but their
 * announcement is inconsistent: some screen reader and browser combinations read them without the
 * element count and without the pair boundaries. A list is read the same everywhere ("list, 3
 * items"), and the order "description, then chord" is natural in it.
 *
 * A GROUP IS A NAMED GROUP, not a heading. The heading level depends on where the dialog sits in
 * the page; the same argument and the same analysis as for `NotificationList`.
 *
 * SCROLLING IS INSIDE THE DIALOG, on the kit's `ScrollArea`. A long summary does not push the
 * header with the close button off the screen. The area gets a tab stop and a name: without the
 * first, a keyboard user cannot scroll it with the arrow keys; without the second, the stop would
 * be unnamed.
 */
export function ShortcutsHelp({ open, onOpenChange, title, groups }: ShortcutsHelpProps) {
  const messages = useMessages();
  const baseId = useId();
  // `hasContent`, not `??`: an empty string would leave the dialog without a title, and with it
  // without an accessible name.
  const heading = hasContent(title) ? title : messages.shortcutsHelp.title;
  return (
    <Dialog
      open={open}
      onClose={() => onOpenChange(false)}
      title={heading}
      className="w-full max-w-md"
    >
      <ScrollArea
        label={messages.shortcutsHelp.list}
        // The focus ring sits inside the area: outside it, the area's own edge would clip it.
        // `relative` is not cosmetic: the separator words under `sr-only` are absolutely
        // positioned, and without a positioned ancestor they drifted to the dialog's backdrop and
        // stretched its scroll to the full length of the list (caught by manual testing).
        className="relative max-h-[min(70vh,32rem)] rounded-b-lg px-5 py-4 focus-visible:-outline-offset-2"
      >
        <div className="flex flex-col gap-5">
          {groups
            .filter((group) => group.items.length > 0)
            .map((group, groupIndex) => {
              // An index, not `group.id`: `aria-labelledby` is a space-separated list of IDs,
              // and an `id` containing a space would leave the group without a name.
              const labelId = `${baseId}-${groupIndex}`;
              return (
                <div key={group.id} role="group" aria-labelledby={labelId}>
                  <div
                    id={labelId}
                    className="text-fg-2 pb-2 text-[11px] font-bold tracking-wide uppercase"
                  >
                    {group.label}
                  </div>
                  <ul className="m-0 flex list-none flex-col gap-2 p-0">
                    {group.items.map((item, index) => (
                      <li key={index} className="flex items-center justify-between gap-4">
                        <span className="text-fg-1 min-w-0 text-[13px]">{item.description}</span>
                        <span className="flex shrink-0 items-center gap-1">
                          {item.keys.map((key, keyIndex) => (
                            <Fragment key={keyIndex}>
                              {keyIndex > 0 && (
                                <>
                                  <span aria-hidden="true" className="text-fg-3 text-caption">
                                    +
                                  </span>
                                  <span className="sr-only">
                                    {messages.shortcutsHelp.keySeparator}
                                  </span>
                                </>
                              )}
                              <Kbd size="md">{key}</Kbd>
                            </Fragment>
                          ))}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
        </div>
      </ScrollArea>
    </Dialog>
  );
}
