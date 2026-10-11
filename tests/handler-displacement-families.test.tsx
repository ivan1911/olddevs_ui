// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { Toggle } from "../src/components/actions/Toggle.js";

afterEach(cleanup);

/**
 * Семейство «чужой обработчик не вытесняет собственный».
 *
 * `{...rest}`, стоящий после собственных пропов, перекрывает их. Для
 * оформления это безобидно и часто ДАЖЕ НУЖНО — потребитель вправе переопределить
 * `aria-label`. Для обработчика, которым компонент делает свою работу, это
 * смерть: `Toggle` с чужим `onClick` рисовался, слушался, звал аналитику и не
 * переключался никогда.
 *
 * Отдельно проверяется `onClick={undefined}`: ключ всё равно попадает в `rest`
 * и затирает собственный обработчик, то есть дефект ловится даже без реального
 * обработчика — на одной лишь необязательной пропе, проброшенной из обёртки
 * потребителя.
 *
 * Правило не «спред всегда первым»: `MaskedInput` держит спред последним и
 * корректен, потому что вынимает `onChange` и `onKeyDown` из `rest`
 * деструктуризацией. Проверяется СЛЕДСТВИЕ, а не расположение строк.
 *
 * Здесь перечислены компоненты, у которых есть И собственное поведение по
 * щелчку, И приём чужого обработчика. Аудит волны 26 нашёл ровно один такой —
 * `Toggle`; список заведён, чтобы второй попадал сюда, а не в приложение.
 *
 * Два других способа не иметь этого дефекта законны и в список не ведут:
 * вынуть обработчик из `rest` деструктуризацией (`MaskedInput`) или вовсе не
 * принимать его, вычеркнув из пропов через `Omit` (`CopyButton`) — там
 * вытеснять нечего.
 */
const CASES = [
  {
    name: "Toggle",
    render: (onClick: () => void) => (
      <Toggle checked={false} onCheckedChange={vi.fn()} label="Notifications" onClick={onClick} />
    ),
    role: "switch",
  },
] as const;

describe("a consumer handler runs without displacing the component's own", () => {
  test.each(CASES)("$name calls the consumer handler", async ({ render: renderCase, role }) => {
    const user = userEvent.setup();
    const consumer = vi.fn();
    render(renderCase(consumer));

    await user.click(screen.getByRole(role));

    expect(consumer).toHaveBeenCalledTimes(1);
  });
});

describe("an undefined handler prop does not erase the component's own", () => {
  test("Toggle still toggles when onClick is explicitly undefined", async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(
      <Toggle
        checked={false}
        onCheckedChange={onCheckedChange}
        label="Notifications"
        onClick={undefined}
      />
    );

    await user.click(screen.getByRole("switch"));

    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });
});
