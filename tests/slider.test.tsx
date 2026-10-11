// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { RangeSlider, Slider } from "../src/components/inputs/Slider.js";

afterEach(cleanup);

test("an arrow moves by step, Shift by a large step", async () => {
  const user = userEvent.setup();
  const onChangeSpy = vi.fn();

  render(
    <Slider
      label="Quality"
      defaultValue={50}
      minValue={0}
      maxValue={100}
      step={5}
      onChange={onChangeSpy}
    />
  );

  const thumb = screen.getByRole("slider", { name: "Quality" });
  thumb.focus();

  await user.keyboard("{ArrowRight}");
  expect(onChangeSpy).toHaveBeenLastCalledWith(55);

  // Крупный шаг react-aria считает от диапазона (10%), а не от `step`:
  // иначе на шкале в тысячу единиц Shift не давал бы ничего заметного.
  await user.keyboard("{Shift>}{ArrowRight}{/Shift}");
  const last = onChangeSpy.mock.calls.at(-1)![0] as number;
  expect(last).toBeGreaterThan(60);
});

test("the range ends do not come closer than the minimum gap", async () => {
  const user = userEvent.setup();
  const onChangeSpy = vi.fn();

  render(
    <RangeSlider
      label="Size"
      value={[300, 400]}
      minValue={0}
      maxValue={1000}
      step={100}
      minGap={100}
      onChange={onChangeSpy}
    />
  );

  const ends = screen.getAllByRole("slider");
  ends[0]!.focus();
  await user.keyboard("{ArrowRight}");

  // Шаг свёл бы концы вплотную — «от 400 до 400». Значение ЗАЖИМАЕТСЯ, а не
  // отбрасывается: отбрасывание заклинивало ползунок насмерть, стоило ему
  // однажды оказаться в состоянии уже нарушенного зазора.
  expect(onChangeSpy).toHaveBeenCalledWith([400, 500]);
});

test("from a violated gap the thumb gets out instead of jamming", async () => {
  const user = userEvent.setup();
  const onChangeSpy = vi.fn();

  render(
    <RangeSlider
      label="Size"
      value={[500, 500]}
      minValue={0}
      maxValue={1000}
      step={100}
      minGap={100}
      onChange={onChangeSpy}
    />
  );

  screen.getAllByRole("slider")[1]!.focus();
  await user.keyboard("{ArrowRight}");

  // «Сохранённый фильтр» с нулевым диапазоном — законное начальное состояние,
  // и выйти из него обязано быть можно.
  expect(onChangeSpy).toHaveBeenCalled();
  const [low, high] = onChangeSpy.mock.calls.at(-1)![0] as [number, number];
  expect(high - low).toBeGreaterThanOrEqual(100);
});

test("movement within the gap goes through", async () => {
  const user = userEvent.setup();
  const onChangeSpy = vi.fn();

  render(
    <RangeSlider
      label="Size"
      defaultValue={[300, 900]}
      minValue={0}
      maxValue={1000}
      step={100}
      minGap={100}
      onChange={onChangeSpy}
    />
  );

  screen.getAllByRole("slider")[0]!.focus();
  await user.keyboard("{ArrowRight}");

  expect(onChangeSpy).toHaveBeenCalledWith([400, 900]);
});

/**
 * База «какой конец двигали» не должна быть заморожена на `defaultValue`.
 *
 * У неуправляемого ползунка `rest.value` всегда `undefined`, а `defaultValue`
 * не меняется никогда — после первого же движения сравнение шло с НАЧАЛЬНЫМ
 * значением, а не с предыдущим, и зажимался не тот конец.
 */
test("an uncontrolled range keeps clamping the thumb that did not move", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();

  render(
    <RangeSlider
      label="Price"
      defaultValue={[300, 900]}
      minGap={100}
      step={100}
      minValue={0}
      maxValue={1000}
      onChange={onChange}
    />
  );

  const thumbs = screen.getAllByRole("slider");

  // Сначала уводим НИЖНИЙ конец от его умолчания: пока он стоит на 300,
  // замороженная база совпадает с текущей, и расхождения не видно.
  thumbs[0]!.focus();
  await user.keyboard("{ArrowRight>2/}");

  // Теперь тянем ВЕРХНИЙ вниз, пока не упрёмся в зазор.
  thumbs[1]!.focus();
  await user.keyboard("{ArrowLeft>5/}");

  const [low, high] = onChange.mock.calls.at(-1)?.[0] as [number, number];
  expect(high - low).toBe(100);
  // Двигали верхний — он и остаётся под пальцем, а уезжает нижний. С базой,
  // замороженной на `defaultValue`, сравнение `low !== prevLow` давало ИСТИНУ
  // (нижний-то успел уехать раньше), и зажимался верхний: он прыгал прочь от
  // того места, куда его тянули.
  expect(high).toBe(500);
  expect(low).toBe(400);
});

/**
 * Вертикаль — это поведение, а не только вид: скринридер объявляет ориентацию,
 * а стрелки вверх/вниз становятся основными. Проверяем, что проп дошёл до
 * react-aria, а не осел в одном CSS.
 */
test("a vertical slider announces its orientation", () => {
  render(<Slider label="Level" defaultValue={65} orientation="vertical" />);

  const thumb = screen.getByRole("slider", { name: "Level" });
  expect(thumb.getAttribute("aria-orientation")).toBe("vertical");
});

test("on a vertical slider up raises the value and down lowers it", async () => {
  const user = userEvent.setup();
  const onChangeSpy = vi.fn();

  render(
    <Slider
      label="Level"
      defaultValue={50}
      minValue={0}
      maxValue={100}
      step={5}
      orientation="vertical"
      onChange={onChangeSpy}
    />
  );

  screen.getByRole("slider", { name: "Level" }).focus();

  // Вверх — больше: заливка растёт от нижнего края, и стрелка обязана
  // двигать бегунок туда же, куда смотрит.
  await user.keyboard("{ArrowUp}");
  expect(onChangeSpy).toHaveBeenLastCalledWith(55);
  await user.keyboard("{ArrowDown}{ArrowDown}");
  expect(onChangeSpy).toHaveBeenLastCalledWith(45);

  await user.keyboard("{End}");
  expect(onChangeSpy).toHaveBeenLastCalledWith(100);
  await user.keyboard("{Home}");
  expect(onChangeSpy).toHaveBeenLastCalledWith(0);
});

/**
 * Главный риск вертикали — ползунок, который принял проп и всё равно
 * нарисовался горизонтальным: ради этого `orientation` и был убран из типа.
 * Размер заливки — то, что видит глаз: у вертикального её задаёт высота,
 * у горизонтального ширина, и никогда обе сразу.
 */
test("the fill grows along the slider's own axis", () => {
  const { container: vertical } = render(
    <Slider label="Level" defaultValue={65} orientation="vertical" />
  );
  const verticalFill = vertical.querySelector<HTMLElement>("[data-fill]")!;
  expect(verticalFill.style.height).toBe("65%");
  expect(verticalFill.style.width).toBe("");
  cleanup();

  const { container: horizontal } = render(<Slider label="Level" defaultValue={65} />);
  const horizontalFill = horizontal.querySelector<HTMLElement>("[data-fill]")!;
  expect(horizontalFill.style.width).toBe("65%");
  expect(horizontalFill.style.height).toBe("");
});

test("a range slider stays horizontal at the type level", () => {
  // Вертикаль есть только у одиночного ползунка: геометрия заливки между
  // двумя концами по высоте не сделана, и проп, который компилируется и
  // ничего не делает, хуже отсутствующего.
  // @ts-expect-error — `orientation` у RangeSlider намеренно нет
  render(<RangeSlider label="Size" defaultValue={[20, 80]} orientation="vertical" />);
  expect(screen.getAllByRole("slider")).toHaveLength(2);
});

/**
 * Выключенный ползунок приглушается целиком (OLDSUI-37; почему так — у
 * `DIMMED_WHEN_DISABLED` в `Slider.tsx`). jsdom CSS не считает, поэтому
 * проверяем связку «признак — вид»: `data-disabled` на корне и привязанный
 * к нему приглушающий класс, плюс `aria-disabled` у группы.
 */
test.each([
  ["Slider", <Slider key="h" label="Level" defaultValue={40} isDisabled />],
  [
    "vertical Slider",
    <Slider key="v" label="Level" defaultValue={40} orientation="vertical" isDisabled />,
  ],
  ["RangeSlider", <RangeSlider key="r" label="Level" defaultValue={[20, 80]} isDisabled />],
])("a disabled %s is dimmed as a whole", (_, element) => {
  render(element);
  const root = screen.getByRole("group");

  expect(root.hasAttribute("data-disabled")).toBe(true);
  expect(root.className.split(" ")).toContain("disabled:opacity-50");
  expect(root.getAttribute("aria-disabled")).toBe("true");
});

test("a consumer's own render still wraps the root", () => {
  // Кит кладёт `aria-disabled` через `render`; свой `render` потребителя
  // обязан при этом сработать, а не молча пропасть.
  render(
    <Slider
      label="Level"
      defaultValue={40}
      isDisabled
      render={(props) => <div {...props} data-consumer="yes" />}
    />
  );

  const root = screen.getByRole("group");
  expect(root.getAttribute("data-consumer")).toBe("yes");
  expect(root.getAttribute("aria-disabled")).toBe("true");
});

test("the wheel moves the value by one step: up increases, down decreases", () => {
  const onChangeSpy = vi.fn();

  render(<Slider label="Quality" defaultValue={50} step={5} onChange={onChangeSpy} />);

  const group = screen.getByRole("group");
  fireEvent.wheel(group, { deltaY: -100 });
  expect(onChangeSpy).toHaveBeenLastCalledWith(55);

  fireEvent.wheel(group, { deltaY: 100 });
  expect(onChangeSpy).toHaveBeenLastCalledWith(50);
});

test("a disabled slider ignores the wheel", () => {
  const onChangeSpy = vi.fn();
  render(<Slider label="Quality" defaultValue={50} isDisabled onChange={onChangeSpy} />);

  fireEvent.wheel(screen.getByRole("group"), { deltaY: -100 });
  expect(onChangeSpy).not.toHaveBeenCalled();
});

test("at the edge of the scale the wheel is left to the page", () => {
  const onChangeSpy = vi.fn();
  render(<Slider label="Quality" defaultValue={100} onChange={onChangeSpy} />);

  const group = screen.getByRole("group");
  // `fireEvent` возвращает `false`, если у события отменили действие по умолчанию.
  expect(fireEvent.wheel(group, { deltaY: -100 })).toBe(true);
  expect(onChangeSpy).not.toHaveBeenCalled();

  // Обратно от края значение двигается, и страница при этом стоит.
  expect(fireEvent.wheel(group, { deltaY: 100 })).toBe(false);
  expect(onChangeSpy).toHaveBeenLastCalledWith(99);
});

test("the vertical slider follows the wheel in the same direction", () => {
  const onChangeSpy = vi.fn();
  render(<Slider label="Level" orientation="vertical" defaultValue={50} onChange={onChangeSpy} />);

  fireEvent.wheel(screen.getByRole("group"), { deltaY: -100 });
  expect(onChangeSpy).toHaveBeenLastCalledWith(51);
});

test("small trackpad deltas add up to one step", () => {
  const onChangeSpy = vi.fn();
  render(<Slider label="Quality" defaultValue={50} onChange={onChangeSpy} />);

  const group = screen.getByRole("group");
  fireEvent.wheel(group, { deltaY: -15 });
  fireEvent.wheel(group, { deltaY: -15 });
  expect(onChangeSpy).not.toHaveBeenCalled();
  fireEvent.wheel(group, { deltaY: -15 });
  expect(onChangeSpy).toHaveBeenCalledTimes(1);
});

test("the wheel on a range moves the end nearest to the cursor", () => {
  const onChangeSpy = vi.fn();
  render(
    <RangeSlider
      label="Size"
      defaultValue={[200, 800]}
      minValue={0}
      maxValue={1000}
      step={50}
      onChange={onChangeSpy}
    />
  );

  // jsdom не раскладывает вёрстку: дорожку на 0–1000 px задаём вручную.
  const track = screen.getAllByRole("slider")[0]!.parentElement!.parentElement!.parentElement!;
  track.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 1000, height: 6, right: 1000, bottom: 6 }) as DOMRect;

  const group = screen.getByRole("group");
  fireEvent.wheel(group, { deltaY: -100, clientX: 750 });
  expect(onChangeSpy).toHaveBeenLastCalledWith([200, 850]);

  fireEvent.wheel(group, { deltaY: -100, clientX: 150 });
  expect(onChangeSpy).toHaveBeenLastCalledWith([250, 850]);
});

test("the wheel on a range keeps the minimum gap", () => {
  const onChangeSpy = vi.fn();
  render(
    <RangeSlider
      label="Size"
      value={[300, 400]}
      minValue={0}
      maxValue={1000}
      step={100}
      minGap={100}
      onChange={onChangeSpy}
    />
  );

  const track = screen.getAllByRole("slider")[0]!.parentElement!.parentElement!.parentElement!;
  track.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 1000, height: 6, right: 1000, bottom: 6 }) as DOMRect;

  fireEvent.wheel(screen.getByRole("group"), { deltaY: -100, clientX: 300 });
  expect(onChangeSpy).toHaveBeenCalledWith([400, 500]);
});

test("Ctrl + wheel is browser zoom and is left alone", () => {
  const onChangeSpy = vi.fn();
  render(<Slider label="Quality" defaultValue={50} onChange={onChangeSpy} />);

  expect(fireEvent.wheel(screen.getByRole("group"), { deltaY: -100, ctrlKey: true })).toBe(true);
  expect(onChangeSpy).not.toHaveBeenCalled();
});

test.each([
  { name: "up moves the upper one", deltaY: -100, expected: [500, 550] },
  { name: "down moves the lower one", deltaY: 100, expected: [450, 500] },
])("equal range ends: scrolling $name", ({ deltaY, expected }) => {
  const onChangeSpy = vi.fn();
  render(
    <RangeSlider
      label="Size"
      defaultValue={[500, 500]}
      minValue={0}
      maxValue={1000}
      step={50}
      onChange={onChangeSpy}
    />
  );

  const track = screen.getAllByRole("slider")[0]!.parentElement!.parentElement!.parentElement!;
  track.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 1000, height: 6, right: 1000, bottom: 6 }) as DOMRect;

  fireEvent.wheel(screen.getByRole("group"), { deltaY, clientX: 500 });
  expect(onChangeSpy).toHaveBeenLastCalledWith(expected);
});

test("a leftover from an old gesture or the opposite direction does not eat the next one", () => {
  vi.useFakeTimers();
  try {
    const onChangeSpy = vi.fn();
    render(<Slider label="Quality" defaultValue={50} onChange={onChangeSpy} />);
    const group = screen.getByRole("group");

    // Недокрутка вверх, пауза — и щелчок вниз сразу даёт шаг.
    fireEvent.wheel(group, { deltaY: -30 });
    vi.advanceTimersByTime(500);
    fireEvent.wheel(group, { deltaY: 100 });
    expect(onChangeSpy).toHaveBeenCalledTimes(1);
    expect(onChangeSpy).toHaveBeenLastCalledWith(49);

    // Разворот без паузы: остаток вверх не вычитается из щелчка вниз.
    fireEvent.wheel(group, { deltaY: -30 });
    fireEvent.wheel(group, { deltaY: 100 });
    expect(onChangeSpy).toHaveBeenCalledTimes(2);
    expect(onChangeSpy).toHaveBeenLastCalledWith(48);
  } finally {
    vi.useRealTimers();
  }
});

test("the sideways trackpad scroll on a horizontal slider: right increases", () => {
  const onChangeSpy = vi.fn();
  render(<Slider label="Quality" defaultValue={50} onChange={onChangeSpy} />);

  fireEvent.wheel(screen.getByRole("group"), { deltaX: 100, deltaY: 0 });
  expect(onChangeSpy).toHaveBeenLastCalledWith(51);
});

test("wheel lines (Firefox) count as a notch", () => {
  const onChangeSpy = vi.fn();
  render(<Slider label="Quality" defaultValue={50} onChange={onChangeSpy} />);

  // deltaMode 1 — строки: три строки по 16 px — больше порога, это один щелчок.
  fireEvent.wheel(screen.getByRole("group"), { deltaY: -3, deltaMode: 1 });
  expect(onChangeSpy).toHaveBeenLastCalledWith(51);
});

test("the wheel ends the change like the keyboard: onChangeEnd fires once per step", () => {
  const onChangeEndSpy = vi.fn();
  render(<Slider label="Quality" defaultValue={50} onChangeEnd={onChangeEndSpy} />);

  fireEvent.wheel(screen.getByRole("group"), { deltaY: -100 });
  expect(onChangeEndSpy).toHaveBeenCalledTimes(1);
  expect(onChangeEndSpy).toHaveBeenLastCalledWith(51);
});
