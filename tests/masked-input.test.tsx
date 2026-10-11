// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { MaskedInput } from "../src/components/inputs/MaskedInput.js";

afterEach(cleanup);

const PHONE = "+7 (999) 999-99-99";

function Field({
  initial = "",
  mask = PHONE,
  showMask,
}: {
  initial?: string;
  mask?: string;
  showMask?: boolean;
}) {
  const [value, setValue] = useState(initial);
  return (
    <MaskedInput
      mask={mask}
      value={value}
      onChange={setValue}
      showMask={showMask}
      aria-label="Phone"
    />
  );
}

/** Видимая часть скелета — то, что пользователь читает как остаток формата. */
const remainder = () => document.querySelector("[aria-hidden] > span + span")?.textContent;

const field = () => screen.getByRole("textbox", { name: "Phone" }) as HTMLInputElement;

test("input is laid out by the mask", async () => {
  const user = userEvent.setup();
  render(<Field />);

  await user.type(field(), "9161234567");

  expect(field().value).toBe("+7 (916) 123-45-67");
});

test("both representations go outwards", () => {
  const onChange = vi.fn();
  render(<MaskedInput mask={PHONE} value="" onChange={onChange} aria-label="Phone" />);

  fireEvent.change(screen.getByRole("textbox"), { target: { value: "916" } });

  // Сырое нужно запросу, показанное — тому, кто хранит текст как есть.
  expect(onChange).toHaveBeenCalledWith("916", "+7 (916");
});

test("pasting a whole value is laid out", async () => {
  const user = userEvent.setup();
  render(<Field />);

  field().focus();
  await user.paste("+7 916 123 45 67");

  // Вставленное приходит тем же событием ввода, и разбор по маске
  // раскладывает его так же, как набранное.
  expect(field().value).toBe("+7 (916) 123-45-67");
});

test("a digit literal of the mask does not reach the value", () => {
  const onChange = vi.fn();
  render(<MaskedInput mask={PHONE} value="" onChange={onChange} aria-label="Phone" />);

  fireEvent.change(screen.getByRole("textbox"), { target: { value: "+7 (916) 123-45-67" } });

  // В маске литерал `7` — тоже цифра: наивный фильтр «оставим цифры» утащил бы
  // его в значение и номер стал бы одиннадцатизначным.
  expect(onChange).toHaveBeenCalledWith("9161234567", "+7 (916) 123-45-67");
});

test("anything beyond the mask capacity is dropped", async () => {
  const user = userEvent.setup();
  render(<Field />);

  field().focus();
  await user.paste("91612345678888");

  expect(field().value).toBe("+7 (916) 123-45-67");
});

test("Backspace across a literal deletes a value character, not the literal", () => {
  const onChange = vi.fn();
  render(<MaskedInput mask={PHONE} value="916" onChange={onChange} aria-label="Phone" />);

  const el = screen.getByRole("textbox") as HTMLInputElement;
  // Каретка стоит сразу за `)`: следующий символ слева — литерал.
  el.setSelectionRange(9, 9);
  fireEvent.keyDown(el, { key: "Backspace" });

  // Иначе литерал удалится, тут же вернётся форматированием, и нажатие ничего
  // не изменит — дефект выглядит как зависшая клавиша.
  expect(onChange).toHaveBeenCalledWith("91", "+7 (91");
});

test("Backspace at the start of the value does nothing", () => {
  const onChange = vi.fn();
  render(<MaskedInput mask={PHONE} value="916" onChange={onChange} aria-label="Phone" />);

  const el = screen.getByRole("textbox") as HTMLInputElement;
  el.setSelectionRange(0, 0);
  fireEvent.keyDown(el, { key: "Backspace" });

  expect(onChange).not.toHaveBeenCalled();
});

test("the caret stays where the edit is instead of jumping to the end", () => {
  const onChange = vi.fn();
  const { rerender } = render(
    <MaskedInput mask={PHONE} value="9161234567" onChange={onChange} aria-label="Phone" />
  );

  const el = screen.getByRole("textbox") as HTMLInputElement;
  // Правим третью цифру: «916» → «9165».
  el.setSelectionRange(7, 7);
  fireEvent.change(el, { target: { value: "+7 (9165) 123-45-67", selectionStart: 8 } });

  const [raw] = onChange.mock.calls[0]! as [string, string];
  rerender(
    <MaskedInput mask={PHONE} value={raw as string} onChange={onChange} aria-label="Phone" />
  );

  // Форматирование перерисовывает строку целиком, и браузер ставит каретку в
  // конец — править середину номера становится невозможно. Здесь слева от
  // каретки четыре цифры, и она встаёт за четвёртой: в «+7 (916) 5» это
  // десятая позиция, потому что между третьей и четвёртой стоят «) ».
  expect(raw).toBe("9165123456");
  expect(el.value).toBe("+7 (916) 512-34-56");
  expect(el.selectionStart).toBe(10);
});

test("a foreign key handler is not displaced", () => {
  const onKeyDown = vi.fn();
  render(
    <MaskedInput
      mask={PHONE}
      value="916"
      onChange={() => {}}
      onKeyDown={onKeyDown}
      aria-label="Phone"
    />
  );

  fireEvent.keyDown(screen.getByRole("textbox"), { key: "Backspace" });
  expect(onKeyDown).toHaveBeenCalled();
});

test("a mask of letters and any-characters works the same", async () => {
  const user = userEvent.setup();
  render(<Field mask="aa-**" />);

  await user.type(field(), "AB12");

  expect(field().value).toBe("AB-12");
});

test("an empty field shows the whole format", () => {
  render(<Field />);

  // До скелета поле не сообщало формат ВООБЩЕ: `formatMask` обрывается там, где
  // кончилось значение, и пустое поле было пустым прямоугольником.
  expect(remainder()).toBe("+7 (___) ___-__-__");
});

test("the skeleton is eaten as you type", async () => {
  const user = userEvent.setup();
  render(<Field />);

  await user.type(field(), "916");
  // Литералы, уже подставленные форматированием, из остатка ушли вместе с
  // цифрами: показанное и остаток вместе дают ровно маску.
  expect(remainder()).toBe(") ___-__-__");
  expect(field().value + remainder()).toBe("+7 (916) ___-__-__");
});

test("a filled field shows no skeleton", () => {
  render(<Field initial="9161234567" />);

  expect(remainder()).toBe("");
});

test("a hidden prefix holds what was typed, not underscores", () => {
  render(<Field initial="916" />);

  // На этом стоит выравнивание: под цифрой стоит та же цифра, и остаток
  // начинается ровно там, где кончился ввод. Держи префикс символы маски —
  // совпадение зависело бы от ширины `_` и `8` в шрифте потребителя.
  const prefix = document.querySelector("[aria-hidden] > span")!;
  expect(prefix.textContent).toBe("+7 (916");
  expect(prefix.className).toContain("invisible");
});

test("the skeleton is not read aloud", () => {
  render(<Field />);

  // Формат для скринридера живёт в подсказке `FormField`, связанной с полем
  // через `aria-describedby`, — она доступна и при проверке набранного, а
  // скелет по мере ввода исчезает.
  expect(field().getAttribute("aria-describedby")).toBeNull();
  expect(document.querySelector("[aria-hidden]")!.textContent).toBe("+7 (___) ___-__-__");
});

test("the skeleton is switched off by a prop", () => {
  render(<Field showMask={false} />);

  expect(document.querySelector("[aria-hidden]")).toBeNull();
});

test("the skeleton is recomputed on a programmatic value change", () => {
  // У эталонной реализации USWDS обработчик висит на `keyup`, и вставка мышью,
  // автозаполнение и программное изменение оставляют скелет несинхронным.
  // Здесь он считается из `value` в рендере, поэтому источник изменения неважен.
  const { rerender } = render(
    <MaskedInput mask={PHONE} value="" onChange={() => {}} aria-label="Phone" />
  );
  expect(remainder()).toBe("+7 (___) ___-__-__");

  rerender(<MaskedInput mask={PHONE} value="916" onChange={() => {}} aria-label="Phone" />);
  expect(remainder()).toBe(") ___-__-__");
});

test("an unsuitable character is announced instead of vanishing silently", async () => {
  const user = userEvent.setup();
  render(<Field />);

  await user.type(field(), "a");
  // До этого символ исчезал без следа и без слова: пользователь видел, что
  // нажатие «не сработало», и оставался без объяснения.
  expect(screen.getByRole("status").textContent).toBe("A digit is expected here");
});

test("the announcement says what was expected", async () => {
  const user = userEvent.setup();
  render(<Field mask="aa-99" />);

  await user.type(field(), "1");
  expect(screen.getByRole("status").textContent).toBe("A letter is expected here");
});

test("a successful paste with separators does not count as an error", async () => {
  const user = userEvent.setup();
  render(<Field />);

  // Разделители во вставленном номере с токенами не совпадают, но
  // раскладываются штатно: проверка по совпадению символа объявляла бы ошибку
  // на каждой удачной вставке.
  await user.click(field());
  await user.paste("+7 916 123 45 67");
  expect(field().value).toBe("+7 (916) 123-45-67");
  expect(screen.getByRole("status").textContent).toBe("");
});

test("a filled mask announces fullness, not the expected token", async () => {
  const user = userEvent.setup();
  render(<Field initial="9161234567" />);

  await user.type(field(), "8");
  expect(screen.getByRole("status").textContent).toBe("The field is already complete");
});

test("a successful input after a failed one clears the announcement", async () => {
  const user = userEvent.setup();
  render(<Field />);

  await user.type(field(), "a");
  expect(screen.getByRole("status").textContent).toBe("A digit is expected here");

  await user.type(field(), "9");
  expect(screen.getByRole("status").textContent).toBe("");
});

test("the live region is always mounted", () => {
  render(<Field />);

  // Область, вставленная в документ вместе с сообщением, объявляется
  // ненадёжно — часть скринридеров успевает её пропустить.
  expect(screen.getByRole("status").textContent).toBe("");
});

test("a mask literal typed instead of a digit is announced too", async () => {
  const user = userEvent.setup();
  render(<Field />);

  // `7` в маске `+7 (999) 999-99-99` — литерал, и он же цифра. Привычка
  // набирать «+7» вручную съедает символ как литерал: значение остаётся
  // пустым, поле не меняется. Проверка «годится ли символ под токен» считала
  // бы его принятым и молчала — то есть ровно тот дефект, ради которого
  // объявление и заводилось.
  await user.type(field(), "7");
  expect(field().value).toBe("");
  expect(screen.getByRole("status").textContent).toBe("A digit is expected here");
});

test("editing the middle of a filled field does not count as a rejection", async () => {
  const user = userEvent.setup();
  render(<Field initial="9161234567" />);

  // Значение меняется, не меняя длины: лишняя цифра выпадает за ёмкость. По
  // длине это выглядело бы отказом, и лишняя перерисовка роняла каретку.
  await user.click(field());
  field().setSelectionRange(7, 7);
  await user.keyboard("5");

  expect(field().value).toBe("+7 (916) 512-34-56");
  expect(screen.getByRole("status").textContent).toBe("");
});

/**
 * Вставка номера в самой частой его форме.
 *
 * `89161234567` — то, что лежит в буфере обмена чаще всего, — под маской
 * `+7 (999) 999-99-99` не влезает на один символ. До волны 26 хвост отбрасывался
 * молча, и в поле появлялся `+7 (891) 612-34-56`: чужой, но правдоподобный
 * номер. Отказ не объявлялся, потому что проверка `raw === value` ловит только
 * случай, когда значение НЕ изменилось, — а здесь оно изменилось.
 */
test("pasting a value longer than the mask announces the truncation", async () => {
  const user = userEvent.setup();
  render(<Field />);

  await user.click(field());
  await user.paste("89161234567");

  expect(screen.getByRole("status").textContent).toBe(
    "The pasted value is 1 character too long; the rest was not accepted"
  );
});

test("pasting a value that fits announces nothing", async () => {
  const user = userEvent.setup();
  render(<Field />);

  await user.click(field());
  await user.paste("79161234567");

  expect(field().value).toBe("+7 (916) 123-45-67");
  expect(screen.getByRole("status").textContent).toBe("");
});

/**
 * Вставка приходит не только через Ctrl+V.
 *
 * Перетаскивание текста мышью даёт `insertFromDrop`, подстановка из менеджера
 * паролей — `insertReplacementText`, а программная запись значения (самый
 * частый путь на мобильном) приходит обычным `Event` вообще без `inputType`.
 * Признак по одному `insertFromPaste` оставлял все эти пути молчащими, то есть
 * исходный дефект воспроизводился целиком.
 */
test.each(["insertFromDrop", "insertReplacementText"])(
  "a bulk input of type %s announces the truncation too",
  (inputType) => {
    render(<Field />);
    const input = field();

    fireEvent.input(input, {
      target: { value: "89161234567" },
      inputType,
    });

    expect(screen.getByRole("status").textContent).toBe(
      "The pasted value is 1 character too long; the rest was not accepted"
    );
  }
);

test("a programmatic write without inputType is still caught", () => {
  render(<Field />);

  fireEvent.input(field(), { target: { value: "89161234567" } });

  expect(screen.getByRole("status").textContent).toBe(
    "The pasted value is 1 character too long; the rest was not accepted"
  );
});

/**
 * Объём меряется по ВСЕМУ полю после вставки, а не по вставленному куску.
 *
 * Различие видно только на непустом поле: в пустом обе величины совпадают, и
 * оба теста выше прошли бы и при неверной реализации. Здесь в поле уже три
 * цифры, вставляются десять — не влезают три, а не семь.
 */
test("truncation is measured against the whole field, not the pasted fragment", async () => {
  const user = userEvent.setup();
  render(<Field initial="916" />);

  await user.click(field());
  await user.paste("1234567890");

  expect(field().value).toBe("+7 (916) 123-45-67");
  expect(screen.getByRole("status").textContent).toBe(
    "The pasted value is 3 characters too long; the rest was not accepted"
  );
});
