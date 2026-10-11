// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { Drawer } from "../src/components/overlays/Drawer.js";

/**
 * Ящик: раскладка слоя, от которой зависит прокрутка внутри него.
 *
 * Поведение замка прокрутки здесь не проверяется и проверено быть не может:
 * `react-remove-scroll` спрашивает у элементов `scrollHeight`, а jsdom всегда
 * отвечает нулём — «проверка», проходящая при любой раскладке, хуже её
 * отсутствия. Само колесо проверено в браузере, на живом ящике.
 *
 * Здесь сторожится причина, а не следствие: замок Radix висит на подложке
 * (`shards: [contentRef]` в `DialogOverlayImpl`), и панель ящика обязана
 * лежать ВНУТРИ неё. Стоило ей стать соседом — и всплывающая панель, открытая
 * изнутри ящика, теряла колесо (OLDSUI-6).
 */

afterEach(cleanup);

test("the panel lives inside the overlay, where the scroll lock is", () => {
  render(
    <Drawer open onClose={vi.fn()} title="Details" closeLabel="Close">
      body
    </Drawer>
  );

  const content = screen.getByRole("dialog");
  /*
    Подложка опознаётся по своей роли в разметке, а не по классу: у неё нет ни
    роли ARIA, ни подписи — это затемнение. Единственный её признак, который
    принадлежит контракту, а не оформлению, — что она предок панели и при этом
    не сама панель.
  */
  const overlay = content.parentElement;

  expect(overlay).not.toBeNull();
  expect(overlay).not.toBe(document.body);
  expect(overlay?.contains(content)).toBe(true);
});

test("the drawer is announced as a dialog and takes its name from the title", () => {
  render(
    <Drawer open onClose={vi.fn()} title="Task details" closeLabel="Close">
      body
    </Drawer>
  );

  // `getByRole` бросает, когда не нашёл, поэтому проверка — сам вызов.
  expect(screen.getByRole("dialog", { name: "Task details" })).toBeTruthy();
});
