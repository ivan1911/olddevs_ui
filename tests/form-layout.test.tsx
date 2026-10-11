// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { FormField } from "../src/components/inputs/FormField.js";
import { FieldRow, FormLayout } from "../src/components/inputs/FormLayout.js";
import { TextControl } from "../src/components/inputs/TextControl.js";

afterEach(cleanup);

const root = (container: HTMLElement) => container.firstElementChild as HTMLElement;

test("one column by default, two by prop and only from sm", () => {
  const { container, rerender } = render(
    <FormLayout>
      <FormField label="Name" htmlFor="fl-a">
        <TextControl id="fl-a" />
      </FormField>
    </FormLayout>
  );
  expect(root(container).className).not.toContain("grid-cols-2");

  rerender(
    <FormLayout columns={2}>
      <FormField label="Name" htmlFor="fl-a">
        <TextControl id="fl-a" />
      </FormField>
    </FormLayout>
  );
  // Одна колонка на узких экранах — это медиазапрос, а не `matchMedia`:
  // раскладка, зависящая от JS, до гидратации показывает неверную.
  expect(root(container).className).toContain("sm:grid-cols-2");
});

test('labels="side" reaches the fields through context', () => {
  const { container } = render(
    <FormLayout labels="side">
      <FormField label="Name" htmlFor="fl-b">
        <TextControl id="fl-b" />
      </FormField>
    </FormLayout>
  );

  const field = container.querySelector("label")?.parentElement as HTMLElement;
  expect(field.className).toContain("var(--form-label-w");
});

test("a field with its own layout overrides the layout", () => {
  const { container } = render(
    <FormLayout labels="side">
      <FormField label="Name" htmlFor="fl-c" layout="stack">
        <TextControl id="fl-c" />
      </FormField>
    </FormLayout>
  );

  const field = container.querySelector("label")?.parentElement as HTMLElement;
  expect(field.className).toContain("flex flex-col");
});

test("the label column width is set by a prop", () => {
  const { container } = render(
    <FormLayout labels="side" labelWidth="8rem">
      <FormField label="Name" htmlFor="fl-d">
        <TextControl id="fl-d" />
      </FormField>
    </FormLayout>
  );

  expect(root(container).style.getPropertyValue("--form-label-w")).toBe("8rem");
});

test("our prop outranks a foreign style", () => {
  const { container } = render(
    <FormLayout labelWidth="8rem" style={{ "--form-label-w": "20rem" } as React.CSSProperties}>
      <span>field</span>
    </FormLayout>
  );

  // Именованный проп явнее, чем переменная в `style`, — а она и появляется
  // там, где пропа не хватило.
  expect(root(container).style.getPropertyValue("--form-label-w")).toBe("8rem");
});

test("a foreign style gets through when there is no prop", () => {
  const { container } = render(
    <FormLayout style={{ marginTop: "8px" }}>
      <span>field</span>
    </FormLayout>
  );

  expect(root(container).style.marginTop).toBe("8px");
});

test("FieldRow spans every column, however many there are", () => {
  render(
    <FormLayout columns={2}>
      <FieldRow>
        <FormField label="Address" htmlFor="fl-e">
          <TextControl id="fl-e" />
        </FormField>
      </FieldRow>
    </FormLayout>
  );

  // `col-span-full`, а не `col-span-2`: фиксированные две колонки в
  // одноколоночной раскладке создали бы неявную вторую.
  const row = screen.getByText("Address").closest("div")?.parentElement as HTMLElement;
  expect(row.className).toContain("col-span-full");
  expect(row.className).not.toContain("col-span-2");
});

test("the layout does not require children to be kit fields", () => {
  const { container } = render(
    <FormLayout columns={2} labels="side">
      <input aria-label="A foreign field" />
      <FieldRow>
        <button type="submit">Save</button>
      </FieldRow>
    </FormLayout>
  );

  // Позицию раскладка задаёт любому ребёнку; подписи она не рисует, и
  // `labels="side"` для чужого поля молча не применяется — рисовать там нечего.
  expect(container.querySelector("input[aria-label='A foreign field']")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Save" })).toBeTruthy();
});
