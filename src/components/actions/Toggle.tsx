"use client";

import { forwardRef, useId, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { useDescribedBy } from "../../hooks/useFieldDescription.js";
import { cn } from "../../lib/cn.js";
import { devWarn } from "../../lib/dev-warn.js";
import { hasContent } from "../../lib/empty.js";
import { STATE_BORDER } from "../../lib/variants.js";

interface ToggleBaseProps extends Omit<
  ComponentPropsWithoutRef<"button">,
  "onChange" | "value" | "children" | "aria-label"
> {
  /** Whether the switch is on. A controlled value: the component holds no state of its own. */
  checked: boolean;
  /** Called with the new value on press, unless someone else's `onClick` cancelled it via `preventDefault`. */
  onCheckedChange: (checked: boolean) => void;
}

/**
 * The switch's name: either `label` with no visible text, or a visible label in `children` with an
 * optional `description`. Exactly one source of the name — as with `TagGroup`: two would drift
 * apart silently when edited, and by ear the switch would be called something other than on the
 * screen.
 *
 * THE RULE "EXACTLY ONE" IS CHECKED IN DEVELOPMENT, NOT BY THE TYPE. A `label | children` union
 * would break the consumer: `interface X extends ToggleProps` does not compile from a union, and
 * `Omit<ToggleProps, …>` over it merges the branches into a type that fits none of them. That would
 * mean a major version for the sake of a minor change.
 */
export interface ToggleProps extends ToggleBaseProps {
  /**
   * Accessible name for when there is no visible label.
   *
   * The switch is a `<button role="switch">` with no text inside. Wrapping it in a `<label>` does
   * not give it a name: `<label>` associates with form fields, not with a button. Without a name, a
   * screen reader announces an unnamed switch, and this defect is invisible to the eye.
   *
   * It is a separate prop, not a required `aria-label`: a union type of `aria-label |
   * aria-labelledby` breaks type inference in Storybook and in any wrapper via `ComponentProps`. If
   * `aria-labelledby` is specifically needed, it passes straight through `...rest`.
   *
   * When the label is needed on screen too, pass it in `children` instead of `label`: the name is
   * then taken from it.
   */
  label?: string;
  /**
   * The visible label. Drawn to the left of the track; a press on it toggles, and it is also the
   * accessible name — a separate `label` is not needed then.
   *
   * `Checkbox` is built the same way: the label goes in `children`, and `label` is the name for the
   * case when there is no visible label.
   */
  children?: ReactNode;
  /**
   * A note under the label: what exactly is switched on and what it will lead to. Linked to the
   * switch via `aria-describedby` and merged with the description of `FormField` and its own
   * `aria-describedby`, rather than replacing them. A press on it toggles too. Not drawn without a
   * visible label.
   */
  description?: ReactNode;
}

/**
 * Switch.
 *
 * Here `checked`, not `selected` from the shared vocabulary: a switch has a native ARIA concept
 * (`role="switch"` + `aria-checked`), and replacing it with our own term would mean diverging from
 * the standard. `selected` stays with the choice elements: chips, tabs, list items.
 *
 * THE LABEL ON SCREEN GOES THROUGH `children`. The settings row "title and description on the left,
 * switch on the right" repeats in every cabinet, and it was assembled by hand (`SettingRow` on the
 * "Account (SaaS)" screen), along with the link of the description to the switch and the press on
 * the text. Now this is the standard path: the same component, with new semantics (a visible name
 * and description), not a new primitive for the layout. With a label, `className` applies to the
 * whole row; without one, to the track itself, as before.
 *
 * The previous version on the frontend was a `<button>` with no role and no `aria-checked` — a
 * screen reader announced it as a plain button with no state. Also it did not support `disabled`.
 * The thumb offset and focus shadow were set with inline styles.
 */
export const Toggle = forwardRef<HTMLButtonElement, ToggleProps>(function Toggle(
  {
    checked,
    onCheckedChange,
    label,
    children,
    description,
    className,
    disabled,
    type = "button",
    onClick,
    ...rest
  },
  ref
) {
  const ownId = useId();
  const switchId = rest.id ?? `${ownId}-switch`;
  const labelId = `${ownId}-label`;
  const descriptionId = `${ownId}-description`;
  // An empty string and `false` are not a label: without this check there would be a string with
  // an empty node and an unnamed switch (docs/conventions.md, "Empty value").
  const visible = hasContent(children);
  const showDescription = visible && hasContent(description);
  const labelledBy = (rest as { "aria-labelledby"?: string })["aria-labelledby"];
  if (!visible && !label && !labelledBy)
    devWarn(
      "Toggle: the switch has no accessible name. Pass `label`, or a visible label in `children`."
    );
  if (visible && label)
    devWarn(
      "Toggle: both `label` and visible `children` are set. The visible label names the switch; drop `label`."
    );
  if (!visible && hasContent(description))
    devWarn(
      "Toggle: `description` needs a visible label in `children`; without it, it is not shown."
    );
  const describedBy = useDescribedBy(
    [
      (rest as { "aria-describedby"?: string })["aria-describedby"],
      showDescription && descriptionId,
    ]
      .filter(Boolean)
      .join(" ") || undefined
  );

  const control = (
    <button
      /*
        THE SPREAD GOES FIRST, and `onClick` is pulled out of it separately.

        Previously `{...rest}` stood last and overrode `onClick`, `role` and `aria-checked`. A call
        `<Toggle … onClick={track} />` compiled, the switch rendered, analytics fired — but
        `onCheckedChange` was never called. Worse, even `onClick={undefined}` was enough: the key
        still got into `rest` and overwrote the component's own handler.

        A foreign handler is not discarded: it is called FIRST and can cancel the toggle via
        `preventDefault` — the same technique, for the same reason, as in `MaskedInput`. The role
        and state are no longer overridden by the spread: a toggle that loses `role="switch"` stops
        being a switch.
      */
      {...rest}
      ref={ref}
      id={visible ? switchId : rest.id}
      type={type}
      role="switch"
      aria-checked={checked}
      {...(visible ? { "aria-labelledby": labelId } : { "aria-label": label })}
      {...(describedBy ? { "aria-describedby": describedBy } : {})}
      disabled={disabled}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        onCheckedChange(!checked);
      }}
      className={cn(
        "relative h-[22px] w-[38px] shrink-0 cursor-pointer rounded-full border",
        "transition-colors",
        "focus-visible:outline-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2",
        "disabled:pointer-events-none disabled:opacity-50",
        // The border of the active track — `STATE_BORDER`: a `bg-accent` fill against the background
        // does not reach 3:1, and the border provides the boundary (WCAG 1.4.11).
        checked ? cn(STATE_BORDER.accent, "bg-accent") : "border-line bg-bg-3",
        !visible && className
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "bg-text-on-accent absolute top-[2px] h-4 w-4 rounded-full transition-[left]",
          checked ? "left-[17px]" : "left-[2px]"
        )}
      />
    </button>
  );

  if (!visible) return control;

  /*
    The label is a real `<label for>` pointing at the button: `button` is a "labelable" element, so a
    press on the text activates the switch by the browser's own means, without a handler of its own,
    and is not triggered when disabled. The name is set explicitly with `aria-labelledby` — not
    relying on how a screen reader assembles the name from `<label for>`.

    The description is a separate node outside the `<label>`: otherwise it would join the switch's
    name, while it is needed in the description. A press on it toggles too, so it is wrapped in its
    own `<label for>`.
  */
  return (
    <div className={cn("group/toggle flex items-center justify-between gap-4", className)}>
      {/* Only the text is dimmed: the track dims itself (`disabled:opacity-50`), and an overall
          opacity on the row would give it 25 % instead of 50 % — differently than without a label.
          `group-has-[[role=switch]:disabled]/toggle:` is for the button disabled by an ancestor
          `fieldset`: its `disabled` property is false then, and that property alone would not have
          dimmed the text. */}
      <div
        className={cn(
          "flex min-w-0 flex-col group-has-[[role=switch]:disabled]/toggle:opacity-50",
          disabled && "opacity-50"
        )}
      >
        <label
          id={labelId}
          htmlFor={switchId}
          className={cn(
            "text-fg-0 text-[13px] font-medium",
            disabled ? "cursor-not-allowed" : "cursor-pointer"
          )}
        >
          {children}
        </label>
        {showDescription && (
          <label
            id={descriptionId}
            htmlFor={switchId}
            className={cn("text-fg-2 text-xs", disabled ? "cursor-not-allowed" : "cursor-pointer")}
          >
            {description}
          </label>
        )}
      </div>
      {control}
    </div>
  );
});
