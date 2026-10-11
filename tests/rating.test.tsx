// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { Rating } from "../src/components/inputs/Rating.js";

afterEach(cleanup);

function Stars({
  initial = 0,
  readOnly = false,
  disabled = false,
  onValue = () => {},
}: {
  initial?: number;
  readOnly?: boolean;
  disabled?: boolean;
  onValue?: (value: number) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <Rating
      value={value}
      onChange={(next) => {
        setValue(next);
        onValue(next);
      }}
      readOnly={readOnly}
      disabled={disabled}
      aria-label="Quality"
    />
  );
}

test("clicking a star sets that value", async () => {
  const user = userEvent.setup();
  const onValue = vi.fn();
  render(<Stars onValue={onValue} />);

  await user.click(screen.getByRole("radio", { name: "4 of 5" }));
  expect(onValue).toHaveBeenCalledWith(4);
});

/*
  Клавиатурная модель — радиогруппа: пять табстопов на один вопрос это пять
  остановок там, где ответ один.
*/
/*
  Роуминг табиндекса: в табуляции ровно одна звезда — выбранная. Без него
  группа объявлена радиогруппой, но построена как ряд неинтерактивных
  элементов, и стрелка меняет значение молча.
*/
test("the whole rating is one tab stop, and it is the chosen star", async () => {
  const user = userEvent.setup();
  render(
    <>
      <button>before</button>
      <Stars initial={3} />
      <button>after</button>
    </>
  );

  screen.getByRole("button", { name: "before" }).focus();
  await user.tab();
  expect(document.activeElement).toBe(screen.getByRole("radio", { name: "3 of 5" }));

  await user.tab();
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "after" }));
});

test("with no rating yet the first star holds the tab stop", async () => {
  const user = userEvent.setup();
  render(
    <>
      <button>before</button>
      <Stars initial={0} />
    </>
  );

  screen.getByRole("button", { name: "before" }).focus();
  await user.tab();
  expect(document.activeElement).toBe(screen.getByRole("radio", { name: "1 of 5" }));
});

/*
  Состояние обязано висеть на элементе, а не только в подписи: без него
  скринридер прочитает пять одинаковых радиокнопок.
*/
test("only the chosen star is checked", () => {
  render(<Stars initial={2} />);
  const checked = screen
    .getAllByRole("radio")
    .filter((star) => star.getAttribute("aria-checked") === "true");
  expect(checked).toHaveLength(1);
  expect(checked[0]?.getAttribute("aria-label")).toBe("2 of 5");
});

/*
  Фокус идёт за значением: иначе следующая стрелка отсчитывала бы от прежней
  звезды, а объявлено было бы новое значение.
*/
test("focus follows the value so the next arrow counts from it", async () => {
  const user = userEvent.setup();
  render(<Stars initial={2} />);

  screen.getByRole("radio", { name: "2 of 5" }).focus();
  await user.keyboard("{ArrowRight}");
  expect(document.activeElement).toBe(screen.getByRole("radio", { name: "3 of 5" }));
});

test("arrows move the value and Home and End reach the ends", async () => {
  const user = userEvent.setup();
  const onValue = vi.fn();
  render(<Stars initial={3} onValue={onValue} />);

  screen.getByRole("radio", { name: "3 of 5" }).focus();
  await user.keyboard("{ArrowRight}");
  expect(onValue).toHaveBeenLastCalledWith(4);

  await user.keyboard("{ArrowLeft}");
  expect(onValue).toHaveBeenLastCalledWith(3);

  await user.keyboard("{End}");
  expect(onValue).toHaveBeenLastCalledWith(5);

  // `Home` уводит на ноль, а не на единицу: ноль объявлен законным значением,
  // и нижний край группы — это он.
  await user.keyboard("{Home}");
  expect(onValue).toHaveBeenLastCalledWith(0);
});

/*
  Ноль достижим только стрелкой назад с единицы: снять оценку — законное
  действие, но случайно в него не попадают.
*/
test("the value can be taken back to zero but never below", async () => {
  const user = userEvent.setup();
  const onValue = vi.fn();
  render(<Stars initial={1} onValue={onValue} />);

  screen.getByRole("radio", { name: "1 of 5" }).focus();
  await user.keyboard("{ArrowLeft}");
  expect(onValue).toHaveBeenLastCalledWith(0);

  await user.keyboard("{ArrowLeft}");
  expect(onValue).toHaveBeenLastCalledWith(0);
});

/*
  `readOnly` и `disabled` — разные состояния. Первое показывает данные и не
  гасит их; второе гасит, потому что это недоступное сейчас действие.
*/
test("read-only shows the value, leaves the tab order and is not dimmed", () => {
  const { container } = render(<Stars initial={4} readOnly />);

  expect(screen.queryByRole("radiogroup")).toBeNull();
  // Имя СКЛЕИВАЕТСЯ из подписи потребителя и величины, а не подменяется ею:
  // «Оценка 4 из 5» без предмета — величина без ответа на вопрос «чего».
  expect(screen.getByRole("img", { name: "Quality Rated 4 out of 5" })).toBeTruthy();
  expect(container.querySelector(".opacity-50")).toBeNull();
});

/*
  Выключенная оценка остаётся радиогруппой и помечается `aria-disabled`:
  `role="img"` прочитался бы как картинка, а не как недоступное действие.
  Клавиатуру проверяем событием на самой группе — иначе оно уходит в `body` и
  тест зелёный при любом коде.
*/
test("disabled keeps the role, marks itself and refuses input", async () => {
  const user = userEvent.setup();
  const onValue = vi.fn();
  const { container } = render(<Stars initial={2} disabled onValue={onValue} />);

  const group = screen.getByRole("radiogroup");
  expect(group.getAttribute("aria-disabled")).toBe("true");
  expect(container.querySelector(".opacity-50")).toBeTruthy();
  // Звёзды выпали из табуляции целиком.
  expect(screen.getAllByRole("radio").every((star) => !star.hasAttribute("tabindex"))).toBe(true);

  await user.click(screen.getByRole("radio", { name: "4 of 5" }));
  group.focus();
  await user.keyboard("{ArrowRight}");
  expect(onValue).not.toHaveBeenCalled();
});

/*
  Цвет и число закрашенных звёзд — единственный визуальный носитель величины.
  Без строки скринридер прочитал бы пять одинаковых элементов.
*/
/*
  Величина словами входит в имя группы и в интерактивном режиме тоже: без неё
  стрелка меняла бы `aria-checked` на элементе, а вслух не звучало бы ничего.
*/
test("the value is part of the group name, not a stray line", () => {
  render(<Stars initial={3} />);
  expect(screen.getByRole("radiogroup", { name: "Quality Rated 3 out of 5" })).toBeTruthy();
});

test("the caption is the consumer's, the kit does not compute it", () => {
  render(<Rating value={4} aria-label="Quality" caption="4,2 · 128 ratings" />);
  expect(screen.getByText("4,2 · 128 ratings")).toBeTruthy();
});

/*
  Токен звезды свой, а не `--warning`: цвет сегодня тот же, и в этом ловушка —
  правка предупреждения молча перекрасила бы все оценки (ADR-0040).
*/
test("filled stars take the rating token, empty ones the muted foreground", () => {
  const { container } = render(<Stars initial={2} />);

  expect(container.querySelectorAll(".text-rating-star")).toHaveLength(2);
  expect(container.querySelectorAll(".text-fg-3")).toHaveLength(3);
});

/*
  Дробное `value` тип разрешает, а закраску компонент от него принимает
  (`star <= 4.2` даёт четыре звезды) — значит запретить его молча нельзя.
  Прежде оно не совпадало ни с одной звездой, роуминг не ставил табстоп никуда,
  и радиогруппа становилась недостижимой с клавиатуры целиком.
*/
test("a fractional value still leaves exactly one tab stop", () => {
  render(<Stars initial={4.2} />);

  const stars = screen.getAllByRole("radio");
  const tabbable = stars.filter((s) => s.getAttribute("tabindex") === "0");
  expect(tabbable).toHaveLength(1);
  expect(tabbable[0]?.getAttribute("aria-label")).toBe("4 of 5");
});

test("a non-numeric value does not strand the control either", () => {
  render(<Stars initial={Number.NaN} />);

  const tabbable = screen.getAllByRole("radio").filter((s) => s.getAttribute("tabindex") === "0");
  expect(tabbable).toHaveLength(1);
});

/*
  `max` и `value` приходят из данных потребителя, и тип у них — обычное число.
  Шкала из нуля делений не шкала: прежде `max={0}` давал радиогруппу без единой
  опции и подпись «из 0».
*/
test("a degenerate max is brought back to a usable scale", () => {
  render(<Rating value={1} max={0} aria-label="Quality" />);
  expect(screen.getAllByRole("img").length).toBeGreaterThan(0);
  expect(screen.getByText("Rated 1 out of 1")).toBeTruthy();
});

test("a non-numeric value is announced as zero, not as NaN", () => {
  render(<Rating value={Number.NaN} aria-label="Quality" />);
  expect(screen.getByText("Rated 0 out of 5")).toBeTruthy();
});

/*
  Событие без изменения значения читается адресатом как правка. Стрелка у края
  и щелчок по уже выбранной звезде значения не меняют.
*/
test("the rating stays silent when the value would not change", async () => {
  const user = userEvent.setup();
  const onValue = vi.fn();
  render(<Stars initial={5} onValue={onValue} />);

  screen.getByRole("radio", { name: "5 of 5" }).focus();
  await user.keyboard("{ArrowRight}");
  expect(onValue).not.toHaveBeenCalled();

  await user.click(screen.getByRole("radio", { name: "5 of 5" }));
  expect(onValue).not.toHaveBeenCalled();

  await user.keyboard("{ArrowLeft}");
  expect(onValue).toHaveBeenCalledWith(4);
});

/**
 * Счёт идёт от ПРИВЕДЁННЫХ чисел, а не от сырых пропов.
 *
 * Файл объявляет в комментарии «приведение обоих чисел до всякого
 * использования» и считает `total` и `rounded` — а `onKeyDown` их не
 * использовал: `End` брал сырой `max`, стрелки — сырое `value`. Оба приходят из
 * данных потребителя, и докстрока `max` прямо разрешает им быть какими угодно.
 */
describe("keyboard arithmetic uses the coerced numbers", () => {
  test("End goes to the top of the scale even when max is not a number", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Rating value={2} max={Number.NaN} onChange={onChange} aria-label="Rating" />);

    await user.tab();
    await user.keyboard("{End}");

    // `clamp(NaN, 0, total)` — это `NaN`, проверка `clamped === rounded` на нём
    // не срабатывает, и наружу уходило `onChange(NaN)`: оценка потребителя
    // становилась `NaN` навсегда.
    const [value] = onChange.mock.calls.at(-1) ?? [];
    expect(Number.isFinite(value)).toBe(true);
    expect(value).toBe(5);
  });

  test("End goes to the top, not to zero, when max is zero", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Rating value={0} max={0} onChange={onChange} aria-label="Rating" />);

    await user.tab();
    await user.keyboard("{End}");

    // `max={0}` приводится к шкале в одну звезду; End обязан дать её, а не ноль.
    expect(onChange).toHaveBeenCalledWith(1);
  });

  test("an arrow steps from the rounded value, not from the fraction", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    /*
      Значение ВНЕ зоны зажима.

      На `4.2` сырой шаг давал `5.2`, но `clamp(…, 5)` возвращал `5` — то есть
      ровно ожидаемое, и тест был зелёным на неисправленном коде. На `2.2` шаг
      от сырого даёт `3.2`, зажим его не трогает, и разница видна.
    */
    render(<Rating value={2.2} onChange={onChange} aria-label="Rating" />);

    await user.tab();
    await user.keyboard("{ArrowRight}");

    expect(onChange).toHaveBeenCalledWith(3);
  });

  test("a fractional value still marks a star as checked", () => {
    render(<Rating value={4.2} onChange={() => {}} aria-label="Rating" />);

    // Закраска и роуминг считались от `rounded`, а `aria-checked` — от сырого
    // `value`: радиогруппа объявлялась без выбранного варианта вовсе.
    const checked = screen
      .getAllByRole("radio")
      .filter((r) => r.getAttribute("aria-checked") === "true");
    expect(checked).toHaveLength(1);
  });
});
