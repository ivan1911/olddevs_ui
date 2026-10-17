// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { ModalOverlay } from "../src/components/overlays/ModalOverlay.js";

afterEach(cleanup);

/**
 * Until wave 26 the component had no tests at all, although it handles both
 * Escape and closing by the scrim: two places where a failure is silent.
 */
test("a click on the scrim closes, a click on the content does not", async () => {
  const user = userEvent.setup();
  const onClose = vi.fn();
  const { container } = render(
    <ModalOverlay onClose={onClose}>
      <p>Body</p>
    </ModalOverlay>
  );

  await user.click(screen.getByText("Body"));
  expect(onClose).not.toHaveBeenCalled();

  await user.click(container.firstElementChild as HTMLElement);
  expect(onClose).toHaveBeenCalledTimes(1);
});

test("escape={false} switches the key off", async () => {
  const user = userEvent.setup();
  const onClose = vi.fn();
  render(
    <ModalOverlay onClose={onClose} escape={false}>
      <p>Body</p>
    </ModalOverlay>
  );

  await user.keyboard("{Escape}");
  expect(onClose).not.toHaveBeenCalled();
});

test("the layer is released on unmount, so the next overlay is topmost", async () => {
  const user = userEvent.setup();
  const onClose = vi.fn();

  function Host() {
    const [first, setFirst] = useState(true);
    return first ? (
      <ModalOverlay onClose={() => setFirst(false)}>
        <p>First</p>
      </ModalOverlay>
    ) : (
      <ModalOverlay onClose={onClose}>
        <p>Second</p>
      </ModalOverlay>
    );
  }

  render(<Host />);
  await user.keyboard("{Escape}");
  expect(screen.getByText("Second")).toBeTruthy();

  // If the unmounted layer stayed in the registry, the second overlay would not
  // consider itself topmost and would silently stop closing.
  await user.keyboard("{Escape}");
  expect(onClose).toHaveBeenCalledTimes(1);
});
