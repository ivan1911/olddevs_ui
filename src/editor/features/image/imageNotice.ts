"use client";

// Texts of the Field notice for file events. They come from the message catalog instead of
// strings in the extension's code. Moved out of `RichTextEditor.tsx`.

import type { UiMessages } from "../../../i18n/messages.js";
import type { FieldNotice } from "../../core/fieldNotice.js";
import type { ImageNotice } from "./image.js";

/** File event, as a catalog string and a tone: a live region, or an error under the field. */
export function describeImageNotice(
  notice: ImageNotice,
  messages: UiMessages["editor"]
): FieldNotice {
  switch (notice.kind) {
    case "uploading":
      return { tone: "status", text: messages.imageUploading({ name: notice.name }) };
    case "uploaded":
      return { tone: "status", text: messages.imageUploaded({ name: notice.name }) };
    case "failed":
      return { tone: "error", text: messages.imageUploadFailed({ name: notice.name }) };
    case "notImage":
      return { tone: "error", text: messages.imageNotImage({ name: notice.name }) };
    case "unsupported":
      return { tone: "error", text: messages.imageFilesUnsupported };
  }
}
