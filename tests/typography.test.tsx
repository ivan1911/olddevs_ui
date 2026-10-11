// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { Heading } from "../src/components/content/Heading.js";
import { Text } from "../src/components/content/Text.js";

afterEach(cleanup);

test("as changes the tag without changing the look", () => {
  const { container: paragraph } = render(<Text size="lg">text</Text>);
  const p = paragraph.firstElementChild!;

  cleanup();

  const { container: line } = render(
    <Text size="lg" as="span">
      text
    </Text>
  );
  const span = line.firstElementChild!;

  expect(p.tagName).toBe("P");
  expect(span.tagName).toBe("SPAN");
  // Вид один и тот же: `as` — это про разметку, а не про оформление.
  expect(span.className).toBe(p.className);
});

test("tone overrides muting instead of blending with it", () => {
  const { container } = render(
    <Text tone="danger" level={3}>
      failed
    </Text>
  );

  const el = container.firstElementChild!;
  expect(el.className).toContain("text-danger-strong");
  // Второй краски поверх тона нет: приглушать откалиброванный тон нечем —
  // он рассчитан ровно под 4.5.
  expect(el.className).not.toContain("text-fg-2");
});

test("the heading level sets the tag", () => {
  render(<Heading level={3}>Exceptions</Heading>);

  expect(screen.getByRole("heading", { level: 3, name: "Exceptions" })).toBeTruthy();
});

test("size does not drag the level along", () => {
  const { container } = render(
    <Heading level={4} size="2xl">
      label
    </Heading>
  );

  const el = container.firstElementChild!;
  // Тег остаётся четвёртым уровнем — оглавление документа не ломается, —
  // а кегль берётся заголовка страницы.
  expect(el.tagName).toBe("H4");
  expect(el.className).toContain("text-2xl");
});

test("as on a heading changes the tag but not the size", () => {
  const { container } = render(
    <Heading level={2} as="h4">
      Schedule
    </Heading>
  );

  const el = container.firstElementChild!;
  expect(el.tagName).toBe("H4");
  // Размер по-прежнему от `level`, а не от тега: перенос карточки в диалог
  // меняет её место в оглавлении, а не внешний вид.
  expect(el.className).toContain("text-xl");
});

test("multi-line truncation is set by style, not by a built class", () => {
  const { container } = render(<Text truncate={3}>long text</Text>);

  const el = container.firstElementChild as HTMLElement;
  // Число строк уходит в inline-стиль: класс `line-clamp-${n}`, склеенный в
  // рантайме, Tailwind не увидит — он сканирует исходники как текст.
  expect(el.style.webkitLineClamp).toBe("3");
  expect(el.className).toContain("[display:-webkit-box]");
});

test("the caption step is not eaten by class merging", () => {
  const { container } = render(
    <Text size="caption" level={3}>
      label
    </Text>
  );

  // `caption` — не t-shirt-размер, и штатный `twMerge` относил `text-caption`
  // к группе ЦВЕТА, где он конфликтовал с `text-fg-2`: один из двух молча
  // исчезал, а какой именно — зависело от порядка аргументов. Лечится
  // расширением словаря групп в `lib/cn.ts`.
  const el = container.firstElementChild!;
  expect(el.className).toContain("text-caption");
  expect(el.className).toContain("text-fg-2");
});

test("truncate={0} does not hide the text", () => {
  const { container } = render(<Text truncate={0}>visible text</Text>);

  const el = container.firstElementChild as HTMLElement;
  // `-webkit-line-clamp: 0` на коробке с `overflow: hidden` не показывает
  // ничего. Считаем это опечаткой и обрезаем одной строкой.
  expect(el.style.webkitLineClamp).toBe("");
  expect(el.className).toContain("truncate");
});

test("numeric='tabular' gives equal-width digits without a second font", () => {
  const { container } = render(
    <Text as="span" numeric="tabular">
      0:11
    </Text>
  );

  const el = container.firstElementChild!;
  expect(el.className).toContain("tabular-nums");
  // Ширину цифр меняем, гарнитуру — нет: `font-mono` на таймере означал бы
  // второй шрифт на экране, а просили цифры своего.
  expect(el.className).not.toContain("font-mono");
});

test("digits stay proportional unless numeric is asked for", () => {
  const { container } = render(<Text>0:11</Text>);

  // Умолчание не меняется: обычный текст остаётся с обычными цифрами.
  expect(container.firstElementChild!.className).not.toContain("tabular-nums");
});

test("a heading takes the same digit axis", () => {
  const { container } = render(
    <Heading level={2} numeric="tabular">
      1 280
    </Heading>
  );

  expect(container.firstElementChild!.className).toContain("tabular-nums");
});

test("the digit axis covers a semantic child, not just the text", () => {
  const { container } = render(
    <Text as="span" numeric="tabular">
      <time dateTime="PT11S">0:11</time>
    </Text>
  );

  // Ради этого ось и заводилась: потребитель оборачивает машиночитаемый `time`
  // штатно, а не навешивает утилиту на семантический элемент руками.
  // `font-variant-numeric` наследуется, поэтому класс обязан остаться на
  // обёртке — и никакой разметки внутри компонент не добавляет.
  const wrapper = container.firstElementChild!;
  const time = screen.getByText("0:11");
  expect(wrapper.className).toContain("tabular-nums");
  expect(time.tagName).toBe("TIME");
  expect(time.className).toBe("");
});
