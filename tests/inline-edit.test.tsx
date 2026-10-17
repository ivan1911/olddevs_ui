// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { InlineEdit } from "../src/components/inputs/InlineEdit.js";

afterEach(cleanup);

function Title({ onChange = () => {} }: { onChange?: (value: string) => void }) {
  const [value, setValue] = useState("Daily collection");
  return (
    <InlineEdit
      value={value}
      label="Name"
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}

const button = () => screen.getByRole("button");
const field = () => screen.getByRole("textbox", { name: "Name" });

test("the value is in the button name, not only in its text", () => {
  render(<Title />);

  // `aria-label` would displace the value, and the screen reader would announce
  // "edit name" without reading what the button actually shows.
  expect(screen.getByRole("button", { name: /^Daily collection\s*,\s*edit$/ })).toBeTruthy();
});

test("an empty value shows the empty label", () => {
  render(<InlineEdit value="" label="Name" onChange={() => {}} />);

  expect(screen.getByRole("button", { name: /Not set/ })).toBeTruthy();
});

test("opening puts the caret in the field instead of leaving it on the button", async () => {
  const user = userEvent.setup();
  render(<Title />);

  await user.click(button());

  // Otherwise a keyboard user opens the field and types into nowhere.
  expect(document.activeElement).toBe(field());
});

test("Enter confirms and returns focus to the button", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(<Title onChange={onChange} />);

  await user.click(button());
  await user.clear(field());
  await user.type(field(), "Night city{Enter}");

  expect(onChange).toHaveBeenCalledWith("Night city");
  // The field disappears, and without the return focus would move to `<body>`.
  expect(document.activeElement).toBe(button());
});

test("Escape restores the previous value AND focus", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(<Title onChange={onChange} />);

  await user.click(button());
  await user.clear(field());
  await user.type(field(), "Other{Escape}");

  // Without a cancel, a user who started editing by mistake could not leave without
  // saving: a click outside confirms, and Enter confirms.
  expect(onChange).not.toHaveBeenCalled();
  expect(button().textContent).toContain("Daily collection");
  expect(document.activeElement).toBe(button());
});

test("losing focus confirms but does not steal focus", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(
    <>
      <Title onChange={onChange} />
      <button type="button">Neighbour</button>
    </>
  );

  await user.click(screen.getByRole("button", { name: /Daily collection/ }));
  await user.clear(field());
  await user.type(field(), "Night city");
  await user.click(screen.getByRole("button", { name: "Neighbour" }));

  expect(onChange).toHaveBeenCalledWith("Night city");
  // The user went where they wanted to go, so focus must not be pulled back.
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Neighbour" }));
});

test("confirming without changes does not reach the outside", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(<Title onChange={onChange} />);

  await user.click(button());
  await user.keyboard("{Enter}");

  expect(onChange).not.toHaveBeenCalled();
});

test("the component does not store the confirmed value", async () => {
  const user = userEvent.setup();
  // The value comes in as a prop and does not change outwards: this is how a caller
  // behaves when the server has refused to save.
  render(<InlineEdit value="Previous" label="Name" onChange={() => {}} />);

  await user.click(button());
  await user.clear(field());
  await user.type(field(), "New{Enter}");

  expect(button().textContent).toContain("Previous");
});

test("the mode can be driven from outside", async () => {
  const user = userEvent.setup();
  const onEditingChange = vi.fn();
  render(
    <InlineEdit
      value="Previous"
      label="Name"
      onChange={() => {}}
      editing={false}
      onEditingChange={onEditingChange}
    />
  );

  await user.click(button());

  // The mode is controlled: the component reports the intent, but does not open the field itself.
  expect(onEditingChange).toHaveBeenCalledWith(true);
  expect(screen.queryByRole("textbox")).toBeNull();
});

test("the draft starts from the current value, not from the previous edit", async () => {
  const user = userEvent.setup();
  render(<Title />);

  await user.click(button());
  await user.clear(field());
  await user.type(field(), "Draft{Escape}");
  await user.click(button());

  // The value could have changed from outside between openings.
  expect((field() as HTMLInputElement).value).toBe("Daily collection");
});

/**
 * A regression, and the defect lost data. Escape unmounts the field, and no `blur`
 * arrives at all, so the "cancel in progress" flag stayed raised until the next edit,
 * which was then silently not confirmed on a click outside. The user kept typing a
 * value, walked away and lost it with no sign at all.
 */
test("after a cancel the next edit is confirmed by clicking away", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(
    <>
      <Title onChange={onChange} />
      <button type="button">Neighbour</button>
    </>
  );

  const value = () => screen.getByRole("button", { name: /collection|city/i });
  await user.click(value());
  await user.keyboard("{Escape}");

  await user.click(value());
  await user.clear(field());
  await user.type(field(), "Night city");
  await user.click(screen.getByRole("button", { name: "Neighbour" }));

  expect(onChange).toHaveBeenCalledWith("Night city");
});

/**
 * The draft syncs on ANY opening, not only through `start()`.
 *
 * `start()` is the button's handler. When the mode is driven from outside (the documented
 * scenario: editing opens from a row's menu), an opening through the `editing` prop never
 * reached it, and the draft from mount stayed in the field. Then blur confirmed it over
 * the value that came from the server: a silent rollback.
 */
test("a controlled open picks up the value that arrived meanwhile", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();

  function Host() {
    const [value, setValue] = useState("A");
    const [editing, setEditing] = useState(false);
    return (
      <>
        <button type="button" onClick={() => setValue("B")}>
          Receive B
        </button>
        <button type="button" onClick={() => setEditing(true)}>
          Edit
        </button>
        <InlineEdit
          value={value}
          onChange={(next) => {
            onChange(next);
            setValue(next);
          }}
          editing={editing}
          onEditingChange={setEditing}
          label="Title"
        />
      </>
    );
  }

  render(<Host />);
  // The value came from the server while the edit was closed.
  await user.click(screen.getByRole("button", { name: "Receive B" }));
  await user.click(screen.getByRole("button", { name: "Edit" }));

  expect(
    screen.getByRole("textbox").getAttribute("value") ??
      (screen.getByRole("textbox") as HTMLInputElement).value
  ).toBe("B");
});

test("Escape does not leave the cancelled text for the next opening", async () => {
  const user = userEvent.setup();

  function Host() {
    const [value, setValue] = useState("A");
    const [editing, setEditing] = useState(false);
    return (
      <>
        <button type="button" onClick={() => setEditing(true)}>
          Edit
        </button>
        <InlineEdit
          value={value}
          onChange={setValue}
          editing={editing}
          onEditingChange={setEditing}
          label="Title"
        />
      </>
    );
  }

  render(<Host />);
  await user.click(screen.getByRole("button", { name: "Edit" }));
  await user.type(screen.getByRole("textbox"), "ZZZ");
  await user.keyboard("{Escape}");

  await user.click(screen.getByRole("button", { name: "Edit" }));

  expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe("A");
});

/**
 * An open edit selects the whole text, and that holds when it is opened FROM OUTSIDE too.
 *
 * `setDraft` is a render request, not a write: by the time `select()` runs, the field
 * still holds the old text; React flushes the new one right after the effect and
 * collapses the selection to the end. This shows up exactly in the scenario the sync was
 * added for (T21): opening through a prop after the value has changed. On the usual path
 * (a button click) `setDraft` is a no-op, there is no render, and the selection survived
 * by chance. So the promise "open it and type over it" held where no edit was needed,
 * and broke where one was.
 */
test("opening from outside selects the freshly arrived value", async () => {
  const user = userEvent.setup();

  function Host() {
    const [value, setValue] = useState("A");
    const [editing, setEditing] = useState(false);
    return (
      <>
        <button type="button" onClick={() => setValue("new from server")}>
          Receive
        </button>
        <button type="button" onClick={() => setEditing(true)}>
          Edit
        </button>
        <InlineEdit
          value={value}
          onChange={setValue}
          editing={editing}
          onEditingChange={setEditing}
          label="Title"
        />
      </>
    );
  }

  render(<Host />);
  await user.click(screen.getByRole("button", { name: "Receive" }));
  await user.click(screen.getByRole("button", { name: "Edit" }));

  const field = screen.getByRole("textbox") as HTMLInputElement;
  expect(field.value).toBe("new from server");
  expect([field.selectionStart, field.selectionEnd]).toEqual([0, field.value.length]);
});
