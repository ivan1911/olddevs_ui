// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { FileDropzone } from "../src/components/inputs/FileDropzone.js";
import { DEFAULT_MESSAGES } from "../src/i18n/defaults.js";
import { messages as ru } from "../src/locales/ru.js";

afterEach(cleanup);

function file(name: string, type: string, size: number): File {
  const f = new File(["x"], name, { type });
  Object.defineProperty(f, "size", { value: size });
  return f;
}

test("a rejected file is shown with a reason instead of vanishing", async () => {
  const user = userEvent.setup();
  const onFiles = vi.fn();

  render(<FileDropzone accept="image/*" maxSize={1024} onFiles={onFiles} />);

  const field = document.querySelector('input[type="file"]') as HTMLInputElement;
  // A wrong TYPE cannot be checked through the picker dialog: the field's `accept` filters
  // such files out already in the dialog, so they never reach the component, the same way
  // the browser behaves. The type filter works on the drag-and-drop path, where the OS filters
  // nothing; here only the size limit remains.
  await user.upload(field, [
    file("small.png", "image/png", 100),
    file("huge.png", "image/png", 5000),
  ]);

  // The accepted file went to the caller...
  expect(onFiles).toHaveBeenCalledTimes(1);
  expect(onFiles.mock.calls[0]![0].map((f: File) => f.name)).toEqual(["small.png"]);

  // ...and the rejected one is reported on screen, with the reason.
  expect(screen.getByText(/huge\.png — too large, 5 kB/)).toBeTruthy();
});

test("the rejection is announced aloud", async () => {
  const user = userEvent.setup();
  render(<FileDropzone accept="image/*" maxSize={1024} onFiles={() => {}} />);

  const field = document.querySelector('input[type="file"]') as HTMLInputElement;
  await user.upload(field, [file("huge.png", "image/png", 99999)]);

  // Otherwise the user learns of the refusal only by tabbing to this spot.
  expect(screen.getByRole("alert")).toBeTruthy();
});

test("the choose button really opens the dialog", async () => {
  const user = userEvent.setup();
  render(<FileDropzone onFiles={() => {}} />);

  const field = document.querySelector('input[type="file"]') as HTMLInputElement;
  const click = vi.spyOn(field, "click");

  await user.click(screen.getByRole("button", { name: "Choose files" }));

  // Checking that the button exists is not enough: with a plain `<button>` it looked
  // functional and never once opened the dialog. `FileTrigger` connects its child through
  // the react-aria context, which a plain button does not read.
  expect(click).toHaveBeenCalledTimes(1);
});

test("a single-file zone does not accept a batch", async () => {
  const user = userEvent.setup();
  const onFiles = vi.fn();

  render(<FileDropzone multiple={false} onFiles={onFiles} />);

  const field = document.querySelector('input[type="file"]') as HTMLInputElement;
  await user.upload(field, [file("a.png", "image/png", 10), file("b.png", "image/png", 10)]);

  // Through the picker dialog the second file would not arrive at all: a field without
  // `multiple` filters it out, as the browser does too. The component's limit is visible
  // on the drag-and-drop path: there the OS filters nothing, and before, all five dropped
  // files went to the caller despite the prop.
  expect(onFiles.mock.calls[0]![0].map((f: File) => f.name)).toEqual(["a.png"]);
  expect(field.multiple).toBe(false);
});

/**
 * WHAT IS NOT TESTED HERE, and why.
 *
 * Both fixes of wave 26 lie on the DRAG-AND-DROP path: the `getFile()` rejection and the type
 * filter (on the dialog path `accept` filters the file out before the component; the comment
 * in the first test says so). The drag path cannot be reproduced in jsdom: `DropZone` from
 * react-aria waits for real drag events with a `DataTransfer`, which jsdom essentially lacks.
 *
 * So below we check what can be checked without a drag: both rejection reasons exist in the
 * catalogue and in both locales, so a Russian string in their place will not come back.
 * The drop parsing itself is guarded by `tests-visual/`, where the area already exists.
 */
test("both drag-path rejection reasons come from the catalogue", () => {
  // `wrongType` replaced the Russian string hard-coded in the component; `unreadable` is
  // a new reason for a file that could not be read.
  expect(DEFAULT_MESSAGES.fileDropzone.wrongType).toBeTruthy();
  expect(DEFAULT_MESSAGES.fileDropzone.unreadable).toBeTruthy();
  expect(ru.fileDropzone.wrongType).toBeTruthy();
  expect(ru.fileDropzone.unreadable).toBeTruthy();
});
