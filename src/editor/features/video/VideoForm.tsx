"use client";

import type { Editor } from "@tiptap/react";
import { useId, useState, type KeyboardEvent } from "react";
import { Button } from "../../../components/actions/Button.js";
import { FormField } from "../../../components/inputs/FormField.js";
import { TextControl } from "../../../components/inputs/TextControl.js";
import { useMessages } from "../../../i18n/useMessages.js";
import { videoProviders } from "./video.js";
import { parseVideoLink, VIDEO_PROVIDER_NAME } from "./videoLink.js";

/**
 * The content of the popover for the "Video" item of the Insert menu (ADR-0071, item 6): the link field.
 *
 * THE SERVICE DECIDES THE ADDRESS, not the author: one item covers `youtube` and `twitch`, and the
 * link is parsed among the services enabled in this Editor. A link from another service and a link
 * from a disabled service are the same error in the field, which says what the Editor accepts.
 * The Block is inserted at the caret (`insertVideo`).
 *
 * The kit provides the frame (`SelectionPopover`): the layer stack, the frame's name is the item's
 * label, and focus returns to the Document. The form is mounted anew on every opening.
 */
export function VideoForm({ editor, onDone }: { editor: Editor; onDone: () => void }) {
  const messages = useMessages().editor;
  const fieldId = useId();
  const [draft, setDraft] = useState("");
  const [invalid, setInvalid] = useState(false);
  const providers = videoProviders(editor);

  const apply = () => {
    const text = draft.trim();
    if (!text) return void onDone();
    const link = parseVideoLink(text);
    if (!link || !providers.includes(link.provider)) return void setInvalid(true);
    editor.chain().focus().insertVideo(link).run();
    onDone();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    // Enter that the IME uses to confirm a word is not "insert".
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
    event.preventDefault();
    apply();
  };

  return (
    <div className="flex flex-col gap-3">
      <FormField
        label={messages.videoLink}
        htmlFor={fieldId}
        error={
          invalid
            ? messages.videoNotFound({
                services: providers.map((provider) => VIDEO_PROVIDER_NAME[provider]).join(" / "),
              })
            : undefined
        }
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
        <Button type="button" size="sm" variant="solid" tone="accent" onClick={apply}>
          {messages.videoInsert}
        </Button>
      </div>
    </div>
  );
}
