"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { useFieldDescribedBy } from "../../hooks/useFieldDescription.js";
import { cn } from "../../lib/cn.js";
import { LISTBOX_ITEM_CLASS } from "../../lib/menu.js";
import { FIELD_CLEAR_CLASS } from "../../lib/field.js";
import { useMessages } from "../../i18n/useMessages.js";
import { CheckIcon, CloseIcon, SelectIcon } from "../../icons.js";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "../overlays/Popover.js";
import { VisuallyHidden } from "../content/VisuallyHidden.js";

/** The minimum the list requires from an item. The other fields are yours. */
export interface SelectItem {
  /** Item identifier; this is what goes into `value` and `onChange`. */
  id: string | number;
  /** Label in the list and in the trigger. Search matches on it too. */
  label: string;
  /** Extra text for search: a slug, a description, synonyms. Not shown. */
  keywords?: string;
  /** What to show on the right of an unselected item: a counter, a date, a tone. */
  meta?: ReactNode;
}

/**
 * Identifier of a list item.
 *
 * Exported because it is part of the public signature: `value` and `onChange` are typed with it.
 * Without the export, a consumer declaring state or a handler would write
 * `string | number | null` by hand — that is, duplicate the kit's definition in their own code,
 * and would learn about a change to it from something other than the compiler.
 *
 * The type is wider than `string` exactly because of `id` on `SelectItem`: categories come from
 * the server with numeric identifiers, collections with string ones.
 */
export type SelectId = string | number;

/** The part shared by both axes: everything that does not depend on multiplicity. */
interface SelectCommonProps<T extends SelectItem> {
  /** The list items. */
  items: T[];
  /** Trigger label when nothing is selected: "Category", "Author". */
  placeholder: string;
  /**
   * The search field in the popover. Off by default: there is no reason to search a list of three
   * statuses, and a field there is just an extra step.
   */
  searchable?: boolean;
  /** Placeholder of the search field in the popover. */
  searchPlaceholder?: string;
  /** Shown when the list is empty to begin with. */
  emptyText?: string;
  /** Shown when the search result is empty. */
  notFoundText?: string;
  /** Whether to show the clear button for the selected value. */
  clearable?: boolean;
  /**
   * Whether to highlight the trigger with the accent when a value is selected.
   *
   * In filters — yes, and that is the default: there the highlight means "filter applied", and it
   * is looked for by eye while scanning the popover. In a form it would mean "field filled" — and
   * a filled field is the norm, not an event, and next to ordinary `TextControl`s an accent pill
   * looks like an alarm on an empty spot.
   *
   * With this off, the trigger keeps a neutral border; the background and radius to match the
   * neighboring fields are set by the consumer through `triggerClassName`, since the package does
   * not know which look a given form uses.
   */
  highlightSelected?: boolean;
  /**
   * Renders a picture to the left of the label: a preview, an emoji, an avatar.
   *
   * The picture sits on the left: a preview, an emoji, an avatar. `px` is the side of the square
   * the markup expects: 20 in the trigger, 28 in the list. The size is passed as a number rather
   * than as a `size` step, because it is the list's internal geometry, not an axis.
   *
   * 20 in the trigger is exactly the line box of the control (`leading-5`), and the square is that
   * size for exactly that reason: anything taller than the line stretches the trigger, and it
   * diverges in height from a neighboring `TextControl`.
   */
  renderMedia?: (item: T, px: number) => ReactNode;
  /**
   * The icon on the left in the collapsed state — when nothing is selected. For a selected value
   * its place is taken by `renderMedia`.
   *
   * By default this is `SelectIcon` from the kit's icon set — the common up-and-down arrow of a
   * dropdown. Previously a text character `⌄` stood here, because the package deliberately did not
   * pull in an icon library; in practice this meant the component could not be restyled at all,
   * and the consumer had to pass an icon by hand at every call site.
   *
   * A custom icon is still passed here — it gets `aria-hidden` from the wrapper, because the label
   * next to it already names everything.
   */
  icon?: ReactNode;
  /** Whether the list is open, when it is controlled from outside; update it in `onOpenChange`. */
  open?: boolean;
  /** Called when the list opens and closes. */
  onOpenChange?: (open: boolean) => void;
  /**
   * Classes for the trigger: layout, inner padding, border radius, background.
   *
   * This is also where the label's width limit is lifted if the trigger is wide:
   * `[--select-label-max:none]`. By default the label is truncated at 110px, so that a filter pill
   * does not stretch over a long name.
   */
  triggerClassName?: string;
  /** Classes for the popover. */
  contentClassName?: string;
  /** Accessible name of the clear button. */
  clearLabel?: string;
  /**
   * How to label a value for which no item was found in `items`.
   *
   * This happens in two ordinary cases: the value came from the URL while the list is still
   * loading, or the value points to a deleted record. By default the key itself is shown — it is
   * more honest than a placeholder when it is human-readable (`section-contracts`). But if your
   * identifiers are machine-generated, the user will see `9f2c1b04-…`; then the label is set by
   * this prop — the kit does not know what your keys look like.
   */
  missingLabel?: (id: SelectId) => ReactNode;
  /**
   * Disabled field: the trigger does not take focus, the popover does not open, the clear button
   * disappears, and the look is dimmed.
   *
   * The behavior and the look match `Button` and `TextControl`, and they are set up exactly for
   * that reason: the consumer disables the whole form while a request is in flight, and a field
   * left active among its dimmed neighbors reads as an oversight, not as a design choice.
   */
  disabled?: boolean;
  /**
   * The accessible name of the field — "Icon", "Project".
   *
   * WITHOUT IT THE TRIGGER IS NAMED BY ITS CONTENT, that is, by the label of the selected value or
   * by the placeholder. In a filter popover that is enough: there the placeholder is the name of
   * the filter. In a form it is not: a sighted user sees the label "Icon" above the field, while a
   * screen reader announces "No icon, button", and two such fields side by side cannot be told
   * apart by ear. The `FormField` label does not reach here on its own: a composite control does
   * not accept `id`, so there is nothing for `htmlFor` to bind to.
   *
   * THE NAME IS COMBINED WITH THE CONTENT rather than replacing it: the string goes into a hidden
   * node, and the trigger is announced as "Icon, Circle, button". A plain `aria-label` on the button
   * would win over the content, and the select field would stop reporting what is selected in it.
   * The same technique, for the same reason, is used in `TreeSelect`.
   */
  "aria-label"?: string;
  /**
   * Name of the trigger, as a reference to the `id` of a label that is already shown.
   *
   * It is the same name, but as a reference to a label that is already drawn: the consumer has it
   * on screen, and repeating its text here would create a second source that silently drifts
   * apart from the first.
   *
   * It combines with the content in the same way as `aria-label`. If both are set, the reference
   * wins: the visible label is closer to what a person reads with their eyes.
   */
  "aria-labelledby"?: string;
  /**
   * The trigger's own description. It is merged with the `FormField` description rather than
   * replacing it: the form hint and the consumer's note must both be announced.
   */
  "aria-describedby"?: string;
}

/*
  The label width limit is ONE for all branches of the trigger.

  It used to be set only on the selected value, and the other two labels grew freely: the counter
  of multiple selection and the label of a vanished value (`missingLabel`). A consumer measured it:
  a pill reading "Project deleted" took 170 pixels against 120 for an ordinary one — one such pill
  was enough to make the filter bar wrap onto a second line. `truncate` was there, but it had
  nothing to cut: without a `max-width` the line takes up as much room as it takes.

  The placeholder is deliberately without a limit: it is the default state, every consumer already
  has its layout built around it, and cutting it after the fact would change the look where nobody
  had complained.
*/
const LABEL_CLASS = "max-w-[var(--select-label-max,110px)] truncate";

export type SelectProps<T extends SelectItem> =
  | (SelectCommonProps<T> & {
      /** Single-item selection. The default. */
      multiple?: false;
      /**
       * The selected `id` or, with `multiple`, an array of `id` values. Compared as strings: `1`
       * and `"1"` are the same; the array keeps the order in which the values arrived.
       */
      value?: SelectId | null;
      /**
       * Receives the `id` of the selected item, or `null` when the selection is cleared.
       *
       * Previously clearing returned an empty string, and the agreement held only through a comment:
       * in the type, `""` cannot be told apart from any other `string`. `null` is visible to the
       * compiler, and the consumer must handle it.
       */
      onChange: (id: SelectId | null) => void;
    })
  | (SelectCommonProps<T> & {
      /** Multiple-item selection: `value` is an array of `id`s, `onChange` receives an array. */
      multiple: true;
      /**
       * The selected `id` or, with `multiple`, an array of `id` values. Compared as strings: `1`
       * and `"1"` are the same; the array keeps the order in which the values arrived.
       */
      value?: SelectId[];
      /** Always an array: clearing gives an empty one, not `null`. */
      onChange: (ids: SelectId[]) => void;
      /**
       * The trigger label when more than one item is selected: "Categories: 3".
       * Pluralization is the consumer's job: the package knows neither the language of the label
       * nor that `placeholder` was in the singular.
       */
      countLabel?: (count: number) => ReactNode;
    });

/**
 * A dropdown with two orthogonal axes: `searchable` and `multiple`.
 *
 * It replaced `SearchSelect`, which could do exactly one combination: "with search, single".
 * The axes are kept separate because the front end at the time had both it and two hand-written
 * dropdowns (status and tone) that repeated its trigger and its popover without search: a hundred
 * lines of copy just for a disabled search row.
 *
 * The types are a union over `multiple`, rather than `SelectId | SelectId[] | null` in one field.
 * The difference is fundamental: with a union the compiler itself knows what arrives in `onChange`,
 * and the consumer does not have to narrow the type in every handler.
 *
 * TWO THINGS ARE BUILT DIFFERENTLY FROM THE PREVIOUS FRONT-END DROPDOWNS, AND THIS IS NOT COSMETIC:
 *
 * 1. The clear button is a real `<button>` next to the trigger, not a `<span>` with an `onClick`
 *    inside it. Nested interactive content is invalid markup, and such a clear button was not
 *    reachable from the keyboard at all: Tab could not get to it, and Enter on it opened the list
 *    instead of clearing.
 * 2. The trigger reports its state: `aria-expanded` and `aria-haspopup="listbox"`. The previous
 *    version gave screen readers a plain button, from which it was impossible to tell either what
 *    it opened or what was already selected.
 */
export function Select<T extends SelectItem>(props: SelectProps<T>) {
  /**
   * The description of the field from `FormField`, plus the consumer's own if the consumer passed one.
   *
   * The same technique as in `TextControl` and `NumberInput`: the values are MERGED, not replaced.
   * Outside `FormField` the context is empty, and the markup is the same as it was before
   * descriptions appeared.
   */
  const fieldDescribedBy = useFieldDescribedBy();
  const describedBy =
    [props["aria-describedby"], fieldDescribedBy].filter(Boolean).join(" ") || undefined;

  const {
    items,
    placeholder,
    searchable = false,
    searchPlaceholder,
    emptyText,
    notFoundText,
    clearable = true,
    highlightSelected = true,
    renderMedia,
    icon,
    open: controlledOpen,
    onOpenChange,
    triggerClassName,
    contentClassName,
    clearLabel,
    missingLabel,
    disabled = false,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
  } = props;

  const messages = useMessages();
  const [internalOpen, setInternalOpen] = useState(false);
  const [search, setSearch] = useState("");

  const open = controlledOpen ?? internalOpen;

  /**
   * THE TRIGGER'S NAME IS ASSEMBLED FROM THE LABEL AND THE CONTENT.
   *
   * An `aria-label` on the button would win over the content, and the field would be announced as
   * "Icon, button" — without a single word about what is selected in it. For a select field that is
   * a failure of its main function, and axe does not catch it, because the button does have a name.
   * So the label goes into a hidden node, and `aria-labelledby` lists it together with the value
   * node. The layout repeats `TreeSelect`.
   *
   * Without a label the attribute is absent altogether: the name is then computed from the content,
   * as it was before these props existed — in a filter popover the placeholder is the name.
   */
  const fieldId = useId();
  const labelId = `${fieldId}-label`;
  const valueId = `${fieldId}-value`;
  const labelledBy = ariaLabelledBy ?? (ariaLabel ? labelId : undefined);

  /*
    Disabling CLOSES the popover, rather than hiding it.

    A bare `open && !disabled` in the markup is not enough: a controlled change of `open` in Radix
    does not call `onOpenChange`, and the state would stay `true` — the form went into submission,
    the popover disappeared, submission ended, and the popover came back on its own, though the
    user had pressed nothing. The same technique, for the same reason, as in `TreeSelect` and
    `SplitButton`.

    The closing is announced OUTWARD, not only inward. `TreeSelect`'s state is always its own, but
    here `open` may be controlled: clearing only the internal value would close the popover on
    screen and leave `true` in the consumer's state — exactly the reopening this effect is there
    to prevent.

    The callback is called only if the popover was open: otherwise every disabling of the field
    would send `onOpenChange(false)` about something that never happened.
  */
  useEffect(() => {
    if (!disabled || !open) return;
    setInternalOpen(false);
    onOpenChange?.(false);
    // The dependency list has one entry: the effect is about the MOMENT the field gets disabled.
    // `open` and the callback are read at that moment and do not need to re-run it.
  }, [disabled]);

  /**
   * The internal state is ALWAYS updated, even when the consumer listens to `onOpenChange`.
   * Otherwise a consumer who passed only a callback and no `open` got a list that never opened:
   * `setOpen` went to the callback, while `internalOpen` stayed `false`.
   */
  const setOpen = (next: boolean) => {
    setInternalOpen(next);
    onOpenChange?.(next);
  };

  /**
   * Both axes are reduced to one list of strings — the rest of the markup does not care.
   *
   * An empty string also means "not selected". The component gives `null` on clearing, but consumers
   * keep filters in the URL, where empty is expressed as exactly `""`, and send it back. Treating
   * `""` as a selection would show a counter "Status: 1" on a filter where nothing is selected.
   */
  const selectedIds = props.multiple
    ? (props.value ?? []).map(String).filter((v) => v !== "")
    : props.value === null || props.value === undefined || props.value === ""
      ? []
      : [String(props.value)];

  const selected =
    selectedIds.length === 1 ? items.find((i) => String(i.id) === selectedIds[0]) : undefined;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) => i.label.toLowerCase().includes(q) || (i.keywords ?? "").toLowerCase().includes(q)
    );
  }, [items, search]);

  const select = (item: T) => {
    if (props.multiple) {
      // The popover stays open: multiple selection of a single item makes no sense, and closing it
      // after each click would force reopening it every time.
      const id = String(item.id);
      const current = props.value ?? [];
      props.onChange(
        current.some((v) => String(v) === id)
          ? current.filter((v) => String(v) !== id)
          : [...current, item.id]
      );
      return;
    }
    props.onChange(item.id);
    setSearch("");
    setOpen(false);
  };

  const clear = () => {
    if (props.multiple) props.onChange([]);
    else props.onChange(null);
    setSearch("");
    setOpen(false);
  };

  const hasSelection = selectedIds.length > 0;
  // `Set` rather than `includes` on every row: the list can have thousands of items and hundreds of
  // selected ones, and on every character typed into the search that meant hundreds of thousands of
  // string comparisons synchronously, before rendering.
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds.join("\u0000")]);
  const countLabel = props.multiple ? props.countLabel : undefined;

  /**
   * KEYBOARD IN THE POPOVER. Focus moves across real buttons (roving focus) rather than through
   * `aria-activedescendant`: the items of the list here are full `<button>`s, and a second way of
   * addressing them would add nothing except a mismatch between "where the screen reader is looking"
   * and "where focus actually is".
   *
   * There is one handler for the whole popover rather than one per item. Events do not always reach
   * the items: right after opening, focus is either in the search field or on the popover itself
   * (Radix focuses it), and events from there do not bubble up to the list, because the list is
   * inside them, not outside.
   */
  const searchRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);

  /**
   * The live buttons of the list. Filtering out holes is required: React nulls a ref on unmount, so
   * after narrowing the search the array keeps `null`s in the places of the items that dropped out —
   * and `End` would send focus into such a hole, that is, nowhere. We compute it here rather than
   * trimming the array in render: writing to a ref during render is not allowed.
   */
  const liveOptions = () => optionRefs.current.filter((el): el is HTMLButtonElement => el !== null);

  const focusOption = (index: number) => {
    const options = liveOptions();
    if (options.length === 0) return;
    // The ends do not wrap around: the list is not a carousel, and "down" from the last item jumping
    // to the first reads as a miss, not as a transition.
    options[Math.max(0, Math.min(index, options.length - 1))]?.focus();
  };

  const onPanelKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const inSearch = document.activeElement === searchRef.current;
    const current = liveOptions().indexOf(document.activeElement as HTMLButtonElement);

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        // From the search field and from the popover itself — to the first item.
        focusOption(current < 0 ? 0 : current + 1);
        return;
      case "ArrowUp":
        if (inSearch) return;
        e.preventDefault();
        // Up from the first item goes back to the search: otherwise focus hits the top of the list,
        // and the field stays reachable only with the mouse.
        if (current <= 0 && searchable) searchRef.current?.focus();
        else focusOption(current < 0 ? 0 : current - 1);
        return;
      case "Home":
      case "End":
        // In the search field this moves the caret along the line, not through the list.
        if (inSearch) return;
        e.preventDefault();
        focusOption(e.key === "Home" ? 0 : liveOptions().length - 1);
        return;
    }

    // Typing from a list item returns to the search: a user who starts typing a name means search,
    // not the list.
    //
    // Space is excluded deliberately — on a button it selects the item, and handing it to search
    // would break the standard way to select an item from the keyboard.
    if (!searchable || inSearch || current < 0) return;
    if (e.key === "Backspace") {
      e.preventDefault();
      setSearch((s) => s.slice(0, -1));
      searchRef.current?.focus();
      return;
    }
    if (e.key.length === 1 && e.key !== " " && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      setSearch((s) => s + e.key);
      searchRef.current?.focus();
    }
  };

  return (
    <Popover
      // `open && !disabled`, not a conditional `onOpenChange`: disabling while the popover is open
      // would otherwise jam it — both Escape and an outside click go through the handler, and the
      // `disabled` attribute gets in the way of reopening.
      open={open && !disabled}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setSearch("");
      }}
    >
      {/*
        The pill is the outer box, and the button inside it is stretched over its whole area via
        `after:inset-0`. This resolves three requirements at once, which otherwise conflict:

        1. The clear button must be a separate button: nested interactive content is invalid, and the
           previous `<span onClick>` inside a button was, moreover, unreachable from the keyboard.
        2. The whole pill is clickable, including its padding. An intermediate variant, where the
           button was only the inside of a wrapper, left a 26px dead zone under `cursor-pointer` —
           the cursor promised a click where there was none.
        3. `triggerClassName` acts on the same box as before the move: the consumer sends a mix of
           layout (`w-full`, `min-w`) and look (`px-3`, `rounded-control`). There is nothing to split
           this across two elements, so the row stays entirely on the pill. When it hung on the wrapper
           while the padding was also on the button, the two added up: on the campaigns screen the
           control grew from 36 to 56 pixels next to 36-pixel neighbors.

        The focus ring is drawn on a pseudo-element, not on the button: the outline must go around
        the whole pill, otherwise it would be narrower than the pill's own outline.
      */}
      {/*
        The popover anchor is the whole pill, not the trigger button inside it: the button is inset
        from the bottom edge by the border and `py-[7px]`, and a popover with a `sideOffset` of 4px
        overlapped the pill instead of leaving a gap.
      */}
      <PopoverAnchor asChild>
        <span
          className={cn(
            "relative inline-flex items-center gap-2 rounded-full border px-3 py-[7px]",
            // `leading-5` sets the height rather than inheriting it: a 20px line box plus padding gives
            // exactly 36 — the height of a `md` `Button`, next to which the pill sits in the filter bar.
            // With the form's padding (`py-2.5` from the consumer) the same 20 gives 42 — the height of
            // `TextControl` and `NumberInput` (see `lib/field.ts`).
            //
            // The picture of the selected value is 20 too, and this is a condition, not a coincidence:
            // content taller than the line box would stretch the trigger. While it was 22, a pill with
            // a picture grew to 38, and the form trigger to 44, and the control diverged both from the
            // neighboring field and from itself in the empty state.
            // `transition-colors`, not `transition-all`: on this box only the border, background and label
            // color change — by the `hasSelection` branch. `all` promised a transition to everything that
            // is not on the pill, and to whatever the consumer sends through `triggerClassName`. Replaced
            // in wave 27 during a motion review: the class looked like it animated movement, while there
            // is nothing here to move.
            "text-[13px] leading-5 font-semibold transition-colors",
            hasSelection && highlightSelected
              ? "border-accent-strong bg-accent-soft text-fg-0"
              : "border-line-soft text-fg-1 hover:border-line hover:bg-bg-2 bg-transparent",
            // The selected value reads dark even without the accent highlight: the label is the control's
            // content, not a hint.
            hasSelection && !highlightSelected && "text-fg-0",
            // The PILL is dimmed, not the button inside it: the border and background are drawn here, and
            // a dimmed label next to a bright border would look like a rendering glitch, not a disabled field.
            disabled && "cursor-not-allowed opacity-50",
            triggerClassName
          )}
        >
          {/*
          The label is visible only to screen readers and sits OUTSIDE the button: inside it, it would
          become part of the content and be read twice — once as the name, a second time as the value.

          `elementType="span"`: by default react-aria renders a `<div>`, and here it would end up inside
          an inline pill.
        */}
          {ariaLabel && !ariaLabelledBy ? (
            <VisuallyHidden elementType="span" id={labelId}>
              {ariaLabel}
            </VisuallyHidden>
          ) : null}

          <PopoverTrigger asChild>
            <button
              type="button"
              disabled={disabled}
              aria-haspopup="listbox"
              aria-expanded={open && !disabled}
              aria-labelledby={labelledBy ? `${labelledBy} ${valueId}` : undefined}
              aria-describedby={describedBy}
              className={cn(
                // `grow` + `justify-between`: when the consumer stretches the pill (`w-full`, `min-w`), the
                // button takes the full width, and its `justify-between` separates the icon and the label —
                // as it did before the move. On a pill sized to its content there is no free space, and
                // neither class changes anything.
                "inline-flex min-w-0 grow cursor-pointer items-center justify-between gap-2 text-left",
                "disabled:cursor-not-allowed",
                "after:absolute after:inset-0 after:rounded-[inherit]",
                "focus-visible:after:outline-accent-strong focus-visible:after:outline-2 focus-visible:after:outline-offset-2",
                // The space for the clear button is on the button, not on the pill: the pill already carries
                // the consumer's padding, and adding to it would shift the border.
                hasSelection && clearable && !disabled && "pr-6"
              )}
            >
              {/*
              The content is wrapped in one group rather than laid out as siblings of the button.
              Otherwise `justify-between` separates exactly those: in a pill sized to its content this goes
              unnoticed, but in a wide trigger (`w-full` in a form) the picture sticks to the left edge, the
              label to the right, and between them there is a gap the full width of the row.
            */}
              {selected ? (
                <span id={valueId} className="inline-flex min-w-0 items-center gap-2">
                  {renderMedia?.(selected, 20)}
                  {/*
                  The label width is limited by a variable, not a hard number. In a filter pill the limit is
                  needed: it grows with its content, and "Abstract gradients" would push the neighboring
                  filters aside. In a wide form trigger (`w-full`), on the contrary, it lies: there is room,
                  yet the label was still cut at 110 pixels. The limit is lifted by a class on the trigger:
                  `triggerClassName="[--select-label-max:none]"`.
                  */}
                  <span className={LABEL_CLASS}>{selected.label}</span>
                </span>
              ) : hasSelection && props.multiple ? (
                /*
                The counter is STRICTLY for multiple selection.

                This branch used to also catch a single `Select` that has a value but no matching item in
                `items`: the value came from the URL while the list was loading, or points to a deleted
                record. The trigger showed "Category: 1" — a counter where there was nothing to count. The
                single-select case now goes to the branch below and shows the key itself, as `captionOf`
                does in `TreeSelect`.
              */
                <span id={valueId} className={LABEL_CLASS}>
                  {countLabel
                    ? countLabel(selectedIds.length)
                    : `${placeholder}: ${selectedIds.length}`}
                </span>
              ) : hasSelection ? (
                /*
                A single selection that has no matching item.

                The key is MORE HONEST than a placeholder when it is human-readable (`section-contracts`), and
                worse than one when it is a UUID: the user sees `9f2c1b04-…` where they expected a label. The
                consumer decides this — only it knows what its identifiers look like — so the label for a
                missing value is taken from a prop, and by default the key is shown, as `captionOf` does in
                `TreeSelect`.
              */
                <span id={valueId} className={LABEL_CLASS}>
                  {missingLabel ? missingLabel(selectedIds[0]!) : selectedIds[0]}
                </span>
              ) : (
                /*
                The `id` of the value sits on the ROOT OF EACH BRANCH, rather than on a shared wrapper around
                them: the wrapper is an extra box in the trigger's flex row, and it would shift the content
                where nobody asked to change it.
              */
                <span id={valueId} className="inline-flex min-w-0 items-center gap-2">
                  <span aria-hidden className="inline-flex shrink-0 items-center opacity-60">
                    {icon ?? <SelectIcon size={14} />}
                  </span>
                  <span className="truncate">{placeholder}</span>
                </span>
              )}
            </button>
          </PopoverTrigger>

          {hasSelection && clearable && !disabled ? (
            <button
              type="button"
              aria-label={clearLabel ?? messages.common.clear}
              onClick={clear}
              className={FIELD_CLEAR_CLASS}
            >
              <CloseIcon size={10} aria-hidden />
            </button>
          ) : null}
        </span>
      </PopoverAnchor>

      <PopoverContent
        className={cn("w-[260px]", contentClassName)}
        align="start"
        onKeyDown={onPanelKeyDown}
      >
        {searchable ? (
          <div className="border-line-soft border-b px-3 py-2">
            <div className="border-line-soft bg-bg-2 focus-within:border-accent-strong flex items-center gap-2 rounded-sm border px-3 py-2 transition-[border-color,box-shadow] focus-within:ring-[3px] focus-within:ring-[color:var(--focus-ring)]">
              <input
                ref={searchRef}
                type="text"
                // The popover is already outlined by the focus ring — a second outline inside it is redundant.
                data-disable-focus-ring="true"
                aria-label={searchPlaceholder ?? messages.common.searchPlaceholder}
                placeholder={searchPlaceholder ?? messages.common.searchPlaceholder}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="text-fg-0 placeholder:text-fg-2 w-full border-none bg-transparent text-[13px] outline-none"
                autoFocus
              />
            </div>
          </div>
        ) : null}

        <div
          role="listbox"
          aria-multiselectable={props.multiple ? true : undefined}
          className="max-h-[280px] overflow-y-auto p-1"
        >
          {filtered.length === 0 ? (
            <div className="text-fg-2 px-3 py-4 text-center text-[13px]">
              {search
                ? (notFoundText ?? messages.common.notFound)
                : (emptyText ?? messages.common.empty)}
            </div>
          ) : (
            filtered.map((item, index) => {
              const isSelected = selectedSet.has(String(item.id));
              return (
                <button
                  key={item.id}
                  ref={(el) => {
                    optionRefs.current[index] = el;
                  }}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => select(item)}
                  /*
                    `data-selected` — so that the SHARED list row works here too.

                    The `selected:` variant of the plugin expands into `[data-selected]` without requiring
                    `data-rac` (`selected` has no native counterpart), so the ordinary button can use it too.
                    This way a `Select` row is finally painted the same way as `Combobox`, `CommandPalette` and
                    `Transfer`: its own set diverged from them both in padding (`py-[9px]` against `py-1.5`)
                    and in the selection color (`bg-bg-3` against `selected:bg-accent-soft`) — the kit's lists,
                    placed side by side, differed in row height and in how a selected item looked.
                  */
                  data-selected={isSelected || undefined}
                  className={cn(
                    LISTBOX_ITEM_CLASS,
                    // Only what is not about the look of a list row stays custom:
                    // a full-width button, the gap for the media, and the focus ring.
                    "w-full gap-[10px] text-left transition-colors",
                    "focus-visible:outline-accent-strong focus-visible:outline-2 focus-visible:-outline-offset-2"
                  )}
                >
                  {renderMedia?.(item, 28)}
                  <span className="flex-1 truncate font-medium">{item.label}</span>
                  {isSelected ? (
                    <CheckIcon size={14} aria-hidden className="text-accent-strong shrink-0" />
                  ) : (
                    <span className="text-fg-2 font-mono tabular-nums">{item.meta}</span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
