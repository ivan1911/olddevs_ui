// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { CodeView } from "../src/components/content/CodeView.js";

afterEach(cleanup);

const JSON_BODY = `{
  "id": 4821,
  "status": "assembling"
}`;

test("plain code is rendered as is when no markup is given", () => {
  const { container } = render(<CodeView code={JSON_BODY} />);
  expect(container.querySelector("pre")?.textContent).toBe(JSON_BODY);
});

/*
  Разметка — необязательный слой отображения; `code` при этом остаётся
  источником правды и для нумерации, и для копирования.
*/
test("supplied markup replaces the plain rendering", () => {
  render(
    <CodeView code={JSON_BODY}>
      <span data-testid="highlighted">highlighted</span>
    </CodeView>
  );
  expect(screen.getByTestId("highlighted")).toBeTruthy();
});

/*
  Гутер считается по `code`, а не по потомкам: считающий себя по разметке
  разъедется с содержимым на первом же подсветчике, который завернёт строку в
  два элемента.
*/
test("line numbers are counted from code", () => {
  const { container } = render(<CodeView code={JSON_BODY} lineNumbers />);
  expect(container.querySelector("[aria-hidden]")?.textContent).toBe("1234");
});

/*
  Один завершающий перевод строки срезается: файл, прочитанный с диска, почти
  всегда заканчивается им, и без этого гутер показывал бы лишний номер у пустой
  строки в конце.
*/
test("trailing newlines do not add phantom lines", () => {
  const { container, rerender } = render(<CodeView code={"a\nb\n"} lineNumbers />);
  expect(container.querySelector("[aria-hidden]")?.textContent).toBe("12");

  // Два подряд встречаются не реже одного: файл с пустой строкой в конце.
  rerender(<CodeView code={"a\nb\n\n"} lineNumbers />);
  expect(container.querySelector("[aria-hidden]")?.textContent).toBe("12");
});

/*
  С разметкой гутера нет вовсе, и это решение. Кит не знает, где в чужой
  разметке границы строк: подсветчик волен завернуть строку во сколько угодно
  элементов, а перенос добавляет ей высоты, о которой соседняя колонка номеров
  не догадывается. Номер напротив чужой строки хуже, чем его отсутствие.
*/
test("supplied markup drops the gutter instead of misaligning it", () => {
  const { container } = render(
    <CodeView code={JSON_BODY} lineNumbers>
      <span>one single element</span>
    </CodeView>
  );
  expect(container.querySelector("[aria-hidden]")).toBeNull();
});

/*
  Номера — шум в речи и мусор в буфере: скопированный код с номерами не
  компилируется.
*/
test("line numbers are hidden from speech and from selection", () => {
  const { container } = render(<CodeView code={JSON_BODY} lineNumbers />);
  const gutter = container.querySelector("[aria-hidden]") as HTMLElement;

  expect(gutter.getAttribute("aria-hidden")).toBe("true");
  expect(gutter.className).toContain("select-none");
});

test("without line numbers there is no gutter at all", () => {
  const { container } = render(<CodeView code={JSON_BODY} />);
  expect(container.querySelector("[aria-hidden]")).toBeNull();
});

/*
  Без переноса появляется прокрутка, а не обрезка: обрезанная строка кода молча
  теряет то, ради чего её открыли.
*/
test("wrapping is an axis, and its absence gives scrolling rather than clipping", () => {
  const { container, rerender } = render(<CodeView code={JSON_BODY} />);
  const scroller = container.querySelector(".overflow-x-auto") as HTMLElement;
  expect(scroller).toBeTruthy();
  expect(container.querySelector("pre")?.className).toContain("whitespace-pre");
  // До содержимого, которое прокручивается только указателем, клавиатура не
  // доберётся: правило axe `scrollable-region-focusable`.
  expect(scroller.getAttribute("tabindex")).toBe("0");

  rerender(<CodeView code={JSON_BODY} wrap />);
  expect(container.querySelector(".overflow-x-auto")).toBeNull();
  expect(container.querySelector("pre")?.className).toContain("whitespace-pre-wrap");
});

/*
  Копирование берёт `code`, а не DOM: иначе в буфер уехали бы номера строк и
  границы токенов подсветки.
*/
test("copying takes the plain code even when markup is shown", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  // Заглушка ставится ПОСЛЕ `userEvent.setup()`: он сам подменяет
  // `navigator.clipboard`, и поставленная раньше молча им перетирается — тот же
  // порядок, что в `tests/copy-button.test.tsx`.
  const user = userEvent.setup();
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });

  render(
    <CodeView code={JSON_BODY} copyable title="response.json">
      <span>coloured markup</span>
    </CodeView>
  );
  await user.click(screen.getByRole("button", { name: /Copy/i }));

  // В буфер уходит строка, а не разметка: копия из DOM утащила бы номера строк
  // и границы токенов подсветки — текст, который не компилируется.
  expect(writeText).toHaveBeenCalledWith(JSON_BODY);
});

/*
  Считать `div`-ы бессмысленно: прежняя версия этого теста проходила и на
  компоненте, который рисует шапку всегда. Сторожим конкретный узел.
*/
test("without a title and without copying there is no header", () => {
  const { container, rerender } = render(<CodeView code={JSON_BODY} title="response.json" />);
  expect(container.querySelector(".border-b")).toBeTruthy();

  rerender(<CodeView code={JSON_BODY} />);
  expect(container.querySelector(".border-b")).toBeNull();
  expect(screen.queryByRole("button")).toBeNull();
});

/*
  Компонент не подсвечивает ничего сам — это граница ADR-0039, и её стоит
  сторожить: подсветчик, добавленный «заодно», иначе появился бы незаметно.
*/
test("the kit adds no syntax markup of its own", () => {
  const { container } = render(<CodeView code={JSON_BODY} />);
  const code = container.querySelector("pre > code") as HTMLElement;
  expect(code.children).toHaveLength(0);
  expect(code.textContent).toBe(JSON_BODY);
});

/*
  Вторая причина снимать гутер, названная в докстроке пропа наравне с первой:
  перенос добавляет строке высоты, о которой колонка номеров не догадывается, и
  номер встаёт напротив чужой строки. Условие проверяло только разметку.
*/
test("wrapping drops the gutter for the same reason markup does", () => {
  const { container, rerender } = render(<CodeView code={JSON_BODY} lineNumbers />);
  expect(container.querySelector("[aria-hidden]")).toBeTruthy();

  rerender(<CodeView code={JSON_BODY} lineNumbers wrap />);
  expect(container.querySelector("[aria-hidden]")).toBeNull();
});

/*
  Лишний табстоп на непрокручиваемом блоке — такой же дефект, как его отсутствие
  на прокручиваемом: пользователь клавиатуры останавливается там, где делать
  нечего.
*/
test("a wrapped block is not a tab stop, because it does not scroll", () => {
  const { container } = render(<CodeView code={JSON_BODY} wrap />);
  const pre = container.querySelector("pre") as HTMLElement;
  const scroller = pre.parentElement as HTMLElement;
  expect(scroller.hasAttribute("tabindex")).toBe(false);
});
