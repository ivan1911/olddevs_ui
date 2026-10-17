"use client";

import { forwardRef, type ComponentPropsWithoutRef, type CSSProperties } from "react";
import { cn } from "../../lib/cn.js";
import { FieldLayoutProvider } from "./FormField.js";

export interface FormLayoutProps extends ComponentPropsWithoutRef<"div"> {
  /** The number of columns. On narrow screens there is always one column, handled by CSS. */
  columns?: 1 | 2;
  /** Where the field labels sit: above the field, or in a column on the left. */
  labels?: "top" | "side";
  /**
   * The width of the label column: any CSS length.
   *
   * This is a prop rather than only a variable, because the width depends on the longest
   * labels of THIS form, not on the theme, so it cannot be set globally.
   */
  labelWidth?: string;
}

/**
 * Form layout: the columns and the placement of labels.
 *
 * IT ONLY CONTROLS THE POSITION OF NODES. It does not handle validation, the set of fields, or
 * state: `Form` deliberately gave up its own validation, and the layout
 * does not revisit that. A breach of the boundary is easy to check: a prop
 * that changes the set of nodes rather than their position is the sign of it (ADR-0025).
 *
 * THE GRID IS CSS, NOT A CALCULATION IN JS. The single column on narrow screens is switched on
 * by a media query: a layout that depends on `matchMedia` shows the wrong layout until hydration,
 * and the form's first frame lands on it.
 *
 * LEFT-SIDE LABELS ARE THE AXIS OF `FormField`, NOT OF THIS COMPONENT. The layout only
 * passes it down through context: the field draws its label, so it cannot be moved
 * from outside. So one consequence is worth knowing up front: `labels="side"`
 * applies to `FormField` and silently does nothing for foreign children: the consumer's `<input>`
 * is positioned by the layout, but it never sees a label.
 *
 * `Fieldset` is not added as a separate component: a labelled group is the native
 * `<fieldset>` and `<legend>`, and a wrapper around them would add nothing
 * except a name in the exports.
 */
export const FormLayout = forwardRef<HTMLDivElement, FormLayoutProps>(function FormLayout(
  { columns = 1, labels = "top", labelWidth, className, style, ...rest },
  ref
) {
  return (
    // The field's "top" option is called `stack`: for the layout it is the label position, for the field
    // it is how to stack its own nodes. Renaming one to the other is worse than
    // mapping them in one line.
    <FieldLayoutProvider value={labels === "side" ? "side" : "stack"}>
      <div
        ref={ref}
        className={cn("grid gap-4", columns === 2 && "sm:grid-cols-2", className)}
        // An own prop wins over a foreign `style`: it is named and explicit, while
        // a variable in `style` is a way to get around the missing prop.
        style={
          labelWidth != null ? ({ ...style, "--form-label-w": labelWidth } as CSSProperties) : style
        }
        {...rest}
      />
    </FieldLayoutProvider>
  );
});

export type FieldRowProps = ComponentPropsWithoutRef<"div">;

/**
 * A field spanning the full width of the layout: an address, a long description, a button block.
 *
 * `col-span-full`, not `col-span-2`: the row must take up as many columns as there are,
 * because a fixed two would create an implicit second column in a one-column layout.
 * The form would break apart where nothing was changed.
 */
export const FieldRow = forwardRef<HTMLDivElement, FieldRowProps>(function FieldRow(
  { className, ...rest },
  ref
) {
  return <div ref={ref} className={cn("col-span-full", className)} {...rest} />;
});
