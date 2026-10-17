"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { ToggleButton, ToggleButtonGroup, type Key } from "react-aria-components";
import { buttonClasses } from "../../lib/button.js";
import { cn } from "../../lib/cn.js";
import { hasContent } from "../../lib/empty.js";
import type { Size, Tone } from "../../lib/variants.js";

export interface ToggleGroupOption {
  /** The toggle's key: the set of selected ones gets into `value` and `onChange` by it. */
  id: Key;
  /** Toggle label. Without it the button is square, and an `aria-label` is needed. */
  label?: ReactNode;
  /** Icon before the label. */
  icon?: ReactNode;
  /** Accessible name when there is no label. */
  "aria-label"?: string;
  /** Disables one toggle; the others stay active. */
  disabled?: boolean;
}

export interface ToggleGroupProps {
  /** The toggles, in order. */
  options: ToggleGroupOption[];
  /** Keys (`id`) of the selected toggles: the group is controlled and holds no state of its own. */
  value: Key[];
  /** Called with the full new set of keys of the selected toggles. */
  onChange: (value: Key[]) => void;
  /**
   * How many can be selected at once.
   *
   * `multiple` is the very reason the component exists: `Segmented` handles exactly one selected,
   * because it is a mode switch — "list or tiles", "day, week, month". Here a SET is selected: a
   * filter by several statuses, enabled notification types.
   *
   * `single` is kept not for symmetry but for the case "one or none": `Segmented` cannot be cleared
   * at all, while a filter must be clearable.
   */
  selectionMode?: "multiple" | "single";
  /** Button size: `sm` or `md`. Defaults to `md`. */
  size?: Extract<Size, "sm" | "md">;
  /** Tone of the selected toggles; unselected ones are always neutral. Defaults to `accent`. */
  tone?: Tone;
  /** Disables the whole group at once. */
  disabled?: boolean;
  /** Classes for the group container. */
  className?: string;
  /** Accessible name of the group. */
  "aria-label"?: string;
}

/**
 * Toggle group: a set is selected, not a mode.
 *
 * HOW IT DIFFERS FROM `Segmented` — by multiplicity, and this is the only difference for which it is
 * worth keeping two components:
 *
 *   `Segmented`   — exactly one selected, cannot be cleared. A mode switch: "list / tiles",
 *                   "day / week / month". There is always a selected value, because there is
 *                   always a mode.
 *   `ToggleGroup` — a set from none to all. A filter by status, enabled notification types. An
 *                   empty set is a legitimate state.
 *
 * Merging them into one component with a `multiple` prop is blocked not by technique but by meaning:
 * a mode never has "nothing selected", and a shared component would have to be taught a state that
 * is an error for half of its uses.
 */
export function ToggleGroup({
  options,
  value,
  onChange,
  selectionMode = "multiple",
  size = "md",
  tone = "accent",
  disabled,
  className,
  ...rest
}: ToggleGroupProps) {
  const ref = useRef<HTMLDivElement>(null);

  /*
    Inside `Toolbar` a group with several selected gets role `group`, and from the panel's hook —
    `aria-orientation`. That attribute is not allowed for `group`, and axe reports it as `critical`
    (`aria-allowed-attr`); react-aria emits it itself, so the extra one is removed here. The role is
    set only after the first render (the panel learns about itself in a layout effect), so we watch
    the attributes rather than clear them once.
  */
  useEffect(() => {
    const group = ref.current;
    if (!group) return;
    const strip = () => {
      if (group.getAttribute("role") === "group") group.removeAttribute("aria-orientation");
    };
    strip();
    const observer = new MutationObserver(strip);
    observer.observe(group, { attributes: true, attributeFilter: ["role", "aria-orientation"] });
    return () => observer.disconnect();
  }, []);

  return (
    <ToggleButtonGroup
      {...rest}
      ref={ref}
      selectionMode={selectionMode}
      selectedKeys={value}
      onSelectionChange={(keys) => onChange([...keys])}
      isDisabled={disabled}
      className={cn(
        "flex flex-wrap items-center gap-1.5",
        // The axis comes from `Toolbar` via react-aria context; on its own the component is always
        // horizontal. In a vertical panel the group stands as a column and does not wrap: column
        // wrapping would depend on height.
        "data-[orientation=vertical]:flex-col data-[orientation=vertical]:flex-nowrap data-[orientation=vertical]:items-start",
        className
      )}
    >
      {options.map((option) => (
        <ToggleButton
          key={String(option.id)}
          id={option.id}
          isDisabled={option.disabled}
          aria-label={option["aria-label"]}
          className={({ isSelected }) =>
            cn(
              // The look is shared with a button: the selected toggle is a `solid` of its tone,
              // the unselected one is a neutral `outline`. It is assembled by a render prop,
              // because the variant depends on the state as a whole, rather than adding a class to it.
              buttonClasses({
                variant: isSelected ? "solid" : "outline",
                tone: isSelected ? tone : "neutral",
                size,
                iconOnly: !hasContent(option.label),
              })
            )
          }
        >
          {option.icon}
          {hasContent(option.label) ? <span>{option.label}</span> : null}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}
