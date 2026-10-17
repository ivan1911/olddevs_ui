// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { MaskedInput } from "../src/components/inputs/MaskedInput.js";

afterEach(cleanup);

const PHONE = "+7 (999) 999-99-99";

function Field({
  initial = "",
  mask = PHONE,
  showMask,
}: {
  initial?: string;
  mask?: string;
  showMask?: boolean;
}) {
  const [value, setValue] = useState(initial);
  return (
    <MaskedInput
      mask={mask}
      value={value}
      onChange={setValue}
      showMask={showMask}
      aria-label="Phone"
    />
  );
}

/** The visible part of the mask guide: what the user reads as the rest of the format. */
const remainder = () => document.querySelector("[aria-hidden] > span + span")?.textContent;

const field = () => screen.getByRole("textbox", { name: "Phone" }) as HTMLInputElement;

test("input is laid out by the mask", async () => {
  const user = userEvent.setup();
  render(<Field />);

  await user.type(field(), "9161234567");

  expect(field().value).toBe("+7 (916) 123-45-67");
});

test("both representations go outwards", () => {
  const onChange = vi.fn();
  render(<MaskedInput mask={PHONE} value="" onChange={onChange} aria-label="Phone" />);

  fireEvent.change(screen.getByRole("textbox"), { target: { value: "916" } });

  // The request needs the raw value; whoever stores the text as shown needs the formatted one.
  expect(onChange).toHaveBeenCalledWith("916", "+7 (916");
});

test("pasting a whole value is laid out", async () => {
  const user = userEvent.setup();
  render(<Field />);

  field().focus();
  await user.paste("+7 916 123 45 67");

  // Pasted text arrives as the same input event, and parsing it by the mask
  // lays it out the same way as typed text.
  expect(field().value).toBe("+7 (916) 123-45-67");
});

test("a digit literal of the mask does not reach the value", () => {
  const onChange = vi.fn();
  render(<MaskedInput mask={PHONE} value="" onChange={onChange} aria-label="Phone" />);

  fireEvent.change(screen.getByRole("textbox"), { target: { value: "+7 (916) 123-45-67" } });

  // In the mask the literal `7` is a digit too: a naive "keep only digits" filter
  // would pull it into the value, and the number would become eleven digits long.
  expect(onChange).toHaveBeenCalledWith("9161234567", "+7 (916) 123-45-67");
});

test("anything beyond the mask capacity is dropped", async () => {
  const user = userEvent.setup();
  render(<Field />);

  field().focus();
  await user.paste("91612345678888");

  expect(field().value).toBe("+7 (916) 123-45-67");
});

test("Backspace across a literal deletes a value character, not the literal", () => {
  const onChange = vi.fn();
  render(<MaskedInput mask={PHONE} value="916" onChange={onChange} aria-label="Phone" />);

  const el = screen.getByRole("textbox") as HTMLInputElement;
  // The caret sits right after `)`: the character to its left is a literal.
  el.setSelectionRange(9, 9);
  fireEvent.keyDown(el, { key: "Backspace" });

  // Otherwise the literal would be deleted, immediately put back by formatting,
  // and the keypress would change nothing: the defect looks like a stuck key.
  expect(onChange).toHaveBeenCalledWith("91", "+7 (91");
});

test("Backspace at the start of the value does nothing", () => {
  const onChange = vi.fn();
  render(<MaskedInput mask={PHONE} value="916" onChange={onChange} aria-label="Phone" />);

  const el = screen.getByRole("textbox") as HTMLInputElement;
  el.setSelectionRange(0, 0);
  fireEvent.keyDown(el, { key: "Backspace" });

  expect(onChange).not.toHaveBeenCalled();
});

test("the caret stays where the edit is instead of jumping to the end", () => {
  const onChange = vi.fn();
  const { rerender } = render(
    <MaskedInput mask={PHONE} value="9161234567" onChange={onChange} aria-label="Phone" />
  );

  const el = screen.getByRole("textbox") as HTMLInputElement;
  // Editing the third digit: "916" → "9165".
  el.setSelectionRange(7, 7);
  fireEvent.change(el, { target: { value: "+7 (9165) 123-45-67", selectionStart: 8 } });

  const [raw] = onChange.mock.calls[0]! as [string, string];
  rerender(
    <MaskedInput mask={PHONE} value={raw as string} onChange={onChange} aria-label="Phone" />
  );

  // Formatting redraws the whole string, and the browser puts the caret at the
  // end, so editing the middle of a number becomes impossible. Here four digits
  // are to the left of the caret, and it lands after the fourth: in "+7 (916) 5"
  // that is position ten, because ") " sits between the third and fourth digits.
  expect(raw).toBe("9165123456");
  expect(el.value).toBe("+7 (916) 512-34-56");
  expect(el.selectionStart).toBe(10);
});

test("a foreign key handler is not displaced", () => {
  const onKeyDown = vi.fn();
  render(
    <MaskedInput
      mask={PHONE}
      value="916"
      onChange={() => {}}
      onKeyDown={onKeyDown}
      aria-label="Phone"
    />
  );

  fireEvent.keyDown(screen.getByRole("textbox"), { key: "Backspace" });
  expect(onKeyDown).toHaveBeenCalled();
});

test("a mask of letters and any-characters works the same", async () => {
  const user = userEvent.setup();
  render(<Field mask="aa-**" />);

  await user.type(field(), "AB12");

  expect(field().value).toBe("AB-12");
});

test("an empty field shows the whole format", () => {
  render(<Field />);

  // Before the mask guide, the field did not show the format AT ALL: `formatMask`
  // stops where the value ends, and an empty field was just an empty box.
  expect(remainder()).toBe("+7 (___) ___-__-__");
});

test("the skeleton is eaten as you type", async () => {
  const user = userEvent.setup();
  render(<Field />);

  await user.type(field(), "916");
  // Literals already inserted by formatting left the remainder together with the
  // digits: the shown text and the remainder together give exactly the mask.
  expect(remainder()).toBe(") ___-__-__");
  expect(field().value + remainder()).toBe("+7 (916) ___-__-__");
});

test("a filled field shows no skeleton", () => {
  render(<Field initial="9161234567" />);

  expect(remainder()).toBe("");
});

test("a hidden prefix holds what was typed, not underscores", () => {
  render(<Field initial="916" />);

  // The alignment relies on this: the same digit sits under the digit, and the
  // remainder starts exactly where the input ended. The prefix is kept as mask
  // characters: the match would otherwise depend on the width of `_` and `8` in
  // the consumer's font.
  const prefix = document.querySelector("[aria-hidden] > span")!;
  expect(prefix.textContent).toBe("+7 (916");
  expect(prefix.className).toContain("invisible");
});

test("the skeleton is not read aloud", () => {
  render(<Field />);

  // The format for screen readers lives in the `FormField` hint, linked to the
  // field via `aria-describedby`: it stays available while the user types,
  // whereas the mask guide disappears as they type.
  expect(field().getAttribute("aria-describedby")).toBeNull();
  expect(document.querySelector("[aria-hidden]")!.textContent).toBe("+7 (___) ___-__-__");
});

test("the skeleton is switched off by a prop", () => {
  render(<Field showMask={false} />);

  expect(document.querySelector("[aria-hidden]")).toBeNull();
});

test("the skeleton is recomputed on a programmatic value change", () => {
  // The USWDS reference implementation attaches its handler to `keyup`, and a
  // mouse paste, autofill and a programmatic change leave the mask guide out of
  // sync. Here it is computed from `value` during render, so the source of the
  // change does not matter.
  const { rerender } = render(
    <MaskedInput mask={PHONE} value="" onChange={() => {}} aria-label="Phone" />
  );
  expect(remainder()).toBe("+7 (___) ___-__-__");

  rerender(<MaskedInput mask={PHONE} value="916" onChange={() => {}} aria-label="Phone" />);
  expect(remainder()).toBe(") ___-__-__");
});

test("an unsuitable character is announced instead of vanishing silently", async () => {
  const user = userEvent.setup();
  render(<Field />);

  await user.type(field(), "a");
  // Before this, the character vanished without a trace and without a word: the
  // user saw the keypress "not work" and was left with no explanation.
  expect(screen.getByRole("status").textContent).toBe("A digit is expected here");
});

test("the announcement says what was expected", async () => {
  const user = userEvent.setup();
  render(<Field mask="aa-99" />);

  await user.type(field(), "1");
  expect(screen.getByRole("status").textContent).toBe("A letter is expected here");
});

test("a successful paste with separators does not count as an error", async () => {
  const user = userEvent.setup();
  render(<Field />);

  // Separators in a pasted number do not match the tokens, but are laid out as
  // usual: a check by character match would report an error on every successful
  // paste.
  await user.click(field());
  await user.paste("+7 916 123 45 67");
  expect(field().value).toBe("+7 (916) 123-45-67");
  expect(screen.getByRole("status").textContent).toBe("");
});

test("a filled mask announces fullness, not the expected token", async () => {
  const user = userEvent.setup();
  render(<Field initial="9161234567" />);

  await user.type(field(), "8");
  expect(screen.getByRole("status").textContent).toBe("The field is already complete");
});

test("a successful input after a failed one clears the announcement", async () => {
  const user = userEvent.setup();
  render(<Field />);

  await user.type(field(), "a");
  expect(screen.getByRole("status").textContent).toBe("A digit is expected here");

  await user.type(field(), "9");
  expect(screen.getByRole("status").textContent).toBe("");
});

test("the live region is always mounted", () => {
  render(<Field />);

  // A region inserted into the document together with its message is announced
  // unreliably: some screen readers manage to skip it.
  expect(screen.getByRole("status").textContent).toBe("");
});

test("a mask literal typed instead of a digit is announced too", async () => {
  const user = userEvent.setup();
  render(<Field />);

  // `7` in the mask `+7 (999) 999-99-99` is a literal, and it is also a digit. The
  // habit of typing "+7" by hand eats the character as a literal: the value stays
  // empty and the field does not change. A check "does the character fit the
  // token" would count it as accepted and stay silent, which is exactly the
  // defect the announcement was added for.
  await user.type(field(), "7");
  expect(field().value).toBe("");
  expect(screen.getByRole("status").textContent).toBe("A digit is expected here");
});

test("editing the middle of a filled field does not count as a rejection", async () => {
  const user = userEvent.setup();
  render(<Field initial="9161234567" />);

  // The value changes without changing its length: the extra digit falls past
  // the capacity. By length this would look like a rejection, and the extra
  // re-render would drop the caret.
  await user.click(field());
  field().setSelectionRange(7, 7);
  await user.keyboard("5");

  expect(field().value).toBe("+7 (916) 512-34-56");
  expect(screen.getByRole("status").textContent).toBe("");
});

/**
 * Pasting a number in its most common form.
 *
 * `89161234567`, the number most often on the clipboard, does not fit the mask
 * `+7 (999) 999-99-99` by one character. Before wave 26 the tail was dropped
 * silently, and `+7 (891) 612-34-56` appeared in the field: a different, but
 * plausible, number. No rejection was announced, because the check `raw === value`
 * catches only the case where the value did NOT change, and here it did.
 */
test("pasting a value longer than the mask announces the truncation", async () => {
  const user = userEvent.setup();
  render(<Field />);

  await user.click(field());
  await user.paste("89161234567");

  expect(screen.getByRole("status").textContent).toBe(
    "The pasted value is 1 character too long; the rest was not accepted"
  );
});

test("pasting a value that fits announces nothing", async () => {
  const user = userEvent.setup();
  render(<Field />);

  await user.click(field());
  await user.paste("79161234567");

  expect(field().value).toBe("+7 (916) 123-45-67");
  expect(screen.getByRole("status").textContent).toBe("");
});

/**
 * A paste does not come only through Ctrl+V.
 *
 * Dragging text with the mouse gives `insertFromDrop`, autofill from a password
 * manager gives `insertReplacementText`, and a programmatic write of the value
 * (the most common path on mobile) arrives as a plain `Event` with no `inputType`
 * at all. Checking `insertFromPaste` alone left all these paths silent, so the
 * original defect reproduced in full.
 */
test.each(["insertFromDrop", "insertReplacementText"])(
  "a bulk input of type %s announces the truncation too",
  (inputType) => {
    render(<Field />);
    const input = field();

    fireEvent.input(input, {
      target: { value: "89161234567" },
      inputType,
    });

    expect(screen.getByRole("status").textContent).toBe(
      "The pasted value is 1 character too long; the rest was not accepted"
    );
  }
);

test("a programmatic write without inputType is still caught", () => {
  render(<Field />);

  fireEvent.input(field(), { target: { value: "89161234567" } });

  expect(screen.getByRole("status").textContent).toBe(
    "The pasted value is 1 character too long; the rest was not accepted"
  );
});

/**
 * The overflow is measured against the WHOLE field after the paste, not against
 * the pasted fragment.
 *
 * The difference shows only on a non-empty field: on an empty one both quantities
 * match, and both tests above would pass even with a wrong implementation. Here
 * the field already holds three digits and ten are pasted: three do not fit, not
 * seven.
 */
test("truncation is measured against the whole field, not the pasted fragment", async () => {
  const user = userEvent.setup();
  render(<Field initial="916" />);

  await user.click(field());
  await user.paste("1234567890");

  expect(field().value).toBe("+7 (916) 123-45-67");
  expect(screen.getByRole("status").textContent).toBe(
    "The pasted value is 3 characters too long; the rest was not accepted"
  );
});
