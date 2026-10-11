// @vitest-environment jsdom
import { TooltipProvider } from "@radix-ui/react-tooltip";
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { SwatchGroup, type SwatchOption } from "../src/components/inputs/SwatchGroup.js";

/**
 * Набор образцов: имена, роли и клавиатура по сетке.
 *
 * Горизонтальные стрелки здесь НЕ проверяются: их разбирает браузер по имени
 * группы у радиокнопок, а jsdom этого не делает вовсе — проверка прошла бы и
 * на сломанном наборе. Они меряются в живом браузере
 * (`tests-visual/interactions.spec.ts`), там же и вид выбранности.
 */

afterEach(cleanup);

const HUES: SwatchOption[] = [
  { value: "none", name: "No colour" },
  { value: "blue", hue: "blue", name: "Blue" },
  { value: "violet", hue: "violet", name: "Violet" },
  { value: "teal", hue: "teal", name: "Teal" },
  { value: "green", hue: "green", name: "Green" },
  { value: "amber", hue: "amber", name: "Amber" },
  { value: "red", hue: "red", name: "Red" },
  { value: "pink", hue: "pink", name: "Pink" },
  { value: "steel", hue: "steel", name: "Steel" },
];

test("the set is a named radio group and every option is named by a word", () => {
  render(<SwatchGroup label="Project colour" value="blue" options={HUES} onChange={vi.fn()} />);

  // Без имени девять одинаковых кругов не различаются на слух никак, а
  // закраска именем не является: её не прочитать.
  expect(screen.getByRole("radiogroup", { name: "Project colour" })).toBeTruthy();
  expect(screen.getAllByRole("radio")).toHaveLength(9);
  expect(screen.getByRole("radio", { name: "Teal" })).toBeTruthy();
  expect(screen.getByRole("radio", { name: "No colour" })).toBeTruthy();
});

test("selection is announced by the role, not only by the colour", () => {
  render(<SwatchGroup label="Project colour" value="teal" options={HUES} onChange={vi.fn()} />);

  const checked = screen
    .getAllByRole("radio")
    .filter((radio) => (radio as HTMLInputElement).checked);
  expect(checked).toHaveLength(1);
  expect(checked[0]!).toBe(screen.getByRole("radio", { name: "Teal" }));
});

test("the option shows ONE circle: the swatch itself, with no second dot beside it", () => {
  const { container } = render(
    <SwatchGroup label="Project colour" value="blue" options={HUES} onChange={vi.fn()} />
  );

  /*
    Ровно ради этого компонент и заведён: на `RadioGroup` у варианта были два
    круга подряд — переключатель и образец, — и сетка из девяти читалась рябью.
  */
  expect(container.querySelectorAll(".rounded-full.size-6")).toHaveLength(9);
});

test("a click yields the value of the option, not its colour", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(<SwatchGroup label="Project colour" value="blue" options={HUES} onChange={onChange} />);

  await user.click(screen.getByRole("radio", { name: "Amber" }));

  expect(onChange).toHaveBeenCalledWith("amber");
});

test("vertical arrows walk the COLUMN, a step of `columns`, and apply at once", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(
    <SwatchGroup
      label="Project colour"
      value="blue"
      columns={3}
      options={HUES}
      onChange={onChange}
    />
  );

  screen.getByRole("radio", { name: "Blue" }).focus();
  await user.keyboard("{ArrowDown}");

  // Браузер в радиогруппе понимает «вниз» как «следующий», то есть увёл бы на
  // соседний столбец. По сетке вниз — это через ряд.
  expect(onChange).toHaveBeenCalledWith("green");
});

test("the edges do not wrap: the set is not a carousel", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(
    <SwatchGroup
      label="Project colour"
      value="blue"
      columns={3}
      options={HUES}
      onChange={onChange}
    />
  );

  screen.getByRole("radio", { name: "Blue" }).focus();
  await user.keyboard("{ArrowUp}");

  expect(onChange).not.toHaveBeenCalled();
});

test("Home and End go to the first and the last option", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(<SwatchGroup label="Project colour" value="teal" options={HUES} onChange={onChange} />);

  screen.getByRole("radio", { name: "Teal" }).focus();
  await user.keyboard("{End}");
  expect(onChange).toHaveBeenLastCalledWith("steel");

  await user.keyboard("{Home}");
  expect(onChange).toHaveBeenLastCalledWith("none");
});

test("a disabled option is not chosen by the edges either", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  const options = HUES.map((option, index) =>
    index === 0 ? { ...option, disabled: true } : option
  );
  render(<SwatchGroup label="Project colour" value="teal" options={options} onChange={onChange} />);

  screen.getByRole("radio", { name: "Teal" }).focus();
  await user.keyboard("{Home}");

  // «Первый» — это первый ДОСТУПНЫЙ: выключенный вариант остаётся на экране,
  // чтобы набор не менял раскладку, но выбрать его нельзя ничем.
  expect(onChange).toHaveBeenCalledWith("blue");
});

test("a disabled set answers neither the mouse nor the keyboard", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(
    <SwatchGroup label="Project colour" value="blue" options={HUES} onChange={onChange} disabled />
  );

  await user.click(screen.getByRole("radio", { name: "Amber" }));
  screen.getByRole("radio", { name: "Blue" }).focus();
  await user.keyboard("{End}");

  expect(onChange).not.toHaveBeenCalled();
});

test("the step is counted from where the focus is, not from what is selected", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  // Значение потребитель не применяет: так ведёт себя сохранение, ушедшее на
  // сервер, — человек уже стоит на новом варианте, выбранным числится прежний.
  render(
    <SwatchGroup
      label="Project colour"
      value="none"
      columns={3}
      options={HUES}
      onChange={onChange}
    />
  );

  screen.getByRole("radio", { name: "Violet" }).focus();
  await user.keyboard("{ArrowDown}");

  // От фокуса («Violet», индекс 2) вниз — «Amber» (индекс 5). От значения
  // («No colour», индекс 0) получился бы «Green».
  expect(onChange).toHaveBeenCalledWith("amber");
});

/*
  ПОДСКАЗКА С ИМЕНЕМ ОТТЕНКА (`tooltips`).

  Задержка здесь снята (`delayDuration={0}`): проверяется, ЧТО подсказка
  называет и кому достаётся её текст, а темп задаёт общий провайдер и мерить
  его тут нечем.
*/

const withTooltips = (ui: React.ReactNode) =>
  render(<TooltipProvider delayDuration={0}>{ui}</TooltipProvider>);

/** Подсказка появляется не мгновенно даже при нулевой задержке: Radix открывает её эффектом. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

test("without the prop there is no tooltip at all — and no TooltipProvider needed", async () => {
  // Набор выпущен раньше подсказки и стоит у потребителей без провайдера:
  // без `tooltips` он обязан рендериться вне провайдера, иначе патч уронил бы
  // их на обновлении. Radix без провайдера бросает — сам рендер и есть проверка.
  render(<SwatchGroup label="Project colour" value="blue" options={HUES} onChange={vi.fn()} />);

  screen.getByRole("radio", { name: "Amber" }).focus();
  await settle();

  expect(screen.queryByRole("tooltip")).toBeNull();
});

test("the tooltip names the option under the keyboard focus, not only under the mouse", async () => {
  withTooltips(
    <SwatchGroup label="Project colour" value="blue" options={HUES} onChange={vi.fn()} tooltips />
  );

  screen.getByRole("radio", { name: "Amber" }).focus();
  await settle();

  // Подсказка на самой радиокнопке появлялась бы только мышью: RAC не
  // пропускает в разметку `onFocus` и `onBlur`. Отсюда и обёртка.
  expect(screen.getByRole("tooltip").textContent).toBe("Amber");
});

test("the name is still announced ONCE: the tooltip describes nothing", async () => {
  withTooltips(
    <SwatchGroup label="Project colour" value="blue" options={HUES} onChange={vi.fn()} tooltips />
  );

  const radio = screen.getByRole("radio", { name: "Amber" });
  radio.focus();
  await settle();

  /*
    Главная проверка заявки. Radix вешает на триггер `aria-describedby`, и на
    самом варианте это удвоило бы имя — «Янтарный Янтарный». Описание обязано
    осесть на обёртке: у радиокнопки своего `aria-describedby` нет, а от предка
    описание не наследуется.
  */
  expect(radio.getAttribute("aria-describedby")).toBeNull();
  expect(radio.closest("label")?.getAttribute("aria-describedby")).toBeNull();
  expect(screen.getByRole("tooltip").id).toBe(
    radio.closest("span.block")?.getAttribute("aria-describedby")
  );
});

test("Escape removes the tooltip and leaves the focus where it was", async () => {
  const user = userEvent.setup();
  withTooltips(
    <SwatchGroup label="Project colour" value="blue" options={HUES} onChange={vi.fn()} tooltips />
  );

  const radio = screen.getByRole("radio", { name: "Amber" });
  radio.focus();
  await settle();
  await user.keyboard("{Escape}");
  await settle();

  expect(screen.queryByRole("tooltip")).toBeNull();
  expect(document.activeElement).toBe(radio);
});

test("a disabled option is named too: «what colour is it» is a fair question", async () => {
  const user = userEvent.setup();
  const options = HUES.map((option) =>
    option.value === "red" ? { ...option, disabled: true } : option
  );
  withTooltips(
    <SwatchGroup
      label="Project colour"
      value="blue"
      options={options}
      onChange={vi.fn()}
      tooltips
    />
  );

  await user.hover(screen.getByRole("radio", { name: "Red" }).closest("label")!);
  await settle();

  expect(screen.getByRole("tooltip").textContent).toBe("Red");
});

test("the wrapper does not swallow the click: the option is still chosen by the mouse", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  withTooltips(
    <SwatchGroup label="Project colour" value="blue" options={HUES} onChange={onChange} tooltips />
  );

  await user.click(screen.getByRole("radio", { name: "Amber" }));

  expect(onChange).toHaveBeenCalledWith("amber");
});

test("the tooltip does not take the grid keys away", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  withTooltips(
    <SwatchGroup
      label="Project colour"
      value="blue"
      columns={3}
      options={HUES}
      onChange={onChange}
      tooltips
    />
  );

  screen.getByRole("radio", { name: "Blue" }).focus();
  await settle();
  await user.keyboard("{ArrowDown}");

  expect(onChange).toHaveBeenCalledWith("green");
});
