"use client";

import type { ReactNode } from "react";
import {
  Button as AriaButton,
  Disclosure,
  DisclosureGroup,
  DisclosurePanel,
  Heading as AriaHeading,
  type DisclosureGroupProps,
} from "react-aria-components";
import { ChevronDownIcon } from "../../icons.js";
import { cn } from "../../lib/cn.js";

export interface AccordionProps extends Omit<
  DisclosureGroupProps,
  "className" | "style" | "allowsMultipleExpanded"
> {
  /**
   * Expand several sections at once.
   *
   * The native `allowsMultipleExpanded` is removed from the type on purpose: `{...rest}`
   * is spread BEFORE the kit's default, so a prop passed from outside would silently lose,
   * and the accordion would keep behaving the old way while the code still compiles.
   *
   * The default is a single open section: sections are read one after another, and sections
   * opened just in case turn the screen into a wall of text, where the section you have just
   * opened slides past the bottom edge. Turn multiple on only where sections are compared
   * with each other.
   */
  multiple?: boolean;
  /** Extra classes on the accordion root. */
  className?: string;
  /** Accordion sections: a set of `AccordionItem`. */
  children?: ReactNode;
}

export interface AccordionItemProps {
  /** Section identifier: `expandedKeys` works through it. */
  id: string;
  /** Section title: the content of the disclosure button. Can be markup. */
  title: ReactNode;
  /** Disables the section: the disclosure button is inactive and the state does not change. */
  disabled?: boolean;
  /** Extra classes on the section. */
  className?: string;
  /** Content of the section panel; shown in the expanded state. */
  children?: ReactNode;
}

/** Accordion section. */
export function AccordionItem({ id, title, disabled, className, children }: AccordionItemProps) {
  return (
    <Disclosure
      id={id}
      isDisabled={disabled}
      className={cn("border-line-soft border-b", className)}
    >
      {({ isExpanded }) => (
        <>
          {/*
        The heading wraps react-aria's `Heading`, not a `div`: the disclosure button
        has to sit inside the heading, so a screen reader reaches the section through the
        list of headings, not only by tabbing through the buttons.
      */}
          <AriaHeading className="m-0">
            <AriaButton
              slot="trigger"
              className={cn(
                "text-fg-0 flex w-full cursor-pointer items-center justify-between gap-3 py-3 text-left text-sm font-semibold outline-none",
                "hover:text-accent-strong focus-visible:outline-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2",
                "disabled:text-fg-3 disabled:cursor-not-allowed"
              )}
            >
              {title}
              {/*
            The chevron's rotation is driven by a RENDER PROP, not by the `expanded:` variant.
            The plugin variant needs `data-expanded` on the very element being styled, but
            react-aria puts it on the `Disclosure` wrapper, and neither the button nor the icon
            carries it. The class silently never matched: the chevron did not rotate at all, and
            neither the snapshot (periphery) nor axe can see this. This is rule 2 from the
            "mixed kit" list.
          */}
              <ChevronDownIcon
                size={16}
                aria-hidden
                className={cn(
                  "text-fg-3 shrink-0 transition-transform motion-reduce:transition-none",
                  isExpanded && "rotate-180"
                )}
              />
            </AriaButton>
          </AriaHeading>
          {/*
            The bottom padding applies only to the expanded panel: a collapsed panel stays in
            the flow, and its `pb-3` added 12px.
          */}
          <DisclosurePanel className={cn("text-fg-1 text-sm", isExpanded && "pb-3")}>
            {children}
          </DisclosurePanel>
        </>
      )}
    </Disclosure>
  );
}

/**
 * Accordion: a set of collapsible sections.
 *
 * react-aria provides the behavior: the keyboard, `aria-expanded`, the link between the button
 * and the panel, and hiding collapsed content from screen readers. The kit owns the look and
 * the default for how many sections can be expanded at once.
 */
export function Accordion({ multiple = false, className, children, ...rest }: AccordionProps) {
  return (
    <DisclosureGroup
      {...rest}
      allowsMultipleExpanded={multiple}
      className={cn("border-line-soft w-full border-t", className)}
    >
      {children}
    </DisclosureGroup>
  );
}
