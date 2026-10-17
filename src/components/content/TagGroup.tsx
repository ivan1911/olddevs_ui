"use client";

import { forwardRef, type ReactNode } from "react";
import {
  Button as AriaButton,
  Label,
  Tag as AriaTag,
  TagGroup as AriaTagGroup,
  TagList,
} from "react-aria-components";
import { CloseIcon } from "../../icons.js";
import type { AccessibleName } from "../../lib/accessible-name.js";
import { cn } from "../../lib/cn.js";
import { hasContent } from "../../lib/empty.js";
import { TAG_CLASS, TAG_REMOVE_CLASS } from "../../lib/tag.js";
import { LABEL_BG_CLASS, type LabelHue } from "../../lib/variants.js";
import { useMessages } from "../../i18n/useMessages.js";

/** Tag key: the same `id` as set on `Tag`. */
export type TagKey = string | number;

interface TagGroupBaseProps {
  /**
   * Removal of tags. When set, each tag gets a remove button, and Delete and Backspace on a
   * tag call it with that tag's key.
   *
   * The component does not change the set itself: the consumer removes the tag by
   * re-rendering the group. When not set, tags cannot be removed by mouse or keyboard.
   */
  onRemove?: (keys: Set<TagKey>) => void;
  /**
   * What to show when there are no tags.
   *
   * An empty group with no text looks broken: the content seems to have disappeared,
   * rather than there being no categories.
   */
  empty?: ReactNode;
  /** Tags: `Tag` elements. If not set, the group is empty and shows `empty`. */
  children?: ReactNode;
  /** Classes for the root element. */
  className?: string;
}

/**
 * A visible label that can serve as a name: a `ReactNode` without empty values.
 *
 * A bare `ReactNode` let `undefined`, `null` and `false` through: the "has a label" branch
 * matched a group with no name at all, and the requirement that a name exist turned into a
 * requirement that it be visible. An empty string cannot be excluded by the type (`""` is
 * also a `string`); `hasContent` in the markup catches it.
 */
type TagGroupLabel = Exclude<ReactNode, null | undefined | boolean>;

/**
 * The group name is required: either a visible `label`, or exactly one of `aria-label` and
 * `aria-labelledby` (`AccessibleName`), but not a label together with an attribute.
 *
 * A tag group is a `grid`, and a `grid` without a name is announced by its role alone, so
 * three groups in a row on a page ("Categories", "Authors", "Tags") are indistinguishable.
 * The same argument applies to `Toolbar` and `Carousel`. A label together with `aria-label`
 * gives two sources for one name: the attribute would override the visible text, and the
 * group would be announced differently than it looks on screen.
 */
export type TagGroupProps = TagGroupBaseProps &
  (
    | {
        /** Visible group label; it is also the group's accessible name. */
        label: TagGroupLabel;
        /**
         * Accessible name as a string, when there is no visible label. Do not set it together with
         * `aria-labelledby`: that gives the name two sources.
         */
        "aria-label"?: never;
        /**
         * `id` of the element whose text serves as the accessible name, when there is no visible
         * label. Do not set it together with `aria-label`: that gives the name two sources.
         */
        "aria-labelledby"?: never;
      }
    | ({ label?: never } & AccessibleName)
  );

/**
 * A set of tags for DISPLAY: a palette hue, a link, optional removal.
 *
 * Built on react-aria's `TagGroup`, and all the behavior comes from it: arrow keys between
 * tags, Delete and Backspace, focus moving to a neighboring tag after removal. Tab from a tag
 * goes to its remove button — `TagInput` works the same way.
 *
 * THIS IS NOT A FILTER, NOT A STATUS, AND NOT INPUT. Picking from a set is `Chip` and
 * `Segmented`, which is why `selectionMode` is NOT passed through: a tag that can be selected
 * becomes a second toggle with different keyboard behavior. A state of an object is
 * `StatusBadge`. Entering new tags is `TagInput`.
 *
 * The set wraps to a new line as a whole, by tag, not by word.
 */
export const TagGroup = forwardRef<HTMLDivElement, TagGroupProps>(function TagGroup(
  { label, onRemove, empty, children, className, ...rest },
  ref
) {
  return (
    <AriaTagGroup
      {...rest}
      ref={ref}
      onRemove={onRemove}
      className={cn("flex flex-col gap-1.5", className)}
    >
      {hasContent(label) ? <Label className="text-fg-2 text-caption">{label}</Label> : null}
      <TagList
        className="flex flex-wrap gap-1.5"
        renderEmptyState={
          // `hasContent`, not `!= null`: an empty string would render an empty `span` instead of
          // "No tags" — which is the same empty group the prop exists to prevent.
          hasContent(empty) ? () => <span className="text-fg-3 text-sm">{empty}</span> : undefined
        }
      >
        {children}
      </TagList>
    </AriaTagGroup>
  );
});

interface TagBaseProps {
  /**
   * Tag key: `onRemove` receives it. Without `id`, the React key of the element becomes the
   * key, so set both for removable sets.
   */
  id?: TagKey;
  /**
   * Hue from the tag palette (`LABEL_HUES`): a dot next to the label, not a fill behind the text.
   *
   * This is a palette decision, not a matter of taste: eight hues readable behind text in all
   * three themes would take a palette twice as large. The dot is hidden from screen readers
   * (`aria-hidden`): a hue does not stand in for a word, the label carries the meaning. Otherwise
   * a person with color-vision deficiency could not tell the tags apart.
   */
  hue?: LabelHue;
  /**
   * Link URL: the tag becomes a link, and Enter or a click follows it.
   *
   * react-aria does not render an `<a>`; it opens the link on press (the attributes are kept in
   * `data-href`). This keeps the tag a row item of the group, with arrow keys and removal intact.
   * The cost: there is no context-menu "open in a new tab"; for client-side routing, set up
   * react-aria's `RouterProvider`.
   */
  href?: string;
  /** Where to open the link (`_blank`, etc.); applies together with `href`. */
  target?: string;
  /** The `rel` attribute of the link; applies together with `href`. */
  rel?: string;
}

/**
 * A tag with text: the name comes from its content. A tag with a node inside must give its own
 * name, otherwise nothing can name it: not the remove button, not a screen reader.
 */
export type TagProps = TagBaseProps &
  (
    | {
        /** Tag content: a label as text or as a node. */
        children: string | number;
        /**
         * Text name of the tag for the remove button and screen readers; defaults to `children`,
         * required when `children` is not a string.
         */
        textValue?: string;
      }
    | {
        /** Tag content: a label as text or as a node. */
        children: ReactNode;
        /**
         * Text name of the tag for the remove button and screen readers; defaults to `children`,
         * required when `children` is not a string.
         */
        textValue: string;
      }
  );

/** A tag inside `TagGroup`. */
export function Tag({ id, hue, href, target, rel, children, textValue }: TagProps) {
  const messages = useMessages();
  // `||`, not `??`: an empty `textValue` would leave the remove button named "Remove: " —
  // with nothing about what it removes.
  const name =
    textValue ||
    (typeof children === "string" || typeof children === "number" ? String(children) : "");

  return (
    <AriaTag
      id={id}
      textValue={name}
      // An empty address is not a link: a tag with `href=""` would point to the current page.
      href={href || undefined}
      target={target}
      rel={rel}
      className={cn(TAG_CLASS, href && "cursor-pointer hover:underline")}
    >
      {({ allowsRemoving }) => (
        <>
          {hue ? (
            <span
              aria-hidden="true"
              className={cn("size-2.5 shrink-0 rounded-full", LABEL_BG_CLASS[hue])}
            />
          ) : null}
          {children}
          {allowsRemoving ? (
            /*
              The button is react-aria's `Button`, not a `<button>`: the removal behavior comes
              through its context (see `TagInput`).

              The full name comes from the catalog, while react-aria by default APPENDS the tag's
              label to the button's name via `aria-labelledby`. An empty string overrides it:
              `undefined` does not work — props merging skips it and keeps react-aria's value,
              and an empty `aria-labelledby` is ignored per the spec, so the name is taken from
              `aria-label`.
            */
            <AriaButton
              slot="remove"
              aria-label={messages.tagGroup.remove({ label: name })}
              aria-labelledby=""
              className={TAG_REMOVE_CLASS}
            >
              <CloseIcon size={12} />
            </AriaButton>
          ) : null}
        </>
      )}
    </AriaTag>
  );
}
