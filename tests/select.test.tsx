// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { Select, type SelectItem } from "../src/components/inputs/Select.js";

/**
 * The behavior of `Select` is what neither a snapshot nor an axe audit can see.
 *
 * A snapshot shows how the closed trigger looks; axe checks that the roles are in place. Neither
 * one will say that clearing returned `""` instead of `null`, that a click on the second item
 * closed the multiple-selection panel, or that arrow down leads nowhere. That is what this file
 * tests.
 */

afterEach(cleanup);

const ITEMS: SelectItem[] = [
  { id: 1, label: "Nature", keywords: "nature forest" },
  { id: 2, label: "Space", keywords: "space" },
  { id: 3, label: "Cities" },
];

/**
 * Opens the panel and returns its items.
 *
 * The trigger is found by `aria-haspopup`, not by its label. The label varies: it is the
 * placeholder when nothing is selected, the item name when one is selected, and a count when
 * several are.
 */
async function open(user: ReturnType<typeof userEvent.setup>) {
  await user.click(document.querySelector("[aria-haspopup='listbox']") as HTMLElement);
  return within(screen.getByRole("listbox")).getAllByRole("option");
}

describe("single value selection", () => {
  test("clicking an item yields its id and closes the panel", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Select items={ITEMS} placeholder="Category" value={null} onChange={onChange} />);

    const options = await open(user);
    await user.click(options[1]!);

    expect(onChange).toHaveBeenCalledWith(2);
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  test("clearing yields null, not an empty string", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Select items={ITEMS} placeholder="Category" value={2} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "Clear" }));

    // The contract is enforced by the type, not by a comment: `""` in the type is indistinguishable
    // from any other `string`, while `null` is visible to the compiler.
    expect(onChange).toHaveBeenCalledWith(null);
  });

  test("an empty string from the URL means “nothing selected”, not a value", () => {
    render(<Select items={ITEMS} placeholder="Category" value="" onChange={vi.fn()} />);

    // Consumers keep filters in the URL, where "empty" is expressed as exactly `""`. If the component
    // treated it as a selection, it would show the clear button on an empty filter.
    expect(screen.getByRole("button", { name: /Category/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Clear" })).toBeNull();
  });
});

describe("multiple selection", () => {
  test("a click adds to the set and does NOT close the panel", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Select multiple items={ITEMS} placeholder="Category" value={[1]} onChange={onChange} />
    );

    const options = await open(user);
    await user.click(options[1]!);

    expect(onChange).toHaveBeenCalledWith([1, 2]);
    // Multiple selection that closes after each click would make no sense: the user would have to
    // reopen the panel every time.
    expect(screen.getByRole("listbox")).toBeTruthy();
  });

  test("clicking again clears the selection", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Select multiple items={ITEMS} placeholder="Category" value={[1, 2]} onChange={onChange} />
    );

    const options = await open(user);
    await user.click(options[0]!);

    expect(onChange).toHaveBeenCalledWith([2]);
  });

  test("clearing yields an empty array, not null", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Select multiple items={ITEMS} placeholder="Category" value={[1, 2]} onChange={onChange} />
    );

    await user.click(screen.getByRole("button", { name: "Clear" }));

    expect(onChange).toHaveBeenCalledWith([]);
  });
});

describe("search", () => {
  test("filters by label and by keywords alike", async () => {
    const user = userEvent.setup();
    render(
      <Select searchable items={ITEMS} placeholder="Category" value={null} onChange={vi.fn()} />
    );
    await open(user);

    // "forest" appears only in the keywords of "Nature", so a label search cannot find it.
    await user.type(screen.getByRole("textbox"), "forest");

    const options = within(screen.getByRole("listbox")).getAllByRole("option");
    expect(options).toHaveLength(1);
    expect(options[0]!.textContent).toContain("Nature");
  });

  test("an empty result explains itself with its own text", async () => {
    const user = userEvent.setup();
    render(
      <Select
        searchable
        items={ITEMS}
        placeholder="Category"
        value={null}
        onChange={vi.fn()}
        notFoundText="Nothing found"
      />
    );
    await open(user);
    await user.type(screen.getByRole("textbox"), "xxx");

    expect(screen.getByText("Nothing found")).toBeTruthy();
  });
});

describe("keyboard", () => {
  test("arrows walk the items and do not wrap at the edges", async () => {
    const user = userEvent.setup();
    render(<Select items={ITEMS} placeholder="Category" value={null} onChange={vi.fn()} />);
    const options = await open(user);

    options[0]!.focus();
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(options[1]);

    await user.keyboard("{ArrowUp}");
    expect(document.activeElement).toBe(options[0]);

    // ArrowUp from the first item, without a search field: focus stays put and does not jump down.
    await user.keyboard("{ArrowUp}");
    expect(document.activeElement).toBe(options[0]);

    await user.keyboard("{End}");
    expect(document.activeElement).toBe(options[2]);

    // ArrowDown from the last item also stays in place: the list is not a carousel.
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(options[2]);

    await user.keyboard("{Home}");
    expect(document.activeElement).toBe(options[0]);
  });

  test("arrow down from the search field leads into the list, up leads back", async () => {
    const user = userEvent.setup();
    render(
      <Select searchable items={ITEMS} placeholder="Category" value={null} onChange={vi.fn()} />
    );
    const options = await open(user);
    const search = screen.getByRole("textbox");

    search.focus();
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(options[0]);

    await user.keyboard("{ArrowUp}");
    expect(document.activeElement).toBe(search);
  });

  test("typing on an item returns focus to the search and appends the character", async () => {
    const user = userEvent.setup();
    render(
      <Select searchable items={ITEMS} placeholder="Category" value={null} onChange={vi.fn()} />
    );
    const options = await open(user);

    options[0]!.focus();
    await user.keyboard("f");

    const search = screen.getByRole("textbox") as HTMLInputElement;
    expect(document.activeElement).toBe(search);
    expect(search.value).toBe("f");
  });

  test("space on an item selects it instead of going to the search", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Select searchable items={ITEMS} placeholder="Category" value={null} onChange={onChange} />
    );
    const options = await open(user);

    options[1]!.focus();
    await user.keyboard(" ");

    expect(onChange).toHaveBeenCalledWith(2);
  });
});

/**
 * The count is strictly for multiple selection.
 *
 * The count branch also caught a single `Select` that had a value but no matching item in `items`.
 * The value came from the URL while the list was still loading, or it pointed to a deleted record.
 * The trigger showed "Category: 1", which means a count where there was nothing to count.
 */
test("a single select with a value outside items shows the key, not a count", () => {
  render(
    <Select
      aria-label="Category"
      placeholder="Category"
      items={[{ id: "nature", label: "Nature" }]}
      value="deleted-42"
      onChange={() => {}}
    />
  );

  const trigger = screen.getAllByRole("button")[0]!;
  expect(trigger.textContent).toContain("deleted-42");
  expect(trigger.textContent).not.toContain("Category: 1");
});

test("a multiple select still counts", () => {
  render(
    <Select
      aria-label="Category"
      placeholder="Category"
      multiple
      items={[
        { id: "nature", label: "Nature" },
        { id: "city", label: "City" },
      ]}
      value={["nature", "city"]}
      onChange={() => {}}
    />
  );

  expect(screen.getAllByRole("button")[0]!.textContent).toContain("Category: 2");
});

/**
 * The selected row is styled with the same classes as every list in the kit.
 *
 * Its own class set had drifted from the shared one in padding (`py-[9px]` against `py-1.5`) and in
 * the selection color (`bg-bg-3` against `selected:bg-accent-soft`). Kit lists placed side by side
 * differed in row height and in how the selected row looked. The owner decided to consolidate on
 * the shared classes.
 *
 * The `selected:` variant expands to `[data-selected]` and does not need `data-rac`, so the shared
 * row also works on a plain button.
 */
test("the selected row uses the shared listbox row, not its own colours", async () => {
  const user = userEvent.setup();
  render(
    <Select
      aria-label="Category"
      placeholder="Category"
      items={[
        { id: "nature", label: "Nature" },
        { id: "city", label: "City" },
      ]}
      value="nature"
      onChange={() => {}}
    />
  );

  await user.click(screen.getAllByRole("button")[0]!);
  const option = screen.getByRole("option", { name: /Nature/ });

  expect(option.getAttribute("data-selected")).toBe("true");
  expect(option.className).toContain("selected:bg-accent-soft");
  expect(option.className).not.toContain("bg-bg-3");
});

/**
 * The consumer supplies the label for a missing value.
 *
 * A key is more honest than a placeholder when it is human-readable, and worse than one when it is
 * a UUID: the user sees `9f2c1b04-…` where they expected a label. The kit does not know what the
 * application's identifiers look like, so the application decides.
 */
test("missingLabel names a value that is not in items", () => {
  render(
    <Select
      aria-label="Category"
      placeholder="Category"
      items={[]}
      value="9f2c1b04-7c2e-4c1a-9a1b-2f3d4e5a6b7c"
      onChange={() => {}}
      missingLabel={() => "Deleted category"}
    />
  );

  expect(screen.getAllByRole("button")[0]!.textContent).toContain("Deleted category");
});

describe("field name", () => {
  test("aria-label is ADDED to the trigger content, not put in place of it", () => {
    render(
      <Select
        items={ITEMS}
        placeholder="Category"
        value={2}
        onChange={vi.fn()}
        aria-label="Section"
      />
    );

    // A plain `aria-label` on the button would win over its content, and the field would be
    // announced as "Section, button" with no word about what is selected in it.
    expect(screen.getByRole("button", { name: "Section Space" })).toBeTruthy();
  });

  test("aria-labelledby points at the visible label and beats aria-label", () => {
    render(
      <>
        <span id="pick-label">Section</span>
        <Select
          items={ITEMS}
          placeholder="Category"
          value={2}
          onChange={vi.fn()}
          aria-label="Ignored"
          aria-labelledby="pick-label"
        />
      </>
    );

    expect(screen.getByRole("button", { name: "Section Space" })).toBeTruthy();
    // A hidden label is not rendered at all: a second source of the same name would silently drift
    // apart from the visible one.
    expect(screen.queryByText("Ignored")).toBeNull();
  });

  test("without a label the name stays what it was — the trigger content", () => {
    render(<Select items={ITEMS} placeholder="Category" value={null} onChange={vi.fn()} />);

    const trigger = screen.getByRole("button", { name: "Category" });
    expect(trigger.getAttribute("aria-labelledby")).toBeNull();
  });
});

describe("disabled", () => {
  test("the trigger takes no focus and opens nothing", async () => {
    const user = userEvent.setup();
    render(
      <Select disabled items={ITEMS} placeholder="Category" value={null} onChange={vi.fn()} />
    );

    const trigger = screen.getByRole("button", { name: "Category" });
    expect((trigger as HTMLButtonElement).disabled).toBe(true);

    await user.click(trigger);
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  test("the clear button is gone: a disabled field is not cleared either", () => {
    render(<Select disabled items={ITEMS} placeholder="Category" value={2} onChange={vi.fn()} />);

    expect(screen.queryByRole("button", { name: "Clear" })).toBeNull();
  });

  test("switching to disabled CLOSES the open panel instead of hiding it", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <Select items={ITEMS} placeholder="Category" value={null} onChange={vi.fn()} />
    );
    await open(user);

    rerender(
      <Select disabled items={ITEMS} placeholder="Category" value={null} onChange={vi.fn()} />
    );
    expect(screen.queryByRole("listbox")).toBeNull();

    // The panel does not come back on its own: the internal state is closed, not merely covered by
    // markup. Otherwise a form that came out of submission would show a list that nobody opened.
    rerender(<Select items={ITEMS} placeholder="Category" value={null} onChange={vi.fn()} />);
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});

describe("disabled with a controlled panel", () => {
  test("the consumer is TOLD about the closing, not only the markup", () => {
    const onOpenChange = vi.fn();
    const props = { items: ITEMS, placeholder: "Category", value: null, onChange: vi.fn() };
    const { rerender } = render(<Select {...props} open onOpenChange={onOpenChange} />);
    expect(screen.getByRole("listbox")).toBeTruthy();

    rerender(<Select {...props} open disabled onOpenChange={onOpenChange} />);

    // Otherwise the panel would disappear from the screen while the consumer's `open` stayed `true`,
    // and it would come back on its own as soon as the field was enabled again.
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  test("disabling a closed field says nothing about panels", () => {
    const onOpenChange = vi.fn();
    const props = { items: ITEMS, placeholder: "Category", value: null, onChange: vi.fn() };
    const { rerender } = render(<Select {...props} onOpenChange={onOpenChange} />);

    rerender(<Select {...props} disabled onOpenChange={onOpenChange} />);

    expect(onOpenChange).not.toHaveBeenCalled();
  });
});

describe("panel anchor", () => {
  test("the panel is anchored to the whole pill, not to the button inside it", async () => {
    // The button sits inside a bordered, padded pill, and the panel overlapped the pill from the
    // button's bottom edge. jsdom does not lay out the page, so the sizes are stubbed. The anchor is
    // recognized by the width Radix puts into `--radix-popper-anchor-width`. The gap is checked by
    // eye: Inputs/Select → Open.
    const user = userEvent.setup();
    const spy = vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (
      this: Element
    ) {
      const w = this.matches("button[aria-haspopup]")
        ? 100
        : this.matches("span.rounded-pill")
          ? 200
          : 0;
      return {
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: w,
        bottom: 36,
        width: w,
        height: 36,
        toJSON() {},
      };
    });
    render(<Select items={ITEMS} placeholder="Category" value={null} onChange={() => {}} />);
    await open(user);
    const wrapper = document.querySelector("[data-radix-popper-content-wrapper]") as HTMLElement;
    expect(wrapper.style.getPropertyValue("--radix-popper-anchor-width")).toBe("200px");
    spy.mockRestore();
  });
});
