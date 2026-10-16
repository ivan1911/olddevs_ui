import { readFileSync } from "node:fs";
import { resolve } from "node:path";
// Именованный импорт, не дефолтный: пакет экспортирует оба, но при `moduleResolution`
// этого проекта дефолтный резолвится в пространство имён модуля и не конструируется.
import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { stubVideoServices } from "./video-services.js";
import type { Result } from "axe-core";

/**
 * Аудит доступности каждой истории в каждой теме — тем же axe-core, на котором
 * работает аддон a11y в Storybook.
 *
 * Зачем дублировать аддон: аддон показывает результат человеку, открывшему
 * историю. Здесь их 17 × 3 темы = 51 экран, и «проверено глазами» для такого
 * количества означает «проверено выборочно». Автомат проверяет все и падает
 * в CI, а не в чьей-то памяти.
 *
 * Порог — `serious` и `critical`. `moderate` и `minor` не роняют прогон
 * намеренно: среди них есть замечания к разметке самих историй (таблицы-матрицы),
 * а не к примитивам, и красить ими пайплайн значит приучить его игнорировать.
 *
 * Отношение к `npm run contrast`: axe меряет отрендеренный DOM конкретной
 * истории, скрипт — все сочетания токенов, включая не показанные ни в одной
 * истории. Второе — надмножество, но только axe видит реальные наложения.
 */

type Entry = { id: string; name: string; title: string; type: string; tags?: string[] };

const index = JSON.parse(
  readFileSync(resolve(import.meta.dirname, "../storybook-static/index.json"), "utf8")
) as { entries: Record<string, Entry> };

const stories = Object.values(index.entries).filter((e) => e.type === "story");
const THEMES = ["dark", "light", "dim"] as const;
const BLOCKING = new Set(["serious", "critical"]);

/**
 * Аддон a11y в витрине запускает axe сам, как только история отрендерилась,
 * а axe-core не переносит двух одновременных прогонов и падает с «Axe is
 * already running». Чей прогон окажется первым — гонка, и чем больше историй,
 * тем чаще она проигрывается: на 21 истории падало от одного до пяти тестов
 * за прогон.
 *
 * Ждём, пока чужой прогон закончится, и повторяем. Ретрай только на этой
 * ошибке: любое другое падение обязано оставаться падением.
 */
/**
 * Досматривает входные анимации до конца, прежде чем мерить цвета.
 *
 * `animate-fadein` и `animate-sheetin` начинаются с `opacity: 0`, и axe,
 * запущенный сразу после появления DOM, считает цвет полупрозрачного текста
 * поверх подложки: белая подпись на карточке оказывалась `#2c2d33` при
 * контрасте 1.11. Дефект был бы у любого анимированного примитива, а выглядел
 * бы как провал контраста — то есть отправил бы чинить совершенно не то.
 *
 * У снимков та же проблема решена `animations: "disabled"` в конфиге, но на
 * axe эта настройка не распространяется — она про момент съёмки.
 */
async function freezeAnimations(page: Page) {
  await page.addStyleTag({
    content: `*, *::before, *::after {
      animation-duration: 0s !important;
      animation-delay: 0s !important;
      transition-duration: 0s !important;
      transition-delay: 0s !important;
    }`,
  });
}

async function analyzeWhenFree(page: Page, scope: string) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await new AxeBuilder({ page }).include(scope).analyze();
    } catch (e) {
      const busy = e instanceof Error && e.message.includes("Axe is already running");
      if (!busy || attempt >= 10) throw e;
      await page.waitForTimeout(150);
    }
  }
}

/**
 * Оси прогона: три темы базового кита плюс один бренд-оверлей.
 *
 * Полное произведение (3 темы × 2 акцента × 2 бренда) дало бы 12 наборов на
 * историю — вчетверо дороже при том же классе находок: акцент и бренд меняют
 * ЦВЕТ, а не разметку, и нарушения уровня serious/critical у axe — почти
 * целиком контраст. Контраст же меряется полностью и дешевле в
 * `npm run contrast`: там перебираются все сочетания токенов, включая не
 * показанные ни одной историей.
 *
 * Поэтому здесь бренд проверяется на тёмной теме — одном наборе, который
 * доказывает, что оверлей не ломает разметку и не гасит имена, — а полнота
 * цветовых сочетаний остаётся за гейтом контраста.
 */
const RUNS = [
  ...THEMES.map((theme) => ({ label: `theme ${theme}`, globals: `theme:${theme};accent:blue` })),
  { label: "brand teal, dark", globals: "theme:dark;accent:blue;brand:teal" },
];

for (const story of stories) {
  for (const run of RUNS) {
    test(`a11y: ${story.id} — ${run.label}`, async ({ page }) => {
      // Плеер видео встаёт сразу: чужой сервис в аудит не попадает.
      if (story.id.includes("video")) await stubVideoServices(page);
      await page.goto(`/iframe.html?id=${story.id}&globals=${run.globals}`);
      const canvas = page.locator("#storybook-root");
      // Готовность — сигнал самой витрины: `sb-show-main` на body ставится,
      // когда история отрисовалась. Одной видимости холста мало: история
      // пустого состояния (`RichTextView` с пустым HTML) законно рисует
      // контейнер нулевой высоты, и Playwright такой холст видимым не считает.
      // Пустой холст при открытом окне — не пустая история, а окно, которое ещё
      // не скрыло холст: его ждём, как прежде.
      await page.locator("body.sb-show-main").waitFor({ state: "attached" });
      // Метка `network-idle`: история догружает ленивый чанк после показа
      // (как в `stories.spec.ts`), и без ожидания axe проверил бы экран без него.
      if (story.tags?.includes("network-idle")) await page.waitForLoadState("networkidle");
      await expect
        .poll(async () => {
          return (
            (await canvas.isVisible()) ||
            (await canvas.getAttribute("data-aria-hidden")) === "true" ||
            (await canvas.evaluate(
              (node) =>
                node.getBoundingClientRect().height === 0 &&
                !document.querySelector('[role="dialog"], [role="alertdialog"]')
            ))
          );
        })
        .toBe(true);
      await freezeAnimations(page);

      // Модальный Dialog рендерится portal-ом и корректно скрывает canvas от
      // assistive technology. В этом случае canvas нельзя ни ждать видимым,
      // ни сканировать: область аудита — активное окно в portal-е.
      const scope =
        (await canvas.getAttribute("data-aria-hidden")) === "true"
          ? '[role="dialog"], [role="alertdialog"]'
          : "#storybook-root";
      const { violations } = await analyzeWhenFree(page, scope);
      const blocking = violations.filter((v: Result) => BLOCKING.has(v.impact ?? ""));

      // Сообщение называет НЕ ТОЛЬКО правило, но и узел: без селектора
      // «label — 1 nodes» отправляет искать по всей истории руками.
      expect(
        blocking.map(
          (v: Result) =>
            `${v.impact}: ${v.id} — ${v.help}\n` +
            v.nodes
              .map((n) => `      ${n.target.join(" ")}\n      ${n.html.slice(0, 160)}`)
              .join("\n")
        ),
        "Violations at the serious/critical level"
      ).toEqual([]);
    });
  }
}
