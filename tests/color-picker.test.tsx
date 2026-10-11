// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { ColorPicker } from "../src/components/inputs/ColorPicker.js";

/*
  Шим `CSS.escape` — тот же, что в `menu.test.tsx`: попоувер react-aria зовёт
  его при открытии, а в jsdom объекта `CSS` нет.
*/
if (typeof globalThis.CSS === "undefined")
  (globalThis as unknown as { CSS: { escape: (v: string) => string } }).CSS = {
    escape: (value: string) => String(value).replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`),
  };

afterEach(cleanup);

function Brand({
  initial = "#4f7df3",
  presets,
  outputFormat,
  disabled = false,
  onValue = () => {},
}: {
  initial?: string;
  presets?: string[];
  outputFormat?: "hex" | "rgb" | "hsl";
  disabled?: boolean;
  onValue?: (value: string) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <ColorPicker
      value={value}
      onChange={(next) => {
        setValue(next);
        onValue(next);
      }}
      label="Brand colour"
      presets={presets}
      outputFormat={outputFormat}
      disabled={disabled}
    />
  );
}

const trigger = () => screen.getByRole("button", { name: /Brand colour/ });

test("the trigger carries the label", () => {
  render(<Brand />);
  expect(trigger()).toBeTruthy();
});

/*
  Наружу и внутрь — строка, а не объект `Color` библиотеки: объект протащил бы
  тип RAC в состояние потребителя и в его сигнатуры.
*/
test("the value goes out as a string in the requested format", async () => {
  const user = userEvent.setup();
  const onValue = vi.fn();
  render(<Brand outputFormat="rgb" onValue={onValue} />);

  await user.click(trigger());
  // Ползунков несколько: область насыщенности и полоса тона. Берётся
  // последний — полоса, — потому что двигать её проще всего предсказуемо.
  const sliders = await screen.findAllByRole("slider");
  (sliders.at(-1) as HTMLElement).focus();
  await user.keyboard("{ArrowRight}");

  expect(onValue).toHaveBeenCalled();
  const [next] = onValue.mock.calls.at(-1) as [string];
  expect(typeof next).toBe("string");
  expect(next.startsWith("rgb")).toBe(true);
});

test("the two-dimensional area and the hue slider are both reachable", async () => {
  const user = userEvent.setup();
  render(<Brand />);

  await user.click(trigger());
  // Два ползунка: двумерная область насыщенности и яркости — один контрол с
  // двумя осями, полоса тона — второй. Роли приходят из react-aria, а не
  // пишутся здесь.
  expect(await screen.findAllByRole("slider")).toHaveLength(2);
});

/*
  Умолчания у пресетов нет намеренно: набор «фирменных» цветов — домен
  потребителя. Без пропа ряда не должно быть вовсе, а не пустого.
*/
test("presets appear only when the consumer supplies them", async () => {
  const user = userEvent.setup();
  const { unmount } = render(<Brand />);

  await user.click(trigger());
  expect(screen.queryByText("Presets")).toBeNull();
  unmount();

  render(<Brand presets={["#e11d48", "#16a34a"]} />);
  await user.click(trigger());
  expect(await screen.findByText("Presets")).toBeTruthy();
});

test("a preset can be chosen and reports the new value", async () => {
  const user = userEvent.setup();
  const onValue = vi.fn();
  render(<Brand presets={["#e11d48", "#16a34a"]} onValue={onValue} />);

  await user.click(trigger());
  const swatches = await screen.findAllByRole("option");
  await user.click(swatches[1] as HTMLElement);

  expect(onValue).toHaveBeenCalled();
});

/*
  Поле ввода шестнадцатеричное всегда, и подпись это говорит: `outputFormat`
  меняет только строку наружу. Подписать поле «HSL», принимая hex, значило бы
  врать пользователю прямо на экране.
*/
test("the input stays hexadecimal whatever the output format is", async () => {
  const user = userEvent.setup();
  render(<Brand outputFormat="hsl" />);

  await user.click(trigger());
  expect(await screen.findByText("HEX")).toBeTruthy();
  expect((screen.getByRole("textbox") as HTMLInputElement).value.startsWith("#")).toBe(true);
});

/*
  Выключенное поле не раскрывается. Проверка есть потому, что без неё снятие
  атрибута с триггера не уронило бы ни один тест: снимков у периферии нет.
*/
test("a disabled picker does not open", async () => {
  const user = userEvent.setup();
  render(<Brand disabled />);

  expect(trigger().hasAttribute("disabled")).toBe(true);
  await user.click(trigger());
  expect(screen.queryByRole("slider")).toBeNull();
});

/*
  Неразборчивая строка становится чёрным — это поведение react-aria, и кит его
  не перехватывает. Но последствие стоит зафиксировать: первое же движение
  ползунка отдаст чёрный, то есть заменит непонятое значение понятым.
*/
test("an unparsable value falls back to black instead of throwing", async () => {
  const user = userEvent.setup();
  const onValue = vi.fn();
  render(<Brand initial="not-a-colour" onValue={onValue} />);

  await user.click(trigger());
  const sliders = await screen.findAllByRole("slider");
  (sliders.at(-1) as HTMLElement).focus();
  await user.keyboard("{ArrowRight}");

  expect(onValue).toHaveBeenCalled();
});

/*
  `label` объявлен обязательным именно потому, что безымянный контрол скринридер
  объявляет пустым словом. Прежде он рисовался только в ветке умолчания, и
  передача `children` — ровно то, ради чего проп заведён, — оставляла кнопку без
  имени. axe этого не ловил: истории с `children` нет.
*/
test("the trigger keeps its name when children replace the default content", () => {
  render(
    <ColorPicker value="#4f7df3" onChange={() => {}} label="Brand colour">
      <span aria-hidden>🎨</span>
    </ColorPicker>
  );
  expect(screen.getByRole("button", { name: "Brand colour" })).toBeTruthy();
});

/*
  Библиотека бросает на непонятой строке, и бросок происходит в фазе рендера —
  то есть уносит поддерево потребителя целиком. Ломается не экзотика:
  `rebeccapurple` это законный CSS-цвет, которого библиотека не берёт, а
  фирменную палитру совершенно естественно держать именами.
*/
test("an unparsable preset is skipped instead of taking the render down", async () => {
  const user = userEvent.setup();
  render(<Brand presets={["#e11d48", "rebeccapurple", "not-a-colour", "#16a34a"]} />);

  await user.click(trigger());
  // Остались только разобранные две; ряд заготовок при этом никуда не делся.
  expect(await screen.findAllByRole("option")).toHaveLength(2);
});

test("presets that are all unparsable hide the row rather than leave it empty", async () => {
  const user = userEvent.setup();
  render(<Brand presets={["nope", "also-nope"]} />);

  await user.click(trigger());
  expect(screen.queryByText("Presets")).toBeNull();
});
