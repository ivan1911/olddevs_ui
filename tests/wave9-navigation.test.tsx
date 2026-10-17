// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { Accordion, AccordionItem } from "../src/components/navigation/Accordion.js";
import { ButtonGroup } from "../src/components/actions/ButtonGroup.js";
import { Button } from "../src/components/actions/Button.js";
import { DescriptionList } from "../src/components/content/DescriptionList.js";
import { ToggleGroup } from "../src/components/actions/ToggleGroup.js";

afterEach(cleanup);

test("the accordion keeps one section open by default", async () => {
  const user = userEvent.setup();

  render(
    <Accordion>
      <AccordionItem id="a" title="First">
        A
      </AccordionItem>
      <AccordionItem id="b" title="Second">
        B
      </AccordionItem>
    </Accordion>
  );

  await user.click(screen.getByRole("button", { name: "First" }));
  await user.click(screen.getByRole("button", { name: "Second" }));

  const states = screen.getAllByRole("button").map((b) => b.getAttribute("aria-expanded"));
  expect(states).toEqual(["false", "true"]);
});

test("multiple expansion is switched on by a kit prop", async () => {
  const user = userEvent.setup();

  render(
    <Accordion multiple>
      <AccordionItem id="a" title="First">
        A
      </AccordionItem>
      <AccordionItem id="b" title="Second">
        B
      </AccordionItem>
    </Accordion>
  );

  await user.click(screen.getByRole("button", { name: "First" }));
  await user.click(screen.getByRole("button", { name: "Second" }));

  expect(screen.getAllByRole("button").map((b) => b.getAttribute("aria-expanded"))).toEqual([
    "true",
    "true",
  ]);
});

test("a disabled section does not expand", async () => {
  const user = userEvent.setup();

  render(
    <Accordion>
      <AccordionItem id="a" title="Unavailable" disabled>
        A
      </AccordionItem>
    </Accordion>
  );

  const button = screen.getByRole("button", { name: "Unavailable" });
  await user.click(button);
  expect(button.getAttribute("aria-expanded")).toBe("false");
});

test("a toggle group yields a set, not a single value", async () => {
  const user = userEvent.setup();
  const onChangeSpy = vi.fn();

  render(
    <ToggleGroup
      aria-label="Statuses"
      options={[
        { id: "a", label: "Drafts" },
        { id: "b", label: "Queued" },
      ]}
      value={["a"]}
      onChange={onChangeSpy}
    />
  );

  await user.click(screen.getByRole("button", { name: "Queued" }));

  // An empty set and a set of two are both legal; that is what distinguishes this component from
  // `Segmented`, where there is always exactly one selected value.
  expect(onChangeSpy).toHaveBeenCalledWith(["a", "b"]);
});

test("a button group announces its role only together with a name", () => {
  const { rerender } = render(
    <ButtonGroup>
      <Button>One</Button>
    </ButtonGroup>
  );
  expect(screen.queryByRole("group")).toBeNull();

  rerender(
    <ButtonGroup aria-label="View">
      <Button>One</Button>
    </ButtonGroup>
  );
  expect(screen.getByRole("group", { name: "View" })).toBeTruthy();
});

test("a description list links the label to the value", () => {
  const { container } = render(
    <DescriptionList items={[{ label: "Resolution", value: "1080 × 2400" }]} />
  );

  // `dl`/`dt`/`dd`, not two divs: the relation is semantic, and a screen reader reads the pair as a
  // whole; otherwise "1080 × 2400" is spoken without saying what it is.
  expect(container.firstElementChild!.tagName).toBe("DL");
  expect(container.querySelector("dt")?.textContent).toBe("Resolution");
  expect(container.querySelector("dd")?.textContent).toBe("1080 × 2400");
});
