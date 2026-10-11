// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { Chip } from "../src/components/actions/Chip.js";
import { Segmented } from "../src/components/actions/Segmented.js";
import { TooltipProvider } from "../src/components/overlays/Tooltip.js";

afterEach(cleanup);

/*
 * Кнопка со значком вместо подписи обязана сохранить имя.
 *
 * Оба дефекта ниже нашлись аудитом фронта — 73 нарушения `button-name` на
 * одном экране — и ни один не был виден ни глазами, ни типами: разметка
 * валидна, компонент работает, имени нет.
 */

test("Chip: iconOnly hides the label visually but keeps the name", () => {
  render(
    <Chip iconOnly icon={<span aria-hidden>📱</span>}>
      Phone
    </Chip>
  );

  // Раньше `children` при `iconOnly` не рендерились ВОВСЕ — узла не было,
  // и кнопка оставалась безымянной.
  expect(screen.getByRole("button", { name: "Phone" })).toBeTruthy();
});

test("Chip: mobileIconOnly hides the label with a class, not with display:none", () => {
  render(
    <Chip mobileIconOnly icon={<span aria-hidden>📱</span>}>
      Phone
    </Chip>
  );

  const label = screen.getByText("Phone");
  // `hidden` (display:none) убрал бы узел из дерева доступности на узком
  // экране; `sr-only` оставляет его читаемым всегда.
  expect(label.className).toContain("sr-only");
  expect(label.className).not.toContain("hidden");
  expect(screen.getByRole("button", { name: "Phone" })).toBeTruthy();
});

test("Segmented: an empty label counts as absent and the name comes from the tooltip", () => {
  render(
    // Провайдер обязателен вокруг `Segmented` с подсказками — он держит общую
    // задержку показа на всю группу, а не заводит её каждому сегменту.
    <TooltipProvider>
      <Segmented
        value="phone"
        onChange={() => {}}
        options={[
          {
            value: "phone",
            label: "",
            icon: <span aria-hidden>📱</span>,
            tooltip: "Phone preview",
          },
          { value: "desktop", label: "Desktop" },
        ]}
      />
    </TooltipProvider>
  );

  // Условие было `label == null`, и пустая строка его не проходила:
  // `aria-label` не проставлялся, кнопка оставалась без имени.
  expect(screen.getByRole("button", { name: "Phone preview" })).toBeTruthy();
  // У сегмента с подписью имя берётся из неё, а не из подсказки.
  expect(screen.getByRole("button", { name: "Desktop" })).toBeTruthy();
});

/*
 * Режим «только значок на узком экране» (OLDSUI-19).
 *
 * Ширину экрана jsdom не знает вовсе — брейкпоинт живёт в CSS. Поэтому здесь
 * проверяется НЕ то, как выглядит, а то, что подпись осталась узлом дерева:
 * ровно тот дефект, ради которого режим и заводится в ките. Вид меряется в
 * браузере (`tests-visual/interactions.spec.ts`).
 */

test("Segmented: mobileIconOnly hides the label visually and keeps it the name", () => {
  render(
    <Segmented
      value="active"
      onChange={() => {}}
      mobileIconOnly
      options={[
        { value: "active", icon: <span aria-hidden>▤</span>, label: "Active" },
        { value: "done", icon: <span aria-hidden>▪</span>, label: "Done" },
      ]}
    />
  );

  const label = screen.getByText("Active");
  // `hidden` (display:none) убрал бы узел из дерева на узком экране; `sr-only`
  // оставляет его читаемым всегда, а `sm:not-sr-only` возвращает глазам.
  expect(label.className).toContain("sr-only");
  expect(label.className).toContain("sm:not-sr-only");
  expect(label.className).not.toContain("hidden");
  expect(screen.getByRole("button", { name: "Active" })).toBeTruthy();
  // Подсказка в этом режиме не нужна: имя даёт сама подпись.
  expect(screen.getByRole("button", { name: "Active" }).getAttribute("aria-label")).toBeNull();
});

test("Segmented: without the prop the label is a plain visible label", () => {
  render(
    <Segmented
      value="active"
      onChange={() => {}}
      options={[{ value: "active", icon: <span aria-hidden>▤</span>, label: "Active" }]}
    />
  );

  expect(screen.getByText("Active").className).not.toContain("sr-only");
});

test("Segmented: a segment without an icon keeps its label even in the mode", () => {
  render(
    <Segmented
      value="active"
      onChange={() => {}}
      mobileIconOnly
      options={[
        { value: "active", icon: <span aria-hidden>▤</span>, label: "Active" },
        { value: "all", label: "All" },
      ]}
    />
  );

  // Прятать подпись не в пользу значка означало бы пустую кнопку: имя есть,
  // на экране ничего. Ряд с одним словом читается хуже ровного, но нажать
  // можно всё, что видно.
  expect(screen.getByText("All").className).not.toContain("sr-only");
  expect(screen.getByText("Active").className).toContain("sr-only");
});

test("Segmented: the selected segment is still marked by aria-pressed, not by colour", () => {
  render(
    <Segmented
      value="done"
      onChange={() => {}}
      mobileIconOnly
      options={[
        { value: "active", icon: <span aria-hidden>▤</span>, label: "Active" },
        { value: "done", icon: <span aria-hidden>▪</span>, label: "Done" },
      ]}
    />
  );

  // Без подписей это важнее обычного: цвет остаётся единственным, что видно.
  expect(screen.getByRole("button", { name: "Done" }).getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByRole("button", { name: "Active" }).getAttribute("aria-pressed")).toBe("false");
});
