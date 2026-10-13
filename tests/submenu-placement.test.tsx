// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { useSubmenuPlacement } from "../src/hooks/useSubmenuPlacement.js";

/*
  Подменю Редактора на узком экране (OLDSUI-147). Сбоку от пункта на телефоне
  места нет ни справа, ни слева: на iPhone сетка размера таблицы уехала за
  левый край. Там подменю открывается под своим пунктом, поверх родителя.
*/

function mockWidth(narrow: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: (query: string) => ({
      matches: query === "(max-width: 639px)" ? narrow : false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  });
}

afterEach(() => Reflect.deleteProperty(window, "matchMedia"));

test("on a narrow screen a submenu opens below its item", () => {
  mockWidth(true);
  expect(renderHook(() => useSubmenuPlacement()).result.current).toBe("bottom start");
});

test("on a wide screen a submenu opens beside its item", () => {
  mockWidth(false);
  expect(renderHook(() => useSubmenuPlacement()).result.current).toBe("right top");
});

test("without matchMedia (server, old browser) a submenu opens beside its item", () => {
  expect(renderHook(() => useSubmenuPlacement()).result.current).toBe("right top");
});
