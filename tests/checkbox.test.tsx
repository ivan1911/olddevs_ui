// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { Checkbox } from "../src/components/inputs/Checkbox.js";

afterEach(cleanup);

// Клик по ПОДПИСИ здесь не проверяется намеренно: jsdom не воспроизводит
// активацию `<label>` по клику в его потомка так, как это делает браузер, и
// тест либо падал бы на исправном компоненте, либо проверял бы не то. Ровно по
// этой причине в пакете не проверяется в jsdom и ловушка фокуса (ADR-0012).
// Настоящая проверка — в браузере: `tests-visual/interactions.spec.ts`.

test("onCheckedChange receives a boolean, not an event", async () => {
  const user = userEvent.setup();
  const onCheckedChange = vi.fn();
  render(<Checkbox onCheckedChange={onCheckedChange}>Consent</Checkbox>);

  await user.click(screen.getByRole("checkbox"));

  expect(onCheckedChange).toHaveBeenCalledTimes(1);
  // Именно значение, а не `ChangeEvent`: словарь кита говорит о состоянии, а
  // RAC — об `isSelected`; обёртка обязана переводить одно в другое.
  expect(onCheckedChange).toHaveBeenCalledWith(true);
});

test("the third state does not pass itself off as checked", () => {
  render(
    <Checkbox indeterminate onCheckedChange={() => {}}>
      Partly selected
    </Checkbox>
  );

  const box = screen.getByRole("checkbox") as HTMLInputElement;
  // Проверяется СВОЙСТВО `indeterminate`, а не атрибут `aria-checked`: RAC
  // рендерит нативный `<input type="checkbox">`, у которого «частично» — это
  // DOM-свойство, а «mixed» браузер выводит в дерево доступности сам. Атрибута
  // `aria-checked` здесь нет и быть не должно: дублировать родную семантику
  // ARIA-атрибутом — известный способ рассинхронизировать одно с другим.
  expect(box.indeterminate).toBe(true);
  expect(box.checked).toBe(false);
});

test("a click does not clear the third state", async () => {
  const user = userEvent.setup();
  render(
    <Checkbox indeterminate onCheckedChange={() => {}}>
      Partly selected
    </Checkbox>
  );

  await user.click(screen.getByRole("checkbox"));

  // Остаётся «частично»: это состояние ставит вызывающий, пересчитав набор.
  // Снять его кликом означало бы выдумать за пользователя, что он имел в виду.
  expect((screen.getByRole("checkbox") as HTMLInputElement).indeterminate).toBe(true);
});

test("a checkbox without a visible label takes its name from label", () => {
  render(<Checkbox label="Select all rows" />);
  expect(screen.getByRole("checkbox", { name: "Select all rows" })).toBeTruthy();
});

test("the hint is linked to the checkbox, not just placed nearby", () => {
  render(<Checkbox description="Arrives by email within a day">Send a report</Checkbox>);

  const box = screen.getByRole("checkbox");
  const describedBy = box.getAttribute("aria-describedby");
  expect(describedBy).toBeTruthy();
  expect(document.getElementById(describedBy!)?.textContent).toBe("Arrives by email within a day");
});

test("a disabled checkbox does not toggle", async () => {
  const user = userEvent.setup();
  const onCheckedChange = vi.fn();
  render(
    <Checkbox disabled onCheckedChange={onCheckedChange}>
      Unavailable
    </Checkbox>
  );

  await user.click(screen.getByRole("checkbox"));
  expect(onCheckedChange).not.toHaveBeenCalled();
});

test("states sit on the RAC element as data attributes", async () => {
  const user = userEvent.setup();
  const { container } = render(<Checkbox indeterminate>Partly selected</Checkbox>);

  // Это проверка не косметики, а несущего допущения пакета: варианты `hover:`
  // и `disabled:` из словаря тонов действуют на элементах react-aria только
  // потому, что плагин переопределяет их на двойной селектор
  // `:is(:where([data-rac])[data-hovered], :where(:not([data-rac])):hover)`.
  // Если `data-rac` со `<label>` однажды исчезнет, словарь тихо перестанет
  // красить состояния, и ни один снимок этого не покажет — состояния
  // снимаются в покое.
  const label = container.querySelector("label")!;
  expect(label.hasAttribute("data-rac")).toBe(true);
  expect(label.hasAttribute("data-indeterminate")).toBe(true);

  await user.hover(label);
  expect(label.hasAttribute("data-hovered")).toBe(true);
});

test("the hit area is 24px tall even when the control is smaller", () => {
  render(<Checkbox label="Done" />);

  /*
    Замер на 3.12.0: `md` без видимой подписи давал цель 26×22, `sm` с
    подписью — 20 по высоте. Из четырёх сочетаний размера и подписи порог
    WCAG 2.5.8 проходило одно.

    Высоту в раскладке поднимать нельзя — её держит строка списка, 32
    пикселя. Поэтому цель дотянута псевдоэлементом: контрол занимает
    прежнее место, а ловится на 24.
  */
  const control = screen.getByRole("checkbox").closest("label")!;

  // Две полоски по краям, а не слой поверх контрола: слой перехватывал
  // указатель у собственной подписи, а уведённый под содержимое `-z-10`
  // уходил за фон предка и переставал ловить клики вовсе.
  expect(control.className).toContain("before:bottom-full");
  expect(control.className).toContain("after:top-full");
  // Без `relative` полоски отсчитывались бы от чужого предка и уехали бы в
  // непредсказуемое место.
  expect(control.className).toContain("relative");
});
