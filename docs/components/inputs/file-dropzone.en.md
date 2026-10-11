---
component: FileDropzone
exports: [FileDropzone]
category: inputs
status: stable
source: src/components/inputs/FileDropzone.tsx
story: src/components/inputs/FileDropzone.stories.tsx
sourceHash: 689567ce58ae
---

# FileDropzone

## Summary for AI

`FileDropzone` accepts files through drag-and-drop or a file selection button. It checks the type and size, rejects more than one file when `multiple={false}`, shows the reasons for rejection and returns the accepted `File[]` to the consumer.

## When to use

- You need an accessible upload area with mouse and keyboard support.
- You need the client-side limits `accept`, `maxSize`, `multiple` and an explanation of rejections.

## When not to use

- Do not show the upload state of already chosen files in the area — that is `UploadQueue`. The area supplies files; the queue shows what happened to them.
- Do not treat `FileDropzone` as an upload implementation: networking, progress, retries and server-side validation stay with the consumer.
- For a single plain file input without a drop zone, a native `<input type="file">` is enough.

## Minimal example

```tsx
<FileDropzone
  accept="image/*"
  maxSize={10 * 1024 * 1024}
  onFiles={enqueueFiles}
  onReject={showRejected}
  hint="PNG or JPEG up to 10 MB"
/>
```

## Public API

- `onFiles` is required and receives only the accepted files; `onReject` receives `{ name, reason }[]`.
- `accept` uses the syntax of the `accept` attribute of a file input (`image/*`, `.jpg,.png`), `multiple` is true by default, `maxSize` is in bytes.
- `label` sets the accessible name of the DropZone; `hint` sets the text under the label, `disabled` disables the area, `className` changes the look of the root element.
- Folders, a wrong type, a file that is too large and extra files with `multiple={false}` each get a rejection reason.

## Accessibility and forms

- Do not remove the "Choose files" button: it lets keyboard users choose files.
- A rejection is shown in a live region `role="alert"`; do not discard files silently.
- See `src/components/inputs/FileDropzone.tsx`, `src/components/inputs/FileDropzone.stories.tsx`, `tests/file-dropzone.test.tsx`.
