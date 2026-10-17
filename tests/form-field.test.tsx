// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { FieldLayoutProvider, FormField } from "../src/components/inputs/FormField.js";
import { useFieldLabelId } from "../src/hooks/useFieldDescription.js";
import { NumberInput } from "../src/components/inputs/NumberInput.js";
import { TextControl } from "../src/components/inputs/TextControl.js";

afterEach(cleanup);

/** Reads the label's `id` the way a field does when `<label for>` does not name it. */
function LabelIdProbe() {
  return <span data-testid="probe">{useFieldLabelId() ?? ""}</span>;
}

test("the error displaces the hint instead of standing under it", () => {
  render(
    <FormField label="Name" hint="How subscribers will see it" error="Name is required">
      <TextControl aria-label="Name" />
    </FormField>
  );

  expect(screen.getByText("Name is required")).toBeTruthy();
  // Two lines under the field, one of which contradicts the other, are a source of noise.
  expect(screen.queryByText("How subscribers will see it")).toBeNull();
});

test("the error is announced as an alert", () => {
  render(
    <FormField label="Name" error="Name is required">
      <TextControl aria-label="Name" />
    </FormField>
  );

  // Without the role, a screen reader would not announce the error at all: it appears after
  // submit, when focus has already left the field.
  expect(screen.getByRole("alert").textContent).toBe("Name is required");
});

test("the hint is shown while there is no error", () => {
  render(
    <FormField label="Name" hint="How subscribers will see it">
      <TextControl aria-label="Name" />
    </FormField>
  );

  expect(screen.getByText("How subscribers will see it")).toBeTruthy();
  expect(screen.queryByRole("alert")).toBeNull();
});

test("the required asterisk is not read aloud", () => {
  render(
    <FormField label="Name" required htmlFor="ff-name">
      <TextControl id="ff-name" />
    </FormField>
  );

  // The COMPUTED accessible name is checked, not the label's text: `aria-hidden` is excluded
  // by the computation itself, and `getByLabelText`, which matches by text, would see "Name *".
  //
  // The field's name is "Name", not "Name asterisk": the field itself declares it is required,
  // not the decoration next to the label.
  expect(screen.getByRole("textbox", { name: "Name" })).toBeTruthy();
  expect(screen.getByText("*").getAttribute("aria-hidden")).toBe("true");
});

test("without the prop and without context the markup does not change by a single node", () => {
  const { container } = render(
    <FormField label="Name" hint="How subscribers will see it" htmlFor="ff-a">
      <TextControl id="ff-a" />
    </FormField>
  );

  // The layout axis was added to a STABLE component, and the price of that change is a promise
  // that without the axis it stays as it was. It is checked against the whole markup, not
  // against individual classes: otherwise the promise would rest on our having guessed
  // the right node to check.
  //
  // The description's id comes from `useId` and depends on the test order, so it cannot be
  // compared literally. It is replaced with a name of its own, and the substitution also proves
  // that the reference and the target are one and the same node: were there two, the second
  // would stay unrenamed in the string.
  const description = container.querySelector("input")!.getAttribute("aria-describedby")!;
  // The ONE deliberate change to the markup is the `id` on the label (OLDSUI-40): a field that
  // cannot be named through `<label for>` (`contenteditable`) refers to it via `aria-labelledby`.
  // That one too comes from `useId`, so it is replaced by the same trick; no other node or
  // attribute was added.
  const labelId = container.querySelector("label")!.id;
  expect(
    container.innerHTML.replaceAll(description, "DESCRIPTION").replaceAll(labelId, "LABEL")
  ).toBe(
    '<div class="flex flex-col gap-1.5">' +
      '<label id="LABEL" for="ff-a" class="text-fg-2 text-[11px] font-bold tracking-wide uppercase">Name</label>' +
      '<div class="border-line bg-bg-2 rounded-control border px-3 shadow-[var(--shadow-1)] transition-[border-color,box-shadow] duration-150 focus-within:border-accent-strong focus-within:ring-[3px] focus-within:ring-[color:var(--focus-ring)] invalid:border-danger-strong has-[input[aria-invalid=true]]:border-danger-strong has-[textarea[aria-invalid=true]]:border-danger-strong has-[input:disabled]:cursor-not-allowed has-[input:disabled]:opacity-50 has-[textarea:disabled]:cursor-not-allowed has-[textarea:disabled]:opacity-50">' +
      '<input data-disable-focus-ring="true" class="text-fg-0 w-full [appearance:none] border-0 bg-transparent px-0 py-[10px] text-[13px] leading-5 shadow-none outline-none [-webkit-tap-highlight-color:transparent] focus:border-0 focus:ring-0 focus:outline-none focus-visible:ring-0 focus-visible:outline-none disabled:cursor-not-allowed" id="ff-a" aria-describedby="DESCRIPTION">' +
      "</div>" +
      '<div id="DESCRIPTION" class="text-fg-3 text-[11px]">How subscribers will see it</div>' +
      "</div>"
  );
});

test("the label publishes its id, so a field that for= cannot name still gets its name", () => {
  render(
    <FormField label="Name">
      <LabelIdProbe />
    </FormField>
  );

  const label = screen.getByText("Name");
  expect(label.id).not.toBe("");
  expect(screen.getByTestId("probe").textContent).toBe(label.id);
});

test("without FormField there is no label id", () => {
  render(<LabelIdProbe />);

  expect(screen.getByTestId("probe").textContent).toBe("");
});

test("without a hint and without an error no description appears at all", () => {
  // A dangling `id` pointing nowhere is worse than none: a screen reader silently skips such
  // a reference, and the defect is visible neither in the markup nor in the test that looks for it.
  const { container } = render(
    <FormField label="Name" htmlFor="ff-plain">
      <TextControl id="ff-plain" />
    </FormField>
  );

  expect(container.querySelector("input")!.hasAttribute("aria-describedby")).toBe(false);
});

test("the hint is announced on entering the field", () => {
  render(
    <FormField label="Phone" hint="Including the country code" htmlFor="ff-hint">
      <TextControl id="ff-hint" />
    </FormField>
  );

  // The check is not that the attribute is present, but that it leads to the right TEXT:
  // a link to an empty or foreign node would pass the attribute check, but not the user.
  expect(screen.getByRole("textbox", { description: "Including the country code" })).toBeTruthy();
});

test("the description follows the error that displaced the hint", () => {
  render(
    <FormField
      label="Phone"
      hint="Including the country code"
      error="Not enough digits"
      htmlFor="ff-err"
    >
      <TextControl id="ff-err" />
    </FormField>
  );

  // Exactly one message is drawn under the field, and the description points to it,
  // not to the hidden hint.
  expect(screen.getByRole("textbox", { description: "Not enough digits" })).toBeTruthy();
  expect(screen.queryByText("Including the country code")).toBeNull();
});

test("a foreign description is appended to, not displaced", () => {
  render(
    <>
      <span id="ff-own">Latin only</span>
      <FormField label="Login" hint="Visible to others" htmlFor="ff-merge">
        <TextControl id="ff-merge" aria-describedby="ff-own" />
      </FormField>
    </>
  );

  // `aria-describedby` is a list, and a consumer who described the field with its own node
  // is entitled to expect that it will not go away.
  expect(screen.getByRole("textbox", { description: "Latin only Visible to others" })).toBeTruthy();
});

test("a numeric field is described the same way", () => {
  render(
    <FormField label="Print run" hint="No more than a thousand" htmlFor="ff-num">
      <NumberInput label="Print run" value={10} onChange={() => {}} />
    </FormField>
  );

  expect(screen.getByRole("textbox", { description: "No more than a thousand" })).toBeTruthy();
});

test('layout="side" moves the label into a column, not into another node', () => {
  const { container } = render(
    <FormField label="Name" layout="side" htmlFor="ff-b">
      <TextControl id="ff-b" />
    </FormField>
  );

  const root = container.firstElementChild as HTMLElement;
  expect(root.className).toContain("grid-cols-[var(--form-label-w,12rem)_minmax(0,1fr)]");
  // The label stays the same `<label htmlFor>`: the side layout changes its place,
  // not the label's owner.
  expect(root.querySelector("label")?.getAttribute("for")).toBe("ff-b");
});

test("in the side layout the error stands under the field, not under the label", () => {
  const { container } = render(
    <FormField label="Name" layout="side" error="Name is required">
      <TextControl aria-label="Name" />
    </FormField>
  );

  // The check is of the place in the markup, not of a class: the error belongs to the input
  // and lives in the field's column together with it.
  const column = (container.firstElementChild as HTMLElement).children[1] as HTMLElement;
  expect(column.contains(screen.getByRole("alert"))).toBe(true);
});

test("the axis comes from the layout context", () => {
  const { container } = render(
    <FieldLayoutProvider value="side">
      <FormField label="Name" htmlFor="ff-c">
        <TextControl id="ff-c" />
      </FormField>
    </FieldLayoutProvider>
  );

  // Otherwise the consumer would have to set `layout="side"` on every field by hand, and the
  // first one that was forgotten would give a crooked row.
  expect((container.firstElementChild as HTMLElement).className).toContain("grid");
});

test("an explicit prop outranks the context", () => {
  const { container } = render(
    <FieldLayoutProvider value="side">
      <FormField label="Name" layout="stack" htmlFor="ff-d">
        <TextControl id="ff-d" />
      </FormField>
    </FieldLayoutProvider>
  );

  expect((container.firstElementChild as HTMLElement).className).toContain("flex flex-col");
});

test('layout="side" works outside FormLayout', () => {
  const { container } = render(
    <FormField label="Name" layout="side" htmlFor="ff-e">
      <TextControl id="ff-e" />
    </FormField>
  );

  // The column width is a variable, not `subgrid`: `subgrid` would need an outer grid,
  // while the field must work on its own.
  expect((container.firstElementChild as HTMLElement).className).toContain("var(--form-label-w");
});

/**
 * Regression. A grid lays children out into cells, not by meaning: the second child
 * (a "from" and "to" range, a field with a button beside it) fell into the next row
 * UNDER THE LABEL. The field, its hint and its error are now kept together in one column.
 */
test("in the side layout two fields stay in their own column", () => {
  const { container } = render(
    <FormField label="Range" layout="side" hint="Inclusive">
      <TextControl aria-label="From" />
      <TextControl aria-label="To" />
    </FormField>
  );

  const root = container.firstElementChild as HTMLElement;
  // The grid has exactly two cells: the label and the field column.
  expect(root.children).toHaveLength(2);
  const column = root.children[1] as HTMLElement;
  expect(column.querySelectorAll("input")).toHaveLength(2);
  expect(column.textContent).toContain("Inclusive");
});

test("the stack layout adds no extra wrapper", () => {
  const { container } = render(
    <FormField label="Name" hint="Hint">
      <TextControl aria-label="Name" />
    </FormField>
  );

  // The side branch must not leak into stack: there the children sit directly in the root.
  expect(container.firstElementChild?.children).toHaveLength(3);
});

/**
 * The form's error is carried TO THE FIELD, not only to the text under it.
 *
 * `FIELD_SHELL_CLASS` paints the frame by `has-[input[aria-invalid=true]]`, that is, it looks
 * for the attribute on the field itself. Only the description went into the context, and the
 * field did not set the attribute: there was red text under the field, but the frame stayed
 * normal. For the frame to turn red, the consumer had to pass `aria-invalid` itself, and the
 * `aria-invalid` string is not in any file in `docs/`.
 */
test("a field inside an errored FormField marks itself invalid", () => {
  render(
    <FormField label="Name" error="Too long">
      <TextControl aria-label="Name" />
    </FormField>
  );

  expect(screen.getByLabelText("Name").getAttribute("aria-invalid")).toBe("true");
});

test("a hint does not make the field invalid", () => {
  render(
    <FormField label="Name" hint="Up to 80 characters">
      <TextControl aria-label="Name" />
    </FormField>
  );

  expect(screen.getByLabelText("Name").getAttribute("aria-invalid")).toBeNull();
});

test("an explicit aria-invalid from the consumer wins", () => {
  render(
    <FormField label="Name" error="Too long">
      <TextControl aria-label="Name" aria-invalid={false} />
    </FormField>
  );

  expect(screen.getByLabelText("Name").getAttribute("aria-invalid")).toBe("false");
});

describe("hintPersistent (ADR-0065)", () => {
  test("by default the error replaces the hint", () => {
    render(
      <FormField label="Card" htmlFor="card" hint="The full number gives 10% off" error="Too short">
        <TextControl id="card" />
      </FormField>
    );
    expect(screen.queryByText("The full number gives 10% off")).toBeNull();
    expect(screen.getByRole("alert").textContent).toBe("Too short");
  });

  test("with hintPersistent the hint stays and the error goes under it", () => {
    render(
      <FormField
        label="Card"
        htmlFor="card"
        hint="The full number gives 10% off"
        error="Too short"
        hintPersistent
      >
        <TextControl id="card" />
      </FormField>
    );
    const hint = screen.getByText("The full number gives 10% off");
    const error = screen.getByRole("alert");
    expect(hint.compareDocumentPosition(error) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // Both lines describe the field, the error last: it is read through to the end.
    const field = screen.getByRole("textbox");
    expect(field.getAttribute("aria-describedby")).toBe(`${hint.id} ${error.id}`);
    expect(field.getAttribute("aria-invalid")).toBe("true");
  });

  test("with hintPersistent and no error only the hint describes the field", () => {
    render(
      <FormField label="Card" htmlFor="card" hint="The full number gives 10% off" hintPersistent>
        <TextControl id="card" />
      </FormField>
    );
    const hint = screen.getByText("The full number gives 10% off");
    expect(screen.getByRole("textbox").getAttribute("aria-describedby")).toBe(hint.id);
  });
});
