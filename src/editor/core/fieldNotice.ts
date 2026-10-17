"use client";

// Field notice (ADR-0058, section 7): one place under the field where the kit and its custom
// Tools report the result of an action. It used to be internal state of the image messages;
// now it is an engine command.

import { Extension } from "@tiptap/core";

/**
 * Tone of a field notice. `status` is invisible and only announced; `error` is shown as a
 * `role="alert"` line under the field.
 */
export type FieldNoticeTone = "status" | "error";

/**
 * A field notice is data, not a React node: a tone and a ready text. The kit does not translate the
 * text: a Tool takes it from its own catalog in the screen's language, and the kit takes its own
 * from the message catalog (`editor.*`). A notice has no durations, close buttons or spinners of its
 * own.
 */
export interface FieldNotice {
  /** Tone of the notice: `status` is only announced, `error` is shown as a line under the field. */
  tone: FieldNoticeTone;
  /** Text that is already in the screen's language; the kit does not translate it. */
  text: string;
}

export interface FieldNoticeOptions {
  /** Show a notice; `null` clears it. The state is held by `RichTextEditor`. */
  onNotice: (notice: FieldNotice | null) => void;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    fieldNotice: {
      /**
       * Show a field notice: a new one replaces the previous one, `null` clears it. The Document,
       * history and `onChange` are not affected. An `error` goes away on its own with the next User
       * edit; a `status` stays until it is replaced or cleared.
       *
       * A custom Tool calls it from its Extensions (`this.editor.commands`), a screen through
       * `handle.editor`. A notice without text is the same as `null`.
       */
      showNotice: (notice: FieldNotice | null) => ReturnType;
    };
  }
}

/**
 * The `showNotice` command. It lives in every Editor, regardless of the Tool set: a Tool without
 * images can also report a paste error.
 *
 * WHY NO TRANSACTION. A notice is not part of the Document: the command writes nothing to `tr`, so
 * it does not reach history or `onChange`, and a User edit (which clears an `error`) is easy to tell
 * apart from it: it is the only thing that produces an `update` event. A probe with `editor.can()`
 * does not run the command (`dispatch` is not passed).
 */
export const FieldNoticeExtension = Extension.create<FieldNoticeOptions>({
  name: "fieldNotice",

  addOptions() {
    return { onNotice: () => {} };
  },

  addCommands() {
    return {
      showNotice:
        (notice) =>
        ({ dispatch }) => {
          if (dispatch) this.options.onNotice(notice && notice.text !== "" ? notice : null);
          return true;
        },
    };
  },
});
