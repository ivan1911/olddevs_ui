// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { TagInput } from "../src/components/inputs/TagInput.js";

afterEach(cleanup);

test("Backspace on empty input removes the last tag", async () => {
  const user = userEvent.setup();
  const onChangeSpy = vi.fn();

  render(<TagInput value={["sunset", "mountains"]} onChange={onChangeSpy} label="Tags" />);

  await user.click(screen.getByLabelText("Tags: add"));
  await user.keyboard("{Backspace}");

  expect(onChangeSpy).toHaveBeenCalledWith(["sunset"]);
});

test("Backspace with non-empty input does not touch the tags", async () => {
  const user = userEvent.setup();
  const onChangeSpy = vi.fn();

  render(<TagInput value={["sunset"]} onChange={onChangeSpy} label="Tags" />);

  const field = screen.getByLabelText("Tags: add");
  await user.type(field, "fo{Backspace}");

  // What gets erased is what was typed, not the neighboring tag: otherwise a typo could not
  // be fixed without losing a tag.
  expect(onChangeSpy).not.toHaveBeenCalled();
});

test("Enter adds a tag, an empty Enter does nothing", async () => {
  const user = userEvent.setup();
  const onChangeSpy = vi.fn();

  render(<TagInput value={[]} onChange={onChangeSpy} label="Tags" />);

  const field = screen.getByLabelText("Tags: add");
  await user.click(field);
  await user.keyboard("{Enter}");
  expect(onChangeSpy).not.toHaveBeenCalled();

  await user.type(field, "sunset{Enter}");
  expect(onChangeSpy).toHaveBeenCalledWith(["sunset"]);
});

test("duplicates are neither added nor complained about", async () => {
  const user = userEvent.setup();
  const onChangeSpy = vi.fn();

  render(<TagInput value={["sunset"]} onChange={onChangeSpy} label="Tags" />);

  await user.type(screen.getByLabelText("Tags: add"), "sunset{Enter}");

  // A repeated tag means nothing; reporting it would mean scolding the user for an action
  // that broke nothing.
  expect(onChangeSpy).not.toHaveBeenCalled();
  expect(screen.getByLabelText("Tags: add")).toHaveProperty("value", "");
});

/**
 * The limit is reached — the field is read-only, and NOT disabled.
 *
 * `disabled` on a field that holds the caret takes focus away from it: a user typed the
 * last tag and pressed Enter, and focus flew to the document, and the form's tab order
 * started over. On top of that, Backspace stopped working for removing the last tag: a
 * disabled field receives no events at all.
 */
test("the limit stops input without dropping focus or removal", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(<TagInput value={["a", "b"]} onChange={onChange} label="Tags" max={2} />);

  const field = screen.getByLabelText("Tags: add") as HTMLInputElement;
  expect(field.disabled).toBe(false);
  expect(field.readOnly).toBe(true);

  field.focus();
  expect(document.activeElement).toBe(field);

  // Backspace still removes the last tag: a disabled field received no events at all.
  await user.keyboard("{Backspace}");
  expect(onChange).toHaveBeenCalledWith(["a"]);
});

/**
 * A regression from the review of wave 18. The remove button's name was doubled: react-aria
 * appends the label of its tag itself, so "Remove tag alpha" read as "Remove tag alpha alpha".
 * The markup does not show this — the attribute looks correct — so the computed accessible
 * name is checked.
 */
test("TagInput: the remove button names the tag exactly once", () => {
  render(<TagInput label="Tags" value={["alpha"]} onChange={() => {}} />);

  // The role query computes the accessible name the same way a screen reader does, and
  // unlike reading `aria-label` it sees what react-aria appended. The labels come from the
  // English fallback: there is no provider here.
  expect(screen.getByRole("button", { name: "Remove tag alpha" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Remove tag alpha alpha" })).toBeNull();
});
