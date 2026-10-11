// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { Toggle, type ToggleProps } from "../src/components/actions/Toggle.js";
import { resetDevWarnings } from "../src/lib/dev-warn.js";
import { FormField } from "../src/components/inputs/FormField.js";

afterEach(cleanup);

function Controlled({ onClick }: { onClick?: () => void }) {
  const [on, setOn] = useState(false);
  return <Toggle checked={on} onCheckedChange={setOn} label="Notifications" onClick={onClick} />;
}

test("the switch announces its role and state", () => {
  render(<Toggle checked onCheckedChange={() => {}} label="Notifications" />);

  const toggle = screen.getByRole("switch", { name: "Notifications" });
  expect(toggle.getAttribute("aria-checked")).toBe("true");
});

/**
 * Роль и состояние НЕ ПЕРЕБИВАЮТСЯ спредом.
 *
 * Починка перенесла `{...rest}` вперёд именно ради этого, но ни один тест не
 * передавал `role`/`aria-checked` через спред — вернув порядок обратно, все
 * пять тестов оставались зелёными. Переключатель, потерявший `role="switch"`,
 * перестаёт быть переключателем.
 */
test("a consumer cannot overwrite the role or the state", () => {
  render(
    <Toggle
      checked
      onCheckedChange={() => {}}
      label="Notifications"
      {...({ role: "button", "aria-checked": "false" } as Record<string, string>)}
    />
  );

  expect(screen.getByRole("switch", { name: "Notifications" })).toBeTruthy();
  expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("true");
});

test("clicking flips the state", async () => {
  const user = userEvent.setup();
  render(<Controlled />);

  await user.click(screen.getByRole("switch"));
  expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("true");
});

/**
 * Чужой `onClick` НЕ ВЫТЕСНЯЕТ переключение.
 *
 * `{...rest}` стоял последним и перекрывал собственные `onClick`, `role` и
 * `aria-checked`. Вызов `<Toggle … onClick={track} />` компилировался,
 * переключатель рисовался, аналитика срабатывала — а `onCheckedChange` не
 * вызывался НИКОГДА, то есть компонент был мёртв, и ни один тест этого не
 * ловил: тестов у `Toggle` не было вовсе.
 */
test("a consumer onClick does not displace the toggling", async () => {
  const user = userEvent.setup();
  const track = vi.fn();
  render(<Controlled onClick={track} />);

  await user.click(screen.getByRole("switch"));

  expect(track).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("true");
});

test("a consumer onClick can cancel the toggling deliberately", async () => {
  const user = userEvent.setup();
  const onClick = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
  const onCheckedChange = vi.fn();

  render(
    <Toggle
      checked={false}
      onCheckedChange={onCheckedChange}
      label="Notifications"
      onClick={onClick}
    />
  );

  await user.click(screen.getByRole("switch"));

  /*
    Три утверждения, и ни одного лишнего.

    Прежняя версия не имела `expect()` вовсе: сторожем был бросок внутри
    `onCheckedChange`, поэтому обработчик, не вызывавшийся НИКОГДА — то есть
    ровно исходный дефект, — оставлял тест зелёным.
  */
  expect(onClick).toHaveBeenCalledTimes(1);
  expect(onCheckedChange).not.toHaveBeenCalled();
});

test("without preventDefault the same handler does not block toggling", async () => {
  const user = userEvent.setup();
  const onCheckedChange = vi.fn();

  render(
    <Toggle
      checked={false}
      onCheckedChange={onCheckedChange}
      label="Notifications"
      onClick={() => {}}
    />
  );

  await user.click(screen.getByRole("switch"));

  expect(onCheckedChange).toHaveBeenCalledWith(true);
});

test("a disabled switch does not toggle", async () => {
  const user = userEvent.setup();
  const onCheckedChange = vi.fn();
  render(
    <Toggle checked={false} onCheckedChange={onCheckedChange} label="Notifications" disabled />
  );

  await user.click(screen.getByRole("switch"));
  expect(onCheckedChange).not.toHaveBeenCalled();
});

/*
  Видимая подпись и описание: строка настройки «слова слева, переключатель
  справа». Подпись и описание принадлежат переключателю, а не экрану, поэтому
  имя, описание и нажатие по тексту обязаны работать без сборки руками.
*/
function Row({ onClick }: { onClick?: () => void }) {
  const [on, setOn] = useState(false);
  return (
    <Toggle checked={on} onCheckedChange={setOn} description="Monday summary" onClick={onClick}>
      Weekly digest
    </Toggle>
  );
}

test("the visible label is the accessible name of the switch", () => {
  render(<Row />);

  expect(screen.getByRole("switch", { name: "Weekly digest" })).toBeTruthy();
  expect(screen.getByText("Weekly digest")).toBeTruthy();
});

test("the description is linked to the switch through aria-describedby", () => {
  render(<Row />);

  const toggle = screen.getByRole("switch");
  const id = toggle.getAttribute("aria-describedby");
  expect(id).toBeTruthy();
  expect(document.getElementById(id!)?.textContent).toBe("Monday summary");
});

test("a click on the text flips the switch", async () => {
  const user = userEvent.setup();
  render(<Row />);

  await user.click(screen.getByText("Weekly digest"));
  expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("true");

  await user.click(screen.getByText("Monday summary"));
  expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("false");
});

test("a click on the description does not toggle a disabled switch", async () => {
  const user = userEvent.setup();
  const onCheckedChange = vi.fn();
  render(
    <Toggle checked={false} onCheckedChange={onCheckedChange} disabled description="Plan limit">
      Guests
    </Toggle>
  );

  await user.click(screen.getByText("Guests"));
  expect(onCheckedChange).not.toHaveBeenCalled();
});

test("a visible label without a description adds no aria-describedby", () => {
  render(
    <Toggle checked={false} onCheckedChange={() => {}}>
      Guests
    </Toggle>
  );

  expect(screen.getByRole("switch", { name: "Guests" }).hasAttribute("aria-describedby")).toBe(
    false
  );
});

test("the description joins the consumer's own aria-describedby, it does not replace it", () => {
  render(
    <>
      <p id="extra">Extra note</p>
      <Toggle
        checked={false}
        onCheckedChange={() => {}}
        description="Monday"
        aria-describedby="extra"
      >
        Digest
      </Toggle>
    </>
  );

  const ids = screen.getByRole("switch").getAttribute("aria-describedby")!.split(" ");
  expect(ids).toHaveLength(2);
  expect(ids).toContain("extra");
});

test("inside FormField the form's hint is still linked next to the description", () => {
  render(
    <FormField label="Digest" hint="Sent on Mondays">
      <Toggle checked={false} onCheckedChange={() => {}} description="Summary">
        Weekly digest
      </Toggle>
    </FormField>
  );

  const ids = screen.getByRole("switch").getAttribute("aria-describedby")!.split(" ");
  expect(ids.map((id) => document.getElementById(id)?.textContent).sort()).toEqual([
    "Sent on Mondays",
    "Summary",
  ]);
});

test("the plain form with a label attribute is unchanged: no row, no visible text", () => {
  const { container } = render(<Toggle checked={false} onCheckedChange={() => {}} label="Quiet" />);

  expect(container.firstElementChild?.tagName).toBe("BUTTON");
  expect(screen.getByRole("switch", { name: "Quiet" })).toBeTruthy();
});

test("an empty visible label falls back to the plain form", () => {
  const { container } = render(
    <Toggle checked={false} onCheckedChange={() => {}}>
      {""}
    </Toggle>
  );

  expect(container.firstElementChild?.tagName).toBe("BUTTON");
});

test("className goes to the row when the label is visible", () => {
  const { container } = render(
    <Toggle checked={false} onCheckedChange={() => {}} className="row-marker">
      Guests
    </Toggle>
  );

  expect(container.firstElementChild?.classList.contains("row-marker")).toBe(true);
  expect(screen.getByRole("switch").classList.contains("row-marker")).toBe(false);
});

test("the name rule is checked in development: none, both, or a description without a label", () => {
  // Типом это не проверяется: объединение `label | children` сломало бы
  // `extends ToggleProps` и `Omit<ToggleProps, …>` у потребителя.
  resetDevWarnings();
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  render(<Toggle checked onCheckedChange={() => {}} />);
  render(
    <Toggle checked onCheckedChange={() => {}} label="A">
      B
    </Toggle>
  );
  render(<Toggle checked onCheckedChange={() => {}} label="A" description="B" />);
  const messages = warn.mock.calls.map((call) => String(call[0]));
  expect(messages.some((m) => m.includes("no accessible name"))).toBe(true);
  expect(messages.some((m) => m.includes("both `label` and visible `children`"))).toBe(true);
  expect(messages.some((m) => m.includes("`description` needs a visible label"))).toBe(true);
  warn.mockRestore();
});

test("ToggleProps stays an object type: a consumer can extend it and Omit from it", () => {
  // Типовой тест: компилятор обязан принять оба привычных вида обёртки.
  interface Labeled extends ToggleProps {
    hint?: string;
  }
  const Wrapper = ({
    checked: _c,
    ...rest
  }: Omit<ToggleProps, "onCheckedChange"> & { checked: boolean }) => (
    <Toggle checked={_c} onCheckedChange={() => {}} {...rest} />
  );
  const props: Labeled = { checked: true, onCheckedChange: () => {}, label: "A" };
  render(<Wrapper {...props} />);
  expect(screen.getByRole("switch", { name: "A" })).toBeTruthy();
});
