"use client";

import type { ComponentType, ReactNode } from "react";
import { cn } from "../../lib/cn.js";
import { useMessages } from "../../i18n/useMessages.js";
import { CloseIcon } from "../../icons.js";
import { Button } from "../actions/Button.js";

/** Everything the title component needs: accept an `id`, a class and content. */
type TitleProps = { id?: string; className?: string; children?: ReactNode };

export interface ModalHeaderProps {
  /**
   * Title of the dialog: one line on the left of the header.
   *
   * `ReactNode`, not a string: in the front app a counter of the selection often sits next to
   * the text — "Add to collection (12)", where the parenthesized count is set in a different
   * size and color.
   */
  title: ReactNode;
  /**
   * The `id` of the title, so that `aria-labelledby` can point at it.
   *
   * The caller needs it to point `aria-labelledby` of its own dialog at it: only the caller
   * knows the dialog's name, and we cannot assign it here.
   */
  titleId?: string;
  /**
   * A line under the title: a slug, a date, a counter.
   *
   * It is a separate prop, not part of `title`, because `<h2>` accepts only phrasing content —
   * block markup inside a heading is invalid, and a subtitle is almost always block markup.
   */
  subtitle?: ReactNode;
  /** Icon on the left of the title. The consumer sets its color, since it knows the dialog's tone. */
  icon?: ReactNode;
  /**
   * Close handler. The button is rendered only when it is passed.
   *
   * There is deliberately no separate "hide the close button" prop: on a screen the button
   * disappears while a form is being submitted, and this is expressed by the same thing —
   * `onClose={loading ? undefined : close}`. One more boolean prop would describe exactly the
   * same state in a second way.
   */
  onClose?: () => void;
  /** Accessible name of the close button. */
  closeLabel?: string;
  /**
   * The element that renders the title. Defaults to `<h2>`.
   *
   * Exactly one consumer needs this: `Dialog`, which passes Radix's `Dialog.Title` here. It does
   * more than draw a title: it registers the title in the dialog's context, and `aria-labelledby`
   * is set automatically. Without it, one would either have to duplicate the header markup inside
   * `Dialog` (it was moved here precisely because it was repeated ten times), or leave Radix's
   * warning in the console about a dialog without a title.
   */
  titleComponent?: ComponentType<TitleProps> | "h2";
  /** Classes for the header root. */
  className?: string;
}

/**
 * Header of a modal dialog: the title on the left, the close button on the right, a line underneath.
 *
 * Moved into the kit because it was repeated TEN times, byte for byte — including the class set
 * `border-line-soft flex items-center justify-between border-b px-5 py-4` and `m-0 text-base font-bold`
 * on the title. That is exactly the case where a copy drifts apart silently: fix the padding in one
 * dialog and it starts to differ from the other nine, and only the eye would notice.
 *
 * Originally the plan named a different component — a `closable` prop on `ModalOverlay` that renders
 * a close button in the corner of the scrim. It was dropped after reading the code: NONE of the fifteen
 * close buttons in the front app sits in a corner, all of them are in the header row next to the title.
 * That prop would not have removed a single repeat and would have added an unused API.
 */
export function ModalHeader({
  title,
  titleId,
  subtitle,
  icon,
  onClose,
  closeLabel,
  titleComponent: Title = "h2",
  className,
}: ModalHeaderProps) {
  const messages = useMessages();

  return (
    <div
      className={cn(
        "border-line-soft flex items-center justify-between border-b px-5 py-4",
        className
      )}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        {icon}
        <div className="min-w-0">
          {/*
            `id` is passed ONLY when it is set. An explicit `id={undefined}` overwrites the
            `Dialog.Title` identifier from Radix, and the dialog's `aria-labelledby` starts pointing
            at nothing — that is, the dialog is left without an accessible name, exactly as it was
            before this primitive existed.
          */}
          <Title {...(titleId ? { id: titleId } : {})} className="m-0 truncate text-base font-bold">
            {title}
          </Title>
          {subtitle ? <div className="text-fg-3 mt-0.5 truncate">{subtitle}</div> : null}
        </div>
      </div>
      {onClose ? (
        <Button
          variant="ghost"
          iconOnly
          aria-label={closeLabel ?? messages.common.close}
          icon={<CloseIcon size={18} />}
          onClick={onClose}
        />
      ) : null}
    </div>
  );
}
