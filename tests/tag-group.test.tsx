// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { createRef, useState } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { Tag, TagGroup, type TagKey } from "../src/index.js";

/**
 * Tag for display: names, removal and focus after it.
 *
 * Arrows, Delete and Backspace are handled by react-aria; here it is checked that the
 * wrapper did not break them, and that the name of the remove button comes exactly from
 * the catalog, not from "the catalog plus the react-aria label".
 */

afterEach(cleanup);

function Removable({ onRemove }: { onRemove?: (keys: Set<TagKey>) => void }) {
  const [tags, setTags] = useState(["design", "docs", "ops"]);
  return (
    <TagGroup
      label="Categories"
      onRemove={(keys) => {
        onRemove?.(keys);
        setTags((current) => current.filter((tag) => !keys.has(tag)));
      }}
      empty="No categories"
    >
      {tags.map((tag) => (
        <Tag key={tag} id={tag}>
          {tag[0]!.toUpperCase() + tag.slice(1)}
        </Tag>
      ))}
    </TagGroup>
  );
}

test("the group is named by its label and the tags are its rows", () => {
  render(
    <TagGroup label="Categories">
      <Tag id="design">Design</Tag>
      <Tag id="docs">Docs</Tag>
    </TagGroup>
  );

  const group = screen.getByRole("grid", { name: "Categories" });
  expect(within(group).getAllByRole("row")).toHaveLength(2);
  expect(within(group).getByRole("row", { name: "Design" })).toBeTruthy();
});

test("aria-label names the group when there is no visible label", () => {
  render(
    <TagGroup aria-label="Post categories">
      <Tag id="design">Design</Tag>
    </TagGroup>
  );

  expect(screen.getByRole("grid", { name: "Post categories" })).toBeTruthy();
});

test("an empty label does not count as a name for the types", () => {
  // Checked by the compiler (`npm run typecheck`): a `label` of type `ReactNode` let
  // `undefined`, `null` and `false` through — a group without a name compiled.
  // @ts-expect-error — `label` is empty, `aria-label` is missing
  const missing = <TagGroup label={undefined}>x</TagGroup>;
  // @ts-expect-error — `null` is not a name
  const none = <TagGroup label={null}>x</TagGroup>;
  // @ts-expect-error — the result of `{flag && "…"}` when the flag is false
  const off = <TagGroup label={false}>x</TagGroup>;
  expect(missing && none && off).toBeTruthy();
});

test("aria-labelledby names the group by a heading elsewhere on the page", () => {
  render(
    <>
      <h2 id="categories-heading">Categories</h2>
      <TagGroup aria-labelledby="categories-heading">
        <Tag id="design">Design</Tag>
      </TagGroup>
    </>
  );

  expect(screen.getByRole("grid", { name: "Categories" })).toBeTruthy();
});

test("the name comes from exactly one source", () => {
  // Checked by the compiler: a visible label AND an attribute are two sources of one name,
  // and by ear the group would be called something other than what is on screen.
  // @ts-expect-error — there is no name at all
  const unnamed = <TagGroup>x</TagGroup>;
  // @ts-expect-error — a label and `aria-label` at once
  const labelAndAria = <TagGroup label="Categories" aria-label="Post categories" />;
  // @ts-expect-error — `aria-label` and `aria-labelledby` at once
  const bothAria = <TagGroup aria-label="a" aria-labelledby="b" />;
  expect(unnamed && labelAndAria && bothAria).toBeTruthy();
});

test("forwards a ref to the group root", () => {
  const ref = createRef<HTMLDivElement>();
  render(
    <TagGroup ref={ref} label="Categories">
      <Tag id="design">Design</Tag>
    </TagGroup>
  );

  expect(ref.current?.contains(screen.getByRole("grid", { name: "Categories" }))).toBe(true);
  expect(ref.current?.parentElement).toBe(document.body.firstElementChild);
});

test("without onRemove there are no remove buttons", () => {
  render(
    <TagGroup label="Categories">
      <Tag id="design">Design</Tag>
    </TagGroup>
  );

  expect(screen.queryByRole("button")).toBeNull();
});

test("onRemove turns the remove buttons on; each one names the tag it removes", async () => {
  const user = userEvent.setup();
  const onRemove = vi.fn();
  render(
    <TagGroup label="Categories" onRemove={onRemove}>
      <Tag id="design">Design</Tag>
      <Tag id="docs">Docs</Tag>
    </TagGroup>
  );

  // The name comes whole from the catalog: the label inside the row, not one that
  // react-aria appends after it ("Remove: Design Design").
  expect(screen.getByRole("button", { name: "Remove: Design" })).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Remove: Docs" }));

  expect(onRemove).toHaveBeenCalledTimes(1);
  expect([...onRemove.mock.calls[0]![0]]).toEqual(["docs"]);
});

test("a tag with non-text content is named by textValue", () => {
  render(
    <TagGroup label="Categories" onRemove={vi.fn()}>
      <Tag id="design" textValue="Design">
        <b>De</b>sign
      </Tag>
    </TagGroup>
  );

  expect(screen.getByRole("button", { name: "Remove: Design" })).toBeTruthy();
});

test("Delete and Backspace remove the focused tag", async () => {
  const user = userEvent.setup();
  const onRemove = vi.fn();
  render(<Removable onRemove={onRemove} />);

  await user.tab();
  expect(document.activeElement).toBe(screen.getByRole("row", { name: "Design" }));
  await user.keyboard("{Delete}");
  expect([...onRemove.mock.calls[0]![0]]).toEqual(["design"]);

  await user.keyboard("{Backspace}");
  expect([...onRemove.mock.calls[1]![0]]).toEqual(["docs"]);
});

test("arrows walk the tags without stepping onto the remove buttons", async () => {
  const user = userEvent.setup();
  render(
    <TagGroup label="Categories" onRemove={vi.fn()}>
      <Tag id="design">Design</Tag>
      <Tag id="docs">Docs</Tag>
      <Tag id="ops">Ops</Tag>
    </TagGroup>
  );

  await user.tab();
  expect(document.activeElement).toBe(screen.getByRole("row", { name: "Design" }));
  await user.keyboard("{ArrowRight}");
  expect(document.activeElement).toBe(screen.getByRole("row", { name: "Docs" }));
  await user.keyboard("{ArrowRight}");
  expect(document.activeElement).toBe(screen.getByRole("row", { name: "Ops" }));
  await user.keyboard("{ArrowLeft}");
  expect(document.activeElement).toBe(screen.getByRole("row", { name: "Docs" }));
});

test("after a removal focus stays in the group, on a neighbouring tag", async () => {
  const user = userEvent.setup();
  render(<Removable />);

  await user.tab();
  await user.keyboard("{ArrowRight}");
  expect(document.activeElement).toBe(screen.getByRole("row", { name: "Docs" }));

  await user.keyboard("{Delete}");

  expect(screen.queryByRole("row", { name: "Docs" })).toBeNull();
  const group = screen.getByRole("grid", { name: "Categories" });
  expect(group.contains(document.activeElement)).toBe(true);
  expect(document.activeElement).not.toBe(document.body);
});

test("an empty group shows the `empty` content", async () => {
  const user = userEvent.setup();
  render(<Removable />);

  await user.tab();
  await user.keyboard("{Delete}{Delete}{Delete}");

  expect(screen.queryAllByRole("row")).toHaveLength(0);
  expect(screen.getByText("No categories")).toBeTruthy();
});

test("a hue does not leak into the accessible name", () => {
  render(
    <TagGroup label="Categories" onRemove={vi.fn()}>
      <Tag id="design" hue="teal">
        Design
      </Tag>
    </TagGroup>
  );

  // The dot is for the eye: the hue does not stand in for a word, and the name is translated.
  expect(screen.getByRole("row", { name: "Design" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Remove: Design" })).toBeTruthy();
});

test("a link tag carries its address", () => {
  render(
    <TagGroup label="Categories">
      <Tag id="design" href="/posts?category=design">
        Design
      </Tag>
    </TagGroup>
  );

  expect(screen.getByRole("row", { name: "Design" }).getAttribute("data-href")).toBe(
    "/posts?category=design"
  );
});

test("an empty `empty` is no empty-state text: nothing blank is drawn", () => {
  const { container } = render(<TagGroup label="Categories" empty="" />);

  // An empty `span` instead of text is the same "vanished" group the prop exists to prevent.
  const list = container.querySelector("[data-empty]") as HTMLElement;
  expect(list.childElementCount).toBe(0);
});

test("an empty textValue does not leave the remove button with a bare «Remove: »", () => {
  render(
    <TagGroup label="Categories" onRemove={vi.fn()}>
      <Tag id="design" textValue="">
        Design
      </Tag>
    </TagGroup>
  );

  expect(screen.getByRole("button", { name: "Remove: Design" })).toBeTruthy();
});

test("an empty href does not turn a tag into a link to the current page", () => {
  render(
    <TagGroup label="Categories">
      <Tag id="design" href="">
        Design
      </Tag>
    </TagGroup>
  );

  expect(screen.getByRole("row", { name: "Design" }).hasAttribute("data-href")).toBe(false);
});
