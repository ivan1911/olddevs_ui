// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, test } from "vitest";
import { Toggle } from "../src/components/actions/Toggle.js";
import { Checkbox } from "../src/components/inputs/Checkbox.js";
import { CheckboxCard } from "../src/components/inputs/CheckboxCard.js";
import { CheckboxGroup } from "../src/components/inputs/CheckboxGroup.js";
import { Radio, RadioGroup } from "../src/components/inputs/RadioGroup.js";
import { RangeSlider, Slider } from "../src/components/inputs/Slider.js";

afterEach(cleanup);

/*
  Выключенный `<fieldset disabled>` (так `Form` с `pending` гасит поля) отключает
  вложенные нативные контролы, но НЕ выставляет `data-disabled` на элементах
  react-aria: те знают только о собственном `isDisabled`. Поэтому `disabled:`
  на их корне не срабатывает, и контрол остаётся «живым» на вид, будучи
  неработающим. Нативное состояние видит только псевдокласс `:disabled` на
  скрытом `input` внутри — отсюда `has-[input:disabled]:`.

  В jsdom нет вычисленных стилей Tailwind, поэтому проверяются два факта: что
  `input` действительно выключен предком и что у его обёртки есть класс,
  привязанный к этому состоянию.
*/
const inDisabledFieldset = (ui: ReactNode) => render(<fieldset disabled>{ui}</fieldset>);

const dimsOnDisabledDescendant = (el: Element | null) =>
  el?.className.split(" ").includes("has-[input:disabled]:opacity-50");

test("a checkbox inside a disabled fieldset is dimmed", () => {
  inDisabledFieldset(<Checkbox>Pin</Checkbox>);
  const input = screen.getByRole("checkbox");

  expect(input.matches(":disabled")).toBe(true);
  expect(dimsOnDisabledDescendant(input.closest("label"))).toBe(true);
});

test("a card checkbox inside a disabled fieldset is dimmed", () => {
  inDisabledFieldset(
    <CheckboxGroup label="Where" appearance="card" value={[]} onChange={() => {}}>
      <Checkbox value="a">Site</Checkbox>
    </CheckboxGroup>
  );
  const input = screen.getByRole("checkbox");

  expect(input.matches(":disabled")).toBe(true);
  // Корень карточки — `div` RAC-поля, а не метка внутри него.
  expect(dimsOnDisabledDescendant(input.closest("label")?.parentElement ?? null)).toBe(true);
});

test("a radio inside a disabled fieldset is dimmed", () => {
  inDisabledFieldset(
    <RadioGroup label="How" value={null} onChange={() => {}}>
      <Radio value="auto">Auto</Radio>
    </RadioGroup>
  );
  const input = screen.getByRole("radio");

  expect(input.matches(":disabled")).toBe(true);
  expect(dimsOnDisabledDescendant(input.closest("label"))).toBe(true);
});

test("a card radio inside a disabled fieldset is dimmed", () => {
  inDisabledFieldset(
    <RadioGroup label="How" appearance="card" value={null} onChange={() => {}}>
      <Radio value="auto">Auto</Radio>
    </RadioGroup>
  );
  const input = screen.getByRole("radio");

  expect(input.matches(":disabled")).toBe(true);
  expect(dimsOnDisabledDescendant(input.closest("label")?.parentElement ?? null)).toBe(true);
});

test.each([
  ["Slider", <Slider key="s" label="Level" defaultValue={40} />],
  ["RangeSlider", <RangeSlider key="r" label="Level" defaultValue={[20, 80]} />],
])("a %s inside a disabled fieldset is dimmed as a whole", (_, element) => {
  inDisabledFieldset(element);

  const thumb = screen.getAllByRole("slider")[0]!;
  expect(thumb.matches(":disabled")).toBe(true);
  // Сам `fieldset` тоже имеет роль `group`, поэтому корень ищется от бегунка.
  expect(dimsOnDisabledDescendant(thumb.closest('[role="group"]'))).toBe(true);
});

test("a switch caption inside a disabled fieldset is dimmed together with the track", () => {
  inDisabledFieldset(
    <Toggle checked={false} onCheckedChange={() => {}}>
      Notifications
    </Toggle>
  );
  const control = screen.getByRole("switch");

  // Дорожка гаснет сама (`disabled:` на нативной кнопке), а подпись — только по
  // собственному `disabled`, то есть внутри fieldset оставалась яркой.
  expect(control.matches(":disabled")).toBe(true);
  expect(
    screen
      .getByText("Notifications")
      .parentElement?.className.split(" ")
      .includes("group-has-[[role=switch]:disabled]/toggle:opacity-50")
  ).toBe(true);
});

test("a disabled node in the description does not dim a working card", () => {
  // Голый `has-disabled` ловил любой выключенный узел внутри и гасил рабочую
  // карточку из-за кнопки в описании. Условие сужено до скрытого `input`.
  render(
    <CheckboxCard tone="accent" description={<button disabled>Upgrade</button>}>
      Analytics
    </CheckboxCard>
  );
  const input = screen.getByRole("checkbox");
  const card = input.closest("[class*='has-[input:disabled]']");
  expect(card).not.toBeNull();
  expect(input.matches(":disabled")).toBe(false);
  expect(card?.matches(":has(input:disabled)")).toBe(false);
  expect(card?.matches(":has(:disabled)")).toBe(true);
});
