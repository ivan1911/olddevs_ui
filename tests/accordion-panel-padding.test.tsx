// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, expect, test } from "vitest";
import { Accordion, AccordionItem } from "../src/components/navigation/Accordion.js";

afterEach(cleanup);

/*
  A collapsed panel stays in the markup with zero content height, but its `pb-3`
  still took 12px, so a collapsed section was taller than its header. jsdom has no
  layout, so the test only checks that the padding is present on the expanded panel.
  How it looks is checked by eye: Navigation/Accordion → AccordionSingle.
*/
const panelOf = (container: HTMLElement) =>
  container.querySelector<HTMLElement>('[role="group"]') as HTMLElement;

test("a collapsed section has no bottom padding on its panel", () => {
  const { container } = render(
    <Accordion>
      <AccordionItem id="a" title="First">
        A
      </AccordionItem>
    </Accordion>
  );
  expect(panelOf(container).classList.contains("pb-3")).toBe(false);
});

test("an expanded section keeps the bottom padding, and drops it on collapse", async () => {
  const user = userEvent.setup();
  const { container } = render(
    <Accordion>
      <AccordionItem id="a" title="First">
        A
      </AccordionItem>
    </Accordion>
  );
  await user.click(screen.getByRole("button", { name: "First" }));
  expect(panelOf(container).classList.contains("pb-3")).toBe(true);
  await user.click(screen.getByRole("button", { name: "First" }));
  expect(panelOf(container).classList.contains("pb-3")).toBe(false);
});
