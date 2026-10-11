// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { StrictMode, useState } from "react";
import { afterEach, describe, expect, test } from "vitest";
import {
  Button as AriaButton,
  Tooltip as AriaTooltip,
  TooltipTrigger as AriaTooltipTrigger,
} from "react-aria-components";
import { Drawer } from "../src/components/overlays/Drawer.js";
import { ModalOverlay } from "../src/components/overlays/ModalOverlay.js";
import { Menu, MenuButton, MenuItem, MenuTrigger } from "../src/components/overlays/Menu.js";
import { MENU_PANEL_CLASS } from "../src/lib/menu.js";
import {
  ARIA_OVERLAY_SELECTOR,
  hasOpenAriaOverlay,
  layerCount,
  OVERLAY_LAYER,
  pushOverlayLayer,
} from "../src/lib/overlay-layer.js";
import { CommandPalette } from "../src/components/overlays/CommandPalette.js";
import { Dialog } from "../src/components/overlays/Dialog.js";

afterEach(cleanup);

/**
 * Escape принадлежит ВЕРХНЕМУ слою. Разбор и альтернативы — ADR-0041.
 *
 * Кит строит оверлеи на двух библиотеках сразу, и каждая ведёт свой стек.
 * `Dialog` завёл себе заслон против чужого Escape, но его решение никому не
 * досталось: `Drawer` заслона не имел вовсе, а `ModalOverlay` слушал Escape на
 * `document` без стека и без проверки `defaultPrevented`.
 *
 * ЧЕГО ЗДЕСЬ НЕТ. Сочетание «меню react-aria ВНУТРИ модального слоя Radix» в
 * jsdom не воспроизводится: Radix в модальном режиме глушит взаимодействие с
 * соседями `<body>`, и меню не раскрывается ни щелчком, ни с клавиатуры —
 * проверено. В браузере оно раскрывается, и ради этого сочетания ADR и писан.
 * Сторожить его должен `tests-visual/interactions.spec.ts`, где `Drawer` уже
 * есть. Здесь проверяется то, что проверяемо: условие, по которому заслон
 * срабатывает, и поведение слоя при этом условии.
 */
describe("the layer registry", () => {
  /**
   * Верхний слой определяется ПОЛОЖЕНИЕМ В ДОКУМЕНТЕ, а не порядком
   * регистрации. Эффекты React выполняются снизу вверх: у вложенных подложек
   * внутренняя регистрируется РАНЬШЕ внешней, и правило «последний
   * зарегистрировавшийся» объявляло бы верхней ту, что лежит под всеми.
   */
  test("a nested layer is topmost, even though it registers first", () => {
    const outerNode = document.createElement("div");
    const innerNode = document.createElement("div");
    outerNode.appendChild(innerNode);
    document.body.appendChild(outerNode);

    // Порядок регистрации намеренно обратный вложенности — так их и
    // регистрирует React.
    const inner = pushOverlayLayer();
    inner.attach(innerNode);
    const outer = pushOverlayLayer();
    outer.attach(outerNode);

    expect(inner.isTopmost()).toBe(true);
    expect(outer.isTopmost()).toBe(false);

    inner.release();
    expect(outer.isTopmost()).toBe(true);
    outer.release();
    outerNode.remove();
  });

  test("between siblings the later one in the document is topmost", () => {
    const first = document.createElement("div");
    const second = document.createElement("div");
    document.body.append(first, second);

    const a = pushOverlayLayer();
    a.attach(first);
    const b = pushOverlayLayer();
    b.attach(second);

    expect(b.isTopmost()).toBe(true);
    expect(a.isTopmost()).toBe(false);

    // Слой может уйти не последним: компонент размонтировали из-за смены
    // маршрута, а не потому, что его закрыли.
    b.release();
    expect(a.isTopmost()).toBe(true);
    a.release();
    first.remove();
    second.remove();
  });
});

describe("the foreign-layer predicate", () => {
  test("an open react-aria overlay is visible to the predicate", async () => {
    const user = userEvent.setup();
    expect(hasOpenAriaOverlay()).toBe(false);

    render(
      <MenuTrigger>
        <MenuButton aria-label="Actions">…</MenuButton>
        <Menu>
          <MenuItem id="one">One</MenuItem>
        </Menu>
      </MenuTrigger>
    );
    await user.click(screen.getByRole("button", { name: "Actions" }));

    // Признак — пара `data-rac` + `data-placement`. Её ставит только
    // позиционированный оверлей RAC; ни один узел Radix и ни одно поле кита
    // внутри окна её не несут.
    expect(hasOpenAriaOverlay()).toBe(true);
  });

  test("a plain field of the kit is not mistaken for an overlay", () => {
    render(
      <Drawer open onClose={() => {}} title="Filters">
        <span>drawer body</span>
      </Drawer>
    );

    // `data-rac` есть и у обычных полей RAC — отсюда пара с `data-placement`:
    // прежний заслон различал слои по положению цели события и на `Combobox`
    // внутри окна ошибался.
    expect(hasOpenAriaOverlay()).toBe(false);
  });
});

/**
 * Указатель внутри модального слоя Radix (OLDSUI-51).
 *
 * Модальный Radix ставит `<body>` `pointer-events: none` и возвращает указатель
 * только своим слоям. Оверлей react-aria живёт в портале под `<body>` и без
 * правила кита наследует `none`: меню и список подсказок внутри `Dialog` и
 * `Drawer` не кликались мышью.
 *
 * Само поведение в jsdom не проверить — Radix глушит здесь и раскрытие меню
 * (см. шапку файла), а каскада стилей кита нет вовсе. Щелчок сторожит
 * `tests-visual/interactions.spec.ts`. Здесь — связка, которую браузерный тест
 * не назовёт: правило в `styles.css` написано ровно тем селектором, по которому
 * модуль слоёв узнаёт оверлей react-aria. Разъедутся — правило молча
 * перестанет срабатывать.
 */
describe("the pointer returns to a react-aria overlay", () => {
  const css = readFileSync(resolve(import.meta.dirname, "..", "styles.css"), "utf8");

  test("styles.css re-enables the pointer on the module's selector, in the base layer", () => {
    const at = css.indexOf(`${ARIA_OVERLAY_SELECTOR} {`);
    expect(at, `styles.css has no rule for ${ARIA_OVERLAY_SELECTOR}`).toBeGreaterThan(-1);

    const body = css.slice(at, css.indexOf("}", at));
    expect(body).toMatch(/pointer-events:\s*auto;/);

    // Слой `base`, а не вне слоёв: правило вне слоя перебило бы любой
    // утилитарный класс, и `pointer-events-none` на панели потребителя
    // перестал бы работать.
    const layer = css.lastIndexOf("@layer base {", at);
    expect(layer).toBeGreaterThan(-1);
    const between = css.slice(layer, at);
    const depth = (between.match(/{/g) ?? []).length - (between.match(/}/g) ?? []).length;
    expect(depth).toBe(1);
  });
});

describe("Escape belongs to the topmost layer", () => {
  function NestedOverlays() {
    const [outer, setOuter] = useState(true);
    const [inner, setInner] = useState(true);
    return outer ? (
      <ModalOverlay onClose={() => setOuter(false)}>
        <span>outer</span>
        {inner && (
          <ModalOverlay onClose={() => setInner(false)}>
            <span>inner</span>
          </ModalOverlay>
        )}
      </ModalOverlay>
    ) : null;
  }

  test("nested overlays close one at a time", async () => {
    const user = userEvent.setup();
    render(<NestedOverlays />);

    await user.keyboard("{Escape}");

    expect(screen.queryByText("inner")).toBeNull();
    expect(screen.getByText("outer")).toBeDefined();
  });

  test("the drawer keeps its own Escape when no foreign layer is open", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    function Host() {
      const [open, setOpen] = useState(true);
      return (
        <Drawer open={open} onClose={() => setOpen(false)} title="Filters">
          <span>drawer body</span>
        </Drawer>
      );
    }
    render(<Host />);

    await user.keyboard("{Escape}");

    expect(screen.queryByText("drawer body")).toBeNull();
  });
});

/**
 * StrictMode монтирует, размонтирует и монтирует снова.
 *
 * Слой, положенный в стек из ТЕЛА компонента, после этого цикла обратно не
 * попадал: уборщик снимал его, а повторный рендер видел уже заполненный ref и
 * не регистрировал заново. Подложка переставала считать себя верхней и молча
 * переставала закрываться по Escape — в dev, но не в сборке.
 */
test("an overlay survives the StrictMode mount cycle", async () => {
  const user = userEvent.setup();

  function Host() {
    const [open, setOpen] = useState(true);
    return open ? (
      <ModalOverlay onClose={() => setOpen(false)}>
        <span>body</span>
      </ModalOverlay>
    ) : null;
  }

  render(
    <StrictMode>
      <Host />
    </StrictMode>
  );

  await user.keyboard("{Escape}");

  expect(screen.queryByText("body")).toBeNull();
});

/**
 * Слой панели контекстного меню.
 *
 * `Popover` и `Tooltip` осознанно взяли `z-[120]`; RAC-попоувер получает
 * `zIndex: 100000` инлайном от библиотеки. Radix-попперу копировать было
 * нечего — он берёт z-index из вычисленного стиля содержимого и получал `auto`.
 * Правый клик внутри `Dialog` рисовал меню ПОД затемнением (`z-90`): размытым и
 * некликабельным.
 */
test("the menu panel carries the popover layer, not auto", () => {
  expect(MENU_PANEL_CLASS).toContain(OVERLAY_LAYER.popover);
});

test("the popover layer sits above the modal one", () => {
  const value = (cls: string) => Number(/\[(\d+)\]|z-(\d+)/.exec(cls)?.slice(1).find(Boolean));

  expect(value(OVERLAY_LAYER.popover)).toBeGreaterThan(value(OVERLAY_LAYER.modal));
});

/**
 * Подсказка react-aria не считается чужим слоем.
 *
 * `Tooltip` из RAC несёт ту же пару `data-rac` + `data-placement`, что список
 * или меню, но фокуса не забирает и от появления окна не закрывается. Пока
 * курсор стоит на триггере «?», подсказка висит — и Escape переставал закрывать
 * окно ВООБЩЕ. Свой `Tooltip` кита на Radix, поэтому изнутри пакета это не
 * стреляло; но `react-aria-components` — peer-зависимость (ADR-0004), и
 * подсказка потребителя в любой части страницы гасила Escape у всех окон кита.
 */
test("a react-aria tooltip is not a foreign layer", () => {
  render(
    <AriaTooltipTrigger isOpen>
      <AriaButton>Help</AriaButton>
      <AriaTooltip>Explanation</AriaTooltip>
    </AriaTooltipTrigger>
  );

  expect(document.querySelector("[data-rac][data-placement]")).not.toBeNull();
  expect(hasOpenAriaOverlay()).toBe(false);
});

/**
 * Семейство: КАЖДЫЙ модальный слой кита состоит в стеке.
 *
 * ADR-0041 обещает это прямо («Новый модальный слой кита обязан
 * зарегистрироваться… Сторожит тест-семейство»), а первая версия обещание не
 * держала: регистрировался один `ModalOverlay`, то есть стек решал «подложка
 * против подложки» и ничего больше. Список ниже и есть тот сторож — забытая
 * регистрация ловится здесь, а не в приложении.
 */
describe("every modal layer of the kit registers itself", () => {
  const LAYERS = [
    {
      name: "ModalOverlay",
      render: () => (
        <ModalOverlay onClose={() => {}}>
          <span>body</span>
        </ModalOverlay>
      ),
    },
    {
      name: "Dialog",
      render: () => (
        <Dialog open onClose={() => {}} title="Window">
          <span>body</span>
        </Dialog>
      ),
    },
    {
      name: "Drawer",
      render: () => (
        <Drawer open onClose={() => {}} title="Filters">
          <span>body</span>
        </Drawer>
      ),
    },
    {
      name: "CommandPalette",
      render: () => (
        <CommandPalette
          open
          onClose={() => {}}
          sections={[{ id: "s", label: "S", items: [{ id: "one", label: "First" }] }]}
          onSelect={() => {}}
        />
      ),
    },
  ] as const;

  test.each(LAYERS)("$name takes a place in the stack", ({ render: element }) => {
    // Свой слой регистрируем ПОСЛЕ компонента: если компонент в стеке не
    // состоит, наш окажется единственным и объявит себя верхним.
    render(element());
    const mine = pushOverlayLayer();
    const node = document.createElement("div");
    document.body.appendChild(node);
    mine.attach(node);

    try {
      // Узел компонента лежит в документе раньше нашего либо позже — но он
      // ЕСТЬ, а значит хотя бы один из двух не верхний.
      // Слой компонента обязан быть в стеке — значит нас там не одни.
      expect(layerCount()).toBeGreaterThan(1);
    } finally {
      mine.release();
      node.remove();
    }
  });
});
