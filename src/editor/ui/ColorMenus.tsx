"use client";

import { useEditorState, type Editor } from "@tiptap/react";
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "../../components/overlays/Popover.js";
import { Tooltip } from "../../components/overlays/Tooltip.js";
import type { UiMessages } from "../../i18n/messages.js";
import { useMessages } from "../../i18n/useMessages.js";
import { BlockedIcon, ChevronDownIcon, HighlightIcon, TextColorIcon } from "../../icons.js";
import { cn } from "../../lib/cn.js";
import { buttonClasses } from "../../lib/button.js";
import { normalizeCustomColor, type CustomColorKind } from "../features/color/customColor.js";
import {
  EDITOR_MARKER_NAMES,
  EDITOR_TEXT_COLOR_NAMES,
  type EditorMarkerName,
  type EditorTextColorName,
} from "../styles/palette.js";
import { EDITOR_MARKER_CLASS, EDITOR_TEXT_COLOR_CLASS } from "../styles/prose.js";
import { GLASS_PANEL_CLASS } from "../styles/glass.js";
import type { FormatMenuHostProps } from "./FormatMenus.js";

type EditorMessages = UiMessages["editor"];

/**
 * COLOR POPOVERS. The reference is Tiptap's Notion-like template: the color is
 * picked by eye, from swatches, in one click. Before, the text color and the highlight
 * were a "…" submenu, with items by name, and the color showed only on the reference's
 * sample row.
 *
 * There are two buttons, as in the reference (owner's decision):
 *
 * - "Color" — the letter "A" in the current text color, with an arrow. The popover has
 *   two grids: "Text color" (six tones) and "Highlight color" (nine colors). At the end
 *   of each one there is "Remove color" or "Remove highlight" as an icon. Each grid's
 *   heading has "Custom color…".
 * - "Highlight" — a click opens a row of nine highlights and "Remove highlight". The
 *   former single click that applied yellow is gone: the highlight color is now always
 *   chosen, and yellow is one click on its swatch.
 *
 * ROLES ARE A MENU, NOT A RADIO GROUP. In a radio group (the kit's `SwatchGroup`) an
 * arrow selects at once: here the first arrow would have colored the text and closed
 * the popover. So the APG menu pattern is used: `menu` › `group` with a heading ›
 * `menuitemradio` with `aria-checked` (and "Custom color…" is a variant of the same
 * choice, as it was in the submenu before), while "Remove highlight" is a `menuitem`.
 * Arrows move across the grid; Enter, Space and a click apply.
 *
 * THE BUTTON HOLDS THE POPOVER, and so does the Bubble menu's pill: while the popover is
 * open, the button has `aria-expanded="true"`, and the pill does not hide (`showOverSelection`).
 */

/** Color of a Mark: a palette name, or the author's `#rrggbb`; `null` means there is no color. */
type CurrentColor = string | null;

function colorOf(attributes: Record<string, unknown>, names: readonly string[]): CurrentColor {
  const found = names.find((name) => name === attributes.color);
  return found ?? normalizeCustomColor(attributes.color);
}

const TEXT_COLOR_LABEL: Record<EditorTextColorName, (m: EditorMessages) => string> = {
  accent: (m) => m.colorAccent,
  success: (m) => m.colorSuccess,
  warning: (m) => m.colorWarning,
  danger: (m) => m.colorDanger,
  lime: (m) => m.colorLime,
  muted: (m) => m.colorMuted,
};

const MARKER_LABEL: Record<EditorMarkerName, (m: EditorMessages) => string> = {
  gray: (m) => m.markerGray,
  brown: (m) => m.markerBrown,
  orange: (m) => m.markerOrange,
  yellow: (m) => m.markerYellow,
  green: (m) => m.markerGreen,
  blue: (m) => m.markerBlue,
  purple: (m) => m.markerPurple,
  pink: (m) => m.markerPink,
  red: (m) => m.markerRed,
};

/** The current color by name, for the button's name, e.g. "Highlight: Pink". */
function colorName(
  current: CurrentColor,
  labels: Record<string, (m: EditorMessages) => string>,
  none: string,
  messages: EditorMessages
): string {
  if (current === null) return none;
  if (current.startsWith("#")) return messages.colorCustomCurrent({ hex: current });
  return labels[current]?.(messages) ?? none;
}

/* ─── Grid ──────────────────────────────────────────────────────────────── */

interface GridItem {
  id: string;
  label: string;
  /**
   * `radio` — a choice, shown as checked: a color, and "Custom color…" (checked when the
   * selection has the author's color; choosing it opens `ColorPicker`). `action` — "Remove
   * highlight": an action, not a choice.
   */
  kind: "radio" | "action";
  checked?: boolean;
  /** The swatch; an action without a swatch is labelled with a word. */
  swatch?: ReactNode;
  /** A tooltip with the name, for an icon without a label ("Remove highlight"). */
  tooltip?: boolean;
}

interface GridSection {
  id: string;
  /** The grid's heading; without it, the group is named by the menu's `aria-label`. */
  label?: string;
  /** The item at the right of the heading: "Custom color…". */
  header?: GridItem;
  items: GridItem[];
}

/** Swatches per row: the reference has this many, and both grids have exactly two rows. */
const COLUMNS = 5;

/**
 * A cell: a 24 px swatch and padding for the selection ring, as in the kit's `SwatchGroup`.
 * The ring lies on the popover's backing, not on the swatch's color, and keeps its contrast
 * in any theme. Focus is an accent outline, further out.
 */
const CELL_CLASS =
  "block cursor-pointer rounded-full p-1 transition-shadow outline-none " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong";

const SWATCH_CLASS = "flex size-6 items-center justify-center rounded-full";

const HEADER_ACTION_CLASS =
  "text-fg-1 hover:text-fg-0 rounded-xs text-xs underline-offset-2 hover:underline " +
  "outline-none focus-visible:outline-2 focus-visible:outline-accent-strong";

/**
 * A grid menu. Its traversal is its own: react-aria's `Menu` moves only up and down, while
 * here the items form rows. Focus roams (roving tabindex): the menu has one Tab stop, on the
 * checked color or on the first item, and Radix takes it on open.
 *
 * Arrows: ← and → move to the neighboring item in order; ↑ and ↓ move to the same column in
 * the row above or below, across the grid headings; Home and End go to the first and last
 * item. The edges do not wrap: a jump from the last color to the first reads as a miss.
 */
function ColorGrid({
  label,
  sections,
  onPick,
}: {
  label: string;
  sections: GridSection[];
  onPick: (id: string) => void;
}) {
  const baseId = useId();
  const rows: GridItem[][] = [];
  for (const section of sections) {
    if (section.header) rows.push([section.header]);
    for (let index = 0; index < section.items.length; index += COLUMNS) {
      rows.push(section.items.slice(index, index + COLUMNS));
    }
  }
  const flat = rows.flat();
  // On open, focus goes to the checked color; with no color, to the first swatch, not to
  // "Custom color…" in the heading.
  const checked = flat.findIndex((item) => item.checked);
  const initial = Math.max(0, checked >= 0 ? checked : flat.findIndex((item) => item.swatch));
  const [active, setActive] = useState(initial);
  const refs = useRef(new Map<string, HTMLElement>());

  const focus = (index: number) => {
    const item = flat[index];
    if (!item) return;
    setActive(index);
    refs.current.get(item.id)?.focus();
  };

  const position = (index: number) => {
    let seen = 0;
    for (let row = 0; row < rows.length; row++) {
      const length = rows[row]!.length;
      if (index < seen + length) return { row, column: index - seen };
      seen += length;
    }
    return { row: 0, column: 0 };
  };
  const startOf = (row: number) => rows.slice(0, row).reduce((sum, r) => sum + r.length, 0);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const { row, column } = position(active);
    let next: number | null = null;
    if (event.key === "ArrowRight") next = Math.min(active + 1, flat.length - 1);
    else if (event.key === "ArrowLeft") next = Math.max(active - 1, 0);
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = flat.length - 1;
    else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      const target = row + (event.key === "ArrowDown" ? 1 : -1);
      if (target >= 0 && target < rows.length) {
        next = startOf(target) + Math.min(column, rows[target]!.length - 1);
      } else next = active;
    }
    if (next === null) return;
    event.preventDefault();
    focus(next);
  };

  const cell = (item: GridItem, index: number, header = false) => {
    const button = (
      <button
        key={item.id}
        ref={(node) => {
          if (node) refs.current.set(item.id, node);
          else refs.current.delete(item.id);
        }}
        type="button"
        role={item.kind === "radio" ? "menuitemradio" : "menuitem"}
        aria-checked={item.kind === "radio" ? (item.checked ?? false) : undefined}
        aria-label={item.swatch ? item.label : undefined}
        tabIndex={index === active ? 0 : -1}
        onFocus={() => setActive(index)}
        onClick={() => onPick(item.id)}
        className={
          header
            ? HEADER_ACTION_CLASS
            : cn(CELL_CLASS, item.checked ? "ring-fg-0 ring-2" : "hover:ring-line hover:ring-2")
        }
      >
        {item.swatch ?? item.label}
      </button>
    );
    return item.tooltip ? (
      // The tooltip is on the wrapper: on the button itself, Radix would add `aria-describedby`,
      // and a screen reader would read the name twice (as with `SwatchGroup`).
      <Tooltip key={item.id} content={item.label}>
        <span className="block">{button}</span>
      </Tooltip>
    ) : (
      button
    );
  };

  let index = 0;
  return (
    <div role="menu" aria-label={label} onKeyDown={onKeyDown} className="flex flex-col gap-3">
      {sections.map((section) => {
        const headingId = `${baseId}-${section.id}`;
        const header = section.header ? cell(section.header, index++, true) : null;
        const items = section.items.map((item) => cell(item, index++));
        return (
          <div
            key={section.id}
            role="group"
            aria-labelledby={section.label ? headingId : undefined}
            aria-label={section.label ? undefined : label}
            className="flex flex-col gap-1.5"
          >
            {(section.label || header) && (
              <div className="flex items-baseline justify-between gap-4 px-1">
                {section.label && (
                  <span id={headingId} className="text-fg-0 text-xs font-semibold">
                    {section.label}
                  </span>
                )}
                {header}
              </div>
            )}
            <div
              className="grid w-fit gap-1"
              style={{ gridTemplateColumns: `repeat(${COLUMNS}, min-content)` }}
            >
              {items}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Swatches ──────────────────────────────────────────────────────────── */

/** Text color swatch: the letter "A" in this color on a ring, as in the reference. */
function TextSwatch({ name }: { name: EditorTextColorName }) {
  return (
    <span
      aria-hidden
      className={cn(
        SWATCH_CLASS,
        "border-line border text-[13px] leading-none font-semibold",
        EDITOR_TEXT_COLOR_CLASS[name]
      )}
    >
      A
    </span>
  );
}

/** Highlight swatch: filled with the `--marker-<name>` token. */
function MarkerSwatch({ name }: { name: EditorMarkerName }) {
  return (
    <span
      aria-hidden
      className={cn(SWATCH_CLASS, "border-line-soft border", EDITOR_MARKER_CLASS[name])}
    />
  );
}

/**
 * Clearing the color is the last cell of the grid: a crossed-out circle with a tooltip.
 * It is not a white swatch first, as it used to be. That one looked like one more color,
 * and it was shown checked when there was no color, as if white were selected. This is an
 * action, not a choice, so it is a `menuitem` without a check mark.
 */
function removeItem(id: string, label: string): GridItem {
  return {
    id,
    label,
    kind: "action",
    tooltip: true,
    swatch: (
      <span aria-hidden className={cn(SWATCH_CLASS, "text-fg-1")}>
        <BlockedIcon size={18} />
      </span>
    ),
  };
}

/* ─── Buttons ───────────────────────────────────────────────────────────── */

const BUTTON_CLASS = buttonClasses({ variant: "ghost", size: "sm", iconOnly: true });
const BUTTON_SELECTED_CLASS = buttonClasses({
  variant: "ghost",
  size: "sm",
  iconOnly: true,
  selected: true,
});
const MENU_BUTTON_CLASS = cn(buttonClasses({ variant: "ghost", size: "sm" }), "gap-0.5 px-1.5");
const MENU_BUTTON_OPEN_CLASS = cn(
  buttonClasses({ variant: "ghost", size: "sm", selected: true }),
  "gap-0.5 px-1.5"
);

const POPOVER_CLASS = cn(GLASS_PANEL_CLASS, "w-auto p-3");

/** How the popover was closed: by selecting an item (focus goes to the Document), by handing over to `ColorPicker`, or otherwise. */
type Closing = "document" | "handoff" | null;

/**
 * The popover at the button. Radix keeps the layer stack (Escape in a popover inside a
 * `Dialog` closes the popover, ADR-0041) and moves focus to the grid's Tab stop.
 *
 * FOCUS ON CLOSE. After a choice, focus goes to the Document, to the previous selection: the
 * user colored the text and goes on writing. After "Custom color…", focus goes nowhere: the
 * `ColorPicker` popover has already taken it, and moving it to the Document would close that
 * popover as a click outside. After Escape, focus goes to the button, as in the APG menu.
 * A click outside does not touch focus: the user chose where to put it.
 */
function ColorPopover({
  editor,
  open,
  onOpenChange,
  label,
  trigger,
  tooltip,
  children,
  pickedRef,
}: {
  editor: Editor;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: string;
  trigger: ReactNode;
  tooltip: string;
  children: ReactNode;
  /** How the popover was closed: by a choice that goes to the Document, or by handing over to another popover. */
  pickedRef: { current: Closing };
}) {
  const interactedOutside = useRef(false);
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <Tooltip content={tooltip}>
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      </Tooltip>
      <PopoverContent
        aria-label={label}
        className={POPOVER_CLASS}
        onOpenAutoFocus={() => {
          interactedOutside.current = false;
          pickedRef.current = null;
        }}
        onInteractOutside={() => {
          interactedOutside.current = true;
        }}
        onCloseAutoFocus={(event) => {
          if (pickedRef.current !== null || interactedOutside.current) event.preventDefault();
          if (pickedRef.current === "document" && !editor.isDestroyed) editor.view.focus();
        }}
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}

export interface ColorMenuButtonProps extends FormatMenuHostProps {
  /** "Custom color…": the `ColorPicker` popover is held by `RichTextEditor`. Without it, there is no item. */
  onCustomColor?: (kind: CustomColorKind) => void;
}

/**
 * The "Color" button: the "A" icon in the current text color, and an arrow. The highlight
 * grid appears only with the `highlight` Tool: without it, the highlight Mark is not in the Schema.
 */
export function ColorMenuButton({
  editor,
  tools,
  disabled,
  unavailable = false,
  onCustomColor,
}: ColorMenuButtonProps) {
  const messages = useMessages().editor;
  const withHighlight = tools.has("highlight");
  const [open, setOpen] = useState(false);
  const picked = useRef<Closing>(null);
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      text: colorOf(current.getAttributes("textStyle"), EDITOR_TEXT_COLOR_NAMES),
      highlight: withHighlight
        ? colorOf(current.getAttributes("highlight"), EDITOR_MARKER_NAMES)
        : null,
      // Color Marks are excluded, for example, in a code Block: the button is unavailable, as
      // the former highlight toggle was, instead of opening a choice that does nothing.
      can: current.can().setColor("accent"),
    }),
  });
  const textName = state.text && !state.text.startsWith("#") ? state.text : null;
  const textCustom = state.text?.startsWith("#") ? state.text : undefined;
  const locked = unavailable || !state.can;

  const pick = (id: string) => {
    const [kind, name] = id.split(":") as [CustomColorKind, string];
    picked.current = name === "custom" ? "handoff" : "document";
    setOpen(false);
    if (name === "custom") return onCustomColor?.(kind);
    const chain = editor.chain().focus();
    if (kind === "text") (name === "none" ? chain.unsetColor() : chain.setColor(name)).run();
    else (name === "none" ? chain.unsetHighlight() : chain.setHighlight({ color: name })).run();
  };

  const custom = (kind: CustomColorKind, current: CurrentColor): GridItem | undefined =>
    onCustomColor
      ? {
          id: `${kind}:custom`,
          label: messages.colorCustom,
          kind: "radio",
          checked: current?.startsWith("#") ?? false,
        }
      : undefined;

  const sections: GridSection[] = [
    {
      id: "text",
      label: messages.textColorSection,
      header: custom("text", state.text),
      items: [
        ...EDITOR_TEXT_COLOR_NAMES.map((name): GridItem => ({
          id: `text:${name}`,
          label: TEXT_COLOR_LABEL[name](messages),
          kind: "radio",
          checked: state.text === name,
          swatch: <TextSwatch name={name} />,
        })),
        removeItem("text:none", messages.colorRemove),
      ],
    },
  ];
  if (withHighlight) {
    sections.push({
      id: "highlight",
      label: messages.highlightSection,
      header: custom("highlight", state.highlight),
      items: [
        ...EDITOR_MARKER_NAMES.map((name): GridItem => ({
          id: `highlight:${name}`,
          label: MARKER_LABEL[name](messages),
          kind: "radio",
          checked: state.highlight === name,
          swatch: <MarkerSwatch name={name} />,
        })),
        removeItem("highlight:none", messages.highlightRemove),
      ],
    });
  }

  const trigger = (
    <button
      type="button"
      // The name carries the current text color, as with the other menu buttons (ADR-0054,
      // item 3): it is heard without opening the popover.
      aria-label={messages.colorMenu({
        current: colorName(state.text, TEXT_COLOR_LABEL, messages.colorDefault, messages),
      })}
      aria-haspopup="menu"
      aria-disabled={locked || undefined}
      disabled={disabled}
      onClick={(event) => {
        // Radix will not open the popover if the handler cancels the event.
        if (locked) event.preventDefault();
      }}
      className={open ? MENU_BUTTON_OPEN_CLASS : MENU_BUTTON_CLASS}
    >
      <TextColorIcon
        size={16}
        aria-hidden
        className={textName ? EDITOR_TEXT_COLOR_CLASS[textName as EditorTextColorName] : undefined}
        // The author's color is passed as a value: there is no class for an arbitrary `#rrggbb`.
        style={textCustom ? { color: textCustom } : undefined}
      />
      <ChevronDownIcon size={12} aria-hidden />
    </button>
  );

  return (
    <ColorPopover
      editor={editor}
      open={open}
      onOpenChange={setOpen}
      label={messages.color}
      tooltip={messages.color}
      trigger={trigger}
      pickedRef={picked}
    >
      <ColorGrid label={messages.color} sections={sections} onPick={pick} />
    </ColorPopover>
  );
}

/**
 * The "Highlight" button: a click opens a row of nine highlights and "Remove highlight".
 * It looks pressed while the selection has a highlight. Its name gives the current one,
 * "Highlight: Pink", and screen readers announce it without opening the popover.
 */
export function HighlightMenuButton({
  editor,
  disabled,
  unavailable = false,
}: FormatMenuHostProps) {
  const messages = useMessages().editor;
  const [open, setOpen] = useState(false);
  const picked = useRef<Closing>(null);
  const { current, can } = useEditorState({
    editor,
    selector: ({ editor: state }) => ({
      current: colorOf(state.getAttributes("highlight"), EDITOR_MARKER_NAMES),
      can: state.can().setHighlight({ color: "yellow" }),
    }),
  });
  const locked = unavailable || !can;
  const name = colorName(current, MARKER_LABEL, messages.highlightNone, messages);

  const pick = (id: string) => {
    picked.current = "document";
    setOpen(false);
    const chain = editor.chain().focus();
    (id === "remove" ? chain.unsetHighlight() : chain.setHighlight({ color: id })).run();
  };

  const items: GridItem[] = [
    ...EDITOR_MARKER_NAMES.map((marker): GridItem => ({
      id: marker,
      label: MARKER_LABEL[marker](messages),
      kind: "radio",
      checked: current === marker,
      swatch: <MarkerSwatch name={marker} />,
    })),
    removeItem("remove", messages.highlightRemove),
  ];

  const trigger = (
    <button
      type="button"
      aria-label={messages.highlight({ current: name })}
      aria-haspopup="menu"
      aria-disabled={locked || undefined}
      disabled={disabled}
      onClick={(event) => {
        if (locked) event.preventDefault();
      }}
      className={open || current !== null ? BUTTON_SELECTED_CLASS : BUTTON_CLASS}
    >
      <HighlightIcon size={16} aria-hidden />
    </button>
  );

  return (
    <ColorPopover
      editor={editor}
      open={open}
      onOpenChange={setOpen}
      label={messages.highlightToggle}
      tooltip={messages.highlightToggle}
      trigger={trigger}
      pickedRef={picked}
    >
      <ColorGrid
        label={messages.highlightToggle}
        sections={[{ id: "highlight", items }]}
        onPick={pick}
      />
    </ColorPopover>
  );
}
