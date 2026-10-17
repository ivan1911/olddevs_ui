"use client";

import { useState, type ReactNode } from "react";
import {
  Button as AriaButton,
  DropZone,
  FileTrigger,
  Text as AriaText,
} from "react-aria-components";
import { UploadIcon } from "../../icons.js";
import { buttonClasses } from "../../lib/button.js";
import { cn } from "../../lib/cn.js";
import { useMessages, useUiLocale } from "../../i18n/useMessages.js";

/** A file that was not accepted, and the reason for rejecting it. */
export interface RejectedFile {
  /** Name of the rejected file. */
  name: string;
  /**
   * Reason for rejection, already ready to show to the user: a wrong type or a size
   * that is too large.
   */
  reason: string;
}

export interface FileDropzoneProps {
  /** Accepted types in the `accept` format of `<input type="file">`: `image/*`, `.jpg,.png`. */
  accept?: string;
  /** Allows several files at once. Enabled by default. */
  multiple?: boolean;
  /** Size limit for one file, in bytes. */
  maxSize?: number;
  /** Called with the files that passed the type and size check. */
  onFiles: (files: File[]) => void;
  /**
   * Called with the files that failed the check, and the reasons for rejecting them.
   *
   * Rejected files. This is not a notification callback but part of the result: the
   * component itself must show them. See the component's JSDoc.
   */
  onReject?: (rejected: RejectedFile[]) => void;
  /** Label inside the area. */
  label?: string;
  /** Note under the label: accepted formats, size limit. */
  hint?: ReactNode;
  /** Disables the area: files are not accepted either by dragging or by the button. */
  disabled?: boolean;
  /** Classes on the root element. */
  className?: string;
}

/*
  The file size is FORMATTING, not translation. "MB" and "megabytes" are the same unit,
  written by the locale's rules. Therefore the unit comes from `Intl.NumberFormat`, not from
  the message catalog. Otherwise every new language would require translating SI abbreviations
  by hand, and making mistakes in them.
*/
function formatSize(bytes: number, locale: string): string {
  const mega = bytes >= 1024 * 1024;
  const value = Math.round(mega ? bytes / 1024 / 1024 : bytes / 1024);
  return new Intl.NumberFormat(locale, {
    style: "unit",
    unit: mega ? "megabyte" : "kilobyte",
    unitDisplay: "short",
  }).format(value);
}

/**
 * Area for dropping files.
 *
 * **Rejected files are shown with a reason, rather than disappearing silently.** This is the
 * component's only decision, and it comes from experience. An area that accepts seven out of
 * ten dropped files and says nothing about the other three reads as "the upload is broken".
 * The reason is written next to the name, as in "too large, 14 MB", because "file not
 * accepted" gives the user nothing to fix.
 *
 * Mouse and keyboard are equal. Dragging is handled by `DropZone`, and the choose button comes
 * from `FileTrigger`. An area without a button would be unavailable from the keyboard altogether.
 * That is not "less convenient" but "unusable".
 */
export function FileDropzone({
  accept,
  multiple = true,
  maxSize,
  onFiles,
  onReject,
  label,
  hint,
  disabled,
  className,
}: FileDropzoneProps) {
  const messages = useMessages();
  const locale = useUiLocale();
  const [rejected, setRejected] = useState<RejectedFile[]>([]);

  const accepts = (file: File) => {
    if (!accept) return true;
    return accept.split(",").some((rule) => {
      const r = rule.trim();
      if (r.endsWith("/*")) return file.type.startsWith(r.slice(0, -1));
      if (r.startsWith(".")) return file.name.toLowerCase().endsWith(r.toLowerCase());
      return file.type === r;
    });
  };

  const sort = (files: File[], extra: RejectedFile[] = []) => {
    const ok: File[] = [];
    const bad: RejectedFile[] = [...extra];

    for (const file of files) {
      // Through the catalog, like the other three reasons. As an inline string, it would
      // read in Russian in the middle of an English interface.
      if (!accepts(file)) bad.push({ name: file.name, reason: messages.fileDropzone.wrongType });
      else if (maxSize != null && file.size > maxSize)
        bad.push({
          name: file.name,
          reason: messages.fileDropzone.tooLarge({ size: formatSize(file.size, locale) }),
        });
      else ok.push(file);
    }

    /*
      The file-count limit is held HERE, not only by `FileTrigger`. Its `allowsMultiple` controls
      the picker dialog, but dragging is not governed by it. A single-file area could be dropped
      five files, and all five went to the caller, silently and against its own prop.
    */
    const accepted = multiple ? ok : ok.slice(0, 1);
    for (const file of ok.slice(accepted.length))
      bad.push({ name: file.name, reason: messages.fileDropzone.singleFileOnly });

    setRejected(bad);
    if (accepted.length) onFiles(accepted);
    if (bad.length) onReject?.(bad);
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <DropZone
        isDisabled={disabled}
        onDrop={async (e) => {
          /*
            Each file is resolved SEPARATELY.

            `Promise.all` discarded the whole array if even one `getFile()` rejected. The user
            dropped five files, one of which lay on a disconnected network drive or was deleted
            between the start of the drag and the drop, and got neither a file nor a reason. The
            refusal went to an unhandled rejection: exactly the "the upload broke" that the JSDoc
            promises to prevent.
          */
          const dropped = e.items.filter(
            (item): item is Extract<typeof item, { kind: "file" }> => item.kind === "file"
          );
          const settled = await Promise.allSettled(dropped.map((item) => item.getFile()));
          const files = settled
            .filter((r): r is PromiseFulfilledResult<File> => r.status === "fulfilled")
            .map((r) => r.value);
          // The name is taken from the DRAG ITEM ITSELF, not from the file, because the file
          // does not exist: it was not read. The order of `allSettled` matches the input order,
          // so the index leads to the right item.
          const unreadable: RejectedFile[] = settled.flatMap((r, index) =>
            r.status === "rejected"
              ? [{ name: dropped[index]!.name, reason: messages.fileDropzone.unreadable }]
              : []
          );
          /*
            Folders are rejected WITH A REASON, not filtered out silently. A dropped folder
            otherwise gave neither files nor a message, and the area looked broken in exactly
            the way it was promised not to.
          */
          const folders = e.items
            .filter((item) => item.kind === "directory")
            .map((item) => ({
              name: "name" in item ? item.name : messages.fileDropzone.folderName,
              reason: messages.fileDropzone.foldersNotAccepted,
            }));
          sort(files, [...folders, ...unreadable]);
        }}
        className={cn(
          "border-line-soft bg-bg-1 flex flex-col items-center justify-center gap-2 rounded-md border border-dashed px-6 py-8 transition-colors",
          // The drop state comes from the plugin's variant. The `data-drop-target` attribute
          // sits on the area itself, and the area is colored by it.
          "drop-target:border-accent-strong drop-target:bg-accent-soft",
          "focus-visible:outline-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2",
          // The disabled state is expressed with TONES, not `opacity-50`. This is not a matter
          // of taste: the area is a plain div, not a form field, and the axe audit measures its
          // contrast on par with the working content. Opacity dropped the label below 4.5, the
          // very rule that `Alert` has already paid for.
          disabled && "bg-bg-2 cursor-not-allowed"
        )}
      >
        <span aria-hidden className="text-fg-3">
          <UploadIcon size={24} strokeWidth={1.5} />
        </span>
        {/*
          `AriaText slot="label"` is not decoration: `DropZone` takes its accessible name from
          here. A plain `<span>` would leave the area unnamed, and a screen reader would announce
          "drop zone" without a word about what to drop here.
        */}
        <AriaText slot="label" className={cn("text-sm", disabled ? "text-fg-2" : "text-fg-1")}>
          {label ?? messages.fileDropzone.label}
        </AriaText>
        {hint ? <span className="text-fg-2 text-caption">{hint}</span> : null}

        <FileTrigger
          acceptedFileTypes={accept?.split(",")}
          allowsMultiple={multiple}
          onSelect={(list) => sort(Array.from(list ?? []))}
        >
          {/*
            The button is an `AriaButton`, not ours. `FileTrigger` connects its child through the
            react-aria `PressResponderContext`, and a plain `<button>` does not read it. The file
            picker dialog did NOT open AT ALL, and the console showed "A PressResponder was
            rendered without a pressable child". Verified: with our button, `input.click()` was
            never called; with this one, it is called exactly once.

            The look is the same, from `lib/button.ts`. There is nothing for them to diverge on.
            It is the same mechanism as `MenuButton` and the `Combobox` trigger.
          */}
          <AriaButton
            isDisabled={disabled}
            className={buttonClasses({ variant: "soft", tone: "neutral", size: "sm" })}
          >
            {messages.fileDropzone.browse}
          </AriaButton>
        </FileTrigger>
      </DropZone>

      {/*
        The live region is mounted ALWAYS, and only its content is swapped. A live region that is
        inserted into the document together with its text is announced unreliably: some screen
        readers manage to skip it.

        `role="alert"` sits on the container, not on the list. The role would override the role of
        the `ul`, and the number of rejected files would be lost.
      */}
      <div role="alert" className="empty:hidden">
        {rejected.length > 0 ? (
          <ul className="flex flex-col gap-1">
            {rejected.map((file) => (
              <li key={file.name} className="text-danger-strong text-caption">
                {file.name} — {file.reason}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
