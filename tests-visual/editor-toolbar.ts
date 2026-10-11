import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Клавиатурный путь к кнопке Панели Редактора: `Alt+F10` из документа, `Home`
 * и `→`, пока фокус не встанет на кнопку с именем `name`.
 *
 * Путь тот же, что у пользователя без мыши, но число шагов не зашито: раньше
 * сценарии считали «четвёртая с конца» и «седьмая», и каждая перестановка
 * Панели (меню «…», раскладка OLDSUI-66) роняла их, не задевая проверяемое
 * поведение. Теперь ряд можно переставлять — сценарий ищет кнопку по имени.
 */
export async function focusToolbarButton(page: Page, name: string): Promise<Locator> {
  const toolbar = page.getByRole("toolbar", { name: "Formatting", exact: true });
  const button = toolbar.getByRole("button", { name, exact: true });
  await page.keyboard.press("Alt+F10");
  await expect(toolbar.locator(":focus")).toHaveCount(1);
  await page.keyboard.press("Home");
  const count = await toolbar.getByRole("button").count();
  for (let step = 0; step < count; step++) {
    if (await button.evaluate((node) => node === document.activeElement)) return button;
    await page.keyboard.press("ArrowRight");
  }
  throw new Error(`no toolbar button named "${name}" on the keyboard path`);
}
