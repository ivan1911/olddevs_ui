"use client";

import { useId, useRef, useState, type FormEvent, type ReactNode, type RefObject } from "react";
import { WarningIcon } from "../../icons.js";
import { OVERLAY_LAYER } from "../../lib/overlay-layer.js";
import { Button } from "../actions/Button.js";
import { FormField } from "../inputs/FormField.js";
import { TextControl } from "../inputs/TextControl.js";
import { Dialog } from "./Dialog.js";
import { useMessages } from "../../i18n/useMessages.js";

/**
 * The nature of the question. This is the dialog's OWN axis, not a button axis: "we delete it
 * permanently" and "the button is red" are different statements, and the caller must say the
 * first, while turning it into the second is the component's job.
 */
export type ConfirmKind = "danger" | "warning" | "info";

export interface ConfirmDialogProps {
  /** Whether the confirmation dialog is shown. */
  open: boolean;
  /**
   * Cancel: the "Cancel" button, the close button, Escape and a click outside. Not called while
   * `loading`.
   */
  onClose: () => void;
  /** The user confirmed the action. The dialog does not close by itself: the consumer must close it. */
  onConfirm: () => void;
  /** Dialog title: names the action briefly. It is also the dialog's accessible name. */
  title: ReactNode;
  /** The question or an explanation of the consequences. Rendered as a paragraph and serves as the dialog's description for screen readers. */
  message: ReactNode;
  /** Label of the confirm button. Defaults to "Confirm" from the message catalog. */
  confirmLabel?: string;
  /** Label of the cancel button. Defaults to "Cancel" from the message catalog. */
  cancelLabel?: string;
  /**
   * The kind of question: `danger` and `warning` render the confirm button with the outline variant
   * in the danger tone, `info` with the solid variant in the accent tone. Defaults to `danger`.
   *
   * The tone of the icon to the left of the title also comes from `kind`: red, yellow or accent.
   */
  kind?: ConfirmKind;
  /** The confirmed action is running: the buttons are disabled, the dialog cannot be closed. */
  loading?: boolean;
  /**
   * Confirmation by typing: the text the user must type for the confirm button to be enabled,
   * usually the name of the entity being deleted ("Delete workspace Acme"). The dialog shows a
   * field with a label from the message catalog, focus goes into it on open, and Enter confirms
   * only when the text matches.
   *
   * The comparison is exact and case-sensitive: the point of the technique is that the user reads
   * the name and types exactly that, and "acme" instead of "Acme" tells one workspace apart from
   * another. Leading and trailing spaces are ignored (a paste from the clipboard often brings a
   * tail), and `NFC` normalization smooths over the difference between "é" as one code point and
   * "e" followed by a combining accent. An empty string is not a name: there is no field, and the
   * dialog confirms as usual.
   *
   * The typed text lives inside the dialog and does not survive its closing; outside it does not
   * need to be known — `onConfirm` is called only after the match.
   */
  typeToConfirm?: string;
}

const ICON_COLOR: Record<ConfirmKind, string> = {
  danger: "var(--danger)",
  warning: "var(--warning)",
  info: "var(--accent)",
};

/**
 * Brings text to the form in which it is compared: without leading and trailing spaces and in
 * canonical Unicode form. Case is NOT changed — see `typeToConfirm`.
 */
const normalize = (value: string) => value.trim().normalize("NFC");

/**
 * A field label with the name to type shown in its own case.
 *
 * `FormField` labels are set in uppercase, so "Acme Labs" would look like "ACME LABS" there, even
 * though the comparison is case-sensitive and the hint says so directly. The name inside the label
 * is taken out of the uppercase, while the rest of the text is styled like all fields.
 */
function keepCase(label: string, name: string): ReactNode {
  const at = name ? label.indexOf(name) : -1;
  if (at === -1) return label;
  return (
    <>
      {label.slice(0, at)}
      <span className="tracking-normal normal-case">{name}</span>
      {label.slice(at + name.length)}
    </>
  );
}

/**
 * Confirmation dialog for an irreversible action.
 *
 * BUILT ON `Dialog`, NOT ON THE SCRIM. It used to assemble modality by itself: `ModalOverlay` +
 * its own role + its own `aria-labelledby` + `useScrollLock` + an Escape handler in the capture
 * phase with `stopImmediatePropagation`. The last one was not an overcaution but a necessity: the
 * dialog is almost always open ON TOP of another dialog with its own Escape handler, and without
 * capture a single press closed both. Radix manages the layer stack itself, so the whole mechanism
 * disappeared with the move.
 *
 * The role stays `alertdialog`: the dialog interrupts the work and requires an answer, rather than
 * showing a form. With `typeToConfirm` a form does appear in it, but only for one locking field,
 * not for data entry, and the role stays the same.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
  cancelLabel,
  kind = "danger",
  loading = false,
  typeToConfirm,
}: ConfirmDialogProps) {
  const messageId = useId();
  const confirmRef = useRef<HTMLButtonElement>(null);
  const fieldRef = useRef<HTMLInputElement>(null);
  // An empty string and a string of spaces are not a name: there is nothing to compare with.
  const expected = normalize(typeToConfirm ?? "");

  return (
    <Dialog
      open={open}
      onClose={onClose}
      loading={loading}
      role="alertdialog"
      /*
        The description points at the VISIBLE paragraph with the question, not at a copy of it.

        Without a description the screen reader announced the dialog's name and the button the
        focus had moved to, and the user confirmed blindly. The first fix passed `message` itself
        and rendered it as a hidden copy: the text ended up in the document twice, and a link
        inside it added an invisible extra tab stop.
      */
      describedBy={messageId}
      zIndex={OVERLAY_LAYER.alert}
      // Focus goes to the confirm button: the question is already asked, and the answer must be
      // one press away. Radix's default would move focus to the close button.
      // With confirmation by typing the answer starts with typing, and focus waits in the field.
      initialFocusRef={expected ? fieldRef : confirmRef}
      title={title}
      icon={<WarningIcon size={18} style={{ color: ICON_COLOR[kind] }} />}
      className="w-full max-w-[380px]"
    >
      {/* The body is a separate component: the typed text lives exactly as long as the dialog
          content, and does not survive closing (Radix unmounts it). */}
      <ConfirmBody
        message={message}
        messageId={messageId}
        confirmLabel={confirmLabel}
        cancelLabel={cancelLabel}
        kind={kind}
        loading={loading}
        expected={expected}
        confirmRef={confirmRef}
        fieldRef={fieldRef}
        onClose={onClose}
        onConfirm={onConfirm}
      />
    </Dialog>
  );
}

interface ConfirmBodyProps extends Pick<
  ConfirmDialogProps,
  "message" | "confirmLabel" | "cancelLabel" | "kind" | "onClose" | "onConfirm"
> {
  messageId: string;
  loading: boolean;
  /** The normalized text to type; an empty string means confirmation without a field. */
  expected: string;
  confirmRef: RefObject<HTMLButtonElement | null>;
  fieldRef: RefObject<HTMLInputElement | null>;
}

function ConfirmBody({
  message,
  messageId,
  confirmLabel,
  cancelLabel,
  kind,
  loading,
  expected,
  confirmRef,
  fieldRef,
  onClose,
  onConfirm,
}: ConfirmBodyProps) {
  const messages = useMessages();
  const [typed, setTyped] = useState("");
  const withField = expected !== "";
  const matches = !withField || normalize(typed) === expected;

  const confirmStyle =
    kind === "info"
      ? ({ variant: "solid", tone: "accent" } as const)
      : ({ variant: "outline", tone: "danger" } as const);

  function submit(event: FormEvent) {
    event.preventDefault();
    // Enter in the field reaches here even when the button is disabled (if the browser decides
    // there is nothing to submit): the match is checked once more.
    if (!matches || loading) return;
    onConfirm();
  }

  const body = (
    <>
      <div className="flex flex-col gap-3 px-5 py-4">
        <p id={messageId} className="text-fg-1 m-0 text-[13px] leading-relaxed">
          {message}
        </p>
        {withField ? (
          <FormField
            label={keepCase(messages.confirmDialog.typeToConfirm({ text: expected }), expected)}
            htmlFor={`${messageId}-field`}
            hint={messages.confirmDialog.typeToConfirmHint}
          >
            <TextControl
              ref={fieldRef}
              id={`${messageId}-field`}
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              // Read-only rather than `disabled`: Enter in the field triggers the action, and a
              // disabled field would move focus to `body` right out from under the user's fingers.
              readOnly={loading}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              shellClassName="w-full"
            />
          </FormField>
        ) : null}
      </div>

      <div className="border-line-soft flex items-center gap-2.5 border-t px-5 py-4">
        <Button variant="ghost" onClick={onClose} disabled={loading}>
          {cancelLabel ?? messages.confirmDialog.cancel}
        </Button>
        <div className="flex-1" />
        <Button
          ref={confirmRef}
          variant={confirmStyle.variant}
          tone={confirmStyle.tone}
          // With a field, confirmation is form submission rather than a click: this way Enter in
          // the field and the button go through one path and one match check.
          type={withField ? "submit" : undefined}
          onClick={withField ? undefined : onConfirm}
          disabled={!matches}
          loading={loading}
        >
          {confirmLabel ?? messages.confirmDialog.confirm}
        </Button>
      </div>
    </>
  );

  return withField ? (
    <form noValidate onSubmit={submit}>
      {body}
    </form>
  ) : (
    body
  );
}
