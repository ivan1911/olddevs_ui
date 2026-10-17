"use client";

import type { ReactNode } from "react";
import {
  Button as AriaButton,
  ComboBox as AriaComboBox,
  Input,
  ListBox,
  ListBoxItem,
  Popover,
  type ComboBoxProps as AriaComboBoxProps,
  type Key,
} from "react-aria-components";
import { useFieldDescribedBy } from "../../hooks/useFieldDescription.js";
import { SelectIcon } from "../../icons.js";
import { cn } from "../../lib/cn.js";
import { LISTBOX_ITEM_CLASS } from "../../lib/menu.js";
import { useMessages } from "../../i18n/useMessages.js";
import { FIELD_INPUT_CLASS, FIELD_SHELL_CLASS } from "../../lib/field.js";

export interface ComboboxItem {
  /** Key of the item, unique within `items`. */
  id: Key;
  /** Label of the item in the list and in the input field. */
  label: string;
  /** Right column of the item: a counter, a date, anything short. */
  meta?: ReactNode;
}

export interface ComboboxProps extends Omit<
  AriaComboBoxProps<ComboboxItem>,
  "children" | "items" | "className" | "defaultItems" | "style"
> {
  /** Suggested items; the list narrows as the text is typed. */
  items: ComboboxItem[];
  /** Placeholder in the empty input field. */
  placeholder?: string;
  /** Text shown when nothing matches the input. */
  notFoundText?: string;
  /** Classes for the root element. */
  className?: string;
}

/**
 * Field with suggestions: free input plus a list.
 *
 * NOT A REPLACEMENT FOR `Select`, and not an extension of it. The difference is where the
 * value comes from:
 *
 *   `Select`   — choosing from a CLOSED set. There is no value outside the list, and nothing
 *                can be typed in: search inside (`searchable`) only filters, and the result
 *                is still one of the items.
 *   `Combobox` — input WITH SUGGESTIONS. The list helps but does not restrict: the value may
 *                match none of the items (`allowsCustomValue`).
 *
 * Hence the rule for choosing: if the set is known and finite, use `Select`. If the user may
 * enter their own value (a tag, a name, an address), use `Combobox`. Without this boundary,
 * after six months a project ends up with both mixed together on one task.
 *
 * The behavior is entirely react-aria's: filtering, keyboard handling, `aria-activedescendant`,
 * and announcing the number of suggestions. The kit holds the look and the boundary of use.
 */
export function Combobox({
  items,
  placeholder,
  notFoundText,
  menuTrigger = "focus",
  className,
  ...rest
}: ComboboxProps) {
  const messages = useMessages();

  /**
   * The field's description from `FormField`, plus its own if the consumer passed one.
   *
   * The same technique as `TextControl` and `NumberInput`: the values are MERGED, not replacing
   * each other. Outside `FormField` the context is empty, the spread is empty, and the markup
   * is the same as it was before descriptions appeared.
   */
  const fieldDescribedBy = useFieldDescribedBy();
  const describedBy =
    [rest["aria-describedby"], fieldDescribedBy].filter(Boolean).join(" ") || undefined;

  return (
    /*
      `menuTrigger="focus"` instead of react-aria's default (`input`) is deliberate.
      With `input`, the list appears only after the first typed character, and a click on the
      field shows nothing. The suggestions, which are the reason the component exists, stay
      invisible until you guess the first letter. Verified in the browser.

      The button on the right opens the list with any value of the prop. The consumer may change
      it back, for example when there are thousands of suggestions and showing them all is
      pointless.
    */
    <AriaComboBox
      {...rest}
      aria-describedby={describedBy}
      menuTrigger={menuTrigger}
      items={items}
      className={cn("w-full", className)}
    >
      <div className={cn(FIELD_SHELL_CLASS, "flex items-center gap-2")}>
        <Input
          placeholder={placeholder}
          data-disable-focus-ring="true"
          className={cn(FIELD_INPUT_CLASS, "min-w-0 flex-1")}
        />
        {/*
          The toggle button is an `AriaButton`, not our own. `ComboBox` passes it the state
          through the react-aria context, and a plain `<button>` does not read that state: the
          list would silently never open. The same mechanism as `MenuButton`.
        */}
        <AriaButton
          className="text-fg-3 hover:text-fg-1 flex shrink-0 cursor-pointer items-center outline-none"
          // It has its own label. Without one, the audit reports it as unnamed, and the
          // field's label does not apply to the button: the field and the button are
          // different targets.
          aria-label={messages.combobox.showSuggestions}
        >
          <SelectIcon size={14} />
        </AriaButton>
      </div>

      <Popover className="border-line-soft bg-bg-1 rounded-control w-[var(--trigger-width)] border p-1 shadow-[var(--shadow-2)]">
        <ListBox
          className="max-h-[280px] overflow-y-auto outline-none"
          renderEmptyState={() => (
            <div className="text-fg-2 px-3 py-4 text-center text-sm">
              {notFoundText ?? messages.common.notFound}
            </div>
          )}
        >
          {(item: ComboboxItem) => (
            <ListBoxItem
              id={item.id}
              textValue={item.label}
              className={cn(
                // The common list row, the same as in `Transfer` and `CommandPalette`. Our
                // own set diverged from it in padding (`py-[9px]` against `py-1.5`) and in
                // font size, so the kit's lists placed side by side differed in row height.
                LISTBOX_ITEM_CLASS,
                "selected:text-fg-0 justify-between gap-3"
              )}
            >
              <span className="truncate">{item.label}</span>
              {item.meta != null ? (
                <span className="text-fg-2 text-caption shrink-0">{item.meta}</span>
              ) : null}
            </ListBoxItem>
          )}
        </ListBox>
      </Popover>
    </AriaComboBox>
  );
}
