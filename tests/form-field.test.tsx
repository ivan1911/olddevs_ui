// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { FieldLayoutProvider, FormField } from "../src/components/inputs/FormField.js";
import { useFieldLabelId } from "../src/hooks/useFieldDescription.js";
import { NumberInput } from "../src/components/inputs/NumberInput.js";
import { TextControl } from "../src/components/inputs/TextControl.js";

afterEach(cleanup);

/** Читает `id` подписи так, как читает поле, которое `<label for>` не называет. */
function LabelIdProbe() {
  return <span data-testid="probe">{useFieldLabelId() ?? ""}</span>;
}

test("the error displaces the hint instead of standing under it", () => {
  render(
    <FormField label="Name" hint="How subscribers will see it" error="Name is required">
      <TextControl aria-label="Name" />
    </FormField>
  );

  expect(screen.getByText("Name is required")).toBeTruthy();
  // Две строки под полем, одна из которых противоречит другой, — источник шума.
  expect(screen.queryByText("How subscribers will see it")).toBeNull();
});

test("the error is announced as an alert", () => {
  render(
    <FormField label="Name" error="Name is required">
      <TextControl aria-label="Name" />
    </FormField>
  );

  // Без роли скринридер не объявит ошибку вовсе: она появляется после отправки,
  // когда фокус уже ушёл с поля.
  expect(screen.getByRole("alert").textContent).toBe("Name is required");
});

test("the hint is shown while there is no error", () => {
  render(
    <FormField label="Name" hint="How subscribers will see it">
      <TextControl aria-label="Name" />
    </FormField>
  );

  expect(screen.getByText("How subscribers will see it")).toBeTruthy();
  expect(screen.queryByRole("alert")).toBeNull();
});

test("the required asterisk is not read aloud", () => {
  render(
    <FormField label="Name" required htmlFor="ff-name">
      <TextControl id="ff-name" />
    </FormField>
  );

  // Проверяется ВЫЧИСЛЕННОЕ доступное имя, а не текст подписи: `aria-hidden`
  // исключается именно вычислением, и `getByLabelText`, который матчит по
  // тексту, увидел бы «Название *».
  //
  // Имя поля — «Название», а не «Название звёздочка»: обязательность объявляет
  // само поле, а не украшение рядом с подписью.
  expect(screen.getByRole("textbox", { name: "Name" })).toBeTruthy();
  expect(screen.getByText("*").getAttribute("aria-hidden")).toBe("true");
});

test("without the prop and without context the markup does not change by a single node", () => {
  const { container } = render(
    <FormField label="Name" hint="How subscribers will see it" htmlFor="ff-a">
      <TextControl id="ff-a" />
    </FormField>
  );

  // Ось добавлена к СТАБИЛЬНОМУ компоненту, и цена такого изменения — обещание,
  // что без оси он остаётся прежним. Проверяется разметкой целиком, а не
  // отдельными классами: иначе обещание держится на том, что мы догадались
  // проверить нужный узел.
  //
  // Идентификатор описания приходит из `useId` и зависит от порядка тестов —
  // сравнивать с ним буквально нельзя. Он подменяется своим именем, и
  // подстановка заодно доказывает, что ссылка и цель — один и тот же узел:
  // будь их два, вторая осталась бы в строке непереименованной.
  const description = container.querySelector("input")!.getAttribute("aria-describedby")!;
  // Единственное СОЗНАТЕЛЬНОЕ изменение разметки — `id` на подписи (OLDSUI-40):
  // поле, которое нельзя назвать через `<label for>` (`contenteditable`),
  // ссылается на неё `aria-labelledby`. Он тоже из `useId`, поэтому подменяется
  // по тому же приёму; больше ни один узел и ни один атрибут не добавлен.
  const labelId = container.querySelector("label")!.id;
  expect(
    container.innerHTML.replaceAll(description, "DESCRIPTION").replaceAll(labelId, "LABEL")
  ).toBe(
    '<div class="flex flex-col gap-1.5">' +
      '<label id="LABEL" for="ff-a" class="text-fg-2 text-[11px] font-bold tracking-wide uppercase">Name</label>' +
      '<div class="border-line bg-bg-2 rounded-control border px-3 shadow-[var(--shadow-1)] transition-[border-color,box-shadow] duration-150 focus-within:border-accent-strong focus-within:ring-[3px] focus-within:ring-[color:var(--focus-ring)] invalid:border-danger-strong has-[input[aria-invalid=true]]:border-danger-strong has-[textarea[aria-invalid=true]]:border-danger-strong has-[input:disabled]:cursor-not-allowed has-[input:disabled]:opacity-50 has-[textarea:disabled]:cursor-not-allowed has-[textarea:disabled]:opacity-50">' +
      '<input data-disable-focus-ring="true" class="text-fg-0 w-full [appearance:none] border-0 bg-transparent px-0 py-[10px] text-[13px] leading-5 shadow-none outline-none [-webkit-tap-highlight-color:transparent] focus:border-0 focus:ring-0 focus:outline-none focus-visible:ring-0 focus-visible:outline-none disabled:cursor-not-allowed" id="ff-a" aria-describedby="DESCRIPTION">' +
      "</div>" +
      '<div id="DESCRIPTION" class="text-fg-3 text-[11px]">How subscribers will see it</div>' +
      "</div>"
  );
});

test("the label publishes its id, so a field that for= cannot name still gets its name", () => {
  render(
    <FormField label="Name">
      <LabelIdProbe />
    </FormField>
  );

  const label = screen.getByText("Name");
  expect(label.id).not.toBe("");
  expect(screen.getByTestId("probe").textContent).toBe(label.id);
});

test("without FormField there is no label id", () => {
  render(<LabelIdProbe />);

  expect(screen.getByTestId("probe").textContent).toBe("");
});

test("without a hint and without an error no description appears at all", () => {
  // Висящий `id` в никуда хуже отсутствия: скринридер молча пропускает такую
  // ссылку, и дефект не виден ни в разметке, ни в тесте, который его ищет.
  const { container } = render(
    <FormField label="Name" htmlFor="ff-plain">
      <TextControl id="ff-plain" />
    </FormField>
  );

  expect(container.querySelector("input")!.hasAttribute("aria-describedby")).toBe(false);
});

test("the hint is announced on entering the field", () => {
  render(
    <FormField label="Phone" hint="Including the country code" htmlFor="ff-hint">
      <TextControl id="ff-hint" />
    </FormField>
  );

  // Проверяется не наличие атрибута, а то, что он ведёт к нужному ТЕКСТУ:
  // связь с пустым или чужим узлом атрибут бы прошла, а пользователь — нет.
  expect(screen.getByRole("textbox", { description: "Including the country code" })).toBeTruthy();
});

test("the description follows the error that displaced the hint", () => {
  render(
    <FormField
      label="Phone"
      hint="Including the country code"
      error="Not enough digits"
      htmlFor="ff-err"
    >
      <TextControl id="ff-err" />
    </FormField>
  );

  // Под полем нарисовано ровно одно сообщение, и описание указывает на него,
  // а не на скрытую подсказку.
  expect(screen.getByRole("textbox", { description: "Not enough digits" })).toBeTruthy();
  expect(screen.queryByText("Including the country code")).toBeNull();
});

test("a foreign description is appended to, not displaced", () => {
  render(
    <>
      <span id="ff-own">Latin only</span>
      <FormField label="Login" hint="Visible to others" htmlFor="ff-merge">
        <TextControl id="ff-merge" aria-describedby="ff-own" />
      </FormField>
    </>
  );

  // `aria-describedby` — список, и потребитель, описавший поле своим узлом,
  // вправе рассчитывать, что тот никуда не денется.
  expect(screen.getByRole("textbox", { description: "Latin only Visible to others" })).toBeTruthy();
});

test("a numeric field is described the same way", () => {
  render(
    <FormField label="Print run" hint="No more than a thousand" htmlFor="ff-num">
      <NumberInput label="Print run" value={10} onChange={() => {}} />
    </FormField>
  );

  expect(screen.getByRole("textbox", { description: "No more than a thousand" })).toBeTruthy();
});

test('layout="side" moves the label into a column, not into another node', () => {
  const { container } = render(
    <FormField label="Name" layout="side" htmlFor="ff-b">
      <TextControl id="ff-b" />
    </FormField>
  );

  const root = container.firstElementChild as HTMLElement;
  expect(root.className).toContain("grid-cols-[var(--form-label-w,12rem)_minmax(0,1fr)]");
  // Подпись остаётся тем же `<label htmlFor>`: боковая раскладка меняет место,
  // а не владельца подписи.
  expect(root.querySelector("label")?.getAttribute("for")).toBe("ff-b");
});

test("in the side layout the error stands under the field, not under the label", () => {
  const { container } = render(
    <FormField label="Name" layout="side" error="Name is required">
      <TextControl aria-label="Name" />
    </FormField>
  );

  // Проверяется место в разметке, а не класс: ошибка относится к вводу и живёт
  // в колонке поля вместе с ним.
  const column = (container.firstElementChild as HTMLElement).children[1] as HTMLElement;
  expect(column.contains(screen.getByRole("alert"))).toBe(true);
});

test("the axis comes from the layout context", () => {
  const { container } = render(
    <FieldLayoutProvider value="side">
      <FormField label="Name" htmlFor="ff-c">
        <TextControl id="ff-c" />
      </FormField>
    </FieldLayoutProvider>
  );

  // Иначе потребитель проставлял бы `layout="side"` каждому полю руками, и
  // первое забытое давало бы кривой ряд.
  expect((container.firstElementChild as HTMLElement).className).toContain("grid");
});

test("an explicit prop outranks the context", () => {
  const { container } = render(
    <FieldLayoutProvider value="side">
      <FormField label="Name" layout="stack" htmlFor="ff-d">
        <TextControl id="ff-d" />
      </FormField>
    </FieldLayoutProvider>
  );

  expect((container.firstElementChild as HTMLElement).className).toContain("flex flex-col");
});

test('layout="side" works outside FormLayout', () => {
  const { container } = render(
    <FormField label="Name" layout="side" htmlFor="ff-e">
      <TextControl id="ff-e" />
    </FormField>
  );

  // Ширина колонки — переменная, а не `subgrid`: `subgrid` потребовал бы
  // внешнего грида, а поле обязано работать само по себе.
  expect((container.firstElementChild as HTMLElement).className).toContain("var(--form-label-w");
});

/**
 * Регрессия. Грид раскладывает детей по ячейкам, а не по смыслу: второй
 * ребёнок (диапазон «от» и «до», поле с кнопкой рядом) попадал в следующий ряд
 * ПОД ПОДПИСЬ. Поле, пояснение и ошибка уезжают в одну колонку целиком.
 */
test("in the side layout two fields stay in their own column", () => {
  const { container } = render(
    <FormField label="Range" layout="side" hint="Inclusive">
      <TextControl aria-label="From" />
      <TextControl aria-label="To" />
    </FormField>
  );

  const root = container.firstElementChild as HTMLElement;
  // У грида ровно две ячейки: подпись и колонка поля.
  expect(root.children).toHaveLength(2);
  const column = root.children[1] as HTMLElement;
  expect(column.querySelectorAll("input")).toHaveLength(2);
  expect(column.textContent).toContain("Inclusive");
});

test("the stack layout adds no extra wrapper", () => {
  const { container } = render(
    <FormField label="Name" hint="Hint">
      <TextControl aria-label="Name" />
    </FormField>
  );

  // Ветка side не должна протечь в stack: там дети лежат прямо в корне.
  expect(container.firstElementChild?.children).toHaveLength(3);
});

/**
 * Ошибка формы доводится ДО ПОЛЯ, а не только до текста под ним.
 *
 * `FIELD_SHELL_CLASS` красит рамку по `has-[input[aria-invalid=true]]`, то есть
 * ищет атрибут на самом поле. В контекст уходило только описание, и поле
 * атрибут не ставило: под полем был красный текст, а рамка обычная. Чтобы она
 * покраснела, потребитель обязан был передать `aria-invalid` сам — а строки
 * `aria-invalid` нет ни в одном файле `docs/`.
 */
test("a field inside an errored FormField marks itself invalid", () => {
  render(
    <FormField label="Name" error="Too long">
      <TextControl aria-label="Name" />
    </FormField>
  );

  expect(screen.getByLabelText("Name").getAttribute("aria-invalid")).toBe("true");
});

test("a hint does not make the field invalid", () => {
  render(
    <FormField label="Name" hint="Up to 80 characters">
      <TextControl aria-label="Name" />
    </FormField>
  );

  expect(screen.getByLabelText("Name").getAttribute("aria-invalid")).toBeNull();
});

test("an explicit aria-invalid from the consumer wins", () => {
  render(
    <FormField label="Name" error="Too long">
      <TextControl aria-label="Name" aria-invalid={false} />
    </FormField>
  );

  expect(screen.getByLabelText("Name").getAttribute("aria-invalid")).toBe("false");
});

describe("hintPersistent (ADR-0065)", () => {
  test("by default the error replaces the hint", () => {
    render(
      <FormField label="Card" htmlFor="card" hint="The full number gives 10% off" error="Too short">
        <TextControl id="card" />
      </FormField>
    );
    expect(screen.queryByText("The full number gives 10% off")).toBeNull();
    expect(screen.getByRole("alert").textContent).toBe("Too short");
  });

  test("with hintPersistent the hint stays and the error goes under it", () => {
    render(
      <FormField
        label="Card"
        htmlFor="card"
        hint="The full number gives 10% off"
        error="Too short"
        hintPersistent
      >
        <TextControl id="card" />
      </FormField>
    );
    const hint = screen.getByText("The full number gives 10% off");
    const error = screen.getByRole("alert");
    expect(hint.compareDocumentPosition(error) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // Обе строки описывают поле, ошибка — последней: её дочитывают в конце.
    const field = screen.getByRole("textbox");
    expect(field.getAttribute("aria-describedby")).toBe(`${hint.id} ${error.id}`);
    expect(field.getAttribute("aria-invalid")).toBe("true");
  });

  test("with hintPersistent and no error only the hint describes the field", () => {
    render(
      <FormField label="Card" htmlFor="card" hint="The full number gives 10% off" hintPersistent>
        <TextControl id="card" />
      </FormField>
    );
    const hint = screen.getByText("The full number gives 10% off");
    expect(screen.getByRole("textbox").getAttribute("aria-describedby")).toBe(hint.id);
  });
});
