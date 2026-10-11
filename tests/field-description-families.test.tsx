// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { Combobox } from "../src/components/inputs/Combobox.js";
import { DatePicker } from "../src/components/date-time/DatePicker.js";
import { FormField } from "../src/components/inputs/FormField.js";
import { Select } from "../src/components/inputs/Select.js";
import { TagInput } from "../src/components/inputs/TagInput.js";
import { ColorPicker } from "../src/components/inputs/ColorPicker.js";
import { PinInput } from "../src/components/inputs/PinInput.js";
import { Rating } from "../src/components/inputs/Rating.js";
import { Slider } from "../src/components/inputs/Slider.js";
import { Toggle } from "../src/components/actions/Toggle.js";

afterEach(cleanup);

/**
 * Долг Track C, переданный волной 21 и погашенный волной 22.
 *
 * `FormField` рисует подсказку и ошибку и кладёт их `id` в контекст; поля кита
 * забирают его через `useFieldDescribedBy`. До 3.0.0 забирали только
 * `TextControl` и `NumberInput` — у семей react-aria свои слоты описания, и
 * подсказка формы к их полю не относилась никак: на экране она была, а
 * скринридеру не доставалась.
 *
 * Проверяется ВЫЧИСЛЕННАЯ связь: `aria-describedby` мишени указывает на узел,
 * в котором лежит текст подсказки. Совпадения строк идентификаторов мало —
 * `useId` даёт их зависимыми от порядка тестов, и висящая ссылка в никуда
 * выглядела бы точно так же.
 */

/** Мишень описания и текст, на который она обязана указывать. */
function describedText(target: Element, container: HTMLElement): string[] {
  const ids = target.getAttribute("aria-describedby")?.split(" ").filter(Boolean) ?? [];
  return ids.map(
    (id) => container.querySelector(`#${CSS.escape(id)}`)?.textContent ?? `MISSING:${id}`
  );
}

const items = [
  { id: "1", label: "First" },
  { id: "2", label: "Second" },
];

describe("the FormField description reaches the react-aria families", () => {
  test("Select: the description is linked to the trigger", () => {
    const { container } = render(
      <FormField label="Category" hint="Affects the results">
        <Select items={items} placeholder="Select" onChange={() => {}} />
      </FormField>
    );

    const trigger = screen.getByRole("button", { name: /Select/ });
    expect(describedText(trigger, container)).toEqual(["Affects the results"]);
  });

  test("Combobox: the description is linked to the input", () => {
    const { container } = render(
      <FormField label="Tag" hint="You can type your own">
        <Combobox items={items} aria-label="Tag" />
      </FormField>
    );

    expect(describedText(container.querySelector("input")!, container)).toEqual([
      "You can type your own",
    ]);
  });

  test("DatePicker: the description is linked to the trigger", () => {
    const { container } = render(
      <FormField label="Date" hint="Publishing starts at midnight">
        <DatePicker value="2026-09-07" onChange={() => {}} />
      </FormField>
    );

    expect(describedText(container.querySelector("button")!, container)).toEqual([
      "Publishing starts at midnight",
    ]);
  });

  test("TagInput: the description is linked to the input, not to the tag group", () => {
    // Мишень — поле: описание объясняет, ЧТО НАБИРАТЬ. Набор уже добавленных
    // тегов оно не описывает.
    const { container } = render(
      <FormField label="Tags" hint="Enter adds a tag">
        <TagInput value={["sky"]} onChange={() => {}} aria-label="Tags" />
      </FormField>
    );

    const input = container.querySelector('input[type="text"]')!;
    expect(describedText(input, container)).toEqual(["Enter adds a tag"]);
  });
});

describe("the error displaces the hint instead of standing under it", () => {
  test("Select announces the error when one is set", () => {
    const { container } = render(
      <FormField label="Category" hint="Affects the results" error="Pick a category">
        <Select items={items} placeholder="Select" onChange={() => {}} />
      </FormField>
    );

    // Под полем ровно одно сообщение — и описание указывает именно на него.
    const trigger = screen.getByRole("button", { name: /Select/ });
    expect(describedText(trigger, container)).toEqual(["Pick a category"]);
  });
});

describe("a foreign description is appended to, not displaced", () => {
  test("Select merges its own description with the form one", () => {
    const { container } = render(
      <>
        <span id="sel-own">Active only</span>
        <FormField label="Category" hint="Affects the results">
          <Select
            items={items}
            placeholder="Select"
            onChange={() => {}}
            aria-describedby="sel-own"
          />
        </FormField>
      </>
    );

    // `aria-describedby` — список: потребитель, описавший поле своим узлом, не
    // должен терять подсказку формы.
    const trigger = screen.getByRole("button", { name: /Select/ });
    expect(describedText(trigger, container)).toEqual(["Active only", "Affects the results"]);
  });

  test("TagInput merges its own description with the form one", () => {
    const { container } = render(
      <>
        <span id="tag-own">Up to five tags</span>
        <FormField label="Tags" hint="Enter adds a tag">
          <TagInput value={[]} onChange={() => {}} aria-label="Tags" aria-describedby="tag-own" />
        </FormField>
      </>
    );

    const input = container.querySelector('input[type="text"]')!;
    expect(describedText(input, container)).toEqual(["Up to five tags", "Enter adds a tag"]);
  });
});

describe("outside FormField the markup does not change", () => {
  test("none of the families leaves a dangling aria-describedby", () => {
    // Ссылка в никуда хуже отсутствия: скринридер молча её пропускает, и
    // дефект не виден ни в разметке, ни в тесте, который его ищет.
    const { container } = render(
      <>
        <Select items={items} placeholder="Select" onChange={() => {}} />
        <Combobox items={items} aria-label="Tag" />
        <DatePicker value="2026-09-07" onChange={() => {}} />
        <TagInput value={[]} onChange={() => {}} aria-label="Tags" />
      </>
    );

    for (const el of container.querySelectorAll("[aria-describedby]")) {
      const ids = el.getAttribute("aria-describedby")!.split(" ").filter(Boolean);
      for (const id of ids) {
        expect(
          container.querySelector(`#${CSS.escape(id)}`),
          `dangling reference ${id}`
        ).toBeTruthy();
      }
    }
  });
});

/**
 * Долг волны 22, погашенный волной 26.
 *
 * Волна 22 завела это семейство и охватила поля react-aria. Пять компонентов в
 * охват не попали: `PinInput` строит нативные `input` сам и берёт из
 * `lib/field.ts` только класс оболочки, а `Toggle`, `Slider`, `Rating` и
 * `ColorPicker` контекст не читали вовсе. `<FormField hint="…">` рисовал
 * подсказку, но ни одно из этих полей на неё не ссылалось: на экране она была,
 * скринридеру не доставалась.
 */
describe("the description reaches the fields the kit builds itself", () => {
  test("PinInput: the description is linked to the group, once", () => {
    const { container } = render(
      <FormField label="Code" hint="Six digits from the text message">
        <PinInput length={6} value="" onChange={() => {}} label="Code" />
      </FormField>
    );

    // Именно на группе, а не на шести клетках: иначе подсказка прочиталась бы
    // шесть раз подряд.
    expect(describedText(screen.getByRole("group"), container)).toEqual([
      "Six digits from the text message",
    ]);
  });

  test("Toggle: the description is linked to the switch", () => {
    const { container } = render(
      <FormField label="Notifications" hint="Only about your own items">
        <Toggle checked={false} onCheckedChange={() => {}} label="Notifications" />
      </FormField>
    );

    expect(describedText(screen.getByRole("switch"), container)).toEqual([
      "Only about your own items",
    ]);
  });

  test("Slider: the description is linked to the thumb", () => {
    const { container } = render(
      <FormField label="Quality" hint="Higher means a bigger file">
        <Slider label="Quality" defaultValue={50} />
      </FormField>
    );

    // На бегунке, а не на группе: фокусируется он, и `role="slider"` тоже
    // на нём — группе react-aria атрибут не ставит вовсе.
    expect(describedText(screen.getByRole("slider"), container)).toEqual([
      "Higher means a bigger file",
    ]);
  });

  test("Rating: the description is linked to the radiogroup", () => {
    const { container } = render(
      <FormField label="Quality" hint="Five is the best">
        <Rating value={3} onChange={() => {}} aria-label="Quality" />
      </FormField>
    );

    expect(describedText(screen.getByRole("radiogroup"), container)).toEqual(["Five is the best"]);
  });

  test("ColorPicker: the description is linked to the trigger", () => {
    const { container } = render(
      <FormField label="Brand" hint="Used for accents">
        <ColorPicker value="#3366ff" onChange={() => {}} label="Brand" />
      </FormField>
    );

    expect(describedText(screen.getByRole("button", { name: "Brand" }), container)).toEqual([
      "Used for accents",
    ]);
  });
});

/**
 * Своё описание и описание формы СКЛЕИВАЮТСЯ, а не вытесняют друг друга.
 *
 * Семейство проверяло только «описание доходит», и ошибка пряталась по обе
 * стороны: у `PinInput` спред `{...rest}` стоял после условного, и
 * пользовательский `aria-describedby` затирал контекстный — поле кода внутри
 * `<FormField error="…">` не объявляло ошибку вовсе; у `Toggle` — наоборот,
 * терялась подсказка потребителя.
 *
 * В списке только те, кто склеивает САМ. Вне списка два законных случая:
 * `Rating` и `ColorPicker` объявлены закрытыми интерфейсами без `...rest` —
 * передать им `aria-describedby` нечем, и вытеснять нечего (как у `CopyButton`
 * с `onClick`); а `Slider` склеивать не должен — его `rest` уходит на группу, и
 * react-aria сама сносит описание на бегунок и объединяет со своим. Склейка там
 * давала бы один и тот же `id` дважды.
 */
describe("a consumer description and the form description are merged", () => {
  const CASES = [
    {
      name: "PinInput",
      render: (id: string) => (
        <PinInput length={4} value="" onChange={() => {}} label="Code" aria-describedby={id} />
      ),
      target: () => screen.getByRole("group"),
    },
    {
      name: "Toggle",
      render: (id: string) => (
        <Toggle
          checked={false}
          onCheckedChange={() => {}}
          label="Notifications"
          aria-describedby={id}
        />
      ),
      target: () => screen.getByRole("switch"),
    },
  ] as const;

  test.each(CASES)("$name keeps both descriptions", ({ render: renderCase, target }) => {
    const { container } = render(
      <FormField label="Field" hint="From the form">
        <>
          <span id="own">From the consumer</span>
          {renderCase("own")}
        </>
      </FormField>
    );

    expect(describedText(target(), container).sort()).toEqual(
      ["From the consumer", "From the form"].sort()
    );
  });
});
