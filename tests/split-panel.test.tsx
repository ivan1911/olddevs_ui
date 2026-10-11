// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { SplitPanel } from "../src/components/app-shell/SplitPanel.js";
import { clamp } from "../src/lib/clamp.js";

/*
  Шим захвата указателя. В jsdom этих трёх методов нет вовсе, а компонент зовёт
  их при начале тяги — без шима падало бы окружение, а не компонент.

  Допустим ровно по тому же основанию, что и шим `CSS.escape` в `menu.test.tsx`:
  он делает окружение БЛИЖЕ к браузеру, а не дальше. Это чистая бухгалтерия
  захвата, которая есть везде; координаты и настоящий фокус так подменять
  нельзя, и проверки, которые от них зависят, живут в браузере (ADR-0012).
*/
for (const method of ["setPointerCapture", "releasePointerCapture", "hasPointerCapture"] as const) {
  if (!(method in Element.prototype)) {
    Object.defineProperty(Element.prototype, method, {
      configurable: true,
      value: method === "hasPointerCapture" ? () => false : () => {},
    });
  }
}

afterEach(cleanup);

/*
  Перетаскивание указателем здесь НЕ проверяется, и это не пробел: в jsdom нет
  ни `setPointerCapture`, ни настоящих координат, поэтому такой тест либо
  проходил бы всегда, либо падал бы на исправном компоненте (ADR-0012). Тяга и
  стрелки клавиатуры живут в `tests-visual/interactions.spec.ts`.
*/

function Panel(props: Partial<React.ComponentProps<typeof SplitPanel>> = {}) {
  return (
    <SplitPanel aria-label="Details" panel={<p>Order #4821</p>} {...props}>
      <p>List</p>
    </SplitPanel>
  );
}

/*
  Утилита переехала в `lib/clamp.ts`: то же выражение было написано в ките
  четырежды. Компонент больше не расширяет свою публичную поверхность ради
  одного юнит-теста.
*/
test("clamp keeps the value inside the bounds", () => {
  expect(clamp(50, 120, 720)).toBe(120);
  expect(clamp(900, 120, 720)).toBe(720);
  expect(clamp(300, 120, 720)).toBe(300);
});

test("position switches the flex direction", () => {
  const { container, rerender } = render(<Panel position="side" />);
  const root = container.firstElementChild as HTMLElement;
  expect(root.className).toContain("flex-row");

  rerender(<Panel position="bottom" />);
  expect(root.className).toContain("flex-col");
});

test("the panel takes width when at the side and height when at the bottom", () => {
  const { rerender } = render(<Panel position="side" defaultSize={300} />);
  const region = screen.getByRole("region", { name: "Details" });
  expect(region.style.width).toBe("300px");
  expect(region.style.height).toBe("");

  rerender(<Panel position="bottom" defaultSize={300} />);
  expect(region.style.height).toBe("300px");
  expect(region.style.width).toBe("");
});

test("a size outside the bounds is clamped rather than applied", () => {
  const { rerender } = render(<Panel size={20} minSize={120} maxSize={400} />);
  const region = screen.getByRole("region", { name: "Details" });
  expect(region.style.width).toBe("120px");

  rerender(<Panel size={5000} minSize={120} maxSize={400} />);
  expect(region.style.width).toBe("400px");
});

/*
  Схлопывание не размонтирует содержимое: состояние форм и прокрутки внутри
  панели переживает его. Но из дерева доступности панель уходит — иначе Tab
  доходил бы до невидимого.
*/
test("collapsed takes the panel out of the accessibility tree with its handle", () => {
  render(<Panel collapsed />);

  expect(screen.queryByRole("region", { name: "Details" })).toBeNull();
  // Тянуть нечего — ручка исчезает вместе с панелью.
  expect(screen.queryByRole("slider")).toBeNull();
});

/*
  Один рендер это не доказывает: компонент, который при схлопывании
  размонтирует панель и монтирует её заново, прошёл бы такую проверку. Обещание
  пропа — «состояние внутри переживает схлопывание», и сторожить надо его.
*/
test("collapsing and reopening keeps the state inside the panel", async () => {
  const user = userEvent.setup();

  function Toggle() {
    const [collapsed, setCollapsed] = useState(false);
    return (
      <>
        <button onClick={() => setCollapsed((v) => !v)}>Toggle</button>
        <Panel collapsed={collapsed} panel={<input aria-label="Comment" defaultValue="" />} />
      </>
    );
  }
  render(<Toggle />);

  const comment = screen.getByRole("textbox", { name: "Comment" });
  await user.type(comment, "check");
  expect((comment as HTMLInputElement).value).toBe("check");

  await user.click(screen.getByRole("button", { name: "Toggle" }));
  await user.click(screen.getByRole("button", { name: "Toggle" }));

  expect((screen.getByRole("textbox", { name: "Comment" }) as HTMLInputElement).value).toBe(
    "check"
  );
});

/*
  Перевёрнутый диапазон не роняет ничего и молча давал бы контрол, из которого
  нет выхода: `min > max` у ползунка — состояние без единого сообщения о
  причине.
*/
test("an inverted range does not produce a dead control", () => {
  render(<Panel minSize={400} maxSize={200} />);
  const handle = screen.getByRole("slider");

  expect(Number(handle.getAttribute("min"))).toBeLessThanOrEqual(
    Number(handle.getAttribute("max"))
  );
  expect(screen.getByRole("region", { name: "Details" }).style.width).toBe("400px");
});

/*
  Шаг стрелки живёт в обработчике клавиш, а не в атрибуте `step`: шаговая база
  ползунка — это `min`, и `step=16` разрешил бы только значения `min + 16n`.
  Тогда `maxSize` не взялся бы с клавиатуры вовсе, а попиксельный результат тяги
  браузер молча округлял бы — и объявленное значение разошлось бы с шириной.
*/
test("the slider accepts every pixel, so the bounds are reachable exactly", () => {
  render(<Panel defaultSize={260} minSize={120} maxSize={725} />);
  const handle = screen.getByRole("slider") as HTMLInputElement;

  expect(handle.getAttribute("step")).toBe("1");
  // Значение ползунка совпадает с размером панели, а не округляется до сетки.
  expect(handle.value).toBe("260");

  fireEvent.change(handle, { target: { value: "725" } });
  expect(handle.value).toBe("725");
  expect(screen.getByRole("region", { name: "Details" }).style.width).toBe("725px");
});

test("arrow keys move by the coarse step and Shift by one pixel", async () => {
  const user = userEvent.setup();
  render(<Panel defaultSize={300} />);
  const handle = screen.getByRole("slider");
  handle.focus();

  await user.keyboard("{ArrowRight}");
  expect(screen.getByRole("region", { name: "Details" }).style.width).toBe("316px");

  await user.keyboard("{Shift>}{ArrowLeft}{/Shift}");
  expect(screen.getByRole("region", { name: "Details" }).style.width).toBe("315px");
});

test("the handle is a slider carrying the bounds and the current size", () => {
  render(<Panel defaultSize={300} minSize={120} maxSize={400} />);
  const handle = screen.getByRole("slider", { name: "Resize: Details" });

  expect(handle.getAttribute("min")).toBe("120");
  expect(handle.getAttribute("max")).toBe("400");
  expect((handle as HTMLInputElement).value).toBe("300");
  expect(handle.getAttribute("aria-valuetext")).toBe("300 pixels");
});

test("the handle without a panel name still has a name of its own", () => {
  render(
    <SplitPanel panel={<p>Details</p>}>
      <p>List</p>
    </SplitPanel>
  );
  expect(screen.getByRole("slider", { name: "Resize the panel" })).toBeTruthy();
});

test("an uncontrolled panel remembers the size it was given", () => {
  const onSizeChange = vi.fn();
  render(<Panel defaultSize={300} onSizeChange={onSizeChange} />);

  fireEvent.change(screen.getByRole("slider"), { target: { value: "360" } });

  expect(onSizeChange).toHaveBeenCalledWith(360);
  expect(screen.getByRole("region", { name: "Details" }).style.width).toBe("360px");
});

/*
  Управляемый размер внутрь не пишется: два источника правды разошлись бы ровно
  на том кадре, где потребитель отклонит значение. Здесь потребитель молчит —
  и панель обязана остаться на своём.
*/
test("a controlled panel does not move on its own", () => {
  const onSizeChange = vi.fn();
  render(<Panel size={300} onSizeChange={onSizeChange} />);

  fireEvent.change(screen.getByRole("slider"), { target: { value: "360" } });

  expect(onSizeChange).toHaveBeenCalledWith(360);
  expect(screen.getByRole("region", { name: "Details" }).style.width).toBe("300px");
});

test("a controlled panel follows the consumer", () => {
  function Controlled() {
    const [size, setSize] = useState(300);
    return (
      <>
        <button onClick={() => setSize(420)}>Widen</button>
        <Panel size={size} onSizeChange={setSize} />
      </>
    );
  }
  render(<Controlled />);

  fireEvent.click(screen.getByRole("button", { name: "Widen" }));
  expect(screen.getByRole("region", { name: "Details" }).style.width).toBe("420px");
});

/*
  `fireEvent.doubleClick`, а не `user.dblClick`: второй тянет за собой
  pointerdown, а в jsdom нет `setPointerCapture` — падало бы окружение, а не
  компонент. Сам захват указателя проверяется в браузере.
*/
test("double-clicking the handle returns the default size", () => {
  render(<Panel defaultSize={280} />);
  const region = screen.getByRole("region", { name: "Details" });

  fireEvent.change(screen.getByRole("slider"), { target: { value: "500" } });
  expect(region.style.width).toBe("500px");

  fireEvent.doubleClick(screen.getByRole("slider").parentElement as HTMLElement);
  expect(region.style.width).toBe("280px");
});

/*
  Уборщик с пустым списком зависимостей срабатывал на размонтировании ВСЕГО
  компонента, когда следующей ручки уже нет, — то есть не делал ничего.
  Схлопывание посреди тяги оставляло `select-none` на корне навсегда.
*/
test("collapsing during a drag clears the dragging state", () => {
  function Collapsible() {
    const [collapsed, setCollapsed] = useState(false);
    return (
      <>
        <button onClick={() => setCollapsed(true)}>Collapse</button>
        <Panel collapsed={collapsed} />
      </>
    );
  }
  const { container } = render(<Collapsible />);
  // Первый `div` — корень самой панели; следующие принадлежат её областям.
  const root = container.querySelectorAll("div")[0] as HTMLElement;

  fireEvent.pointerDown(screen.getByRole("slider").parentElement as HTMLElement, {
    button: 0,
    pointerId: 1,
    clientX: 100,
  });
  expect(root.className).toContain("select-none");

  fireEvent.click(screen.getByRole("button", { name: "Collapse" }));
  expect(root.className).not.toContain("select-none");
});

/*
  Объявленная ось обязана совпадать с той, по которой работают стрелки: при
  нижнем положении ползунок вертикальный. Расхождение ловится только ухом, и до
  сих пор его не сторожило ничто.
*/
test("the slider announces the axis it actually works on", () => {
  const { rerender } = render(<Panel position="side" />);
  expect(screen.getByRole("slider").getAttribute("aria-orientation")).toBe("horizontal");

  rerender(<Panel position="bottom" />);
  expect(screen.getByRole("slider").getAttribute("aria-orientation")).toBe("vertical");
});

/*
  Нажатие на полосу переводит фокус на ползунок — без этого сценарий «потянул
  мышью, дотяну стрелками» не работает вовсе. Браузерный тест ставит фокус
  явно и потому этот переход обходит.
*/
test("pressing the handle moves focus to the slider", () => {
  render(<Panel />);
  const slider = screen.getByRole("slider");
  expect(document.activeElement).not.toBe(slider);

  fireEvent.pointerDown(slider.parentElement as HTMLElement, {
    button: 0,
    pointerId: 1,
    clientX: 100,
  });
  expect(document.activeElement).toBe(slider);
});

/*
  Тяга за границу зажимается в то же число, и сообщать об этом нечего: прежде
  одно движение мимо предела давало десятки одинаковых событий подряд, а
  адресат у них — запись в адрес страницы или на сервер.
*/
test("a value clamped to the same number is not reported again", async () => {
  const user = userEvent.setup();
  const onSizeChange = vi.fn();
  render(<Panel defaultSize={400} minSize={120} maxSize={400} onSizeChange={onSizeChange} />);

  // Стрелка у самого предела: значение зажимается в то же число, и сообщать
  // нечего. `fireEvent.change` тем же числом здесь не годится — React не
  // считает это изменением и обработчик не зовёт вовсе.
  screen.getByRole("slider").focus();
  await user.keyboard("{ArrowRight}");
  expect(onSizeChange).not.toHaveBeenCalled();

  await user.keyboard("{ArrowLeft}");
  expect(onSizeChange).toHaveBeenCalledWith(384);
});

/*
  Внутреннее состояние не пишется, пока размер управляется, — иначе при
  возврате к неуправляемому режиму панель прыгнула бы на значение, которого
  потребитель никогда не принимал.
*/
test("an uncontrolled panel does not inherit a rejected controlled value", () => {
  const { rerender } = render(<Panel size={300} defaultSize={280} />);
  const region = () => screen.getByRole("region", { name: "Details" });

  fireEvent.change(screen.getByRole("slider"), { target: { value: "500" } });
  expect(region().style.width).toBe("300px");

  // Потребитель снял управление: панель обязана вернуться к своему умолчанию,
  // а не к отвергнутым 500.
  rerender(<Panel defaultSize={280} />);
  expect(region().style.width).toBe("280px");
});

/**
 * Сворачивание не роняет фокус на `<body>`.
 *
 * При `collapsed` ручка размонтируется целиком, а панель уходит под `hidden`, и
 * компонент не смотрел, не стоял ли на них фокус. Пользователь клавиатуры стоял
 * в поле внутри панели и нажимал внешнюю кнопку «Свернуть»: фокусируемый узел
 * исчезал, фокус уезжал на `<body>`, и следующий Tab начинал обход с начала
 * страницы.
 */
/**
 * ЧЕГО ЗДЕСЬ НЕТ: перевода фокуса при сворачивании.
 *
 * В jsdom атрибут `hidden` фокус не снимает, а ручка к моменту эффекта уже
 * размонтирована — то есть проверка «фокус не на `<body>`» проходила бы и на
 * неисправленном коде, опираясь на расхождение jsdom с браузером. По ADR-0012
 * такая проверка обязана быть браузерной, и она живёт в
 * `tests-visual/interactions.spec.ts` («SplitPanel: collapsing moves focus into
 * the content instead of dropping it») — проверено откатом: там она валится.
 */
test("the collapsible panel is hidden, not unmounted", () => {
  function Host({ collapsed }: { collapsed: boolean }) {
    return (
      <SplitPanel aria-label="Details" collapsed={collapsed} panel={<input aria-label="Note" />}>
        <p>Body</p>
      </SplitPanel>
    );
  }

  const { rerender } = render(<Host collapsed={false} />);
  rerender(<Host collapsed />);

  // Содержимое панели остаётся в разметке — иначе состояние полей внутри
  // терялось бы на каждом сворачивании.
  expect(screen.getByLabelText("Note")).toBeTruthy();
});
