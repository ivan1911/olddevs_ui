// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, expect, test } from "vitest";
import { Accordion, AccordionItem } from "../src/components/navigation/Accordion.js";

afterEach(cleanup);

/*
  Свёрнутая панель остаётся в разметке с нулевой высотой содержимого, и её
  `pb-3` всё равно занимал 12px, из-за чего свёрнутая секция была выше заголовка.
  В jsdom нет раскладки — проверяем, что отступ есть только у раскрытой панели. Как это
  выглядит, смотрят глазами: Navigation/Accordion → AccordionSingle.
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
