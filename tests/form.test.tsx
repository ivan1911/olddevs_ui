// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { Button } from "../src/components/actions/Button.js";
import { Checkbox } from "../src/components/inputs/Checkbox.js";
import { Form } from "../src/components/inputs/Form.js";
import { TextControl } from "../src/components/inputs/TextControl.js";

afterEach(cleanup);

function FormDemo({ pending, onSubmit }: { pending?: boolean; onSubmit: () => void }) {
  return (
    <Form onSubmit={onSubmit} pending={pending}>
      <TextControl name="title" aria-label="Name" />
      <Checkbox name="pin">Pin</Checkbox>
      <Button type="submit">Save</Button>
    </Form>
  );
}

test("submitting does not reload the page", async () => {
  const user = userEvent.setup();
  const onSubmit = vi.fn();
  render(<FormDemo onSubmit={onSubmit} />);

  await user.click(screen.getByRole("button", { name: "Save" }));
  expect(onSubmit).toHaveBeenCalledTimes(1);
});

test("while submitting the form does not submit again", async () => {
  const user = userEvent.setup();
  const onSubmit = vi.fn();
  render(<FormDemo pending onSubmit={onSubmit} />);

  await user.click(screen.getByRole("button", { name: "Save" }));
  expect(onSubmit).not.toHaveBeenCalled();
});

test("pending disables every field at once instead of one by one", () => {
  render(<FormDemo pending onSubmit={() => {}} />);

  // The native `<fieldset disabled>` also disables fields that are added later,
  // so the form does not need to know its own contents.
  //
  // We check `:disabled`, not the `disabled` property: the property reflects the
  // element's OWN attribute and stays `false` inside a disabled fieldset, as it
  // does in the browser. Only the pseudo-class sees the inherited state, and that
  // is what the `disabled:` variants from the dictionary match.
  expect(screen.getByRole("textbox", { name: "Name" }).matches(":disabled")).toBe(true);
  expect(screen.getByRole("checkbox", { name: "Pin" }).matches(":disabled")).toBe(true);
  expect(screen.getByRole("button", { name: "Save" }).matches(":disabled")).toBe(true);
});

test("Enter in a text field does not get through while submitting either", async () => {
  const user = userEvent.setup();
  const onSubmit = vi.fn();
  const { rerender } = render(<FormDemo onSubmit={onSubmit} />);

  // First, make sure Enter submits the form at all.
  await user.type(screen.getByRole("textbox", { name: "Name" }), "{Enter}");
  expect(onSubmit).toHaveBeenCalledTimes(1);

  onSubmit.mockClear();
  rerender(<FormDemo pending onSubmit={onSubmit} />);
  await user.type(screen.getByRole("textbox", { name: "Name" }), "{Enter}");
  expect(onSubmit).not.toHaveBeenCalled();
});

test("a fieldset does not break the layout", () => {
  const { container } = render(<FormDemo onSubmit={() => {}} />);
  // `contents` removes the fieldset box itself from the layout: the fields stay
  // direct children of the form with its `gap`, otherwise the vertical spacing
  // would collapse.
  const fieldset = container.querySelector("fieldset")!;
  expect(fieldset.className).toContain("contents");
});
