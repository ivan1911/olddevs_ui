// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ConfirmDialog } from "../src/components/overlays/ConfirmDialog.js";
import { UiProvider } from "../src/i18n/UiProvider.js";

afterEach(cleanup);

function setup(props: Partial<Parameters<typeof ConfirmDialog>[0]> = {}) {
  const onConfirm = vi.fn();
  const onClose = vi.fn();
  render(
    <ConfirmDialog
      open
      onClose={onClose}
      onConfirm={onConfirm}
      title="Delete the workspace"
      message="Every project and file is removed."
      confirmLabel="Delete"
      {...props}
    />
  );
  return { onConfirm, onClose, user: userEvent.setup() };
}

const confirmButton = () => screen.getByRole("button", { name: "Delete" });

describe("ConfirmDialog without typed confirmation", () => {
  test("has no field and the focus starts on the confirm button", () => {
    setup();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(document.activeElement).toBe(confirmButton());
    expect((confirmButton() as HTMLButtonElement).disabled).toBe(false);
  });

  test("an empty typeToConfirm means no field either — an empty string is not a name", () => {
    setup({ typeToConfirm: "" });
    expect(screen.queryByRole("textbox")).toBeNull();
    expect((confirmButton() as HTMLButtonElement).disabled).toBe(false);
  });
});

describe("ConfirmDialog with typeToConfirm", () => {
  test("the field is named from the catalog and takes the focus on open", () => {
    setup({ typeToConfirm: "Acme" });
    const field = screen.getByRole("textbox", { name: "Type “Acme” to confirm" });
    expect(document.activeElement).toBe(field);
  });

  test("the confirm button stays disabled until the text matches", async () => {
    const { user, onConfirm } = setup({ typeToConfirm: "Acme" });
    const field = screen.getByRole("textbox");
    expect((confirmButton() as HTMLButtonElement).disabled).toBe(true);

    await user.type(field, "Acm");
    expect((confirmButton() as HTMLButtonElement).disabled).toBe(true);

    await user.type(field, "e");
    expect((confirmButton() as HTMLButtonElement).disabled).toBe(false);

    await user.click(confirmButton());
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  test("the match is case-sensitive", async () => {
    const { user } = setup({ typeToConfirm: "Acme" });
    await user.type(screen.getByRole("textbox"), "acme");
    expect((confirmButton() as HTMLButtonElement).disabled).toBe(true);
  });

  test("spaces around the typed text do not matter, spaces inside do", async () => {
    const { user } = setup({ typeToConfirm: "Acme Labs" });
    const field = screen.getByRole("textbox");

    await user.type(field, "  Acme Labs ");
    expect((confirmButton() as HTMLButtonElement).disabled).toBe(false);

    await user.clear(field);
    await user.type(field, "AcmeLabs");
    expect((confirmButton() as HTMLButtonElement).disabled).toBe(true);
  });

  test("composed and decomposed letters count as the same text", async () => {
    // "é" as one character and "e" plus a combining accent: pasting a file name
    // from macOS brings in the second form.
    const { user } = setup({ typeToConfirm: "Caf\u00e9" });
    await user.type(screen.getByRole("textbox"), "Cafe\u0301");
    expect((confirmButton() as HTMLButtonElement).disabled).toBe(false);
  });

  test("Enter confirms only when the text matches", async () => {
    const { user, onConfirm } = setup({ typeToConfirm: "Acme" });
    const field = screen.getByRole("textbox");

    await user.type(field, "Ac{Enter}");
    expect(onConfirm).not.toHaveBeenCalled();

    await user.type(field, "me{Enter}");
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  test("Enter does nothing while the action is running", async () => {
    const { user, onConfirm } = setup({ typeToConfirm: "Acme", loading: true });
    const field = screen.getByRole("textbox") as HTMLInputElement;
    // Read-only: focus stays in the field, but the field no longer accepts typing.
    expect(field.readOnly).toBe(true);
    await user.type(field, "Acme{Enter}");
    expect(field.value).toBe("");
    expect(onConfirm).not.toHaveBeenCalled();
  });

  test("the field is described by the hint", () => {
    setup({ typeToConfirm: "Acme" });
    const field = screen.getByRole("textbox");
    const ids = field.getAttribute("aria-describedby")?.split(" ").filter(Boolean) ?? [];
    const described = ids.map((id) => document.getElementById(id)?.textContent ?? "").join(" ");
    expect(described).toContain("The match is case-sensitive.");
  });

  test("the dialog is still described by the question", () => {
    setup({ typeToConfirm: "Acme" });
    const dialog = screen.getByRole("alertdialog");
    const id = dialog.getAttribute("aria-describedby") ?? "";
    expect(document.getElementById(id)?.textContent).toBe("Every project and file is removed.");
  });

  test("Cancel closes the window without confirming", async () => {
    const { user, onClose, onConfirm } = setup({ typeToConfirm: "Acme" });
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  test("the typed text does not survive closing and reopening", async () => {
    const user = userEvent.setup();
    function Host() {
      const [open, setOpen] = useState(true);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Open
          </button>
          <ConfirmDialog
            open={open}
            onClose={() => setOpen(false)}
            onConfirm={() => {}}
            title="Delete"
            message="Sure?"
            typeToConfirm="Acme"
          />
        </>
      );
    }
    render(<Host />);

    await user.type(screen.getByRole("textbox"), "Acme");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: "Open" }));

    expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe("");
  });

  test("the text to type follows the prop", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <ConfirmDialog
        open
        onClose={() => {}}
        onConfirm={() => {}}
        title="Delete"
        message="Sure?"
        confirmLabel="Delete"
        typeToConfirm="Acme"
      />
    );
    await user.type(screen.getByRole("textbox"), "Acme");
    expect((confirmButton() as HTMLButtonElement).disabled).toBe(false);

    rerender(
      <ConfirmDialog
        open
        onClose={() => {}}
        onConfirm={() => {}}
        title="Delete"
        message="Sure?"
        confirmLabel="Delete"
        typeToConfirm="Globex"
      />
    );
    expect((confirmButton() as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("ConfirmDialog: messages", () => {
  test("a partial catalog falls back to English for the new messages", () => {
    render(
      <UiProvider messages={{ confirmDialog: { confirm: "Yes" } }}>
        <ConfirmDialog
          open
          onClose={() => {}}
          onConfirm={() => {}}
          title="Delete"
          message="Sure?"
          typeToConfirm="Acme"
        />
      </UiProvider>
    );
    expect(screen.getByRole("textbox", { name: "Type “Acme” to confirm" })).toBeTruthy();
  });
});

describe("the name in the field label", () => {
  test("keeps its own case under the uppercase label style, and the field name is unchanged", () => {
    setup({ typeToConfirm: "Acme Labs" });

    // Field labels are set in uppercase, but the comparison is case-sensitive, so
    // the name must stay "Acme Labs" and not be rendered as "ACME LABS".
    const name = screen.getByText("Acme Labs", { selector: "span" });
    expect(name.className).toContain("normal-case");
    expect(screen.getByRole("textbox", { name: "Type “Acme Labs” to confirm" })).toBeTruthy();
  });
});
