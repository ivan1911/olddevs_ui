// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { Toaster, toast } from "../src/components/actions/Toaster.js";

afterEach(() => {
  toast.dismiss();
  cleanup();
});

/**
 * До волны 26 у компонента не было ни одного теста.
 *
 * Проверяется КОНТРАКТ КИТА, а не библиотека: что тост доезжает до экрана, что
 * тона ведут в разные сообщения и что `dismiss` снимает. Внутренности sonner —
 * его забота (ADR про взятую библиотеку).
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
