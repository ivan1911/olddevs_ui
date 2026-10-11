// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { useStickyOffset } from "../src/hooks/useStickyOffset.js";

/** Каждый созданный наблюдатель и то, ЖИВ ли он сейчас. */
const created: { rootMargin?: string; live: boolean }[] = [];

beforeEach(() => {
  created.length = 0;
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      /*
        Запись СВОЯ у каждого экземпляра, и в ней есть `live`.

        Создать наблюдатель мало — надо остаться подключённым. Проверка «а был
        ли создан нужный `rootMargin`» пропускала случай, когда новый
        наблюдатель создан и тут же отключён уборщиком прошлого эффекта: полоса
        замирала навсегда, а тест был зелёным. Это тот же род слепоты, с
        которого волна началась.
      */
      record: { rootMargin?: string; live: boolean };

      constructor(_cb: unknown, options?: { rootMargin?: string }) {
        // Число описано ТОЧНО, а не `[\d.]+`: тот класс принимает `1.2.3` и `..`,
        // то есть заглушка приняла бы ровно то, что браузер отвергает, — и
        // подтверждала бы сама себя, как это уже было с `offsetHeight`.
        const margin = options?.rootMargin;
        const LENGTH = String.raw`-?(\d+(\.\d+)?|\.\d+)(px|%)`;
        if (margin != null && !new RegExp(`^${LENGTH}( ${LENGTH}){0,3}$`).test(margin.trim())) {
          throw new SyntaxError(
            `Failed to construct 'IntersectionObserver': rootMargin must be specified in pixels or percent (${margin}).`
          );
        }
        this.record = { rootMargin: margin, live: false };
        created.push(this.record);
      }
      observe() {
        this.record.live = true;
      }
      disconnect() {
        this.record.live = false;
      }
      unobserve() {}
    }
  );
});

/** Наблюдатели, подключённые прямо сейчас. */
const liveObservers = () => created.filter((c) => c.live);

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.documentElement.style.removeProperty("--topbar-h");
  document.documentElement.style.removeProperty("--panel-h");
});

function Probe({ offsetVar }: { offsetVar?: string }) {
  const { sentinelRef } = useStickyOffset(offsetVar ? { offsetVar } : undefined);
  return <div ref={sentinelRef} />;
}

test("the offset comes from the application variable, not from a number", () => {
  document.documentElement.style.setProperty("--topbar-h", "55px");
  render(<Probe />);
  // Зашитое число оставляло просвет: на узких экранах шапка ниже.
  expect(created.at(-1)?.rootMargin).toBe("-55px 0px 0px 0px");
});

test("the variable name is overridable: the package knows nothing about the header", () => {
  document.documentElement.style.setProperty("--panel-h", "40px");
  render(<Probe offsetVar="--panel-h" />);
  expect(created.at(-1)?.rootMargin).toBe("-40px 0px 0px 0px");
});

test("without the variable the offset is zero, not an error", () => {
  render(<Probe />);
  expect(created.at(-1)?.rootMargin).toBe("-0px 0px 0px 0px");
});

test("a variable published in rem is converted, not just tolerated", () => {
  // `IntersectionObserver` принимает только пиксели и проценты. Значение шло в
  // `rootMargin` как есть, и `4rem` давал `SyntaxError` внутри callback-ref —
  // то есть во время коммита, роняя поддерево целиком.
  //
  // Утверждается ТОЧНОЕ число. В jsdom раскладки нет и зонд намерил бы ноль —
  // тогда `-0px` прошёл бы любую проверку «единица px», и сам перевод единиц
  // не сторожился бы ничем. Поэтому высота зонда выводится из его же
  // inline-стиля: 1rem = 16px.
  const rect = Element.prototype.getBoundingClientRect;
  Element.prototype.getBoundingClientRect = function () {
    const height = (this as HTMLElement).style?.height ?? "";
    const rem = /^(-?[\d.]+)rem$/.exec(height);
    return { ...rect.call(this), height: rem ? Number(rem[1]) * 16 : 0 } as DOMRect;
  };

  try {
    document.documentElement.style.setProperty("--topbar-h", "4rem");
    render(<Probe />);
    expect(created.at(-1)?.rootMargin).toBe("-64px 0px 0px 0px");
  } finally {
    Element.prototype.getBoundingClientRect = rect;
  }
});

test("a negative published offset does not build a double minus", () => {
  // Знак приписывался строкой, и `-` + `-10px` давало `--10px` — `SyntaxError`
  // в конструкторе наблюдателя, то есть то же падение поддерева.
  document.documentElement.style.setProperty("--topbar-h", "-10px");

  expect(() => render(<Probe />)).not.toThrow();
  expect(created.at(-1)?.rootMargin).toBe("10px 0px 0px 0px");
});

test("a malformed number is measured rather than passed through", () => {
  // `1.2.3px` — не длина. Пропущенное как есть, оно роняет наблюдателя.
  document.documentElement.style.setProperty("--topbar-h", "1.2.3px");

  render(<Probe />);

  // Утверждается РЕЗУЛЬТАТ замера, а не «не упало»: с `not.toThrow()` тест был
  // зелёным и при полностью удалённом замере (возврат `fallback`).
  expect(created.at(-1)?.rootMargin).toBe("-0px 0px 0px 0px");
});

test("a missing IntersectionObserver is a state, not a crash", () => {
  // Общий `tests/setup-jsdom.ts` этого API не подкладывает, и оба теста кита,
  // которые досюда доходят, латали его у себя — то есть заплатка уже была
  // продублирована, а потребителю пришлось бы написать её третий раз.
  vi.stubGlobal("IntersectionObserver", undefined);

  expect(() => render(<Probe />)).not.toThrow();
  // Состояние, а не просто «не упало»: наблюдателя нет, полоса не прижата.
  expect(created).toHaveLength(0);
});

test("a resize storm is collapsed into one frame", async () => {
  render(<Probe />);
  const afterMount = created.length;

  /*
    Считаем ЧТЕНИЯ СТИЛЯ, а не созданных наблюдателей.

    Наблюдателей и так не прибавится — их бережёт отсечка по значению. Но
    дорога здесь не пересборка, а синхронный `getComputedStyle` корня на каждое
    событие: это принудительный пересчёт стилей на каждый кадр протягивания
    рамки окна. Считая только `created`, тест был зелёным и с полностью
    удалённым `requestAnimationFrame`.
  */
  const reads = vi.spyOn(window, "getComputedStyle");
  for (let i = 0; i < 20; i += 1) window.dispatchEvent(new Event("resize"));
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  // РОВНО одно, а не «не больше одного»: `toBeLessThanOrEqual(1)` выполняется и
  // при нуле, то есть тест оставался зелёным с полностью удалённым слушателем
  // `resize` — он не утверждал, что на событие вообще есть реакция.
  expect(reads.mock.calls.length).toBe(1);
  expect(created.length).toBe(afterMount);
  reads.mockRestore();
});

test("a resize that actually changes the height rebuilds the observer", async () => {
  render(<Probe />);
  const afterMount = created.length;

  // Парный сторож к предыдущему: тот проверяет, что лишней работы нет, этот —
  // что нужная всё-таки делается.
  document.documentElement.style.setProperty("--topbar-h", "72px");
  window.dispatchEvent(new Event("resize"));
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  expect(created.length).toBeGreaterThan(afterMount);
  expect(created.at(-1)?.rootMargin).toBe("-72px 0px 0px 0px");
});

test("the header growing a second row reaches the hook without a resize", async () => {
  document.documentElement.style.setProperty("--topbar-h", "56px");
  render(<Probe />);
  expect(created.at(-1)?.rootMargin).toBe("-56px 0px 0px 0px");

  // Высота шапки меняется не только на брейкпоинте: `TopBar` публикует её через
  // `ResizeObserver` и в комментарии прямо называет перенос содержимого слотов
  // и вторую строку в поиске. Ширина окна при этом не меняется.
  document.documentElement.style.setProperty("--topbar-h", "96px");
  // Два кадра, а не один: порядок микрозадач между резолвером теста и
  // колбэком `MutationObserver` иначе зависит от раннера.
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  expect(created.at(-1)?.rootMargin).toBe("-96px 0px 0px 0px");
});

/**
 * Смена `offsetVar` оставляет ровно ОДИН живой наблюдатель.
 *
 * Уборщик эффекта отключал наблюдатель, но не обнулял рефы. Пока отсечек в
 * `connect` не было, следующий `resize` пересоздавал его безусловно и сбой
 * лечился сам. Отсечки по значению эту страховку убрали: мёртвый, но не
 * обнулённый `observerRef` выглядит для них живым, и полоса замирала НАВСЕГДА.
 *
 * Порядок React делает это неочевидным: он отцепляет старый callback-ref,
 * цепляет новый (тот создаёт ЖИВОЙ наблюдатель) и только потом гоняет уборщик
 * старого эффекта, который этот свежий наблюдатель и отключал. Поэтому
 * проверять надо ЖИВОСТЬ, а не факт создания — на «создан ли нужный
 * `rootMargin`» тест проходил и на сломанном коде.
 */
test("changing offsetVar leaves exactly one live observer", async () => {
  document.documentElement.style.setProperty("--topbar-h", "56px");
  document.documentElement.style.setProperty("--subnav-h", "40px");

  function Probe2({ offsetVar }: { offsetVar: string }) {
    const { sentinelRef } = useStickyOffset({ offsetVar });
    return <div ref={sentinelRef} />;
  }

  const { rerender } = render(<Probe2 offsetVar="--topbar-h" />);
  rerender(<Probe2 offsetVar="--subnav-h" />);
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  expect(liveObservers()).toHaveLength(1);
  expect(liveObservers()[0]?.rootMargin).toBe("-40px 0px 0px 0px");

  document.documentElement.style.removeProperty("--subnav-h");
});
