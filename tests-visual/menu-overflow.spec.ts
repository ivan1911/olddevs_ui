import { expect, test } from "@playwright/test";

/**
 * Меню не вылезает из своей панели (OLDSUI-147).
 *
 * Высоту поповеру react-aria ставит сам — инлайном `max-height` по видимой
 * области. На iOS 27 в Safari она вышла в несколько пикселей: рамка с тенью
 * схлопнулась в полоску, а пункты при `overflow: visible` нарисовались поверх
 * Документа без подложки. Воспроизвести iOS здесь нельзя, поэтому тест ставит
 * такую же маленькую высоту руками и проверяет, что пункты остаются внутри
 * панели и прокручиваются в ней.
 */

const STORY = "/iframe.html?id=inputs-richtexteditor--table-menu&globals=theme:light;accent:blue";

test("a menu squeezed by a tiny max-height scrolls inside its panel instead of spilling over the page", async ({
  page,
}) => {
  await page.goto(STORY);
  await page.getByRole("textbox", { name: "Document" }).locator("td").first().click();
  await page.getByRole("button", { name: "Table", exact: true }).click();
  const menu = page.getByRole("menu", { name: "Table" });
  await expect(menu).toBeVisible();

  // Как на iOS 27: панель меню получила высоту в пару строк. Правилом с
  // `!important`, а не инлайном: react-aria пересчитывает позицию и затёр бы
  // инлайновый `max-height` своим.
  const panel = menu.locator("xpath=..");
  await panel.evaluate((node) => node.setAttribute("data-squeezed", ""));
  await page.addStyleTag({ content: "[data-squeezed] { max-height: 48px !important; }" });

  const last = page.getByRole("menuitem", { name: "Delete table" });
  const box = await last.boundingBox();
  if (!box) throw new Error("the last menu item has no box");
  // Пункт за краем панели обрезан: в его точке на экране — не он.
  const hit = await page.evaluate(
    ([x, y]) => document.elementFromPoint(x, y)?.closest('[role="menuitem"]')?.textContent ?? null,
    [box.x + box.width / 2, box.y + box.height / 2] as const
  );
  expect(hit ?? "").not.toContain("Delete table");

  // И до него можно докрутить внутри панели.
  await last.scrollIntoViewIfNeeded();
  await expect(last).toBeInViewport();
  expect(await panel.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
});
