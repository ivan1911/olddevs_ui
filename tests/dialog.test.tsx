// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useRef, useState } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { ConfirmDialog } from "../src/components/overlays/ConfirmDialog.js";
import { Dialog } from "../src/components/overlays/Dialog.js";

/**
 * Modality: the name, focus return, and no closing while a submission is in progress.
 *
 * The focus trap is not tested here: jsdom does not move focus on Tab the way
 * a browser does, and a "check" that passes regardless is worse than having no
 * check. The trap is verified in the browser and is provided by Radix.
 */

afterEach(cleanup);

test("the window is announced as a dialog and takes its name from the title", () => {
  render(
    <Dialog open onClose={vi.fn()} title="New album">
      body
    </Dialog>
  );

  const dialog = screen.getByRole("dialog");
  const titleId = dialog.getAttribute("aria-labelledby");
  expect(titleId).toBeTruthy();
  // The link must point to an existing heading: in the first version it pointed
  // to `id={undefined}`, the link pointed at nothing, and the dialog stayed
  // unnamed, which is exactly the defect this primitive was created to fix.
  expect(document.getElementById(titleId!)?.textContent).toBe("New album");
});

test("the alertdialog role is for a window that demands an answer", () => {
  render(
    <Dialog open onClose={vi.fn()} role="alertdialog" title="Delete?">
      body
    </Dialog>
  );
  expect(screen.getByRole("alertdialog")).toBeTruthy();
});

test("a window without the standard header keeps its accessible name", () => {
  render(
    <Dialog open onClose={vi.fn()} title="Select photos" header={false}>
      picker content
    </Dialog>
  );

  expect(screen.getByRole("dialog", { name: "Select photos" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
});

test("the delete confirmation sits above the preview card", () => {
  render(
    <ConfirmDialog
      open
      onClose={vi.fn()}
      onConfirm={vi.fn()}
      title="Delete photos"
      message="This action cannot be undone."
    />
  );

  expect(screen.getByRole("alertdialog").parentElement?.className).toContain("z-100");
});

test("Escape closes the window", async () => {
  const user = userEvent.setup();
  const onClose = vi.fn();
  render(
    <Dialog open onClose={onClose} title="Window">
      body
    </Dialog>
  );

  await user.keyboard("{Escape}");
  expect(onClose).toHaveBeenCalled();
});

test("the Escape handler may keep the window open", async () => {
  const user = userEvent.setup();
  const onClose = vi.fn();
  render(
    <Dialog
      open
      onClose={onClose}
      title="Photo preview"
      onEscapeKeyDown={(event) => event.preventDefault()}
    >
      body
    </Dialog>
  );

  await user.keyboard("{Escape}");

  expect(onClose).not.toHaveBeenCalled();
  expect(screen.getByRole("dialog", { name: "Photo preview" })).toBeTruthy();
});

test("while submitting it closes neither by the cross nor by Escape", async () => {
  const user = userEvent.setup();
  const onClose = vi.fn();
  render(
    <Dialog open onClose={onClose} loading title="Window">
      body
    </Dialog>
  );

  await user.keyboard("{Escape}");
  expect(onClose).not.toHaveBeenCalled();
  // The close button is not merely disabled, it is absent: there is nothing to close
  // with, and showing a disabled button would promise an action that will not happen.
  expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
});

test("focus goes where told and returns to whoever opened it", async () => {
  const user = userEvent.setup();

  function Example() {
    const [open, setOpen] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    return (
      <>
        <button onClick={() => setOpen(true)}>Open</button>
        <Dialog
          open={open}
          onClose={() => setOpen(false)}
          title="Window"
          initialFocusRef={inputRef}
        >
          <input ref={inputRef} aria-label="Name" />
        </Dialog>
      </>
    );
  }

  render(<Example />);
  const trigger = screen.getByRole("button", { name: "Open" });
  await user.click(trigger);

  expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Name" }));

  await user.keyboard("{Escape}");

  // Radix returns focus to its own `Dialog.Trigger`, which does not exist here:
  // the dialogs are opened from application state. Without its own return,
  // focus went to `<body>`, and keyboard users had to start navigating again.
  expect(document.activeElement).toBe(trigger);
});

/**
 * A dialog with the `alertdialog` role must have an accessible DESCRIPTION.
 *
 * `aria-describedby` was hard-coded to `undefined` to suppress a warning from
 * Radix, and the consequence went further than intended: no kit dialog could have
 * a description at all. For `ConfirmDialog` this meant the question itself was not
 * read to the screen reader: only the dialog name and the button focus moved to
 * were announced.
 */
test("a confirmation announces the question, not just its title", () => {
  render(
    <ConfirmDialog
      open
      onClose={() => {}}
      onConfirm={() => {}}
      title="Delete"
      message="Delete 12 items permanently?"
    />
  );

  const dialog = screen.getByRole("alertdialog");
  const ids = dialog.getAttribute("aria-describedby")?.split(" ").filter(Boolean) ?? [];

  // The COMPUTED link is checked: the reference must point to the node holding the
  // question's text, not merely exist.
  const described = ids.map((id) => document.getElementById(id)?.textContent ?? "").join(" ");
  expect(described).toContain("Delete 12 items permanently?");
});

test("the description points at the visible paragraph, not at a copy", () => {
  render(
    <ConfirmDialog
      open
      onClose={() => {}}
      onConfirm={() => {}}
      title="Delete"
      message={
        <>
          Delete 12 items? <a href="/docs">More</a>
        </>
      }
    />
  );

  /*
    The first fix passed `message` into `description` and rendered it as a hidden
    copy: the text ended up in the document TWICE, a link inside it added an
    invisible extra tab stop in the `alertdialog`, and a component with its own `id`
    produced a duplicate id.
  */
  expect(screen.getAllByRole("link", { hidden: true })).toHaveLength(1);
  expect(screen.getAllByText(/Delete 12 items/)).toHaveLength(1);
});

test("a dialog without a description does not point at nothing", () => {
  render(
    <Dialog open onClose={() => {}} title="Window">
      <span>body</span>
    </Dialog>
  );

  expect(screen.getByRole("dialog").getAttribute("aria-describedby")).toBeNull();
});

/**
 * A nested dialog returns focus to a button INSIDE the parent dialog.
 *
 * The first version of `useOpenerFocus` treated as "the opener" everything that
 * sits inside `[role="dialog"]`, but the button that opened the confirmation, by
 * definition, sits inside the parent dialog. It was rejected, and the hook fell
 * back to the history entry "last focus outside modal layers", and after closing,
 * focus moved to `<body>`. Before wave 26 `Dialog` had no such condition and worked
 * correctly, so this was a regression introduced by the fix. None of the 1075 tests
 * caught it.
 */
test("a nested confirmation returns focus to the button that opened it", async () => {
  const user = userEvent.setup({ pointerEventsCheck: 0 });

  function Host() {
    const [inner, setInner] = useState(false);
    return (
      <Dialog open onClose={() => {}} title="Outer">
        <button type="button" onClick={() => setInner(true)}>
          Delete item
        </button>
        <ConfirmDialog
          open={inner}
          onClose={() => setInner(false)}
          onConfirm={() => {}}
          title="Delete"
          message="Delete it?"
        />
      </Dialog>
    );
  }

  render(<Host />);
  const opener = screen.getByRole("button", { name: "Delete item" });
  await user.click(opener);
  await user.keyboard("{Escape}");

  expect(document.activeElement).toBe(opener);
});
