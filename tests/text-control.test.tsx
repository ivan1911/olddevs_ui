// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { TextControl } from "../src/components/inputs/TextControl.js";

afterEach(cleanup);

test("without the underlay the markup does not change by a single node", () => {
  // Слот добавлен к СТАБИЛЬНОМУ компоненту, и цена такого изменения — обещание,
  // что без слота он остаётся прежним. Обёртка-сетка не должна появляться у
  // поля, которое о подложке не просило: на этом компоненте стоит половина
  // кита, и лишний узел разъехался бы по всем снимкам сразу.
  const { container } = render(<TextControl aria-label="Plain" />);

  const shell = container.firstElementChild!;
  expect(shell.children.length).toBe(1);
  expect(shell.firstElementChild!.tagName).toBe("INPUT");
});

test("the underlay lies under the field, not after it", () => {
  const { container } = render(<TextControl aria-label="With an underlay" underlay="+7 (___)" />);

  const grid = container.querySelector(".grid")!;
  // Порядок в разметке — это порядок отрисовки: подложка, оказавшись сверху,
  // закрыла бы и значение, и каретку.
  expect(grid.children.length).toBe(2);
  expect(grid.firstElementChild!.textContent).toBe("+7 (___)");
  expect(grid.lastElementChild!.tagName).toBe("INPUT");
});

test("the underlay is not read aloud", () => {
  render(<TextControl aria-label="With an underlay" underlay="+7 (___)" />);

  // Слой под значением повторяет то, что уже сказано подписью и подсказкой.
  // Прочитанный вслух, он дал бы «подчёркивание подчёркивание» посреди поля.
  expect(screen.getByText("+7 (___)").getAttribute("aria-hidden")).toBe("true");
});

test("the underlay matches the field in padding and typography", () => {
  const { container } = render(<TextControl aria-label="With an underlay" underlay="+7 (___)" />);

  const underlay = screen.getByText("+7 (___)");
  const field = container.querySelector("input")!;

  // Выравнивание держится общим классом, а не подгонкой в пикселях: начало
  // текста совпадает по построению и не разъедется при смене шкалы шрифта.
  for (const cls of ["px-0", "py-[10px]", "text-[13px]", "leading-5"]) {
    expect(underlay.className).toContain(cls);
    expect(field.className).toContain(cls);
  }
  // Пробелы маски не схлопываются — иначе остаток уехал бы влево.
  expect(underlay.className).toContain("whitespace-pre");
});

test("the underlay neither intercepts the pointer nor gets selected", () => {
  render(<TextControl aria-label="With an underlay" underlay="+7 (___)" />);

  // Подложка занимает ту же ячейку, что и поле. Перехватывай она указатель —
  // поле перестало бы фокусироваться щелчком по собственному тексту.
  //
  // Здесь проверяются КЛАССЫ, а не сам щелчок: в jsdom нет ни раскладки, ни
  // загруженного CSS, поэтому `pointer-events` там ни на что не влияет и
  // «сквозной» клик недоказуем в принципе. Настоящая проверка — в браузере,
  // `tests-visual/interactions.spec.ts`.
  const underlay = screen.getByText("+7 (___)");
  expect(underlay.className).toContain("pointer-events-none");
  expect(underlay.className).toContain("select-none");
});

test("the underlay lives alongside the slots", () => {
  const { container } = render(
    <TextControl aria-label="With an underlay" underlay="+7 (___)" icon={<span>icon</span>} />
  );

  const shell = container.firstElementChild!;
  expect(shell.className).toContain("flex");
  // Сетка становится флекс-ребёнком и ужимается: без `min-w-0` длинное
  // значение выдавило бы соседний слот за рамку.
  const grid = container.querySelector(".grid")!;
  expect(grid.className).toContain("min-w-0");
  expect(grid.className).toContain("flex-1");
});

/**
 * Счётчик и `trailing` стоят рядом, а не вытесняют друг друга.
 *
 * Было `counter ?? trailing`: при `showCount` переданный `trailing` не попадал
 * в разметку вовсе и без предупреждения — кнопка очистки просто исчезала. На
 * `textarea` тот же вызов работал (счётчик уезжает вниз), и расхождение между
 * двумя формами одного компонента ничем не объяснялось.
 */
test("showCount does not swallow the trailing slot", () => {
  render(
    <TextControl
      aria-label="Name"
      showCount
      maxLength={100}
      value="abc"
      onChange={() => {}}
      trailing={<button type="button">Clear</button>}
    />
  );

  expect(screen.getByRole("button", { name: "Clear" })).toBeDefined();
  expect(screen.getByText("3/100")).toBeDefined();
});

/*
  СТУПЕНЬ ВЫСОТЫ — OLDSUI-16.

  Здесь только то, что jsdom может сказать: класс отступа стоит там, где нужно,
  и не стоит там, где не нужно. Сама высота (36 против 42) меряется в живом
  браузере, в `tests-visual/interactions.spec.ts`: раскладки в jsdom нет.
*/
test("the sm step trades ten pixels of padding for seven, and md stays as it was", () => {
  const { rerender } = render(<TextControl aria-label="Search" size="sm" />);
  expect(screen.getByRole("textbox").className).toContain("py-[7px]");

  rerender(<TextControl aria-label="Search" />);
  expect(screen.getByRole("textbox").className).not.toContain("py-[7px]");
});

test("the step does not reach the multiline field: rows and autosize own the height there", () => {
  render(<TextControl aria-label="Note" as="textarea" size="sm" rows={3} />);

  expect(screen.getByRole("textbox").className).not.toContain("py-[7px]");
});

test("the underlay keeps the step, or the mask remainder would slide off the typed text", () => {
  const { container } = render(
    <TextControl aria-label="Phone" size="sm" underlay={<span>+7 (___) ___</span>} />
  );

  // Подложка и поле лежат в одной ячейке сетки и держат выравнивание общими
  // отступами — разойтись им нельзя.
  const underlay = container.querySelector("[aria-hidden='true']")!;
  expect(underlay.className).toContain("py-[7px]");
});
