// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { Radio, RadioGroup } from "../src/components/inputs/RadioGroup.js";

afterEach(cleanup);

function Group({ initial = null, disabled }: { initial?: string | null; disabled?: boolean }) {
  const [value, setValue] = useState<string | null>(initial);
  return (
    <RadioGroup label="How to publish" value={value} onChange={setValue} disabled={disabled}>
      <Radio value="now">Right away</Radio>
      <Radio value="later">On schedule</Radio>
      <Radio value="manual" disabled>
        Manually — unavailable
      </Radio>
    </RadioGroup>
  );
}

test("the group holds the value, not the buttons", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(
    <RadioGroup label="How to publish" value="now" onChange={onChange}>
      <Radio value="now">Right away</Radio>
      <Radio value="later">On schedule</Radio>
    </RadioGroup>
  );

  await user.click(screen.getByRole("radio", { name: "On schedule" }));

  // Отдаётся `string`, а не массив и не событие: выбран ровно один вариант.
  expect(onChange).toHaveBeenCalledWith("later");
});

test("arrows walk the set and CHANGE the value", async () => {
  const user = userEvent.setup();
  render(<Group initial="now" />);

  screen.getByRole("radio", { name: "Right away" }).focus();
  await user.keyboard("{ArrowDown}");

  // Это поведение радиогруппы, а не списка: стрелка не просто переносит фокус,
  // она выбирает. В списке было бы наоборот.
  expect((screen.getByRole("radio", { name: "On schedule" }) as HTMLInputElement).checked).toBe(
    true
  );
});

test("arrows skip the disabled option", async () => {
  const user = userEvent.setup();
  render(<Group initial="later" />);

  screen.getByRole("radio", { name: "On schedule" }).focus();
  await user.keyboard("{ArrowDown}");

  // «Вручную» выключен, поэтому набор зацикливается на первый доступный.
  expect((screen.getByRole("radio", { name: "Right away" }) as HTMLInputElement).checked).toBe(
    true
  );
});

test("tab cannot enter the set past the selected option", () => {
  render(<Group initial="later" />);

  // Ровно один вариант доступен табу — выбранный. Иначе клавиатурный
  // пользователь проходил бы через каждую кнопку набора по отдельности.
  //
  // Считается `tabindex="0"`, а не «не -1»: у выключенного варианта атрибута
  // нет вовсе — он и так недостижим, и проставлять ему -1 не за чем.
  const radios = screen.getAllByRole("radio") as HTMLInputElement[];
  const tabbable = radios.filter((el) => el.getAttribute("tabindex") === "0");
  expect(tabbable).toHaveLength(1);
  expect(tabbable[0]!.value).toBe("later");
  expect(radios.filter((el) => el.getAttribute("tabindex") === "-1")).toHaveLength(1);
});

test("group disabled overrides the individual one", () => {
  render(<Group disabled />);
  for (const el of screen.getAllByRole("radio"))
    expect((el as HTMLInputElement).disabled).toBe(true);
});

test("a repeated click cannot clear the selection", async () => {
  const user = userEvent.setup();
  render(<Group initial="now" />);

  await user.click(screen.getByRole("radio", { name: "Right away" }));

  // Снять выбор в радиогруппе нельзя по определению: набор отвечает на вопрос,
  // а «не отвечать» — это отдельный явный вариант, а не пустое значение.
  expect((screen.getByRole("radio", { name: "Right away" }) as HTMLInputElement).checked).toBe(
    true
  );
});
