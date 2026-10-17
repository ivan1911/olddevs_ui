// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { Combobox } from "../src/components/inputs/Combobox.js";
import { DatePicker } from "../src/components/date-time/DatePicker.js";
import { FormField } from "../src/components/inputs/FormField.js";
import { Select } from "../src/components/inputs/Select.js";
import { TagInput } from "../src/components/inputs/TagInput.js";
import { ColorPicker } from "../src/components/inputs/ColorPicker.js";
import { PinInput } from "../src/components/inputs/PinInput.js";
import { Rating } from "../src/components/inputs/Rating.js";
import { Slider } from "../src/components/inputs/Slider.js";
import { Toggle } from "../src/components/actions/Toggle.js";

afterEach(cleanup);

/**
 * Debt of Track C, passed on by wave 21 and paid off by wave 22.
 *
 * `FormField` renders the hint and the error and puts their `id`s into context; the kit's
 * fields pick it up through `useFieldDescribedBy`. Before 3.0.0 only `TextControl` and
 * `NumberInput` picked it up: the react-aria families have their own description slots,
 * and the form's hint was not linked to their field at all. It was on the screen,
 * but it never reached the screen reader.
 *
 * The check is of the COMPUTED link: the target's `aria-describedby` points to the node
 * that holds the hint text. Matching identifier strings is not enough: `useId` makes them
 * depend on the test order, and a dangling reference to nowhere would look exactly the same.
 */

/** The description target, and the text it must point to. */
function describedText(target: Element, container: HTMLElement): string[] {
  const ids = target.getAttribute("aria-describedby")?.split(" ").filter(Boolean) ?? [];
  return ids.map(
    (id) => container.querySelector(`#${CSS.escape(id)}`)?.textContent ?? `MISSING:${id}`
  );
}

const items = [
  { id: "1", label: "First" },
  { id: "2", label: "Second" },
];

describe("the FormField description reaches the react-aria families", () => {
  test("Select: the description is linked to the trigger", () => {
    const { container } = render(
      <FormField label="Category" hint="Affects the results">
        <Select items={items} placeholder="Select" onChange={() => {}} />
      </FormField>
    );

    const trigger = screen.getByRole("button", { name: /Select/ });
    expect(describedText(trigger, container)).toEqual(["Affects the results"]);
  });

  test("Combobox: the description is linked to the input", () => {
    const { container } = render(
      <FormField label="Tag" hint="You can type your own">
        <Combobox items={items} aria-label="Tag" />
      </FormField>
    );

    expect(describedText(container.querySelector("input")!, container)).toEqual([
      "You can type your own",
    ]);
  });

  test("DatePicker: the description is linked to the trigger", () => {
    const { container } = render(
      <FormField label="Date" hint="Publishing starts at midnight">
        <DatePicker value="2026-09-07" onChange={() => {}} />
      </FormField>
    );

    expect(describedText(container.querySelector("button")!, container)).toEqual([
      "Publishing starts at midnight",
    ]);
  });

  test("TagInput: the description is linked to the input, not to the tag group", () => {
    // The target is the field: the description explains WHAT TO ENTER. It does not
    // describe the set of tags that are already added.
    const { container } = render(
      <FormField label="Tags" hint="Enter adds a tag">
        <TagInput value={["sky"]} onChange={() => {}} aria-label="Tags" />
      </FormField>
    );

    const input = container.querySelector('input[type="text"]')!;
    expect(describedText(input, container)).toEqual(["Enter adds a tag"]);
  });
});

describe("the error displaces the hint instead of standing under it", () => {
  test("Select announces the error when one is set", () => {
    const { container } = render(
      <FormField label="Category" hint="Affects the results" error="Pick a category">
        <Select items={items} placeholder="Select" onChange={() => {}} />
      </FormField>
    );

    // Exactly one message sits under the field, and the description points to it.
    const trigger = screen.getByRole("button", { name: /Select/ });
    expect(describedText(trigger, container)).toEqual(["Pick a category"]);
  });
});

describe("a foreign description is appended to, not displaced", () => {
  test("Select merges its own description with the form one", () => {
    const { container } = render(
      <>
        <span id="sel-own">Active only</span>
        <FormField label="Category" hint="Affects the results">
          <Select
            items={items}
            placeholder="Select"
            onChange={() => {}}
            aria-describedby="sel-own"
          />
        </FormField>
      </>
    );

    // `aria-describedby` is a list: a consumer who described the field with its own node
    // must not lose the form's hint.
    const trigger = screen.getByRole("button", { name: /Select/ });
    expect(describedText(trigger, container)).toEqual(["Active only", "Affects the results"]);
  });

  test("TagInput merges its own description with the form one", () => {
    const { container } = render(
      <>
        <span id="tag-own">Up to five tags</span>
        <FormField label="Tags" hint="Enter adds a tag">
          <TagInput value={[]} onChange={() => {}} aria-label="Tags" aria-describedby="tag-own" />
        </FormField>
      </>
    );

    const input = container.querySelector('input[type="text"]')!;
    expect(describedText(input, container)).toEqual(["Up to five tags", "Enter adds a tag"]);
  });
});

describe("outside FormField the markup does not change", () => {
  test("none of the families leaves a dangling aria-describedby", () => {
    // A dangling reference is worse than none: a screen reader silently skips it, and
    // the defect is visible neither in the markup nor in the test that looks for it.
    const { container } = render(
      <>
        <Select items={items} placeholder="Select" onChange={() => {}} />
        <Combobox items={items} aria-label="Tag" />
        <DatePicker value="2026-09-07" onChange={() => {}} />
        <TagInput value={[]} onChange={() => {}} aria-label="Tags" />
      </>
    );

    for (const el of container.querySelectorAll("[aria-describedby]")) {
      const ids = el.getAttribute("aria-describedby")!.split(" ").filter(Boolean);
      for (const id of ids) {
        expect(
          container.querySelector(`#${CSS.escape(id)}`),
          `dangling reference ${id}`
        ).toBeTruthy();
      }
    }
  });
});

/**
 * Debt of wave 22, paid off by wave 26.
 *
 * Wave 22 set up this family and covered the react-aria fields. Five components were not
 * in the scope: `PinInput` builds its native `input` itself and takes only the wrapper class
 * from `lib/field.ts`, while `Toggle`, `Slider`, `Rating` and `ColorPicker` did not read
 * the context at all. `<FormField hint="…">` rendered the hint, but none of these fields
 * referenced it: it was on the screen, but it never reached the screen reader.
 */
describe("the description reaches the fields the kit builds itself", () => {
  test("PinInput: the description is linked to the group, once", () => {
    const { container } = render(
      <FormField label="Code" hint="Six digits from the text message">
        <PinInput length={6} value="" onChange={() => {}} label="Code" />
      </FormField>
    );

    // On the group, not on the six cells: otherwise the hint would be read six times in a row.
    expect(describedText(screen.getByRole("group"), container)).toEqual([
      "Six digits from the text message",
    ]);
  });

  test("Toggle: the description is linked to the switch", () => {
    const { container } = render(
      <FormField label="Notifications" hint="Only about your own items">
        <Toggle checked={false} onCheckedChange={() => {}} label="Notifications" />
      </FormField>
    );

    expect(describedText(screen.getByRole("switch"), container)).toEqual([
      "Only about your own items",
    ]);
  });

  test("Slider: the description is linked to the thumb", () => {
    const { container } = render(
      <FormField label="Quality" hint="Higher means a bigger file">
        <Slider label="Quality" defaultValue={50} />
      </FormField>
    );

    // On the thumb, not on the group: the thumb is what gets focus, and `role="slider"`
    // is on it too; react-aria sets no attribute on the group at all.
    expect(describedText(screen.getByRole("slider"), container)).toEqual([
      "Higher means a bigger file",
    ]);
  });

  test("Rating: the description is linked to the radiogroup", () => {
    const { container } = render(
      <FormField label="Quality" hint="Five is the best">
        <Rating value={3} onChange={() => {}} aria-label="Quality" />
      </FormField>
    );

    expect(describedText(screen.getByRole("radiogroup"), container)).toEqual(["Five is the best"]);
  });

  test("ColorPicker: the description is linked to the trigger", () => {
    const { container } = render(
      <FormField label="Brand" hint="Used for accents">
        <ColorPicker value="#3366ff" onChange={() => {}} label="Brand" />
      </FormField>
    );

    expect(describedText(screen.getByRole("button", { name: "Brand" }), container)).toEqual([
      "Used for accents",
    ]);
  });
});

/**
 * The consumer's own description and the form's description are MERGED, not displacing each other.
 *
 * The family checked only that "the description arrives", and the error was hidden on both sides.
 * In `PinInput` the `{...rest}` spread came after the conditional one, so a consumer's
 * `aria-describedby` overwrote the context one: the code field inside `<FormField error="…">`
 * did not declare the error at all. In `Toggle` it was the other way round: the consumer's
 * hint was lost.
 *
 * Only those who merge on THEIR OWN are in the list. Outside the list there are two legitimate cases:
 * `Rating` and `ColorPicker` are declared as closed interfaces without `...rest` — there is
 * nothing to pass `aria-describedby` into, and nothing to displace (as with `CopyButton`
 * and `onClick`); and `Slider` must not merge: its `rest` goes to the group, and react-aria
 * itself moves the description to the thumb and combines it with its own. Merging there
 * would give the same `id` twice.
 */
describe("a consumer description and the form description are merged", () => {
  const CASES = [
    {
      name: "PinInput",
      render: (id: string) => (
        <PinInput length={4} value="" onChange={() => {}} label="Code" aria-describedby={id} />
      ),
      target: () => screen.getByRole("group"),
    },
    {
      name: "Toggle",
      render: (id: string) => (
        <Toggle
          checked={false}
          onCheckedChange={() => {}}
          label="Notifications"
          aria-describedby={id}
        />
      ),
      target: () => screen.getByRole("switch"),
    },
  ] as const;

  test.each(CASES)("$name keeps both descriptions", ({ render: renderCase, target }) => {
    const { container } = render(
      <FormField label="Field" hint="From the form">
        <>
          <span id="own">From the consumer</span>
          {renderCase("own")}
        </>
      </FormField>
    );

    expect(describedText(target(), container).sort()).toEqual(
      ["From the consumer", "From the form"].sort()
    );
  });
});
