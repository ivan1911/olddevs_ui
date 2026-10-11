// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { Checkbox } from "../src/components/inputs/Checkbox.js";
import { CheckboxGroup } from "../src/components/inputs/CheckboxGroup.js";
import { Radio, RadioGroup } from "../src/components/inputs/RadioGroup.js";

afterEach(cleanup);

// Что здесь НЕ проверяется, и почему. Клик по любому месту карточки (по
// описанию, по пустому полю) — это клик по метке, накрывающей всю карточку, а
// jsdom не строит геометрии и не воспроизводит активацию `<label>` по клику в
// потомка. Эта часть контракта, как и вычисленный стиль рамки с размером
// индикатора, проверена руками в живом браузере по собранной витрине.

function PlanPicker({
  initial = null,
  disabled,
  errorMessage,
  orientation,
}: {
  initial?: string | null;
  disabled?: boolean;
  errorMessage?: string;
  orientation?: "vertical" | "horizontal";
}) {
  const [value, setValue] = useState<string | null>(initial);
  return (
    <RadioGroup
      label="Plan"
      appearance="card"
      value={value}
      onChange={setValue}
      disabled={disabled}
      errorMessage={errorMessage}
      orientation={orientation}
    >
      <Radio value="free" description="Up to 3 projects" icon={<svg data-testid="icon-free" />}>
        Starter
      </Radio>
      <Radio value="pro" description="Unlimited projects">
        Team
      </Radio>
      <Radio value="enterprise" description="Contact sales" disabled>
        Enterprise
      </Radio>
    </RadioGroup>
  );
}

function ModulePicker({
  initial = [],
  errorMessage,
}: {
  initial?: string[];
  errorMessage?: string;
}) {
  const [value, setValue] = useState(initial);
  return (
    <CheckboxGroup
      label="Modules"
      appearance="card"
      value={value}
      onChange={setValue}
      errorMessage={errorMessage}
    >
      <Checkbox
        value="billing"
        description="Invoices and payments"
        icon={<svg data-testid="icon-billing" />}
      >
        Billing
      </Checkbox>
      <Checkbox value="reports" description="Weekly digests">
        Reports
      </Checkbox>
      <Checkbox value="audit" description="Not on your plan" disabled>
        Audit log
      </Checkbox>
    </CheckboxGroup>
  );
}

// ─── RadioGroup ──────────────────────────────────────────────────────────────

test("a radio card keeps the native radio semantics with name and description apart", () => {
  render(<PlanPicker />);

  // Имя — подпись варианта, пояснение — отдельно. Если бы описание вошло в
  // метку, скринридер читал бы его дважды: как имя и как описание.
  const radio = screen.getByRole("radio", {
    name: "Starter",
    description: "Up to 3 projects",
  });
  expect(radio).toHaveProperty("type", "radio");
  expect(screen.getByRole("radiogroup", { name: "Plan" })).toBeTruthy();
});

test("clicking a radio card selects it and reports a string", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(
    <RadioGroup label="Plan" appearance="card" value="free" onChange={onChange}>
      <Radio value="free">Starter</Radio>
      <Radio value="pro">Team</Radio>
    </RadioGroup>
  );

  await user.click(screen.getByRole("radio", { name: "Team" }));

  expect(onChange).toHaveBeenCalledWith("pro");
});

test("arrows move through radio cards and change the value", async () => {
  const user = userEvent.setup();
  render(<PlanPicker initial="free" />);

  screen.getByRole("radio", { name: "Starter" }).focus();
  await user.keyboard("{ArrowDown}");

  expect((screen.getByRole("radio", { name: "Team" }) as HTMLInputElement).checked).toBe(true);

  // «Корпоративный» выключен, поэтому набор зацикливается на первый доступный.
  await user.keyboard("{ArrowDown}");
  expect((screen.getByRole("radio", { name: "Starter" }) as HTMLInputElement).checked).toBe(true);
});

test("a radio card exposes selection as a data attribute on the card itself", () => {
  render(<PlanPicker initial="pro" />);

  // Рамка рисуется по этому признаку: пометка живёт на карточке, а не только на
  // скрытом `input`. Цвет рамки и размер индикатора смотрит браузерный тест.
  const selected = screen.getByRole("radio", { name: "Team" }).closest("div[data-selected]");
  expect(selected).toBeTruthy();
  expect(selected?.contains(screen.getByText("Unlimited projects"))).toBe(true);
  expect(screen.getByRole("radio", { name: "Starter" }).closest("div[data-selected]")).toBeNull();
});

test("the icon slot renders inside the card and stays out of the accessible name", () => {
  render(<PlanPicker />);

  const icon = screen.getByTestId("icon-free");
  expect(icon).toBeTruthy();
  expect(icon.closest("[aria-hidden='true']")).toBeTruthy();
  expect(screen.getByRole("radio", { name: "Starter" })).toBeTruthy();
});

test("the icon slot also renders with the default appearance", () => {
  render(
    <RadioGroup label="Plan" value="free" onChange={() => {}}>
      <Radio value="free" icon={<svg data-testid="icon-default" />}>
        Starter
      </Radio>
    </RadioGroup>
  );

  expect(screen.getByTestId("icon-default")).toBeTruthy();
});

test("a disabled radio card cannot be picked and the group switches everything off", async () => {
  const user = userEvent.setup();
  const { rerender } = render(<PlanPicker initial="free" />);

  expect((screen.getByRole("radio", { name: "Enterprise" }) as HTMLInputElement).disabled).toBe(
    true
  );
  await user.click(screen.getByRole("radio", { name: "Enterprise" }));
  expect((screen.getByRole("radio", { name: "Starter" }) as HTMLInputElement).checked).toBe(true);

  rerender(<PlanPicker initial="free" disabled />);
  for (const el of screen.getAllByRole("radio"))
    expect((el as HTMLInputElement).disabled).toBe(true);
});

test("an error is announced for a radio card set like for a plain one", () => {
  render(<PlanPicker errorMessage="Pick a plan" />);

  const group = screen.getByRole("radiogroup", { name: "Plan" });
  const message = screen.getByText("Pick a plan");
  expect(group.getAttribute("aria-describedby")?.split(" ")).toContain(message.id);
  // Невалидность приходит от группы на каждую карточку: рамка красится по ней.
  for (const el of screen.getAllByRole("radio"))
    expect(el.closest("div[data-invalid]")).toBeTruthy();
});

test("orientation is still reported by the card set", () => {
  render(<PlanPicker orientation="horizontal" />);

  expect(screen.getByRole("radiogroup", { name: "Plan" }).getAttribute("aria-orientation")).toBe(
    "horizontal"
  );
});

test("the default appearance stays a plain radio list without card markup", () => {
  render(
    <RadioGroup label="Plan" value="free" onChange={() => {}}>
      <Radio value="free" description="Hint">
        Starter
      </Radio>
    </RadioGroup>
  );

  expect(screen.getByRole("radio", { name: "Starter", description: "Hint" })).toBeTruthy();
  // Карточкой по умолчанию не становится: описание стоит под вариантом, вне
  // метки, — в карточке оно внутри неё, чтобы щелчок по нему выбирал вариант.
  // Рамку карточки jsdom не увидит — её стерегут снимки.
  expect(screen.getByText("Hint").closest("label")).toBeNull();
});

test("an empty icon, label or description adds no blank node to a card", () => {
  const { container } = render(
    <RadioGroup label="Plan" appearance="card" value="free" onChange={() => {}}>
      <Radio value="free" description="" icon="">
        Starter
      </Radio>
    </RadioGroup>
  );

  // Пустая строка — не содержимое: ни пустого описания у варианта, ни пустого
  // узла значка, который съел бы зазор столбца.
  const radio = screen.getByRole("radio", { name: "Starter" });
  expect(radio.getAttribute("aria-describedby")).toBeNull();
  expect(container.querySelector("[slot=description]")).toBeNull();
  expect(container.querySelector("label [aria-hidden='true']:empty")).toBeNull();
});

// ─── CheckboxGroup ───────────────────────────────────────────────────────────

test("a checkbox card keeps the native checkbox semantics with name and description apart", () => {
  render(<ModulePicker />);

  const box = screen.getByRole("checkbox", {
    name: "Billing",
    description: "Invoices and payments",
  });
  expect(box).toHaveProperty("type", "checkbox");
  expect(screen.getByRole("group", { name: "Modules" })).toBeTruthy();
});

test("space toggles a checkbox card and the array grows", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(
    <CheckboxGroup label="Modules" appearance="card" value={["billing"]} onChange={onChange}>
      <Checkbox value="billing">Billing</Checkbox>
      <Checkbox value="reports">Reports</Checkbox>
    </CheckboxGroup>
  );

  screen.getByRole("checkbox", { name: "Reports" }).focus();
  await user.keyboard(" ");

  expect(onChange).toHaveBeenCalledWith(["billing", "reports"]);
});

test("a click on a checkbox card unchecks it too", async () => {
  const user = userEvent.setup();
  render(<ModulePicker initial={["billing"]} />);

  await user.click(screen.getByRole("checkbox", { name: "Billing" }));

  expect((screen.getByRole("checkbox", { name: "Billing" }) as HTMLInputElement).checked).toBe(
    false
  );
});

test("a checked card exposes selection on the card, and the unchecked one does not", () => {
  render(<ModulePicker initial={["reports"]} />);

  expect(
    screen.getByRole("checkbox", { name: "Reports" }).closest("div[data-selected]")
  ).toBeTruthy();
  expect(
    screen.getByRole("checkbox", { name: "Billing" }).closest("div[data-selected]")
  ).toBeNull();
});

test("the checkbox icon slot stays out of the accessible name", () => {
  render(<ModulePicker />);

  expect(screen.getByTestId("icon-billing").closest("[aria-hidden='true']")).toBeTruthy();
  expect(screen.getByRole("checkbox", { name: "Billing" })).toBeTruthy();
});

test("a disabled checkbox card cannot be toggled", async () => {
  const user = userEvent.setup();
  render(<ModulePicker />);

  const audit = screen.getByRole("checkbox", { name: "Audit log" }) as HTMLInputElement;
  expect(audit.disabled).toBe(true);
  await user.click(audit);
  expect(audit.checked).toBe(false);
});

test("an error is announced for a checkbox card group like for a plain one", () => {
  render(<ModulePicker errorMessage="Pick a module" />);

  const group = screen.getByRole("group", { name: "Modules" });
  const message = screen.getByText("Pick a module");
  expect(group.getAttribute("aria-describedby")?.split(" ")).toContain(message.id);
});

test("a checkbox outside a group keeps the default appearance", () => {
  render(
    <Checkbox description="Hint" icon={<svg data-testid="icon-solo" />}>
      Consent
    </Checkbox>
  );

  // Вне группы карточки быть не может: ось живёт у группы.
  expect(screen.getByRole("checkbox", { name: "Consent", description: "Hint" })).toBeTruthy();
  expect(screen.getByTestId("icon-solo")).toBeTruthy();
});
