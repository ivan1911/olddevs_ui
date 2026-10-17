// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ContextualSaveBar } from "../src/components/navigation/ContextualSaveBar.js";

afterEach(cleanup);

describe("ContextualSaveBar", () => {
  test("without unsaved changes there is no bar, but the live region is in place", () => {
    render(<ContextualSaveBar visible={false} onSave={() => {}} />);

    expect(screen.queryByRole("group")).toBeNull();

    // The region is mounted in advance and empty. If it were mounted together with
    // its text, some screen readers would see only an empty node and stay silent.
    const live = screen.getByRole("status");
    expect(live.textContent).toBe("");
  });

  test("appearing is announced, not only drawn", () => {
    const { rerender } = render(<ContextualSaveBar visible={false} onSave={() => {}} />);
    rerender(<ContextualSaveBar visible onSave={() => {}} />);

    expect(screen.getByRole("status").textContent).toBe("You have unsaved changes");
  });

  test("the number of edits is named when it is passed", () => {
    render(<ContextualSaveBar visible count={3} onSave={() => {}} />);

    // The text is deliberately present in two places: as the visible line and in the
    // live region. That is why the queries are scoped to the bar, not the whole document.
    const bar = within(screen.getByRole("group"));
    expect(bar.getByText("3 unsaved changes")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("3 unsaved changes");
  });

  test("without a handler there is no cancel at all", () => {
    render(<ContextualSaveBar visible onSave={() => {}} />);

    expect(screen.getByRole("button", { name: "Save" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Discard" })).toBeNull();
  });

  test("both buttons report outwards", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const onCancel = vi.fn();
    render(<ContextualSaveBar visible onSave={onSave} onCancel={onCancel} />);

    await user.click(screen.getByRole("button", { name: "Discard" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  test("while saving the progress is audible and cancel is disabled", () => {
    render(<ContextualSaveBar visible saving onSave={() => {}} onCancel={() => {}} />);

    expect(screen.getByRole("status").textContent).toBe("Saving…");
    expect(screen.getByRole("button", { name: "Discard" }).hasAttribute("disabled")).toBe(true);
  });

  test("a save failure is visible in the bar and announced", () => {
    render(<ContextualSaveBar visible error="The server did not answer" onSave={() => {}} />);

    expect(within(screen.getByRole("group")).getByText("The server did not answer")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("The server did not answer");

    // It is status, not alert: a failure comes with visible text in the bar itself,
    // and there is no need to interrupt the screen reader (ADR-0026).
    expect(screen.queryByRole("alert")).toBeNull();
  });

  test("the bar is a named group, not a pile of buttons mid-page", () => {
    render(<ContextualSaveBar visible onSave={() => {}} />);

    expect(screen.getByRole("group", { name: "Unsaved changes" })).toBeTruthy();
  });

  test("a custom wording displaces the default but not the edit counter", () => {
    render(
      <ContextualSaveBar
        visible
        count={5}
        message="The article draft is not saved"
        onSave={() => {}}
      />
    );

    expect(
      within(screen.getByRole("group")).getByText("The article draft is not saved")
    ).toBeTruthy();
    expect(screen.queryByText("5 unsaved changes")).toBeNull();
  });
});
