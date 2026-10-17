"use client";

import { useEffect, useId, useMemo, useState } from "react";
import type { Key, Selection } from "react-aria-components";
import { useMessages } from "../../i18n/useMessages.js";
import { ChevronDownIcon, CloseIcon } from "../../icons.js";
import { cn } from "../../lib/cn.js";
import { FIELD_CLEAR_CLASS, FIELD_SHELL_CLASS } from "../../lib/field.js";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "../overlays/Popover.js";
import { TreeView, type TreeNode } from "../navigation/TreeView.js";
import { VisuallyHidden } from "../content/VisuallyHidden.js";

export interface TreeSelectProps {
  /** Tree nodes. The format is the same as in `TreeView`: it is the same type. */
  items: TreeNode[];
  /**
   * Selected nodes. Always an array, even with `single`: one value shape spares the consumer a
   * branch in every handler.
   */
  value: Key[];
  /** Called when a node is selected; receives the array of selected keys. */
  onChange: (value: Key[]) => void;
  /**
   * Several nodes instead of one. Also changes the look of the closed field: chips instead of a
   * caption.
   */
  multiple?: boolean;
  /** Text shown in the field when nothing is selected. */
  placeholder?: string;
  /**
   * Accessible name of the field. Required: a screen reader announces an unnamed field by its role
   * alone.
   */
  "aria-label": string;
  /** Nodes expanded on first render. */
  defaultExpandedKeys?: Iterable<Key>;
  /**
   * Expanded nodes, when expansion is controlled from outside; update them in `onExpandedChange`.
   *
   * Controlled expansion. Needed by whoever expands the tree down to the current value or loads
   * branches lazily: without it, a deeply nested selected node stays hidden inside a collapsed
   * tree, where nothing points to it.
   */
  expandedKeys?: Iterable<Key>;
  /** Called when nodes are expanded or collapsed; receives all expanded keys. */
  onExpandedChange?: (keys: Set<Key>) => void;
  /** Disables the field: the list does not open. */
  disabled?: boolean;
  /** Whether to show the clear button when something is selected. */
  clearable?: boolean;
  /** Accessible name of the clear button. Without it, `common.clear` is used, as in `Select`. */
  clearLabel?: string;
  /** Classes applied to the field wrapper. */
  className?: string;
}

/** How many chips to show before the rest collapse into a "more" counter. */
const CHIP_LIMIT = 3;

/**
 * A flat node map: the closed field needs the caption of the selected node, and that node may sit
 * deep in the tree.
 */
function flatten(nodes: TreeNode[], into = new Map<Key, TreeNode>()): Map<Key, TreeNode> {
  for (const node of nodes) {
    // A node met a second time is not expanded further: a cycle in `items` is corrupt consumer
    // data, but a stack overflow is a poor way to tell the consumer so.
    if (into.has(node.id)) continue;
    into.set(node.id, node);
    if (node.children) flatten(node.children, into);
  }
  return into;
}

/**
 * The string caption of a selected key, for the closed field.
 *
 * A key that is not in `items` is shown AS THE KEY ITSELF, not hidden. Hiding it would give a field
 * that says "nothing is selected" while reporting a non-empty value; dropping it would silently
 * rewrite the consumer's value. A shown key is at least visible, and the clear button removes it.
 */
function captionOf(id: Key, node: TreeNode | undefined): string {
  if (!node) return String(id);
  if (typeof node.label === "string") return node.label;
  return node.textValue ?? String(id);
}

/**
 * A field that selects a node of a hierarchy: a `TreeView` inside a `Popover`.
 *
 * COMPOSITION, NOT A SECOND TREE. This is a direct implementation of ADR-0024, which deferred
 * `TreeSelect` until a requesting screen needed it, worded exactly this way. The component builds no
 * traversal, keyboard handling or roles of its own: all of it already exists in `TreeView`, and a
 * divergence between two trees would only be noticed by someone who placed them side by side.
 *
 * THE FIELD NAME IS BUILT FROM THE LABEL AND THE CONTENT, not taken from `aria-label` on the button.
 * `aria-label` overrides content when computing the name, and the field would be announced as
 * "Department, button" — without a word about what is selected. For a select field this is a
 * failure of its main function, and the axe audit does not catch it, since the button does have a
 * name. The markup repeats `Select`: a hidden label plus a node with the value, both referenced
 * through `aria-labelledby`.
 *
 * THE CLEAR BUTTON IS A SIBLING OF THE TRIGGER, NOT ITS CHILD. The same approach as `Select`. A
 * button inside a button is `nested-interactive`, and an `aria-hidden` "×" icon inside it drops out of
 * the accessibility tree entirely: an AT user does not learn that clearing exists at all.
 *
 * THE VALUE IS ALWAYS AN ARRAY, even with `single`. A union type `Key | Key[]` would force the
 * consumer to parse the shape in every handler, and it would buy exactly one thing: a shorter look
 * in the example.
 *
 * SELECTING A BRANCH DOES NOT SELECT ITS DESCENDANTS, and this is not an oversight. Such behavior would
 * mean the kit decides for the consumer whether "department" covers all its staff; in access rights
 * these are exactly opposite policies. `TreeView` tracks selection by keys, and the consumer is free
 * to expand the branch into its descendants itself.
 */
export function TreeSelect({
  items,
  value,
  onChange,
  multiple = false,
  placeholder,
  "aria-label": ariaLabel,
  defaultExpandedKeys,
  expandedKeys,
  onExpandedChange,
  disabled = false,
  clearable = false,
  clearLabel,
  className,
}: TreeSelectProps) {
  const messages = useMessages();
  const [open, setOpen] = useState(false);

  /*
    Disabling the field CLOSES the panel, rather than hiding it.

    `Popover open={open && !disabled}` suppressed the display, but a controlled change of `open` in
    Radix does not call `onOpenChange`, and the internal state stayed `true`: the form went into
    submission and the panel disappeared; submission ended and the panel came back on its own, even
    though the user had not clicked anything. The same approach and for the same reason as in
    `SplitButton`.
  */
  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);
  const byId = useMemo(() => flatten(items), [items]);
  const fieldId = useId();
  const labelId = `${fieldId}-label`;
  const valueId = `${fieldId}-value`;

  const selected = useMemo(() => new Set<Key>(value), [value]);

  // Emptiness is computed from `value`, not from the found nodes: otherwise a field with an unknown
  // key would show the placeholder for an empty state while refusing to clear.
  const empty = value.length === 0;
  const captions = value.map((id) => ({ id, caption: captionOf(id, byId.get(id)) }));
  const shownChips = captions.slice(0, CHIP_LIMIT);
  const hidden = captions.length - shownChips.length;

  function onSelectionChange(keys: Selection) {
    // `all` never occurs for a tree: `Ctrl+A` lives in lists, not in `Tree`.
    const next = keys === "all" ? value : [...keys];
    onChange(next);
    // Single selection closes the popover: the goal is reached, and keeping it open would demand a
    // second gesture where everything is already said. Multiple selection keeps it open for the
    // opposite reason: the selection is not finished.
    if (!multiple) setOpen(false);
  }

  return (
    // `open && !disabled`, rather than a conditional `onOpenChange`: disabling an open popover would
    // otherwise jam it — both Escape and an outside click go through the handler, and reopening is
    // blocked by the `disabled` attribute on the button.
    <Popover open={open && !disabled} onOpenChange={setOpen}>
      {/*
        The anchor is on the WRAPPER, not on the button: `--radix-popover-trigger-width` measures
        the trigger, and with the clear button visible the trigger is narrower than the field — the
        panel came out shorter than the field it hangs under.
      */}
      <PopoverAnchor asChild>
        <span
          className={cn(
            FIELD_SHELL_CLASS,
            "flex w-full items-center gap-2 px-3 py-2",
            disabled && "cursor-not-allowed opacity-50",
            className
          )}
        >
          <VisuallyHidden id={labelId}>{ariaLabel}</VisuallyHidden>

          <PopoverTrigger asChild>
            <button
              type="button"
              disabled={disabled}
              // `grid`, not `tree`: `TreeView` declares a `treegrid` with `row` nodes (the expander
              // and the checkbox live in the row), and the declared type of the popup must match
              // what is actually inside.
              aria-haspopup="grid"
              aria-expanded={open && !disabled}
              aria-labelledby={`${labelId} ${valueId}`}
              onKeyDown={(event) => {
                // Keyboard path to clearing. The clear button next to it is also a tab stop, but
                // the Delete/Backspace pair is shorter and more familiar for a field.
                if (!clearable || empty || disabled) return;
                if (event.key !== "Delete" && event.key !== "Backspace") return;
                event.preventDefault();
                onChange([]);
              }}
              className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 bg-transparent text-left outline-none disabled:cursor-not-allowed"
            >
              <span id={valueId} className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                {empty ? (
                  <span className="text-fg-2 truncate text-[13px]">
                    {placeholder ?? messages.treeSelect.placeholder}
                  </span>
                ) : multiple ? (
                  <>
                    {shownChips.map((chip) => (
                      <span
                        key={String(chip.id)}
                        className="bg-bg-3 text-fg-1 text-caption rounded-pill inline-flex max-w-[150px] items-center px-2 py-0.5"
                      >
                        <span className="truncate">{chip.caption}</span>
                      </span>
                    ))}
                    {/*
                    A collapsed tail instead of all chips in a row: a field that grows five lines
                    tall stops being a field. The threshold is deliberately low — the exact
                    selection is checked in the expanded tree.
                  */}
                    {hidden > 0 && (
                      <span className="text-fg-2 text-caption">
                        {messages.treeSelect.more({ count: hidden })}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-fg-0 truncate text-[13px]">{captions[0]?.caption}</span>
                )}
              </span>
              <ChevronDownIcon size={16} aria-hidden className="text-fg-2 shrink-0" />
            </button>
          </PopoverTrigger>

          {clearable && !empty && !disabled ? (
            <button
              type="button"
              aria-label={clearLabel ?? messages.common.clear}
              onClick={() => onChange([])}
              className={FIELD_CLEAR_CLASS}
            >
              <CloseIcon size={10} aria-hidden />
            </button>
          ) : null}
        </span>
      </PopoverAnchor>

      <PopoverContent className="max-h-[320px] w-[var(--radix-popover-trigger-width)] overflow-auto p-1">
        <TreeView
          items={items}
          aria-label={ariaLabel}
          selectionMode={multiple ? "multiple" : "single"}
          selectedKeys={selected}
          onSelectionChange={onSelectionChange}
          defaultExpandedKeys={defaultExpandedKeys}
          expandedKeys={expandedKeys}
          onExpandedChange={onExpandedChange}
          // `empty`, not `notFound`: the field has no search of its own, so the user never made a
          // query that could produce "nothing found". The kit's message catalog separates these two
          // strings explicitly: `notFound` means there is a query, `empty` means there is no data
          // at all.
          emptyText={messages.common.empty}
        />
      </PopoverContent>
    </Popover>
  );
}
