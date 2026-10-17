"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Autocomplete,
  Collection,
  Header,
  Input,
  ListBox,
  ListBoxItem,
  ListBoxSection,
  SearchField,
  useFilter,
} from "react-aria-components";
import { SearchIcon } from "../../icons.js";
import { cn } from "../../lib/cn.js";
import { useOpenerFocus } from "../../hooks/useOpenerFocus.js";
import { OVERLAY_LAYER } from "../../lib/overlay-layer.js";
import { useOverlayLayer } from "../../hooks/useOverlayLayer.js";
import { LISTBOX_ITEM_CLASS } from "../../lib/menu.js";
import { useMessages } from "../../i18n/useMessages.js";
import { Kbd } from "../content/Kbd.js";
import { Spinner } from "../actions/Spinner.js";
import { VisuallyHidden } from "../content/VisuallyHidden.js";

export interface CommandItem {
  /** Item identifier. It is passed to the palette's `onSelect` when the item is selected. */
  id: string;
  /** Item label: shown in the list and used by search. */
  label: string;
  /** Keyboard shortcut of the item, for example `["⌘", "K"]`. Shown on the right. */
  shortcut?: string[];
  /** Extra search terms: synonyms, an English name. */
  keywords?: string;
  /** Icon to the left of the item label. */
  icon?: ReactNode;
}

export interface CommandSection {
  /** Section identifier: the list key, and the value `prefiltered` is matched against. */
  id: string;
  /** Section heading. */
  label: string;
  /** Items of the section. */
  items: CommandItem[];
  /**
   * The section is already filtered outside: show it as is, without filtering it
   * locally or re-sorting it.
   *
   * WHY TURN OFF THE PALETTE'S OWN SEARCH. For application actions it is the right
   * choice: the set is known in advance and sits entirely in memory. For server
   * results it is destructive: they are already selected, by other rules, and a second
   * substring pass throws away the correct ones.
   *
   * The consumer's case shows this on morphology: a `tsvector` search with the Russian
   * dictionary finds "Sign the contract" for the query "contracts", while `contains`
   * never matches such a pair, because the substring is not in the title. `keywords`
   * cannot fix it in principle: no matter how many words go there, a substring filter
   * does not become morphological. This is not about the amount of data but about the
   * comparison rules.
   *
   * The order of items is also kept as passed: the ranking was done by whoever searched,
   * and re-sorting would break it.
   */
  prefiltered?: boolean;
}

export interface CommandPaletteProps {
  /** Whether the palette is shown. */
  open: boolean;
  /** The palette asks to close: on Escape, on a click outside, and right after an item is selected. */
  onClose: () => void;
  /** Sections with items; each is shown under its own heading. Sections cannot be collapsed. */
  sections: CommandSection[];
  /** An item is selected; its `id` is passed. No need to close the palette separately: `onClose` is called right after. */
  onSelect: (id: string) => void;
  /** Placeholder of the empty search field. If not set, the string comes from the message catalog. */
  placeholder?: string;
  /**
   * What to show for an empty query.
   *
   * `all` — the whole list by sections: the palette works as a table of contents, and it
   * is opened not only to find something but also to remember what exists.
   * `hint` — a single hint line: for when there are hundreds of actions and the list
   * alone tells nothing.
   *
   * The default is `all`: for an app with twenty actions, an empty palette wastes the
   * chance to show them all.
   */
  emptyBehaviour?: "all" | "hint";
  /** Hint line for an empty query when `emptyBehaviour="hint"`. If not set, the text comes from the message catalog. */
  emptyHint?: ReactNode;
  /** Text shown when the query finds nothing. If not set, "Nothing found" from the message catalog. */
  notFoundText?: string;
  /** Accessible name of the palette and its list; there is no visible heading. If not set, the string comes from the message catalog. */
  title?: string;
  /**
   * The typed query, passed out on every change of the field.
   *
   * A notification, not control: the field stays with the component. This is enough to start
   * a search on the server, and it does not add a second contract to maintain.
   *
   * Called both when the field is cleared with the button and when the palette is closed and
   * reset: otherwise the consumer would keep a query that is no longer in the field and would
   * keep sending requests for it.
   *
   * Debouncing is the consumer's job: how much to debounce depends on the cost of a query, and
   * the kit does not know it.
   */
  onQueryChange?: (query: string) => void;
  /**
   * The consumer's search is in progress.
   *
   * Results already shown stay visible: a list that flickers on every character is worse than
   * a list that lags by half a second. Two places change: the field icon and the empty-state
   * text.
   */
  loading?: boolean;
  /** What to show instead of "Nothing found" while the search runs. The default is "Loading". */
  loadingText?: ReactNode;
}

/**
 * Command palette: search over the application's actions.
 *
 * BUILT FROM THREE READY-MADE PARTS, none of them written from scratch:
 * Radix `Dialog` provides modality (focus trap, focus return, portal), react-aria
 * `Autocomplete` provides the link between field and list (filtering, arrow keys,
 * `aria-activedescendant`), and `ListBox` is the list itself, with sections.
 *
 * Three decisions are the palette's own: what to show for an empty query, how an item's
 * keyboard shortcut looks, and that **sections do not collapse**. The last one matters: the
 * palette opens for a fraction of a second, and a control that has to be expanded first does
 * not fit that scenario.
 *
 * The search field is a `SearchField` without a visible label: a visible label would be noise
 * (what else would you do in a palette but search), but a screen reader needs a name, and it
 * is given by a visually hidden label.
 */
export function CommandPalette({
  open,
  onClose,
  sections,
  onSelect,
  placeholder,
  emptyBehaviour = "all",
  emptyHint,
  notFoundText,
  title,
  onQueryChange,
  loading = false,
  loadingText,
}: CommandPaletteProps) {
  const messages = useMessages();
  // `contains` from react-aria, not `String.includes`: it knows about case and diacritics
  // in the current locale, so "café" is found by "cafe".
  const { contains } = useFilter({ sensitivity: "base" });

  /*
    The query holds its own state, because `emptyBehaviour` is about an EMPTY query, not about
    the component's mode. Without it, the condition below was a constant: with `hint` the list
    got an empty set for good, and the palette turned into a search field that could never find
    anything. The bug is caught only by trying to type something: neither a snapshot nor axe
    sees it.
  */
  const [query, setQuery] = useState("");
  const contentRef = useRef<HTMLDivElement | null>(null);
  const { remember, restore } = useOpenerFocus(open, contentRef);
  // The layer joins the shared stack: ADR-0041 promises this for ALL modal layers of the kit,
  // not only for the scrim.
  useOverlayLayer(open, contentRef);

  /*
    The query does not survive closing.

    It lives in the component's state, not in the dialog content, and it was kept when
    `open=false`: after selecting an item, the user saw the previous query and the list filtered
    by it on the next ⌘K. Escape hid this, because the react-aria `SearchField` clears its value
    itself, so the defect reproduced only when selecting an item and clicking outside.
  */
  useEffect(() => {
    if (open || query === "") return;
    setQuery("");
    onQueryChange?.("");
  }, [open, query, onQueryChange]);

  /*
    Sections that must not be filtered locally are kept as a set of `id`s, not looked up in an
    array for each item: the filter runs for every row on every typed character.
  */
  const prefilteredIds = useMemo(
    () => new Set(sections.filter((section) => section.prefiltered).map((section) => section.id)),
    [sections]
  );

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            "animate-fadein data-[state=closed]:animate-fadeout fixed inset-0",
            OVERLAY_LAYER.modal
          )}
          style={{ background: "var(--overlay-scrim)", backdropFilter: "blur(4px)" }}
        />
        <DialogPrimitive.Content
          ref={contentRef}
          onOpenAutoFocus={remember}
          onCloseAutoFocus={restore}
          className={cn(
            "border-line-soft bg-bg-1 fixed top-[12vh] left-1/2 flex max-h-[70vh] w-[min(560px,92vw)] -translate-x-1/2 flex-col overflow-hidden rounded-lg border shadow-[var(--shadow-2)] outline-none",
            OVERLAY_LAYER.modal
          )}
          aria-label={title ?? messages.commandPalette.title}
        >
          {/* The dialog name must be in the markup: without `Dialog.Title` Radix logs a warning
              to the console, and a screen reader announces an unnamed dialog. The palette has no
              visible heading: it explains itself with the search field. */}
          <DialogPrimitive.Title asChild>
            <VisuallyHidden>{title ?? messages.commandPalette.title}</VisuallyHidden>
          </DialogPrimitive.Title>

          {/*
            Filtering stays with react-aria, and the section is exempted from it through the third
            argument, the collection node. A list item sits inside `ListBoxSection`, so its
            `parentKey` is the section's `id`.

            This is done instead of pre-filtering `sections` before passing them to the list: behind
            the filter also hang the focus of the first match and `aria-activedescendant`. Taking
            over the filtering would mean repeating those too.
          */}
          <Autocomplete
            filter={(textValue, inputValue, node) =>
              (node.parentKey != null && prefilteredIds.has(String(node.parentKey))) ||
              contains(textValue, inputValue)
            }
          >
            <SearchField
              aria-label={placeholder ?? messages.commandPalette.placeholder}
              value={query}
              onChange={(next) => {
                setQuery(next);
                onQueryChange?.(next);
              }}
              autoFocus
              className="border-line-soft flex items-center gap-2 border-b px-4 py-3"
            >
              {/*
                The spinner sits in place of the magnifier, not next to it: it also announces busy
                state. `Spinner` has `role="status"` with a hidden label, so a separate live region
                would be a second voice saying the same thing.

                THE LAYOUT, NOT THE CONTENT, HOLDS THE BOX FOR THE ICON. The magnifier is 16 pixels,
                the `sm` spinner is 14. While the icon itself took the space, the field and the typed
                text shifted by those two pixels back and forth every time loading switched on. The
                palette searches on the server, and a request goes out on every change of the field,
                so the text jerked in time with the pauses in typing and read as "the screen reloads"
                rather than "loading is in progress". A consumer's measurement showed this.

                The same trick as the handle slot in `EditableList`: the layout holds the slot, and
                the content can change without moving its neighbours.
              */}
              <span className="flex size-4 shrink-0 items-center justify-center">
                {loading ? (
                  <Spinner size="sm" tone="neutral" />
                ) : (
                  <SearchIcon size={16} aria-hidden className="text-fg-3" />
                )}
              </span>
              <Input
                placeholder={placeholder ?? messages.commandPalette.placeholder}
                data-disable-focus-ring="true"
                className="text-fg-0 placeholder:text-fg-2 text-md w-full border-0 bg-transparent outline-none"
              />
            </SearchField>

            <ListBox
              aria-label={title ?? messages.commandPalette.title}
              className="flex flex-col gap-1 overflow-y-auto p-2 outline-none"
              onAction={(key) => {
                onSelect(String(key));
                // The palette closes itself: the action is selected, and leaving it open over
                // the result would require a second gesture where the user has already said it all.
                onClose();
              }}
              renderEmptyState={() => (
                <div className="text-fg-2 px-3 py-6 text-center text-sm">
                  {/* The order of the branches matters: while a search is running, the empty state
                      must not claim that nothing was found. That is exactly what happened on every
                      typed character. */}
                  {loading
                    ? (loadingText ?? messages.common.loading)
                    : query === "" && emptyBehaviour === "hint"
                      ? (emptyHint ?? messages.commandPalette.emptyHint)
                      : (notFoundText ?? messages.common.notFound)}
                </div>
              )}
              items={query === "" && emptyBehaviour === "hint" ? [] : sections}
            >
              {(section: CommandSection) => (
                <ListBoxSection id={section.id}>
                  <Header className="text-fg-2 text-caption px-2 pt-2 pb-1 font-semibold">
                    {section.label}
                  </Header>
                  <Collection items={section.items}>
                    {(item: CommandItem) => (
                      <ListBoxItem
                        id={item.id}
                        textValue={`${item.label} ${item.keywords ?? ""}`}
                        className={cn(LISTBOX_ITEM_CLASS, "gap-2")}
                      >
                        {item.icon ? (
                          <span aria-hidden className="text-fg-3 flex shrink-0 items-center">
                            {item.icon}
                          </span>
                        ) : null}
                        <span className="min-w-0 flex-1 truncate">{item.label}</span>
                        {item.shortcut ? (
                          <span aria-hidden className="flex shrink-0 items-center gap-1">
                            {item.shortcut.map((key) => (
                              <Kbd key={key}>{key}</Kbd>
                            ))}
                          </span>
                        ) : null}
                      </ListBoxItem>
                    )}
                  </Collection>
                </ListBoxSection>
              )}
            </ListBox>
          </Autocomplete>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
