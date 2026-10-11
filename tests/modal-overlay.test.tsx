// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { ModalOverlay } from "../src/components/overlays/ModalOverlay.js";

afterEach(cleanup);

/**
 * До волны 26 у компонента не было ни одного теста, при том что он держит и
 * Escape, и закрытие по подложке — два места, где отказ молчит.
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

  // Если ушедший слой остался бы в реестре, второй не считал бы себя верхним и
  // молча перестал бы закрываться.
  await user.keyboard("{Escape}");
  expect(onClose).toHaveBeenCalledTimes(1);
});
