"use client";

// Origin: minimal-tiptap, `components/link/link-edit-block.tsx` and
// `link-edit-popover.tsx` (MIT, © 2024 Aslam, https://github.com/Aslam97/minimal-tiptap).
// Carried over: the behavior "apply to the selection or insert the address as text", and
// editing the link under the caret. The shadcn markup is replaced with the kit's primitives.
// License: NOTICE in the package root.

import type { Editor } from "@tiptap/react";
import { useId, useState, type KeyboardEvent } from "react";
import { Button } from "../../../components/actions/Button.js";
import { FormField } from "../../../components/inputs/FormField.js";
import { TextControl } from "../../../components/inputs/TextControl.js";
import { useMessages } from "../../../i18n/useMessages.js";
import { normalizeLinkInput } from "./link.js";

/**
 * Content of the link address popover: opened by `Mod+K` and by the "Link" button of the
 * Toolbar and of the Bubble menu (the description is in `linkTool.tsx`).
 *
 * The kit renders the frame (`ToolButtonView.tsx`): a `Popover` in the layer stack. The frame's
 * name is the button's label, and focus returns to the Document's previous selection.
 *
 * THE ANCHOR IS THE SELECTION, not the button. The popover is also opened from the keyboard,
 * when the Toolbar is absent (`toolbar="none"`) or the floating one is hidden. So it stands
 * next to the text that will become a link, however it was opened.
 *
 * The form is mounted anew on each opening: the field takes the link's address under the caret
 * at the moment of opening, not the previous draft.
 */
export function LinkForm({ editor, onDone }: { editor: Editor; onDone: () => void }) {
  const messages = useMessages().editor;
  const fieldId = useId();
  const [existing] = useState(() =>
    editor.isActive("link") ? String(editor.getAttributes("link").href ?? "") : null
  );
  const [draft, setDraft] = useState(existing ?? "");
  const [invalid, setInvalid] = useState(false);

  const remove = () => {
    editor.chain().extendMarkRange("link").unsetLink().run();
    onDone();
  };

  const apply = () => {
    const text = draft.trim();
    // An empty field means "no link here": for an existing link it removes the link; for a
    // new one, it just closes the popover.
    if (!text) {
      if (existing != null) remove();
      else onDone();
      return;
    }
    const href = normalizeLinkInput(text);
    if (!href) {
      setInvalid(true);
      return;
    }
    const chain = editor.chain();
    if (!editor.state.selection.empty) chain.setLink({ href });
    else if (existing != null) chain.extendMarkRange("link").setLink({ href });
    // No selection: the address is inserted as the link's text, as in minimal-tiptap.
    else chain.insertContent({ type: "text", text, marks: [{ type: "link", attrs: { href } }] });
    chain.run();
    onDone();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    // An Enter that the IME uses to confirm a word does not apply the link.
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
    event.preventDefault();
    apply();
  };

  return (
    <div className="flex flex-col gap-3">
      {/* `layout="stack"` is set explicitly: the popover is drawn outside the form layout where
          the Editor sits, and the side label of `FormLayout` does not suit it. */}
      <FormField
        label={messages.linkAddress}
        htmlFor={fieldId}
        error={invalid ? messages.linkInvalid : undefined}
        layout="stack"
      >
        <TextControl
          id={fieldId}
          size="sm"
          type="text"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          placeholder="https://"
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            setInvalid(false);
          }}
          onKeyDown={onKeyDown}
        />
      </FormField>
      <div className="flex justify-end gap-2">
        {existing != null && (
          <Button type="button" size="sm" variant="ghost" tone="danger" onClick={remove}>
            {messages.linkRemove}
          </Button>
        )}
        <Button type="button" size="sm" variant="solid" tone="accent" onClick={apply}>
          {messages.linkApply}
        </Button>
      </div>
    </div>
  );
}
