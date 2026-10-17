// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { Toaster, toast } from "../src/components/actions/Toaster.js";

afterEach(() => {
  toast.dismiss();
  cleanup();
});

/**
 * Before wave 26 the component had no tests at all.
 *
 * The kit's CONTRACT is checked, not the library: that a toast reaches the screen, that
 * tones lead to different messages, and that `dismiss` removes it. The internals of
 * sonner are its own concern (the ADR about the adopted library).
 */
test("a toast reaches the screen", async () => {
  render(<Toaster />);

  toast.success("Saved");

  await waitFor(() => expect(screen.getByText("Saved")).toBeTruthy());
});

test("dismiss removes it", async () => {
  render(<Toaster />);

  toast.info("Temporary");
  await waitFor(() => expect(screen.getByText("Temporary")).toBeTruthy());

  toast.dismiss();
  await waitFor(() => expect(screen.queryByText("Temporary")).toBeNull());
});

test("a promise toast goes from pending to a result", async () => {
  render(<Toaster />);

  let resolve: (v: string) => void = () => {};
  const promise = new Promise<string>((r) => {
    resolve = r;
  });

  toast.promise(promise, {
    loading: "Saving…",
    success: (name) => `Saved ${name}`,
    error: "Failed",
  });

  await waitFor(() => expect(screen.getByText("Saving…")).toBeTruthy());
  resolve("draft");
  await waitFor(() => expect(screen.getByText("Saved draft")).toBeTruthy());
});
