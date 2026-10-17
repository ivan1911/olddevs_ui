"use client";

import { ImageIcon } from "../../../icons.js";
import type { ToolDescriptor } from "../../core/toolDescriptor.js";
import { RichImage } from "./image.js";

/**
 * The image on the Tool's description (ADR-0058, item 10).
 *
 * The image is a `figure` with a caption (`image.ts`). Without the Tool, an `<img>` from pasted
 * content or from `value` is discarded, and files from the clipboard are not intercepted. The
 * extension is not in the list until there is an `image` bridge, which `RichTextEditor` provides
 * only when the Tool is enabled.
 *
 * An image needs an address, and neither the button nor the item knows it. Both prepare an empty
 * paragraph and open the image popover (`ImagePopover`) with the `openImageEditor` command from
 * `image.ts`. The image from the popover takes the place of that paragraph. A popover closed
 * without an address leaves the empty paragraph, as a Block that was started and then dropped
 * would. The popover itself and the selected image's toolbar (`ImageToolbar`) are the kit's
 * widgets, and the description has neither. The Block form is not needed for the Skeleton: its
 * Schema gets a stub in place of the image bridge (`skeleton.ts`), and the extension is the same.
 */
export const IMAGE_TOOL: ToolDescriptor = {
  name: "image",
  engine: (context) => (context.image ? [RichImage.configure(context.image)] : []),
  buttons: [
    {
      id: "image",
      label: ({ messages }) => messages.image,
      icon: ImageIcon,
      // As with the link, the button opens the popover and does not insert anything itself.
      run: (editor) => editor.commands.openImageEditor(),
      can: (editor) => editor.can().openImageEditor(),
      // `aria-pressed` is set when the image is selected or the caret is in its caption. The
      // popover then edits that image instead of inserting a new one.
      isActive: (editor) => editor.isActive("image"),
    },
  ],
  insertItems: [
    {
      id: "image",
      section: "insert",
      label: (m) => m.image,
      icon: ImageIcon,
      aliases: ["img", "picture", "photo", "![]()"],
      run: (chain) => chain.openImageEditor(),
    },
  ],
};
