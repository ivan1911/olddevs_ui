import { OVERLAY_LAYER } from "./overlay-layer.js";
import { TOUCH_HIDDEN_CLASS } from "./touch.js";
import { TONE_TOKENS, type Tone } from "./variants.js";

/**
 * The menu look: one table for two implementations.
 *
 * The package has two menus: `Menu` on react-aria-components and `ContextMenu` on Radix. The two
 * libraries are not a whim: react-aria does not provide a context menu at all. But the menus must
 * look the same, or the right mouse button would open a "different" menu, and that could only be
 * noticed by putting both side by side. So the look lives here, and both implementations only apply it.
 *
 * The technique is not new to the package: `NAV_BUTTON_CLASS` and `WEEKDAY_CELL_CLASS` of the
 * calendar are extracted the same way.
 *
 * THIS IS THE CASE WHERE VARIANT ATOMS ARE NEEDED. The package rule says: state is taken through a
 * render prop where a descendant is painted, and through a variant where the element itself, with
 * `data-*`, is painted. A menu item is the second case: the look is set by one string for all items
 * at once, and there is no render prop to take. Hence `selected:`, `pressed:` and `open:` in the table below.
 */

/** Menu panel: background, border, shadow, padding. */
export const MENU_PANEL_CLASS =
  "bg-surface-elevated border-line min-w-[180px] rounded-md border p-1 " +
  "shadow-[var(--shadow-2)] outline-none " +
  /*
    SCROLLING INSIDE THE PANEL, NOT OVER THE PAGE.

    This class does not set the panel's height: react-aria sets an inline `max-height` on the
    popover from the visible area, and Radix sets `--radix-…-available-height`. Without `overflow`,
    everything that did not fit into that height was drawn outside the border, over the content and
    without a background. On iOS 27 in Safari the height came out at a few pixels: the border
    collapsed into a strip, and the menu items landed on top of the page text. `overscroll-contain`
    keeps scrolling to the end of the list from scrolling the page underneath the menu.
  */
  "overflow-y-auto overscroll-contain " +
  /*
    ON iOS WE SET THE HEIGHT OURSELVES. react-aria computes the popover's `max-height` from the
    visible area (`calculatePosition`, `getMaxHeight`), and on iOS 27 in Safari it came out as zero:
    only the panel's border and padding remained, a thin strip under the button with the items hidden
    inside it. The position of the menu itself is correct; only the height is wrong. So on iOS the
    height is overridden by a rule with `!important` (react-aria's inline style is stronger without it):
    24rem or 60% of the dynamic viewport height, whichever is smaller. The rest scrolls inside the panel.
    `-webkit-touch-callout` is understood only by WebKit on iOS; Android and desktop still compute the
    height as before.
  */
  "[@supports(-webkit-touch-callout:none)]:max-h-[min(24rem,60dvh)]! " +
  /*
    THE LAYER IS REQUIRED, AND IT WAS MISSING HERE.

    `Popover` and `Tooltip` deliberately took `z-[120]`, with a comment about `ModalOverlay`
    (`z-90`). The RAC popover gets `zIndex: 100000` inline from the library. The Radix popper had
    nothing to copy: it takes the z-index from the computed style of its content and got `auto`.
    So a right click inside a `Dialog` or `Drawer` drew the context menu UNDER the scrim, blurred
    and not clickable. The layer scale is ADR-0041.
  */
  `${OVERLAY_LAYER.popover} ` +
  /*
    Panel appearance and exit are on TWO DIALECTS AT ONCE, and this is not duplication.

    `entering:`/`exiting:` are RAC variants: they expand to `[data-entering]`
    and `[data-exiting]`. Radix does not set these attributes at all: its state lives in
    `data-state`. While only the RAC dialect was here, the comment promised that "the values
    match on purpose, otherwise the two menus would open differently". Yet `ContextMenu` was not
    animated AT ALL, because no rule reached it. The promise rested on a single word.

    Both dialects are now named explicitly, and both menus open and close the same way.
    This is checked in the browser, through both paths at once.

    The exit is set by a token, not `opacity-0`. The earlier entry looked like an exit, but it was
    not one: a transition to zero with no duration is the same instant disappearance, just written
    longer. The token is also visible to the `reduce` gate (ADR-0043), while a literal is not.
  */
  "entering:animate-fadein exiting:animate-fadeout " +
  "data-[state=open]:animate-fadein data-[state=closed]:animate-fadeout";

/**
 * Menu item.
 *
 * `focus:` equals `hover:` here not out of laziness. In a menu the keyboard cursor and the pointer
 * are the same place, and highlighting them differently would show the user two cursors at once.
 * In react-aria this is `data-focused`, which is set both by the mouse and by the arrow keys.
 */
export const MENU_ITEM_CLASS =
  "group flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-[13px] " +
  "outline-none select-none " +
  // react-aria dialect.
  "hover:bg-bg-2 focus:bg-bg-2 disabled:pointer-events-none disabled:opacity-50 " +
  // Radix dialect: see the comment below; without it, ContextMenu falls out of line.
  "data-[highlighted]:bg-bg-2 data-[disabled]:pointer-events-none data-[disabled]:opacity-50";

/**
 * List row: one for all lists in the kit.
 *
 * Since wave 26 it is used by `Transfer`, `Combobox`, `CommandPalette` and `Select`.
 * The last one stood apart for a long time: its row is not a `ListBoxItem` but a plain button,
 * and its set of classes diverged from the common padding (`py-[9px]` against `py-1.5`) and the
 * selection color (`bg-bg-3` against `selected:bg-accent-soft`). Lists placed side by side differed
 * in row height and in how the selected item looked.
 *
 * It also works on a non-RAC node: the `selected:` variant expands to `[data-selected]` without
 * requiring `data-rac`, because `selected` has no native counterpart. So the button only needs to
 * set the attribute.
 *
 * The selectable list row is react-aria's `ListBoxItem`.
 *
 * It differs from `MENU_ITEM_CLASS` in one respect: a list has a selected state, and a menu does
 * not. It was extracted when `Transfer` wrote it fourth, and wrote it with `focus-visible:` instead
 * of `focus:`, so it was the only one in the repository that diverged from the other three.
 *
 * `focus:`, not `focus-visible:`, and this matters: in react-aria it is `data-focused`, which is set
 * by both the arrow keys and the mouse. Highlighting them differently would mean showing two cursors
 * at once, the same argument as for the menu item below.
 */
export const LISTBOX_ITEM_CLASS =
  "flex cursor-pointer items-center rounded-sm px-2.5 py-1.5 text-[13px] outline-none " +
  "text-fg-0 hover:bg-bg-2 focus:bg-bg-2 selected:bg-accent-soft " +
  "disabled:cursor-default disabled:opacity-50";

/*
  WHY THERE ARE TWO SETS OF SELECTORS HERE.

  One row serves two libraries, and they name the states differently. Far from all of them match:

    state          react-aria          Radix
    hover          data-hovered        data-highlighted
    focus          data-focused        data-highlighted (the same thing)
    disabled       data-disabled       data-disabled, but NOT :disabled
    checked        data-selected       data-state="checked"

  The `tailwindcss-react-aria-components` plugin overrides `hover:` and `disabled:` with a double
  selector: "a RAC element OR the native pseudo-class". On Radix divs this helps only `hover:`,
  because they have a real `:hover`. `:disabled` is a pseudo-class of form fields, and on a div
  with `data-disabled` it never matches: the item would look operable while being inoperable.

  Hence the rule: a shared look table must speak both dialects. This is checked not by reasoning
  but by a snapshot of "two menus side by side" in `Menu.stories.tsx`, where a mismatch is visible
  to the eye.
*/

/** Section label inside the menu. */
export const MENU_SECTION_LABEL_CLASS =
  "text-fg-3 px-2 pt-2 pb-1 text-[11px] font-bold tracking-wide uppercase";

/** Separator between groups of items. */
export const MENU_SEPARATOR_CLASS = "bg-line -mx-1 my-1 h-px";

/** Icon to the left of the label: the check mark of a checked item, or an action icon. */
export const MENU_ITEM_ICON_CLASS = "flex size-4 shrink-0 items-center justify-center";

/** Keyboard shortcut on the right. It is a hint, not an action, which is why it is muted. */
export const MENU_ITEM_SHORTCUT_CLASS = `text-fg-3 ml-auto pl-4 text-[11px] tabular-nums ${TOUCH_HIDDEN_CLASS}`;

/** Arrow of an item that has a submenu. */
export const MENU_ITEM_SUBMENU_CLASS = "text-fg-3 ml-auto pl-4";

/**
 * Item color by tone.
 *
 * `danger` paints the TEXT AND THE ICON, not the background. An item is painted with its background
 * on hover, and a red background across the whole row would read as "selected", not "dangerous".
 * That is exactly the opposite.
 */
export const MENU_ITEM_TONE: Record<Tone, string> = {
  neutral: "text-fg-0",
  accent: TONE_TOKENS.accent.fg,
  success: TONE_TOKENS.success.fg,
  warning: TONE_TOKENS.warning.fg,
  danger: TONE_TOKENS.danger.fg,
};

/**
 * Checked toggle item: background and color come from the tone vocabulary.
 *
 * The second pair is the Radix dialect. For Radix, the checked state is expressed not by a separate
 * attribute but by the value `data-state="checked"`.
 */
export const MENU_ITEM_SELECTED_CLASS =
  `${TONE_TOKENS.accent.selectedBg} ${TONE_TOKENS.accent.selectedFg} ` +
  "data-[state=checked]:bg-accent-soft data-[state=checked]:text-accent-strong";

/** Pressed item: a signal separate from hover, set from the keyboard as well. */
export const MENU_ITEM_PRESSED_CLASS = TONE_TOKENS.neutral.pressedBg;
