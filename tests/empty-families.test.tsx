// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { hasContent, isShowableNumber } from "../src/lib/empty.js";
import { Avatar } from "../src/components/content/Avatar.js";
import { CodeView } from "../src/components/content/CodeView.js";
import { NotificationList } from "../src/components/content/NotificationList.js";
import { Progress } from "../src/components/actions/Progress.js";
import { CopyButton } from "../src/components/actions/CopyButton.js";
import { Segmented } from "../src/components/actions/Segmented.js";
import { ToggleGroup } from "../src/components/actions/ToggleGroup.js";
import { TooltipProvider } from "../src/components/overlays/Tooltip.js";
import { AddIcon } from "../src/icons.js";

afterEach(cleanup);

/**
 * Семейство «пустое — это не только `null`».
 *
 * Кит ловил этот дефект пять раз в пяти компонентах и каждый раз чинил одну
 * точку: `Segmented` завёл себе локальный `hasLabel`, а `CopyButton`,
 * `ToggleGroup`, `NotificationList` и `Progress` остались на `== null`. Тест
 * перечисляет компоненты, обязанные следовать правилу, — чтобы шестой случай
 * ловился здесь, а не в приложении.
 *
 * Проверяется НАБЛЮДАЕМОЕ следствие, а не вызов предиката: доступное имя у
 * кнопки, слот пустого состояния у списка, валидность атрибутов у полосы.
 * Проверка «зовёт ли компонент `hasContent`» сломалась бы на безобидном
 * рефакторинге и ничего не сказала бы о пользователе.
 */
describe("the predicate itself", () => {
  test.each([null, undefined, "", false, [], [null, false]])("%o counts as empty", (value) => {
    expect(hasContent(value as never)).toBe(false);
  });

  test.each([0, "0", "text", ["", "text"]])("%o counts as content", (value) => {
    // Ноль — законное значение счётчика, а не пустота: `<Badge>{0}</Badge>`
    // обязан нарисовать ноль.
    expect(hasContent(value as never)).toBe(true);
  });

  test.each([Number.NaN, Number.POSITIVE_INFINITY, null, undefined])(
    "%o is not a showable number",
    (value) => {
      expect(isShowableNumber(value)).toBe(false);
    }
  );

  test.each([0, 42, -1, 99.9])("%o is a showable number", (value) => {
    expect(isShowableNumber(value)).toBe(true);
  });
});

describe("an empty label is an absent label, not a label", () => {
  test("Segmented: an icon-only option keeps its accessible name", () => {
    render(
      <TooltipProvider>
        <Segmented
          value="grid"
          onChange={() => {}}
          options={[{ value: "grid", label: "", icon: <AddIcon />, tooltip: "Grid" }]}
        />
      </TooltipProvider>
    );

    expect(screen.getByRole("button", { name: "Grid" })).toBeDefined();
  });

  test("CopyButton: an empty child does not leave the button nameless", () => {
    // `children == null` не ловит `""`: `iconOnly` становился ложным,
    // `aria-label` не проставлялся, и рисовалась кнопка с одной декоративной
    // иконкой и нулевым доступным именем — `button-name` уровня critical в axe.
    // Реальная форма вызова — подпись из конфига, которая пришла пустой.
    render(<CopyButton value="token">{""}</CopyButton>);

    expect(screen.getByRole("button").getAttribute("aria-label")).toBeTruthy();
  });

  test("ToggleGroup: an empty label makes an icon-only button, as in Segmented", () => {
    // `{ label: "", icon }` — штатный по словарю `Segmented` способ сказать
    // «только значок». В `ToggleGroup` он давал кнопку с текстовыми отступами и
    // пустым `<span>` внутри: рядом в одной панели они разъезжались.
    render(
      <ToggleGroup
        value={["add"]}
        onChange={() => {}}
        options={[{ id: "add", label: "", icon: <AddIcon />, "aria-label": "Add" }]}
      />
    );

    const button = screen.getByRole("button", { name: "Add" });
    expect(button.querySelector("span:empty")).toBeNull();
  });
});

describe("an empty name is an absent name", () => {
  test("Avatar: an empty name falls back instead of rendering a blank circle", () => {
    // Умолчание срабатывало только на `undefined`. Для `""` —
    // `"".charCodeAt(0)` даёт `NaN`, градиент становился
    // `oklch(0.55 0.13 NaN)`, браузер отбрасывал его целиком, и на светлой теме
    // получался пустой круг белым по белому.
    const { container } = render(<Avatar name="" />);
    const root = container.firstElementChild as HTMLElement;

    expect(root.getAttribute("style") ?? "").not.toContain("NaN");
    expect(root.textContent).not.toBe("");
  });
});

describe("empty content is an empty list, not a rendered one", () => {
  test("NotificationList: an empty array of children shows the empty slot", () => {
    // `children == null` не считает `[]` пустым, а основной способ вызова —
    // именно `{items.map(...)}`. При пустом `items` рисовался `<div role=group>`
    // с пустым `<ul>` внутри, а слот `empty` не появлялся вовсе.
    const items: string[] = [];
    render(
      <NotificationList empty={<span>Nothing here</span>}>
        {items.map((id) => (
          <span key={id} />
        ))}
      </NotificationList>
    );

    expect(screen.getByText("Nothing here")).toBeDefined();
  });

  test("CodeView: a falsy child falls back to the plain code, with its gutter", () => {
    // `children === undefined` и `children ?? code` расходились на `null` и
    // `false`. Идиома `{ready && <Highlighted/>}` при ложном `ready` давала
    // `false ?? code` — то есть `false`, и панель оказывалась пустой.
    const ready = false;
    render(
      <CodeView code={"const a = 1;\nconst b = 2;"} lineNumbers>
        {ready && <span>highlighted</span>}
      </CodeView>
    );

    expect(screen.getByText(/const a = 1/)).toBeDefined();
  });
});

describe("a number that cannot be shown is not a value", () => {
  test("Progress: NaN behaves as unknown progress, not as a full bar", () => {
    // `loaded / total * 100` при нулевом `total` даёт `NaN`. Проверка
    // `value == null` его не ловит, `?? 0` тоже — `??` ловит только
    // null/undefined. В разметку уходило `width: NaN%`: объявление
    // отбрасывалось, и блочный div растягивался на всю ширину контейнера.
    const { container } = render(<Progress label="Upload" value={Number.NaN} />);

    expect(container.innerHTML).not.toContain("NaN");
  });
});
